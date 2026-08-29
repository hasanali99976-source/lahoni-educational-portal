import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { findUserById, requireSession } from "../../../../lib/server/portal-auth";
import { normalizeAssignments } from "../../../../lib/teacher-assignments";
import {
  SCHOOL_CLASSES_COLLECTION,
  SCHOOL_STUDENTS_COLLECTION,
  classId,
  gradeNumber,
  normalizeClassRecord,
  normalizeStudentRecord,
  type SchoolClass,
  type SchoolStudent,
} from "../../../../lib/school-roster";
import {
  SUBJECT_CLASS_OWNERS_COLLECTION,
  TEACHER_CLASS_SCOPES_COLLECTION,
  normalizeClassIds,
  teacherClassScopeId,
} from "../../../../lib/teacher-class-scope";

type Grade = 1 | 2 | 3;

function parseGrade(value: unknown): Grade | null {
  const number = Number(value || 0);
  return number === 1 || number === 2 || number === 3 ? number as Grade : null;
}

function classFromStudent(student: SchoolStudent): SchoolClass {
  return {
    id: classId(student.grade, student.section),
    grade: student.grade,
    section: student.section,
    name: student.className,
    active: true,
  };
}

export async function GET(request: Request) {
  const session = await requireSession("teacher");
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const user = await findUserById(session.userId);
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });

    const url = new URL(request.url);
    const subjectId = String(url.searchParams.get("subjectId") || "").split("--")[0].trim();
    const grade = parseGrade(url.searchParams.get("grade"));
    const assignments = normalizeAssignments(user.assignments, user.subjectIds);
    const relevant = assignments.filter(item => item.subjectId === subjectId && (!grade || gradeNumber(item.grade) === grade));
    const assignmentGrades = new Set<Grade>(
      relevant.map(item => gradeNumber(item.grade)).filter((item): item is Grade => !!item),
    );

    if (!subjectId || !grade || !assignmentGrades.has(grade)) {
      return NextResponse.json({ ok: false, message: "المادة أو المرحلة غير مرتبطة بحسابك." }, { status: 400 });
    }

    const database = adminDb();
    const scopeRef = database.collection(TEACHER_CLASS_SCOPES_COLLECTION)
      .doc(teacherClassScopeId(session.userId, subjectId, grade));
    const [classSnapshot, studentSnapshot, ownerSnapshot, scopeSnapshot] = await Promise.all([
      database.collection(SCHOOL_CLASSES_COLLECTION).get(),
      database.collection(SCHOOL_STUDENTS_COLLECTION).get(),
      database.collection(SUBJECT_CLASS_OWNERS_COLLECTION).where("subjectId", "==", subjectId).get(),
      scopeRef.get(),
    ]);

    const classMap = new Map<string, SchoolClass>();
    classSnapshot.docs.forEach(document => {
      const normalized = normalizeClassRecord({ id: document.id, ...(document.data() as Record<string, unknown>) } as Partial<SchoolClass>);
      if (!normalized || normalized.active === false || normalized.grade !== grade) return;
      classMap.set(normalized.id, normalized);
    });
    studentSnapshot.docs.forEach(document => {
      const student = normalizeStudentRecord(document.data() as Record<string, unknown>, document.id);
      if (!student || student.active === false || student.grade !== grade) return;
      classMap.set(classId(student.grade, student.section), classFromStudent(student));
    });

    const ownerByClass = new Map<string, string>();
    ownerSnapshot.docs.forEach(document => {
      const data = document.data() as Record<string, unknown>;
      const ownedClassId = String(data.classId || "");
      const ownerTeacherId = String(data.teacherId || "");
      if (ownedClassId && ownerTeacherId) ownerByClass.set(ownedClassId, ownerTeacherId);
    });

    const allClasses = [...classMap.values()]
      .filter(item => /^\d+-\d+$/.test(item.id))
      .sort((a, b) => Number(a.section) - Number(b.section));
    const availableClasses = allClasses.filter(item => {
      const owner = ownerByClass.get(item.id);
      return !owner || owner === session.userId;
    });
    const availableIds = new Set(availableClasses.map(item => item.id));
    const ownedByTeacher = allClasses
      .filter(item => ownerByClass.get(item.id) === session.userId)
      .map(item => item.id);
    const storedSelection = scopeSnapshot.exists
      ? normalizeClassIds(scopeSnapshot.data()?.selectedClassIds).filter(item => availableIds.has(item))
      : [];
    const selectedClassIds = [...new Set([...ownedByTeacher, ...storedSelection])]
      .filter(item => ownerByClass.get(item) === session.userId);

    return NextResponse.json({
      ok: true,
      subjectId,
      grade,
      availableClasses,
      selectedClassIds,
      hiddenOwnedByOtherTeachers: Math.max(0, allClasses.length - availableClasses.length),
      totalClasses: allClasses.length,
      persistedInDatabase: scopeSnapshot.exists,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("teacher class options failed", error);
    return NextResponse.json({ ok: false, message: "تعذر تحميل الفصول المتبقية الآن." }, { status: 500 });
  }
}
