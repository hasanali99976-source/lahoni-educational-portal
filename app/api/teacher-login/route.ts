import { NextResponse } from "next/server";
import {
  findTeacherAccount,
  TEACHER_ACCOUNTS,
  TEACHER_COOKIE,
  teacherSessionTokenForId,
  TEACHER_SESSION_MAX_AGE,
} from "../../../lib/teacher-session";
import { ensureTeacherSubject } from "../../../lib/teacher-subjects";
import { db } from "../../../lib/firebase";
import { migrateLegacyHistoryStudents } from "../../../lib/firestore-tenant-client";
import { doc, getDoc, setDoc } from "firebase/firestore";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body?.username || "").trim();
    const password = String(body?.password || "");

    // debug: log incoming username and known accounts
    try { console.log('[teacher-login] attempt', { username, accounts: TEACHER_ACCOUNTS.map(a=>({ username: a.username, teacherId: a.teacherId })) }); } catch(e){}

    const account = findTeacherAccount(username, password);

    if (!account) {
      return NextResponse.json(
        { ok: false, message: "اسم المستخدم أو كلمة المرور غير صحيحة" },
        { status: 401 },
      );
    }

    // ensure teacher's subject entries exist (migration step)
    try{
          await ensureTeacherSubject(account.teacherId, account.subjectKey);
    }catch(e){/* ignore migration errors */}

    // ensure teacher profile doc exists with a display name
    try{
      const ref = doc(db, `teachers/${account.teacherId}`);
      const snap = await getDoc(ref);
      if(!snap.exists()){
        await setDoc(ref, { name: account.username }, { merge: true });
      }
    }catch(e){/* ignore */}

    // attempt to migrate legacy history students into the tenant path for Hasan
    try{
      await migrateLegacyHistoryStudents(db, { teacherId: account.teacherId, teacherName: account.username, subjectKey: account.subjectKey });
    }catch(e){/* ignore migration errors */}

    const response = NextResponse.json({
          ok: true,
          teacherId: account.teacherId,
          teacherName: account.username,
          subjectKey: account.subjectKey,
          subject: account.subject,
    });

    // Create a stable token based on teacherId and a server secret and store as base64(JSON)
    const token = teacherSessionTokenForId(account.teacherId);
    const cookiePayload = Buffer.from(JSON.stringify({ teacherId: account.teacherId, token })).toString("base64");

    response.cookies.set(TEACHER_COOKIE, cookiePayload, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: TEACHER_SESSION_MAX_AGE,
    });

    return response;
  } catch {
    return NextResponse.json(
      { ok: false, message: "تعذر تسجيل الدخول" },
      { status: 400 },
    );
  }
}
