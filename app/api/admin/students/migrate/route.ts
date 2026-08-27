import { NextResponse } from "next/server";
import { adminDb } from "../../../../../lib/server/firebase-admin";
import { requireSession } from "../../../../../lib/server/portal-auth";
import { normalizeAssignments } from "../../../../../lib/teacher-assignments";
import {
  SCHOOL_CLASSES_COLLECTION,
  SCHOOL_STUDENTS_COLLECTION,
  canonicalClassName,
  classId,
  nextStudentCode,
  normalizeStudentRecord,
  studentIdentity,
  type SchoolStudent,
} from "../../../../../lib/school-roster";

const LEGACY_SHARED = "school_shared_students";
const WRITE_CHUNK_SIZE = 100;
const SOURCE_CHUNK_SIZE = 5;

type LegacySource = { teacherId: string; subjectId: string };
type Candidate = Record<string, unknown> & {
  __id?: string;
};

function isQuotaError(error: unknown) {
  const source = error as { code?: unknown; message?: unknown };
  const code = String(source?.code || "").toLowerCase();
  const message = String(source?.message || "").toLowerCase();
  return code.includes("resource-exhausted")
    || message.includes("resource_exhausted")
    || message.includes("quota exceeded")
    || message.includes("maximum backoff delay");
}

function isTimeoutError(error: unknown) {
  return String((error as { message?: unknown })?.message || "").includes("migration_timeout");
}

function withTimeout<T>(promise: Promise<T>, milliseconds = 10000) {
  return Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("migration_timeout")), milliseconds)),
  ]);
}

async function loadLegacySources() {
  const teachersSnapshot = await withTimeout(
    adminDb().collection("portalV2Users").where("role", "==", "teacher").get(),
  );
  const sources = new Map<string, LegacySource>();
  teachersSnapshot.docs.forEach(teacher => {
    const data = teacher.data() as Record<string, unknown>;
    const assignments = normalizeAssignments(data.assignments, data.subjectIds);
    assignments.forEach(assignment => {
      const key = `${teacher.id}__${assignment.subjectId}`;
      sources.set(key, { teacherId: teacher.id, subjectId: assignment.subjectId });
    });
  });
  return [...sources.values()];
}

function sameStudentData(left: SchoolStudent, right: SchoolStudent) {
  return left.name === right.name
    && left.grade === right.grade
    && left.section === right.section
    && left.className === right.className
    && left.active !== false;
}

