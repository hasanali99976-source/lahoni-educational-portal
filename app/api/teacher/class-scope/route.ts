import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { findUserById, requireSession } from "../../../../lib/server/portal-auth";
import { normalizeAssignments } from "../../../../lib/teacher-assignments";
import { gradeNumber } from "../../../../lib/school-roster";
import {
  SUBJECT_CLASS_OWNERS_COLLECTION,
  TEACHER_CLASS_SCOPES_COLLECTION,
  normalizeClassIds,
  subjectClassOwnerId,
  teacherClassScopeId,
} from "../../../../lib/teacher-class-scope";

function classGrade(classId: string) {
  const value = Number(classId.split("-")[0]);
  return value === 1 || value === 2 || value === 3 ? value : null;
}

export async function PATCH(request: Request) {
  const session = await requireSession("teacher");
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const user = await findUserById(session.userId);
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });

    const body = await request.json();
    const subjectId = String(body?.subjectId || "").split("--")[0].trim();
    const selectedClassIds = normalizeClassIds(body?.selectedClassIds);
    const assignments = normalizeAssignments(user.assignments, user.subjectIds);
    const relevant = assignments.filter(item => item.subjectId === subjectId);
    if (!subjectId || !relevant.length) {
      return NextResponse.json({ ok: false, message: "المادة غير مرتبطة بحسابك." }, { status: 400 });
    }

    const allowedGrades = new Set(relevant.map(item => gradeNumber(item.grade)).filter(Boolean));
    const invalid = selectedClassIds.filter(item => {
      const grade = classGrade(item);
      return !grade || !allowedGrades.has(grade);
    });
    if (invalid.length) {
      return NextResponse.json({ ok: false, message: "لا يمكن إضافة فصل خارج الصفوف المسندة لك." }, { status: 400 });
    }

    const ownerCollection = adminDb().collection(SUBJECT_CLASS_OWNERS_COLLECTION);
    const ownerSnapshots = await Promise.all(selectedClassIds.map(item => ownerCollection.doc(subjectClassOwnerId(subjectId, item)).get()));
    const conflicts = ownerSnapshots.flatMap(snapshot => {
      if (!snapshot.exists) return [];
      const data = snapshot.data() as Record<string, unknown>;
      const ownerTeacherId = String(data.teacherId || "");
      return ownerTeacherId && ownerTeacherId !== session.userId ? [String(data.className || data.classId || snapshot.id)] : [];
    });
    if (conflicts.length) {
      return NextResponse.json({
        ok: false,
        message: `الفصول التالية مرتبطة بمعلم آخر: ${conflicts.join("، ")}`,
        conflicts,
      }, { status: 409 });
    }

    const previousOwners = await ownerCollection.where("teacherId", "==", session.userId).get();
    const batch = adminDb().batch();
    const now = new Date().toISOString();
    const selected = new Set(selectedClassIds);

    previousOwners.docs.forEach(document => {
      const data = document.data() as Record<string, unknown>;
      if (String(data.subjectId || "") !== subjectId) return;
      const ownedClassId = String(data.classId || "");
      if (!selected.has(ownedClassId)) batch.delete(ownerCollection.doc(document.id));
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

    const scopeRef = adminDb().collection(TEACHER_CLASS_SCOPES_COLLECTION).doc(teacherClassScopeId(session.userId, subjectId));
    batch.set(scopeRef, {
      teacherId: session.userId,
      subjectId,
      selectedClassIds,
      customized: true,
      updatedAt: now,
    }, { merge: true });

    await batch.commit();
    return NextResponse.json({ ok: true, selectedClassIds, preservedData: true });
  } catch (error) {
    console.error("teacher class scope update failed", error);
    return NextResponse.json({ ok: false, message: "تعذر حفظ الفصول الآن." }, { status: 500 });
  }
}
