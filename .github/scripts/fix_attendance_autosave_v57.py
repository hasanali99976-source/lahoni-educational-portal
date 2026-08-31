from pathlib import Path

ROOT = Path('.')
PAGE = ROOT / 'app/teacher/attendance/page.tsx'
ATTENDANCE_CSS = ROOT / 'app/teacher/attendance/attendance.css'
NAV_CSS = ROOT / 'app/mobile-app-nav-fix.css'
SW = ROOT / 'public/sw.js'
PWA = ROOT / 'app/pwa-register.tsx'


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'missing pattern: {label}')
    return text.replace(old, new, 1)

page = PAGE.read_text(encoding='utf-8')

page = replace_once(
    page,
    'const ATTENDANCE_START_LABEL = "الأحد 23/8/2026";\nconst STATUS_LABELS',
    'const ATTENDANCE_START_LABEL = "الأحد 23/8/2026";\nconst TIMETABLE_DAY_INDEX = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4 } as const;\nconst STATUS_LABELS',
    'weekday map',
)

page = replace_once(
    page,
    'function attendanceIndexKey(teacherId: string, subjectKey: string) {\n  return `lahooni-attendance-index:${teacherId}:${subjectKey}`;\n}\n',
    'function attendanceIndexKey(teacherId: string, subjectKey: string) {\n  return `lahooni-attendance-index:${teacherId}:${subjectKey}`;\n}\n\nfunction attendanceDeletedKey(teacherId: string, subjectKey: string, className: string, date: string) {\n  return `lahooni-attendance-deleted:${teacherId}:${subjectKey}:${safeId(className)}:${date}`;\n}\n',
    'deleted marker helper',
)

page = replace_once(
    page,
    '  const [timetableClasses, setTimetableClasses] = useState<string[]>([]);\n',
    '  const [timetableClasses, setTimetableClasses] = useState<string[]>([]);\n  const [timetableLessons, setTimetableLessons] = useState<Record<string, TimetableLesson>>({});\n',
    'timetable lessons state',
)

page = replace_once(
    page,
    '  const loadSequence = useRef(0);\n',
    '  const loadSequence = useRef(0);\n  const autoFillKeyRef = useRef("");\n',
    'autofill ref',
)

old_timetable = '''      .then(data => {
        const lessons = data.lessons && typeof data.lessons === "object"
          ? Object.values(data.lessons as Record<string, TimetableLesson>)
          : [];
        setTimetableClasses([...new Set(lessons.map(lesson => normalizeClass(lesson.className)).filter(Boolean))]);
      })
      .catch(() => setTimetableClasses([]));'''
new_timetable = '''      .then(data => {
        const lessonMap = data.lessons && typeof data.lessons === "object"
          ? data.lessons as Record<string, TimetableLesson>
          : {};
        const lessons = Object.values(lessonMap);
        setTimetableLessons(lessonMap);
        setTimetableClasses([...new Set(lessons.map(lesson => normalizeClass(lesson.className)).filter(Boolean))]);
      })
      .catch(() => {
        setTimetableLessons({});
        setTimetableClasses([]);
      });'''
page = replace_once(page, old_timetable, new_timetable, 'timetable response')

