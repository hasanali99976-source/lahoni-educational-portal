import { NextResponse } from "next/server";

/** Serve the teacher background uploaded to the repository root, without Firestore reads. */
export async function GET() {
  const url = "https://raw.githubusercontent.com/hasanali99976-source/lahoni-educational-portal/main/teacher-login-bg.png.png";
  try {
    const response = await fetch(url, { next: { revalidate: 86400 } });
    if (!response.ok) return new NextResponse(null, { status: 404 });
    const bytes = await response.arrayBuffer();
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}
