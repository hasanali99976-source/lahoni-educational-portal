import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { findUserById, requireSession } from "../../../lib/server/portal-auth";
import { canonicalSubjectIds, synchronizeSchoolRosters } from "../../../lib/server/school-roster";
import { getSubjectConfig } from "../../../lib/subject-config";
import { normalizeAssignments } from "../../../lib/teacher-assignments";

const SUBJECT_COOKIE = "lahooni_active_subject";

function gradeMatchToken(value: string) {
  const normalized = value.replace(/[إأآ]/g, "ا");
  if (normalized.includes("اول")) return "اول";
  if (normalized.includes("ثاني")) return "ثاني";
  if (normalized.includes("ثالث")) return "ثالث";
  return value;
}

export async function GET() {
  const session = await requireSession("teacher");
  if (!session) return NextResponse.json({ authenticated: false }, { status: 401 });
  const user = await findUserById(session.userId);
  if (!user || !user.active) return NextResponse.json({ authenticated: false }, { status: 401 });

  try {
    await synchronizeSchoolRosters();
  } catch (error) {
    console.error("school roster sync during teacher session failed", error);
  }

  const assignments = normalizeAssignments((user as { assignments?: unknown }).assignments, user.subjectIds);
  const subjectIds = canonicalSubjectIds(assignments);
  const store = await cookies();
  const saved = store.get(SUBJECT_COOKIE)?.value || "";
  const current = subjectIds.includes(saved) ? saved : subjectIds[0] || null;
  const subjects = subjectIds.map(subjectId => ({ subjectId, subjectName: getSubjectConfig(subjectId).label }));
  const currentAssignments = assignments.filter(item => item.subjectId === current);
  const assignmentDetails = currentAssignments.map(item => [item.grade, item.section === "الكل" ? "جميع الفصول" : `فصل ${item.section}`].filter(Boolean).join(" — "));
  const subjectName = current ? getSubjectConfig(current).label : null;
  const response = NextResponse.json({
    authenticated: true,
    teacherId: user.id,
    teacherName: user.name,
    subjectKey: current,
    subject: subjectName,
    assignmentLabel: assignmentDetails.join(" • "),
    subjects,
    assignments: assignments.map(item => ({ ...item, grade: gradeMatchToken(item.grade) })),
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
  const assignments = normalizeAssignments((user as { assignments?: unknown })?.assignments, user?.subjectIds);
  const subjectIds = canonicalSubjectIds(assignments);
  if (!user?.active || !subjectIds.includes(subjectId)) return NextResponse.json({ ok: false, error: "subject_not_assigned" }, { status: 403 });
  try {
    await synchronizeSchoolRosters();
  } catch (error) {
    console.error("school roster sync during subject switch failed", error);
  }
  const response = NextResponse.json({ ok: true, subjectId });
  response.cookies.set(SUBJECT_COOKIE, subjectId, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 8 });
  return response;
}
