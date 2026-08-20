import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { hashPassword } from "../../../../lib/server/password";
import { requireSession } from "../../../../lib/server/portal-auth";

export async function PATCH(request: Request) {
  const session = await requireSession("admin");
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await request.json();
  const password = String(body?.password || "");
  if (password.length < 8) return NextResponse.json({ ok: false, message: "كلمة المرور يجب أن تكون ٨ خانات على الأقل" }, { status: 400 });
  await adminDb().collection("portalV2Users").doc(session.userId).update({ passwordHash: hashPassword(password), updatedAt: new Date().toISOString() });
  return NextResponse.json({ ok: true });
}
