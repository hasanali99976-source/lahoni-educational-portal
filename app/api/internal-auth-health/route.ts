import { NextResponse } from "next/server";
import { collection, getDocs, limit, query } from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const credential = await signInAnonymously(auth);
    const snapshot = await getDocs(query(collection(db, "portalV2Users"), limit(1)));
    await auth.signOut().catch(() => undefined);
    return NextResponse.json(
      { ok: true, firestore: "authenticated-client-ready", found: !snapshot.empty },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("internal authenticated firestore health failed", error);
    return NextResponse.json(
      { ok: false, firestore: "unavailable", code: String((error as { code?: string })?.code || "unknown") },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
