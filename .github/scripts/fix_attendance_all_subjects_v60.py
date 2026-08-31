from pathlib import Path
import re

ROOT = Path('.')
TEACHER = ROOT / 'app/teacher/attendance/page.tsx'
STUDENT = ROOT / 'app/student/page.tsx'
PROFILE = ROOT / 'app/api/student/profile/route.ts'
SW = ROOT / 'public/sw.js'
PWA = ROOT / 'app/pwa-register.tsx'


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old in text:
        return text.replace(old, new, 1)
    if new in text:
        return text
    raise SystemExit(f'missing pattern: {label}')

profile = '''import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { readStudentAccessToken } from "../../../../lib/server/portal-auth";
import { normalizeClass } from "../../../../lib/unified-roster";

type AttendanceStatus = "present" | "absent" | "late" | "excused" | "escaped";
type AttendanceEntry = { status: AttendanceStatus; updatedAt: string };
type TimetableLesson = { className?: unknown };

const ATTENDANCE_START_DATE = "2026-08-23";
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

  const [attendance, timetable] = await Promise.all([
    adminDb().collection(`${root}/attendance`).get(),
    adminDb().collection(`${root}/timetable`).doc("weekly").get(),
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

  const scheduledWeekdays = new Set<number>();
  const lessons = timetable.exists && timetable.data()?.lessons && typeof timetable.data()?.lessons === "object"
    ? timetable.data()!.lessons as Record<string, TimetableLesson>
    : {};
  Object.entries(lessons).forEach(([cell, lesson]) => {
    const match = cell.match(/^(sunday|monday|tuesday|wednesday|thursday)-[1-7]$/);
    if (!match || !studentClass) return;
    if (normalizeClass(lesson?.className) !== studentClass) return;
    scheduledWeekdays.add(DAY_INDEX[match[1]]);
  });

  const counts = { present: 0, absent: 0, late: 0, excused: 0, escaped: 0, total: 0 };
  let latestDate = "";
  let automaticPresent = 0;

  explicitByDate.forEach((entry, date) => {
    counts[entry.status] += 1;
    counts.total += 1;
    if (date > latestDate) latestDate = date;
  });

  if (scheduledWeekdays.size) {
    const today = riyadhDateInput(new Date());
    const lastCompletedDay = shiftDate(today, -1);
    const cursor = dateObject(ATTENDANCE_START_DATE);
    const end = dateObject(lastCompletedDay);
    while (cursor <= end) {
      const date = cursor.toISOString().slice(0, 10);
      if (scheduledWeekdays.has(cursor.getUTCDay()) && !explicitByDate.has(date)) {
        counts.present += 1;
        counts.total += 1;
        automaticPresent += 1;
        if (date > latestDate) latestDate = date;
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
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
      attendanceSummary: { ...counts, automaticPresent, disciplineRate, latestDate },
    },
    attendanceSource: scheduledWeekdays.size ? "timetable_with_manual_overrides" : "saved_records_only",
    updatedAt: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
'''
PROFILE.write_text(profile, encoding='utf-8')

