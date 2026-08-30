import { NextResponse } from "next/server";

const CODE_PATTERN = /^TH[123]\d{3}$/;
const QR_LOCK_COOKIE = "lahooni_student_qr_lock";

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await context.params;
  const code = String(rawCode || "").trim().toUpperCase();
  const origin = new URL(request.url).origin;

  if (!CODE_PATTERN.test(code)) {
    return NextResponse.redirect(new URL("/student?entry=qr-invalid", origin), 307);
  }

  const target = new URL("/student", origin);
  target.searchParams.set("code", code);
  target.searchParams.set("entry", "qr");
  target.searchParams.set("v", "46");

  const response = NextResponse.redirect(target, 307);
  response.cookies.set(QR_LOCK_COOKIE, "1", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 4,
  });
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
