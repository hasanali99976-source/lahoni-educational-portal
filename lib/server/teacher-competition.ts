import "server-only";

import { adminDb } from "./firebase-admin";

type WorkKind = "attendance" | "grades" | "note" | "diagnostic" | "remedial" | "referral" | "timetable" | "gradePlan";
type WorkCounts = Partial<Record<WorkKind, number>>;
type PersistedAction = { kind: WorkKind; key: string; at: string };

const KINDS: WorkKind[] = ["attendance", "grades", "note", "diagnostic", "remedial", "referral", "timetable", "gradePlan"];
const CACHE_MS = 2 * 60 * 1000;
const SOURCE_TIMEOUT_MS = 7000;

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
  source: "persisted-lifetime-v5";
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
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
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

function dayFor(value: unknown) {
  const text = asDateText(value);
  if (!text) return "";
  const date = new Date(text);
  if (!Number.isNaN(date.getTime())) return riyadhCompetitionParts(date).day;
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : "";
}

function minuteBucket(value: unknown) {
  const text = asDateText(value);
  if (!text) return "unknown";
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text.slice(0, 16);
  date.setSeconds(0, 0);
  return date.toISOString();
}

function sortTime(value: string) {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function latest(values: string[]) {
  return values.filter(Boolean).sort((a, b) => sortTime(b) - sortTime(a))[0] || "";
}

function earliest(values: string[]) {
  return values.filter(Boolean).sort((a, b) => sortTime(a) - sortTime(b))[0] || "";
}

function subjectIdsOf(data: Record<string, unknown>) {
  const ids = new Set<string>();
  if (Array.isArray(data.subjectIds)) data.subjectIds.forEach(value => {
    const id = String(value || "").split("--")[0];
    if (id) ids.add(id);
  });
  if (Array.isArray(data.assignments)) data.assignments.forEach(value => {
    if (!value || typeof value !== "object") return;
    const id = String((value as Record<string, unknown>).subjectId || "").split("--")[0];
    if (id) ids.add(id);
  });
  return [...ids].filter(Boolean);
}

function stamp(data: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = asDateText(data[key]);
    if (value) return value;
  }
  return "";
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

function dedupe(actions: PersistedAction[]) {
  const seen = new Set<string>();
  return actions.filter(action => {
    const signature = `${action.kind}:${action.key}`;
    if (!action.key || seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

function hasObjectContent(value: unknown) {
  return Boolean(value && typeof value === "object" && Object.keys(value as Record<string, unknown>).length);
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
      const plan = String(event.planId || "plan");
      const section = String(event.sectionId || event.sectionLabel || className || "section");
      const item = String(event.itemId || event.itemLabel || "item");
      actions.push({
        kind: "grades",
        key: `${subjectId}|${plan}|${section}|${item}|${at || String(event.version || "saved")}`,
        at,
      });
    });

    // قبل إنشاء gradeHistory كانت عملية رصد الصف تظهر على عدة طلاب. تجميعها بالدقيقة يمنع
    // تحويل حفظ واحد إلى عشرات النقاط بسبب عدد طلاب الفصل.
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
      const noteId = String(note.id || `${subjectId}|${document.id}|${at || "legacy"}|${index}`);
      actions.push({ kind: "note", key: `${subjectId}|${document.id}|${noteId}`, at });
    });
  });

  attendance?.docs.forEach(document => {
    const data = document.data() as Record<string, unknown>;
    // الحضور الافتراضي التلقائي لا يعد عملاً للمعلم. السجلات اليدوية/المؤكدة، وكذلك السجلات
    // التاريخية التي لم تكن تحمل وسم autoSaved، تبقى محتسبة مرة واحدة لليوم والفصل.
    if (data.autoSaved === true && data.manualEdited !== true && data.teacherConfirmed !== true) return;
    const at = stamp(data, ["manualEditedAt", "confirmedAt", "savedThroughApiAt", "updatedAt", "savedAt", "date"]);
    const date = String(data.date || dayFor(at) || document.id || "date");
    const className = String(data.className || data.class || "class");
    actions.push({ kind: "attendance", key: `${subjectId}|${className}|${date}`, at });
  });

  diagnostics?.docs.forEach(document => {
    const data = document.data() as Record<string, unknown>;
    const at = stamp(data, ["publishedAt", "createdAt", "updatedAt"]);
    actions.push({ kind: "diagnostic", key: `${subjectId}|${document.id}`, at });
  });

  results?.docs.forEach(document => {
    const data = document.data() as Record<string, unknown>;
    const hasPlan = Boolean(String(data.teacherPlan || data.aiPlan || data.remedialPlan || "").trim());
    if (!hasPlan) return;
    const at = stamp(data, ["teacherPlanUpdatedAt", "aiPlanUpdatedAt", "updatedAt", "createdAt"]);
    actions.push({ kind: "remedial", key: `${subjectId}|${document.id}`, at });
  });

  referrals?.docs.forEach(document => {
    const data = document.data() as Record<string, unknown>;
    const at = stamp(data, ["createdAt", "updatedAt"]);
    actions.push({ kind: "referral", key: `${subjectId}|${document.id}`, at });
  });

  timetable?.docs.forEach(document => {
    const data = document.data() as Record<string, unknown>;
    if (!hasObjectContent(data.lessons) && !hasObjectContent(data.schedule) && !data.savedThroughApiAt && !data.updatedAt) return;
    const at = stamp(data, ["savedThroughApiAt", "updatedAt", "createdAt"]);
    // الجدول وثيقة حالية قابلة للاستبدال؛ لذلك يحتسب وجود جدول محفوظ مرة واحدة لكل مادة
    // بدل احتساب كل ضغط زر سابق لا يمكن التحقق منه من الوثيقة الحالية.
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
    actions.push({ kind: "gradePlan", key: document.id, at });
  });
  return dedupe(actions);
}

async function buildLifetimeCompetition(): Promise<TeacherCompetitionResult> {
  const database = adminDb();
  const usersSnapshot = await withTimeout(database.collection("portalV2Users").get());

  // نضم تاريخ التكليفات القديمة إلى المواد الحالية حتى لا تختفي أعمال مادة سابقة بمجرد تعديل
  // إسناد المعلم لاحقًا. فشل هذا المصدر لا يولد نقاطًا تقديرية بل يخفض حالة سلامة القراءة.
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
        createdAt: stamp(row.data, ["createdAt", "updatedAt"]),
        subjectIds: [...subjectIds],
      };
    });

  const rows = await Promise.all(teachers.map(async teacher => {
    const failures: string[] = [];
    if (assignmentHistoryUnavailable) failures.push("portalV2Assignments");
    const actions = await persistedTeacherActions(teacher.id, teacher.subjectIds, failures);
    const counts: WorkCounts = {};
    const days = new Set<string>();
    const timestamps: string[] = [];

    actions.forEach(action => {
      counts[action.kind] = Number(counts[action.kind] || 0) + 1;
      const day = dayFor(action.at);
      if (day) days.add(day);
      if (action.at) timestamps.push(action.at);
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

  rows.sort((a, b) =>
    b.score - a.score ||
    b.activeDays - a.activeDays ||
    b.diversity - a.diversity ||
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
    source: "persisted-lifetime-v5",
    rule: "كل نقطة تمثل وحدة عمل تعليمية مميزة يمكن إثباتها من البيانات المحفوظة نفسها. لا نحسب الدخول أو فتح الصفحات أو النقرات، ولا نستخدم سجل التتبع القديم لرفع النقاط. رصد الصف الكامل يجمع كعملية واحدة بدل ضربه في عدد الطلاب، والحضور التلقائي لا يحتسب.",
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
