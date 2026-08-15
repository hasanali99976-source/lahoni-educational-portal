import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isTeacherSessionValid, TEACHER_COOKIE } from "../../../lib/teacher-session";

export async function GET() {
  const store = await cookies();
  const value = store.get(TEACHER_COOKIE)?.value;
  return NextResponse.json({ authenticated: isTeacherSessionValid(value) }, { status: isTeacherSessionValid(value) ? 200 : 401 });
}
