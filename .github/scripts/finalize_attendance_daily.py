from pathlib import Path

p = Path('app/teacher/attendance/page.tsx')
s = p.read_text(encoding='utf-8')

# Stop cloud writes on every status tap. Keep local instant state; cloud writes only on explicit Save.
s = s.replace(' const code=studentCode(student); const next={...records,[code]:status}; setRecords(next); persistLocal(next); queueCloudAttendanceSync(next); setMessage("تم الحفظ مباشرة وجارٍ توحيد التعديل في التطبيق والويب وبوابة الطالب");}', ' const code=studentCode(student); const next={...records,[code]:status}; setRecords(next); persistLocal(next); setMessage("تم تحديث الحالة محليًا. اضغط حفظ التحضير لمزامنتها مع التطبيق وبوابة الطالب");}')

# Daily page already inherits the selected teacher subject; make that explicit and avoid presenting another subject choice.
s = s.replace('<span className="attendance-eyebrow">بوابة تحضير الطلاب</span><h1>التحضير اليومي — {subject}</h1>', '<span className="attendance-eyebrow">التحضير اليومي</span><h1>{subject || "المادة الحالية"}</h1>')

# Remove unused debounced cloud writer after changing status taps to local-only.
start = s.find('  function queueCloudAttendanceSync(')
end = s.find('  function clearLocalAttendance()', start)
if start != -1 and end != -1:
    s = s[:start] + s[end:]

# Remove timer ref and cleanup if no longer needed.
s = s.replace(' const [allPdfBusy,setAllPdfBusy]=useState(false); const cloudSyncTimerRef=useRef<number|null>(null);', ' const [allPdfBusy,setAllPdfBusy]=useState(false);')
s = s.replace('  useEffect(() => () => { if (cloudSyncTimerRef.current !== null) window.clearTimeout(cloudSyncTimerRef.current); }, []);\n', '')
s = s.replace(' persistLocal(records); if(cloudSyncTimerRef.current!==null){window.clearTimeout(cloudSyncTimerRef.current);cloudSyncTimerRef.current=null;} setSaving(true);', ' persistLocal(records); setSaving(true);')

# useRef is no longer needed.
s = s.replace('import { useEffect, useMemo, useRef, useState } from "react";', 'import { useEffect, useMemo, useState } from "react";')

p.write_text(s, encoding='utf-8')
