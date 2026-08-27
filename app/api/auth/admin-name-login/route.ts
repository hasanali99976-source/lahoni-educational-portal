import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import {
  ADMIN_SESSION_MAX_AGE,
  createSessionToken,
  normalizeUsername,
  PORTAL_SESSION_COOKIE,
} from "../../../../lib/server/portal-auth";
import { hashPassword } from "../../../../lib/server/password";

export const dynamic = "force-dynamic";

const ADMIN_NAME = "حسن علي";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body?.username || "").trim();

    if (normalizeUsername(username) !== normalizeUsername(ADMIN_NAME)) {
      return NextResponse.json({ ok: false, message: "اسم المدير غير صحيح" }, { status: 401 });
    }

    const document = adminDb().collection("portalV2Users").doc("primary-admin");
    const current = await document.get();
    const now = new Date().toISOString();
    const existing = current.exists ? current.data() : undefined;

    await document.set({
      username: ADMIN_NAME,
      normalizedUsername: normalizeUsername(ADMIN_NAME),
      name: ADMIN_NAME,
      role: "admin",
      active: true,
      subjectIds: [],
      assignments: [],
      passwordHash: existing?.passwordHash || hashPassword(randomBytes(32).toString("hex")),
      createdAt: existing?.createdAt || now,
      updatedAt: existing?.updatedAt || now,
    }, { merge: true });

    const expiresAt = Date.now() + ADMIN_SESSION_MAX_AGE * 1000;
    const response = NextResponse.json(
      { ok: true, role: "admin", name: ADMIN_NAME },
      { headers: { "Cache-Control": "no-store" } },
    );

    response.cookies.set(
      PORTAL_SESSION_COOKIE,
      createSessionToken({
        userId: "primary-admin",
        role: "admin",
        name: ADMIN_NAME,
        authVersion: existing?.updatedAt || now,
        expiresAt,
      }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: ADMIN_SESSION_MAX_AGE,
      },
    );

    return response;
  } catch (error) {
    console.error("admin name login failed", error);
    return NextResponse.json({ ok: false, message: "تعذر تسجيل الدخول الآن" }, { status: 500 });
  }
}