export async function POST(request: Request) {
  if (!await requireSession("admin")) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const cursor = Math.max(0, Number(body?.cursor) || 0);
    const candidates: Candidate[] = [];

    // The central roster is intentionally read once per recovery batch. With the
    // school size this remains small, while preventing duplicate students/codes.
    const [centralSnapshot, legacySources] = await Promise.all([
      withTimeout(adminDb().collection(SCHOOL_STUDENTS_COLLECTION).get()),
      loadLegacySources(),
    ]);

    const centralStudents = centralSnapshot.docs
      .map(item => normalizeStudentRecord(item.data() as Record<string, unknown>, item.id))
      .filter((item): item is SchoolStudent => !!item);

    if (cursor === 0) {
      const sharedSnapshot = await withTimeout(adminDb().collection(LEGACY_SHARED).get());
      sharedSnapshot.docs.forEach(item => {
        candidates.push({ __id: item.id, ...(item.data() as Record<string, unknown>) });
      });

      if (Array.isArray(body?.students)) {
        body.students.forEach((item: unknown) => {
          if (item && typeof item === "object") candidates.push(item as Candidate);
        });
      }
    }

    const selectedSources = legacySources.slice(cursor, cursor + SOURCE_CHUNK_SIZE);
    for (const source of selectedSources) {
      try {
        const snapshot = await withTimeout(
          adminDb().collection(`portalV2Data/${source.teacherId}/subjects/${source.subjectId}/students`).get(),
        );
        snapshot.docs.forEach(item => {
          candidates.push({ __id: item.id, ...(item.data() as Record<string, unknown>) });
        });
      } catch (error) {
        if (isQuotaError(error) || isTimeoutError(error)) throw error;
        console.warn("legacy roster source skipped", source, error);
      }
    }

    const byCode = new Map(centralStudents.map(student => [student.code, student]));
    const byIdentity = new Map(centralStudents.map(student => [studentIdentity(student), student]));
    const working = [...centralStudents];
    const changes = new Map<string, SchoolStudent>();
    let skipped = 0;
    let added = 0;
    let updated = 0;
    let unchanged = 0;
    let collisionRecovered = 0;

    for (const candidate of candidates) {
      const normalized = normalizeStudentRecord(
        { ...candidate, active: true, rosterActive: true },
        String(candidate.__id || ""),
      );
      if (!normalized) {
        skipped += 1;
        continue;
      }

      const identity = studentIdentity(normalized);
      const sameStudent = byIdentity.get(identity);
      if (sameStudent) {
        const merged: SchoolStudent = {
          ...sameStudent,
          name: normalized.name,
          grade: normalized.grade,
          section: normalized.section,
          className: canonicalClassName(normalized.grade, normalized.section),
          active: true,
          updatedAt: sameStudent.updatedAt,
        };

        if (sameStudentData(sameStudent, merged)) {
          unchanged += 1;
          continue;
        }

        merged.updatedAt = new Date().toISOString();
        changes.set(sameStudent.code, merged);
        byCode.set(sameStudent.code, merged);
        byIdentity.set(identity, merged);
        updated += 1;
        continue;
      }

      let code = normalized.code;
      const codeOwner = byCode.get(code);
      const hasCollision = !!codeOwner && studentIdentity(codeOwner) !== identity;
      if (!/^TH[123]\d{3}$/.test(code) || hasCollision || changes.has(code)) {
        code = nextStudentCode([...working, ...changes.values()], normalized.grade);
        if (hasCollision) collisionRecovered += 1;
      }
      if (!code) {
        skipped += 1;
        continue;
      }

      const now = new Date().toISOString();
      const student: SchoolStudent = {
        ...normalized,
        id: code,
        code,
        active: true,
        className: canonicalClassName(normalized.grade, normalized.section),
        updatedAt: now,
        createdAt: normalized.createdAt || now,
      };
      changes.set(code, student);
      working.push(student);
      byCode.set(code, student);
      byIdentity.set(identity, student);
      added += 1;
    }

    const rows = [...changes.values()];
    for (let index = 0; index < rows.length; index += WRITE_CHUNK_SIZE) {
      const chunk = rows.slice(index, index + WRITE_CHUNK_SIZE);
      const batch = adminDb().batch();
      const classes = new Map<string, { grade: number; section: string; name: string }>();

      chunk.forEach(student => {
        batch.set(adminDb().collection(SCHOOL_STUDENTS_COLLECTION).doc(student.code), {
          code: student.code,
          name: student.name,
          grade: student.grade,
          section: student.section,
          className: student.className,
          active: true,
          createdAt: student.createdAt || new Date().toISOString(),
          updatedAt: student.updatedAt || new Date().toISOString(),
        }, { merge: true });
        classes.set(classId(student.grade, student.section), {
          grade: student.grade,
          section: student.section,
          name: student.className,
        });
      });

      classes.forEach((schoolClass, id) => {
        batch.set(adminDb().collection(SCHOOL_CLASSES_COLLECTION).doc(id), {
          ...schoolClass,
          active: true,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      });
      await withTimeout(batch.commit());
    }

    const nextCursor = cursor + selectedSources.length;
    const complete = nextCursor >= legacySources.length;
    return NextResponse.json({
      ok: true,
      migrated: changes.size,
      added,
      updated,
      unchanged,
      skipped,
      collisionRecovered,
      linkedToSubjects: 0,
      total: byCode.size,
      cursor,
      nextCursor,
      complete,
      processedSources: selectedSources.length,
      sourceCount: legacySources.length,
      remainingSources: Math.max(0, legacySources.length - nextCursor),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("migrate school roster failed", error);
    if (isQuotaError(error)) {
      return NextResponse.json({
        ok: false,
        message: "انتهت الحصة المجانية لليوم. لم تُحذف أي قائمة، وسيكمل الاسترجاع من آخر نقطة بعد تجدد الحصة.",
      }, { status: 429 });
    }
    if (isTimeoutError(error)) {
      return NextResponse.json({
        ok: false,
        message: "قاعدة البيانات مشغولة الآن. لم تُحذف أي قائمة، وسيكمل الاسترجاع من آخر نقطة.",
      }, { status: 503 });
    }
    return NextResponse.json({ ok: false, message: "تعذر استرجاع القوائم الحالية الآن" }, { status: 500 });
  }
}
