import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { findUserById, requireSession } from "../../../../lib/server/portal-auth";
import { normalizeAssignments } from "../../../../lib/teacher-assignments";
import { defaultSelectedClassIds } from "../../../../lib/teacher-class-scope";
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
  TEACHER_CLASS_SCOPES_COLLECTION,
  normalizeClassIds,
  teacherClassScopeId,
} from "../../../../lib/teacher-class-scope";

type Grade = 1 | 2 | 3;
type CachedResult = { expiresAt: number; payload: Record<string, unknown> };

const CLASS_OPTIONS_TTL_MS = 5 * 60 * 1000;
const classOptionsCache = new Map<string, CachedResult>();
const classOptionsInflight = new Map<string, Promise<Record<string, unknown>>>();

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

async function loadClassOptions(teacherId: string, subjectId: string, grade: Grade, assignments: ReturnType<typeof normalizeAssignments>, refresh: boolean) {
  const key = `${teacherId}:${subjectId}:${grade}`;
  const now = Date.now();
  const cached = classOptionsCache.get(key);
  if (!refresh && cached && cached.expiresAt > now) return cached.payload;
  const pending = classOptionsInflight.get(key);
  if (pending) return pending;

  const work = (async () => {
    const database = adminDb();
    const scopeRef = database.collection(TEACHER_CLASS_SCOPES_COLLECTION)
      .doc(teacherClassScopeId(teacherId, subjectId, grade));
    const [classSnapshot, studentSnapshot, scopeSnapshot] = await Promise.all([
      database.collection(SCHOOL_CLASSES_COLLECTION).get(),
      database.collection(SCHOOL_STUDENTS_COLLECTION).get(),
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

    const availableClasses = [...classMap.values()]
      .filter(item => /^\d+-\d+$/.test(item.id))
      .sort((a, b) => Number(a.section) - Number(b.section));
    const availableIds = new Set(availableClasses.map(item => item.id));
    const selectedClassIds = scopeSnapshot.exists && scopeSnapshot.data()?.customized === true
      ? normalizeClassIds(scopeSnapshot.data()?.selectedClassIds).filter(item => availableIds.has(item))
      : defaultSelectedClassIds(assignments, subjectId, availableClasses, grade);

    const payload = {
      ok: true,
      subjectId,
      grade,
      availableClasses,
      selectedClassIds,
      hiddenOwnedByOtherTeachers: 0,
      totalClasses: availableClasses.length,
      manualClassSelection: true,
      officialAdminRoster: true,
      persistedInDatabase: scopeSnapshot.exists,
    };
    classOptionsCache.set(key, { expiresAt: Date.now() + CLASS_OPTIONS_TTL_MS, payload });
    return payload;
  })();

  classOptionsInflight.set(key, work);
  try {
    return await work;
  } finally {
    classOptionsInflight.delete(key);
  }
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

    const payload = await loadClassOptions(session.userId, subjectId, grade, relevant, url.searchParams.get("refresh") === "1");
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("teacher class options failed", error);
    return NextResponse.json({ ok: false, message: "تعذر تحميل فصول المرحلة الآن." }, { status: 500 });
  }
}
