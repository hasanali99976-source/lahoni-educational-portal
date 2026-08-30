"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[character] || character));
}

function printableTimetable() {
  const source = document.querySelector<HTMLTableElement>(".timetable-page .weekly-table");
  if (!source) {
    window.alert("تعذر العثور على الجدول الدراسي. حدّث الصفحة ثم أعد المحاولة.");
    return;
  }

  const clone = source.cloneNode(true) as HTMLTableElement;
  clone.querySelectorAll<HTMLButtonElement>("button").forEach(button => {
    const cell = document.createElement("div");
    cell.className = button.className;
    cell.innerHTML = button.innerHTML;
    button.replaceWith(cell);
  });

  const meta = [...document.querySelectorAll<HTMLElement>(".timetable-page .timetable-meta > *")]
    .map(item => item.textContent?.replace(/\s+/g, " ").trim() || "")
    .filter(Boolean);
  const title = document.querySelector<HTMLElement>(".timetable-page h1")?.textContent?.trim() || "الجدول الدراسي";
  const popup = window.open("", "_blank", "width=1400,height=920");
  if (!popup) {
    window.alert("اسمح بالنوافذ المنبثقة حتى تظهر نسخة طباعة الجدول.");
    return;
  }

  popup.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>
    @page{size:A4 landscape;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#edf2f5;font-family:Arial,Tahoma,sans-serif;color:#111}.toolbar{display:flex;justify-content:center;gap:10px;padding:10px;background:#173f5d;position:sticky;top:0;z-index:2}.toolbar button{border:0;border-radius:9px;padding:10px 18px;font:inherit;font-weight:800;cursor:pointer}.page{width:297mm;min-height:210mm;margin:7mm auto;background:#fff;padding:7mm 8mm}.portal{text-align:center;color:#173f5d;font-size:12px;font-weight:900;border-bottom:2px solid #173f5d;padding-bottom:2mm}h1{text-align:center;font-size:18px;margin:3mm 0}.meta{display:flex;flex-wrap:wrap;justify-content:center;gap:2mm;margin-bottom:3mm}.meta span{border:1px solid #8ba0ae;border-radius:99px;padding:1.5mm 3mm;font-size:9px;font-weight:800}.weekly-table{display:table!important;width:100%!important;border-collapse:collapse!important;table-layout:fixed!important}.weekly-table thead{display:table-header-group!important}.weekly-table tbody{display:table-row-group!important}.weekly-table tr{display:table-row!important}.weekly-table th,.weekly-table td{display:table-cell!important;border:1px solid #394b57!important;padding:1.2mm!important;text-align:center!important;vertical-align:middle!important}.weekly-table th{background:#e6edf2!important;color:#111!important;font-size:8.5px!important;font-weight:900!important}.weekly-table th:first-child{width:19mm!important}.weekly-table td>div{min-height:23mm!important;display:grid!important;align-content:center!important;justify-items:center!important;gap:1mm!important;padding:1mm!important;background:#fff!important;border:0!important;color:#111!important}.weekly-table td>div.filled{background:#eef5f9!important}.weekly-table small{font-size:7px!important}.weekly-table strong{font-size:8px!important;color:#111!important}.weekly-table span{font-size:9px!important;font-weight:900!important}.weekly-table em{font-size:6.5px!important}.footer{display:flex;justify-content:space-between;border-top:1px solid #777;margin-top:3mm;padding-top:2mm;font-size:8px}@media print{html,body{background:#fff}.toolbar{display:none}.page{margin:0;width:297mm;min-height:210mm}}
  </style></head><body><div class="toolbar"><button onclick="window.print()">طباعة أو حفظ PDF</button><button onclick="window.close()">إغلاق</button></div><section class="page"><div class="portal">بوابة أستاذ لحوني التعليمية</div><h1>${escapeHtml(title)}</h1><div class="meta">${meta.map(item => `<span>${escapeHtml(item)}</span>`).join("")}</div>${clone.outerHTML}<div class="footer"><strong>بوابة أستاذ لحوني التعليمية</strong><span>الجدول الأسبوعي الكامل</span><span>توقيع المعلم: __________________</span></div></section><script>setTimeout(function(){window.print()},450)</script></body></html>`);
  popup.document.close();
}

export default function TeacherV24RuntimeFixes() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname !== "/teacher/timetable") return;
    const onClick = (event: MouseEvent) => {
      const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>(".print-main");
      if (!button || !button.closest(".timetable-page")) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      printableTimetable();
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname]);

  return null;
}