insert_before = '  const classStudents = useMemo(\n'
auto_fill_effect = '''  useEffect(() => {
    if (!ready || !teacherId || !attendancePath || !students.length || !Object.keys(timetableLessons).length) return;
    const today = toDateInput(new Date());
    const runKey = `${teacherId}:${subjectKey}:${today}:${students.length}:${Object.keys(timetableLessons).length}`;
    if (autoFillKeyRef.current === runKey) return;
    autoFillKeyRef.current = runKey;
    let active = true;

    async function autoSaveMissedScheduledDays() {
      const end = new Date(`${today}T12:00:00`);
      end.setDate(end.getDate() - 1);
      const endDate = toDateInput(end);
      if (endDate < ATTENDANCE_START_DATE) return;

      const rosterByClass = new Map<string, UnifiedStudent[]>();
      students.forEach(student => {
        const className = normalizeClass(student.class) || clean(student.class);
        if (!className) return;
        rosterByClass.set(className, [...(rosterByClass.get(className) || []), student]);
      });

      const scheduleByDay = new Map<number, Set<string>>();
      Object.entries(timetableLessons).forEach(([cell, lesson]) => {
        const match = cell.match(/^(sunday|monday|tuesday|wednesday|thursday)-[1-7]$/);
        const className = normalizeClass(lesson.className) || clean(lesson.className);
        if (!match || !className) return;
        const weekday = TIMETABLE_DAY_INDEX[match[1] as keyof typeof TIMETABLE_DAY_INDEX];
        const classes = scheduleByDay.get(weekday) || new Set<string>();
        classes.add(className);
        scheduleByDay.set(weekday, classes);
      });
      if (!scheduleByDay.size) return;

      const existing = new Set<string>();
      const localIndex = readAttendanceIndex(teacherId, subjectKey);
      Object.values(localIndex).forEach(item => {
        const className = normalizeClass(item.class) || clean(item.class);
        if (className && item.date) existing.add(`${className}|${item.date}`);
      });
      try {
        const snapshot = await withTimeout(getDocs(collection(db, attendancePath)), 6500);
        snapshot.docs.forEach(item => {
          const data = item.data() as AttendanceDocument;
          const className = normalizeClass(data.class) || clean(data.class);
          if (className && data.date) existing.add(`${className}|${data.date}`);
        });
      } catch {
        // النسخة المحلية تكفي لإكمال الأيام غير المسجلة عند ضعف الاتصال.
      }

      const pending: { className: string; date: string; records: Record<string, AttendanceStatus> }[] = [];
      const cursor = new Date(`${ATTENDANCE_START_DATE}T12:00:00`);
      const last = new Date(`${endDate}T12:00:00`);
      while (cursor <= last) {
        const date = toDateInput(cursor);
        const classes = scheduleByDay.get(cursor.getDay());
        classes?.forEach(className => {
          const canonical = normalizeClass(className) || className;
          const roster = rosterByClass.get(canonical) || [];
          if (!roster.length || existing.has(`${canonical}|${date}`)) return;
          if (localStorage.getItem(attendanceDeletedKey(teacherId, subjectKey, canonical, date))) return;
          pending.push({
            className: canonical,
            date,
            records: Object.fromEntries(roster.map(student => [studentCode(student), "present" as AttendanceStatus])),
          });
          existing.add(`${canonical}|${date}`);
        });
        cursor.setDate(cursor.getDate() + 1);
      }
      if (!pending.length) return;

      const nextIndex = readAttendanceIndex(teacherId, subjectKey);
      let saved = 0;
      for (const item of pending) {
        if (!active) return;
        const payload = {
          class: item.className,
          date: item.date,
          hijriDate: formatHijri(item.date),
          records: item.records,
          teacherId,
          teacherName,
          subjectKey,
          subject,
          autoSaved: true,
          autoSavedReason: "missed_scheduled_day",
          updatedAt: new Date().toISOString(),
        };
        try {
          await withTimeout(setDoc(doc(db, attendancePath, `${safeId(item.className)}_${item.date}`), payload, { merge: true }), 5000);
        } catch {
          // يحفظ محليًا ويُعاد دمجه عند توفر الاتصال.
        }
        const key = attendanceKey(teacherId, subjectKey, item.className, item.date);
        localStorage.setItem(key, JSON.stringify(item.records));
        localStorage.setItem(`${key}:details`, JSON.stringify(payload));
        nextIndex[`${safeId(item.className)}_${item.date}`] = payload;
        saved += 1;
      }
      localStorage.setItem(attendanceIndexKey(teacherId, subjectKey), JSON.stringify(nextIndex));
      if (active && saved) setMessage(`تم الحفظ التلقائي لـ ${saved} تحضير فائت حسب جدول المعلم، والحالة الافتراضية لجميع الطلاب: حاضر.`);
    }

    void autoSaveMissedScheduledDays();
    return () => { active = false; };
  }, [ready, teacherId, teacherName, subjectKey, subject, attendancePath, students, timetableLessons]);

'''
if insert_before not in page:
    raise SystemExit('missing classStudents insertion point')
page = page.replace(insert_before, auto_fill_effect + insert_before, 1)

page = replace_once(
    page,
    '    localStorage.setItem(attendanceIndexKey(teacherId, subjectKey), JSON.stringify(index));\n    setHasSavedRecord(true);\n',
    '    localStorage.setItem(attendanceIndexKey(teacherId, subjectKey), JSON.stringify(index));\n    localStorage.removeItem(attendanceDeletedKey(teacherId, subjectKey, selectedClass, selectedDate));\n    setHasSavedRecord(true);\n',
    'clear deleted marker on save',
)

page = replace_once(
    page,
    '    localStorage.setItem(attendanceIndexKey(teacherId, subjectKey), JSON.stringify(index));\n  }\n\n  function setStudentStatus',
    '    localStorage.setItem(attendanceIndexKey(teacherId, subjectKey), JSON.stringify(index));\n    localStorage.setItem(attendanceDeletedKey(teacherId, subjectKey, selectedClass, selectedDate), "1");\n  }\n\n  function setStudentStatus',
    'mark intentional deletion',
)

