import { NextResponse } from "next/server";
import { requireSession } from "../../../../../lib/server/portal-auth";
import { adminDb } from "../../../../../lib/server/firebase-admin";

export const runtime = "nodejs";
const validSubjects = new Set(["history", "critical-thinking", "geography", "social-studies"]);

function refFor(teacherId: string, subjectKey: string) {
  if (!/^[a-z0-9-]{1,64}$/i.test(subjectKey)) throw new Error("invalid_subject");
  return adminDb().doc(`portalV2Data/${teacherId}/subjects/${subjectKey}/portfolio/profile`);
}

export async function GET(request: Request) {
  const session = await requireSession("teacher");
  if (!session?.userId) return NextResponse.json({ ok: false, message: "انتهت جلسة المعلم" }, { status: 401 });
  const subjectKey = new URL(request.url).searchParams.get("subjectKey") || "history";
  try {
    const snap = await refFor(session.userId, subjectKey).get();
    return NextResponse.json({ ok: true, data: snap.exists ? snap.data() : null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("portfolio read failed", error);
    return NextResponse.json({ ok: false, message: "تعذر استرجاع الملف السحابي" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireSession("teacher");
  if (!session?.userId) return NextResponse.json({ ok: false, message: "انتهت جلسة المعلم" }, { status: 401 });
  try {
    const body = await request.json() as { subjectKey?: string; form?: Record<string, unknown>; deletedIds?: string[] };
    const subjectKey = String(body.subjectKey || "history");
    const input = body.form;
    if (!input || typeof input !== "object" || !Array.isArray(input.evidence) || input.evidence.length > 1000) {
      return NextResponse.json({ ok: false, message: "بيانات الملف غير صحيحة" }, { status: 400 });
    }
    const ref = refFor(session.userId, subjectKey);
    const saved = await adminDb().runTransaction(async (tx) => {
      const existing = await tx.get(ref);
      const previous = existing.exists ? existing.data() || {} : {};
      const previousEvidence = Array.isArray(previous.evidence) ? previous.evidence : [];
      const incoming = input.evidence as Array<Record<string, unknown>>;
      const deleted = new Set(Array.isArray(body.deletedIds) ? body.deletedIds.filter((id): id is string => typeof id === "string") : []);
      const merged = new Map<string, Record<string, unknown>>();
      for (const item of previousEvidence) {
        if (item && typeof item.id === "string" && !deleted.has(item.id)) merged.set(item.id, item);
      }
      for (const item of incoming) {
        if (!item || typeof item.id !== "string" || deleted.has(item.id)) continue;
        const old = merged.get(item.id);
        const oldAttachments = Array.isArray(old?.attachments) ? old.attachments : [];
        const newAttachments = Array.isArray(item.attachments) ? item.attachments : [];
        const urls = new Set<string>();
        const attachments = [...oldAttachments, ...newAttachments].filter((attachment) => {
          if (!attachment || typeof attachment.url !== "string" || urls.has(attachment.url)) return false;
          urls.add(attachment.url);
          return true;
        });
        merged.set(item.id, { ...old, ...item, attachments, fileData: item.fileData || old?.fileData || "" });
      }
      const data = {
        ...previous, ...input, evidence: [...merged.values()],
        teacherId: session.userId, teacherName: session.name || "",
        subjectKey, updatedAt: new Date().toISOString(),
      };
      tx.set(ref, data, { merge: true });
      return data;
    });
    return NextResponse.json({ ok: true, data: saved }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("portfolio save failed", error);
    return NextResponse.json({ ok: false, message: "فشل الحفظ السحابي، ولم تُحذف الملفات السابقة" }, { status: 500 });
  }
}
