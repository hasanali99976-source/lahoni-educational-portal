import { NextResponse } from "next/server";
import { adminDb } from "../../../lib/server/firebase-admin";
import { createSessionToken, findUserByUsername, PORTAL_SESSION_COOKIE, SESSION_MAX_AGE, type PortalUser } from "../../../lib/server/portal-auth";
import { findLegacyTeacherByCredentials } from "../../../lib/server/legacy-teacher-auth";
import { verifyPassword } from "../../../lib/server/password";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body?.name || body?.username || "").trim();
    const password = String(body?.password || "");

    let user: PortalUser | null = null;
    try {
      const databaseUser = await findUserByUsername(username);
      if (databaseUser && databaseUser.role === "teacher" && databaseUser.active && databaseUser.updatedAt && verifyPassword(password, databaseUser.passwordHash)) {
        user = databaseUser;
      }
    } catch (error) {
      console.warn("teacher database login unavailable; using approved legacy fallback", error);
    }

    if (!user) {
      user = findLegacyTeacherByCredentials(username, password) as PortalUser | null;
    }

    if (!user || user.role !== "teacher" || !user.active || !user.updatedAt) {
      return NextResponse.json({ ok: false, message: "اسم المعلم أو الرقم السري غير صحيح" }, { status: 401 });
    }
    const absenceSettings = await adminDb().collection("portalV2Settings").doc("secondaryDailyAbsence").get();
    const isAbsenceOfficer = absenceSettings.data()?.teacherId === user.id;
    const teachingSubjects = (user.subjectIds || []).filter(id => id !== "daily-absence");
    if (teachingSubjects.length === 0 && !isAbsenceOfficer) {
      return NextResponse.json({ ok: false, message: "لم تُربط مادة بحساب المعلم بعد. راجع إدارة البوابة." }, { status: 403 });
    }

    const subjectId = isAbsenceOfficer ? "daily-absence" : teachingSubjects[0] || "";
    const expiresAt = Date.now() + SESSION_MAX_AGE * 1000;
    const response = NextResponse.json(
      { ok: true, teacherId: user.id, teacherName: user.name, subjectKey: subjectId, isAbsenceOfficer },
      { headers: { "Cache-Control": "no-store" } },
    );

    const { passwordHash: _passwordHash, ...userSnapshot } = user;
    response.cookies.set(
      PORTAL_SESSION_COOKIE,
      createSessionToken({
        userId: user.id,
        role: "teacher",
        name: user.name,
        authVersion: user.updatedAt,
        expiresAt,
        userSnapshot,
      }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_MAX_AGE,
      },
    );
    response.cookies.set("lahooni_active_subject", subjectId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    return response;
  } catch (error) {
    console.error("teacher login failed", error);
    return NextResponse.json({ ok: false, message: "تعذر تسجيل الدخول الآن" }, { status: 500 });
  }
}
