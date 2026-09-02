from pathlib import Path

path = Path('app/teacher/attendance/page.tsx')
text = path.read_text(encoding='utf-8')

start_marker = '    const bodyRows = rows.map(row => `<tr><td class="index">${row.number}</td><td class="student-name">${escapeHtml(row.name)}</td><td>${escapeHtml(row.className)}</td><td><span class="status ${statusClass(row.status)}">${escapeHtml(row.status)}</span></td><td class="notes"></td></tr>`).join("");\n'
end_marker = '    popup.document.close();\n'

start = text.find(start_marker)
if start == -1:
    raise SystemExit('daily print start marker not found')
end = text.find(end_marker, start)
if end == -1:
    raise SystemExit('daily print end marker not found')
end += len(end_marker)

replacement = r'''    const pageSize = 13;
    const pageGroups = Array.from({ length: Math.ceil(rows.length / pageSize) }, (_, pageIndex) => rows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize));
    const pagesHtml = pageGroups.map((pageRows, pageIndex) => {
      const bodyRows = pageRows.map(row => `<tr><td class="index">${row.number}</td><td class="student-name">${escapeHtml(row.name)}</td><td>${escapeHtml(row.className)}</td><td><span class="status ${statusClass(row.status)}">${escapeHtml(row.status)}</span></td><td class="notes"></td></tr>`).join("");
      return `<section class="print-sheet">
        <header class="report-top"><div class="brand"><img src="${logoUrl}" alt="شعار البوابة"><div><strong>${PORTAL_NAME}</strong><small>بوابة تحضير الطلاب والمتابعة اليومية</small></div></div><div class="title"><span>صفحة ${pageIndex + 1} من ${pageGroups.length}</span><h1>تقرير الحضور اليومي</h1></div></header>
        <main class="report-body">
          <section class="meta"><div><small>المعلم</small><strong>${escapeHtml(teacherName)}</strong></div><div><small>المادة</small><strong>${escapeHtml(subject)}</strong></div><div><small>الفصل</small><strong>${escapeHtml(selectedClass)}</strong></div><div><small>التاريخ الميلادي</small><strong>${selectedDate}</strong></div><div><small>التاريخ الهجري</small><strong>${escapeHtml(formatHijri(selectedDate))}</strong></div></section>
          <section class="summary"><article class="all"><strong>${rows.length}</strong><span>إجمالي الطلاب</span></article><article class="present"><strong>${counts.present}</strong><span>حاضر</span></article><article class="absent"><strong>${counts.absent}</strong><span>غائب</span></article><article class="late"><strong>${counts.late}</strong><span>متأخر</span></article><article class="excused"><strong>${counts.excused}</strong><span>مستأذن</span></article><article class="escaped"><strong>${counts.escaped}</strong><span>هروب</span></article></section>
          <table><colgroup><col style="width:10mm"><col><col style="width:34mm"><col style="width:30mm"><col style="width:38mm"></colgroup><thead><tr><th>م</th><th>اسم الطالب</th><th>الفصل</th><th>الحالة</th><th>ملاحظات</th></tr></thead><tbody>${bodyRows}</tbody></table>
          ${pageIndex === pageGroups.length - 1 ? `<section class="signatures"><div><small>توقيع المعلم</small><strong>____________________________</strong></div><div><small>اعتماد الإدارة</small><strong>____________________________</strong></div></section>` : ''}
          <footer class="report-footer"><b>${PORTAL_NAME}</b><span class="seal">تحضير يومي موثّق</span><span>${escapeHtml(selectedClass)} — ${selectedDate}</span></footer>
        </main>
      </section>`;
    }).join("");

    popup.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>تقرير حضور ${escapeHtml(selectedClass)}</title><style>
@page{size:A4 landscape;margin:5mm}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#e8eef2;color:#102a35;font-family:'Tajawal','Segoe UI',Tahoma,Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.toolbar{position:sticky;top:0;z-index:5;display:flex;justify-content:center;align-items:center;gap:10px;padding:12px;background:linear-gradient(135deg,#082d38,#0d5262);box-shadow:0 8px 25px rgba(5,38,47,.22)}
.toolbar button{border:0;border-radius:12px;padding:11px 22px;font:800 13px inherit;cursor:pointer}.toolbar .print{background:#e7b649;color:#102a35}.toolbar .close{background:#fff;color:#163d49}
.print-sheet{width:287mm;min-height:198mm;margin:7mm auto;background:#fff;border-radius:5mm;overflow:visible;box-shadow:0 18px 50px rgba(16,42,53,.18);position:relative;break-after:page;page-break-after:always}.print-sheet:last-child{break-after:auto;page-break-after:auto}
.report-top{display:flex;align-items:center;justify-content:space-between;padding:5mm 8mm 4mm;background:linear-gradient(135deg,#082d38 0%,#0d5665 74%,#137586 100%);color:#fff;position:relative;overflow:hidden}
.brand{display:flex;align-items:center;gap:4mm}.brand img{width:14mm;height:14mm;border-radius:3mm;object-fit:cover;border:1mm solid rgba(255,255,255,.22);background:#fff}.brand strong{display:block;font-size:14px}.brand small{display:block;margin-top:1mm;font-size:8px;color:#cce8ec}.title{text-align:left}.title span{display:inline-block;padding:1.2mm 3mm;border-radius:99px;background:#e7b649;color:#18333a;font-size:8px;font-weight:900}.title h1{font-size:18px;margin:2mm 0 0;line-height:1.1}
.report-body{padding:3mm 7mm 4mm}.meta{display:grid;grid-template-columns:1.35fr 1fr 1fr 1.05fr 1.45fr;gap:2mm;margin-bottom:2.5mm}.meta div{border:1px solid #dbe6ea;border-radius:2.5mm;background:#f8fbfc;padding:1.8mm 2.5mm;min-height:10.5mm}.meta small{display:block;color:#67808a;font-size:7px;font-weight:700;margin-bottom:.5mm}.meta strong{font-size:9px;color:#123946}
.summary{display:grid;grid-template-columns:repeat(6,1fr);gap:2mm;margin-bottom:2.5mm}.summary article{border-radius:2.5mm;padding:1.5mm 2mm;text-align:center;border:1px solid #e0eaed;background:#fff}.summary strong{display:block;font-size:13px;line-height:1}.summary span{display:block;margin-top:.7mm;font-size:7px;font-weight:800}.summary .all{background:#eef6f8;color:#164858}.summary .present{background:#e5f7ec;color:#12653b}.summary .absent{background:#fdebed;color:#9e2935}.summary .late{background:#fff4d9;color:#8b5a06}.summary .excused{background:#e8f1ff;color:#2459a8}.summary .escaped{background:#f1eaff;color:#6036a5}
table{width:100%;border-collapse:collapse;table-layout:fixed;border:1px solid #cad9de}thead th{background:#143f4d;color:#fff;font-size:8px;padding:2mm;border:1px solid #315966}tbody td{padding:1.4mm 2mm;font-size:8px;border:1px solid #dce6e9;text-align:center;height:7.2mm}tbody tr:nth-child(even){background:#f7fafb}.student-name{text-align:right!important;font-weight:800;color:#173e4a}.index{width:10mm;font-weight:900}.notes{width:38mm}.status{display:inline-flex;align-items:center;justify-content:center;min-width:22mm;padding:1mm 2mm;border-radius:99px;font-size:7.2px;font-weight:900}.status.present{background:#dcf6e6;color:#12653b}.status.absent{background:#fde4e7;color:#a12230}.status.late{background:#ffefc4;color:#885802}.status.excused{background:#dfeaff;color:#1f52a0}.status.escaped{background:#ecdefe;color:#5b2e9e}
.signatures{display:grid;grid-template-columns:1fr 1fr;gap:12mm;margin:3mm 3mm 0;padding-top:2mm;border-top:1px dashed #a9bdc4}.signatures div{text-align:center}.signatures small{display:block;color:#617780;font-size:7.5px}.signatures strong{display:block;margin-top:2mm;font-size:8px;color:#173d49}.report-footer{display:flex;justify-content:space-between;align-items:center;margin-top:2mm;padding:2mm 1mm 0;color:#5d737b;font-size:7px}.report-footer b{color:#174653}.report-footer .seal{border:1px solid #d5a535;color:#8a6612;border-radius:99px;padding:.8mm 3mm;font-weight:900}
@media print{html,body{background:#fff!important}.toolbar{display:none!important}.print-sheet{width:100%!important;min-height:0!important;margin:0!important;border-radius:0!important;box-shadow:none!important;overflow:visible!important;break-after:page!important;page-break-after:always!important}.print-sheet:last-child{break-after:auto!important;page-break-after:auto!important}table,tr,td,th{break-inside:avoid!important;page-break-inside:avoid!important}}
</style></head><body><div class="toolbar"><button class="print" onclick="window.print()">طباعة أو حفظ PDF</button><button class="close" onclick="window.close()">إغلاق المعاينة</button></div>${pagesHtml}</body></html>`);
    popup.document.close();
'''

text = text[:start] + replacement + text[end:]
path.write_text(text, encoding='utf-8')
print(f'patched explicit daily attendance pagination: {len(pageGroups) if False else "ok"}')
