import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { hashPassword } from "../../../../lib/server/password";
import { normalizeUsername } from "../../../../lib/server/portal-auth";

export const dynamic = "force-dynamic";

const ONE_TIME_TOKEN = "4fdb8314a3c54f0aaf01b43f6d5f9841";

export async function POST(request: Request) {
  const token = request.headers.get("x-bootstrap-token");
  if (token !== ONE_TIME_TOKEN) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const body = await request.json();
  const username = String(body?.username || "").trim();
  const password = String(body?.password || "");
  if (!username || password.length < 8) {
    return NextResponse.json({ ok: false, message: "بيانات غير مكتملة" }, { status: 400 });
  }

  const now = new Date().toISOString();
  await adminDb().collection("portalV2Users").doc("primary-admin").set({
    username,
    normalizedUsername: normalizeUsername(username),
    name: username,
    role: "admin",
    passwordHash: hashPassword(password),
    active: true,
    subjectIds: [],
    assignments: [],
    createdAt: now,
    updatedAt: now,
  }, { merge: true });

  return NextResponse.json({ ok: true });
}
