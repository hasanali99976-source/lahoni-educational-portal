import "server-only";

import { adminDb } from "./firebase-admin";
import { TEACHER_WORK_ACTIVITY_COLLECTION } from "./teacher-work-activity";

type WorkKind = "attendance" | "grades" | "note" | "diagnostic" | "remedial" | "referral" | "timetable" | "gradePlan";
type WorkCounts = Partial<Record<WorkKind, number>>;
type TimedAction = { kind: WorkKind; key: string; at: string };

const KINDS: WorkKind[] = ["attendance", "grades", "note", "diagnostic", "remedial", "referral", "timetable", "gradePlan"];

export type TeacherCompetitionRow = {
  teacherId: string;
  teacherName: string;
  score: number;
  meaningfulActions: number;
  activeDays: number;
  diversity: number;
  counts: WorkCounts;
  lastActivityAt: string;
  rank: number;
};

export function riyadhCompetitionParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return { period: `${values.year}-${values.month}`, day: `${values.year}-${values.month}-${values.day}` };
}

function periodFor(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return "";
  const date = new Date(text);
  if (!Number.isNaN(date.getTime())) return riyadhCompetitionParts(date).period;
  return /^\d{4}-\d{2}/.test(text) ? text.slice(0, 7) : "";
}

function dayFor(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return "";
  const date = new Date(text);
  if (!Number.isNaN(date.getTime())) return riyadhCompetitionParts(date).day;
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : "";
}

function latest(values: string[]) {
  return values.filter(Boolean).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || "";
}

function subjectIdsOf(data: Record<string, unknown>) {
  const ids = new Set<string>();
  if (Array.isArray(data.subjectIds)) data.subjectIds.forEach(value => ids.add(String(value || "").split("--")[0]));
  if (Array.isArray(data.assignments)) data.assignments.forEach(value => {
    if (!value || typeof value !== "object") return;
    const id = String((value as Record<string, unknown>).subjectId || "").split("--")[0];
    if (id) ids.add(id);
  });
  return [...ids].filter(Boolean);
}

function stamp(data: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = String(data[key] || "").trim();
    if (value) return value;
  }
  return "";
}

async function safeCollection(path: string) {
  try { return await adminDb().collection(path).get(); }
  catch (error) { console.warn("competition source skipped", path, error); return null; }
}

