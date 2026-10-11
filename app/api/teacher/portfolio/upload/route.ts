import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireSession } from "../../../../../lib/server/portal-auth";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "pdf", "doc", "docx", "ppt", "pptx"]);
const BLOB_STORE_ID = "BH10YY8OtgXpvGsY";

function ownerPrefix(userId: string) {
  return `portfolio/${encodeURIComponent(userId)}/`;
}
function storageToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN missing");
  return token;
}

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
    const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-90);
    const pathname = `${ownerPrefix(session.userId)}${randomUUID()}-${safeName}`;
    const response = await fetch(`https://vercel.com/api/blob/?pathname=${encodeURIComponent(pathname)}`, {
      method: "PUT",
      headers: {
        authorization: `Bearer ${storageToken()}`,
        "x-vercel-blob-store-id": BLOB_STORE_ID,
        "x-api-version": "12",
        "x-vercel-blob-access": "private",
        "x-content-type": file.type || "application/octet-stream",
        "content-type": file.type || "application/octet-stream",
      },
      body: Buffer.from(await file.arrayBuffer()),
      signal: AbortSignal.timeout(25000),
      cache: "no-store",
    });
    if (!response.ok) {
      const details = await response.text().catch(() => "");
      console.error("portfolio blob upload failed", response.status, details.slice(0, 500));
      return NextResponse.json({ ok: false, message: `تعذر تخزين المرفق (رمز ${response.status}).` }, { status: 502 });
    }
    const saved = await response.json() as { pathname?: string };
    if (!saved.pathname || saved.pathname !== pathname) throw new Error("Blob returned an unexpected path");
    const url = `/api/teacher/portfolio/upload?path=${encodeURIComponent(pathname)}`;
    return NextResponse.json({ ok: true, name: originalName, url }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("portfolio upload failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, message: "تعذر حفظ المرفق في التخزين الخاص. حاول مجددًا." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const session = await requireSession("teacher");
  if (!session?.userId || !session.user) return new Response("Unauthorized", { status: 401 });
  const pathname = new URL(request.url).searchParams.get("path") || "";
  if (!pathname.startsWith(ownerPrefix(session.userId)) || pathname.includes("..") || pathname.length > 400) {
    return new Response("Forbidden", { status: 403 });
  }
  try {
    const url = `https://${BLOB_STORE_ID}.private.blob.vercel-storage.com/${pathname.split("/").map(encodeURIComponent).join("/")}`;
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${storageToken()}` },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok || !response.body) return new Response("File unavailable", { status: 404 });
    return new Response(response.body, {
      headers: {
        "Content-Type": response.headers.get("content-type") || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline",
      },
    });
  } catch {
    return new Response("File unavailable", { status: 502 });
  }
}
