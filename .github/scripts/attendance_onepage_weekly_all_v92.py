from pathlib import Path
import re

PDF = Path('lib/attendance-pdf.ts')
PAGE = Path('app/teacher/attendance/page.tsx')
SW = Path('public/sw.js')
PWA = Path('app/pwa-register.tsx')

pdf = PDF.read_text(encoding='utf-8')
page = PAGE.read_text(encoding='utf-8')

# 1) Daily attendance PDF: one smart A4 page per class, regardless of roster size.
old_row_h = '  const rowH = Math.floor((bottom - top - headerH) / ROWS_PER_PAGE);'
new_row_h = '''  const fittedRows = Math.max(ROWS_PER_PAGE, rows.length);\n  const rowH = Math.floor((bottom - top - headerH) / fittedRows);\n  const compact = rows.length > ROWS_PER_PAGE;\n  const numberSize = compact ? Math.max(11, 17 - (rows.length - ROWS_PER_PAGE) * 0.24) : 17;\n  const nameSize = compact ? Math.max(11.5, 19 - (rows.length - ROWS_PER_PAGE) * 0.3) : 19;\n  const statusSize = compact ? Math.max(10, 15 - (rows.length - ROWS_PER_PAGE) * 0.22) : 15;'''
if old_row_h not in pdf:
    raise SystemExit('attendance row-height anchor not found')
pdf = pdf.replace(old_row_h, new_row_h, 1)
pdf = pdf.replace('text(ctx, row.number, x + w - numberW / 2, y + rowH / 2, { size: 17, weight: 900, align: "center" });', 'text(ctx, row.number, x + w - numberW / 2, y + rowH / 2, { size: numberSize, min: 9.5, weight: 900, align: "center" });', 1)
pdf = pdf.replace('text(ctx, row.name, x + w - numberW - 18, y + rowH / 2, { size: 19, min: 12.5, weight: 900, maxWidth: nameW - 36 });', 'text(ctx, row.name, x + w - numberW - 18, y + rowH / 2, { size: nameSize, min: 10.5, weight: 900, maxWidth: nameW - 36 });', 1)
pdf = pdf.replace('rounded(ctx, x + 55, y + 7, statusW - 110, rowH - 14, (rowH - 14) / 2, style.fill);', 'const pillPad = Math.max(3, Math.min(7, Math.floor(rowH * 0.18)));\n    rounded(ctx, x + 55, y + pillPad, statusW - 110, Math.max(12, rowH - pillPad * 2), Math.max(6, (rowH - pillPad * 2) / 2), style.fill);', 1)
pdf = pdf.replace('text(ctx, row.status, x + statusW / 2, y + rowH / 2, { size: 15, min: 10, weight: 900, color: style.color, align: "center", maxWidth: statusW - 130 });', 'text(ctx, row.status, x + statusW / 2, y + rowH / 2, { size: statusSize, min: 9, weight: 900, color: style.color, align: "center", maxWidth: statusW - 130 });', 1)
old_pages = '    const pages = chunks(classReport.rows, ROWS_PER_PAGE);'
if old_pages not in pdf:
    raise SystemExit('attendance page chunk anchor not found')
pdf = pdf.replace(old_pages, '    const pages = [classReport.rows];', 1)
PDF.write_text(pdf, encoding='utf-8')

# 2) Stable class palette for weekly all-classes report.
status_block = '''const STATUS_LABELS: Record<AttendanceStatus, string> = {\n  present: "حاضر",\n  absent: "غائب",\n  late: "متأخر",\n  excused: "مستأذن",\n  escaped: "هروب",\n};'''
if 'const ATTENDANCE_CLASS_COLORS = [' not in page:
    palette = status_block + '''\nconst ATTENDANCE_CLASS_COLORS = [\n  "#0e4b59", "#2457a1", "#6f3fa0", "#a34f2f",\n  "#2f7a55", "#8a5a05", "#8f3555", "#3f5f8f",\n];'''
    if status_block not in page:
        raise SystemExit('status palette anchor not found')
    page = page.replace(status_block, palette, 1)

# 3) Helper: Sunday–Thursday school week around selected date.
week_anchor = '''function attendanceToday() {\n  return toDateInput(new Date());\n}\n'''
week_helper = week_anchor + '''\nfunction schoolWeekDates(base: string) {\n  const current = new Date(`${base}T12:00:00`);\n  const sundayOffset = current.getDay();\n  current.setDate(current.getDate() - sundayOffset);\n  return Array.from({ length: 5 }, (_, index) => {\n    const day = new Date(current);\n    day.setDate(current.getDate() + index);\n    return toDateInput(day);\n  });\n}\n'''
if 'function schoolWeekDates(base: string)' not in page:
    if week_anchor not in page:
        raise SystemExit('attendanceToday anchor not found')
    page = page.replace(week_anchor, week_helper, 1)

