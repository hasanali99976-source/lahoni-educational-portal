import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, PORTAL_SESSION_COOKIE } from "../../../../lib/server/portal-auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  const options = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 0 };
  response.cookies.set(ADMIN_SESSION_COOKIE, "", options);
  response.cookies.set(PORTAL_SESSION_COOKIE, "", options);
  return response;
}
