import { NextResponse } from "next/server";
import { PORTAL_SESSION_COOKIE } from "../../../lib/server/portal-auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  for (const cookie of [PORTAL_SESSION_COOKIE, "lahooni_active_subject"]) response.cookies.set(cookie, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