# 4) Weekly PDF for all classes. Each class gets its own A4 page and accent color.
print_anchor = '''  function printAdminReport() {\n    void downloadAttendancePdf();\n  }'''
weekly_fn = r'''  async function printWeeklyAllClassesPdf() {
    if (!attendancePath || !classes.length) return setMessage("لا توجد فصول متاحة للتقرير الأسبوعي.");
    setReporting(true);
    setMessage("جارٍ تجهيز التقرير الأسبوعي لجميع الفصول...");
    try {
      const weekDates = schoolWeekDates(selectedDate).filter(day => day >= ATTENDANCE_START_DATE);
      const localDocuments = Object.values(readAttendanceIndex(teacherId, subjectKey));
      let serverDocuments: AttendanceDocument[] = [];
      try {
        const snapshot = await withTimeout(getDocs(collection(db, attendancePath)), 6000);
        serverDocuments = snapshot.docs.map(item => item.data() as AttendanceDocument);
      } catch {
        serverDocuments = [];
      }
      const merged = new Map<string, AttendanceDocument>();
      [...serverDocuments, ...localDocuments].forEach(item => {
        if (!item.class || !item.date) return;
        merged.set(`${attendanceClassKey(item.class)}|${item.date}`, item);
      });
      const rosterSource = uniqueActiveRoster(officialStudents.length ? officialStudents : students);
      const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
      const pages = classes.map((className, classIndex) => {
        const roster = rosterSource
          .filter(student => attendanceStudentMatchesClass(student, className))
          .sort((a, b) => clean(a.name).localeCompare(clean(b.name), "ar"));
        if (!roster.length) return "";
        const accent = ATTENDANCE_CLASS_COLORS[classIndex % ATTENDANCE_CLASS_COLORS.length];
        const rowHeight = Math.max(4.1, Math.min(5.25, 137 / Math.max(roster.length, 1)));
        const fontSize = roster.length >= 40 ? 6.2 : roster.length >= 34 ? 6.7 : roster.length >= 29 ? 7.1 : 7.7;
        const body = roster.map((student, index) => {
          const code = studentCode(student);
          const cells = weekDates.map((day, dayIndex) => {
            const record = merged.get(`${attendanceClassKey(className)}|${day}`);
            if (!record) return `<td class="not-saved" title="لم يُحفظ تحضير ${dayNames[dayIndex] || ""}">—</td>`;
            const status = record.records?.[code] || "present";
            return `<td class="s-${status}">${escapeHtml(STATUS_LABELS[status])}</td>`;
          }).join("");
          return `<tr><td class="num">${index + 1}</td><td class="student">${escapeHtml(clean(student.name) || "طالب بدون اسم")}</td>${cells}</tr>`;
        }).join("");
        const heads = weekDates.map((day, index) => `<th><span>${dayNames[index] || ""}</span><small>${day.slice(5)}</small></th>`).join("");
        return `<section class="page" style="--accent:${accent};--row-h:${rowHeight}mm;--font:${fontSize}px"><header><div><b>${PORTAL_NAME}</b><small>سجل الحضور الأسبوعي — جميع الفصول</small></div><strong>${escapeHtml(className)}</strong></header><div class="meta"><span>المعلم: <b>${escapeHtml(teacherName)}</b></span><span>المادة: <b>${escapeHtml(subject)}</b></span><span>الأسبوع: <b>${weekDates[0]} إلى ${weekDates.at(-1)}</b></span><span>عدد الطلاب: <b>${roster.length}</b></span></div><table><colgroup><col style="width:9mm"><col style="width:70mm">${weekDates.map(() => '<col>').join('')}</colgroup><thead><tr><th>م</th><th class="student-head">اسم الطالب</th>${heads}</tr></thead><tbody>${body}</tbody></table><footer><span>توقيع المعلم: ____________________</span><b>${escapeHtml(className)}</b><span>اعتماد الإدارة: ____________________</span></footer></section>`;
      }).filter(Boolean).join("");
      if (!pages) throw new Error("لا توجد أسماء طلاب في الفصول المتاحة.");
      const popup = window.open("", "_blank", "width=1400,height=920");
      if (!popup) return setMessage("اسمح بالنوافذ المنبثقة لفتح التقرير الأسبوعي.");
      popup.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>التحضير الأسبوعي — جميع الفصول</title><style>
@page{size:A4 landscape;margin:0}*{box-sizing:border-box}html,body{margin:0;background:#e9eef2;color:#17303b;font-family:'Tajawal','Segoe UI',Tahoma,Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}.toolbar{position:sticky;top:0;z-index:10;display:flex;justify-content:center;gap:10px;padding:10px;background:#102f3b}.toolbar button{border:0;border-radius:10px;padding:10px 20px;font-weight:900;cursor:pointer}.toolbar .print{background:#f1c75a}.toolbar .close{background:#fff}.page{width:297mm;height:210mm;margin:6mm auto;background:#fff;overflow:hidden;page-break-after:always;break-after:page;box-shadow:0 16px 45px #0002;padding:5mm 6mm 4mm;display:grid;grid-template-rows:21mm 12mm minmax(0,1fr) 9mm;gap:2mm;border-top:4mm solid var(--accent)}.page:last-child{page-break-after:auto;break-after:auto}header{display:flex;align-items:center;justify-content:space-between;background:var(--accent);color:#fff;border-radius:3mm;padding:3mm 5mm}header b{display:block;font-size:12px}header small{display:block;margin-top:1mm;font-size:7.5px;opacity:.86}header strong{font-size:19px;padding:1.5mm 4mm;border-radius:99px;background:#fff;color:var(--accent)}.meta{display:grid;grid-template-columns:1.2fr 1fr 1.35fr .7fr;gap:2mm}.meta span{border:1px solid #d7e2e7;border-radius:2mm;padding:2mm 2.5mm;background:#f8fbfc;font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}table{width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed;border:1px solid #c7d6dc;border-radius:2.5mm;overflow:hidden}th{height:8mm;background:var(--accent);color:#fff;border-left:1px solid #ffffff2d;font-size:7.4px;padding:1mm}th span,th small{display:block}.student-head{text-align:right;padding-right:3mm}td{height:var(--row-h);padding:.35mm 1mm;border-top:1px solid #dce5e9;border-left:1px solid #e5ecef;text-align:center;font-size:var(--font);font-weight:800;line-height:1.05}tbody tr:nth-child(even){background:#f7fafb}.num{width:9mm}.student{text-align:right;padding-right:2.5mm;font-weight:900}.s-present{background:#e5f7ec;color:#13643d}.s-absent{background:#fde8eb;color:#9f2936}.s-late{background:#fff1cd;color:#865500}.s-excused{background:#e6efff;color:#2457a1}.s-escaped{background:#efe6ff;color:#60379f}.not-saved{color:#8a9aa1;background:#f1f4f5}footer{border-top:1px dashed #aebfc6;display:flex;align-items:center;justify-content:space-between;font-size:7.5px;color:#607780}footer b{color:var(--accent);font-size:9px}@media print{html,body{background:#fff}.toolbar{display:none}.page{margin:0;box-shadow:none}}
</style></head><body><div class="toolbar"><button class="print" onclick="window.print()">طباعة أو حفظ PDF</button><button class="close" onclick="window.close()">إغلاق</button></div>${pages}</body></html>`);
      popup.document.close();
      setMessage(`تم تجهيز التقرير الأسبوعي لجميع الفصول: ${classes.length} فصل، ولكل فصل لون مستقل.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تجهيز التقرير الأسبوعي لجميع الفصول.");
    } finally {
      setReporting(false);
    }
  }

  function printAdminReport() {
    void downloadAttendancePdf();
  }'''
