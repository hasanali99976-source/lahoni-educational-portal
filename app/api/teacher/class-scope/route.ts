import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { findUserById, requireSession } from "../../../../lib/server/portal-auth";
import { normalizeAssignments } from "../../../../lib/teacher-assignments";
import { gradeNumber, normalizeArabic } from "../../../../lib/school-roster";
import {
  SUBJECT_CLASS_OWNERS_COLLECTION,
  TEACHER_CLASS_SCOPES_COLLECTION,
  assignmentAllowsClassExact,
  normalizeClassIds,
  subjectClassOwnerId,
  teacherClassScopeId,
} from "../../../../lib/teacher-class-scope";

function classParts(classId: string) {
  const [gradeText, section = ""] = classId.split("-");
  const grade = Number(gradeText);
  return { grade: grade === 1 || grade === 2 || grade === 3 ? grade : null, section };
}

function allSections(value: unknown) {
  const normalized = normalizeArabic(value);
  return !normalized || normalized === "الكل" || normalized === "كل" || normalized === "جميع الفصول";
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
      const { grade } = classParts(item);
      return !grade || !allowedGrades.has(grade);
    });
    if (invalid.length) {
      return NextResponse.json({ ok: false, message: "لا يمكن إضافة فصل خارج الصفوف المسندة لك." }, { status: 400 });
    }

    const ownerCollection = adminDb().collection(SUBJECT_CLASS_OWNERS_COLLECTION);
    const ownerSnapshots = await Promise.all(selectedClassIds.map(item => ownerCollection.doc(subjectClassOwnerId(subjectId, item)).get()));
    const ownerConflicts = ownerSnapshots.flatMap(snapshot => {
      if (!snapshot.exists) return [];
      const data = snapshot.data() as Record<string, unknown>;
      const ownerTeacherId = String(data.teacherId || "");
      return ownerTeacherId && ownerTeacherId !== session.userId ? [String(data.className || data.classId || snapshot.id)] : [];
    });

    const teachersSnapshot = await adminDb().collection("portalV2Users").where("role", "==", "teacher").get();
    const assignmentConflicts = new Set<string>();
    teachersSnapshot.docs.forEach(document => {
      if (document.id === session.userId) return;
      const data = document.data() as Record<string, unknown>;
      if (data.active !== true) return;
      const otherAssignments = normalizeAssignments(data.assignments, data.subjectIds).filter(item => item.subjectId === subjectId);
      selectedClassIds.forEach(selectedClassId => {
        const { grade, section } = classParts(selectedClassId);
        if (!grade || !section) return;
        const explicitlyAssigned = otherAssignments.some(assignment =>
          !allSections(assignment.section) && assignmentAllowsClassExact(assignment, grade, section),
        );
        if (explicitlyAssigned) assignmentConflicts.add(selectedClassId);
      });
    });

    const conflicts = [...new Set([...ownerConflicts, ...assignmentConflicts])];
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
