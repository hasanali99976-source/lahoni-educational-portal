import { NextResponse } from "next/server";
import { adminDb } from "../../../../../lib/server/firebase-admin";
import { requireSession } from "../../../../../lib/server/portal-auth";
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
const WRITE_CHUNK_SIZE = 200;

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

function withTimeout<T>(promise: Promise<T>, milliseconds = 5000) {
  return Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("migration_timeout")), milliseconds)),
  ]);
}

export async function POST(request: Request) {
  if (!await requireSession("admin")) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({}));
    const candidates: Array<Record<string, unknown> & { __id?: string }> = [];

    const [centralSnapshot, sharedSnapshot] = await Promise.all([
      withTimeout(adminDb().collection(SCHOOL_STUDENTS_COLLECTION).get()),
      withTimeout(adminDb().collection(LEGACY_SHARED).get()),
    ]);

    const centralStudents = centralSnapshot.docs
      .map(item => normalizeStudentRecord(item.data() as Record<string, unknown>, item.id))
      .filter((item): item is SchoolStudent => !!item);

    // The shared roster is the single legacy server source. Reading every teacher and
    // every subject caused excessive Firestore reads and could exceed the free quota.
    sharedSnapshot.docs.forEach(item => candidates.push({ __id: item.id, ...(item.data() as Record<string, unknown>) }));

    if (Array.isArray(body?.students)) {
      body.students.forEach((item: unknown) => {
        if (item && typeof item === "object") candidates.push(item as Record<string, unknown>);
      });
    }

    const byCode = new Map(centralStudents.map(student => [student.code, student]));
    const byIdentity = new Map(centralStudents.map(student => [studentIdentity(student), student]));
    const working = [...centralStudents];
    const additions = new Map<string, SchoolStudent>();
    let skipped = 0;
    let added = 0;
    let updated = 0;

    for (const candidate of candidates) {
      const normalized = normalizeStudentRecord(candidate, String(candidate.__id || ""));
      if (!normalized) { skipped += 1; continue; }
      const identity = studentIdentity(normalized);
      const existing = byCode.get(normalized.code) || byIdentity.get(identity);
      if (existing) {
        const merged = {
          ...existing,
          name: normalized.name,
          grade: normalized.grade,
          section: normalized.section,
          className: canonicalClassName(normalized.grade, normalized.section),
          active: true,
          updatedAt: new Date().toISOString(),
        };
        additions.set(existing.code, merged);
        byCode.set(existing.code, merged);
        byIdentity.set(identity, merged);
        updated += 1;
        continue;
      }

      let code = normalized.code;
      if (!/^TH[123]\d{3}$/.test(code) || byCode.has(code) || additions.has(code)) {
        code = nextStudentCode([...working, ...additions.values()], normalized.grade);
      }
      if (!code) { skipped += 1; continue; }
      const student = {
        ...normalized,
        id: code,
        code,
        active: true,
        className: canonicalClassName(normalized.grade, normalized.section),
        updatedAt: new Date().toISOString(),
        createdAt: normalized.createdAt || new Date().toISOString(),
      };
      additions.set(code, student);
      working.push(student);
      byCode.set(code, student);
      byIdentity.set(identity, student);
      added += 1;
    }

    const rows = [...additions.values()];
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
          createdAt: new Date().toISOString(),
        }, { merge: true });
      });
      await withTimeout(batch.commit());
    }

    return NextResponse.json({
      ok: true,
      migrated: additions.size,
      added,
      updated,
      skipped,
      total: byCode.size,
    });
  } catch (error) {
    console.error("migrate school roster failed", error);
    if (isQuotaError(error)) {
      return NextResponse.json({
        ok: false,
        message: "وصلت قاعدة البيانات إلى حد الاستخدام المؤقت. القوائم محفوظة؛ أعد المحاولة لاحقًا دون تكرار الضغط.",
      }, { status: 429 });
    }
    if (isTimeoutError(error)) {
      return NextResponse.json({
        ok: false,
        message: "قاعدة البيانات مشغولة الآن. لم تُحذف أي قائمة؛ أعد المحاولة لاحقًا مرة واحدة.",
      }, { status: 503 });
    }
    return NextResponse.json({ ok: false, message: "تعذر نقل القوائم الحالية الآن" }, { status: 500 });
  }
}
