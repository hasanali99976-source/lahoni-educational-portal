import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  teacherAccountFromSession,
  TEACHER_COOKIE,
  teacherSessionToken,
  TEACHER_SESSION_MAX_AGE,
} from "../../../lib/teacher-session";

export async function GET() {
  const store = await cookies();
  const value = store.get(TEACHER_COOKIE)?.value;
  const account = teacherAccountFromSession(value);
  const authenticated = !!account;

  const response = NextResponse.json(
    {
      authenticated,
      teacherId: account?.teacherId ?? null,
      teacherName: account?.username ?? null,
      subjectKey: account?.subjectKey ?? null,
      subject: account?.subject ?? null,
    },
    { status: authenticated ? 200 : 401 },
  );

  if (account) {
    response.cookies.set(TEACHER_COOKIE, teacherSessionToken(account), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: TEACHER_SESSION_MAX_AGE,
    });
  }

  return response;
}
