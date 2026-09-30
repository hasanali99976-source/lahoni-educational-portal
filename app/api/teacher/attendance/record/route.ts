import { NextResponse } from "next/server";
import { isSubjectKey } from "../../../../../lib/subject-config";
import { normalizeAssignments } from "../../../../../lib/teacher-assignments";
import { normalizeClass } from "../../../../../lib/unified-roster";
import { adminDb } from "../../../../../lib/server/firebase-admin";
import { requireSession } from "../../../../../lib/server/portal-auth";

type AttendanceStatus = "present" | "absent" | "late" | "excused" | "escaped";
type AttendanceData = Record<string, unknown>;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const VALID_STATUS = new Set<AttendanceStatus>(["present", "absent", "late", "excused", "escaped"]);
const TIMEOUT_MS = 8000;
const READ_TTL_MS = 2 * 60 * 1000;
const readCache = new Map<string, { at: number; exists: boolean; data?: AttendanceData }>();
const readInflight = new Map<string, Promise<{ exists: boolean; data?: AttendanceData }>>();

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
  const cacheKey = `${session.userId}:${subjectId}:${className}:${date}`;
  return { session, subjectId, className, date, reference, cacheKey };
}
async function readRecord(ctx: { reference: FirebaseFirestore.DocumentReference; cacheKey: string }) {
  const cached = readCache.get(ctx.cacheKey);
  if (cached && Date.now() - cached.at < READ_TTL_MS) return { exists: cached.exists, data: cached.data };
  const pending = readInflight.get(ctx.cacheKey);
  if (pending) return pending;
  const request = (async () => {
    const snapshot = await withTimeout(ctx.reference.get());
    const result = snapshot.exists ? { exists: true, data: snapshot.data() as AttendanceData } : { exists: false };
    readCache.set(ctx.cacheKey, { at: Date.now(), ...result });
    return result;
  })().finally(() => readInflight.delete(ctx.cacheKey));
  readInflight.set(ctx.cacheKey, request);
  return request;
}
function cacheSaved(cacheKey: string, payload: AttendanceData) { readCache.set(cacheKey, { at: Date.now(), exists: true, data: payload }); }
function invalidate(cacheKey: string) { readCache.delete(cacheKey); }

export async function GET(request: Request) {
  const ctx = await context(request); if ("error" in ctx) return ctx.error;
  try {
    const snapshot = await readRecord(ctx);
    if (!snapshot.exists) return NextResponse.json({ ok: true, exists: false, records: {} }, { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" } });
    const data = snapshot.data || {};
    return NextResponse.json({ ok: true, exists: true, data: { ...data, class: ctx.className, date: ctx.date, records: cleanRecords(data.records) } }, { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" } });
  } catch { return NextResponse.json({ ok: false, message: "تعذر تحميل سجل الحضور السحابي الآن." }, { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } }); }
}
export async function PUT(request: Request) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const ctx = await context(request, body); if ("error" in ctx) return ctx.error;
  const records = cleanRecords(body.records);
  const updatedAt = new Date().toISOString();
  const rawPeriod = Number(body.period || 0); const period = Number.isFinite(rawPeriod) && rawPeriod > 0 ? rawPeriod : null;
  const payload = { class: ctx.className, date: ctx.date, hijriDate: clean(body.hijriDate), records, period, teacherId: ctx.session.userId, teacherName: ctx.session.name || "", subjectKey: ctx.subjectId, subject: clean(body.subject), manualEdited: true, updatedAt, savedThroughApiAt: updatedAt };
  try { await withTimeout(ctx.reference.set(payload, { merge: true })); cacheSaved(ctx.cacheKey, payload); return NextResponse.json({ ok: true, data: payload }, { headers: { "Cache-Control": "no-store, max-age=0" } }); }
  catch { return NextResponse.json({ ok: false, message: "تعذر حفظ الحضور في السحابة الآن. بقيت النسخة المحلية محفوظة." }, { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } }); }
}
export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const ctx = await context(request, body); if ("error" in ctx) return ctx.error;
  const studentCode = clean(body.studentCode).toUpperCase();
  const status = body.status as AttendanceStatus;
  if (!studentCode || !VALID_STATUS.has(status)) return NextResponse.json({ ok: false, message: "حالة الطالب غير صحيحة." }, { status: 400 });
  const updatedAt = new Date().toISOString();
  const rawPeriod = Number(body.period || 0); const period = Number.isFinite(rawPeriod) && rawPeriod > 0 ? rawPeriod : null;
  try {
    let saved: AttendanceData = {};
    await withTimeout(adminDb().runTransaction(async tx => {
      const snapshot = await tx.get(ctx.reference);
      const previous = snapshot.exists ? cleanRecords(snapshot.data()?.records) : {};
      const records = { ...previous, [studentCode]: status };
      saved = { ...(snapshot.exists ? snapshot.data() : {}), class: ctx.className, date: ctx.date, records, period: period || snapshot.data()?.period || null, teacherId: ctx.session.userId, teacherName: ctx.session.name || "", subjectKey: ctx.subjectId, manualEdited: true, updatedAt, savedThroughApiAt: updatedAt };
      tx.set(ctx.reference, saved, { merge: true });
    }));
    cacheSaved(ctx.cacheKey, saved);
    return NextResponse.json({ ok: true, studentCode, status, updatedAt }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch { invalidate(ctx.cacheKey); return NextResponse.json({ ok: false, message: "تعذر مزامنة حالة الطالب سحابيًا الآن." }, { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } }); }
}

export async function DELETE(request: Request) {
  const ctx = await context(request); if ("error" in ctx) return ctx.error;
  try { await withTimeout(ctx.reference.delete()); readCache.set(ctx.cacheKey, { at: Date.now(), exists: false }); return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store, max-age=0" } }); }
  catch { return NextResponse.json({ ok: false, message: "تعذر حذف سجل الحضور السحابي الآن." }, { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } }); }
}
