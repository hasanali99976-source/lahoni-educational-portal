from pathlib import Path
import re

page_path = Path('app/teacher/grades/page.tsx')
sw_path = Path('public/sw.js')
text = page_path.read_text(encoding='utf-8')

if 'import html2canvas from "html2canvas";' not in text:
    text = text.replace('import * as XLSX from "xlsx";\n', 'import * as XLSX from "xlsx";\nimport html2canvas from "html2canvas";\nimport { jsPDF } from "jspdf";\n')

new_function = r'''  async function downloadGradesPdf() {
    if (!classStudents.length) return setMessage("اختر فصلًا يحتوي على طلاب أولًا");
    setMessage("جارٍ تجهيز سجل الدرجات PDF بجميع الطلاب...");

    const escapePdfText = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[character] || character));

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
    const pageSize = 24;
    const groups = Array.from({ length: Math.ceil(allRows.length / pageSize) }, (_, index) => allRows.slice(index * pageSize, (index + 1) * pageSize));
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });

    try {
      for (let pageIndex = 0; pageIndex < groups.length; pageIndex += 1) {
        const pageRows = groups[pageIndex];
        const bodyRows = pageRows.map(row => `<tr><td>${row.number}</td><td class="student-name">${escapePdfText(row.name)}</td><td>${row.attendance}</td><td>${row.participation}</td><td>${row.homework}</td><td>${row.unitExam}</td><td class="total">${row.total}</td><td class="notes">${escapePdfText(row.notes)}</td></tr>`).join("");
        const sheet = document.createElement("section");
        sheet.dir = "rtl";
        sheet.setAttribute("aria-hidden", "true");
        sheet.style.cssText = "position:fixed;left:-12000px;top:0;width:1123px;height:794px;background:#fff;z-index:-1;overflow:hidden;";
        sheet.innerHTML = `
          <style>
            *{box-sizing:border-box}
            .grade-pdf-sheet{width:1123px;height:794px;padding:22px 26px 18px;background:#fff;color:#123946;font-family:'Tajawal','Segoe UI',Tahoma,Arial,sans-serif;display:grid;grid-template-rows:auto auto 1fr auto;gap:10px;overflow:hidden}
            .grade-pdf-head{min-height:82px;border-radius:17px;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;background:linear-gradient(135deg,#082d38,#0d5665 72%,#137586);color:#fff}.grade-pdf-head small{display:block;font-size:10px;color:#cde8ec;font-weight:800}.grade-pdf-head h1{margin:4px 0 0;font-size:24px}.grade-pdf-head .page{text-align:left}.grade-pdf-head .page strong{display:block;font-size:19px}.grade-pdf-head .page span{display:inline-block;margin-top:5px;padding:4px 10px;border-radius:999px;background:#e7b649;color:#17353e;font-size:10px;font-weight:900}
            .grade-pdf-meta{display:grid;grid-template-columns:1.3fr 1fr 1fr 1fr;gap:7px}.grade-pdf-meta div{border:1px solid #d8e5e9;border-radius:10px;background:#f8fbfc;padding:7px 10px}.grade-pdf-meta small{display:block;color:#6a8089;font-size:8px;font-weight:800}.grade-pdf-meta strong{display:block;margin-top:2px;font-size:11px;color:#153e4b}
            table{width:100%;border-collapse:collapse;table-layout:fixed;border:1px solid #bfd0d5}th{height:31px;background:#143f4d;color:#fff;border:1px solid #315966;font-size:9px;padding:4px}td{height:22px;border:1px solid #dbe5e8;padding:3px 5px;text-align:center;font-size:9px;line-height:1.08;overflow:hidden}tbody tr:nth-child(even){background:#f7fafb}.student-name{text-align:right!important;font-weight:800;font-size:10px;white-space:nowrap}.total{font-weight:900;background:#eef6f8}.notes{text-align:right!important;font-size:8px;white-space:nowrap;text-overflow:ellipsis}.grade-pdf-footer{display:flex;align-items:center;justify-content:space-between;border-top:1px dashed #b7c7cc;padding-top:7px;color:#607780;font-size:9px}.grade-pdf-footer strong{color:#174653}
          </style>
          <div class="grade-pdf-sheet">
            <header class="grade-pdf-head"><div><small>بوابة أستاذ لحوني التعليمية</small><h1>سجل رصد الدرجات</h1></div><div class="page"><strong>${escapePdfText(unitInfo.label)}</strong><span>صفحة ${pageIndex + 1} من ${groups.length}</span></div></header>
            <section class="grade-pdf-meta"><div><small>المادة</small><strong>${escapePdfText(session.subject || "المادة")}</strong></div><div><small>المرحلة</small><strong>${escapePdfText(session.activeGradeLabel || "")}</strong></div><div><small>الفصل</small><strong>${escapePdfText(selectedClass)}</strong></div><div><small>عدد الطلاب</small><strong>${allRows.length}</strong></div></section>
            <table><colgroup><col style="width:38px"><col style="width:250px"><col style="width:74px"><col style="width:74px"><col style="width:74px"><col style="width:86px"><col style="width:72px"><col></colgroup><thead><tr><th>م</th><th>اسم الطالب</th><th>الحضور</th><th>المشاركة</th><th>الواجبات</th><th>${escapePdfText(unitInfo.examLabel)}</th><th>المجموع</th><th>الملاحظات</th></tr></thead><tbody>${bodyRows}</tbody></table>
            <footer class="grade-pdf-footer"><strong>بوابة أستاذ لحوني التعليمية</strong><span>${escapePdfText(selectedClass)} — ${escapePdfText(unitInfo.label)}</span><span>الطلاب ${pageRows[0]?.number || 0}–${pageRows[pageRows.length - 1]?.number || 0} من ${allRows.length}</span></footer>
          </div>`;
        document.body.appendChild(sheet);
        if (document.fonts?.ready) await document.fonts.ready;
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        const canvas = await html2canvas(sheet, { scale: 2, backgroundColor: "#ffffff", logging: false, useCORS: true, width: 1123, height: 794, windowWidth: 1123, windowHeight: 794 });
        if (pageIndex > 0) pdf.addPage("a4", "landscape");
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.96), "JPEG", 0, 0, 297, 210, undefined, "FAST");
        sheet.remove();
      }
      pdf.save(`رصد-الدرجات-${selectedClass}-${unitInfo.label}.pdf`);
      setMessage(`تم تنزيل سجل الدرجات PDF ويحتوي جميع طلاب الفصل (${allRows.length} طالبًا).`);
    } catch {
      document.querySelectorAll('[aria-hidden="true"]').forEach(node => {
        if (node instanceof HTMLElement && node.style.left === "-12000px") node.remove();
      });
      setMessage("تعذر إنشاء PDF الآن. أعد المحاولة بعد تحديث الصفحة.");
    }
  }
'''

pattern = re.compile(r'  function printRegister\(\) \{.*?\n  \}\n\n  return <main', re.S)
if not pattern.search(text):
    raise SystemExit('printRegister block not found')
text = pattern.sub(new_function + '\n  return <main', text, count=1)
text = text.replace('<button type="button" className="research-link" onClick={printRegister}>🖨️ طباعة</button>', '<button type="button" className="research-link" onClick={() => void downloadGradesPdf()}>📄 تحميل PDF</button>')

page_path.write_text(text, encoding='utf-8')

sw = sw_path.read_text(encoding='utf-8')
sw = re.sub(r'const CACHE_NAME = "[^"]+";', 'const CACHE_NAME = "ostadh-lahooni-v78-grade-pdf";', sw, count=1)
sw_path.write_text(sw, encoding='utf-8')
