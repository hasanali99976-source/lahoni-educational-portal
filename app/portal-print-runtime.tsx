"use client";

import { useEffect } from "react";

async function readyForCapture() {
  if (document.fonts?.ready) await document.fonts.ready;
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 100) || "تقرير";
}

async function savePortfolioPdf(button: HTMLButtonElement) {
  const pages = [...document.querySelectorAll<HTMLElement>("#portfolio-print-preview .print-page")];
  if (!pages.length) throw new Error("لا توجد صفحات جاهزة لملف الإنجاز.");
  await readyForCapture();
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  const original = button.textContent;
  button.disabled = true;
  try {
    for (let index = 0; index < pages.length; index += 1) {
      button.textContent = `إنشاء الصفحة ${index + 1} من ${pages.length}`;
      const page = pages[index];
      const canvas = await html2canvas(page, {
        backgroundColor: "#ffffff",
        scale: Math.max(2, Math.min(2.4, window.devicePixelRatio || 2)),
        useCORS: true,
        allowTaint: false,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        width: page.scrollWidth,
        height: page.scrollHeight,
        windowWidth: Math.max(document.documentElement.clientWidth, page.scrollWidth),
        windowHeight: Math.max(document.documentElement.clientHeight, page.scrollHeight),
      });
      if (index) pdf.addPage("a4", "portrait");
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 210, 297, undefined, "FAST");
      canvas.width = 1;
      canvas.height = 1;
    }
    const teacher = document.querySelector<HTMLElement>(".portfolio-print-cover dl dd")?.textContent?.trim() || "المعلم";
    pdf.save(`${safeFileName(`ملف-إنجاز-${teacher}`)}.pdf`);
  } finally {
    button.disabled = false;
    button.textContent = original || "تنزيل ملف PDF النهائي";
  }
}

async function saveTeacherSummaryPdf(button: HTMLButtonElement) {
  const report = document.getElementById("teacher-report-v9-print");
  if (!report) throw new Error("تعذر العثور على التقرير.");
  const sections = [...report.children].filter((item): item is HTMLElement => item instanceof HTMLElement);
  if (!sections.length) throw new Error("لا توجد أقسام جاهزة للطباعة.");
  await readyForCapture();
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  const margin = 9;
  const usableW = 210 - margin * 2;
  const usableH = 297 - margin * 2;
  let y = margin;
  let hasContent = false;
  const original = button.textContent;
  button.disabled = true;
  try {
    for (let index = 0; index < sections.length; index += 1) {
      button.textContent = `تجهيز التقرير ${index + 1}/${sections.length}`;
      const section = sections[index];
      const canvas = await html2canvas(section, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        scrollX: 0,
        scrollY: 0,
      });
      let renderW = usableW;
      let renderH = canvas.height * renderW / canvas.width;
      if (renderH > usableH) {
        const factor = usableH / renderH;
        renderW *= factor;
        renderH *= factor;
      }
      if (hasContent && y + renderH > 297 - margin) {
        pdf.addPage("a4", "portrait");
        y = margin;
        hasContent = false;
      }
      const x = margin + (usableW - renderW) / 2;
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", x, y, renderW, renderH, undefined, "FAST");
      y += renderH + 5;
      hasContent = true;
      canvas.width = 1;
      canvas.height = 1;
    }
    const teacher = report.querySelector<HTMLElement>(".trv9-print-head p")?.textContent?.match(/المعلم:\s*(.+)$/)?.[1]?.trim() || "المعلم";
    pdf.save(`${safeFileName(`ملخص-عمل-${teacher}`)}.pdf`);
  } finally {
    button.disabled = false;
    button.textContent = original || "PDF";
  }
}

