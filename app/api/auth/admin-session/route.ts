import { NextResponse } from "next/server";
import { requireSession } from "../../../../lib/server/portal-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireSession("admin");
  if (!session) {
    return NextResponse.json({ ok: false, role: null }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json(
    { ok: true, role: "admin", name: session.name },
    { headers: { "Cache-Control": "no-store" } },
  );
}
