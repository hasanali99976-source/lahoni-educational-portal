from pathlib import Path
import re

PAGE = Path('app/teacher/attendance/page.tsx')
HELPER = Path('lib/class-pdf-pages-v83.ts')
SW = Path('public/sw.js')

page = PAGE.read_text(encoding='utf-8')
helper = HELPER.read_text(encoding='utf-8')

# 1) Allow each attendance class report to have its own accent color.
old_type = '''  rows: AttendancePageRow[];\n  counts: { present: number; absent: number; late: number; excused: number; escaped: number };\n};'''
new_type = '''  rows: AttendancePageRow[];\n  counts: { present: number; absent: number; late: number; excused: number; escaped: number };\n  accentColor?: string;\n};'''
if old_type not in helper:
    raise SystemExit('attendance options anchor not found')
helper = helper.replace(old_type, new_type, 1)

old_header = 'function reportHeader(ctx: CanvasRenderingContext2D, title: string, portalName: string, subtitle: string, pageIndex: number, pageCount: number) {\n  rounded(ctx, 28, 22, WIDTH - 56, 104, 20, "#0e4b59");'
new_header = 'function reportHeader(ctx: CanvasRenderingContext2D, title: string, portalName: string, subtitle: string, pageIndex: number, pageCount: number, accentColor = "#0e4b59") {\n  rounded(ctx, 28, 22, WIDTH - 56, 104, 20, accentColor);'
if old_header not in helper:
    raise SystemExit('reportHeader anchor not found')
helper = helper.replace(old_header, new_header, 1)

old_call = 'reportHeader(ctx, "تقرير الحضور اليومي", options.portalName, "سجل الحضور والمتابعة اليومية", pageIndex, pages.length);'
new_call = 'reportHeader(ctx, "تقرير الحضور اليومي", options.portalName, "سجل الحضور والمتابعة اليومية", pageIndex, pages.length, options.accentColor || "#0e4b59");'
if old_call not in helper:
    raise SystemExit('attendance reportHeader call not found')
helper = helper.replace(old_call, new_call, 1)

attendance_table_anchor = 'rounded(ctx, x, top, w, bottom - top, 12, "#ffffff", "#bfd1d7");\n    ctx.fillStyle = "#174b59";\n    ctx.fillRect(x, top, w, headerH);'
attendance_table_replacement = 'rounded(ctx, x, top, w, bottom - top, 12, "#ffffff", "#bfd1d7");\n    ctx.fillStyle = options.accentColor || "#174b59";\n    ctx.fillRect(x, top, w, headerH);'
if attendance_table_anchor not in helper:
    raise SystemExit('attendance table header anchor not found')
helper = helper.replace(attendance_table_anchor, attendance_table_replacement, 1)

# 2) Stable palette, one color per class in the combined PDF.
status_block = '''const STATUS_LABELS: Record<AttendanceStatus, string> = {\n  present: "حاضر",\n  absent: "غائب",\n  late: "متأخر",\n  excused: "مستأذن",\n  escaped: "هروب",\n};'''
palette_block = status_block + '''\nconst ATTENDANCE_CLASS_COLORS = [\n  "#0e4b59",\n  "#2457a1",\n  "#6f3fa0",\n  "#a34f2f",\n  "#2f7a55",\n  "#8a5a05",\n  "#8f3555",\n  "#3f5f8f",\n];'''
if status_block not in page:
    raise SystemExit('status block not found')
page = page.replace(status_block, palette_block, 1)

busy_anchor = '  const [reporting, setReporting] = useState(false);'
if busy_anchor not in page:
    raise SystemExit('reporting state anchor not found')
page = page.replace(busy_anchor, busy_anchor + '\n  const [allPdfBusy, setAllPdfBusy] = useState(false);', 1)

