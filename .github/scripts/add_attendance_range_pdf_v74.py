from pathlib import Path

page = Path('app/teacher/attendance/page.tsx')
text = page.read_text(encoding='utf-8')

anchor = '''  async function exportRangeExcel() {
'''
if anchor not in text:
    raise SystemExit('exportRangeExcel anchor not found')

pdf_function = r'''  async function printRangePdf() {
    try {
      setReporting(true);
      const { rows, days } = await buildRangeRows();
      if (!classStudents.length) return setMessage("الفصل ظاهر في الجدول، لكن لا توجد له أسماء طلاب مسجلة بعد.");
      if (!days.length) return setMessage("لا توجد سجلات حضور محفوظة في الفترة المحددة");
      const popup = window.open("", "_blank", "width=1280,height=920");
      if (!popup) return setMessage("اسمح بالنوافذ المنبثقة لفتح تقرير PDF");
      const logoUrl = `${window.location.origin}/icons/ostadh-lahooni-192.jpg`;
      const totalAbsences = rows.reduce((sum, row) => sum + row.absentDates.length, 0);
      const totalLate = rows.reduce((sum, row) => sum + row.lateDates.length, 0);
      const totalExcused = rows.reduce((sum, row) => sum + row.excusedDates.length, 0);
      const totalEscaped = rows.reduce((sum, row) => sum + row.escapedDates.length, 0);
      const averageRate = rows.length
        ? Math.round(rows.reduce((sum, row) => sum + row.attendanceRate, 0) / rows.length)
        : 0;
      const bodyRows = rows.map(row => `<tr><td>${row.number}</td><td class="student-name">${escapeHtml(row.name)}</td><td>${row.present}</td><td>${escapeHtml(datesText(row.absentDates))}</td><td>${escapeHtml(datesText(row.lateDates))}</td><td>${escapeHtml(datesText(row.excusedDates))}</td><td>${escapeHtml(datesText(row.escapedDates))}</td><td><strong class="rate">${row.attendanceRate}%</strong></td></tr>`).join("");
      popup.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>تقرير حضور ${escapeHtml(selectedClass)} من ${reportFrom} إلى ${reportTo}</title><style>
@page{size:A4 landscape;margin:5mm}
*{box-sizing:border-box}html,body{margin:0;padding:0;background:#e8eef2;color:#102a35;font-family:'Tajawal','Segoe UI',Tahoma,Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.toolbar{position:sticky;top:0;z-index:5;display:flex;justify-content:center;gap:10px;padding:12px;background:linear-gradient(135deg,#082d38,#0d5262)}.toolbar button{border:0;border-radius:12px;padding:11px 22px;font:800 13px inherit;cursor:pointer}.toolbar .print{background:#e7b649;color:#102a35}.toolbar .close{background:#fff;color:#163d49}
.page{width:287mm;min-height:200mm;margin:7mm auto;background:#fff;border-radius:5mm;overflow:hidden;box-shadow:0 18px 50px rgba(16,42,53,.18)}
.report-top{display:flex;align-items:center;justify-content:space-between;padding:6mm 8mm 4.5mm;background:linear-gradient(135deg,#082d38 0%,#0d5665 74%,#137586 100%);color:#fff}.brand{display:flex;align-items:center;gap:4mm}.brand img{width:17mm;height:17mm;border-radius:4mm;object-fit:cover;border:1.2mm solid rgba(255,255,255,.22);background:#fff}.brand strong{display:block;font-size:15px}.brand small{display:block;margin-top:1mm;font-size:9px;color:#cce8ec}.title{text-align:left}.title span{display:inline-block;padding:1.4mm 3mm;border-radius:99px;background:#e7b649;color:#18333a;font-size:8px;font-weight:900}.title h1{font-size:18px;margin:2.5mm 0 0}
.report-body{padding:4mm 6mm 5mm}.meta{display:grid;grid-template-columns:1.35fr 1fr 1fr 1.3fr 1fr;gap:2mm;margin-bottom:3mm}.meta div{border:1px solid #dbe6ea;border-radius:3mm;background:#f8fbfc;padding:2.2mm 3mm;min-height:13mm}.meta small{display:block;color:#67808a;font-size:7.5px;font-weight:700;margin-bottom:.8mm}.meta strong{font-size:9px;color:#123946}
.summary{display:grid;grid-template-columns:repeat(6,1fr);gap:2mm;margin-bottom:3.5mm}.summary article{border-radius:3mm;padding:2mm;text-align:center;border:1px solid #e0eaed;background:#f8fbfc}.summary strong{display:block;font-size:14px}.summary span{font-size:7.5px;font-weight:800}.summary .good{background:#e5f7ec;color:#12653b}.summary .warn{background:#fff4d9;color:#8b5a06}.summary .bad{background:#fdebed;color:#9e2935}
table{width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed;border:1px solid #cad9de;border-radius:3mm;overflow:hidden}thead th{background:#143f4d;color:#fff;font-size:7.5px;padding:2.2mm 1.3mm;border-left:1px solid rgba(255,255,255,.16)}tbody td{padding:1.55mm 1.3mm;font-size:7.3px;border-top:1px solid #dce6e9;border-left:1px solid #e5edef;text-align:center;height:7.7mm;word-break:break-word}tbody tr:nth-child(even){background:#f7fafb}.student-name{text-align:right!important;font-weight:800;color:#173e4a}.rate{display:inline-block;min-width:14mm;padding:1mm 2mm;border-radius:99px;background:#e5f7ec;color:#12653b}
.signatures{display:grid;grid-template-columns:1fr 1fr;gap:12mm;margin:4mm 3mm 0;padding-top:3mm;border-top:1px dashed #a9bdc4}.signatures div{text-align:center}.signatures small{display:block;color:#617780;font-size:8px}.signatures strong{display:block;margin-top:3mm;font-size:8.5px;color:#173d49}.footer{display:flex;justify-content:space-between;margin-top:3mm;color:#5d737b;font-size:7.5px}
@media print{html,body{background:#fff}.toolbar{display:none}.page{width:100%;min-height:auto;margin:0;border-radius:0;box-shadow:none}}
</style></head><body><div class="toolbar"><button class="print" onclick="window.print()">طباعة أو حفظ PDF</button><button class="close" onclick="window.close()">إغلاق المعاينة</button></div><section class="page"><header class="report-top"><div class="brand"><img src="${logoUrl}" alt="شعار البوابة"><div><strong>${PORTAL_NAME}</strong><small>بوابة تحضير الطلاب والمتابعة اليومية</small></div></div><div class="title"><span>تقرير فترة معتمد</span><h1>تقرير الحضور الأسبوعي والفترة المحددة</h1></div></header><main class="report-body"><section class="meta"><div><small>المعلم</small><strong>${escapeHtml(teacherName)}</strong></div><div><small>المادة</small><strong>${escapeHtml(subject)}</strong></div><div><small>الفصل</small><strong>${escapeHtml(selectedClass)}</strong></div><div><small>الفترة</small><strong>${reportFrom} إلى ${reportTo}</strong></div><div><small>أيام التحضير</small><strong>${days.length} يوم</strong></div></section><section class="summary"><article><strong>${rows.length}</strong><span>إجمالي الطلاب</span></article><article class="good"><strong>${averageRate}%</strong><span>متوسط الحضور</span></article><article class="bad"><strong>${totalAbsences}</strong><span>حالات الغياب</span></article><article class="warn"><strong>${totalLate}</strong><span>حالات التأخير</span></article><article><strong>${totalExcused}</strong><span>حالات الاستئذان</span></article><article class="bad"><strong>${totalEscaped}</strong><span>حالات الهروب</span></article></section><table><colgroup><col style="width:9mm"><col style="width:43mm"><col style="width:14mm"><col><col><col><col><col style="width:19mm"></colgroup><thead><tr><th>م</th><th>اسم الطالب</th><th>الحضور</th><th>تواريخ الغياب</th><th>تواريخ التأخير</th><th>تواريخ الاستئذان</th><th>تواريخ الهروب</th><th>نسبة الحضور</th></tr></thead><tbody>${bodyRows}</tbody></table><section class="signatures"><div><small>توقيع المعلم</small><strong>____________________________</strong></div><div><small>اعتماد الإدارة</small><strong>____________________________</strong></div></section><footer class="footer"><b>${PORTAL_NAME}</b><span>${escapeHtml(selectedClass)} — ${reportFrom} إلى ${reportTo}</span></footer></main></section></body></html>`);
      popup.document.close();
      setMessage("تم تجهيز تقرير الفترة PDF");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تجهيز تقرير PDF");
    } finally {
      setReporting(false);
    }
  }

'''
text = text.replace(anchor, pdf_function + anchor, 1)

