import { NextResponse } from "next/server";
import { adminDb } from "../../../lib/server/firebase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await adminDb().collection("portalV2Users").limit(1).get();
    return NextResponse.json({ ok: true, firestore: "server-admin-ready" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("internal auth health failed", error);
    return NextResponse.json({ ok: false, firestore: "unavailable" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