teacher = TEACHER.read_text(encoding='utf-8')
teacher = replace_once(
    teacher,
    '  const autoFillKeyRef = useRef("");\n',
    '  const autoFillKeyRef = useRef("");\n  const cloudSyncTimerRef = useRef<number | null>(null);\n',
    'cloud sync ref',
)
teacher = replace_once(
    teacher,
    '''  const attendancePath = useMemo(
    () => (teacherId ? tenantCollection(teacherId, subjectKey, "attendance") : ""),
    [teacherId, subjectKey],
  );
''',
    '''  const attendancePath = useMemo(
    () => (teacherId ? tenantCollection(teacherId, subjectKey, "attendance") : ""),
    [teacherId, subjectKey],
  );

  useEffect(() => () => {
    if (cloudSyncTimerRef.current !== null) window.clearTimeout(cloudSyncTimerRef.current);
  }, []);
''',
    'cloud timer cleanup',
)
teacher = replace_once(
    teacher,
    '''  function clearLocalAttendance() {
''',
    '''  function queueCloudAttendanceSync(nextRecords: Record<string, AttendanceStatus>) {
    const className = selectedClass;
    const date = selectedDate;
    const path = attendancePath;
    if (!className || !path || date < ATTENDANCE_START_DATE || isFutureAttendanceDate(date)) return;
    if (cloudSyncTimerRef.current !== null) window.clearTimeout(cloudSyncTimerRef.current);
    cloudSyncTimerRef.current = window.setTimeout(async () => {
      cloudSyncTimerRef.current = null;
      try {
        await withTimeout(setDoc(
          doc(db, path, `${safeId(className)}_${date}`),
          {
            class: className,
            date,
            hijriDate: formatHijri(date),
            records: nextRecords,
            teacherId,
            teacherName,
            subjectKey,
            subject,
            autoSaved: false,
            autoSavedReason: null,
            manualEdited: true,
            manualEditedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          { merge: true },
        ), 5000);
        setMessage("تم تحديث حالة الطالب في بوابة الطالب");
      } catch {
        setMessage("تم حفظ التعديل على الجهاز، وستتم مزامنته عند الضغط على حفظ التحضير أو عودة الاتصال");
      }
    }, 450);
  }

  function clearLocalAttendance() {
''',
    'queue cloud sync',
)
teacher = replace_once(
    teacher,
    '''    persistLocal(next);
    setMessage("تم الحفظ مباشرة");
''',
    '''    persistLocal(next);
    queueCloudAttendanceSync(next);
    setMessage("تم الحفظ مباشرة وجارٍ تحديث بوابة الطالب");
''',
    'status immediate cloud sync',
)
teacher = replace_once(
    teacher,
    '''    persistLocal(records);
    setMessage("تم حفظ التحضير بنجاح");
    setSaving(true);
''',
    '''    persistLocal(records);
    if (cloudSyncTimerRef.current !== null) {
      window.clearTimeout(cloudSyncTimerRef.current);
      cloudSyncTimerRef.current = null;
    }
    setMessage("تم حفظ التحضير بنجاح");
    setSaving(true);
''',
    'clear pending cloud sync',
)
teacher = replace_once(
    teacher,
    '''          subjectKey,
          subject,
          updatedAt: new Date().toISOString(),
''',
    '''          subjectKey,
          subject,
          autoSaved: false,
          autoSavedReason: null,
          manualEdited: true,
          manualEditedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
''',
    'manual save metadata',
)
TEACHER.write_text(teacher, encoding='utf-8')

student = STUDENT.read_text(encoding='utf-8')
student = replace_once(
    student,
    '      if (inFlight || (!force && Date.now() - lastRefresh < 60_000)) return;\n',
    '      if (inFlight || (!force && Date.now() - lastRefresh < 25_000)) return;\n',
    'student refresh throttle',
)
student = replace_once(
    student,
    '''    void refresh(true);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      active = false;
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
''',
    '''    let refreshTimer: number | null = null;
    const scheduleRefresh = () => {
      if (!active) return;
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(async () => {
        refreshTimer = null;
        if (document.visibilityState === "visible") await refresh();
        scheduleRefresh();
      }, 30_000);
    };

    void refresh(true);
    scheduleRefresh();
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      active = false;
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
''',
    'student lightweight refresh',
)
STUDENT.write_text(student, encoding='utf-8')

sw = SW.read_text(encoding='utf-8')
sw = re.sub(r'const CACHE_NAME = "[^"]+";', 'const CACHE_NAME = "ostadh-lahooni-v60-all-subject-attendance";', sw, count=1)
SW.write_text(sw, encoding='utf-8')

pwa = PWA.read_text(encoding='utf-8')
pwa = re.sub(r'const CURRENT_CACHE = "[^"]+";', 'const CURRENT_CACHE = "ostadh-lahooni-v60-all-subject-attendance";', pwa, count=1)
pwa = re.sub(r'const RELOAD_KEY = "[^"]+";', 'const RELOAD_KEY = "ostadh-lahooni-v60-all-subject-attendance";', pwa, count=1)
pwa = re.sub(r'/sw\.js\?v=[^"\']+', '/sw.js?v=60-all-subject-attendance', pwa, count=1)
PWA.write_text(pwa, encoding='utf-8')

print('patched v60 all-subject attendance')
