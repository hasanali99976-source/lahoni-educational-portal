import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  teacherAccountFromSession,
  TEACHER_COOKIE,
  teacherSessionTokenForId,
  TEACHER_SESSION_MAX_AGE,
} from "../../../lib/teacher-session";
import { getSubjectConfig } from "../../../lib/subject-config";

const SUBJECT_COOKIE = "tahdheeb_teacher_subject";

export async function GET() {
  const store = await cookies();
  const value = store.get(TEACHER_COOKIE)?.value;
  const account = teacherAccountFromSession(value);
  const authenticated = !!account;

  if (!account) {
    return NextResponse.json({ authenticated: false, teacherId: null, teacherName: null, subjectKey: null, subject: null, subjects: [] }, { status: 401 });
  }

  const subjectKey = account.subjectKey;
  const subjectName = getSubjectConfig(subjectKey).label;
  const subjects = [{ subjectId: subjectKey, subjectName }];

  const response = NextResponse.json({
    authenticated,
    teacherId: account.teacherId,
    teacherName: account.username,
    subjectKey,
    subject: subjectName,
    subjects,
  });

  const token = teacherSessionTokenForId(account.teacherId);
  const cookiePayload = Buffer.from(JSON.stringify({ teacherId: account.teacherId, token })).toString("base64");
  response.cookies.set(TEACHER_COOKIE, cookiePayload, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TEACHER_SESSION_MAX_AGE,
  });
  response.cookies.set(SUBJECT_COOKIE, subjectKey, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TEACHER_SESSION_MAX_AGE,
  });

  return response;
}

export async function POST(request: Request) {
  const store = await cookies();
  const value = store.get(TEACHER_COOKIE)?.value;
  const account = teacherAccountFromSession(value);
  if (!account) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const requested = String(body?.subjectId || "");
  if (requested && requested !== account.subjectKey) {
    return NextResponse.json({ ok: false, error: "subject_not_assigned" }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true, subjectId: account.subjectKey });
  response.cookies.set(SUBJECT_COOKIE, account.subjectKey, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TEACHER_SESSION_MAX_AGE,
  });
  return response;
}
