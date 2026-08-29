import { NextResponse } from "next/server";
import { adminDb } from "../../../../../lib/server/firebase-admin";
import { hashPassword } from "../../../../../lib/server/password";
import { normalizeUsername, requireSession } from "../../../../../lib/server/portal-auth";
import { normalizeAssignments } from "../../../../../lib/teacher-assignments";
import { SUBJECT_CLASS_OWNERS_COLLECTION, TEACHER_CLASS_SCOPES_COLLECTION } from "../../../../../lib/teacher-class-scope";

const SUBJECT_DATA_COLLECTIONS = [
  "students",
  "classes",
  "grades",
  "research",
  "attendance",
  "alerts",
  "tests",
  "quizzes",
  "assignments",
  "homework",
  "messages",
  "observations",
  "remedialPlans",
  "enrichmentPlans",
  "reports",
];

async function deleteCollectionDocuments(path: string) {
  const database = adminDb();
  const snapshot = await database.collection(path).get();
  let deleted = 0;
  for (let index = 0; index < snapshot.docs.length; index += 300) {
    const batch = database.batch();
    snapshot.docs.slice(index, index + 300).forEach(document => {
      batch.delete(database.collection(path).doc(document.id));
      deleted += 1;
    });
    await batch.commit();
  }
  return deleted;
}

async function deleteTeacherSubjectData(teacherId: string, subjectIds: string[]) {
  const database = adminDb();
  let deletedDocuments = 0;
  for (const subjectId of subjectIds) {
    const subjectRoot = `portalV2Data/${teacherId}/subjects/${subjectId}`;
    for (const collectionName of SUBJECT_DATA_COLLECTIONS) {
      deletedDocuments += await deleteCollectionDocuments(`${subjectRoot}/${collectionName}`);
    }
    await database.collection(`portalV2Data/${teacherId}/subjects`).doc(subjectId).delete();
  }
  await database.collection("portalV2Data").doc(teacherId).delete();
  return deletedDocuments;
}

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

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await requireSession("admin")) return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await context.params;
  const deleteSubjectData = new URL(request.url).searchParams.get("deleteSubjectData") === "1";
  const database = adminDb();
  const teacherSnapshot = await database.collection("portalV2Users").doc(id).get();
  const teacherData = teacherSnapshot.exists ? teacherSnapshot.data() as Record<string, unknown> : {};
  const teacherAssignments = normalizeAssignments(teacherData.assignments, teacherData.subjectIds);
  const subjectIds = [...new Set([
    ...teacherAssignments.map(item => item.subjectId),
    ...(Array.isArray(teacherData.subjectIds) ? teacherData.subjectIds.map(String) : []),
  ].filter(Boolean))];

  const [assignments, classScopes, classOwners] = await Promise.all([
    database.collection("portalV2Assignments").where("teacherId", "==", id).get(),
    database.collection(TEACHER_CLASS_SCOPES_COLLECTION).where("teacherId", "==", id).get(),
    database.collection(SUBJECT_CLASS_OWNERS_COLLECTION).where("teacherId", "==", id).get(),
  ]);

  let deletedSubjectDocuments = 0;
  if (deleteSubjectData) {
    deletedSubjectDocuments = await deleteTeacherSubjectData(id, subjectIds);
  }

  const batch = database.batch();
  batch.delete(database.collection("portalV2Users").doc(id));
  assignments.docs.forEach(item => batch.delete(database.collection("portalV2Assignments").doc(item.id)));
  classScopes.docs.forEach(item => batch.delete(database.collection(TEACHER_CLASS_SCOPES_COLLECTION).doc(item.id)));
  classOwners.docs.forEach(item => batch.delete(database.collection(SUBJECT_CLASS_OWNERS_COLLECTION).doc(item.id)));
  await batch.commit();

  return NextResponse.json({
    ok: true,
    teacherDeleted: true,
    subjectDataDeleted: deleteSubjectData,
    subjectDataPreserved: !deleteSubjectData,
    deletedSubjectDocuments,
    releasedClassReservations: classOwners.docs.length,
  });
}
