import { NextResponse } from "next/server";
import { createSessionToken, findUserByUsername, PORTAL_SESSION_COOKIE, SESSION_MAX_AGE } from "../../../lib/server/portal-auth";
import { verifyPassword } from "../../../lib/server/password";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body?.name || body?.username || "").trim();
    const password = String(body?.password || "");
    const user = await findUserByUsername(username);
    if (!user || user.role !== "teacher" || !user.active || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ ok: false, message: "اسم المعلم أو الرقم السري غير صحيح" }, { status: 401 });
    }
    const subjectId = user.subjectIds[0] || null;
    const expiresAt = Date.now() + SESSION_MAX_AGE * 1000;
    const response = NextResponse.json({ ok: true, teacherId: user.id, teacherName: user.name, subjectKey: subjectId });
    response.cookies.set(PORTAL_SESSION_COOKIE, createSessionToken({ userId: user.id, role: "teacher", name: user.name, expiresAt }), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_MAX_AGE });
    if (subjectId) response.cookies.set("lahooni_active_subject", subjectId, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_MAX_AGE });
    return response;
  } catch (error) {
    console.error("teacher login failed", error);
    return NextResponse.json({ ok: false, message: "تعذر تسجيل الدخول الآن" }, { status: 500 });
  }
}
