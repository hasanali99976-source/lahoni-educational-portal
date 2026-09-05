import { NextResponse } from "next/server";
import {
  ADMIN_AUTH_VERSION,
  ADMIN_SESSION_MAX_AGE,
  createSessionToken,
  normalizeUsername,
  PORTAL_SESSION_COOKIE,
} from "../../../../lib/server/portal-auth";

export const dynamic = "force-dynamic";

const ADMIN_NAME = "حسن علي";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body?.username || "").trim();

    if (normalizeUsername(username) !== normalizeUsername(ADMIN_NAME)) {
      return NextResponse.json({ ok: false, message: "اسم المدير غير صحيح" }, { status: 401 });
    }

    const expiresAt = Date.now() + ADMIN_SESSION_MAX_AGE * 1000;
    const response = NextResponse.json(
      { ok: true, role: "admin", name: ADMIN_NAME, expiresAt, trustedDays: 10 },
      { headers: { "Cache-Control": "no-store" } },
    );

    response.cookies.set(
      PORTAL_SESSION_COOKIE,
      createSessionToken({
        userId: "primary-admin",
        role: "admin",
        name: ADMIN_NAME,
        authVersion: ADMIN_AUTH_VERSION,
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
