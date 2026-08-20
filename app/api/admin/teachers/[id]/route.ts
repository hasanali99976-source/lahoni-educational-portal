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
  if (Array.isArray(body.assignments) && body.assignments.length) {
    const assignments = normalizeAssignments(body.assignments);
    update.assignments = assignments;
    update.subjectIds = assignments.map(item => item.id);
  }
  const userRef = adminDb().collection("portalV2Users").doc(id);
  const previous = await userRef.get();
  await userRef.update(update);
  if (Array.isArray(update.subjectIds)) {
    const oldIds = Array.isArray(previous.data()?.subjectIds) ? previous.data()!.subjectIds : [];
    const batch = adminDb().batch();
    for (const subjectId of oldIds) if (!(update.subjectIds as string[]).includes(subjectId)) batch.set(adminDb().collection("portalV2Assignments").doc(`${id}__${subjectId}`), { active: false, updatedAt: new Date().toISOString() }, { merge: true });
    for (const subjectId of update.subjectIds as string[]) batch.set(adminDb().collection("portalV2Assignments").doc(`${id}__${subjectId}`), { teacherId: id, subjectId, active: true, updatedAt: new Date().toISOString() }, { merge: true });
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
