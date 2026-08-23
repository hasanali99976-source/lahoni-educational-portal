import { NextResponse } from "next/server";
import { adminDb } from "../../../../../lib/server/firebase-admin";
import { hashPassword } from "../../../../../lib/server/password";
import { requireSession } from "../../../../../lib/server/portal-auth";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await requireSession("admin")) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const { id } = await context.params;
    const body = await request.json();
    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (typeof body?.name === "string" && body.name.trim().length >= 3) patch.name = body.name.trim();
    if (typeof body?.active === "boolean") patch.active = body.active;
    if (Array.isArray(body?.subjectIds)) patch.subjectIds = [...new Set(body.subjectIds.map(String).filter(Boolean))];
    if (Array.isArray(body?.teacherIds)) patch.teacherIds = [...new Set(body.teacherIds.map(String).filter(Boolean))];
    if (["view", "comment", "manage"].includes(body?.permissionLevel)) patch.permissionLevel = body.permissionLevel;
    if (typeof body?.password === "string" && body.password.length >= 8) patch.passwordHash = hashPassword(body.password);
    await adminDb().collection("portalV2Users").doc(id).update(patch);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("update supervisor failed", error);
    return NextResponse.json({ ok: false, message: "تعذر تعديل حساب المشرف" }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  if (!await requireSession("admin")) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const { id } = await context.params;
    await adminDb().collection("portalV2Users").doc(id).delete();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("delete supervisor failed", error);
    return NextResponse.json({ ok: false, message: "تعذر حذف حساب المشرف" }, { status: 500 });
  }
}
