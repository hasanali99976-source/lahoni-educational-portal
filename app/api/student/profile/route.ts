import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { readStudentAccessToken } from "../../../../lib/server/portal-auth";
import { normalizeClass } from "../../../../lib/unified-roster";

type AttendanceStatus = "present" | "absent" | "late" | "excused" | "escaped";
type AttendanceEntry = { status: AttendanceStatus; updatedAt: string };
type TimetableLesson = { className?: unknown };

const ATTENDANCE_START_DATE = "2026-08-23";
const SCHOOL_DAY_END_HOUR = 15;
const SCHOOL_WEEKDAYS = [0, 1, 2, 3, 4] as const;
const DAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
};

function riyadhDateInput(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function riyadhHour(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Riyadh",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Number(parts.find(part => part.type === "hour")?.value || 0);
}

function dateObject(value: string) {
  return new Date(`${value}T12:00:00Z`);
}

function shiftDate(value: string, amount: number) {
  const date = dateObject(value);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function validStatus(value: unknown): value is AttendanceStatus {
  return value === "present" || value === "absent" || value === "late" || value === "excused" || value === "escaped";
}

function objectRecord(value: unknown): Record<string, any> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : null;
}

function planVersion(value: Record<string, any> | null) {
  return Math.max(0, Number(value?.version || 0));
}

function planTime(value: Record<string, any> | null) {
  return Date.parse(String(value?.activatedAt || value?.createdAt || "")) || 0;
}

function chooseStudentGradePlan(serverPlan: Record<string, any> | null, studentData: Record<string, unknown>) {
  const embedded = objectRecord(studentData.gradePlanSnapshot) || objectRecord(studentData.gradePlan);
  if (!serverPlan) return embedded;
  if (!embedded) return serverPlan;
  if (String(serverPlan.id || "") === String(embedded.id || "")) return serverPlan;
  if (planVersion(serverPlan) !== planVersion(embedded)) return planVersion(serverPlan) > planVersion(embedded) ? serverPlan : embedded;
  return planTime(serverPlan) >= planTime(embedded) ? serverPlan : embedded;
}

function valuesForStudentPlan(studentData: Record<string, unknown>, planId: string) {
  const all = objectRecord(studentData.gradePlanValues);
  const specific = planId && all ? objectRecord(all[planId]) : null;
  return specific || objectRecord(studentData.gradeValues) || {};
}

export async function GET(request: Request) {
  const header = request.headers.get("authorization") || "";
  const access = readStudentAccessToken(header.startsWith("Bearer ") ? header.slice(7) : "");
  if (!access) return NextResponse.json({ ok: false, message: "انتهت جلسة الطالب." }, { status: 401 });

  const root = `portalV2Data/${access.teacherId}/subjects/${access.subjectId}`;
  const student = await adminDb().collection(`${root}/students`).doc(access.studentId).get();
  if (!student.exists) return NextResponse.json({ ok: false, message: "لم يعد سجل الطالب متاحًا." }, { status: 404 });

  const studentData = student.data() as Record<string, unknown>;
  const studentClass = normalizeClass(
    studentData.class
    || studentData.className
    || `${String(studentData.grade || "")} ${String(studentData.section || "")}`,
  );

  const gradePlanConfig = await adminDb().collection(`portalV2Data/${access.teacherId}/gradePlanConfig`).doc("current").get();
  const activeGradePlanId = gradePlanConfig.exists ? String(gradePlanConfig.data()?.activePlanId || "") : "";
  const [attendance, timetable, gradePlanSnapshot] = await Promise.all([
    adminDb().collection(`${root}/attendance`).get(),
    adminDb().collection(`${root}/timetable`).doc("weekly").get(),
    activeGradePlanId ? adminDb().collection(`portalV2Data/${access.teacherId}/gradePlanVersions`).doc(activeGradePlanId).get() : Promise.resolve(null),
  ]);

  const explicitByDate = new Map<string, AttendanceEntry>();
  for (const record of attendance.docs) {
    const data = record.data() as Record<string, any>;
    const date = typeof data.date === "string" ? data.date : "";
    if (!date || date < ATTENDANCE_START_DATE) continue;
    const status = data?.records?.[access.studentId];
    if (!validStatus(status)) continue;
    const updatedAt = typeof data.updatedAt === "string" ? data.updatedAt : "";
    const existing = explicitByDate.get(date);
    if (!existing || updatedAt >= existing.updatedAt) explicitByDate.set(date, { status, updatedAt });
  }

  const timetableWeekdays = new Set<number>();
  const lessons = timetable.exists && timetable.data()?.lessons && typeof timetable.data()?.lessons === "object"
    ? timetable.data()!.lessons as Record<string, TimetableLesson>
    : {};
  Object.entries(lessons).forEach(([cell, lesson]) => {
    const match = cell.match(/^(sunday|monday|tuesday|wednesday|thursday)-[1-7]$/);
    if (!match || !studentClass) return;
    if (normalizeClass(lesson?.className) !== studentClass) return;
    timetableWeekdays.add(DAY_INDEX[match[1]]);
  });

  const expectedWeekdays = timetableWeekdays.size
    ? timetableWeekdays
    : new Set<number>(SCHOOL_WEEKDAYS);
  const attendanceSource = timetableWeekdays.size
    ? "timetable_with_manual_overrides"
    : "school_days_default_with_manual_overrides";

  const counts = { present: 0, absent: 0, late: 0, excused: 0, escaped: 0, total: 0 };
  let latestDate = "";
  let automaticPresent = 0;

  explicitByDate.forEach((entry, date) => {
    counts[entry.status] += 1;
    counts.total += 1;
    if (date > latestDate) latestDate = date;
  });

  const now = new Date();
  const today = riyadhDateInput(now);
  const lastCompletedDay = riyadhHour(now) >= SCHOOL_DAY_END_HOUR ? today : shiftDate(today, -1);
  const cursor = dateObject(ATTENDANCE_START_DATE);
  const end = dateObject(lastCompletedDay);
  while (cursor <= end) {
    const date = cursor.toISOString().slice(0, 10);
    if (expectedWeekdays.has(cursor.getUTCDay()) && !explicitByDate.has(date)) {
      counts.present += 1;
      counts.total += 1;
      automaticPresent += 1;
      if (date > latestDate) latestDate = date;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const disciplineRate = counts.total
    ? Math.max(0, Math.round(((counts.present + counts.excused + counts.late * 0.5) / counts.total) * 100))
    : 100;

  const serverGradePlan = gradePlanSnapshot && gradePlanSnapshot.exists
    ? { id: gradePlanSnapshot.id, ...gradePlanSnapshot.data() } as Record<string, any>
    : null;
  const gradePlan = chooseStudentGradePlan(serverGradePlan, studentData);
  const effectiveGradePlanId = String(gradePlan?.id || studentData.activeGradePlanId || activeGradePlanId || "");
  const effectiveGradeValues = valuesForStudentPlan(studentData, effectiveGradePlanId);
  const visibleTeacherNotes = (Array.isArray(studentData.teacherNotes) ? studentData.teacherNotes : [])
    .filter((note: unknown) => !note || typeof note !== "object" || (note as Record<string, unknown>).visibleToParent !== false)
    .slice(0, 250);

  return NextResponse.json({
    ok: true,
    data: {
      ...studentData,
      teacherNotes: visibleTeacherNotes,
      teacherNoteCount: visibleTeacherNotes.length,
      internalTeacherNotes: undefined,
      absences: counts.absent,
      late: counts.late,
      attendanceSummary: {
        ...counts,
        automaticPresent,
        disciplineRate,
        latestDate,
        attendanceSource,
      },
      gradePlan,
      activeGradePlanId: effectiveGradePlanId,
      gradeValues: effectiveGradeValues,
    },
    attendanceSource,
    expectedWeekdays: [...expectedWeekdays],
    updatedAt: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}