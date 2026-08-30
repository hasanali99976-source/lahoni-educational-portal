import { NextRequest, NextResponse } from "next/server";

const QR_LOCK_COOKIE = "lahooni_student_qr_lock";

export function proxy(request: NextRequest) {
  if (request.cookies.get(QR_LOCK_COOKIE)?.value !== "1") {
    return NextResponse.next();
  }

  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith("/student") || pathname.startsWith("/api/student")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { ok: false, message: "هذه الجلسة مخصصة لبوابة الطالب فقط." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const target = request.nextUrl.clone();
  target.pathname = "/student";
  target.search = "";
  target.searchParams.set("entry", "qr-locked");
  return NextResponse.redirect(target, 307);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|icons/|manifest.webmanifest|sw.js).*)"],
};
