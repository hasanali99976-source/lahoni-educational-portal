import { NextResponse } from "next/server";
import { adminDb } from "../../../../../lib/server/firebase-admin";
import { hashPassword } from "../../../../../lib/server/password";
import { normalizeUsername, requireSession } from "../../../../../lib/server/portal-auth";
import { canonicalSubjectIds, synchronizeSchoolRosters } from "../../../../../lib/server/school-roster";
import { normalizeAssignments, type TeacherAssignment } from "../../../../../lib/teacher-assignments";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await requireSession("admin")) return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await context.params;
  const body = await request.json();
  const now = new Date().toISOString();
  const update: Record<string, unknown> = { updatedAt: now };
  let nextAssignments: TeacherAssignment[] | null = null;

  if (typeof body.active === "boolean") update.active = body.active;
  if (typeof body.password === "string" && body.password.length >= 8) update.passwordHash = hashPassword(body.password);
  if (typeof body.name === "string" && body.name.trim().length >= 3) {
    update.name = body.name.trim();
    update.username = body.name.trim();
    update.normalizedUsername = normalizeUsername(body.name);
  }
  if (Array.isArray(body.assignments) && body.assignments.length) {
    nextAssignments = normalizeAssignments(body.assignments);
    update.assignments = nextAssignments;
    update.subjectIds = canonicalSubjectIds(nextAssignments);
  }

  const userRef = adminDb().collection("portalV2Users").doc(id);
  await userRef.update(update);

  if (nextAssignments) {
    const oldAssignments = await adminDb().collection("portalV2Assignments").where("teacherId", "==", id).get();
    const batch = adminDb().batch();
    oldAssignments.docs.forEach(item => batch.set(adminDb().collection("portalV2Assignments").doc(item.id), { active: false, updatedAt: now }, { merge: true }));
    nextAssignments.forEach(assignment => batch.set(adminDb().collection("portalV2Assignments").doc(`${id}__${assignment.id}`), {
      teacherId: id,
      assignmentId: assignment.id,
      subjectId: assignment.subjectId,
      grade: assignment.grade,
      section: assignment.section,
      active: true,
      updatedAt: now,
    }, { merge: true }));
    await batch.commit();
  }

  try {
    await synchronizeSchoolRosters(true);
  } catch (error) {
    console.error("school roster sync after teacher update failed", error);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  if (!await requireSession("admin")) return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await context.params;
  await adminDb().collection("portalV2Users").doc(id).delete();
  const assignments = await adminDb().collection("portalV2Assignments").where("teacherId", "==", id).get();
  const batch = adminDb().batch();
  assignments.docs.forEach(item => batch.delete(adminDb().collection("portalV2Assignments").doc(item.id)));
  await batch.commit();
  try {
    await synchronizeSchoolRosters(true);
  } catch (error) {
    console.error("school roster sync after teacher deletion failed", error);
  }
  return NextResponse.json({ ok: true });
}
