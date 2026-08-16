import { NextResponse } from "next/server";
import { isTeacherCredentialsValid, TEACHER_COOKIE, teacherSessionToken, TEACHER_SESSION_MAX_AGE } from "../../../lib/teacher-session";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body?.username || "").trim();
    const password = String(body?.password || "");
    if (!isTeacherCredentialsValid(username, password)) {
      return NextResponse.json({ ok: false, message: "اسم المستخدم أو كلمة المرور غير صحيحة" }, { status: 401 });
    }
    const response = NextResponse.json({ ok: true });
    response.cookies.set(TEACHER_COOKIE, teacherSessionToken(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: TEACHER_SESSION_MAX_AGE,
    });
    return response;
  } catch {
    return NextResponse.json({ ok: false, message: "تعذر تسجيل الدخول" }, { status: 400 });
  }
}
