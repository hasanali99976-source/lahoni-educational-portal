import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  teacherAccountFromSession,
  TEACHER_COOKIE,
  teacherSessionTokenForId,
  TEACHER_SESSION_MAX_AGE,
} from "../../../lib/teacher-session";
import { listTeacherSubjects } from "../../../lib/teacher-subjects";

export async function GET() {
  const store = await cookies();
  const value = store.get(TEACHER_COOKIE)?.value;
  const account = teacherAccountFromSession(value);
  const authenticated = !!account;

  // gather teacher subjects from Firestore
  let subjects = [] as Array<{ subjectId: string; subjectName: string }>;
  let currentSubject: string | null = null;
  if (authenticated && account) {
    try {
      const list = await listTeacherSubjects(account.teacherId);
      subjects = list.map((s) => ({ subjectId: s.subjectId, subjectName: s.subjectName }));
    } catch (e) {
      // ignore Firestore errors
    }
    // read current subject from cookie
    const subjectCookie = store.get("tahdheeb_teacher_subject")?.value;
    if (subjectCookie) currentSubject = subjectCookie;
    if (!currentSubject && subjects.length === 1) currentSubject = subjects[0].subjectId;
  }

  const response = NextResponse.json(
    {
      authenticated,
      teacherId: account?.teacherId ?? null,
      teacherName: account?.username ?? null,
      subjectKey: currentSubject,
      subject: currentSubject
        ? subjects.find((s) => s.subjectId === currentSubject)?.subjectName ?? null
        : null,
      subjects,
    },
    { status: authenticated ? 200 : 401 }
  );

  if (account) {
    // Set stable teacherId-based token cookie (base64 JSON)
    try {
      const token = teacherSessionTokenForId(account.teacherId);
      const cookiePayload = Buffer.from(JSON.stringify({ teacherId: account.teacherId, token })).toString("base64");
      response.cookies.set(TEACHER_COOKIE, cookiePayload, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: TEACHER_SESSION_MAX_AGE,
      });
    } catch (e) {
      // fallback: do not block
    }
    if (currentSubject) {
      response.cookies.set("tahdheeb_teacher_subject", String(currentSubject), {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: TEACHER_SESSION_MAX_AGE,
      });
    }
  }

  return response;
}

// Allow selecting a subject via POST - sets the tahdheeb_teacher_subject cookie for the session
export async function POST(request: Request) {
  const store = await cookies();
  const value = store.get(TEACHER_COOKIE)?.value;
  const account = teacherAccountFromSession(value);
  if (!account) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const body = await request.json();
    const subjectId = String(body?.subjectId || "");
    // Basic validation: owner must have this subject
    const list = await listTeacherSubjects(account.teacherId);
    if (list.length > 0 && !list.find((s) => s.subjectId === subjectId)) {
      return NextResponse.json({ ok: false, error: "subject_not_assigned" }, { status: 403 });
    }

    const res = NextResponse.json({ ok: true, subjectId });
    res.cookies.set("tahdheeb_teacher_subject", subjectId, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: TEACHER_SESSION_MAX_AGE,
    });
    return res;
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 400 });
  }
}
