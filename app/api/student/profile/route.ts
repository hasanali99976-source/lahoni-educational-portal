import { NextResponse } from "next/server";
import { calculateGradePlanResult, type GradeStudentLike } from "../../../../lib/grade-plan";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { readStudentAccessToken } from "../../../../lib/server/portal-auth";
import { readActiveGradePlanForSubject } from "../../../../lib/server/grade-plan-store";
import { normalizeClass } from "../../../../lib/unified-roster";

type AttendanceStatus = "present" | "absent" | "late" | "excused" | "escaped";
type AttendanceEntry = { status: AttendanceStatus; updatedAt: string };
type TimetableLesson = { className?: unknown; subject?: unknown; notes?: unknown };
type ReferralRow = Record<string, unknown> & { id: string };
type StudentSnapshot = { id: string; exists: boolean; data(): unknown };

const ATTENDANCE_START_DATE = "2026-08-23";
const SCHOOL_WEEKDAYS = [0, 1, 2, 3, 4] as const;
const DAY_INDEX: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4 };
const DAY_LABELS: Record<string, string> = { sunday: "الأحد", monday: "الاثنين", tuesday: "الثلاثاء", wednesday: "الأربعاء", thursday: "الخميس" };
const MASTERY_THRESHOLD = 80;

function riyadhDateInput(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
function dateObject(value: string) { return new Date(`${value}T12:00:00Z`); }
function validStatus(value: unknown): value is AttendanceStatus { return value === "present" || value === "absent" || value === "late" || value === "excused" || value === "escaped"; }
function clean(value: unknown) { return String(value || "").trim(); }
function studentRichness(data: Record<string, unknown>) {
  let score = 0;
  const notes = Array.isArray(data.teacherNotes) ? data.teacherNotes.length : 0;
  const deductions = Array.isArray(data.gradeDeductions) ? (data.gradeDeductions as Array<Record<string, unknown>>).filter(item => !item?.reversedAt).length : 0;
  score += notes * 30;
  score += deductions * 40;
  if (clean(data.teacherNote)) score += 25;
  if (data.gradeValues && typeof data.gradeValues === "object") score += 12;
  if (data.gradePlanValues && typeof data.gradePlanValues === "object") score += 12;
  if (data.parentCounselorLastNotice && typeof data.parentCounselorLastNotice === "object") score += 20;
  if (clean(data.updatedAt)) score += 2;
  return score;
}

export async function GET(request: Request) {
  const header = request.headers.get("authorization") || "";
  const access = readStudentAccessToken(header.startsWith("Bearer ") ? header.slice(7) : "");
  if (!access) return NextResponse.json({ ok: false, message: "انتهت جلسة الطالب." }, { status: 401 });

  const root = `portalV2Data/${access.teacherId}/subjects/${access.subjectId}`;
  const students = adminDb().collection(`${root}/students`);
  const candidateMap = new Map<string, StudentSnapshot>();
  const direct = await students.doc(access.studentId).get();
  if (direct.exists) candidateMap.set(direct.id, direct as StudentSnapshot);
  for (const field of ["code", "accessCode", "studentCode"] as const) {
    const hits = await students.where(field, "==", access.studentId).limit(8).get();
    hits.docs.forEach(doc => candidateMap.set(doc.id, doc as StudentSnapshot));
  }
  const candidates = [...candidateMap.values()].filter(doc => doc.exists);
  if (!candidates.length) return NextResponse.json({ ok: false, message: "لم يعد سجل الطالب متاحًا." }, { status: 404 });
  const student = [...candidates].sort((a, b) => studentRichness((b.data() || {}) as Record<string, unknown>) - studentRichness((a.data() || {}) as Record<string, unknown>))[0]!;
  const studentData = student.data() as Record<string, unknown>;
  const studentClass = normalizeClass(studentData.class || studentData.className || `${String(studentData.grade || "")} ${String(studentData.section || "")}`);
  const [attendance, timetable, gradePlanState, referralSnapshot] = await Promise.all([
    adminDb().collection(`${root}/attendance`).get(),
    adminDb().collection(`${root}/timetable`).doc("weekly").get(),
    readActiveGradePlanForSubject(access.teacherId, access.subjectId),
    adminDb().collection(`${root}/counselorReferrals`).get(),
  ]);

  const aliases = new Set<string>([access.studentId, student.id]);
  candidates.forEach(doc => {
    aliases.add(doc.id);
    const data = (doc.data() || {}) as Record<string, unknown>;
    [data.code, data.accessCode, data.studentCode].map(clean).filter(Boolean).forEach(value => aliases.add(value));
  });
  [studentData.code, studentData.accessCode, studentData.studentCode].map(clean).filter(Boolean).forEach(value => aliases.add(value));

  const counselorReferrals = referralSnapshot.docs
    .map(document => ({ id: document.id, ...(document.data() as Record<string, unknown>) }) as ReferralRow)
    .filter(item => {
      const explicit = item.teacherCreated === true || item.explicitTeacherAction === true || clean(item.source) === "teacher_action";
      if (!explicit) return false;
      if (clean(item.teacherId) && clean(item.teacherId) !== access.teacherId) return false;
      const subjectId = clean(item.subjectId);
      if (subjectId && subjectId.split("--")[0] !== access.subjectId.split("--")[0]) return false;
      if (item.visibleToStudent === false) return false;
      const status = clean(item.status);
      if (status === "ملغاة" || status === "محذوفة") return false;
      const referralAliases = [clean(item.studentId), clean(item.studentCode), clean(item.rosterStudentId)].filter(Boolean);
      return referralAliases.some(alias => aliases.has(alias));
    })
    .map(item => ({ id: clean(item.id), referralType: clean(item.referralType) || "other", referralTypeLabel: clean(item.referralTypeLabel) || "إحالة للمرشد الطلابي", reason: clean(item.reason) || "إحالة للمتابعة مع المرشد الطلابي", status: clean(item.status) || "جديدة", teacherName: clean(item.teacherName), subject: clean(item.subject), createdAt: clean(item.createdAt), severity: clean(item.severity) || "high", teacherCreated: true, source: "teacher_action" }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20);

  const latestExplicitReferral = counselorReferrals[0];
  const storedNotice = studentData.parentCounselorLastNotice && typeof studentData.parentCounselorLastNotice === "object" ? studentData.parentCounselorLastNotice as Record<string, unknown> : null;
  const storedNoticeExplicit = storedNotice && (storedNotice.teacherCreated === true || storedNotice.explicitTeacherAction === true || clean(storedNotice.source) === "teacher_action");
  const parentCounselorLastNotice = latestExplicitReferral ? { title: "إحالة للمرشد الطلابي", message: latestExplicitReferral.reason, referralType: latestExplicitReferral.referralType, subject: latestExplicitReferral.subject, teacherName: latestExplicitReferral.teacherName, teacherCreated: true, source: "teacher_action", referralId: latestExplicitReferral.id, createdAt: latestExplicitReferral.createdAt } : storedNoticeExplicit ? storedNotice : undefined;

  const explicitByDate = new Map<string, AttendanceEntry>();
  for (const record of attendance.docs) {
    const data = record.data() as Record<string, any>;
    const date = typeof data.date === "string" ? data.date : "";
    if (!date || date < ATTENDANCE_START_DATE) continue;
    const status = data?.records?.[student.id] ?? data?.records?.[access.studentId];
    if (!validStatus(status)) continue;
    const updatedAt = typeof data.updatedAt === "string" ? data.updatedAt : "";
    const existing = explicitByDate.get(date);
    if (!existing || updatedAt >= existing.updatedAt) explicitByDate.set(date, { status, updatedAt });
  }

  const timetableWeekdays = new Set<number>();
  const lessons = timetable.exists && timetable.data()?.lessons && typeof timetable.data()?.lessons === "object" ? timetable.data()!.lessons as Record<string, TimetableLesson> : {};
  const timetableLessons: Array<{ dayKey: string; dayLabel: string; dayIndex: number; period: number; className: string; subject: string; notes: string }> = [];
  Object.entries(lessons).forEach(([cell, lesson]) => {
    const match = cell.match(/^(sunday|monday|tuesday|wednesday|thursday)-([1-7])$/);
    if (!match || !studentClass) return;
    const lessonClass = normalizeClass(lesson?.className);
    if (lessonClass !== studentClass) return;
    timetableWeekdays.add(DAY_INDEX[match[1]]);
    timetableLessons.push({ dayKey: match[1], dayLabel: DAY_LABELS[match[1]] || match[1], dayIndex: DAY_INDEX[match[1]], period: Number(match[2]), className: lessonClass, subject: String(lesson?.subject || "").trim(), notes: String(lesson?.notes || "").trim() });
  });
  timetableLessons.sort((a, b) => a.dayIndex - b.dayIndex || a.period - b.period);

  const expectedWeekdays = timetableWeekdays.size ? timetableWeekdays : new Set<number>(SCHOOL_WEEKDAYS);
  const attendanceSource = timetableWeekdays.size ? "timetable_automatic_until_teacher_override" : "school_days_automatic_until_teacher_override";
  const counts = { present: 0, absent: 0, late: 0, excused: 0, escaped: 0, total: 0 };
  let latestDate = "";
  let automaticPresent = 0;
  explicitByDate.forEach((entry, date) => { counts[entry.status] += 1; counts.total += 1; if (date > latestDate) latestDate = date; });
  const today = riyadhDateInput(new Date());
  const cursor = dateObject(ATTENDANCE_START_DATE);
  const end = dateObject(today);
  while (cursor <= end) {
    const date = cursor.toISOString().slice(0, 10);
    if (expectedWeekdays.has(cursor.getUTCDay()) && !explicitByDate.has(date)) { counts.present += 1; counts.total += 1; automaticPresent += 1; if (date > latestDate) latestDate = date; }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  const disciplineRate = counts.total ? Math.max(0, Math.round(((counts.present + counts.excused + counts.late * 0.5) / counts.total) * 100)) : 100;

  const activePlan = gradePlanState.activePlan;
  const masteryResult = activePlan ? calculateGradePlanResult(activePlan, studentData as GradeStudentLike) : null;
  const masteryCompletion = Math.round(masteryResult?.completion || 0);
  const masteryPerformance = Math.round(masteryResult?.percentage || 0);
  const masteryFinalScore = masteryResult?.finalScore === null || masteryResult?.finalScore === undefined ? null : Math.round(masteryResult.finalScore);
  const followUpSummary = {
    threshold: MASTERY_THRESHOLD,
    completion: masteryCompletion,
    performance: masteryPerformance,
    finalScore: masteryFinalScore,
    status: !activePlan ? "بانتظار خطة التقييم" : masteryCompletion < 100 ? "الرصد غير مكتمل" : Number(masteryFinalScore || 0) >= MASTERY_THRESHOLD ? "متقن" : "يحتاج دعمًا",
    mastered: Boolean(activePlan && masteryCompletion === 100 && Number(masteryFinalScore || 0) >= MASTERY_THRESHOLD),
    needsSupport: Boolean(activePlan && masteryCompletion === 100 && Number(masteryFinalScore || 0) < MASTERY_THRESHOLD),
    referralCount: counselorReferrals.length,
  };

  return NextResponse.json({ ok: true, data: { ...studentData, counselorReferrals, parentCounselorLastNotice, parentCounselorNoticeCount: counselorReferrals.length || (parentCounselorLastNotice ? 1 : 0), absences: counts.absent, late: counts.late, attendanceSummary: { ...counts, automaticPresent, disciplineRate, latestDate, automaticThrough: today, attendanceMode: "automatic_until_teacher_override", attendanceSource }, timetableLessons, gradePlan: activePlan, gradePlanSource: gradePlanState.source, followUpSummary }, attendanceSource, expectedWeekdays: [...expectedWeekdays], timetableLessons, updatedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } });
}