import { NextResponse } from "next/server";
import { createTeacherFirebaseToken } from "../../../../lib/server/firebase-auth-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const token = await createTeacherFirebaseToken("firebase-auth-check", ["history"]);
    return NextResponse.json({
      ok: true,
      tokenCreated: token.length > 100,
      credentialsConfigured: Boolean(
        process.env.FIREBASE_SERVICE_ACCOUNT_JSON
        || process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT
        || process.env.FIREBASE_SERVICE_ACCOUNT
        || (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY)
        || process.env.GOOGLE_APPLICATION_CREDENTIALS,
      ),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("firebase auth check failed", error);
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "unknown error" }, { status: 500 });
  }
}