old_controls = '''<div className="attendance-range-content"><p>يعرض تواريخ الغياب والتأخير والاستئذان والهروب لكل طالب خلال الفترة.</p><div className="attendance-range-controls"><label><span>من تاريخ</span><input type="date" min={ATTENDANCE_START_DATE} value={reportFrom} onChange={event => setReportFrom(clampAttendanceDate(event.target.value))}/></label><label><span>إلى تاريخ</span><input type="date" min={ATTENDANCE_START_DATE} value={reportTo} onChange={event => setReportTo(clampAttendanceDate(event.target.value))}/></label><button type="button" onClick={() => void exportRangeExcel()} disabled={!selectedClass || reporting}>{reporting ? "جارٍ التجهيز..." : "تحميل تقرير الفترة Excel"}</button></div></div>'''
new_controls = '''<div className="attendance-range-content"><p>يعرض تواريخ الغياب والتأخير والاستئذان والهروب لكل طالب خلال الفترة، ويمكن تحميله بصيغتي Excel وPDF.</p><div className="attendance-range-controls"><label><span>من تاريخ</span><input type="date" min={ATTENDANCE_START_DATE} value={reportFrom} onChange={event => setReportFrom(clampAttendanceDate(event.target.value))}/></label><label><span>إلى تاريخ</span><input type="date" min={ATTENDANCE_START_DATE} value={reportTo} onChange={event => setReportTo(clampAttendanceDate(event.target.value))}/></label><button type="button" className="attendance-range-excel" onClick={() => void exportRangeExcel()} disabled={!selectedClass || reporting}>{reporting ? "جارٍ التجهيز..." : "تحميل تقرير الفترة Excel"}</button><button type="button" className="attendance-range-pdf" onClick={() => void printRangePdf()} disabled={!selectedClass || reporting}>{reporting ? "جارٍ التجهيز..." : "معاينة وحفظ PDF"}</button></div></div>'''
if old_controls not in text:
    raise SystemExit('range controls anchor not found')
text = text.replace(old_controls, new_controls, 1)
page.write_text(text, encoding='utf-8')

for filename in ['app/pwa-register.tsx', 'public/sw.js']:
    path = Path(filename)
    data = path.read_text(encoding='utf-8')
    data = data.replace('v73-attendance-realtime', 'v74-attendance-range-pdf')
    path.write_text(data, encoding='utf-8')
