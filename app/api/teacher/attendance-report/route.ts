import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { requireSession } from "../../../../lib/server/portal-auth";
import { normalizeAssignments } from "../../../../lib/teacher-assignments";
import { isSubjectKey } from "../../../../lib/subject-config";
import { canonicalClassName, gradeNumber, sectionNumber } from "../../../../lib/school-roster";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;
const REPORT_CACHE_TTL_MS = 15 * 1000;
type ReportRow = Record<string, unknown> & { id: string };
const reportCache = new Map<string, { expiresAt: number; rows: ReportRow[] }>();
const reportInflight = new Map<string, Promise<ReportRow[]>>();

function validDate(value: string) {
  return DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`));
}
function inclusiveDays(from: string, to: string) {
  return Math.floor((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / DAY_MS) + 1;
}
function normalizedClass(value: unknown) {
  const raw = String(value || "").trim();
  const grade = gradeNumber(raw);
  const section = sectionNumber(undefined, raw);
  return grade && section ? canonicalClassName(grade, section) : raw;
}
async function readReport(key: string, query: FirebaseFirestore.Query) {
  const now = Date.now();
  const cached = reportCache.get(key);
  if (cached && cached.expiresAt > now) return cached.rows;
  const running = reportInflight.get(key);
  if (running) return running;
  const promise = query.get().then(snapshot => {
    const rows = snapshot.docs.map(document => {
      const data = document.data() as Record<string, unknown>;
      return { id: document.id, ...data, class: normalizedClass(data.class || data.className) };
    });
    reportCache.set(key, { expiresAt: Date.now() + REPORT_CACHE_TTL_MS, rows });
    return rows;
  }).finally(() => reportInflight.delete(key));
  reportInflight.set(key, promise);
  return promise;
}

export async function GET(request: Request) {
  const session = await requireSession("teacher");
  if (!session?.user) return NextResponse.json({ ok: false, message: "انتهت جلسة المعلم." }, { status: 401 });
  const url = new URL(request.url);
  const subjectId = String(url.searchParams.get("subjectId") || "").split("--")[0];
  const mode = url.searchParams.get("mode") === "daily" ? "daily" : "range";
  if (!isSubjectKey(subjectId)) return NextResponse.json({ ok: false, message: "المادة غير صحيحة." }, { status: 400 });
  const assignments = normalizeAssignments(session.user.assignments, session.user.subjectIds);
  if (!assignments.some(item => item.subjectId === subjectId)) return NextResponse.json({ ok: false, message: "المادة غير مسندة إلى الحساب." }, { status: 403 });

  const collection = adminDb().collection(`portalV2Data/${session.userId}/subjects/${subjectId}/attendance`);
  let query: FirebaseFirestore.Query = collection;
  let cacheKey = `${session.userId}:${subjectId}:${mode}`;
  if (mode === "daily") {
    const date = String(url.searchParams.get("date") || "");
    if (!validDate(date)) return NextResponse.json({ ok: false, message: "تاريخ التقرير غير صحيح." }, { status: 400 });
    query = collection.where("date", "==", date);
    cacheKey += `:${date}`;
  } else {
    const from = String(url.searchParams.get("from") || "");
    const to = String(url.searchParams.get("to") || "");
    if (!validDate(from) || !validDate(to) || from > to || inclusiveDays(from, to) > 31) return NextResponse.json({ ok: false, message: "فترة التقرير غير صحيحة أو تتجاوز 31 يومًا." }, { status: 400 });
    query = collection.where("date", ">=", from).where("date", "<=", to);
    cacheKey += `:${from}:${to}`;
  }
  try {
    const attendance = await readReport(cacheKey, query);
    return NextResponse.json({ ok: true, attendance }, { headers: { "Cache-Control": "private, max-age=0, must-revalidate" } });
  } catch (error) {
    console.error("teacher attendance report read failed", error);
    return NextResponse.json({ ok: false, attendance: [], message: "تعذر تحميل سجل الحضور الآن." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
