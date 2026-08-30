import { NextResponse } from "next/server";
import { isSubjectKey } from "../../../../../lib/subject-config";
import { normalizeAssignments } from "../../../../../lib/teacher-assignments";
import { normalizeClass } from "../../../../../lib/unified-roster";
import { adminDb } from "../../../../../lib/server/firebase-admin";
import { requireSession } from "../../../../../lib/server/portal-auth";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIMEOUT_MS = 5000;

function safeId(value: string) {
  return encodeURIComponent(value).replace(/%/g, "_");
}

async function withTimeout<T>(promise: Promise<T>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("attendance_exists_timeout")), TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function GET(request: Request) {
  const session = await requireSession("teacher");
  if (!session?.user) {
    return NextResponse.json({ ok: false, exists: false, message: "انتهت جلسة المعلم." }, { status: 401 });
  }

  const url = new URL(request.url);
  const subjectId = String(url.searchParams.get("subjectId") || "").split("--")[0];
  const className = normalizeClass(url.searchParams.get("className") || "");
  const date = String(url.searchParams.get("date") || "");

  if (!isSubjectKey(subjectId) || !className || !DATE_PATTERN.test(date)) {
    return NextResponse.json({ ok: false, exists: false, message: "بيانات التحقق غير مكتملة." }, { status: 400 });
  }

  const assignments = normalizeAssignments(session.user.assignments, session.user.subjectIds);
  if (!assignments.some(item => item.subjectId === subjectId)) {
    return NextResponse.json({ ok: false, exists: false, message: "المادة غير مسندة إلى الحساب." }, { status: 403 });
  }

  try {
    const reference = adminDb()
      .collection(`portalV2Data/${session.userId}/subjects/${subjectId}/attendance`)
      .doc(`${safeId(className)}_${date}`);
    const snapshot = await withTimeout(reference.get());
    return NextResponse.json(
      { ok: true, exists: snapshot.exists },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false, exists: false, unavailable: true, message: "تعذر التحقق من السجل السابق الآن." },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
