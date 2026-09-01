from pathlib import Path
import re


def read(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    Path(path).write_text(content, encoding="utf-8")


def replace_required(path: str, old: str, new: str) -> None:
    content = read(path)
    if old not in content:
        raise RuntimeError(f"Expected text not found in {path}: {old[:100]!r}")
    write(path, content.replace(old, new, 1))


page = "app/teacher/attendance/page.tsx"
content = read(page)
content = content.replace(
    'import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from "firebase/firestore";',
    'import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, setDoc } from "firebase/firestore";',
    1,
)
content = content.replace('const ATTENDANCE_START_LABEL = "الأحد 23/8/2026";\n', 'const ATTENDANCE_START_LABEL = "الأحد 23/8/2026";\nconst SCHOOL_DAY_END_HOUR = 15;\n', 1)
content = re.sub(
    r'function toDateInput\(date: Date\) \{.*?\n\}',
    '''function toDateInput(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}''',
    content,
    count=1,
    flags=re.S,
)
content = content.replace(
    '''function attendanceToday() {
  return toDateInput(new Date());
}
''',
    '''function attendanceToday() {
  return toDateInput(new Date());
}

function riyadhHour(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Riyadh",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Number(parts.find(part => part.type === "hour")?.value || 0);
}
''',
    1,
)
content = content.replace('  const loadSequence = useRef(0);\n', '', 1)
content = content.replace(
    '  const cloudSyncTimerRef = useRef<number | null>(null);\n',
    '  const cloudSyncTimerRef = useRef<number | null>(null);\n  const [clockTick, setClockTick] = useState(0);\n',
    1,
)
content = content.replace(
    '''  useEffect(() => () => {
    if (cloudSyncTimerRef.current !== null) window.clearTimeout(cloudSyncTimerRef.current);
  }, []);
''',
    '''  useEffect(() => () => {
    if (cloudSyncTimerRef.current !== null) window.clearTimeout(cloudSyncTimerRef.current);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setClockTick(value => value + 1), 60_000);
    return () => window.clearInterval(timer);
  }, []);
''',
    1,
)
content = content.replace(
    '''    const today = toDateInput(new Date());
    const runKey = `${teacherId}:${subjectKey}:${today}:${students.length}:${Object.keys(timetableLessons).length}`;
''',
    '''    const today = attendanceToday();
    const lastCompletedDate = riyadhHour() >= SCHOOL_DAY_END_HOUR
      ? today
      : toDateInput(new Date(`${today}T12:00:00+03:00`));
    const completedDate = riyadhHour() >= SCHOOL_DAY_END_HOUR
      ? lastCompletedDate
      : (() => {
          const value = new Date(`${today}T12:00:00+03:00`);
          value.setDate(value.getDate() - 1);
          return toDateInput(value);
        })();
    const runKey = `${teacherId}:${subjectKey}:${completedDate}:${students.length}:${Object.keys(timetableLessons).length}`;
''',
    1,
)
content = content.replace(
    '''      const end = new Date(`${today}T12:00:00`);
      end.setDate(end.getDate() - 1);
      const endDate = toDateInput(end);
''',
    '''      const endDate = completedDate;
''',
    1,
)
content = content.replace(
    '  }, [ready, teacherId, teacherName, subjectKey, subject, attendancePath, students, timetableLessons]);',
    '  }, [ready, teacherId, teacherName, subjectKey, subject, attendancePath, students, timetableLessons, clockTick]);',
    1,
)
old_effect_pattern = re.compile(r'''  useEffect\(\(\) => \{\n    const sequence = \+\+loadSequence\.current;.*?  \}, \[selectedClass, selectedDate, classStudents, attendancePath, teacherId, subjectKey\]\);''', re.S)
new_effect = '''  useEffect(() => {
    if (!selectedClass || !attendancePath) {
      setRecords({});
      setHasSavedRecord(false);
      return;
    }
    const defaults = Object.fromEntries(classStudents.map(student => [studentCode(student), "present" as AttendanceStatus]));
    if (selectedDate < ATTENDANCE_START_DATE) {
      setRecords(defaults);
      setHasSavedRecord(false);
      return;
    }

    const key = attendanceKey(teacherId, subjectKey, selectedClass, selectedDate);
    const documentId = `${safeId(selectedClass)}_${selectedDate}`;
    const applyLocalFallback = () => {
      const local = readRecords(key) || readRecords(legacyAttendanceKey(teacherId, subjectKey, selectedClass, selectedDate));
      if (local && !localStorage.getItem(attendanceDeletedKey(teacherId, subjectKey, selectedClass, selectedDate))) {
        setRecords(Object.fromEntries(classStudents.map(student => [studentCode(student), local[studentCode(student)] || "present"])));
        setHasSavedRecord(true);
      } else {
        setRecords(defaults);
        setHasSavedRecord(false);
      }
    };
    applyLocalFallback();

    const unsubscribe = onSnapshot(
      doc(db, attendancePath, documentId),
      snapshot => {
        if (!snapshot.exists()) {
          applyLocalFallback();
          return;
        }
        const data = snapshot.data() as AttendanceDocument;
        const saved = data.records || {};
        const next = Object.fromEntries(classStudents.map(student => [studentCode(student), saved[studentCode(student)] || saved[student.id] || "present"])) as Record<string, AttendanceStatus>;
        setRecords(next);
        setHasSavedRecord(true);
        localStorage.setItem(key, JSON.stringify(next));
        localStorage.setItem(`${key}:details`, JSON.stringify(data));
        const index = readAttendanceIndex(teacherId, subjectKey);
        index[documentId] = data;
        localStorage.setItem(attendanceIndexKey(teacherId, subjectKey), JSON.stringify(index));
        localStorage.removeItem(attendanceDeletedKey(teacherId, subjectKey, selectedClass, selectedDate));
      },
      () => applyLocalFallback(),
    );

    return unsubscribe;
  }, [selectedClass, selectedDate, classStudents, attendancePath, teacherId, subjectKey]);'''
content, count = old_effect_pattern.subn(new_effect, content, count=1)
if count != 1:
    raise RuntimeError("Attendance load effect was not replaced")
content = content.replace(
    '    setHasSavedRecord(true);\n  }\n\n  function queueCloudAttendanceSync',
    '    setHasSavedRecord(true);\n    window.dispatchEvent(new CustomEvent("lahooni:attendance-updated", { detail: payload }));\n  }\n\n  function queueCloudAttendanceSync',
    1,
)
content = content.replace('setMessage("تم تحديث حالة الطالب في بوابة الطالب");', 'setMessage("تمت مزامنة التعديل فورًا في التطبيق والويب وبوابة الطالب");', 1)
content = content.replace('setMessage("تم الحفظ مباشرة وجارٍ تحديث بوابة الطالب");', 'setMessage("تم الحفظ مباشرة وجارٍ توحيد التعديل في التطبيق والويب وبوابة الطالب");', 1)
content = content.replace('setMessage("تم حفظ التحضير ومزامنته بنجاح");', 'setMessage("تم حفظ التحضير ومزامنته في التطبيق والويب وبوابة الطالب");', 1)
content = content.replace('<span>حفظ فوري</span><span>مرتبط بالجدول</span><span>تعويض تلقائي للأيام الفائتة</span><span>تقارير جاهزة</span>', '<span>مزامنة لحظية بين التطبيق والويب</span><span>مرتبط بالجدول</span><span>تحضير تلقائي بعد نهاية اليوم</span><span>تقارير جاهزة</span>', 1)
content = content.replace('onClick={() => setSelectedDate(clampAttendanceDate(toDateInput(new Date())))}', 'onClick={() => setSelectedDate(attendanceToday())}', 1)
content = content.replace('type="date" min={ATTENDANCE_START_DATE} value={selectedDate}', 'type="date" min={ATTENDANCE_START_DATE} max={attendanceToday()} value={selectedDate}', 1)
write(page, content)

# Keep future attendance locked until midnight in Riyadh.
guard = "app/teacher/attendance/attendance-schedule-guard.tsx"
guard_content = read(guard)
guard_content = re.sub(
    r'function dateInput\(date: Date\) \{.*?\n\}',
    '''function dateInput(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}''',
    guard_content,
    count=1,
    flags=re.S,
)
guard_content = guard_content.replace(
    'setNotice("يفتح تحضير هذا اليوم عند الساعة 12:00 منتصف الليل مع بداية اليوم نفسه.");',
    'setNotice("تحضير الغد مقفول حتى الساعة 12:00 منتصف الليل بتوقيت الرياض.");',
)
guard_content = guard_content.replace(
    'setAllowedDate(today, "لا يفتح تحضير اليوم قبل الساعة 12:00 منتصف الليل مع بداية اليوم نفسه.");',
    'setAllowedDate(today, "تحضير الغد مقفول حتى الساعة 12:00 منتصف الليل بتوقيت الرياض.");',
)
write(guard, guard_content)

# Student portal refreshes attendance changes quickly across devices.
student = "app/student/page.tsx"
student_content = read(student)
student_content = student_content.replace('Date.now() - lastRefresh < 25_000', 'Date.now() - lastRefresh < 7_000', 1)
student_content = student_content.replace('      }, 30_000);', '      }, 10_000);', 1)
write(student, student_content)

# Force all installed web/app shells onto the new build.
for path in ["public/sw.js", "app/pwa-register.tsx"]:
    text = read(path).replace("v72-mobile-web-sync", "v73-attendance-realtime")
    text = text.replace("72-mobile-web-sync", "73-attendance-realtime")
    write(path, text)

print("Applied attendance realtime v73: shared cloud state, Riyadh midnight lock, automatic completed-day attendance, and faster student refresh.")
