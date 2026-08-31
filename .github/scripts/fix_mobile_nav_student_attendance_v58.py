from pathlib import Path
import re

ROOT = Path('.')
NAV = ROOT / 'app/mobile-app-nav-fix.css'
PROFILE = ROOT / 'app/api/student/profile/route.ts'
LOOKUP = ROOT / 'app/api/student/lookup/route.ts'
SW = ROOT / 'public/sw.js'
PWA = ROOT / 'app/pwa-register.tsx'

START_DATE = '2026-08-23'

nav = NAV.read_text(encoding='utf-8')
marker = '/* v58 teacher mobile nav two rows */'
if marker not in nav:
    nav += '''\n\n/* v58 teacher mobile nav two rows */
@media(max-width:720px){
  body{padding-bottom:calc(146px + var(--mobile-safe-bottom, env(safe-area-inset-bottom,0px)))!important}
  .teacher-main{padding-bottom:calc(164px + env(safe-area-inset-bottom,0px))!important}
  .mobile-app-nav{
    grid-auto-flow:row!important;
    grid-auto-columns:unset!important;
    grid-template-columns:repeat(3,minmax(0,1fr))!important;
    grid-template-rows:repeat(2,56px)!important;
    gap:6px!important;
    overflow:visible!important;
    max-width:calc(100dvw - 16px)!important;
    padding:7px!important;
  }
  .mobile-app-nav a{
    width:100%!important;
    min-width:0!important;
    min-height:56px!important;
    max-height:56px!important;
    display:grid!important;
    grid-template-rows:25px 14px!important;
    place-items:center!important;
    align-content:center!important;
    gap:3px!important;
    padding:5px 2px!important;
    overflow:hidden!important;
  }
  .mobile-app-nav .mobile-nav-icon{
    width:24px!important;height:24px!important;
    min-width:24px!important;max-width:24px!important;
    min-height:24px!important;max-height:24px!important;
    margin:0!important;
  }
  .mobile-app-nav .mobile-nav-svg{
    width:20px!important;height:20px!important;
    min-width:20px!important;max-width:20px!important;
    min-height:20px!important;max-height:20px!important;
  }
  .mobile-app-nav a b{
    width:100%!important;
    height:14px!important;
    line-height:14px!important;
    font-size:9px!important;
    overflow:hidden!important;
    white-space:nowrap!important;
    text-overflow:ellipsis!important;
  }
}
@media(max-width:390px){
  .mobile-app-nav{grid-template-rows:repeat(2,53px)!important;gap:5px!important;padding:6px!important}
  .mobile-app-nav a{min-height:53px!important;max-height:53px!important}
}
'''
NAV.write_text(nav, encoding='utf-8')

profile = PROFILE.read_text(encoding='utf-8')
if 'const ATTENDANCE_START_DATE = "2026-08-23";' not in profile:
    profile = profile.replace(
        'type AttendanceStatus = "present" | "absent" | "late" | "excused" | "escaped";\n',
        'type AttendanceStatus = "present" | "absent" | "late" | "excused" | "escaped";\n\nconst ATTENDANCE_START_DATE = "2026-08-23";\n',
        1,
    )
old = '''  for (const record of attendance.docs) {
    const data = record.data();
    const status = data?.records?.[access.studentId] as AttendanceStatus | undefined;
    if (!status || !(status in counts)) continue;
    counts[status] += 1;
    counts.total += 1;
    if (typeof data.date === "string" && data.date > latestDate) latestDate = data.date;
  }
'''
new = '''  for (const record of attendance.docs) {
    const data = record.data();
    const date = typeof data.date === "string" ? data.date : "";
    if (!date || date < ATTENDANCE_START_DATE) continue;
    const status = data?.records?.[access.studentId] as AttendanceStatus | undefined;
    if (!status || !(status in counts)) continue;
    counts[status] += 1;
    counts.total += 1;
    if (date > latestDate) latestDate = date;
  }
'''
if old not in profile and new not in profile:
    raise SystemExit('profile attendance loop not found')
profile = profile.replace(old, new, 1)
PROFILE.write_text(profile, encoding='utf-8')

lookup = LOOKUP.read_text(encoding='utf-8')
old_lookup = '''        accessToken,
        data: item.data,
      };
'''
new_lookup = '''        accessToken,
        data: {
          ...item.data,
          absences: 0,
          late: 0,
          attendanceSummary: {
            present: 0,
            absent: 0,
            late: 0,
            excused: 0,
            escaped: 0,
            total: 0,
            disciplineRate: 100,
            latestDate: "",
          },
        },
      };
'''
if old_lookup not in lookup and new_lookup not in lookup:
    raise SystemExit('lookup match data pattern not found')
lookup = lookup.replace(old_lookup, new_lookup, 1)
LOOKUP.write_text(lookup, encoding='utf-8')

sw = SW.read_text(encoding='utf-8')
sw = re.sub(r'const CACHE_NAME = "[^"]+";', 'const CACHE_NAME = "ostadh-lahooni-v58-nav-student-attendance";', sw, count=1)
SW.write_text(sw, encoding='utf-8')

pwa = PWA.read_text(encoding='utf-8')
pwa = re.sub(r'const CURRENT_CACHE = "[^"]+";', 'const CURRENT_CACHE = "ostadh-lahooni-v58-nav-student-attendance";', pwa, count=1)
pwa = re.sub(r'const RELOAD_KEY = "[^"]+";', 'const RELOAD_KEY = "ostadh-lahooni-v58-nav-student-attendance";', pwa, count=1)
pwa = re.sub(r'/sw\.js\?v=[^"\']+', '/sw.js?v=58-nav-student-attendance', pwa, count=1)
PWA.write_text(pwa, encoding='utf-8')

print('patched v58')
