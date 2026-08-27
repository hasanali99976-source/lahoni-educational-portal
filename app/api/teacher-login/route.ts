import { NextResponse } from "next/server";
import { createSessionToken, findUserByUsername, PORTAL_SESSION_COOKIE, SESSION_MAX_AGE } from "../../../lib/server/portal-auth";
import { verifyPassword } from "../../../lib/server/password";
import { canonicalSubjectIds, synchronizeSchoolRosters } from "../../../lib/server/school-roster";
import { normalizeAssignments } from "../../../lib/teacher-assignments";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body?.name || body?.username || "").trim();
    const password = String(body?.password || "");
    const user = await findUserByUsername(username);

    if (!user || user.role !== "teacher" || !user.active || !user.updatedAt || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ ok: false, message: "اسم المعلم أو الرقم السري غير صحيح" }, { status: 401 });
    }

    const assignments = normalizeAssignments((user as { assignments?: unknown }).assignments, user.subjectIds);
    const subjectIds = canonicalSubjectIds(assignments);
    if (!subjectIds.length) {
      return NextResponse.json({ ok: false, message: "لم تُربط مادة وصف وفصل بحساب المعلم بعد. راجع إدارة البوابة." }, { status: 403 });
    }

    try {
      await synchronizeSchoolRosters();
    } catch (error) {
      console.error("school roster sync during teacher login failed", error);
    }

    const subjectId = subjectIds[0];
    const expiresAt = Date.now() + SESSION_MAX_AGE * 1000;
    const response = NextResponse.json(
      { ok: true, teacherId: user.id, teacherName: user.name, subjectKey: subjectId },
      { headers: { "Cache-Control": "no-store" } },
    );

    response.cookies.set(
      PORTAL_SESSION_COOKIE,
      createSessionToken({
        userId: user.id,
        role: "teacher",
        name: user.name,
        authVersion: user.updatedAt,
        expiresAt,
      }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_MAX_AGE,
      },
    );
    response.cookies.set("lahooni_active_subject", subjectId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    return response;
  } catch (error) {
    console.error("teacher login failed", error);
    return NextResponse.json({ ok: false, message: "تعذر تسجيل الدخول الآن" }, { status: 500 });
  }
}
