import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { findUserById, requireSession } from "../../../../lib/server/portal-auth";
import { normalizeAssignments } from "../../../../lib/teacher-assignments";

export async function GET() {
  const session = await requireSession("supervisor");
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  const supervisor = await findUserById(session.userId);
  if (!supervisor) return NextResponse.json({ ok: false }, { status: 404 });
  const allowedTeacherIds = new Set(supervisor.teacherIds || []);
  const allowedSubjectIds = new Set(supervisor.subjectIds || []);
  const snapshot = await adminDb().collection("portalV2Users").where("role", "==", "teacher").get();
  const teachers = snapshot.docs.flatMap(document => {
    if (allowedTeacherIds.size && !allowedTeacherIds.has(document.id)) return [];
    const data = document.data();
    const assignments = normalizeAssignments(data.assignments, data.subjectIds).filter(item => allowedSubjectIds.has(item.id));
    if (!assignments.length) return [];
    return [{ id: document.id, name: data.name, active: data.active === true, assignments }];
  }).sort((a, b) => a.name.localeCompare(b.name, "ar"));
  return NextResponse.json({ ok: true, supervisor: { name: supervisor.name, subjectIds: supervisor.subjectIds || [], permissionLevel: supervisor.permissionLevel || "view" }, teachers });
}
