from pathlib import Path

path = Path("app/teacher/attendance/page.tsx")
source = path.read_text(encoding="utf-8")

# Remove the historical automatic backfill effect. It could rewrite many attendance
# documents on every fresh browser/device because its "existing" set was local-only.
start = source.find('  useEffect(() => {\n    if (!ready || !teacherId || !attendancePath || !students.length || !Object.keys(timetableLessons).length) return;\n    const today = attendanceToday();')
end_marker = '  }, [ready, teacherId, teacherName, subjectKey, subject, attendancePath, students, timetableLessons]);\n\n'
if start != -1:
    end = source.find(end_marker, start)
    if end == -1:
        raise SystemExit('attendance autobackfill end marker not found')
    source = source[:start] + source[end + len(end_marker):]
elif 'autoSaveMissedScheduledDays' in source:
    raise SystemExit('attendance autobackfill shape changed; refusing unsafe patch')

# Remove no-longer-used autobackfill-only symbols if present.
source = source.replace('const SCHOOL_DAY_END_HOUR = 15;\n', '')
source = source.replace('const TIMETABLE_DAY_INDEX = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4 } as const;\n', '')
source = source.replace('function riyadhHour(date = new Date()) {\n  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Riyadh", hour: "2-digit", hourCycle: "h23" }).formatToParts(date);\n  return Number(parts.find(part => part.type === "hour")?.value || 0);\n}\n', '')
source = source.replace(' const autoFillKeyRef=useRef("");', '')

path.write_text(source, encoding="utf-8")

audit = Path("scripts/runtime-audit.mjs")
audit_source = audit.read_text(encoding="utf-8")
marker = "// FINAL_DRAIN_GUARD_ATTENDANCE_AUTOBACKFILL"
if marker not in audit_source:
    audit_source += '''\n\n// FINAL_DRAIN_GUARD_ATTENDANCE_AUTOBACKFILL\nforbid(\n  "app/teacher/attendance/page.tsx",\n  /autoSaveMissedScheduledDays|missed_scheduled_day|autoFillKeyRef/,\n  "صفحة الحضور يجب ألا تنشئ أو تعيد كتابة تحاضير تاريخية تلقائيًا عند مجرد فتح الصفحة.",\n);\nforbid(\n  "app/teacher/attendance/page.tsx",\n  /\\bonSnapshot\\s*\\(|\\bsetInterval\\s*\\(/,\n  "صفحة الحضور النشطة يجب ألا تستخدم listener حيًا أو polling دوريًا.",\n);\n'''
    audit.write_text(audit_source, encoding="utf-8")

print('attendance historical autobackfill cleanup ready')
