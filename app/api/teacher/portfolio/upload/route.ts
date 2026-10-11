import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireSession } from "../../../../../lib/server/portal-auth";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "pdf", "doc", "docx", "ppt", "pptx"]);

export async function POST(request: Request) {
  const session = await requireSession("teacher");
  if (!session?.userId || !session.user) {
    return NextResponse.json({ ok: false, message: "انتهت جلسة المعلم. سجل الدخول مرة أخرى." }, { status: 401 });
  }
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, message: "لم يتم اختيار مرفق." }, { status: 400 });
    }
    const originalName = file.name.slice(0, 160);
    const extension = originalName.split(".").pop()?.toLowerCase() || "";
    if (!ALLOWED_EXTENSIONS.has(extension) || !file.size || file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ ok: false, message: "اختر صورة أو PDF أو ملف Office بحجم لا يتجاوز ١٠ ميجابايت." }, { status: 400 });
    }
    const { getStorage } = await import("firebase-admin/storage");
    const { adminDb } = await import("../../../../../lib/server/firebase-admin");
    adminDb(); // Initialize the existing server-side service account.
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET || "tahdheeb-history.firebasestorage.app";
    const bucket = getStorage().bucket(bucketName);
    const token = randomUUID();
    const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-90);
    const objectPath = `portfolio/${encodeURIComponent(session.userId)}/${randomUUID()}-${safeName}`;
    const object = bucket.file(objectPath);
    await object.save(Buffer.from(await file.arrayBuffer()), {
      resumable: false,
      contentType: file.type || "application/octet-stream",
      metadata: {
        metadata: { firebaseStorageDownloadTokens: token, teacherId: session.userId },
        cacheControl: "private, max-age=3600",
      },
    });
    const url = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucketName)}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`;
    return NextResponse.json({ ok: true, name: originalName, url }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("portfolio upload failed", error);
    return NextResponse.json({ ok: false, message: "تعذر حفظ المرفق على التخزين السحابي. تحقق من تفعيل Firebase Storage وصلاحية حساب الخدمة." }, { status: 500 });
  }
}
