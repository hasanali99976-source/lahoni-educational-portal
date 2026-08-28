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

export async function PATCH(request: Request) {
  const session = await requireSession("teacher");
  if (!session?.user) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const user = session.user;
    const body = await request.json();
    const subjectId = String(body?.subjectId || "").split("--")[0].trim();
    const selectedClassIds = normalizeClassIds(body?.selectedClassIds);
    const assignments = normalizeAssignments(user.assignments, user.subjectIds);
    const relevant = assignments.filter(item => item.subjectId === subjectId);
    if (!subjectId || !relevant.length) {
      return NextResponse.json({ ok: false, message: "المادة غير مرتبطة بحسابك." }, { status: 400 });
    }

    const currentAssignmentSignature = assignmentScopeSignature(assignments, subjectId);
    const allowedGrades = new Set<Grade>(
      relevant.map(item => gradeNumber(item.grade)).filter((item): item is Grade => !!item),
    );
    const invalid = selectedClassIds.filter(item => {
      const { grade } = classParts(item);
      return !grade || !allowedGrades.has(grade);
    });
    if (invalid.length) {
      return NextResponse.json({ ok: false, message: "لا يمكن إضافة فصل خارج الصفوف المسندة لك." }, { status: 400 });
    }

    const database = adminDb();
    const ownerCollection = database.collection(SUBJECT_CLASS_OWNERS_COLLECTION);
    const ownerSnapshots = await Promise.all(
      selectedClassIds.map(classId => ownerCollection.doc(subjectClassOwnerId(subjectId, classId)).get()),
    );

    const transferredFrom = new Map<string, Set<string>>();
    ownerSnapshots.forEach((snapshot, index) => {
      if (!snapshot.exists) return;
      const data = snapshot.data() as Record<string, unknown>;
      const previousTeacherId = String(data.teacherId || "");
      const classId = selectedClassIds[index];
      if (!classId || !previousTeacherId || previousTeacherId === session.userId) return;
      const classes = transferredFrom.get(previousTeacherId) || new Set<string>();
      classes.add(classId);
      transferredFrom.set(previousTeacherId, classes);
    });

    const transferredScopeSnapshots = await Promise.all(
      [...transferredFrom.keys()].map(async teacherId => {
        const reference = database.collection(TEACHER_CLASS_SCOPES_COLLECTION)
          .doc(teacherClassScopeId(teacherId, subjectId));
        return { teacherId, reference, snapshot: await reference.get() };
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
      if (!selected.has(ownedClassId)) batch.delete(ownerCollection.doc(document.id));
    });

    transferredScopeSnapshots.forEach(({ teacherId, reference, snapshot }) => {
      if (!snapshot.exists) return;
      const data = snapshot.data() as Record<string, unknown>;
      const removed = transferredFrom.get(teacherId) || new Set<string>();
      const remaining = normalizeClassIds(data.selectedClassIds).filter(classId => !removed.has(classId));
      batch.set(reference, {
        teacherId,
        subjectId,
        selectedClassIds: remaining,
        customized: true,
        updatedAt: now,
      }, { merge: true });
    });

    selectedClassIds.forEach(classId => {
      batch.set(ownerCollection.doc(subjectClassOwnerId(subjectId, classId)), {
        teacherId: session.userId,
        subjectId,
        classId,
        active: true,
        updatedAt: now,
      }, { merge: true });
    });

    const scopeRef = database.collection(TEACHER_CLASS_SCOPES_COLLECTION)
      .doc(teacherClassScopeId(session.userId, subjectId));
    batch.set(scopeRef, {
      teacherId: session.userId,
      subjectId,
      selectedClassIds,
      customized: true,
      assignmentSignature: currentAssignmentSignature,
      updatedAt: now,
    }, { merge: true });

    await batch.commit();
    const transferredClassIds = [...new Set([...transferredFrom.values()].flatMap(items => [...items]))];
    return NextResponse.json({
      ok: true,
      selectedClassIds,
      transferredClassIds,
      transferredCount: transferredClassIds.length,
      preservedData: true,
    });
  } catch (error) {
    console.error("teacher class scope update failed", error);
    return NextResponse.json({ ok: false, message: "تعذر حفظ الفصول الآن." }, { status: 500 });
  }
}
