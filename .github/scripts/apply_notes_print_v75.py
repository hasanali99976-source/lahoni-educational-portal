from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"missing pattern: {label}")
    return text.replace(old, new, 1)

# 1) Attendance printing: allow the table to flow across as many pages as needed.
attendance_path = Path("app/teacher/attendance/page.tsx")
attendance = attendance_path.read_text(encoding="utf-8")
print_css = """@media print{html,body{background:#fff!important;overflow:visible!important}.toolbar{display:none!important}.page{width:auto!important;min-height:0!important;height:auto!important;margin:0!important;border-radius:0!important;box-shadow:none!important;overflow:visible!important}.report-body{overflow:visible!important;padding-bottom:2mm}table{overflow:visible!important;border-radius:0!important;break-inside:auto!important;page-break-inside:auto!important}thead{display:table-header-group!important}tbody{display:table-row-group!important;overflow:visible!important}tr,td,th{break-inside:avoid!important;page-break-inside:avoid!important}.signatures,.report-footer,.footer{break-inside:avoid!important;page-break-inside:avoid!important}.report-top{padding-top:5mm}}"""
pattern = re.compile(r"@media print\{html,body\{background:#fff\}\.toolbar\{display:none\}\.page\{width:100%;min-height:auto;margin:0;border-radius:0;box-shadow:none\}(?:\.report-top\{padding-top:5mm\}\.report-body\{padding-bottom:2mm\})?\}")
attendance, count = pattern.subn(print_css, attendance)
if count < 2:
    raise SystemExit(f"expected two attendance print blocks, found {count}")
attendance_path.write_text(attendance, encoding="utf-8")

# 2) Teacher follow-up: notes are available for every displayed student, not only low-performing students.
follow_path = Path("app/teacher/follow-up/page.tsx")
follow = follow_path.read_text(encoding="utf-8")
follow = replace_once(
    follow,
    '<p>{selectedClass || "جميع الفصول"} • أقل من {threshold}%</p>',
    '<p>{selectedClass || "جميع الفصول"} • جميع الطلاب • يظهر عدد الملاحظات لكل طالب</p>',
    "follow-up table subtitle",
)
follow = replace_once(
    follow,
    '<tbody>{struggling.map(student => { const status = level(student.total); const totalNotes = Number(student.teacherNoteCount || student.teacherNotes?.length || 0);',
    '<tbody>{ranked.map(student => { const status = level(student.total); const totalNotes = Number(student.teacherNoteCount || student.teacherNotes?.length || 0);',
    "follow-up all students",
)
follow = replace_once(
    follow,
    '{!struggling.length && <p className="empty">لا يوجد طلاب يحتاجون متابعة في النطاق المختار.</p>}',
    '{!ranked.length && <p className="empty">لا توجد بيانات طلاب في النطاق المختار.</p>}',
    "follow-up empty text",
)
follow_path.write_text(follow, encoding="utf-8")

