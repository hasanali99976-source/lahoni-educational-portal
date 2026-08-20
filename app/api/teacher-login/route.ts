import { NextResponse } from "next/server";
import { createSessionToken, findUserByUsername, PORTAL_SESSION_COOKIE, SESSION_MAX_AGE } from "../../../lib/server/portal-auth";
import { verifyPassword } from "../../../lib/server/password";

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
    if (!Array.isArray(user.subjectIds) || user.subjectIds.length === 0) {
      return NextResponse.json({ ok: false, message: "لم تُربط مادة بحساب المعلم بعد. راجع إدارة البوابة." }, { status: 403 });
    }

    const subjectId = user.subjectIds[0];
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
