import { NextRequest, NextResponse } from "next/server";

const QR_LOCK_COOKIE = "lahooni_student_qr_lock";
const STUDENT_CODE_PATTERN = /^TH[123]\d{3}$/;
const LOCK_MAX_AGE = 60 * 60 * 4;

function setStudentLock(response: NextResponse) {
  response.cookies.set(QR_LOCK_COOKIE, "1", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: LOCK_MAX_AGE,
  });
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const queryCode = String(request.nextUrl.searchParams.get("code") || "").trim().toUpperCase();
  const directStudentBarcode = pathname === "/student" && STUDENT_CODE_PATTERN.test(queryCode);
  const locked = request.cookies.get(QR_LOCK_COOKIE)?.value === "1";

  // بعض الباركودات القديمة تفتح /student?code= مباشرة؛ فعّل القفل لها أيضًا.
  if (directStudentBarcode && !locked) {
    return setStudentLock(NextResponse.next());
  }

  if (!locked) return NextResponse.next();

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
