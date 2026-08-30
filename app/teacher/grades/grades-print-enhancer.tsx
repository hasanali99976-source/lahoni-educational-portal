"use client";

import { useEffect } from "react";
import { useTeacherClient } from "../../../lib/teacher-client";

function replaceInputWithText(input: HTMLInputElement, root: HTMLElement) {
  const cloneInput = root.querySelector<HTMLInputElement>(`[data-print-input="${input.dataset.printInput}"]`);
  if (!cloneInput) return;
  const span = document.createElement("span");
  span.textContent = input.value || "—";
  cloneInput.replaceWith(span);
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

      const popup = window.open("", "_blank", "width=1400,height=900");
      if (!popup) return window.alert("اسمح بالنوافذ المنبثقة حتى تفتح الطباعة.");

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
        const last = cells[cells.length - 1];
        if (last?.textContent?.includes("مسح") || last?.querySelector(".row-delete-button")) last.remove();
      });
      clone.querySelectorAll(".header-score-control").forEach(control => {
        const max = control.querySelector("span")?.textContent || control.textContent?.replace(/✓\s*الكل/g, "").trim() || "";
        if (max) control.textContent = `الدرجة القصوى: ${max}`;
      });

      const title = document.querySelector<HTMLElement>(".gradebook-head h1")?.textContent || "سجل رصد الدرجات";
      const selectedClass = document.querySelector<HTMLSelectElement>(".gradebook-actions select")?.selectedOptions[0]?.textContent || "—";
      const unitSelects = document.querySelectorAll<HTMLSelectElement>(".gradebook-actions select");
      const selectedUnit = unitSelects[1]?.selectedOptions[0]?.textContent || "";
      const rowCount = sourceRows.length;
      const fontSize = rowCount >= 42 ? 5.8 : rowCount >= 36 ? 6.4 : rowCount >= 30 ? 7 : 7.8;
      const rowHeight = Math.max(3.4, Math.min(6.4, 151 / rowCount));
      const teacherName = session?.teacherName || "";
      const subjectName = session?.subject || "المادة";
      const gradeLabel = session?.activeGradeLabel || "";

      popup.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${title}</title><style>
        @page{size:A4 landscape;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#eef2f5;font-family:Arial,Tahoma,sans-serif;color:#111}.toolbar{display:flex;justify-content:center;gap:10px;padding:9px;background:#173f61}.toolbar button{border:0;border-radius:8px;padding:9px 18px;font-weight:800;cursor:pointer}.page{width:297mm;height:210mm;margin:6mm auto;background:#fff;padding:5mm 7mm;overflow:hidden}.portal{text-align:center;color:#173f61;font-size:11px;font-weight:900;border-bottom:1.5px solid #173f61;padding-bottom:2mm}h1{text-align:center;font-size:15px;margin:2mm 0}.meta{display:grid;grid-template-columns:repeat(5,1fr);gap:1mm;border:1px solid #333;padding:2mm;font-size:8px;margin-bottom:2mm}.meta span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}table{width:100%;height:auto;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #333;text-align:center;padding:.5mm 1mm;font-size:${fontSize}px;line-height:1.05;height:${rowHeight}mm;vertical-align:middle}th{background:#e9f0f5;font-weight:900;height:8mm}.sticky-number,.sticky-name{position:static!important;background:inherit!important}.sticky-number{width:9mm}.sticky-name{width:48mm;text-align:right!important}.mobile-grade-control{display:block!important}.student-total{font-weight:900;background:#f3f7fa}.notes-input{width:100%}.grade-step,.row-delete-button{display:none!important}.header-score-control{display:block;font-size:5.5px;margin-top:1px}.footer{display:flex;justify-content:space-between;border-top:1px solid #777;margin-top:2mm;padding-top:1.5mm;font-size:7px}@media print{html,body{background:#fff}.toolbar{display:none}.page{margin:0;width:297mm;height:210mm}}
      </style></head><body><div class="toolbar"><button onclick="window.print()">طباعة أو حفظ PDF</button><button onclick="window.close()">إغلاق</button></div><section class="page"><div class="portal">بوابة أستاذ لحوني التعليمية</div><h1>${title}</h1><div class="meta"><span><b>المعلم:</b> ${teacherName}</span><span><b>المادة:</b> ${subjectName}</span><span><b>المرحلة:</b> ${gradeLabel || "—"}</span><span><b>الفصل:</b> ${selectedClass}</span><span><b>الوحدة:</b> ${selectedUnit || "—"}</span></div>${clone.outerHTML}<div class="footer"><span>عدد الطلاب: ${rowCount}</span><span>توقيع المعلم: ________________</span><strong>سجل رصد الدرجات</strong><span>اعتماد الإدارة: ________________</span></div></section><script>setTimeout(function(){window.print()},350)</script></body></html>`);
      popup.document.close();
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [session?.teacherName, session?.subject, session?.activeGradeLabel]);

  return null;
}
