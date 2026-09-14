import { NextResponse } from "next/server";
import { createSessionToken, findUserByUsername, PORTAL_SESSION_COOKIE, SESSION_MAX_AGE, type PortalUser } from "../../../lib/server/portal-auth";
import { findLegacyTeacherByCredentials } from "../../../lib/server/legacy-teacher-auth";
import { verifyPassword } from "../../../lib/server/password";
import { adminAuth } from "../../../lib/server/firebase-admin";

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
    if (!Array.isArray(user.subjectIds) || user.subjectIds.length === 0) {
      return NextResponse.json({ ok: false, message: "لم تُربط مادة بحساب المعلم بعد. راجع إدارة البوابة." }, { status: 403 });
    }

    const subjectId = user.subjectIds[0];
    const expiresAt = Date.now() + SESSION_MAX_AGE * 1000;
    let firebaseToken = "";
    try {
      firebaseToken = await adminAuth().createCustomToken(user.id, {
        role: "teacher",
        subjectIds: user.subjectIds,
      });
    } catch (error) {
      console.warn("firebase client token creation skipped", error);
    }

    const response = NextResponse.json(
      { ok: true, teacherId: user.id, teacherName: user.name, subjectKey: subjectId, firebaseToken: firebaseToken || undefined },
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