# 3) Student portal: receive the structured note history and show every note prominently above the tabs.
student_path = Path("app/student/page.tsx")
student = student_path.read_text(encoding="utf-8")
old_types = 'type StudentRecord = { name?: string; class?: string; accessCode?: string; teacherName?: string; research?: number; researchScore?: number; teacherNote?: string; absences?: number; late?: number; attendanceSummary?: AttendanceSummary; units?: Record<string, UnitRecord>; parentCounselorLastNotice?: { title?: string; message?: string } };'
new_types = 'type TeacherNoteEntry = { id?: string; type?: string; label?: string; message?: string; createdAt?: string; teacherName?: string; subject?: string };\ntype StudentRecord = { name?: string; class?: string; accessCode?: string; teacherName?: string; research?: number; researchScore?: number; teacherNote?: string; teacherNoteCount?: number; teacherNoteCounts?: Record<string, number>; teacherNotes?: TeacherNoteEntry[]; absences?: number; late?: number; attendanceSummary?: AttendanceSummary; units?: Record<string, UnitRecord>; parentCounselorLastNotice?: { title?: string; message?: string } };'
student = replace_once(student, old_types, new_types, "student note types")
anchor = '    </header>\n\n    <nav className="student-portal-tabs knowledge-tabs" aria-label="أقسام بوابة الطالب">'
banner = '''    </header>\n\n    {((selected.data.teacherNotes?.length || 0) > 0 || !!selected.data.teacherNote) && <section className="student-teacher-alerts" aria-label="ملاحظات المعلم">\n      <header><div className="student-teacher-alert-title"><span>🔔</span><div><small>متابعة المعلم</small><h2>ملاحظات مهمة لولي الأمر والطالب</h2></div></div><strong>{ar(Number(selected.data.teacherNoteCount || selected.data.teacherNotes?.length || 1))} ملاحظة</strong></header>\n      <div className="student-teacher-alert-list">\n        {(selected.data.teacherNotes || []).map((entry, index) => <article key={entry.id || `${entry.type || "note"}-${entry.createdAt || index}`}><div><b>{entry.label || "ملاحظة المعلم"}</b>{entry.message && <p>{entry.message}</p>}</div><small>{entry.createdAt ? new Date(entry.createdAt).toLocaleDateString("ar-SA-u-ca-gregory") : ""}{entry.subject ? ` • ${entry.subject}` : ""}{entry.teacherName ? ` • ${entry.teacherName}` : ""}</small></article>)}\n        {!(selected.data.teacherNotes || []).length && selected.data.teacherNote && <article><div><b>ملاحظة المعلم</b><p>{selected.data.teacherNote}</p></div><small>{selected.subjectLabel} • {selected.teacherName}</small></article>}\n      </div>\n    </section>}\n\n    <nav className="student-portal-tabs knowledge-tabs" aria-label="أقسام بوابة الطالب">'''
student = replace_once(student, anchor, banner, "student prominent alerts")
student_path.write_text(student, encoding="utf-8")

# 4) Student portal styles for the prominent alerts.
student_css_path = Path("app/student/student-portal-tabs.css")
student_css = student_css_path.read_text(encoding="utf-8")
marker = ".student-teacher-alerts{"
if marker not in student_css:
    student_css += '''\n.student-teacher-alerts{display:grid;gap:12px;padding:17px 18px;border:2px solid color-mix(in srgb,var(--subject-primary,#1768c5) 34%,#dce7ef);border-radius:20px;background:linear-gradient(135deg,#fff9df,#fff);box-shadow:0 12px 30px #173b5b12}.student-teacher-alerts>header{display:flex;align-items:center;justify-content:space-between;gap:12px}.student-teacher-alert-title{display:flex;align-items:center;gap:11px}.student-teacher-alert-title>span{display:grid;place-items:center;width:44px;height:44px;border-radius:13px;background:#fff0b8;font-size:21px}.student-teacher-alert-title small{display:block;color:#8a6509;font-weight:900}.student-teacher-alert-title h2{margin:3px 0 0;font-size:18px;color:#3d3215}.student-teacher-alerts>header>strong{white-space:nowrap;padding:8px 12px;border-radius:999px;background:#173f59;color:#fff;font-size:12px}.student-teacher-alert-list{display:grid;gap:8px}.student-teacher-alert-list article{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:12px 14px;border:1px solid #eadca8;border-radius:14px;background:#fff}.student-teacher-alert-list b{display:block;color:#3f351c}.student-teacher-alert-list p{margin:4px 0 0;color:#5f563e;line-height:1.65}.student-teacher-alert-list small{white-space:nowrap;color:#7b735e;font-size:10px;font-weight:800}@media(max-width:720px){.student-teacher-alerts{padding:13px;border-radius:16px}.student-teacher-alerts>header{align-items:flex-start}.student-teacher-alert-title h2{font-size:15px}.student-teacher-alerts>header>strong{font-size:10px;padding:6px 8px}.student-teacher-alert-list article{display:grid;gap:7px}.student-teacher-alert-list small{white-space:normal}}\n'''
student_css_path.write_text(student_css, encoding="utf-8")

# 5) PWA cache bump so app/web pick up the new UI immediately.
sw_path = Path("public/sw.js")
sw = sw_path.read_text(encoding="utf-8")
sw = re.sub(r'const CACHE_NAME = "[^"]+";', 'const CACHE_NAME = "ostadh-lahooni-v75-notes-print";', sw, count=1)
sw_path.write_text(sw, encoding="utf-8")

print("Applied v75 notes and attendance print fixes")
