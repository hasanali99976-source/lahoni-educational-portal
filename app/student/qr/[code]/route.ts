import { NextResponse } from "next/server";

const CODE_PATTERN = /^TH[123]\d{3}$/;

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await context.params;
  const code = String(rawCode || "").trim().toUpperCase();
  const origin = new URL(request.url).origin;

  if (!CODE_PATTERN.test(code)) {
    return NextResponse.redirect(new URL("/student?entry=qr-invalid", origin), 307);
  }

  const target = new URL("/student", origin);
  target.searchParams.set("code", code);
  target.searchParams.set("entry", "iphone-qr");
  target.searchParams.set("v", "45");
  const response = NextResponse.redirect(target, 307);
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}