if 'async function printWeeklyAllClassesPdf()' not in page:
    if print_anchor not in page:
        raise SystemExit('printAdminReport anchor not found')
    page = page.replace(print_anchor, weekly_fn, 1)

# 5) Add button in the advanced report section.
old_controls = '<button type="button" className="attendance-range-pdf" onClick={() => void printRangePdf()} disabled={!selectedClass || reporting}>{reporting ? "جارٍ التجهيز..." : "معاينة وحفظ PDF"}</button></div></div>'
new_controls = old_controls.replace('</button></div></div>', '</button><button type="button" className="attendance-range-pdf attendance-weekly-all" onClick={() => void printWeeklyAllClassesPdf()} disabled={!classes.length || reporting}>{reporting ? "جارٍ التجهيز..." : "PDF أسبوعي — جميع الفصول"}</button></div></div>')
if 'PDF أسبوعي — جميع الفصول' not in page:
    if old_controls not in page:
        raise SystemExit('advanced report buttons anchor not found')
    page = page.replace(old_controls, new_controls, 1)

PAGE.write_text(page, encoding='utf-8')

# 6) Force installed PWA/browser to pick up this attendance revision.
sw = SW.read_text(encoding='utf-8')
sw = re.sub(r'const CACHE_NAME = "[^"]+";', 'const CACHE_NAME = "ostadh-lahooni-v92-onepage-weekly-all";', sw, count=1)
SW.write_text(sw, encoding='utf-8')

pwa = PWA.read_text(encoding='utf-8')
pwa = re.sub(r'const CURRENT_CACHE = "[^"]+";', 'const CURRENT_CACHE = "ostadh-lahooni-v92-onepage-weekly-all";', pwa, count=1)
pwa = re.sub(r'const RELOAD_KEY = "[^"]+";', 'const RELOAD_KEY = "ostadh-lahooni-v92-onepage-weekly-all-reloaded";', pwa, count=1)
pwa = re.sub(r'navigator\.serviceWorker\.register\("/sw\.js\?v=[^"]+"', 'navigator.serviceWorker.register("/sw.js?v=92-onepage-weekly-all"', pwa, count=1)
PWA.write_text(pwa, encoding='utf-8')

print('attendance v92: one-page daily PDF + weekly all classes with per-class colors')