function createDiagnosticPrintWindow(modal: HTMLElement) {
  const title = modal.querySelector<HTMLElement>("h2")?.textContent?.trim() || "اختبار تشخيصي";
  const intro = modal.querySelector<HTMLElement>("header p")?.textContent?.trim() || "";
  const questions = [...modal.querySelectorAll<HTMLElement>(".diagnostic-preview-questions > article")];
  if (!questions.length) throw new Error("لا توجد أسئلة جاهزة للطباعة.");
  const logo = `${window.location.origin}/icons/lahooni-identity-320.jpg`;
  const fontFamily = getComputedStyle(document.body).fontFamily;
  const questionHtml = questions.map((question, qIndex) => {
    const skill = question.querySelector<HTMLElement>(".preview-question-title span")?.textContent?.trim() || "";
    const text = question.querySelector<HTMLElement>("h3")?.textContent?.trim() || "";
    const options = [...question.querySelectorAll<HTMLElement>(".preview-options > div")].map((option, oIndex) => {
      const value = option.querySelector<HTMLElement>("span")?.textContent?.trim() || "";
      const correct = option.classList.contains("correct");
      const letter = "أبجدهوزح"[oIndex] || String(oIndex + 1);
      return `<div class="option${correct ? " correct" : ""}"><b>${letter}</b><span>${value}</span>${correct ? "<em>الإجابة الصحيحة</em>" : ""}</div>`;
    }).join("");
    return `<article class="question"><header><b>السؤال ${qIndex + 1}</b><small>المهارة: ${skill || "غير محددة"}</small></header><h3>${text}</h3><div class="options">${options}</div></article>`;
  }).join("");
  const popup = window.open("", "_blank", "width=1100,height=900");
  if (!popup) throw new Error("اسمح بالنوافذ المنبثقة لفتح الطباعة.");
  popup.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${title}</title><style>
  @page{size:A4 portrait;margin:16mm 11mm 14mm}*{box-sizing:border-box}html,body{margin:0;background:#edf2f1;color:#17343a;font-family:${fontFamily},Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}.toolbar{position:sticky;top:0;z-index:5;display:flex;justify-content:center;gap:9px;padding:10px;background:#0d343d}.toolbar button{border:0;border-radius:10px;padding:10px 16px;font:800 13px inherit;cursor:pointer}.toolbar .primary{background:#d9b967;color:#17343a}.paper{width:188mm;min-height:265mm;margin:12mm auto;padding:8mm;background:#fff;box-shadow:0 14px 40px #17343a1c}.brand{display:grid;grid-template-columns:20mm 1fr auto;gap:4mm;align-items:center;border-bottom:1.2mm solid #0b716a;padding-bottom:4mm;margin-bottom:5mm}.brand img{width:20mm;height:17mm;object-fit:contain}.brand small,.brand strong{display:block}.brand small{font-size:8pt;color:#6b8185}.brand strong{font-size:15pt}.brand i{font-style:normal;border-radius:99px;padding:2mm 3mm;background:#edf7f5;color:#0b716a;font-size:8pt;font-weight:800}.title{text-align:center;margin-bottom:4mm}.title h1{font-size:18pt;margin:0 0 2mm}.title p{font-size:9pt;color:#647b80;margin:0}.student{display:grid;grid-template-columns:1.7fr .65fr .65fr;gap:2mm;margin-bottom:4mm}.student span{border:1px solid #cbdad7;border-radius:2mm;padding:2.3mm;font-size:8.5pt}.question{break-inside:avoid;border:1px solid #cbdad7;border-radius:3mm;padding:3mm;margin-bottom:3mm}.question header{display:flex;justify-content:space-between;gap:3mm;border-bottom:1px solid #e0e8e6;padding-bottom:2mm}.question header b{font-size:9.5pt;color:#0b716a}.question header small{font-size:7.5pt;color:#70868a}.question h3{font-size:11pt;line-height:1.55;margin:2.5mm 0}.options{display:grid;grid-template-columns:1fr 1fr;gap:2mm}.option{display:grid;grid-template-columns:7mm 1fr auto;gap:2mm;align-items:center;border:1px solid #d7e2df;border-radius:2.5mm;padding:2mm;font-size:9pt}.option>b{width:6mm;height:6mm;display:grid;place-items:center;border:1px solid #9fb5b1;border-radius:50%;color:#0b716a}.option em{font-style:normal;font-size:6.5pt;color:#176b4a;font-weight:800}.option.correct{background:#eaf7f1;border-color:#72aa94}body[data-copy="student"] .option.correct{background:#fff;border-color:#d7e2df}body[data-copy="student"] .option em,body[data-copy="student"] .teacher-only{display:none}.footer{display:flex;justify-content:space-between;border-top:1px solid #cbdad7;margin-top:5mm;padding-top:3mm;font-size:8pt;color:#647b80}@media print{html,body{background:#fff}.toolbar{display:none}.paper{width:auto;min-height:auto;margin:0;padding:0;box-shadow:none}}
  </style></head><body data-copy="teacher"><div class="toolbar"><button class="primary" onclick="document.body.dataset.copy='student';setTimeout(()=>window.print(),80)">طباعة نسخة الطالب</button><button onclick="document.body.dataset.copy='teacher';setTimeout(()=>window.print(),80)">طباعة نسخة المعلم</button><button onclick="window.close()">إغلاق</button></div><main class="paper"><section class="brand"><img src="${logo}"><div><small>بوابة أستاذ لحوني التعليمية</small><strong>اختبار تشخيصي</strong></div><i class="teacher-only">نسخة المعلم</i></section><section class="title"><h1>${title}</h1><p>${intro}</p></section><section class="student"><span><b>اسم الطالب:</b> ____________________________</span><span><b>الفصل:</b> ______</span><span><b>التاريخ:</b> ____ / ____</span></section>${questionHtml}<footer class="footer"><span>توقيع المعلم: ____________________</span><strong>بوابة أستاذ لحوني التعليمية</strong><span>مراجعة الطالب: ____________________</span></footer></main></body></html>`);
  popup.document.close();
}

export default function PortalPrintRuntime() {
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest<HTMLButtonElement>("button");
      if (!button) return;

      if (button.matches("#portfolio-print-preview .preview-print[data-web-pdf='true']")) {
        event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
        void savePortfolioPdf(button).catch(error => window.alert(error instanceof Error ? error.message : "تعذر إنشاء ملف PDF."));
        return;
      }

      if (button.matches(".teacher-report-v9 .trv9-scope footer button.primary")) {
        event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
        void saveTeacherSummaryPdf(button).catch(error => window.alert(error instanceof Error ? error.message : "تعذر إنشاء التقرير."));
        return;
      }

      if (button.closest(".diagnostic-preview-modal") && button.textContent?.includes("طباعة الاختبار")) {
        const modal = button.closest<HTMLElement>(".diagnostic-preview-modal");
        if (!modal) return;
        event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
        try { createDiagnosticPrintWindow(modal); }
        catch (error) { window.alert(error instanceof Error ? error.message : "تعذر فتح الطباعة."); }
      }
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, []);
  return null;
}
