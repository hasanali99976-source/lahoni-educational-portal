import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { findUserById, requireSession } from "../../../lib/server/portal-auth";
import { getSubjectConfig } from "../../../lib/subject-config";
import { normalizeAssignments } from "../../../lib/teacher-assignments";
import { gradeLabel, gradeNumber } from "../../../lib/school-roster";

const SUBJECT_COOKIE = "lahooni_active_subject";

type Workspace = {
  workspaceKey: string;
  subjectId: string;
  subjectName: string;
  grade: number | null;
  grades: string[];
  gradeLabel: string;
};

function databaseUnavailable() {
  return NextResponse.json({
    authenticated: false,
    databaseUnavailable: true,
    message: "قاعدة البيانات مشغولة الآن. أعد المحاولة بعد قليل.",
  }, { status: 503, headers: { "Cache-Control": "no-store" } });
}

function buildWorkspaces(subjectIds: string[], assignments: ReturnType<typeof normalizeAssignments>) {
  const workspaces: Workspace[] = [];
  subjectIds.forEach(subjectId => {
    const subjectAssignments = assignments.filter(item => item.subjectId === subjectId);
    const grades = [...new Set(subjectAssignments.map(item => gradeNumber(item.grade)).filter((item): item is 1 | 2 | 3 => !!item))]
      .sort((a, b) => a - b);
    if (!grades.length) {
      workspaces.push({
        workspaceKey: subjectId,
        subjectId,
        subjectName: getSubjectConfig(subjectId).label,
        grade: null,
        grades: [],
        gradeLabel: "جميع الصفوف المسندة",
      });
      return;
    }
    grades.forEach(grade => {
      const label = gradeLabel(grade);
      workspaces.push({
        workspaceKey: `${subjectId}--${grade}`,
        subjectId,
        subjectName: getSubjectConfig(subjectId).label,
        grade,
        grades: [label],
        gradeLabel: label,
      });
    });
  });
  return workspaces;
}

export async function GET() {
  try {
    const session = await requireSession("teacher");
    if (!session?.user?.active) return NextResponse.json({ authenticated: false }, { status: 401 });
    const user = await findUserById(session.userId) || session.user;
    const assignments = normalizeAssignments(user.assignments, user.subjectIds);
    const subjects = buildWorkspaces(user.subjectIds, assignments);
    const store = await cookies();
    const savedWorkspace = store.get(SUBJECT_COOKIE)?.value || "";
    const currentWorkspace = subjects.find(item => item.workspaceKey === savedWorkspace)
      || subjects.find(item => item.subjectId === savedWorkspace)
      || subjects[0]
      || null;

    const response = NextResponse.json({
      authenticated: true,
      teacherId: user.id,
      teacherName: user.name,
      subjectKey: currentWorkspace?.subjectId || null,
      workspaceKey: currentWorkspace?.workspaceKey || null,
      activeGrade: currentWorkspace?.grade || null,
      activeGradeLabel: currentWorkspace?.gradeLabel || "",
      subject: currentWorkspace?.subjectName || null,
      subjects,
      assignments,
      resetClassScopes: [],
      legacyRestore: { restored: 0, alreadyChecked: true, skipped: "session_read_safety" },
    }, { headers: { "Cache-Control": "no-store" } });
    if (currentWorkspace) response.cookies.set(SUBJECT_COOKIE, currentWorkspace.workspaceKey, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 8 });
    return response;
  } catch (error) {
    console.warn("teacher session temporarily unavailable", error);
    return databaseUnavailable();
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession("teacher");
    if (!session?.user?.active) return NextResponse.json({ ok: false }, { status: 401 });
    const user = session.user;
    const body = await request.json().catch(() => ({}));
    const assignments = normalizeAssignments(user.assignments, user.subjectIds);
    const workspaces = buildWorkspaces(user.subjectIds, assignments);
    const requested = String(body?.workspaceKey || body?.subjectId || "").trim();
    const workspace = workspaces.find(item => item.workspaceKey === requested)
      || workspaces.find(item => item.subjectId === requested);
    if (!workspace) return NextResponse.json({ ok: false, error: "subject_not_assigned" }, { status: 403 });
    const response = NextResponse.json({
      ok: true,
      subjectId: workspace.subjectId,
      workspaceKey: workspace.workspaceKey,
      activeGrade: workspace.grade,
      activeGradeLabel: workspace.gradeLabel,
    }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(SUBJECT_COOKIE, workspace.workspaceKey, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 8 });
    return response;
  } catch (error) {
    console.warn("teacher subject switch temporarily unavailable", error);
    return NextResponse.json({
      ok: false,
      databaseUnavailable: true,
      message: "قاعدة البيانات مشغولة الآن. أعد المحاولة بعد قليل.",
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
