import "server-only";

import { adminDb } from "./firebase-admin";

type WorkKind = "attendance" | "grades" | "note" | "diagnostic" | "remedial" | "referral" | "timetable" | "gradePlan";
type WorkCounts = Partial<Record<WorkKind, number>>;
type PersistedAction = { kind: WorkKind; key: string; at: string };

const KINDS: WorkKind[] = ["attendance", "grades", "note", "diagnostic", "remedial", "referral", "timetable", "gradePlan"];
const CACHE_MS = 30 * 1000;
const SOURCE_TIMEOUT_MS = 7000;
// أكد صاحب البوابة أن الرصد لم يكتمل وأنه لم تُرسل إحالات فعلية قبل تفعيل هذا التحقق.
// لذلك أي سجل إحالة أقدم من هذه اللحظة يعد بيانات قديمة/تجريبية ولا يدخل المنافسة.
const VERIFIED_REFERRAL_START_MS = Date.parse("2026-09-05T20:34:00.000Z");

export type TeacherCompetitionRow = {
  teacherId: string;
  teacherName: string;
  active: boolean;
  accountCreatedAt: string;
  score: number;
  meaningfulActions: number;
  activeDays: number;
  diversity: number;
  counts: WorkCounts;
  firstActivityAt: string;
  lastActivityAt: string;
  dataComplete: boolean;
  readFailureCount: number;
  rank: number;
};

export type TeacherCompetitionResult = {
  period: string;
  scope: "lifetime";
  rows: TeacherCompetitionRow[];
  source: "persisted-lifetime-v7-referral-cutoff";
  rule: string;
  generatedAt: string;
  coverageStartAt: string;
  totalTeachers: number;
  activeTeachers: number;
  inactiveTeachers: number;
  readFailureCount: number;
  integrity: "verified" | "partial";
};

let lifetimeCache: { expiresAt: number; value: TeacherCompetitionResult } | null = null;
let lifetimeBuild: Promise<TeacherCompetitionResult> | null = null;

export function riyadhCompetitionParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return { period: `${values.year}-${values.month}`, day: `${values.year}-${values.month}-${values.day}` };
}

function asDateText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  try {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString();
    if (typeof value === "number") {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? "" : date.toISOString();
    }
    if (typeof value === "object") {
      const candidate = value as { toDate?: () => Date; seconds?: number; _seconds?: number };
      if (typeof candidate.toDate === "function") {
        const date = candidate.toDate();
        return Number.isNaN(date.getTime()) ? "" : date.toISOString();
      }
      const seconds = Number(candidate.seconds ?? candidate._seconds ?? NaN);
      if (Number.isFinite(seconds)) return new Date(seconds * 1000).toISOString();
    }
    const text = String(value).trim();
    if (!text) return "";
    const date = new Date(text);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text;
    return "";
  } catch {
    return "";
  }
}

function stamp(data: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = asDateText(data[key]);
    if (value) return value;
  }
  return "";
}

function sortTime(value: string) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
}

function latest(values: string[]) {
  return values.filter(Boolean).sort((a, b) => sortTime(b) - sortTime(a))[0] || "";
}

function earliest(values: string[]) {
  return values.filter(Boolean).sort((a, b) => sortTime(a) - sortTime(b))[0] || "";
}

function dayFor(value: unknown) {
  const text = asDateText(value);
  if (!text) return "";
  const date = new Date(text);
  if (!Number.isNaN(date.getTime())) return riyadhCompetitionParts(date).day;
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : "";
}

function minuteBucket(value: unknown) {
  const text = asDateText(value);
  if (!text) return "";
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text.slice(0, 16);
  date.setSeconds(0, 0);
  return date.toISOString();
}

function subjectIdsOf(data: Record<string, unknown>) {
  const ids = new Set<string>();
  if (Array.isArray(data.subjectIds)) {
    data.subjectIds.forEach(value => {
      const id = String(value || "").split("--")[0];
      if (id) ids.add(id);
    });
  }
  if (Array.isArray(data.assignments)) {
    data.assignments.forEach(value => {
      if (!value || typeof value !== "object") return;
      const id = String((value as Record<string, unknown>).subjectId || "").split("--")[0];
      if (id) ids.add(id);
    });
  }
  return [...ids].filter(Boolean);
}

