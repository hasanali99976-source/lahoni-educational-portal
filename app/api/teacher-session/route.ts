import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { adminDb } from "../../../lib/server/firebase-admin";
import { restoreLegacyTeacherLearningData } from "../../../lib/server/legacy-teacher-data";
import { requireSession } from "../../../lib/server/portal-auth";
import { getSubjectConfig } from "../../../lib/subject-config";
import { normalizeAssignments } from "../../../lib/teacher-assignments";
import { TEACHER_CLASS_SCOPES_COLLECTION, teacherClassScopeId } from "../../../lib/teacher-class-scope";

const SUBJECT_COOKIE = "lahooni_active_subject";

function databaseUnavailable() {
  return NextResponse.json({
    authenticated: false,
    databaseUnavailable: true,
    message: "قاعدة البيانات مشغولة الآن. أعد المحاولة بعد قليل.",
  }, { status: 503, headers: { "Cache-Control": "no-store" } });
}

function assignmentSignature(ids: string[]) {
  return [...new Set(ids)].sort().join("|");
}

async function resetStaleClassScopes(teacherId: string, subjectIds: string[], assignments: ReturnType<typeof normalizeAssignments>) {
  const database = adminDb();
  const resetSubjects: string[] = [];

  for (const subjectId of subjectIds) {
    const relevant = assignments.filter(item => item.subjectId === subjectId);
    const expectedSignature = assignmentSignature(relevant.map(item => item.id));
    const reference = database.collection(TEACHER_CLASS_SCOPES_COLLECTION)
      .doc(teacherClassScopeId(teacherId, subjectId));
    const snapshot = await reference.get();
    if (!snapshot.exists) continue;

    const data = snapshot.data() as Record<string, unknown>;
    const savedSignature = String(data.assignmentSignature || "");
    if (savedSignature === expectedSignature && savedSignature) continue;

    await reference.delete();
    resetSubjects.push(subjectId);
  }

  return resetSubjects;
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

    let resetClassScopes: string[] = [];
    try {
      resetClassScopes = await resetStaleClassScopes(user.id, user.subjectIds, assignments);
    } catch (error) {
      console.warn("stale teacher class scope reset skipped", error);
    }

    let legacyRestore: Record<string, unknown> = { restored: 0, alreadyChecked: false };
    try {
      legacyRestore = await restoreLegacyTeacherLearningData({
        teacherId: user.id,
        teacherName: user.name,
        subjectIds: user.subjectIds,
      });
    } catch (error) {
      console.warn("legacy teacher data restoration skipped", error);
    }

    console.info("teacher session data status", {
      teacherId: user.id,
      teacherName: user.name,
      subjectIds: user.subjectIds,
      assignments: assignments.map(item => item.id),
      resetClassScopes,
      legacyRestore,
    });

    const response = NextResponse.json({
      authenticated: true,
      teacherId: user.id,
      teacherName: user.name,
      subjectKey: current,
      subject: current ? getSubjectConfig(current).label : null,
      subjects,
      assignments,
      resetClassScopes,
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
