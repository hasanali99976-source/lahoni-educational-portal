import { NextRequest, NextResponse } from "next/server";

const QR_LOCK_COOKIE = "lahooni_student_qr_lock";
const STUDENT_CODE_PATTERN = /^TH[123]\d{3}$/;
const LOCK_MAX_AGE = 60 * 60 * 4;
const OFFICIAL_HOSTS = new Set(["tahdheeb-history.vercel.app"]);

function requestHost(request: NextRequest) {
  return String(request.headers.get("x-forwarded-host") || request.headers.get("host") || "")
    .split(",")[0].trim().toLowerCase().split(":")[0];
}

function isStaleDeploymentApiRequest(request: NextRequest, pathname: string) {
  if (!pathname.startsWith("/api/")) return false;
  const host = requestHost(request);
  if (!host || host === "localhost" || host === "127.0.0.1") return false;
  // Direct *.vercel.app deployment/branch URLs must never touch Firestore.
  // Only the stable public production hostname is allowed to execute APIs.
  return host.endsWith(".vercel.app") && !OFFICIAL_HOSTS.has(host);
}

function setStudentLock(response: NextResponse) {
  response.cookies.set(QR_LOCK_COOKIE, "1", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: LOCK_MAX_AGE });
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

function clearStudentLock(response: NextResponse) {
  response.cookies.set(QR_LOCK_COOKIE, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Drain guard: old/temporary Vercel deployments were still receiving API probes.
  // Reject them before any route handler can initialize Firebase or read Firestore.
  if (isStaleDeploymentApiRequest(request, pathname)) {
    return NextResponse.json(
      { ok: false, message: "استخدم الرابط الرسمي للبوابة." },
      { status: 421, headers: { "Cache-Control": "no-store" } },
    );
  }

  const queryCode = String(request.nextUrl.searchParams.get("code") || "").trim().toUpperCase();
  const directStudentBarcode = pathname === "/student" && STUDENT_CODE_PATTERN.test(queryCode);
  const explicitStudentLogout = pathname === "/student" && request.nextUrl.searchParams.has("logout");
  const locked = request.cookies.get(QR_LOCK_COOKIE)?.value === "1";

  if (explicitStudentLogout) return clearStudentLock(NextResponse.next());
  if (pathname === "/" || pathname === "/home") return clearStudentLock(NextResponse.next());
  if (directStudentBarcode && !locked) return setStudentLock(NextResponse.next());
  if (!locked) return NextResponse.next();
  if (pathname.startsWith("/student") || pathname.startsWith("/api/student")) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, message: "هذه الجلسة مخصصة لبوابة الطالب فقط." }, { status: 403, headers: { "Cache-Control": "no-store" } });
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
