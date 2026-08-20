import { NextResponse } from "next/server";
import { adminDb } from "../../../../../lib/server/firebase-admin";
import { hashPassword } from "../../../../../lib/server/password";
import { requireSession } from "../../../../../lib/server/portal-auth";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await requireSession("admin")) return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await context.params;
  const body = await request.json();
  const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (typeof body.active === "boolean") update.active = body.active;
  if (typeof body.password === "string" && body.password.length >= 8) update.passwordHash = hashPassword(body.password);
  await adminDb().collection("portalV2Users").doc(id).update(update);
  return NextResponse.json({ ok: true });
}
