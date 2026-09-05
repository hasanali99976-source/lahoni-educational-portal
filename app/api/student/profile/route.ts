import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { readStudentAccessToken } from "../../../../lib/server/portal-auth";
import { normalizeClass } from "../../../../lib/unified-roster";

type AttendanceStatus = "present" | "absent" | "late" | "excused" | "escaped";
type AttendanceEntry = { status: AttendanceStatus; updatedAt: string };
type TimetableLesson = { className?: unknown; subject?: unknown; notes?: unknown };

const ATTENDANCE_START_DATE = "2026-08-23";
const SCHOOL_WEEKDAYS = [0, 1, 2, 3, 4] as const;
const DAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
};
const DAY_LABELS: Record<string, string> = {
  sunday: "الأحد",
  monday: "الاثنين",
  tuesday: "الثلاثاء",
  wednesday: "الأربعاء",
  thursday: "الخميس",
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

function dateObject(value: string) {
  return new Date(`${value}T12:00:00Z`);
}

function validStatus(value: unknown): value is AttendanceStatus {
  return value === "present" || value === "absent" || value === "late" || value === "excused" || value === "escaped";
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
  const timetableLessons: Array<{ dayKey: string; dayLabel: string; dayIndex: number; period: number; className: string; subject: string; notes: string }> = [];
  Object.entries(lessons).forEach(([cell, lesson]) => {
    const match = cell.match(/^(sunday|monday|tuesday|wednesday|thursday)-([1-7])$/);
    if (!match || !studentClass) return;
    const lessonClass = normalizeClass(lesson?.className);
    if (lessonClass !== studentClass) return;
    timetableWeekdays.add(DAY_INDEX[match[1]]);
    timetableLessons.push({
      dayKey: match[1],
      dayLabel: DAY_LABELS[match[1]] || match[1],
      dayIndex: DAY_INDEX[match[1]],
      period: Number(match[2]),
      className: lessonClass,
      subject: String(lesson?.subject || "").trim(),
      notes: String(lesson?.notes || "").trim(),
    });
  });
  timetableLessons.sort((a, b) => a.dayIndex - b.dayIndex || a.period - b.period);

  const expectedWeekdays = timetableWeekdays.size
    ? timetableWeekdays
    : new Set<number>(SCHOOL_WEEKDAYS);
  const attendanceSource = timetableWeekdays.size
    ? "timetable_automatic_until_teacher_override"
    : "school_days_automatic_until_teacher_override";

  const counts = { present: 0, absent: 0, late: 0, excused: 0, escaped: 0, total: 0 };
  let latestDate = "";
  let automaticPresent = 0;

  explicitByDate.forEach((entry, date) => {
    counts[entry.status] += 1;
    counts.total += 1;
    if (date > latestDate) latestDate = date;
  });

  /*
   * V21 attendance rule:
   * From 12:00 AM Riyadh time, a scheduled lesson day is treated as automatic "present"
   * until the teacher records attendance. Any teacher record immediately overrides the
   * automatic value because explicitByDate always wins for that date.
   */
  const today = riyadhDateInput(new Date());
  const cursor = dateObject(ATTENDANCE_START_DATE);
  const end = dateObject(today);
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

  return NextResponse.json({
    ok: true,
    data: {
      ...studentData,
      absences: counts.absent,
      late: counts.late,
      attendanceSummary: {
        ...counts,
        automaticPresent,
        disciplineRate,
        latestDate,
        automaticThrough: today,
        attendanceMode: "automatic_until_teacher_override",
        attendanceSource,
      },
      timetableLessons,
      gradePlan: gradePlanSnapshot && gradePlanSnapshot.exists ? { id: gradePlanSnapshot.id, ...gradePlanSnapshot.data() } : null,
    },
    attendanceSource,
    expectedWeekdays: [...expectedWeekdays],
    timetableLessons,
    updatedAt: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