page = replace_once(
    page,
    '<div className="attendance-hero-badges"><span>حفظ فوري</span><span>مرتبط بالجدول</span><span>تقارير جاهزة</span></div>',
    '<div className="attendance-hero-badges"><span>حفظ فوري</span><span>مرتبط بالجدول</span><span>تعويض تلقائي للأيام الفائتة</span><span>تقارير جاهزة</span></div>',
    'autofill badge',
)

PAGE.write_text(page, encoding='utf-8')

attendance_css = ATTENDANCE_CSS.read_text(encoding='utf-8')
marker = '/* v57 attendance actions spacing and stable icons */'
if marker not in attendance_css:
    attendance_css += '''\n\n/* v57 attendance actions spacing and stable icons */
.attendance-command-center .attendance-main-actions{align-items:stretch}
.attendance-command-center .attendance-main-actions button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-width:0;max-width:none;white-space:normal;text-align:center;line-height:1.25;overflow:hidden}
.attendance-command-center .attendance-day-nav button,.attendance-command-center .status-buttons button{overflow:hidden;text-overflow:ellipsis}
@media(min-width:1101px){
  .attendance-command-center .attendance-setup-panel{grid-template-columns:minmax(0,1fr) minmax(500px,.92fr)}
  .attendance-command-center .attendance-main-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));width:100%}
}
@media(max-width:1100px){
  .attendance-command-center .attendance-main-actions{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));width:100%}
}
@media(max-width:760px){
  .attendance-command-center .attendance-main-actions{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:9px}
  .attendance-command-center .attendance-main-actions .attendance-save{grid-column:auto!important}
  .attendance-command-center .attendance-main-actions button{min-height:50px;padding:8px 10px;font-size:.78rem}
}
@media(max-width:430px){
  .attendance-command-center .attendance-main-actions{grid-template-columns:1fr!important}
  .attendance-command-center .attendance-main-actions button{width:100%}
}
'''
ATTENDANCE_CSS.write_text(attendance_css, encoding='utf-8')

nav_css = NAV_CSS.read_text(encoding='utf-8')
nav_marker = '/* v57 fixed mobile navigation icon boxes */'
if nav_marker not in nav_css:
    nav_css += '''\n\n/* v57 fixed mobile navigation icon boxes */
@media(max-width:720px){
  .mobile-app-nav{grid-auto-columns:minmax(58px,1fr)!important;gap:5px!important}
  .mobile-app-nav a{min-width:58px!important;max-width:none!important;overflow:hidden!important;isolation:isolate}
  .mobile-app-nav .mobile-nav-icon{display:grid!important;place-items:center!important;width:26px!important;height:26px!important;min-width:26px!important;max-width:26px!important;min-height:26px!important;max-height:26px!important;margin:0 auto!important;overflow:hidden!important;line-height:1!important}
  .mobile-app-nav .mobile-nav-svg{display:block!important;width:22px!important;height:22px!important;min-width:22px!important;max-width:22px!important;min-height:22px!important;max-height:22px!important;overflow:visible!important}
  .mobile-app-nav a b{display:block!important;width:100%!important;line-height:1.15!important;text-align:center!important}
}
@media(max-width:390px){
  .mobile-app-nav{grid-auto-columns:56px!important}
  .mobile-app-nav a{min-width:56px!important}
  .mobile-app-nav .mobile-nav-icon{width:24px!important;height:24px!important;min-width:24px!important;max-width:24px!important;min-height:24px!important;max-height:24px!important}
  .mobile-app-nav .mobile-nav-svg{width:20px!important;height:20px!important;min-width:20px!important;max-width:20px!important;min-height:20px!important;max-height:20px!important}
}
'''
NAV_CSS.write_text(nav_css, encoding='utf-8')

sw = SW.read_text(encoding='utf-8')
import re
sw = re.sub(r'const CACHE_NAME = "[^"]+";', 'const CACHE_NAME = "ostadh-lahooni-v57-attendance-autosave-icons";', sw, count=1)
SW.write_text(sw, encoding='utf-8')

pwa = PWA.read_text(encoding='utf-8')
pwa = re.sub(r'const CURRENT_CACHE = "[^"]+";', 'const CURRENT_CACHE = "ostadh-lahooni-v57-attendance-autosave-icons";', pwa, count=1)
pwa = re.sub(r'const RELOAD_KEY = "[^"]+";', 'const RELOAD_KEY = "ostadh-lahooni-v57-attendance-autosave-icons";', pwa, count=1)
pwa = re.sub(r'/sw\.js\?v=[^"\']+', '/sw.js?v=57-attendance-autosave-icons', pwa, count=1)
PWA.write_text(pwa, encoding='utf-8')

print('patched attendance autosave and icon spacing v57')
