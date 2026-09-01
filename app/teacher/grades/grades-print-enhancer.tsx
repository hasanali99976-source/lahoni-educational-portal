"use client";

import { useEffect } from "react";
import { useTeacherClient } from "../../../lib/teacher-client";

function numberFrom(value: string) {
  const normalized = value.replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

export default function GradesPrintEnhancer() {
  const session = useTeacherClient();

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>("button");
      if (!button || !button.closest(".grades-page")) return;
      const text = button.textContent?.replace(/\s+/g, " ").trim() || "";
      if (!text.includes("طباعة")) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const source = document.querySelector<HTMLTableElement>(".gradebook-table");
      if (!source) return window.alert("تعذر العثور على جدول الدرجات.");
      const sourceRows = [...source.querySelectorAll<HTMLTableRowElement>("tbody tr")]
        .filter(row => !row.querySelector(".empty-row"));
      if (!sourceRows.length) return window.alert("اختر فصلًا يحتوي على طلاب أولًا.");

      source.querySelectorAll<HTMLInputElement>("input").forEach((input, index) => {
        input.dataset.printInput = String(index);
      });
      const clone = source.cloneNode(true) as HTMLTableElement;
      clone.querySelectorAll<HTMLButtonElement>("button").forEach(item => item.remove());
      clone.querySelectorAll<HTMLInputElement>("input").forEach(cloneInput => {
        const span = document.createElement("span");
        const sourceInput = source.querySelector<HTMLInputElement>(`[data-print-input="${cloneInput.dataset.printInput}"]`);
        span.textContent = sourceInput?.value || cloneInput.value || "—";
        cloneInput.replaceWith(span);
      });
      source.querySelectorAll<HTMLInputElement>("input").forEach(input => delete input.dataset.printInput);

      clone.querySelectorAll("tr").forEach(row => {
        const cells = row.querySelectorAll("th,td");
        cells[cells.length - 1]?.remove();
      });
      clone.querySelectorAll(".header-score-control").forEach(control => {
        const max = control.querySelector("span")?.textContent || control.textContent?.replace(/✓\s*الكل/g, "").trim() || "";
        if (max) control.textContent = `القصوى ${max}`;
      });

      const title = document.querySelector<HTMLElement>(".gradebook-head h1")?.textContent || "سجل رصد الدرجات";
      const selects = document.querySelectorAll<HTMLSelectElement>(".gradebook-actions select");
      const selectedClass = selects[0]?.selectedOptions[0]?.textContent || "—";
      const selectedUnit = selects[1]?.selectedOptions[0]?.textContent || "—";
      const totals = sourceRows.map(row => numberFrom(row.querySelector<HTMLElement>(".student-total")?.textContent || "0"));
      const average = totals.length ? Math.round(totals.reduce((sum, value) => sum + value, 0) / totals.length * 10) / 10 : 0;
      const highest = totals.length ? Math.max(...totals) : 0;
      const lowest = totals.length ? Math.min(...totals) : 0;
      const rowCount = sourceRows.length;
      const fontSize = rowCount >= 44 ? 6.2 : rowCount >= 38 ? 6.8 : rowCount >= 32 ? 7.4 : 8.1;
      const rowHeight = Math.max(3.5, Math.min(5.8, 136 / rowCount));
      const teacherName = session?.teacherName || "المعلم";
      const subjectName = session?.subject || "المادة";
      const gradeLabel = session?.activeGradeLabel || "—";
      const logoUrl = `${window.location.origin}/icons/ostadh-lahooni-192.jpg`;

      const popup = window.open("", "_blank", "width=1450,height=920");
      if (!popup) return window.alert("اسمح بالنوافذ المنبثقة حتى تفتح الطباعة.");

      popup.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>
@page{size:A4 landscape;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#e9eef3;color:#17324d;font-family:'Segoe UI',Tahoma,Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}.toolbar{display:flex;justify-content:center;gap:9px;padding:10px;background:#173f61}.toolbar button{border:0;border-radius:10px;padding:10px 18px;font-weight:900;cursor:pointer}.toolbar .print{background:#f3c65b;color:#17324d}.toolbar .close{background:#fff;color:#17324d}.page{width:297mm;height:210mm;margin:6mm auto;background:#fff;overflow:hidden;box-shadow:0 18px 48px rgba(16,42,67,.18);display:grid;grid-template-rows:29mm auto auto minmax(0,1fr) 11mm}.top{padding:4.5mm 7mm;display:flex;align-items:center;justify-content:space-between;background:linear-gradient(135deg,#173f61,#176c8d 68%,#0f9f8f);color:#fff;position:relative;overflow:hidden}.top:after{content:'';position:absolute;left:-18mm;top:-42mm;width:88mm;height:88mm;border:1.2mm solid rgba(255,255,255,.13);border-radius:50%}.brand{display:flex;align-items:center;gap:3.5mm;position:relative;z-index:1}.brand img{width:14mm;height:14mm;border-radius:4mm;border:1mm solid rgba(255,255,255,.24);background:#fff}.brand strong{display:block;font-size:14px}.brand small{display:block;margin-top:.8mm;font-size:8px;color:#dcecf4}.title{text-align:left;position:relative;z-index:1}.title span{display:inline-block;padding:1.2mm 3mm;border-radius:99px;background:#f3c65b;color:#17324d;font-size:7.8px;font-weight:900}.title h1{margin:2mm 0 0;font-size:18px}.meta{margin:3mm 6mm 0;display:grid;grid-template-columns:1.2fr 1fr .9fr 1fr 1.2fr;gap:1.7mm}.meta div{min-height:11mm;padding:1.8mm 2.3mm;border:1px solid #d9e5ed;border-radius:2.6mm;background:#f8fbfd}.meta small{display:block;font-size:7px;color:#728799;font-weight:800}.meta strong{display:block;margin-top:.7mm;font-size:9px;color:#17324d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.stats{margin:2.2mm 6mm;display:grid;grid-template-columns:repeat(4,1fr);gap:1.8mm}.stats article{padding:1.8mm;border:1px solid #dce7ee;border-radius:2.7mm;text-align:center;background:#f8fbfd}.stats article:nth-child(2){background:#e7f7ef;color:#116b55}.stats article:nth-child(3){background:#e8f1ff;color:#2459a8}.stats article:nth-child(4){background:#fff3da;color:#925f0d}.stats strong{display:block;font-size:14px;line-height:1}.stats span{display:block;margin-top:.7mm;font-size:7.4px;font-weight:900}.table-wrap{margin:0 6mm;min-height:0;overflow:hidden;border:1px solid #c7d7e1;border-radius:3mm}.gradebook-table{width:100%!important;min-width:0!important;border-collapse:separate!important;border-spacing:0!important;table-layout:fixed!important}.gradebook-table th,.gradebook-table td{border:0!important;border-left:1px solid #d9e5ec!important;border-top:1px solid #d9e5ec!important;height:${rowHeight}mm!important;min-height:0!important;padding:.45mm .7mm!important;text-align:center!important;font-size:${fontSize}px!important;line-height:1.05!important;vertical-align:middle!important;white-space:normal!important;overflow-wrap:anywhere!important}.gradebook-table thead th{height:8.5mm!important;background:#214f6a!important;color:#fff!important;font-weight:900!important;border-top:0!important}.gradebook-table thead th:nth-child(4n+2){background:#176c8d!important}.gradebook-table thead th:nth-child(4n+3){background:#147d78!important}.gradebook-table tbody tr:nth-child(even){background:#f7fafc!important}.gradebook-table tbody tr:hover{background:inherit!important}.sticky-number,.sticky-name{position:static!important;box-shadow:none!important}.sticky-number{width:8mm!important}.sticky-name{width:40mm!important;text-align:right!important;background:inherit!important;font-weight:850!important}.mobile-grade-control{display:block!important}.student-total{display:inline-block!important;min-width:15mm;padding:.8mm 1.4mm;border-radius:99px;background:#e4f3fb!important;color:#145f82!important;font-weight:950!important;font-size:${fontSize + .5}px!important}.notes-input{width:100%!important}.grade-step,.row-delete-button{display:none!important}.header-score-control{display:block!important;margin-top:.4mm!important;font-size:${Math.max(5.4,fontSize - 1.5)}px!important;color:#dcecf5!important}.footer{margin:0 6mm;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:6mm;border-top:1px dashed #aabcc8;color:#667b8b;font-size:7.7px}.footer span:last-child{text-align:left}.footer strong{padding:1mm 3mm;border-radius:99px;border:1px solid #d5aa3f;background:#fff8e5;color:#8b6612;font-size:8px}@media print{html,body{background:#fff}.toolbar{display:none}.page{margin:0;box-shadow:none}}
</style></head><body><div class="toolbar"><button class="print" onclick="window.print()">طباعة أو حفظ PDF</button><button class="close" onclick="window.close()">إغلاق</button></div><section class="page"><header class="top"><div class="brand"><img src="${logoUrl}" alt="شعار البوابة"><div><strong>بوابة أستاذ لحوني التعليمية</strong><small>سجل التحصيل والرصد الأكاديمي</small></div></div><div class="title"><span>تقرير صفحة واحدة</span><h1>${title}</h1></div></header><section class="meta"><div><small>المعلم</small><strong>${teacherName}</strong></div><div><small>المادة</small><strong>${subjectName}</strong></div><div><small>المرحلة</small><strong>${gradeLabel}</strong></div><div><small>الفصل</small><strong>${selectedClass}</strong></div><div><small>الوحدة</small><strong>${selectedUnit}</strong></div></section><section class="stats"><article><strong>${rowCount}</strong><span>عدد الطلاب</span></article><article><strong>${average}</strong><span>متوسط المجموع</span></article><article><strong>${highest}</strong><span>أعلى مجموع</span></article><article><strong>${lowest}</strong><span>أقل مجموع</span></article></section><div class="table-wrap">${clone.outerHTML}</div><footer class="footer"><span>توقيع المعلم: ____________________</span><strong>سجل رصد معتمد</strong><span>اعتماد الإدارة: ____________________</span></footer></section></body></html>`);
      popup.document.close();
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [session?.teacherName, session?.subject, session?.activeGradeLabel]);

  return null;
}
