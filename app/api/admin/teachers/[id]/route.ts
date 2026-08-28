import { NextResponse } from "next/server";
import { adminDb } from "../../../../../lib/server/firebase-admin";
import { hashPassword } from "../../../../../lib/server/password";
import { normalizeUsername, requireSession } from "../../../../../lib/server/portal-auth";
import { normalizeAssignments } from "../../../../../lib/teacher-assignments";
import { SUBJECT_CLASS_OWNERS_COLLECTION, TEACHER_CLASS_SCOPES_COLLECTION } from "../../../../../lib/teacher-class-scope";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await requireSession("admin")) return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await context.params;
  const body = await request.json();
  const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (typeof body.active === "boolean") update.active = body.active;
  if (typeof body.password === "string" && body.password.length >= 8) update.passwordHash = hashPassword(body.password);
  if (typeof body.name === "string" && body.name.trim().length >= 3) {
    update.name = body.name.trim();
    update.username = body.name.trim();
    update.normalizedUsername = normalizeUsername(body.name);
  }
  let normalizedAssignments: ReturnType<typeof normalizeAssignments> | null = null;
  if (Array.isArray(body.assignments) && body.assignments.length) {
    normalizedAssignments = normalizeAssignments(body.assignments);
    update.assignments = normalizedAssignments;
    update.subjectIds = [...new Set(normalizedAssignments.map(item => item.subjectId))];
  }
  const database = adminDb();
  const userRef = database.collection("portalV2Users").doc(id);
  await userRef.update(update);
  if (normalizedAssignments) {
    const assignmentCollection = database.collection("portalV2Assignments");
    const previousAssignments = await assignmentCollection.where("teacherId", "==", id).get();
    const previousById = new Map(previousAssignments.docs.map(item => [item.id, item]));
    const activeDocumentIds = new Set(normalizedAssignments.map(assignment => `${id}__${assignment.id}`));
    const batch = database.batch();
    const now = new Date().toISOString();

    previousAssignments.docs.forEach(item => {
      if (activeDocumentIds.has(item.id)) return;
      batch.set(assignmentCollection.doc(item.id), {
        active: false,
        archivedAt: now,
        updatedAt: now,
      }, { merge: true });
    });

    normalizedAssignments.forEach(assignment => {
      const documentId = `${id}__${assignment.id}`;
      const existed = previousById.has(documentId);
      batch.set(assignmentCollection.doc(documentId), {
        teacherId: id,
        subjectId: assignment.subjectId,
        assignmentId: assignment.id,
        grade: assignment.grade,
        section: assignment.section,
        active: true,
        archivedAt: null,
        updatedAt: now,
        ...(existed ? {} : { createdAt: now }),
      }, { merge: true });
    });
    await batch.commit();

    const [classScopes, classOwners] = await Promise.all([
      database.collection(TEACHER_CLASS_SCOPES_COLLECTION).where("teacherId", "==", id).get(),
      database.collection(SUBJECT_CLASS_OWNERS_COLLECTION).where("teacherId", "==", id).get(),
    ]);
    const resetBatch = database.batch();
    classScopes.docs.forEach(item => resetBatch.delete(database.collection(TEACHER_CLASS_SCOPES_COLLECTION).doc(item.id)));
    classOwners.docs.forEach(item => resetBatch.delete(database.collection(SUBJECT_CLASS_OWNERS_COLLECTION).doc(item.id)));
    await resetBatch.commit();
  }
  return NextResponse.json({ ok: true, preservedTeacherData: true, classScopeReset: !!normalizedAssignments });
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  if (!await requireSession("admin")) return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await context.params;
  const database = adminDb();
  await database.collection("portalV2Users").doc(id).delete();
  const [assignments, classScopes, classOwners] = await Promise.all([
    database.collection("portalV2Assignments").where("teacherId", "==", id).get(),
    database.collection(TEACHER_CLASS_SCOPES_COLLECTION).where("teacherId", "==", id).get(),
    database.collection(SUBJECT_CLASS_OWNERS_COLLECTION).where("teacherId", "==", id).get(),
  ]);
  const batch = database.batch();
  assignments.docs.forEach(item => batch.delete(database.collection("portalV2Assignments").doc(item.id)));
  classScopes.docs.forEach(item => batch.delete(database.collection(TEACHER_CLASS_SCOPES_COLLECTION).doc(item.id)));
  classOwners.docs.forEach(item => batch.delete(database.collection(SUBJECT_CLASS_OWNERS_COLLECTION).doc(item.id)));
  await batch.commit();
  return NextResponse.json({ ok: true });
}
