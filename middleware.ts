import { NextRequest, NextResponse } from "next/server";

/**
 * Drain guard for the teacher portal.
 *
 * The teacher shell currently prefetches every navigation target. Those speculative
 * RSC requests were executing the teacher pages hundreds of times per hour and
 * indirectly refreshing session/data APIs. A prefetch is not a real navigation,
 * so stop it at middleware before any page/server work runs.
 *
 * Real navigations, API calls, POSTs and all stored school data are untouched.
 */
export function middleware(request: NextRequest) {
  if (request.method !== "GET") return NextResponse.next();

  const pathname = request.nextUrl.pathname;
  if (!pathname.startsWith("/teacher/") || pathname.startsWith("/teacher/api/")) {
    return NextResponse.next();
  }

  const purpose = request.headers.get("purpose")?.toLowerCase();
  const secPurpose = request.headers.get("sec-purpose")?.toLowerCase();
  const routerPrefetch = request.headers.get("next-router-prefetch");
  const middlewarePrefetch = request.headers.get("x-middleware-prefetch");
  const isPrefetch =
    purpose === "prefetch" ||
    secPurpose?.includes("prefetch") === true ||
    routerPrefetch === "1" ||
    middlewarePrefetch === "1";

  if (isPrefetch) {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Cache-Control": "private, max-age=60",
        "X-Lahooni-Drain-Guard": "teacher-prefetch-blocked",
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/teacher/:path*"],
};
