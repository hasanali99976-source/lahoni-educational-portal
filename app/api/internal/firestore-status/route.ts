import { NextResponse } from "next/server";
import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../../../lib/firebase";

export const dynamic = "force-dynamic";

export async function GET() {
  const id = `status_${Date.now()}`;
  const reference = doc(db, "portal_health_checks", id);
  try {
    await setDoc(reference, { createdAt: serverTimestamp(), source: "vercel-status-check" });
    await deleteDoc(reference);
    return NextResponse.json({ ok: true, code: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const value = error as { code?: string; message?: string };
    return NextResponse.json({ ok: false, code: value.code || "unknown", message: value.message || String(error) }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
