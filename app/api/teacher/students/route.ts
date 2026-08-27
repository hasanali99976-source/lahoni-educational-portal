import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { findUserById, requireSession } from "../../../../lib/server/portal-auth";
import { normalizeAssignments } from "../../../../lib/teacher-assignments";
import {
  SCHOOL_CLASSES_COLLECTION,
  SCHOOL_STUDENTS_COLLECTION,
  classMatchesAssignments,
  normalizeClassRecord,
  normalizeStudentRecord,
  studentMatchesAssignments,
  type SchoolClass,
  type SchoolStudent,
} from "../../../../lib/school-roster";

export async function GET(request: Request) {
  const session = await requireSession("teacher");
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const user = await findUserById(session.userId);
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });
    const subjectId = String(new URL(request.url).searchParams.get("subjectId") || "").split("--")[0];
    const assignments = normalizeAssignments(user.assignments, user.subjectIds);
    const relevant = assignments.filter(item => item.subjectId === subjectId);
    if (!subjectId || !relevant.length) return NextResponse.json({ ok: true, students: [], classes: [], assignments: [] });

    const centralSnapshot = await adminDb().collection(SCHOOL_STUDENTS_COLLECTION).get();
    let students = centralSnapshot.docs
      .map(item => normalizeStudentRecord(item.data() as Record<string, unknown>, item.id))
      .filter((item): item is SchoolStudent => !!item && item.active !== false && studentMatchesAssignments(item, assignments, subjectId));

    if (!students.length) {
      try {
        const legacySnapshot = await adminDb().collection(`portalV2Data/${session.userId}/subjects/${subjectId}/students`).get();
        students = legacySnapshot.docs
          .map(item => normalizeStudentRecord(item.data() as Record<string, unknown>, item.id))
          .filter((item): item is SchoolStudent => !!item && item.active !== false && studentMatchesAssignments(item, assignments, subjectId));
      } catch {
        students = [];
      }
    }

    const classesSnapshot = await adminDb().collection(SCHOOL_CLASSES_COLLECTION).get();
    const classMap = new Map<string, SchoolClass>();
    classesSnapshot.docs.forEach(item => {
      const schoolClass = normalizeClassRecord({ id: item.id, ...(item.data() as Record<string, unknown>) } as Partial<SchoolClass>);
      if (schoolClass && schoolClass.active !== false && classMatchesAssignments(schoolClass, assignments, subjectId)) classMap.set(schoolClass.id, schoolClass);
    });
    students.forEach(student => {
      const id = `${student.grade}-${student.section}`;
      if (!classMap.has(id)) classMap.set(id, { id, grade: student.grade, section: student.section, name: student.className, active: true });
    });

    students.sort((a, b) => a.className.localeCompare(b.className, "ar", { numeric: true }) || a.name.localeCompare(b.name, "ar"));
    const classes = [...classMap.values()].sort((a, b) => a.grade - b.grade || Number(a.section) - Number(b.section));
    return NextResponse.json({ ok: true, students, classes, assignments: relevant }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("teacher central roster failed", error);
    return NextResponse.json({ ok: false, message: "تعذر تحميل قائمة الطلاب" }, { status: 500 });
  }
}
