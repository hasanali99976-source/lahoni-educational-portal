from pathlib import Path
import re

ATT = Path('app/teacher/attendance/page.tsx')
GRD = Path('app/teacher/grades/page.tsx')
SW = Path('public/sw.js')


def replace_between(text: str, start: str, end: str, replacement: str) -> str:
    a = text.find(start)
    if a < 0:
        raise SystemExit(f'missing start anchor: {start}')
    b = text.find(end, a + len(start))
    if b < 0:
        raise SystemExit(f'missing end anchor: {end}')
    return text[:a] + replacement + text[b:]

att = ATT.read_text(encoding='utf-8')
att = att.replace('import { renderAttendanceClassCanvas } from "../../../lib/class-pdf-canvas";\n', 'import { renderAttendancePdfPages } from "../../../lib/class-pdf-pages-v83";\n')
att_fn = '''  async function downloadAttendancePdf() {
    const rows = reportRows();
    if (!selectedClass || !rows.length) return setMessage("الفصل ظاهر في الجدول، لكن لا توجد له أسماء طلاب مسجلة بعد.");
    setMessage(`جارٍ إنشاء PDF كامل لـ ${rows.length} طالبًا...`);
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      const canvases = renderAttendancePdfPages({
        portalName: PORTAL_NAME,
        teacherName,
        subject,
        className: selectedClass,
        date: selectedDate,
        hijriDate: formatHijri(selectedDate),
        rows: rows.map(row => ({ number: row.number, name: row.name, status: row.status })),
        counts,
      });
      if (!canvases.length) throw new Error("attendance_pdf_no_pages");
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
      canvases.forEach((canvas, index) => {
        if (index > 0) pdf.addPage("a4", "landscape");
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.97), "JPEG", 0, 0, 297, 210, undefined, "FAST");
      });
      pdf.save(`تحضير-${safeFile(selectedClass)}-${selectedDate}.pdf`);
      setMessage(`تم تنزيل التحضير كاملًا: ${rows.length} طالبًا في ${canvases.length} صفحة واضحة.`);
    } catch (error) {
      console.error("attendance-paginated-pdf", error);
      setMessage("تعذر إنشاء PDF الآن. حدّث الصفحة ثم أعد المحاولة.");
    }
  }

'''
att = replace_between(att, '  async function downloadAttendancePdf() {', '  function printAdminReport()', att_fn)
att = att.replace('تحميل PDF واضح — صفحة واحدة', 'تحميل PDF كامل — كل الطلاب')
ATT.write_text(att, encoding='utf-8')

grd = GRD.read_text(encoding='utf-8')
grd = grd.replace('import { renderGradesClassCanvas } from "../../../lib/class-pdf-canvas";\n', 'import { renderGradesPdfPages } from "../../../lib/class-pdf-pages-v83";\n')
grd_fn = '''  async function downloadGradesPdf() {
    if (!classStudents.length) return setMessage("اختر فصلًا يحتوي على طلاب أولًا");
    setMessage(`جارٍ إنشاء سجل كامل لـ ${classStudents.length} طالبًا...`);
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
      const canvases = renderGradesPdfPages({
        portalName: "بوابة أستاذ لحوني التعليمية",
        teacherName: session.teacherName || "",
        subject: session.subject || "المادة",
        stage: session.activeGradeLabel || "",
        className: selectedClass,
        unitLabel: unitInfo.label,
        examLabel: unitInfo.examLabel,
        rows: allRows,
      });
      if (!canvases.length) throw new Error("grades_pdf_no_pages");
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
      canvases.forEach((canvas, index) => {
        if (index > 0) pdf.addPage("a4", "landscape");
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.97), "JPEG", 0, 0, 297, 210, undefined, "FAST");
      });
      pdf.save(`درجات-${selectedClass}-${unitInfo.label}.pdf`);
      setMessage(`تم تنزيل سجل الدرجات كاملًا: ${allRows.length} طالبًا في ${canvases.length} صفحة واضحة.`);
    } catch (error) {
      console.error("grades-paginated-pdf", error);
      setMessage("تعذر إنشاء PDF الآن. حدّث الصفحة ثم أعد المحاولة.");
    }
  }

'''
grd = replace_between(grd, '  async function downloadGradesPdf() {', '  return <main className="gradebook-page grades-page"', grd_fn)
grd = grd.replace('📄 PDF واضح — صفحة واحدة', '📄 PDF كامل — كل الطلاب')
GRD.write_text(grd, encoding='utf-8')

sw = SW.read_text(encoding='utf-8')
sw = re.sub(r'const CACHE_NAME = "[^"]+";', 'const CACHE_NAME = "ostadh-lahooni-v83-paginated-clear-print";', sw, count=1)
SW.write_text(sw, encoding='utf-8')

print('applied v83 paginated clear PDF patch')
