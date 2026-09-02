from pathlib import Path
import re

ATT = Path('app/teacher/attendance/page.tsx')
GRD = Path('app/teacher/grades/page.tsx')
SW = Path('public/sw.js')

def replace_between(text: str, start: str, end: str, replacement: str) -> str:
    a = text.find(start)
    if a < 0:
        raise SystemExit(f'missing start: {start}')
    b = text.find(end, a)
    if b < 0:
        raise SystemExit(f'missing end: {end}')
    return text[:a] + replacement + text[b:]

att = ATT.read_text(encoding='utf-8')
if 'renderAttendanceClassCanvas' not in att:
    att = att.replace('import { jsPDF } from "jspdf";\n', 'import { jsPDF } from "jspdf";\nimport { renderAttendanceClassCanvas } from "../../../lib/class-pdf-canvas";\n')
att_fn = '''  async function downloadAttendancePdf() {
    const rows = reportRows();
    if (!selectedClass || !rows.length) return setMessage("الفصل ظاهر في الجدول، لكن لا توجد له أسماء طلاب مسجلة بعد.");
    setMessage(`جارٍ إنشاء PDF واضح لـ ${rows.length} طالبًا...`);
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      const canvas = renderAttendanceClassCanvas({
        portalName: PORTAL_NAME,
        teacherName,
        subject,
        className: selectedClass,
        date: selectedDate,
        hijriDate: formatHijri(selectedDate),
        rows: rows.map(row => ({ number: row.number, name: row.name, status: row.status })),
        counts,
      });
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.96), "JPEG", 0, 0, 297, 210, undefined, "FAST");
      pdf.save(`تحضير-${safeFile(selectedClass)}-${selectedDate}.pdf`);
      setMessage(`تم تنزيل التحضير كاملًا: ${rows.length} طالبًا في صفحة واحدة.`);
    } catch (error) {
      console.error("attendance-direct-canvas-pdf", error);
      setMessage("تعذر إنشاء PDF الآن. حدّث الصفحة ثم أعد المحاولة.");
    }
  }
'''
att = replace_between(att, '  async function downloadAttendancePdf() {', '\n\n  function printAdminReport() {', att_fn)
att = replace_between(att, '  function printAdminReport() {', '\n\n  async function buildRangeRows()', '  function printAdminReport() {\n    void downloadAttendancePdf();\n  }')
if 'html2canvas(' not in att:
    att = att.replace('import html2canvas from "html2canvas";\n', '')
att = att.replace('تحميل PDF صفحة واحدة — كل الطلاب', 'تحميل PDF واضح — صفحة واحدة')
ATT.write_text(att, encoding='utf-8')

grd = GRD.read_text(encoding='utf-8')
if 'renderGradesClassCanvas' not in grd:
    grd = grd.replace('import { jsPDF } from "jspdf";\n', 'import { jsPDF } from "jspdf";\nimport { renderGradesClassCanvas } from "../../../lib/class-pdf-canvas";\n')
grd_fn = '''  async function downloadGradesPdf() {
    if (!classStudents.length) return setMessage("اختر فصلًا يحتوي على طلاب أولًا");
    setMessage(`جارٍ إنشاء سجل واضح لـ ${classStudents.length} طالبًا...`);
    const allRows = classStudents.map((student, index) => {
      const row = grades[student.id] || emptyGrade;
      return {
        number: index + 1,
        name: student.name,
        attendance: row.attendance,
        participation: row.participation,
        homework: row.homework,
        unitExam: row.unitExam,
        total: calculateUnitTotal(row),
        notes: row.notes || "",
      };
    });
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      const canvas = renderGradesClassCanvas({
        portalName: "بوابة أستاذ لحوني التعليمية",
        teacherName: session.teacherName || "",
        subject: session.subject || "المادة",
        stage: session.activeGradeLabel || "",
        className: selectedClass,
        unitLabel: unitInfo.label,
        examLabel: unitInfo.examLabel,
        rows: allRows,
      });
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.96), "JPEG", 0, 0, 297, 210, undefined, "FAST");
      pdf.save(`درجات-${selectedClass}-${unitInfo.label}.pdf`);
      setMessage(`تم تنزيل سجل الدرجات كاملًا: ${allRows.length} طالبًا في صفحة واحدة.`);
    } catch (error) {
      console.error("grades-direct-canvas-pdf", error);
      setMessage("تعذر إنشاء PDF الآن. حدّث الصفحة ثم أعد المحاولة.");
    }
  }
'''
grd = replace_between(grd, '  async function downloadGradesPdf() {', '\n\n  return <main className="gradebook-page', grd_fn)
if 'html2canvas(' not in grd:
    grd = grd.replace('import html2canvas from "html2canvas";\n', '')
grd = grd.replace('📄 PDF صفحة واحدة — كل الطلاب', '📄 PDF واضح — صفحة واحدة')
GRD.write_text(grd, encoding='utf-8')

sw = SW.read_text(encoding='utf-8')
sw = re.sub(r'const CACHE_NAME = "[^"]+";', 'const CACHE_NAME = "ostadh-lahooni-v82-direct-canvas-pdf";', sw, count=1)
SW.write_text(sw, encoding='utf-8')
print('v82b applied')
