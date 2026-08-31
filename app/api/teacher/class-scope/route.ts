import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { requireSession } from "../../../../lib/server/portal-auth";
import { normalizeAssignments } from "../../../../lib/teacher-assignments";
import {
  SCHOOL_CLASSES_COLLECTION,
  SCHOOL_STUDENTS_COLLECTION,
  classId,
  gradeNumber,
  normalizeClassRecord,
  normalizeStudentRecord,
  type SchoolClass,
} from "../../../../lib/school-roster";
import {
  SUBJECT_CLASS_OWNERS_COLLECTION,
  TEACHER_CLASS_SCOPES_COLLECTION,
  assignmentScopeSignature,
  normalizeClassIds,
  teacherClassScopeId,
} from "../../../../lib/teacher-class-scope";

type Grade = 1 | 2 | 3;

function classParts(value: string): { grade: Grade | null; section: string } {
  const [gradeText, section = ""] = value.split("-");
  const number = Number(gradeText);
  const grade: Grade | null = number === 1 || number === 2 || number === 3 ? number as Grade : null;
  return { grade, section };
}

function parseGrade(value: unknown): Grade | null {
  const number = Number(value || 0);
  return number === 1 || number === 2 || number === 3 ? number as Grade : null;
}

export async function PATCH(request: Request) {
  const session = await requireSession("teacher");
  if (!session?.user) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const user = session.user;
    const body = await request.json();
    const subjectId = String(body?.subjectId || "").split("--")[0].trim();
    const activeGrade = parseGrade(body?.grade);
    const selectedClassIds = normalizeClassIds(body?.selectedClassIds);
    const assignments = normalizeAssignments(user.assignments, user.subjectIds);
    const relevant = assignments.filter(item =>
      item.subjectId === subjectId && (!activeGrade || gradeNumber(item.grade) === activeGrade),
    );

    if (!subjectId || !activeGrade || !relevant.length) {
      return NextResponse.json({ ok: false, message: "المادة أو المرحلة غير مرتبطة بحسابك." }, { status: 400 });
    }

    const database = adminDb();
    const [classSnapshot, studentSnapshot] = await Promise.all([
      database.collection(SCHOOL_CLASSES_COLLECTION).get(),
      database.collection(SCHOOL_STUDENTS_COLLECTION).get(),
    ]);
    const officialClassIds = new Set<string>();
    classSnapshot.docs.forEach(document => {
      const schoolClass = normalizeClassRecord({
        id: document.id,
        ...(document.data() as Record<string, unknown>),
      } as Partial<SchoolClass>);
      if (schoolClass && schoolClass.active !== false && schoolClass.grade === activeGrade) {
        officialClassIds.add(schoolClass.id);
      }
    });
    studentSnapshot.docs.forEach(document => {
      const student = normalizeStudentRecord(document.data() as Record<string, unknown>, document.id);
      if (student && student.active !== false && student.grade === activeGrade) {
        officialClassIds.add(classId(student.grade, student.section));
      }
    });

    const invalid = selectedClassIds.filter(value => {
      const { grade } = classParts(value);
      return grade !== activeGrade || !officialClassIds.has(value);
    });
    if (invalid.length) {
      return NextResponse.json({
        ok: false,
        message: "أحد الفصول لم يعد موجودًا في سجل الإدارة. حدّث القائمة ثم أعد الحفظ.",
        invalidClassIds: invalid,
      }, { status: 400 });
    }

    const now = new Date().toISOString();
    const scopeRef = database.collection(TEACHER_CLASS_SCOPES_COLLECTION)
      .doc(teacherClassScopeId(session.userId, subjectId, activeGrade));
    await scopeRef.set({
      teacherId: session.userId,
      subjectId,
      grade: activeGrade,
      selectedClassIds,
      customized: true,
      assignmentSignature: assignmentScopeSignature(assignments, subjectId, activeGrade),
      officialAdminRoster: true,
      updatedAt: now,
    }, { merge: true });

    // إزالة حجوزات النسخ القديمة لهذا المعلم؛ الاختيار أصبح نطاقًا خاصًا بكل معلم
    // ولا يُسمح له بإخفاء الفصل عن معلم آخر في المرحلة نفسها.
    try {
      const legacyOwners = await database.collection(SUBJECT_CLASS_OWNERS_COLLECTION)
        .where("teacherId", "==", session.userId)
        .get();
      const batch = database.batch();
      let cleanupCount = 0;
      legacyOwners.docs.forEach(document => {
        const data = document.data() as Record<string, unknown>;
        const ownedGrade = classParts(String(data.classId || "")).grade;
        if (String(data.subjectId || "") !== subjectId || ownedGrade !== activeGrade) return;
        batch.delete(database.collection(SUBJECT_CLASS_OWNERS_COLLECTION).doc(document.id));
        cleanupCount += 1;
      });
      if (cleanupCount) await batch.commit();
    } catch (cleanupError) {
      console.warn("legacy class ownership cleanup deferred", cleanupError);
    }

    return NextResponse.json({
      ok: true,
      subjectId,
      activeGrade,
      selectedClassIds,
      selectedCount: selectedClassIds.length,
      preservedOtherGrades: true,
      preservedData: true,
      persistedInDatabase: true,
      manualClassSelection: true,
      officialAdminRoster: true,
    });
  } catch (error) {
    console.error("teacher class scope update failed", error);
    return NextResponse.json({ ok: false, message: "تعذر حفظ الفصول الآن." }, { status: 500 });
  }
}
