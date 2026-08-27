import { NextResponse } from "next/server";
import { adminDb } from "../../../../../lib/server/firebase-admin";
import { hashPassword } from "../../../../../lib/server/password";
import { normalizeUsername, requireSession } from "../../../../../lib/server/portal-auth";
import { normalizeAssignments } from "../../../../../lib/teacher-assignments";

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
  const userRef = adminDb().collection("portalV2Users").doc(id);
  await userRef.update(update);
  if (normalizedAssignments) {
    const previousAssignments = await adminDb().collection("portalV2Assignments").where("teacherId", "==", id).get();
    const batch = adminDb().batch();
    previousAssignments.docs.forEach(item => batch.delete(adminDb().collection("portalV2Assignments").doc(item.id)));
    const now = new Date().toISOString();
    normalizedAssignments.forEach(assignment => batch.set(adminDb().collection("portalV2Assignments").doc(`${id}__${assignment.id}`), {
      teacherId: id,
      subjectId: assignment.subjectId,
      assignmentId: assignment.id,
      grade: assignment.grade,
      section: assignment.section,
      active: true,
      updatedAt: now,
      createdAt: now,
    }, { merge: true }));
    await batch.commit();
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
  return NextResponse.json({ ok: true });
}
