import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  teacherAccountFromSession,
  TEACHER_COOKIE,
  teacherSessionTokenForId,
  TEACHER_SESSION_MAX_AGE,
} from "../../../lib/teacher-session";
import { listTeacherSubjects } from "../../../lib/teacher-subjects";

const SUBJECT_COOKIE = "tahdheeb_teacher_subject";

export async function GET() {
  const store = await cookies();
  const value = store.get(TEACHER_COOKIE)?.value;
  const account = teacherAccountFromSession(value);

  if (!account) {
    return NextResponse.json(
      {
        authenticated: false,
        teacherId: null,
        teacherName: null,
        subjectKey: null,
        subject: null,
        subjects: [],
      },
      { status: 401 },
    );
  }

  let subjects: Array<{ subjectId: string; subjectName: string }> = [];
  try {
    const list = await listTeacherSubjects(account.teacherId);
    subjects = list
      .filter((item) => item.isActive !== false)
      .map((item) => ({
        subjectId: item.subjectId,
        subjectName: item.subjectName,
      }));
  } catch {
    subjects = [];
  }

  const savedSubject = store.get(SUBJECT_COOKIE)?.value || "";
  const current = subjects.find((item) => item.subjectId === savedSubject) || subjects[0] || null;

  const response = NextResponse.json({
    authenticated: true,
    teacherId: account.teacherId,
    teacherName: account.username,
    subjectKey: current?.subjectId ?? null,
    subject: current?.subjectName ?? null,
    subjects,
  });

  const token = teacherSessionTokenForId(account.teacherId);
  const cookiePayload = Buffer.from(
    JSON.stringify({ teacherId: account.teacherId, token }),
  ).toString("base64");

  response.cookies.set(TEACHER_COOKIE, cookiePayload, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TEACHER_SESSION_MAX_AGE,
  });

  if (current) {
    response.cookies.set(SUBJECT_COOKIE, current.subjectId, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: TEACHER_SESSION_MAX_AGE,
    });
  } else {
    response.cookies.delete(SUBJECT_COOKIE);
  }

  return response;
}

export async function POST(request: Request) {
  const store = await cookies();
  const value = store.get(TEACHER_COOKIE)?.value;
  const account = teacherAccountFromSession(value);
  if (!account) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const requested = String(body?.subjectId || "").trim();
  if (!requested) {
    return NextResponse.json(
      { ok: false, error: "subject_required" },
      { status: 400 },
    );
  }

  let allowed = false;
  try {
    const list = await listTeacherSubjects(account.teacherId);
    allowed = list.some(
      (item) => item.subjectId === requested && item.isActive !== false,
    );
  } catch {
    allowed = false;
  }

  if (!allowed) {
    return NextResponse.json(
      { ok: false, error: "subject_not_assigned" },
      { status: 403 },
    );
  }

  const response = NextResponse.json({ ok: true, subjectId: requested });
  response.cookies.set(SUBJECT_COOKIE, requested, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TEACHER_SESSION_MAX_AGE,
  });
  return response;
}
