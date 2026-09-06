import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { requireSession } from "../../../../lib/server/portal-auth";
import { isSubjectKey } from "../../../../lib/subject-config";
import { normalizeAssignments } from "../../../../lib/teacher-assignments";
import { normalizeClass } from "../../../../lib/unified-roster";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PERIOD_PATTERN = /^[1-7]$/;

function clean(value: unknown, limit = 800) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function cleanBlock(value: unknown, limit = 2000) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, limit);
}

function safeId(value: string) {
  return encodeURIComponent(value).replace(/%/g, "_");
}

function workCollection(teacherId: string, subjectId: string) {
  return adminDb().collection(`portalV2Data/${teacherId}/subjects/${subjectId}/lessonWork`);
}

function workId(date: string, period: number, className: string) {
  return `${date}__${period}__${safeId(className)}`;
}

async function context(subjectId: string) {
  const session = await requireSession("teacher");
  if (!session?.user) return { error: NextResponse.json({ ok: false, message: "انتهت جلسة المعلم." }, { status: 401 }) };
  if (!isSubjectKey(subjectId)) return { error: NextResponse.json({ ok: false, message: "المادة غير صحيحة." }, { status: 400 }) };
  const assignments = normalizeAssignments(session.user.assignments, session.user.subjectIds);
  if (!assignments.some(item => item.subjectId === subjectId)) {
    return { error: NextResponse.json({ ok: false, message: "هذه المادة غير مسندة إلى حسابك." }, { status: 403 }) };
  }
  return { session };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const subjectId = clean(url.searchParams.get("subjectId"), 80).split("--")[0];
  const date = clean(url.searchParams.get("date"), 10);
  const requestedClasses = [...new Set(url.searchParams.getAll("className").map(normalizeClass).filter(Boolean))];
  const ctx = await context(subjectId);
  if ("error" in ctx) return ctx.error;
  if (!DATE_PATTERN.test(date)) return NextResponse.json({ ok: false, message: "التاريخ غير صحيح." }, { status: 400 });

  try {
    const snapshot = await workCollection(ctx.session.userId, subjectId).where("date", "==", date).get();
    const rows = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const savedClasses = rows.map(row => normalizeClass((row as Record<string, unknown>).className)).filter(Boolean);
    const classes = [...new Set([...requestedClasses, ...savedClasses])];

    const attendanceEntries = await Promise.all(classes.map(async className => {
      const ref = adminDb().collection(`portalV2Data/${ctx.session.userId}/subjects/${subjectId}/attendance`).doc(`${safeId(className)}_${date}`);
      const item = await ref.get();
      return [className, item.exists] as const;
    }));

    return NextResponse.json({
      ok: true,
      rows,
      attendance: Object.fromEntries(attendanceEntries),
      preservedIndependentOfTimetable: true,
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("lesson-work-get-failed", error);
    return NextResponse.json({ ok: false, message: "تعذر تحميل تحضير اليوم." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const subjectId = clean(body.subjectId, 80).split("--")[0];
  const date = clean(body.date, 10);
  const periodText = clean(body.period, 1);
  const period = Number(periodText);
  const className = normalizeClass(body.className);
  const lessonTitle = clean(body.lessonTitle, 240);
  const objectives = cleanBlock(body.objectives, 1800);
  const strategies = cleanBlock(body.strategies, 1200);
  const introduction = cleanBlock(body.introduction, 1400);
  const lessonFlow = cleanBlock(body.lessonFlow, 2400);
  const activity = cleanBlock(body.activity, 1400);
  const assessment = cleanBlock(body.assessment, 1400);
  const homework = cleanBlock(body.homework, 1200);
  const values = cleanBlock(body.values, 1200);
  const preparation = cleanBlock(body.preparation, 2400);
  const completedWork = cleanBlock(body.completedWork, 1800);
  const ctx = await context(subjectId);
  if ("error" in ctx) return ctx.error;

  if (!DATE_PATTERN.test(date) || !PERIOD_PATTERN.test(periodText) || !className) {
    return NextResponse.json({ ok: false, message: "بيانات الحصة غير مكتملة." }, { status: 400 });
  }

  try {
    const now = new Date().toISOString();
    const id = workId(date, period, className);
    const ref = workCollection(ctx.session.userId, subjectId).doc(id);
    const prepared = Boolean(lessonTitle || objectives || strategies || introduction || lessonFlow || activity || assessment || homework || values || preparation);
    const row = {
      id,
      date,
      period,
      className,
      lessonTitle,
      objectives,
      strategies,
      introduction,
      lessonFlow,
      activity,
      assessment,
      homework,
      values,
      preparation,
      completedWork,
      prepared,
      completed: Boolean(completedWork),
      teacherId: ctx.session.userId,
      teacherName: ctx.session.name || "",
      subjectId,
      updatedAt: now,
    };
    await ref.set(row, { merge: true });
    return NextResponse.json({ ok: true, row }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("lesson-work-save-failed", error);
    return NextResponse.json({ ok: false, message: "تعذر حفظ تحضير الحصة الآن." }, { status: 500 });
  }
}
