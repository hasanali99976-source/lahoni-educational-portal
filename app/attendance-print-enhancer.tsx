"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

type AttendanceRow = { number: string; name: string; nationalId: string; status: string };

function readText(selector: string) {
  return document.querySelector<HTMLElement>(selector)?.innerText.trim() || "";
}

function collectRows(): AttendanceRow[] {
  return Array.from(document.querySelectorAll<HTMLElement>(".attendance-list article")).map((article, index) => {
    const info = article.querySelector<HTMLElement>(".student-info");
    const active = article.querySelector<HTMLElement>(".status-buttons button.active");
    return {
      number: info?.querySelector<HTMLElement>("b")?.innerText.trim() || String(index + 1),
      name: info?.querySelector<HTMLElement>("strong")?.innerText.trim() || "طالب",
      nationalId: info?.querySelector<HTMLElement>("small")?.innerText.trim() || "—",
      status: active?.innerText.trim() || "حاضر",
    };
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char] || char));
}

function safeFile(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "-");
}

function printAttendance() {
  const rows = collectRows();
  if (!rows.length) return window.alert("اختر الفصل أولًا حتى تظهر أسماء الطلاب.");
  const title = readText(".attendance-head h1") || "كشف التحضير اليومي";
  const teacher = readText(".attendance-head p");
  const hijri = readText(".hijri-card strong");
  const selectedClass = (document.querySelector<HTMLSelectElement>(".attendance-controls select")?.value || "الفصل").trim();
  const selectedDate = document.querySelector<HTMLInputElement>('.attendance-controls input[type="date"]')?.value || "";
  const stats = Array.from(document.querySelectorAll<HTMLElement>(".attendance-stats span")).map(item => item.innerText.trim());
  const perPage = 24;
  const pages = Array.from({ length: Math.ceil(rows.length / perPage) }, (_, pageIndex) => rows.slice(pageIndex * perPage, (pageIndex + 1) * perPage));
  const win = window.open("", "_blank", "noopener,noreferrer");
  if (!win) return window.alert("اسمح بالنوافذ المنبثقة لفتح صفحة الطباعة.");
  const pageHtml = pages.map((pageRows, pageIndex) => `
    <section class="print-page">
      <header>
        <div class="brand">بوابة أستاذ لحوني التعليمية</div>
        <h1>${escapeHtml(title)}</h1>
        <div class="meta"><span>${escapeHtml(teacher)}</span><span>الفصل: ${escapeHtml(selectedClass)}</span><span>التاريخ: ${escapeHtml(selectedDate)}</span><span>${escapeHtml(hijri)}</span></div>
        <div class="stats">${stats.map(stat => `<span>${escapeHtml(stat)}</span>`).join("")}</div>
      </header>
      <table><thead><tr><th>م</th><th>اسم الطالب</th><th>رقم الهوية</th><th>الحالة</th></tr></thead><tbody>
        ${pageRows.map(row => `<tr><td>${escapeHtml(row.number)}</td><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.nationalId)}</td><td class="status">${escapeHtml(row.status)}</td></tr>`).join("")}
      </tbody></table>
      <footer><strong>بوابة أستاذ لحوني التعليمية</strong><span>صفحة ${pageIndex + 1} من ${pages.length}</span></footer>
    </section>`).join("");
  win.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    @page{size:A4 portrait;margin:0}*{box-sizing:border-box}body{margin:0;background:#e9eef2;font-family:Arial,Tahoma,sans-serif;color:#111}.print-page{position:relative;width:210mm;min-height:297mm;margin:8mm auto;background:#fff;padding:13mm 13mm 18mm;page-break-after:always}.print-page:last-child{page-break-after:auto}.brand{text-align:center;font-size:13px;font-weight:800;border-bottom:2px solid #173f61;padding-bottom:7px;margin-bottom:8px;color:#173f61}h1{text-align:center;font-size:20px;margin:7px 0 10px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:6px 14px;border:1px solid #222;padding:8px;font-size:12px}.stats{display:grid;grid-template-columns:repeat(5,1fr);border:1px solid #222;border-top:0}.stats span{text-align:center;padding:7px 3px;border-left:1px solid #222;font-size:11px;font-weight:700}.stats span:last-child{border-left:0}table{width:100%;border-collapse:collapse;margin-top:10px;table-layout:fixed}th,td{border:1px solid #222;padding:6px 7px;font-size:11px;text-align:right}th{background:#eef3f6;text-align:center}th:first-child,td:first-child{width:9%;text-align:center}th:nth-child(3),td:nth-child(3){width:24%;text-align:center}th:last-child,td:last-child{width:18%;text-align:center}.status{font-weight:800}footer{position:absolute;right:13mm;left:13mm;bottom:7mm;display:flex;justify-content:space-between;border-top:1px solid #777;padding-top:5px;font-size:10px;color:#333}@media print{body{background:#fff}.print-page{margin:0;width:210mm;height:297mm;min-height:297mm;overflow:hidden}}
  </style></head><body>${pageHtml}<script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`);
  win.document.close();
}

function exportExcel() {
  const rows = collectRows();
  if (!rows.length) return window.alert("اختر الفصل أولًا حتى تظهر أسماء الطلاب.");
  const selectedClass = (document.querySelector<HTMLSelectElement>(".attendance-controls select")?.value || "الفصل").trim();
  const selectedDate = document.querySelector<HTMLInputElement>('.attendance-controls input[type="date"]')?.value || "";
  const title = readText(".attendance-head h1") || "كشف التحضير";
  const table = `<table dir="rtl"><tr><th colspan="4">بوابة أستاذ لحوني التعليمية</th></tr><tr><th colspan="4">${escapeHtml(title)} — ${escapeHtml(selectedClass)} — ${escapeHtml(selectedDate)}</th></tr><tr><th>م</th><th>اسم الطالب</th><th>رقم الهوية</th><th>حالة الطالب</th></tr>${rows.map(row => `<tr><td>${escapeHtml(row.number)}</td><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.nationalId)}</td><td>${escapeHtml(row.status)}</td></tr>`).join("")}</table>`;
  const blob = new Blob(["\ufeff", table], { type: "application/vnd.ms-excel;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${safeFile(title)}-${safeFile(selectedClass)}-${selectedDate || "اليوم"}.xls`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export default function AttendancePrintEnhancer() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname !== "/teacher/attendance") return;
    const controls = document.querySelector<HTMLElement>(".attendance-controls");
    if (!controls || controls.querySelector("[data-attendance-print]")) return;
    const printButton = document.createElement("button");
    printButton.type = "button";
    printButton.dataset.attendancePrint = "true";
    printButton.className = "attendance-print-button";
    printButton.textContent = "فتح صفحة الطباعة";
    printButton.addEventListener("click", printAttendance);
    const excelButton = document.createElement("button");
    excelButton.type = "button";
    excelButton.dataset.attendanceExcel = "true";
    excelButton.className = "attendance-print-button attendance-excel-button";
    excelButton.textContent = "تحميل Excel بالحالات";
    excelButton.addEventListener("click", exportExcel);
    controls.append(printButton, excelButton);
    return () => { printButton.remove(); excelButton.remove(); };
  }, [pathname]);
  return null;
}
