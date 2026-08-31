from pathlib import Path
import re

ROOT = Path('.')
PAGE = ROOT / 'app/teacher/attendance/page.tsx'
GUARD = ROOT / 'app/teacher/attendance/attendance-schedule-guard.tsx'
NAV = ROOT / 'app/mobile-app-nav-fix.css'
SW = ROOT / 'public/sw.js'
PWA = ROOT / 'app/pwa-register.tsx'


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old in text:
        return text.replace(old, new, 1)
    if new in text:
        return text
    raise SystemExit(f'missing pattern: {label}')

page = PAGE.read_text(encoding='utf-8')
page = replace_once(
    page,
    '''function clampAttendanceDate(value: string) {
  return value && value < ATTENDANCE_START_DATE ? ATTENDANCE_START_DATE : value;
}
''',
    '''function attendanceToday() {
  return toDateInput(new Date());
}

function isFutureAttendanceDate(value: string) {
  return Boolean(value && value > attendanceToday());
}

function clampAttendanceDate(value: string) {
  const today = attendanceToday();
  if (!value) return today;
  if (value < ATTENDANCE_START_DATE) return ATTENDANCE_START_DATE;
  return value > today ? today : value;
}
''',
    'date clamp',
)
page = replace_once(
    page,
    '    if (!selectedClass || !teacherId || selectedDate < ATTENDANCE_START_DATE) return;\n',
    '    if (!selectedClass || !teacherId || selectedDate < ATTENDANCE_START_DATE || isFutureAttendanceDate(selectedDate)) return;\n',
    'local persistence future guard',
)
page = replace_once(
    page,
    '''  function setStudentStatus(student: UnifiedStudent, status: AttendanceStatus) {
    if (selectedDate < ATTENDANCE_START_DATE) {
      setMessage(`يبدأ التحضير من ${ATTENDANCE_START_LABEL} ولا يمكن التسجيل قبل هذا التاريخ.`);
      return;
    }
''',
    '''  function setStudentStatus(student: UnifiedStudent, status: AttendanceStatus) {
    if (selectedDate < ATTENDANCE_START_DATE) {
      setMessage(`يبدأ التحضير من ${ATTENDANCE_START_LABEL} ولا يمكن التسجيل قبل هذا التاريخ.`);
      return;
    }
    if (isFutureAttendanceDate(selectedDate)) {
      setMessage("لا يفتح تحضير اليوم إلا عند الساعة 12:00 منتصف الليل مع بداية اليوم نفسه.");
      return;
    }
''',
    'student status future guard',
)
page = replace_once(
    page,
    '''  async function saveAttendance() {
    if (!selectedClass || !attendancePath) return setMessage("اختر الفصل أولًا");
    if (selectedDate < ATTENDANCE_START_DATE) return setMessage(`يبدأ التحضير من ${ATTENDANCE_START_LABEL} ولا يمكن الحفظ قبل هذا التاريخ.`);
''',
    '''  async function saveAttendance() {
    if (!selectedClass || !attendancePath) return setMessage("اختر الفصل أولًا");
    if (selectedDate < ATTENDANCE_START_DATE) return setMessage(`يبدأ التحضير من ${ATTENDANCE_START_LABEL} ولا يمكن الحفظ قبل هذا التاريخ.`);
    if (isFutureAttendanceDate(selectedDate)) return setMessage("لا يفتح تحضير اليوم إلا عند الساعة 12:00 منتصف الليل مع بداية اليوم نفسه.");
''',
    'save future guard',
)
PAGE.write_text(page, encoding='utf-8')

guard = GUARD.read_text(encoding='utf-8')
guard = replace_once(
    guard,
    '''  const selectedIsSaved = localSaved || remoteSaved;
  const locked = guardEnabled && !isScheduled && !selectedIsSaved;
''',
    '''  const selectedIsSaved = localSaved || remoteSaved;
  const today = dateInput(new Date());
  const futureDateLocked = Boolean(selectedDate && selectedDate > today);
  const locked = futureDateLocked || (guardEnabled && !isScheduled && !selectedIsSaved);
''',
    'guard future lock',
)
guard = replace_once(
    guard,
    '''  const setAllowedDate = useCallback((value: string, text = "") => {
    if (!value) return;
    programmatic.current = true;
''',
    '''  const setAllowedDate = useCallback((value: string, text = "") => {
    if (!value) return;
    const today = dateInput(new Date());
    if (value > today) {
      setNotice("يفتح تحضير هذا اليوم عند الساعة 12:00 منتصف الليل مع بداية اليوم نفسه.");
      return;
    }
    programmatic.current = true;
''',
    'allowed date future guard',
)
guard = replace_once(
    guard,
    '''    const sync = () => {
      const controls = dailyControls();
      if (controls.classSelect) setSelectedClass(controls.classSelect.value);
      if (controls.dateInput?.value) setSelectedDate(controls.dateInput.value);
    };
''',
    '''    const sync = () => {
      const controls = dailyControls();
      if (controls.classSelect) setSelectedClass(controls.classSelect.value);
      if (controls.dateInput) {
        controls.dateInput.max = dateInput(new Date());
        if (controls.dateInput.value > controls.dateInput.max) putDateOnPage(controls.dateInput.max);
        if (controls.dateInput.value) setSelectedDate(controls.dateInput.value);
      }
    };
''',
    'date input max',
)
guard = replace_once(
    guard,
    '''      if (target === controls.dateInput && controls.dateInput) {
        const value = controls.dateInput.value;
        setSelectedDate(value);
        if (programmatic.current) return;
''',
    '''      if (target === controls.dateInput && controls.dateInput) {
        const value = controls.dateInput.value;
        const today = dateInput(new Date());
        if (value > today) {
          setAllowedDate(today, "لا يفتح تحضير اليوم قبل الساعة 12:00 منتصف الليل مع بداية اليوم نفسه.");
          return;
        }
        setSelectedDate(value);
        if (programmatic.current) return;
''',
    'date change future guard',
)
GUARD.write_text(guard, encoding='utf-8')

