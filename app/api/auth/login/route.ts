import { NextResponse } from "next/server";
import { createSessionToken, findUserByUsername, PORTAL_SESSION_COOKIE, SESSION_MAX_AGE } from "../../../../lib/server/portal-auth";
import { verifyPassword } from "../../../../lib/server/password";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body?.username || "").trim();
    const password = String(body?.password || "");
    if (!username || !password) return NextResponse.json({ ok: false, message: "أدخل اسم المستخدم وكلمة المرور" }, { status: 400 });

    const user = await findUserByUsername(username);
    if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ ok: false, message: "بيانات الدخول غير صحيحة" }, { status: 401 });
    }

    const expiresAt = Date.now() + SESSION_MAX_AGE * 1000;
    const response = NextResponse.json({ ok: true, role: user.role, name: user.name });
    response.cookies.set(PORTAL_SESSION_COOKIE, createSessionToken({ userId: user.id, role: user.role, name: user.name, expiresAt }), {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_MAX_AGE,
    });
    return response;
  } catch (error) {
    console.error("portal login failed", error);
    return NextResponse.json({ ok: false, message: "تعذر تسجيل الدخول الآن" }, { status: 500 });
  }
}
