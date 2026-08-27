import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { findUserById, requireSession } from "../../../lib/server/portal-auth";
import { getSubjectConfig } from "../../../lib/subject-config";
import { normalizeAssignments } from "../../../lib/teacher-assignments";

const SUBJECT_COOKIE = "lahooni_active_subject";

export async function GET() {
  const session = await requireSession("teacher");
  if (!session) return NextResponse.json({ authenticated: false }, { status: 401 });
  const user = await findUserById(session.userId);
  if (!user || !user.active) return NextResponse.json({ authenticated: false }, { status: 401 });
  const store = await cookies();
  const saved = store.get(SUBJECT_COOKIE)?.value || "";
  const current = user.subjectIds.includes(saved) ? saved : user.subjectIds[0] || null;
  const assignments = normalizeAssignments((user as { assignments?: unknown }).assignments, user.subjectIds);
  const subjects = user.subjectIds.map((subjectId) => {
    const assignment = assignments.find(item => item.subjectId === subjectId);
    return { subjectId, subjectName: assignment?.label || getSubjectConfig(subjectId).label };
  });
  const currentAssignment = assignments.find(item => item.subjectId === current);
  const response = NextResponse.json({
    authenticated: true,
    teacherId: user.id,
    teacherName: user.name,
    subjectKey: current,
    subject: currentAssignment?.label || (current ? getSubjectConfig(current).label : null),
    subjects,
    assignments,
  });
  if (current) response.cookies.set(SUBJECT_COOKIE, current, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 8 });
  return response;
}

export async function POST(request: Request) {
  const session = await requireSession("teacher");
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  const user = await findUserById(session.userId);
  const body = await request.json().catch(() => ({}));
  const subjectId = String(body?.subjectId || "");
  if (!user?.active || !user.subjectIds.includes(subjectId)) return NextResponse.json({ ok: false, error: "subject_not_assigned" }, { status: 403 });
  const response = NextResponse.json({ ok: true, subjectId });
  response.cookies.set(SUBJECT_COOKIE, subjectId, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 8 });
  return response;
}
