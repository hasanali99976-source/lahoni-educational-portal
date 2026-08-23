import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { hashPassword } from "../../../../lib/server/password";
import { normalizeUsername, requireSession } from "../../../../lib/server/portal-auth";

export async function GET() {
  if (!await requireSession("admin")) return NextResponse.json({ ok: false }, { status: 401 });
  const [supervisorsSnapshot, teachersSnapshot] = await Promise.all([
    adminDb().collection("portalV2Users").where("role", "==", "supervisor").get(),
    adminDb().collection("portalV2Users").where("role", "==", "teacher").get(),
  ]);
  const supervisors = supervisorsSnapshot.docs.map(document => {
    const data = document.data();
    return { id: document.id, name: data.name, username: data.username, active: data.active === true, subjectIds: data.subjectIds || [], teacherIds: data.teacherIds || [], permissionLevel: data.permissionLevel || "view" };
  }).sort((a, b) => a.name.localeCompare(b.name, "ar"));
  const teachers = teachersSnapshot.docs.map(document => {
    const data = document.data();
    return { id: document.id, name: data.name, active: data.active === true, subjectIds: data.subjectIds || [] };
  }).sort((a, b) => a.name.localeCompare(b.name, "ar"));
  return NextResponse.json({ ok: true, supervisors, teachers });
}

export async function POST(request: Request) {
  if (!await requireSession("admin")) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const body = await request.json();
    const name = String(body?.name || "").trim();
    const username = String(body?.username || name).trim();
    const password = String(body?.password || "");
    const subjectIds = [...new Set((Array.isArray(body?.subjectIds) ? body.subjectIds : []).map(String).filter(Boolean))];
    const teacherIds = [...new Set((Array.isArray(body?.teacherIds) ? body.teacherIds : []).map(String).filter(Boolean))];
    const permissionLevel = ["view", "comment", "manage"].includes(body?.permissionLevel) ? body.permissionLevel : "view";
    if (name.length < 3 || username.length < 3 || password.length < 8 || !subjectIds.length) return NextResponse.json({ ok: false, message: "أكمل الاسم واسم الدخول والرقم السري واختر مادة واحدة على الأقل" }, { status: 400 });
    const normalizedUsername = normalizeUsername(username);
    const duplicate = await adminDb().collection("portalV2Users").where("normalizedUsername", "==", normalizedUsername).limit(1).get();
    if (!duplicate.empty) return NextResponse.json({ ok: false, message: "اسم الدخول مستخدم مسبقًا" }, { status: 409 });
    const now = new Date().toISOString();
    const reference = adminDb().collection("portalV2Users").doc();
    await reference.set({ username, normalizedUsername, name, role: "supervisor", passwordHash: hashPassword(password), active: true, subjectIds, teacherIds, permissionLevel, createdAt: now, updatedAt: now });
    return NextResponse.json({ ok: true, id: reference.id }, { status: 201 });
  } catch (error) {
    console.error("create supervisor failed", error);
    return NextResponse.json({ ok: false, message: "تعذر إنشاء حساب المشرف" }, { status: 500 });
  }
}
