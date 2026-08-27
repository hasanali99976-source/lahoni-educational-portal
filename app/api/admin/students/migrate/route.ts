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

export async function POST(request: Request) {
  if (!await requireSession("admin")) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({}));
    const candidates: Array<Record<string, unknown> & { __id?: string }> = [];

    const centralSnapshot = await adminDb().collection(SCHOOL_STUDENTS_COLLECTION).get();
    const centralStudents = centralSnapshot.docs
      .map(item => normalizeStudentRecord(item.data() as Record<string, unknown>, item.id))
      .filter((item): item is SchoolStudent => !!item);

    const sharedSnapshot = await adminDb().collection(LEGACY_SHARED).get();
    sharedSnapshot.docs.forEach(item => candidates.push({ __id: item.id, ...(item.data() as Record<string, unknown>) }));

    const teachersSnapshot = await adminDb().collection("portalV2Users").where("role", "==", "teacher").get();
    for (const teacher of teachersSnapshot.docs) {
      const data = teacher.data() as Record<string, unknown>;
      const assignments = normalizeAssignments(data.assignments, data.subjectIds);
      const subjectIds = [...new Set(assignments.map(item => item.subjectId).filter(Boolean))];
      for (const subjectId of subjectIds) {
        try {
          const snapshot = await adminDb().collection(`portalV2Data/${teacher.id}/subjects/${subjectId}/students`).get();
          snapshot.docs.forEach(item => candidates.push({ __id: item.id, ...(item.data() as Record<string, unknown>) }));
        } catch {
          // Continue with the remaining legacy sources.
        }
      }
    }

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

    for (const candidate of candidates) {
      const normalized = normalizeStudentRecord(candidate, String(candidate.__id || ""));
      if (!normalized) { skipped += 1; continue; }
      const identity = studentIdentity(normalized);
      const existing = byCode.get(normalized.code) || byIdentity.get(identity);
      if (existing) {
        const merged = { ...existing, name: normalized.name, grade: normalized.grade, section: normalized.section, className: normalized.className, active: true, updatedAt: new Date().toISOString() };
        additions.set(existing.code, merged);
        byCode.set(existing.code, merged);
        byIdentity.set(identity, merged);
        continue;
      }

      let code = normalized.code;
      if (!/^TH[123]\d{3}$/.test(code) || byCode.has(code) || additions.has(code)) code = nextStudentCode([...working, ...additions.values()], normalized.grade);
      if (!code) { skipped += 1; continue; }
      const student = { ...normalized, id: code, code, active: true, className: canonicalClassName(normalized.grade, normalized.section), updatedAt: new Date().toISOString(), createdAt: normalized.createdAt || new Date().toISOString() };
      additions.set(code, student);
      working.push(student);
      byCode.set(code, student);
      byIdentity.set(identity, student);
    }

    const batch = adminDb().batch();
    const classes = new Map<string, { grade: number; section: string; name: string }>();
    additions.forEach(student => {
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
      classes.set(classId(student.grade, student.section), { grade: student.grade, section: student.section, name: student.className });
    });
    classes.forEach((schoolClass, id) => batch.set(adminDb().collection(SCHOOL_CLASSES_COLLECTION).doc(id), { ...schoolClass, active: true, updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() }, { merge: true }));
    if (additions.size) await batch.commit();

    return NextResponse.json({ ok: true, migrated: additions.size, skipped, total: centralStudents.length + additions.size });
  } catch (error) {
    console.error("migrate school roster failed", error);
    return NextResponse.json({ ok: false, message: "تعذر نقل القوائم الحالية" }, { status: 500 });
  }
}
