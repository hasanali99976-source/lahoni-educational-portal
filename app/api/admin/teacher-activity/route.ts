import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { requireSession } from "../../../../lib/server/portal-auth";
import { TEACHER_WORK_ACTIVITY_COLLECTION, TEACHER_WORK_WEIGHTS } from "../../../../lib/server/teacher-work-activity";

type WorkCounts = Record<string, number>;
type TimedAction = { kind: keyof typeof TEACHER_WORK_WEIGHTS; key: string; at: string };

function riyadhParts(date = new Date()) {
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
  return riyadhParts(date).period;
}

function dayFor(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    const text = String(value);
    return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : "";
  }
  return riyadhParts(date).day;
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

async function realTeacherWork(teacherId: string, period: string) {
  const database = adminDb();
  const actions: TimedAction[] = [];

  const [studentsSnapshot, attendanceSnapshot, gradePlansSnapshot] = await Promise.all([
    database.collectionGroup("students").where("teacherId", "==", teacherId).get().catch(() => null),
    database.collectionGroup("attendance").where("teacherId", "==", teacherId).get().catch(() => null),
    database.collection(`portalV2Data/${teacherId}/gradePlanVersions`).get().catch(() => null),
  ]);

  studentsSnapshot?.docs.forEach(document => {
    const data = document.data() as Record<string, unknown>;
    const gradeAt = String(data.gradePlanUpdatedAt || "");
    if (gradeAt && periodFor(gradeAt) === period) {
      const subject = String(data.subjectKey || "subject");
      const className = String(data.className || data.class || "class");
      // حفظ سجل الفصل يكتب نفس التوقيت على كل الطلاب، لذلك نجمعه كعملية واحدة فقط.
      actions.push({ kind: "grades", key: `${subject}|${className}|${gradeAt}`, at: gradeAt });
    }

    const notes = Array.isArray(data.teacherNotes) ? data.teacherNotes as Array<Record<string, unknown>> : [];
    notes.forEach((note, index) => {
      const createdAt = String(note.createdAt || "");
      if (!createdAt || periodFor(createdAt) !== period) return;
      actions.push({
        kind: "note",
        key: String(note.id || `${document.id}|${createdAt}|${index}`),
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
    const className = String(data.class || "class");
    const date = String(data.date || dayFor(at));
    // نفس الفصل في نفس اليوم = عمل تحضير واحد، حتى لو عدّل الحالة أكثر من مرة.
    actions.push({ kind: "attendance", key: `${subject}|${className}|${date}`, at });
  });

  gradePlansSnapshot?.docs.forEach(document => {
    const data = document.data() as Record<string, unknown>;
    const at = String(data.activatedAt || data.createdAt || "");
    if (!at || periodFor(at) !== period) return;
    actions.push({ kind: "gradePlan", key: document.id, at });
  });

  return dedupeActions(actions);
}

export async function GET() {
  const session = await requireSession("admin");
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const period = riyadhParts().period;
    const database = adminDb();
    const [usersSnapshot, trackedSnapshot] = await Promise.all([
      database.collection("portalV2Users").get(),
      database.collection(TEACHER_WORK_ACTIVITY_COLLECTION).get().catch(() => null),
    ]);

    const teachers = usersSnapshot.docs
      .map(document => ({ id: document.id, ...(document.data() as Record<string, unknown>) }))
      .filter(row => row.role === "teacher" && row.active !== false)
      .map(row => ({ id: String(row.id), name: String(row.name || "المعلم") }));

    const trackedByTeacher = new Map<string, Record<string, unknown>>();
    trackedSnapshot?.docs.forEach(document => {
      const data = document.data() as Record<string, unknown>;
      if (String(data.period || "") !== period) return;
      const teacherId = String(data.teacherId || "");
      if (teacherId) trackedByTeacher.set(teacherId, data);
    });

    const rows = await Promise.all(teachers.map(async teacher => {
      const realActions = await realTeacherWork(teacher.id, period);
      const counts: WorkCounts = {};
      const days = new Set<string>();
      const timestamps: string[] = [];

      realActions.forEach(action => {
        counts[action.kind] = Number(counts[action.kind] || 0) + 1;
        const day = dayFor(action.at);
        if (day) days.add(day);
        timestamps.push(action.at);
      });

      // تبقى الأنشطة الإضافية المسجلة من عمليات حفظ موثوقة فقط، مثل التشخيصي أو الخطط العلاجية.
      const tracked = trackedByTeacher.get(teacher.id);
      const trackedCounts = tracked?.counts && typeof tracked.counts === "object"
        ? tracked.counts as Record<string, number>
        : {};
      ["diagnostic", "remedial", "referral", "timetable"].forEach(kind => {
        const value = Math.max(0, Number(trackedCounts[kind] || 0));
        if (value) counts[kind] = Number(counts[kind] || 0) + value;
      });
      const trackedDays = tracked?.days && typeof tracked.days === "object"
        ? Object.keys(tracked.days as Record<string, number>)
        : [];
      trackedDays.forEach(day => days.add(day));
      if (tracked?.lastActivityAt) timestamps.push(String(tracked.lastActivityAt));

      const score = Object.entries(counts).reduce((sum, [kind, count]) => {
        const weight = TEACHER_WORK_WEIGHTS[kind as keyof typeof TEACHER_WORK_WEIGHTS] || 0;
        return sum + weight * Math.max(0, Number(count || 0));
      }, 0);
      const meaningfulActions = Object.values(counts).reduce((sum, value) => sum + Math.max(0, Number(value || 0)), 0);

      return {
        teacherId: teacher.id,
        teacherName: teacher.name,
        score,
        meaningfulActions,
        activeDays: days.size,
        counts,
        lastActivityAt: latest(timestamps),
      };
    }));

    rows.sort((a, b) => b.score - a.score || b.meaningfulActions - a.meaningfulActions || a.teacherName.localeCompare(b.teacherName, "ar"));

    return NextResponse.json({
      ok: true,
      period,
      rows,
      scoring: TEACHER_WORK_WEIGHTS,
      source: "persisted-work",
      rule: "الترتيب يُحسب من الأعمال المحفوظة فعليًا: رصد الدرجات، التحضير، الملاحظات وخطط الدرجات. الزيارات والنقرات لا تُحسب.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("admin teacher activity leaderboard failed", error);
    return NextResponse.json({ ok: false, message: "تعذر تحميل ترتيب الاستخدام الفعلي الآن." }, { status: 500 });
  }
}
