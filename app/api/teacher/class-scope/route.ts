import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { requireSession } from "../../../../lib/server/portal-auth";
import { normalizeAssignments } from "../../../../lib/teacher-assignments";
import { gradeNumber } from "../../../../lib/school-roster";
import {
  SUBJECT_CLASS_OWNERS_COLLECTION,
  TEACHER_CLASS_SCOPES_COLLECTION,
  assignmentScopeSignature,
  normalizeClassIds,
  subjectClassOwnerId,
  teacherClassScopeId,
} from "../../../../lib/teacher-class-scope";

type Grade = 1 | 2 | 3;

class ClassScopeConflict extends Error {
  classIds: string[];

  constructor(classIds: string[]) {
    super("class_scope_conflict");
    this.classIds = classIds;
  }
}

function classParts(classId: string): { grade: Grade | null; section: string } {
  const [gradeText, section = ""] = classId.split("-");
  const value = Number(gradeText);
  const grade: Grade | null = value === 1 || value === 2 || value === 3 ? value as Grade : null;
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
    const subjectAssignments = assignments.filter(item => item.subjectId === subjectId);
    const relevant = activeGrade
      ? subjectAssignments.filter(item => gradeNumber(item.grade) === activeGrade)
      : subjectAssignments;

    if (!subjectId || !relevant.length) {
      return NextResponse.json({ ok: false, message: "المادة أو المرحلة غير مرتبطة بحسابك." }, { status: 400 });
    }

    const allowedGrades = new Set<Grade>(
      relevant.map(item => gradeNumber(item.grade)).filter((item): item is Grade => !!item),
    );
    const invalid = selectedClassIds.filter(item => {
      const { grade } = classParts(item);
      return !grade || !allowedGrades.has(grade) || (activeGrade !== null && grade !== activeGrade);
    });
    if (invalid.length) {
      return NextResponse.json({ ok: false, message: "لا يمكن إضافة فصل خارج المرحلة المسندة لك." }, { status: 400 });
    }

    const database = adminDb();
    const ownerCollection = database.collection(SUBJECT_CLASS_OWNERS_COLLECTION);
    const ownerReferences = selectedClassIds.map(classIdValue =>
      ownerCollection.doc(subjectClassOwnerId(subjectId, classIdValue)),
    );
    const scopeRef = database.collection(TEACHER_CLASS_SCOPES_COLLECTION)
      .doc(teacherClassScopeId(session.userId, subjectId, activeGrade));
    const selected = new Set(selectedClassIds);
    const now = new Date().toISOString();

    await database.runTransaction(async transaction => {
      const selectedSnapshots = ownerReferences.length
        ? await transaction.getAll(...ownerReferences)
        : [];
      const previousOwners = await transaction.get(
        ownerCollection.where("teacherId", "==", session.userId),
      );

      const unavailableClassIds: string[] = [];
      selectedSnapshots.forEach((snapshot, index) => {
        if (!snapshot.exists) return;
        const data = snapshot.data() as Record<string, unknown>;
        const previousTeacherId = String(data.teacherId || "");
        if (previousTeacherId && previousTeacherId !== session.userId) {
          unavailableClassIds.push(selectedClassIds[index]);
        }
      });
      if (unavailableClassIds.length) throw new ClassScopeConflict(unavailableClassIds);

      previousOwners.docs.forEach(document => {
        const data = document.data() as Record<string, unknown>;
        if (String(data.subjectId || "") !== subjectId) return;
        const ownedClassId = String(data.classId || "");
        const ownedGrade = classParts(ownedClassId).grade;
        if (activeGrade && ownedGrade !== activeGrade) return;
        if (!selected.has(ownedClassId)) transaction.delete(document.ref);
      });

      selectedClassIds.forEach((classIdValue, index) => {
        transaction.set(ownerReferences[index], {
          teacherId: session.userId,
          subjectId,
          classId: classIdValue,
          grade: classParts(classIdValue).grade,
          active: true,
          updatedAt: now,
        }, { merge: true });
      });

      transaction.set(scopeRef, {
        teacherId: session.userId,
        subjectId,
        grade: activeGrade,
        selectedClassIds,
        customized: true,
        assignmentSignature: assignmentScopeSignature(assignments, subjectId, activeGrade),
        updatedAt: now,
      }, { merge: true });
    });

    return NextResponse.json({
      ok: true,
      subjectId,
      activeGrade,
      selectedClassIds,
      reservedCount: selectedClassIds.length,
      preservedOtherGrades: true,
      preservedData: true,
      persistedInDatabase: true,
    });
  } catch (error) {
    if (error instanceof ClassScopeConflict) {
      return NextResponse.json({
        ok: false,
        message: "أحد الفصول اختاره معلم آخر بالفعل. حدّث القائمة وستظهر لك الفصول المتبقية فقط.",
        unavailableClassIds: error.classIds,
      }, { status: 409 });
    }
    console.error("teacher class scope update failed", error);
    return NextResponse.json({ ok: false, message: "تعذر حفظ الفصول الآن." }, { status: 500 });
  }
}
