"use client";

import { useEffect } from "react";
import { useTeacherClient } from "../../../lib/teacher-client";

const STATUS_CLASS: Record<string, string> = {
  "حاضر": "present",
  "غائب": "absent",
  "متأخر": "late",
  "مستأذن": "excused",
  "هروب": "escaped",
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[character] || character));
}

export default function AttendancePrintEnhancer() {
  const session = useTeacherClient();

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>(".attendance-pdf");
      if (!button || !button.closest(".attendance-page")) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const className = document.querySelector<HTMLSelectElement>('[data-attendance-class-select="true"]')?.selectedOptions[0]?.textContent?.trim() || "—";
      const date = document.querySelector<HTMLInputElement>('[data-attendance-date-input="true"]')?.value || "—";
      const cards = [...document.querySelectorAll<HTMLElement>(".attendance-student-card")];
      if (!cards.length) return window.alert("اختر فصلًا يحتوي على طلاب أولًا.");

      const rows = cards.map((card, index) => ({
        number: index + 1,
        name: card.querySelector<HTMLElement>(".student-info strong")?.textContent?.trim() || "طالب دون اسم",
        status: card.querySelector<HTMLElement>(".student-info em")?.textContent?.trim() || "حاضر",
      }));
      const counts = Object.fromEntries(Object.keys(STATUS_CLASS).map(status => [status, rows.filter(row => row.status === status).length]));
      const rowCount = rows.length;
      const fontSize = rowCount >= 44 ? 7.3 : rowCount >= 38 ? 8 : rowCount >= 32 ? 8.7 : 9.4;
      const rowHeight = Math.max(4.1, Math.min(6.3, 137 / rowCount));
      const logoUrl = `${window.location.origin}/icons/ostadh-lahooni-192.jpg`;
      const teacherName = session?.teacherName || "المعلم";
      const subjectName = session?.subject || "المادة";
      const gradeLabel = session?.activeGradeLabel || "";
      const bodyRows = rows.map(row => `<tr><td class="index">${row.number}</td><td class="student">${escapeHtml(row.name)}</td><td><span class="status ${STATUS_CLASS[row.status] || "present"}">${escapeHtml(row.status)}</span></td><td class="notes"></td></tr>`).join("");

      const popup = window.open("", "_blank", "width=1400,height=920");
      if (!popup) return window.alert("اسمح بالنوافذ المنبثقة لفتح التقرير.");

      popup.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>تقرير حضور ${escapeHtml(className)}</title><style>
@page{size:A4 landscape;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#e9eef2;color:#153247;font-family:'Segoe UI',Tahoma,Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}.toolbar{display:flex;justify-content:center;gap:9px;padding:10px;background:#123e50}.toolbar button{border:0;border-radius:10px;padding:10px 18px;font-weight:900;cursor:pointer}.toolbar .print{background:#f3c65b;color:#17313b}.toolbar .close{background:#fff;color:#17313b}.page{width:297mm;height:210mm;margin:6mm auto;background:#fff;overflow:hidden;position:relative;box-shadow:0 18px 48px rgba(16,42,53,.18)}.top{height:31mm;padding:5mm 7mm;display:flex;align-items:center;justify-content:space-between;background:linear-gradient(135deg,#0b3543,#0f6573 70%,#178b91);color:#fff;position:relative;overflow:hidden}.top:after{content:'';position:absolute;left:-18mm;top:-38mm;width:82mm;height:82mm;border:1.2mm solid rgba(255,255,255,.12);border-radius:50%}.brand{display:flex;align-items:center;gap:3.5mm;position:relative;z-index:1}.brand img{width:15mm;height:15mm;border-radius:4mm;border:1mm solid rgba(255,255,255,.25);background:#fff}.brand strong{display:block;font-size:14px}.brand small{display:block;margin-top:1mm;font-size:8.5px;color:#d5edf0}.title{text-align:left;position:relative;z-index:1}.title span{display:inline-block;padding:1.3mm 3mm;border-radius:99px;background:#f3c65b;color:#17313b;font-size:8px;font-weight:900}.title h1{margin:2mm 0 0;font-size:19px}.body{height:179mm;padding:4mm 6mm 3mm;display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;gap:2.6mm}.meta{display:grid;grid-template-columns:1.25fr 1fr .9fr 1.05fr 1.4fr;gap:1.8mm}.meta div{min-height:12mm;padding:2mm 2.5mm;border:1px solid #d8e4e9;border-radius:2.7mm;background:#f8fbfc}.meta small{display:block;font-size:7.5px;color:#6d828b;font-weight:800}.meta strong{display:block;margin-top:.8mm;font-size:9.7px;color:#153b47;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.summary{display:grid;grid-template-columns:repeat(6,1fr);gap:1.8mm}.summary article{padding:1.8mm;border-radius:2.6mm;text-align:center;border:1px solid #e0e8eb}.summary strong{display:block;font-size:15px;line-height:1}.summary span{display:block;margin-top:.8mm;font-size:7.7px;font-weight:900}.summary .all{background:#edf5f7;color:#17495a}.summary .present{background:#e3f7ec;color:#11643a}.summary .absent{background:#fde7ea;color:#9d2835}.summary .late{background:#fff1cf;color:#895704}.summary .excused{background:#e6efff;color:#2357a4}.summary .escaped{background:#efe5ff;color:#5c349d}.table-wrap{min-height:0;display:flex;justify-content:flex-start;align-items:flex-start;overflow:hidden}table{direction:rtl;width:100%;margin:0 0 0 auto;border-collapse:separate;border-spacing:0;table-layout:fixed;border:1px solid #bfd1d8;border-radius:3mm;overflow:hidden}thead th{height:8mm;padding:1.7mm;background:linear-gradient(180deg,#174b5a,#123d4a);color:#fff;border-left:1px solid rgba(255,255,255,.17);font-size:${fontSize + .4}px;font-weight:900}tbody td{height:${rowHeight}mm;padding:.8mm 1.6mm;border-top:1px solid #d8e4e8;border-left:1px solid #e4ecef;font-size:${fontSize}px;text-align:center;vertical-align:middle}tbody tr:nth-child(even){background:#f7fafb}.index{width:9mm;font-weight:900;color:#174958}.student{width:46%;text-align:right!important;font-weight:850;padding-right:3mm!important}.notes{width:26%}.status{display:inline-flex;align-items:center;justify-content:center;min-width:21mm;padding:1mm 2mm;border-radius:99px;font-size:${Math.max(7.2,fontSize - .5)}px;font-weight:900}.status.present{background:#dff5e8;color:#11643a}.status.absent{background:#fde3e7;color:#9e2432}.status.late{background:#ffedbb;color:#855300}.status.excused{background:#dce8ff;color:#2052a0}.status.escaped{background:#eaddff;color:#582c99}.footer{display:grid;grid-template-columns:1fr auto 1fr;align-items:end;gap:8mm;padding-top:2mm;border-top:1px dashed #aabdc4;font-size:8px;color:#647a83}.footer span:last-child{text-align:left}.footer strong{padding:1mm 3mm;border:1px solid #d6aa3c;border-radius:99px;color:#8b6713;background:#fff9e7;font-size:8px}@media print{html,body{background:#fff}.toolbar{display:none}.page{margin:0;box-shadow:none}}
</style></head><body><div class="toolbar"><button class="print" onclick="window.print()">طباعة أو حفظ PDF</button><button class="close" onclick="window.close()">إغلاق</button></div><section class="page"><header class="top"><div class="brand"><img src="${logoUrl}" alt="شعار البوابة"><div><strong>بوابة أستاذ لحوني التعليمية</strong><small>سجل الحضور والمتابعة اليومية</small></div></div><div class="title"><span>تقرير صفحة واحدة</span><h1>تقرير الحضور اليومي</h1></div></header><main class="body"><section class="meta"><div><small>المعلم</small><strong>${escapeHtml(teacherName)}</strong></div><div><small>المادة</small><strong>${escapeHtml(subjectName)}</strong></div><div><small>المرحلة</small><strong>${escapeHtml(gradeLabel || "—")}</strong></div><div><small>الفصل</small><strong>${escapeHtml(className)}</strong></div><div><small>التاريخ</small><strong>${escapeHtml(date)}</strong></div></section><section class="summary"><article class="all"><strong>${rowCount}</strong><span>إجمالي الطلاب</span></article><article class="present"><strong>${counts["حاضر"] || 0}</strong><span>حاضر</span></article><article class="absent"><strong>${counts["غائب"] || 0}</strong><span>غائب</span></article><article class="late"><strong>${counts["متأخر"] || 0}</strong><span>متأخر</span></article><article class="excused"><strong>${counts["مستأذن"] || 0}</strong><span>مستأذن</span></article><article class="escaped"><strong>${counts["هروب"] || 0}</strong><span>هروب</span></article></section><div class="table-wrap"><table><colgroup><col style="width:9mm"><col><col style="width:31mm"><col style="width:70mm"></colgroup><thead><tr><th>م</th><th>اسم الطالب</th><th>الحالة</th><th>ملاحظات</th></tr></thead><tbody>${bodyRows}</tbody></table></div><footer class="footer"><span>توقيع المعلم: ____________________</span><strong>تحضير يومي موثّق</strong><span>اعتماد الإدارة: ____________________</span></footer></main></section></body></html>`);
      popup.document.close();
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [session?.teacherName, session?.subject, session?.activeGradeLabel]);

  return null;
}
