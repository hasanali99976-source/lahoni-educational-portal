import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { restoreLegacyTeacherLearningData } from "../../../lib/server/legacy-teacher-data";
import { requireSession } from "../../../lib/server/portal-auth";
import { getSubjectConfig } from "../../../lib/subject-config";
import { normalizeAssignments } from "../../../lib/teacher-assignments";

const SUBJECT_COOKIE = "lahooni_active_subject";

function databaseUnavailable() {
  return NextResponse.json({
    authenticated: false,
    databaseUnavailable: true,
    message: "قاعدة البيانات مشغولة الآن. أعد المحاولة بعد قليل.",
  }, { status: 503, headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  try {
    const session = await requireSession("teacher");
    if (!session) return NextResponse.json({ authenticated: false }, { status: 401 });
    const user = session.user;
    if (!user || !user.active) return NextResponse.json({ authenticated: false }, { status: 401 });

    const store = await cookies();
    const saved = (store.get(SUBJECT_COOKIE)?.value || "").split("--")[0];
    const current = user.subjectIds.includes(saved) ? saved : user.subjectIds[0] || null;
    const assignments = normalizeAssignments(user.assignments, user.subjectIds);
    const subjects = user.subjectIds.map(subjectId => {
      const subjectAssignments = assignments.filter(item => item.subjectId === subjectId);
      const grades = [...new Set(subjectAssignments.map(item => item.grade).filter(Boolean))];
      return {
        subjectId,
        subjectName: getSubjectConfig(subjectId).label,
        grades,
        gradeLabel: grades.length ? grades.join("، ") : "",
      };
    });

    let legacyRestore = { restored: 0, alreadyChecked: false };
    try {
      legacyRestore = await restoreLegacyTeacherLearningData({
        teacherId: user.id,
        teacherName: user.name,
        subjectIds: user.subjectIds,
      });
    } catch (error) {
      console.warn("legacy teacher data restoration skipped", error);
    }

    const response = NextResponse.json({
      authenticated: true,
      teacherId: user.id,
      teacherName: user.name,
      subjectKey: current,
      subject: current ? getSubjectConfig(current).label : null,
      subjects,
      assignments,
      legacyRestore,
    }, { headers: { "Cache-Control": "no-store" } });
    if (current) response.cookies.set(SUBJECT_COOKIE, current, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 8 });
    return response;
  } catch (error) {
    console.warn("teacher session temporarily unavailable", error);
    return databaseUnavailable();
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession("teacher");
    if (!session) return NextResponse.json({ ok: false }, { status: 401 });
    const user = session.user;
    const body = await request.json().catch(() => ({}));
    const subjectId = String(body?.subjectId || "").split("--")[0];
    if (!user?.active || !user.subjectIds.includes(subjectId)) return NextResponse.json({ ok: false, error: "subject_not_assigned" }, { status: 403 });
    const response = NextResponse.json({ ok: true, subjectId }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(SUBJECT_COOKIE, subjectId, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 8 });
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
