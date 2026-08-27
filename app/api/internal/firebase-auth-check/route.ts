import { NextResponse } from "next/server";
import { createTeacherFirebaseToken } from "../../../../lib/server/firebase-auth-admin";
import { adminDb } from "../../../../lib/server/firebase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  let tokenCreated = false;
  let tokenError = "";
  let serverFirestoreWrite = false;
  let writeError = "";

  try {
    const token = await createTeacherFirebaseToken("firebase-auth-check", ["history"]);
    tokenCreated = token.length > 100;
  } catch (error) {
    tokenError = error instanceof Error ? error.message : "unknown token error";
  }

  const reference = adminDb()
    .collection("portalV2Data/firebase-auth-check/subjects/history/diagnostics")
    .doc("write-check");
  try {
    await reference.set({ ok: true, checkedAt: new Date().toISOString() });
    const snapshot = await reference.get();
    serverFirestoreWrite = snapshot.exists;
    await reference.delete();
  } catch (error) {
    writeError = error instanceof Error ? error.message : "unknown write error";
  }

  return NextResponse.json({
    ok: tokenCreated || serverFirestoreWrite,
    tokenCreated,
    tokenError,
    serverFirestoreWrite,
    writeError,
  }, {
    status: tokenCreated || serverFirestoreWrite ? 200 : 500,
    headers: { "Cache-Control": "no-store" },
  });
}