nav = NAV.read_text(encoding='utf-8')
marker = '/* v59 single-row scrollable mobile tabs */'
if marker not in nav:
    nav += '''\n\n/* v59 single-row scrollable mobile tabs */
@media(max-width:720px){
  body{padding-bottom:calc(82px + var(--mobile-safe-bottom, env(safe-area-inset-bottom,0px)))!important}
  .teacher-main{padding-bottom:calc(102px + env(safe-area-inset-bottom,0px))!important}
  .mobile-app-nav{
    display:grid!important;
    grid-auto-flow:column!important;
    grid-auto-columns:72px!important;
    grid-template-columns:none!important;
    grid-template-rows:60px!important;
    gap:6px!important;
    overflow-x:auto!important;
    overflow-y:hidden!important;
    max-width:calc(100dvw - 16px)!important;
    padding:7px!important;
    scroll-snap-type:x proximity;
    scrollbar-width:none!important;
    overscroll-behavior-inline:contain;
  }
  .mobile-app-nav::-webkit-scrollbar{display:none!important}
  .mobile-app-nav a{
    width:72px!important;
    min-width:72px!important;
    max-width:72px!important;
    min-height:60px!important;
    max-height:60px!important;
    display:grid!important;
    grid-template-rows:27px 15px!important;
    place-items:center!important;
    align-content:center!important;
    gap:3px!important;
    padding:5px 4px!important;
    overflow:hidden!important;
    scroll-snap-align:center;
  }
  .mobile-app-nav .mobile-nav-icon{
    width:26px!important;height:26px!important;
    min-width:26px!important;max-width:26px!important;
    min-height:26px!important;max-height:26px!important;
    margin:0!important;
    overflow:hidden!important;
  }
  .mobile-app-nav .mobile-nav-svg{
    width:21px!important;height:21px!important;
    min-width:21px!important;max-width:21px!important;
    min-height:21px!important;max-height:21px!important;
  }
  .mobile-app-nav a b{
    width:66px!important;
    height:15px!important;
    line-height:15px!important;
    font-size:9px!important;
    overflow:hidden!important;
    white-space:nowrap!important;
    text-overflow:ellipsis!important;
    text-align:center!important;
  }
}
@media(max-width:390px){
  .mobile-app-nav{grid-auto-columns:68px!important;grid-template-rows:57px!important}
  .mobile-app-nav a{width:68px!important;min-width:68px!important;max-width:68px!important;min-height:57px!important;max-height:57px!important}
  .mobile-app-nav a b{width:62px!important}
}
'''
NAV.write_text(nav, encoding='utf-8')

sw = SW.read_text(encoding='utf-8')
sw = re.sub(r'const CACHE_NAME = "[^"]+";', 'const CACHE_NAME = "ostadh-lahooni-v59-midnight-lock-tabs";', sw, count=1)
SW.write_text(sw, encoding='utf-8')

pwa = PWA.read_text(encoding='utf-8')
pwa = re.sub(r'const CURRENT_CACHE = "[^"]+";', 'const CURRENT_CACHE = "ostadh-lahooni-v59-midnight-lock-tabs";', pwa, count=1)
pwa = re.sub(r'const RELOAD_KEY = "[^"]+";', 'const RELOAD_KEY = "ostadh-lahooni-v59-midnight-lock-tabs";', pwa, count=1)
pwa = re.sub(r'/sw\.js\?v=[^"\']+', '/sw.js?v=59-midnight-lock-tabs', pwa, count=1)
PWA.write_text(pwa, encoding='utf-8')

print('patched v59')