# 3) Add combined all-class PDF using cloud/local attendance records for the selected day.
print_anchor = '''  function printAdminReport() {\n    void downloadAttendancePdf();\n  }'''
all_pdf_function = '''  async function downloadAllAttendancePdf() {\n    if (!attendancePath || !classes.length) return setMessage("لا توجد فصول متاحة للطباعة.");\n    setAllPdfBusy(true);\n    setMessage(`جارٍ تجهيز تحضير جميع الفصول بتاريخ ${selectedDate}...`);\n    try {\n      if (document.fonts?.ready) await document.fonts.ready;\n      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });\n      let totalPages = 0;\n      let totalStudents = 0;\n      let includedClasses = 0;\n\n      for (let classIndex = 0; classIndex < classes.length; classIndex += 1) {\n        const className = classes[classIndex];\n        const roster = students\n          .filter(student => clean(student.class) === clean(className))\n          .sort((a, b) => clean(a.name).localeCompare(clean(b.name), "ar"));\n        if (!roster.length) continue;\n\n        let savedRecords = readRecords(attendanceKey(teacherId, subjectKey, className, selectedDate))\n          || readRecords(legacyAttendanceKey(teacherId, subjectKey, className, selectedDate))\n          || {};\n        try {\n          const snapshot = await withTimeout(getDoc(doc(db, attendancePath, `${safeId(className)}_${selectedDate}`)), 3500);\n          if (snapshot.exists()) {\n            const data = snapshot.data() as AttendanceDocument;\n            if (data.records && typeof data.records === "object") savedRecords = data.records;\n          }\n        } catch {\n          // إذا تعذر الاتصال نستخدم آخر نسخة محفوظة محليًا بدل إسقاط الفصل من التقرير.\n        }\n\n        const values = roster.map(student => savedRecords[studentCode(student)] || "present");\n        const classCounts = {\n          present: values.filter(value => value === "present").length,\n          absent: values.filter(value => value === "absent").length,\n          late: values.filter(value => value === "late").length,\n          excused: values.filter(value => value === "excused").length,\n          escaped: values.filter(value => value === "escaped").length,\n        };\n        const classRows = roster.map((student, index) => ({\n          number: index + 1,\n          name: clean(student.name) || "طالب بدون اسم",\n          status: STATUS_LABELS[savedRecords[studentCode(student)] || "present"],\n        }));\n        const canvases = renderAttendancePdfPages({\n          portalName: PORTAL_NAME,\n          teacherName,\n          subject,\n          className,\n          date: selectedDate,\n          hijriDate: formatHijri(selectedDate),\n          rows: classRows,\n          counts: classCounts,\n          accentColor: ATTENDANCE_CLASS_COLORS[classIndex % ATTENDANCE_CLASS_COLORS.length],\n        });\n\n        canvases.forEach(canvas => {\n          if (totalPages > 0) pdf.addPage("a4", "landscape");\n          pdf.addImage(canvas.toDataURL("image/jpeg", 0.97), "JPEG", 0, 0, 297, 210, undefined, "FAST");\n          totalPages += 1;\n        });\n        totalStudents += roster.length;\n        includedClasses += 1;\n      }\n\n      if (!totalPages) throw new Error("attendance_all_pdf_no_pages");\n      pdf.save(`تحضير-جميع-الفصول-${selectedDate}.pdf`);\n      setMessage(`تم تنزيل تحضير جميع الفصول: ${includedClasses} فصل، ${totalStudents} طالبًا، ${totalPages} صفحة. لكل فصل لون مستقل.`);\n    } catch (error) {\n      console.error("attendance-all-classes-pdf", error);\n      setMessage("تعذر إنشاء PDF جميع الفصول الآن. أعد المحاولة بعد تحديث الصفحة.");\n    } finally {\n      setAllPdfBusy(false);\n    }\n  }\n\n  function printAdminReport() {\n    void downloadAttendancePdf();\n  }'''
if print_anchor not in page:
    raise SystemExit('printAdminReport anchor not found')
page = page.replace(print_anchor, all_pdf_function, 1)

# 4) Add an explicit all-classes PDF button next to the current class PDF button.
button_anchor = '<button type="button" className="attendance-pdf" onClick={() => void downloadAttendancePdf()} disabled={!selectedClass || !classStudents.length}>تحميل PDF كامل — كل الطلاب</button>'
button_replacement = button_anchor + '<button type="button" className="attendance-pdf attendance-all-pdf" onClick={() => void downloadAllAttendancePdf()} disabled={!classes.length || allPdfBusy}>{allPdfBusy ? "جارٍ تجهيز جميع الفصول..." : "تحميل PDF لجميع الفصول"}</button>'
if button_anchor not in page:
    raise SystemExit('attendance PDF button anchor not found')
page = page.replace(button_anchor, button_replacement, 1)

PAGE.write_text(page, encoding='utf-8')
HELPER.write_text(helper, encoding='utf-8')

sw = SW.read_text(encoding='utf-8')
sw = re.sub(r'const CACHE_NAME = "[^"]+";', 'const CACHE_NAME = "ostadh-lahooni-v85-colored-all-attendance";', sw, count=1)
SW.write_text(sw, encoding='utf-8')

print('added colored all-class daily attendance PDF and bumped cache')
