import { NextResponse } from "next/server";
import { isSubjectKey } from "../../../../../lib/subject-config";
import { normalizeAssignments } from "../../../../../lib/teacher-assignments";
import { normalizeClass } from "../../../../../lib/unified-roster";
import { adminDb } from "../../../../../lib/server/firebase-admin";
import { requireSession } from "../../../../../lib/server/portal-auth";

type AttendanceStatus = "present" | "absent" | "late" | "excused" | "escaped";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const VALID_STATUS = new Set<AttendanceStatus>(["present", "absent", "late", "excused", "escaped"]);
const TIMEOUT_MS = 8000;

function safeId(value: string) { return encodeURIComponent(value).replace(/%/g, "_"); }
function clean(value: unknown) { return String(value || "").trim(); }
function cleanRecords(value: unknown) {
  const result: Record<string, AttendanceStatus> = {};
  if (!value || typeof value !== "object") return result;
  Object.entries(value as Record<string, unknown>).forEach(([key, status]) => {
    const code = clean(key).toUpperCase();
    if (code && VALID_STATUS.has(status as AttendanceStatus)) result[code] = status as AttendanceStatus;
  });
  return result;
}
async function withTimeout<T>(promise: Promise<T>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([promise, new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error("attendance_timeout")), TIMEOUT_MS); })]); }
  finally { if (timer) clearTimeout(timer); }
}
async function context(request: Request, body?: Record<string, unknown>) {
  const session = await requireSession("teacher");
  if (!session?.user) return { error: NextResponse.json({ ok: false, message: "انتهت جلسة المعلم." }, { status: 401 }) };
  const url = new URL(request.url);
  const subjectId = clean(body?.subjectId ?? url.searchParams.get("subjectId")).split("--")[0];
  const className = normalizeClass(body?.className ?? url.searchParams.get("className") ?? "");
  const date = clean(body?.date ?? url.searchParams.get("date"));
  if (!isSubjectKey(subjectId) || !className || !DATE_PATTERN.test(date)) return { error: NextResponse.json({ ok: false, message: "بيانات الحضور غير مكتملة." }, { status: 400 }) };
  const assignments = normalizeAssignments(session.user.assignments, session.user.subjectIds);
  if (!assignments.some(item => item.subjectId === subjectId)) return { error: NextResponse.json({ ok: false, message: "المادة غير مسندة إلى الحساب." }, { status: 403 }) };
  const reference = adminDb().collection(`portalV2Data/${session.userId}/subjects/${subjectId}/attendance`).doc(`${safeId(className)}_${date}`);
  return { session, subjectId, className, date, reference };
}
export async function GET(request: Request) {
  const ctx = await context(request); if ("error" in ctx) return ctx.error;
  try {
    const snapshot = await withTimeout(ctx.reference.get());
    if (!snapshot.exists) return NextResponse.json({ ok: true, exists: false, records: {} }, { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } });
    const data = snapshot.data() as Record<string, unknown>;
    return NextResponse.json({ ok: true, exists: true, data: { ...data, class: ctx.className, date: ctx.date, records: cleanRecords(data.records) } }, { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } });
  } catch { return NextResponse.json({ ok: false, message: "تعذر تحميل سجل الحضور السحابي الآن." }, { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } }); }
}
export async function PUT(request: Request) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const ctx = await context(request, body); if ("error" in ctx) return ctx.error;
  const records = cleanRecords(body.records);
  const updatedAt = new Date().toISOString();
  const payload = { class: ctx.className, date: ctx.date, hijriDate: clean(body.hijriDate), records, teacherId: ctx.session.userId, teacherName: ctx.session.name || "", subjectKey: ctx.subjectId, subject: clean(body.subject), manualEdited: true, updatedAt, savedThroughApiAt: updatedAt };
  try { await withTimeout(ctx.reference.set(payload, { merge: true })); return NextResponse.json({ ok: true, data: payload }, { headers: { "Cache-Control": "no-store, max-age=0" } }); }
  catch { return NextResponse.json({ ok: false, message: "تعذر حفظ الحضور في السحابة الآن. بقيت النسخة المحلية محفوظة." }, { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } }); }
}
export async function DELETE(request: Request) {
  const ctx = await context(request); if ("error" in ctx) return ctx.error;
  try { await withTimeout(ctx.reference.delete()); return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store, max-age=0" } }); }
  catch { return NextResponse.json({ ok: false, message: "تعذر حذف سجل الحضور السحابي الآن." }, { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } }); }
}
