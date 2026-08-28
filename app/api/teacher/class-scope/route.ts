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

function classParts(classId: string): { grade: Grade | null; section: string } {
  const [gradeText, section = ""] = classId.split("-");
  const value = Number(gradeText);
  const grade: Grade | null = value === 1 || value === 2 || value === 3 ? value : null;
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
    const ownerSnapshots = await Promise.all(
      selectedClassIds.map(classIdValue => ownerCollection.doc(subjectClassOwnerId(subjectId, classIdValue)).get()),
    );

    const transferredFrom = new Map<string, Set<string>>();
    ownerSnapshots.forEach((snapshot, index) => {
      if (!snapshot.exists) return;
      const data = snapshot.data() as Record<string, unknown>;
      const previousTeacherId = String(data.teacherId || "");
      const classIdValue = selectedClassIds[index];
      if (!classIdValue || !previousTeacherId || previousTeacherId === session.userId) return;
      const classes = transferredFrom.get(previousTeacherId) || new Set<string>();
      classes.add(classIdValue);
      transferredFrom.set(previousTeacherId, classes);
    });

    const transferredScopeSnapshots = await Promise.all(
      [...transferredFrom.entries()].map(async ([teacherId, classIds]) => {
        const grades = [...new Set([...classIds].map(item => classParts(item).grade).filter((item): item is Grade => !!item))];
        const scopes = await Promise.all(grades.map(async grade => {
          const reference = database.collection(TEACHER_CLASS_SCOPES_COLLECTION)
            .doc(teacherClassScopeId(teacherId, subjectId, grade));
          return { grade, reference, snapshot: await reference.get() };
        }));
        return { teacherId, scopes };
      }),
    );

    const previousOwners = await ownerCollection.where("teacherId", "==", session.userId).get();
    const batch = database.batch();
    const now = new Date().toISOString();
    const selected = new Set(selectedClassIds);

    previousOwners.docs.forEach(document => {
      const data = document.data() as Record<string, unknown>;
      if (String(data.subjectId || "") !== subjectId) return;
      const ownedClassId = String(data.classId || "");
      const ownedGrade = classParts(ownedClassId).grade;
      if (activeGrade && ownedGrade !== activeGrade) return;
      if (!selected.has(ownedClassId)) batch.delete(ownerCollection.doc(document.id));
    });

    transferredScopeSnapshots.forEach(({ teacherId, scopes }) => {
      const removed = transferredFrom.get(teacherId) || new Set<string>();
      scopes.forEach(({ grade, reference, snapshot }) => {
        if (!snapshot.exists) return;
        const data = snapshot.data() as Record<string, unknown>;
        const remaining = normalizeClassIds(data.selectedClassIds)
          .filter(classIdValue => classParts(classIdValue).grade === grade && !removed.has(classIdValue));
        batch.set(reference, {
          teacherId,
          subjectId,
          grade,
          selectedClassIds: remaining,
          customized: true,
          updatedAt: now,
        }, { merge: true });
      });
    });

    selectedClassIds.forEach(classIdValue => {
      batch.set(ownerCollection.doc(subjectClassOwnerId(subjectId, classIdValue)), {
        teacherId: session.userId,
        subjectId,
        classId: classIdValue,
        grade: classParts(classIdValue).grade,
        active: true,
        updatedAt: now,
      }, { merge: true });
    });

    const scopeRef = database.collection(TEACHER_CLASS_SCOPES_COLLECTION)
      .doc(teacherClassScopeId(session.userId, subjectId, activeGrade));
    batch.set(scopeRef, {
      teacherId: session.userId,
      subjectId,
      grade: activeGrade,
      selectedClassIds,
      customized: true,
      assignmentSignature: assignmentScopeSignature(assignments, subjectId, activeGrade),
      updatedAt: now,
    }, { merge: true });

    await batch.commit();
    const transferredClassIds = [...new Set([...transferredFrom.values()].flatMap(items => [...items]))];
    return NextResponse.json({
      ok: true,
      subjectId,
      activeGrade,
      selectedClassIds,
      transferredClassIds,
      transferredCount: transferredClassIds.length,
      preservedOtherGrades: true,
      preservedData: true,
    });
  } catch (error) {
    console.error("teacher class scope update failed", error);
    return NextResponse.json({ ok: false, message: "تعذر حفظ الفصول الآن." }, { status: 500 });
  }
}
