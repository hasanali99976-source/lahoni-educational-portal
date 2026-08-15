import { NextResponse } from "next/server";
import { isTeacherCodeValid, TEACHER_COOKIE, teacherSessionToken } from "../../../lib/teacher-session";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const code = String(body?.code || "");
    if (!isTeacherCodeValid(code)) {
      return NextResponse.json({ ok: false, message: "رمز الدخول غير صحيح" }, { status: 401 });
    }
    const response = NextResponse.json({ ok: true });
    response.cookies.set(TEACHER_COOKIE, teacherSessionToken(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
    return response;
  } catch {
    return NextResponse.json({ ok: false, message: "تعذر تسجيل الدخول" }, { status: 400 });
  }
}
