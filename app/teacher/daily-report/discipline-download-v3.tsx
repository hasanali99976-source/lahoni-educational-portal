"use client";

import { useEffect } from "react";

const W = 1600;
const H = 1131;
const M = 64;

function isDownloadButton(target: EventTarget | null) {
  const element = target instanceof Element ? target.closest("button") : null;
  if (!element) return null;
  return /تحميل\s*PDF/.test(element.textContent || "") ? element as HTMLButtonElement : null;
}

function clean(text: string | null | undefined) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 18, fill = "#fff", stroke = "#d9e2e2") {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function addText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size = 28, weight: 400 | 600 | 700 = 400, color = "#173334", align: CanvasTextAlign = "right") {
  ctx.save();
  ctx.direction = "rtl";
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px Tahoma, Arial, sans-serif`;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function newPage() {
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#f5f8f8";
  ctx.fillRect(0, 0, W, H);
  return { canvas: c, ctx };
}

function header(ctx: CanvasRenderingContext2D, subject: string, pageNo: number) {
  rounded(ctx, M, 45, W - M * 2, 125, 24, "#ffffff", "#cbdcdc");
  addText(ctx, "بوابة أستاذ لحوني التعليمية", W - M - 34, 82, 34, 700, "#0f4d4e");
  addText(ctx, "تقرير الحضور والانضباط", W - M - 34, 130, 26, 600, "#476767");
  addText(ctx, subject || "المادة", M + 34, 82, 28, 700, "#0f4d4e", "left");
  addText(ctx, `صفحة ${pageNo}`, M + 34, 130, 22, 600, "#6a7f80", "left");
}

function getColor(el: Element) {
  if (el.classList.contains("absence") || el.classList.contains("cell-absence") || el.classList.contains("th-absence")) return "#c64242";
  if (el.classList.contains("late") || el.classList.contains("cell-late") || el.classList.contains("th-late")) return "#d97706";
  if (el.classList.contains("excused") || el.classList.contains("cell-excused") || el.classList.contains("th-excused")) return "#2563a9";
  if (el.classList.contains("escaped") || el.classList.contains("cell-escaped") || el.classList.contains("th-escaped")) return "#7c3fa0";
  if (el.classList.contains("lessons")) return "#0f766e";
  return "#0f4d4e";
}

async function downloadReport(button: HTMLButtonElement) {
  const report = button.closest(".daily-attendance-v300") as HTMLElement | null;
  if (!report || button.dataset.pdfBusy === "1") return;
  button.dataset.pdfBusy = "1";
  const original = button.textContent || "تحميل PDF مباشرة";
  button.disabled = true;
  button.textContent = "جاري إنشاء PDF...";

  try {
    const { jsPDF } = await import("jspdf");
    const subject = clean(report.querySelector(".dav300-head-badge span")?.textContent) || "المادة";
    const pages: HTMLCanvasElement[] = [];
    let pageNo = 1;
    let { canvas, ctx } = newPage();
    header(ctx, subject, pageNo);
    let y = 205;

    const ensure = (need: number) => {
      if (y + need <= H - 70) return;
      pages.push(canvas);
      pageNo += 1;
      const p = newPage(); canvas = p.canvas; ctx = p.ctx;
      header(ctx, subject, pageNo);
      y = 205;
    };

    const headTitle = clean(report.querySelector(".dav300-head h2")?.textContent) || "سجل الحضور والانضباط";
    const headDesc = clean(report.querySelector(".dav300-head p")?.textContent);
    addText(ctx, headTitle, W - M, y + 22, 32, 700, "#153f40");
    if (headDesc) addText(ctx, headDesc, W - M, y + 62, 20, 400, "#657979");
    y += 100;

    const kpis = Array.from(report.querySelectorAll(".dav300-kpis article"));
    if (kpis.length) {
      ensure(145);
      const gap = 16;
      const cardW = (W - M * 2 - gap * (kpis.length - 1)) / kpis.length;
      kpis.forEach((el, i) => {
        const x = W - M - cardW - i * (cardW + gap);
        const color = getColor(el);
        rounded(ctx, x, y, cardW, 118, 18, "#ffffff", "#d8e3e3");
        ctx.fillStyle = color; ctx.fillRect(x, y, 8, 118);
        addText(ctx, clean(el.querySelector("small")?.textContent), x + cardW - 20, y + 28, 18, 600, "#667a7b");
        addText(ctx, clean(el.querySelector("strong")?.textContent), x + cardW - 20, y + 67, 34, 700, color);
        addText(ctx, clean(el.querySelector("em")?.textContent), x + cardW - 20, y + 99, 15, 400, "#7a8d8d");
      });
      y += 145;
    }

    const groups = Array.from(report.querySelectorAll(".dav300-rank-group"));
    for (const group of groups) {
      const title = clean(group.querySelector("h3")?.textContent);
      const color = getColor(group);
      const rows = Array.from(group.querySelectorAll(".rank-grid article"));
      ensure(80 + Math.max(rows.length, 1) * 72);
      rounded(ctx, M, y, W - M * 2, 58, 16, "#ffffff", "#d9e3e3");
      ctx.fillStyle = color; ctx.fillRect(W - M - 10, y, 10, 58);
      addText(ctx, title, W - M - 28, y + 29, 24, 700, color);
      y += 70;
      if (!rows.length) {
        addText(ctx, "لا توجد حالات مسجلة", W - M, y + 25, 20, 400, "#738686");
        y += 60;
      } else {
        for (const row of rows) {
          ensure(74);
          rounded(ctx, M, y, W - M * 2, 62, 12, "#ffffff", "#e1e8e8");
          addText(ctx, clean(row.querySelector(".rank-student b")?.textContent), W - M - 24, y + 21, 21, 700, "#183e3f");
          addText(ctx, clean(row.querySelector(".rank-student small")?.textContent), W - M - 24, y + 45, 15, 400, "#718485");
          addText(ctx, clean(row.querySelector(".rank-count")?.textContent), M + 240, y + 31, 19, 600, "#425f60", "center");
          addText(ctx, clean(row.querySelector(".rank-percent")?.textContent), M + 70, y + 31, 22, 700, color, "center");
          y += 70;
        }
      }
      y += 18;
    }

    const table = report.querySelector(".dav300-table table");
    if (table) {
      const headers = Array.from(table.querySelectorAll("thead th")).map(th => clean(th.textContent));
      const rows = Array.from(table.querySelectorAll("tbody tr")).filter(tr => tr.querySelectorAll("td").length > 1);
      const colCount = Math.max(headers.length, 1);
      const colW = (W - M * 2) / colCount;
      ensure(95);
      addText(ctx, "تفاصيل التقرير", W - M, y + 22, 28, 700, "#153f40");
      y += 55;
      ensure(58);
      headers.forEach((h, i) => {
        const x = W - M - colW * (i + 1);
        ctx.fillStyle = i === 3 ? "#f8e5e5" : i === 4 ? "#fff0dc" : i === 5 ? "#e4eff9" : i === 6 ? "#efe4f5" : "#eaf1f1";
        ctx.fillRect(x, y, colW, 48);
        addText(ctx, h, x + colW / 2, y + 24, 17, 700, "#294d4e", "center");
      });
      y += 48;
      for (const tr of rows) {
        ensure(52);
        const cells = Array.from(tr.querySelectorAll("td")).map(td => clean(td.textContent));
        cells.forEach((txt, i) => {
          const x = W - M - colW * (i + 1);
          ctx.fillStyle = "#ffffff"; ctx.fillRect(x, y, colW, 46);
          ctx.strokeStyle = "#dfe7e7"; ctx.strokeRect(x, y, colW, 46);
          addText(ctx, txt, x + colW / 2, y + 23, i === 1 ? 16 : 15, i === 1 ? 700 : 600, "#294647", "center");
        });
        y += 46;
      }
    }

    pages.push(canvas);

    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
    pages.forEach((p, i) => {
      if (i > 0) pdf.addPage("a4", "landscape");
      pdf.addImage(p.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 297, 210, undefined, "FAST");
    });

    const blob = pdf.output("blob");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `تقرير-الانضباط-${subject}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) {
    console.error("discipline canvas PDF failed", error);
    alert("تعذر تحميل تقرير الانضباط الآن. سيتم إصلاح السبب التقني دون فقد البيانات.");
  } finally {
    button.dataset.pdfBusy = "0";
    button.disabled = false;
    button.textContent = original;
  }
}

export default function DisciplineDownloadV3() {
  useEffect(() => {
    const handle = (event: MouseEvent) => {
      const button = isDownloadButton(event.target);
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      void downloadReport(button);
    };
    window.addEventListener("click", handle, true);
    return () => window.removeEventListener("click", handle, true);
  }, []);
  return null;
}
