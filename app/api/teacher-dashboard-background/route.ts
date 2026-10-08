import { NextResponse } from "next/server";

/** Cached decorative image only; no Firestore access. */
export async function GET() {
  try {
    const source = await fetch("https://raw.githubusercontent.com/hasanali99976-source/lahoni-educational-portal/main/public/teacher-dashboard-bg.png.png", { next: { revalidate: 86400 } });
    if (!source.ok) return new NextResponse(null, { status: 404 });
    return new NextResponse(await source.arrayBuffer(), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800", "X-Content-Type-Options": "nosniff" } });
  } catch { return new NextResponse(null, { status: 503 }); }
}
