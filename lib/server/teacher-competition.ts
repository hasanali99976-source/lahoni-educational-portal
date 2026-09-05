import "server-only";

import { adminDb } from "./firebase-admin";
import { TEACHER_WORK_WEIGHTS } from "./teacher-work-activity";

type WorkCounts = Record<string, number>;
type WorkKind = keyof typeof TEACHER_WORK_WEIGHTS;
type TimedAction = { kind: WorkKind; key: string; at: string };

export type TeacherCompetitionRow = {
  teacherId: string;
  teacherName: string;
  score: number;
  meaningfulActions: number;
  activeDays: number;
  counts: WorkCounts;
  lastActivityAt: string;
  rank: number;
};

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

function periodFor(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    const text = String(value);
    return /^\d{4}-\d{2}/.test(text) ? text.slice(0, 7) : "";
  }
  return riyadhCompetitionParts(date).period;
}

function dayFor(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    const text = String(value);
    return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : "";
  }
  return riyadhCompetitionParts(date).day;
}

function latest(values: string[]) {
  return values.filter(Boolean).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || "";
}

function dedupeActions(actions: TimedAction[]) {
  const seen = new Set<string>();
  return actions.filter(action => {
    const key = `${action.kind}:${action.key}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function subjectIdsOf(data: Record<string, unknown>) {
  const ids = new Set<string>();
  if (Array.isArray(data.subjectIds)) data.subjectIds.forEach(value => ids.add(String(value || "").split("--")[0]));
  if (Array.isArray(data.assignments)) {
    data.assignments.forEach(value => {
      if (!value || typeof value !== "object") return;
      const subjectId = String((value as Record<string, unknown>).subjectId || "").split("--")[0];
      if (subjectId) ids.add(subjectId);
    });
  }
  return [...ids].filter(Boolean);
}

async function realTeacherWork(teacherId: string, subjectIds: string[], period: string) {
  const database = adminDb();
  const actions: TimedAction[] = [];

  const [studentsSnapshot, attendanceSnapshot, gradePlansSnapshot, subjectSnapshots] = await Promise.all([
    database.collectionGroup("students").where("teacherId", "==", teacherId).get().catch(() => null),
    database.collectionGroup("attendance").where("teacherId", "==", teacherId).get().catch(() => null),
    database.collection(`portalV2Data/${teacherId}/gradePlanVersions`).get().catch(() => null),
    Promise.all(subjectIds.map(async subjectId => {
      const root = `portalV2Data/${teacherId}/subjects/${subjectId}`;
      const [diagnostics, results, timetable] = await Promise.all([
        database.collection(`${root}/diagnostics`).get().catch(() => null),
        database.collection(`${root}/diagnosticResults`).get().catch(() => null),
        database.collection(`${root}/timetable`).get().catch(() => null),
      ]);
      return { subjectId, diagnostics, results, timetable };
    })),
  ]);

  studentsSnapshot?.docs.forEach(document => {
    const data = document.data() as Record<string, unknown>;
    const gradeAt = String(data.gradeHistoryUpdatedAt || data.gradePlanUpdatedAt || "");
    if (gradeAt && periodFor(gradeAt) === period) {
      const subject = String(data.subjectKey || "subject");
      const className = String(data.className || data.class || "class");
      const day = dayFor(gradeAt);
      if (day) actions.push({ kind: "grades", key: `${subject}|${className}|${day}`, at: gradeAt });
    }

    const notes = Array.isArray(data.teacherNotes) ? data.teacherNotes as Array<Record<string, unknown>> : [];
    notes.forEach((note, index) => {
      const createdAt = String(note.createdAt || "");
      if (!createdAt || periodFor(createdAt) !== period) return;
      actions.push({
        kind: "note",
        key: `${document.ref.path}|${String(note.id || `${createdAt}|${index}`)}`,
        at: createdAt,
      });
    });
  });

  attendanceSnapshot?.docs.forEach(document => {
    const data = document.data() as Record<string, unknown>;
    if (data.autoSaved === true && data.manualEdited !== true) return;
    const at = String(data.manualEditedAt || data.updatedAt || data.date || "");
    if (!at || periodFor(at) !== period) return;
    const subject = String(data.subjectKey || "subject");
    const className = String(data.class || data.className || "class");
    const date = String(data.date || dayFor(at));
    if (date) actions.push({ kind: "attendance", key: `${subject}|${className}|${date}`, at });
  });

  gradePlansSnapshot?.docs.forEach(document => {
    const data = document.data() as Record<string, unknown>;
    const at = String(data.activatedAt || data.createdAt || "");
    if (!at || periodFor(at) !== period) return;
    actions.push({ kind: "gradePlan", key: document.id, at });
  });

  subjectSnapshots.forEach(({ subjectId, diagnostics, results, timetable }) => {
    diagnostics?.docs.forEach(document => {
      const data = document.data() as Record<string, unknown>;
      const at = String(data.createdAt || data.updatedAt || "");
      if (!at || periodFor(at) !== period) return;
      actions.push({ kind: "diagnostic", key: `${subjectId}|${document.id}`, at });
    });

    results?.docs.forEach(document => {
      const data = document.data() as Record<string, unknown>;
      const hasPlan = Boolean(String(data.teacherPlan || data.aiPlan || "").trim());
      if (!hasPlan) return;
      const at = String(data.teacherPlanUpdatedAt || data.aiPlanUpdatedAt || data.updatedAt || "");
      if (!at || periodFor(at) !== period) return;
      actions.push({ kind: "remedial", key: `${subjectId}|${document.id}`, at });
    });

    timetable?.docs.forEach(document => {
      const data = document.data() as Record<string, unknown>;
      const at = String(data.savedThroughApiAt || data.updatedAt || "");
      if (!at || periodFor(at) !== period) return;
      const day = dayFor(at);
      if (day) actions.push({ kind: "timetable", key: `${subjectId}|${day}`, at });
    });
  });

  return dedupeActions(actions);
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
    const realActions = await realTeacherWork(teacher.id, teacher.subjectIds, period);
    const counts: WorkCounts = {};
    const days = new Set<string>();
    const timestamps: string[] = [];

    realActions.forEach(action => {
      counts[action.kind] = Number(counts[action.kind] || 0) + 1;
      const day = dayFor(action.at);
      if (day) days.add(day);
      timestamps.push(action.at);
    });

    const meaningfulActions = realActions.length;
    return {
      teacherId: teacher.id,
      teacherName: teacher.name,
      score: meaningfulActions,
      meaningfulActions,
      activeDays: days.size,
      counts,
      lastActivityAt: latest(timestamps),
    };
  }));

  rows.sort((a, b) => b.score - a.score || b.activeDays - a.activeDays || a.teacherName.localeCompare(b.teacherName, "ar"));
  const ranked: TeacherCompetitionRow[] = rows.map((row, index) => ({ ...row, rank: index + 1 }));

  return {
    period,
    rows: ranked,
    scoring: TEACHER_WORK_WEIGHTS,
    source: "persisted-work-v3" as const,
    rule: "كل عمل تعليمي موثق = نقطة واحدة فقط. تُستخرج النقاط من البيانات المحفوظة فعليًا، مع دمج التكرارات اليومية المتشابهة؛ فتح الصفحات والنقر والحفظ المتكرر بلا عمل جديد لا يزيد الرصيد.",
  };
}
