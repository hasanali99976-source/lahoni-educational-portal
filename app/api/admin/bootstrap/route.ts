import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { hashPassword } from "../../../../lib/server/password";
import { normalizeUsername } from "../../../../lib/server/portal-auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body?.username || "").trim();
    const name = String(body?.name || "مدير البوابة").trim();
    const password = String(body?.password || "");
    if (username.length < 3 || password.length < 8) {
      return NextResponse.json({ ok: false, message: "اسم المستخدم مطلوب وكلمة المرور ٨ خانات على الأقل" }, { status: 400 });
    }
    const existing = await adminDb().collection("portalV2Users").where("role", "==", "admin").limit(1).get();
    if (!existing.empty) return NextResponse.json({ ok: false, message: "تم إنشاء حساب المدير مسبقًا" }, { status: 409 });
    const now = new Date().toISOString();
    await adminDb().collection("portalV2Users").add({ username, normalizedUsername: normalizeUsername(username), name, role: "admin", passwordHash: hashPassword(password), active: true, subjectIds: [], createdAt: now, updatedAt: now });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("admin bootstrap failed", error);
    return NextResponse.json({ ok: false, message: "تعذر إنشاء حساب المدير" }, { status: 500 });
  }
}