function dedupe(actions: TimedAction[]) {
  const seen = new Set<string>();
  return actions.filter(action => {
    const signature = `${action.kind}:${action.key}`;
    if (!action.key || !action.at || seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

async function persistedSubjectActions(teacherId: string, subjectId: string, period: string) {
  const root = `portalV2Data/${teacherId}/subjects/${subjectId}`;
  const actions: TimedAction[] = [];
  const [students, attendance, diagnostics, results, referrals, timetable] = await Promise.all([
    safeCollection(`${root}/students`),
    safeCollection(`${root}/attendance`),
    safeCollection(`${root}/diagnostics`),
    safeCollection(`${root}/diagnosticResults`),
    safeCollection(`${root}/counselorReferrals`),
    safeCollection(`${root}/timetable`),
  ]);

  students?.docs.forEach(document => {
    const data = document.data() as Record<string, unknown>;
    const className = String(data.className || data.class || "class");
    const history = Array.isArray(data.gradeHistory) ? data.gradeHistory as Array<Record<string, unknown>> : [];
    history.forEach(event => {
      const at = stamp(event, ["changedAt", "updatedAt", "createdAt"]);
      if (!at || periodFor(at) !== period) return;
      // The grade recorder writes one shared changedAt for the whole save. Grouping by item + timestamp
      // makes a class-wide save one work unit instead of multiplying by number of students.
      const plan = String(event.planId || "plan");
      const section = String(event.sectionId || event.sectionLabel || "section");
      const item = String(event.itemId || event.itemLabel || "item");
      actions.push({ kind: "grades", key: `${subjectId}|${plan}|${section}|${item}|${at}`, at });
    });

    // Historical fallback: older grading saves may not have gradeHistory yet.
    const gradeAt = stamp(data, ["gradeHistoryUpdatedAt", "gradePlanUpdatedAt", "gradesUpdatedAt"]);
    if (gradeAt && periodFor(gradeAt) === period && !history.length) {
      actions.push({ kind: "grades", key: `${subjectId}|${className}|legacy|${gradeAt}`, at: gradeAt });
    }

    const notes = Array.isArray(data.teacherNotes) ? data.teacherNotes as Array<Record<string, unknown>> : [];
    notes.forEach((note, index) => {
      const at = stamp(note, ["createdAt", "updatedAt"]);
      if (!at || periodFor(at) !== period) return;
      actions.push({ kind: "note", key: String(note.id || `${subjectId}|${document.id}|${at}|${index}`), at });
    });
  });

  attendance?.docs.forEach(document => {
    const data = document.data() as Record<string, unknown>;
    // Automatic default presence is not teacher work.
    if (data.autoSaved === true && data.manualEdited !== true && data.teacherConfirmed !== true) return;
    const at = stamp(data, ["manualEditedAt", "confirmedAt", "updatedAt", "savedAt", "date"]);
    if (!at || periodFor(at) !== period) return;
    const date = String(data.date || dayFor(at));
    const className = String(data.className || data.class || document.id || "class");
    actions.push({ kind: "attendance", key: `${subjectId}|${className}|${date}`, at });
  });

  diagnostics?.docs.forEach(document => {
    const data = document.data() as Record<string, unknown>;
    const at = stamp(data, ["publishedAt", "createdAt", "updatedAt"]);
    if (at && periodFor(at) === period) actions.push({ kind: "diagnostic", key: `${subjectId}|${document.id}`, at });
  });

  results?.docs.forEach(document => {
    const data = document.data() as Record<string, unknown>;
    const hasPlan = Boolean(String(data.teacherPlan || data.aiPlan || data.remedialPlan || "").trim());
    if (!hasPlan) return;
    const at = stamp(data, ["teacherPlanUpdatedAt", "aiPlanUpdatedAt", "updatedAt", "createdAt"]);
    if (at && periodFor(at) === period) actions.push({ kind: "remedial", key: `${subjectId}|${document.id}`, at });
  });

  referrals?.docs.forEach(document => {
    const data = document.data() as Record<string, unknown>;
    const at = stamp(data, ["createdAt", "updatedAt"]);
    if (at && periodFor(at) === period) actions.push({ kind: "referral", key: `${subjectId}|${document.id}`, at });
  });

  timetable?.docs.forEach(document => {
    const data = document.data() as Record<string, unknown>;
    const at = stamp(data, ["savedThroughApiAt", "updatedAt", "createdAt"]);
    if (at && periodFor(at) === period) actions.push({ kind: "timetable", key: `${subjectId}|${document.id}|${dayFor(at)}`, at });
  });

  return actions;
}

async function persistedTeacherActions(teacherId: string, subjectIds: string[], period: string) {
  const database = adminDb();
  const actions = (await Promise.all(subjectIds.map(subjectId => persistedSubjectActions(teacherId, subjectId, period)))).flat();
  const planVersions = await safeCollection(`portalV2Data/${teacherId}/gradePlanVersions`);
  planVersions?.docs.forEach(document => {
    const data = document.data() as Record<string, unknown>;
    const at = stamp(data, ["activatedAt", "createdAt", "updatedAt"]);
    if (at && periodFor(at) === period) actions.push({ kind: "gradePlan", key: document.id, at });
  });
  return dedupe(actions);
}

async function auditFallback(teacherId: string, period: string) {
  try {
    const snapshot = await adminDb().collection(TEACHER_WORK_ACTIVITY_COLLECTION).doc(`${teacherId}__${period}`).get();
    if (!snapshot.exists) return { counts: {} as WorkCounts, days: [] as string[], lastActivityAt: "" };
    const data = snapshot.data() as Record<string, unknown>;
    const rawCounts = data.counts && typeof data.counts === "object" ? data.counts as Record<string, unknown> : {};
    const counts: WorkCounts = {};
    KINDS.forEach(kind => { counts[kind] = Math.max(0, Number(rawCounts[kind] || 0)); });
    const rawDays = data.days && typeof data.days === "object" ? Object.keys(data.days as Record<string, unknown>) : [];
    return { counts, days: rawDays.filter(day => day.startsWith(period)), lastActivityAt: String(data.lastActivityAt || data.updatedAt || "") };
  } catch (error) {
    console.warn("competition audit fallback skipped", teacherId, error);
    return { counts: {} as WorkCounts, days: [] as string[], lastActivityAt: "" };
  }
}

export async function buildTeacherCompetition() {
  const period = riyadhCompetitionParts().period;
  const database = adminDb();
  const usersSnapshot = await database.collection("portalV2Users").get();
  const teachers = usersSnapshot.docs
    .map(document => ({ id: document.id, data: document.data() as Record<string, unknown> }))
    .filter(row => String(row.data.role || "") === "teacher" && row.data.active !== false)
    .map(row => ({ id: String(row.id), name: String(row.data.name || "المعلم"), subjectIds: subjectIdsOf(row.data) }));

  const rows = await Promise.all(teachers.map(async teacher => {
    const [actions, audit] = await Promise.all([
      persistedTeacherActions(teacher.id, teacher.subjectIds, period),
      auditFallback(teacher.id, period),
    ]);
    const persistedCounts: WorkCounts = {};
    const days = new Set<string>(audit.days);
    const timestamps: string[] = audit.lastActivityAt ? [audit.lastActivityAt] : [];
    actions.forEach(action => {
      persistedCounts[action.kind] = Number(persistedCounts[action.kind] || 0) + 1;
      const day = dayFor(action.at); if (day) days.add(day);
      timestamps.push(action.at);
    });

    // Use persisted data as authority, but keep older verified work from the audit trail when
    // later edits overwrote the original document. max() prevents double-counting the same work.
    const counts: WorkCounts = {};
    KINDS.forEach(kind => { counts[kind] = Math.max(Number(persistedCounts[kind] || 0), Number(audit.counts[kind] || 0)); });
    const meaningfulActions = KINDS.reduce((sum, kind) => sum + Number(counts[kind] || 0), 0);
    const diversity = KINDS.filter(kind => Number(counts[kind] || 0) > 0).length;
    return {
      teacherId: teacher.id,
      teacherName: teacher.name,
      score: meaningfulActions,
      meaningfulActions,
      activeDays: days.size,
      diversity,
      counts,
      lastActivityAt: latest(timestamps),
    };
  }));

  rows.sort((a, b) => b.score - a.score || b.activeDays - a.activeDays || b.diversity - a.diversity || a.teacherName.localeCompare(b.teacherName, "ar"));
  const ranked: TeacherCompetitionRow[] = rows.map((row, index) => ({ ...row, rank: index + 1 }));

  return {
    period,
    rows: ranked,
    source: "persisted-plus-audit-v4" as const,
    rule: "الترتيب يحسب الأعمال التعليمية المثبتة فقط. التحضير الفعلي، رصد الدرجات، الملاحظات، الاختبارات، الخطط، الجدول والإحالات تُقرأ من بيانات المعلم نفسها، ويُستخدم السجل التاريخي فقط لاسترجاع عمل قديم تم استبداله لاحقًا. النقر والدخول وفتح الصفحات لا يحتسب.",
  };
}