async function withTimeout<T>(promise: Promise<T>, milliseconds = SOURCE_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("competition_source_timeout")), milliseconds);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function safeCollection(path: string, failures: string[]) {
  try {
    return await withTimeout(adminDb().collection(path).get());
  } catch (error) {
    failures.push(path);
    console.warn("competition persisted source unavailable", path, error);
    return null;
  }
}

function hasObjectContent(value: unknown) {
  return Boolean(value && typeof value === "object" && Object.keys(value as Record<string, unknown>).length);
}

function dedupe(actions: PersistedAction[]) {
  const seen = new Set<string>();
  return actions.filter(action => {
    const signature = `${action.kind}:${action.key}`;
    if (!action.at || !action.key || seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

function verifiedForAccount(action: PersistedAction, accountCreatedAt: string) {
  const actionTime = sortTime(action.at);
  if (!actionTime) return false;
  const createdTime = sortTime(accountCreatedAt);
  if (!createdTime) return true;
  return actionTime >= createdTime;
}

async function persistedSubjectActions(teacherId: string, subjectId: string, failures: string[]) {
  const root = `portalV2Data/${teacherId}/subjects/${subjectId}`;
  const actions: PersistedAction[] = [];
  const [students, attendance, diagnostics, results, referrals, timetable] = await Promise.all([
    safeCollection(`${root}/students`, failures),
    safeCollection(`${root}/attendance`, failures),
    safeCollection(`${root}/diagnostics`, failures),
    safeCollection(`${root}/diagnosticResults`, failures),
    safeCollection(`${root}/counselorReferrals`, failures),
    safeCollection(`${root}/timetable`, failures),
  ]);

  students?.docs.forEach(document => {
    const data = document.data() as Record<string, unknown>;
    const className = String(data.className || data.class || "class");
    const history = Array.isArray(data.gradeHistory) ? data.gradeHistory as Array<Record<string, unknown>> : [];

    history.forEach(event => {
      const at = stamp(event, ["changedAt", "updatedAt", "createdAt"]);
      if (!at) return;
      const plan = String(event.planId || "plan");
      const section = String(event.sectionId || event.sectionLabel || className || "section");
      const item = String(event.itemId || event.itemLabel || "item");
      actions.push({
        kind: "grades",
        key: `${subjectId}|${plan}|${section}|${item}|${minuteBucket(at)}`,
        at,
      });
    });

    if (!history.length) {
      const gradeAt = stamp(data, ["gradeHistoryUpdatedAt", "gradePlanUpdatedAt", "gradesUpdatedAt"]);
      if (gradeAt) {
        actions.push({
          kind: "grades",
          key: `${subjectId}|${className}|legacy|${minuteBucket(gradeAt)}`,
          at: gradeAt,
        });
      }
    }

    const notes = Array.isArray(data.teacherNotes) ? data.teacherNotes as Array<Record<string, unknown>> : [];
    notes.forEach((note, index) => {
      const at = stamp(note, ["createdAt", "updatedAt"]);
      if (!at) return;
      const noteId = String(note.id || `${subjectId}|${document.id}|${at}|${index}`);
      actions.push({ kind: "note", key: `${subjectId}|${document.id}|${noteId}`, at });
    });
  });

  attendance?.docs.forEach(document => {
    const data = document.data() as Record<string, unknown>;
    if (data.autoSaved === true && data.manualEdited !== true && data.teacherConfirmed !== true) return;
    const at = stamp(data, ["manualEditedAt", "confirmedAt", "savedThroughApiAt", "updatedAt", "savedAt", "date"]);
    if (!at) return;
    const date = String(data.date || dayFor(at));
    const className = String(data.className || data.class || "class");
    if (!date) return;
    actions.push({ kind: "attendance", key: `${subjectId}|${className}|${date}`, at });
  });

  diagnostics?.docs.forEach(document => {
    const data = document.data() as Record<string, unknown>;
    const at = stamp(data, ["publishedAt", "createdAt", "updatedAt"]);
    if (!at) return;
    actions.push({ kind: "diagnostic", key: `${subjectId}|${document.id}`, at });
  });

  results?.docs.forEach(document => {
    const data = document.data() as Record<string, unknown>;
    const teacherPlan = String(data.teacherPlan || data.remedialPlan || "").trim();
    if (!teacherPlan) return;
    const at = stamp(data, ["teacherPlanUpdatedAt", "updatedAt", "createdAt"]);
    if (!at) return;
    actions.push({ kind: "remedial", key: `${subjectId}|${document.id}|${minuteBucket(at)}`, at });
  });

  referrals?.docs.forEach(document => {
    const data = document.data() as Record<string, unknown>;
    const at = stamp(data, ["createdAt"]);
    const studentId = String(data.studentId || "").trim();
    const reason = String(data.reason || "").trim();
    const status = String(data.status || "").trim();
    if (!at || !studentId || !reason || !status || sortTime(at) < VERIFIED_REFERRAL_START_MS) return;

    // شاشة الإحالة تنشئ وثيقة لكل طالب في الدفعة الواحدة بنفس createdAt.
    // لذلك نحسب ضغطة الإرسال نفسها مرة واحدة مهما كان عدد الطلاب المختارين.
    const teacherName = String(data.teacherName || "").trim();
    actions.push({
      kind: "referral",
      key: `${subjectId}|batch|${at}|${teacherName}|${reason}`,
      at,
    });
  });

  timetable?.docs.forEach(document => {
    const data = document.data() as Record<string, unknown>;
    if (!hasObjectContent(data.lessons) && !hasObjectContent(data.schedule)) return;
    const at = stamp(data, ["savedThroughApiAt", "updatedAt", "createdAt"]);
    if (!at) return;
    actions.push({ kind: "timetable", key: `${subjectId}|${document.id}`, at });
  });

  return actions;
}

async function persistedTeacherActions(teacherId: string, subjectIds: string[], failures: string[]) {
  const actions = (await Promise.all(subjectIds.map(subjectId => persistedSubjectActions(teacherId, subjectId, failures)))).flat();
  const planVersions = await safeCollection(`portalV2Data/${teacherId}/gradePlanVersions`, failures);
  planVersions?.docs.forEach(document => {
    const data = document.data() as Record<string, unknown>;
    const at = stamp(data, ["activatedAt", "createdAt", "updatedAt"]);
    if (!at) return;
    actions.push({ kind: "gradePlan", key: document.id, at });
  });
  return dedupe(actions);
}

async function buildLifetimeCompetition(): Promise<TeacherCompetitionResult> {
  const database = adminDb();
  const usersSnapshot = await withTimeout(database.collection("portalV2Users").get());

  const historicalSubjects = new Map<string, Set<string>>();
  let assignmentHistoryUnavailable = false;
  try {
    const assignmentSnapshot = await withTimeout(database.collection("portalV2Assignments").get());
    assignmentSnapshot.docs.forEach(document => {
      const data = document.data() as Record<string, unknown>;
      const teacherId = String(data.teacherId || "");
      const subjectId = String(data.subjectId || "").split("--")[0];
      if (!teacherId || !subjectId) return;
      const current = historicalSubjects.get(teacherId) || new Set<string>();
      current.add(subjectId);
      historicalSubjects.set(teacherId, current);
    });
  } catch (error) {
    assignmentHistoryUnavailable = true;
    console.warn("competition assignment history unavailable", error);
  }

  const teachers = usersSnapshot.docs
    .map(document => ({ id: document.id, data: document.data() as Record<string, unknown> }))
    .filter(row => String(row.data.role || "") === "teacher")
    .map(row => {
      const subjectIds = new Set(subjectIdsOf(row.data));
      historicalSubjects.get(String(row.id))?.forEach(subjectId => subjectIds.add(subjectId));
      return {
        id: String(row.id),
        name: String(row.data.name || row.data.username || "المعلم"),
        active: row.data.active !== false,
        // لا نستخدم updatedAt كتاريخ إنشاء؛ لأن تعديل حساب قديم لاحقًا لا يجعله حسابًا جديدًا.
        createdAt: stamp(row.data, ["createdAt"]),
        subjectIds: [...subjectIds],
      };
    });

  const rows = await Promise.all(teachers.map(async teacher => {
    const failures: string[] = [];
    if (assignmentHistoryUnavailable) failures.push("portalV2Assignments");
    const storedActions = await persistedTeacherActions(teacher.id, teacher.subjectIds, failures);
    const actions = dedupe(storedActions.filter(action => verifiedForAccount(action, teacher.createdAt)));
    const counts: WorkCounts = {};
    const days = new Set<string>();
    const timestamps: string[] = [];

    actions.forEach(action => {
      counts[action.kind] = Number(counts[action.kind] || 0) + 1;
      const day = dayFor(action.at);
      if (day) days.add(day);
      timestamps.push(action.at);
    });

    const meaningfulActions = KINDS.reduce((sum, kind) => sum + Number(counts[kind] || 0), 0);
    const diversity = KINDS.filter(kind => Number(counts[kind] || 0) > 0).length;

    return {
      teacherId: teacher.id,
      teacherName: teacher.name,
      active: teacher.active,
      accountCreatedAt: teacher.createdAt,
      score: meaningfulActions,
      meaningfulActions,
      activeDays: days.size,
      diversity,
      counts,
      firstActivityAt: earliest(timestamps),
      lastActivityAt: latest(timestamps),
      dataComplete: failures.length === 0,
      readFailureCount: failures.length,
    };
  }));

  // الترتيب يطابق الأرقام الظاهرة في الشاشة حرفيًا:
  // الأعمال الموثقة أولًا، ثم أيام النشاط، ثم تنوع العمل، ثم الأحدث نشاطًا.
  rows.sort((a, b) =>
    b.meaningfulActions - a.meaningfulActions ||
    b.activeDays - a.activeDays ||
    b.diversity - a.diversity ||
    sortTime(b.lastActivityAt) - sortTime(a.lastActivityAt) ||
    a.teacherName.localeCompare(b.teacherName, "ar"),
  );

  const ranked: TeacherCompetitionRow[] = rows.map((row, index) => ({ ...row, rank: index + 1 }));
  const readFailureCount = ranked.reduce((sum, row) => sum + row.readFailureCount, 0);
  const coverageStartAt = earliest(ranked.flatMap(row => [row.accountCreatedAt, row.firstActivityAt]).filter(Boolean));
  const generatedAt = new Date().toISOString();

  return {
    period: "منذ تأسيس البوابة",
    scope: "lifetime",
    rows: ranked,
    source: "persisted-lifetime-v7-referral-cutoff",
    rule: "الترتيب حسب عدد الأعمال الموثقة أولًا، ثم أيام النشاط، ثم تنوع العمل، ثم أحدث نشاط. لا تُحسب عملية بلا تاريخ إثبات، ولا أي عمل سابق لتاريخ إنشاء الحساب عند توفره. سجلات الإحالة القديمة/التجريبية قبل تفعيل التحقق لا تدخل المنافسة، ومن الآن تُحسب دفعة الإحالة الفعلية الواحدة عملية واحدة مهما كان عدد الطلاب فيها. الحضور التلقائي والبيانات الافتراضية لا تُحتسب.",
    generatedAt,
    coverageStartAt,
    totalTeachers: ranked.length,
    activeTeachers: ranked.filter(row => row.active).length,
    inactiveTeachers: ranked.filter(row => !row.active).length,
    readFailureCount,
    integrity: readFailureCount === 0 ? "verified" : "partial",
  };
}

export async function buildTeacherCompetition(options: { force?: boolean } = {}) {
  const now = Date.now();
  if (!options.force && lifetimeCache && lifetimeCache.expiresAt > now) return lifetimeCache.value;
  if (lifetimeBuild) return lifetimeBuild;

  lifetimeBuild = buildLifetimeCompetition()
    .then(value => {
      lifetimeCache = { value, expiresAt: Date.now() + CACHE_MS };
      return value;
    })
    .finally(() => {
      lifetimeBuild = null;
    });

  return lifetimeBuild;
}
