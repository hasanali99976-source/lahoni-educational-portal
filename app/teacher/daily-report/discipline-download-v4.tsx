"use client";

import { useEffect } from "react";

const W = 1600;
const H = 1131;
const M = 58;
const COLORS = {
  ink: "#183d3e",
  muted: "#64797a",
  line: "#d8e3e3",
  bg: "#f5f8f8",
  white: "#ffffff",
  brand: "#0f4d4e",
  absent: "#b83b3b",
  late: "#d97706",
  excused: "#2563a9",
  escaped: "#7c3fa0",
  lessons: "#0f766e",
};

function isDownloadButton(target: EventTarget | null) {
  const el = target instanceof Element ? target.closest("button") : null;
  if (!el) return null;
  return /تحميل\s*PDF/.test(el.textContent || "") ? (el as HTMLButtonElement) : null;
}
function clean(v: string | null | undefined) { return String(v || "").replace(/\s+/g, " ").trim(); }

function page() {
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = COLORS.bg; ctx.fillRect(0, 0, W, H);
  return { canvas, ctx };
}

function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill = COLORS.white, stroke = COLORS.line, r = 18) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill();
  ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke();
}

function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size = 26, weight: 400 | 600 | 700 = 400, color = COLORS.ink, align: CanvasTextAlign = "right") {
  ctx.save(); ctx.direction = "rtl"; ctx.textAlign = align; ctx.textBaseline = "middle";
  ctx.fillStyle = color; ctx.font = `${weight} ${size}px Tahoma, Arial, sans-serif`; ctx.fillText(value, x, y); ctx.restore();
}

function fitText(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, maxW: number, maxSize = 23, minSize = 14, weight: 400 | 600 | 700 = 600, color = COLORS.ink, align: CanvasTextAlign = "center") {
  let size = maxSize;
  ctx.save(); ctx.direction = "rtl"; ctx.textAlign = align; ctx.textBaseline = "middle"; ctx.fillStyle = color;
  while (size > minSize) {
    ctx.font = `${weight} ${size}px Tahoma, Arial, sans-serif`;
    if (ctx.measureText(value).width <= maxW) break;
    size -= 1;
  }
  ctx.font = `${weight} ${size}px Tahoma, Arial, sans-serif`;
  let out = value;
  if (ctx.measureText(out).width > maxW) {
    while (out.length > 3 && ctx.measureText(out + "…").width > maxW) out = out.slice(0, -1);
    out += "…";
  }
  ctx.fillText(out, x, y); ctx.restore();
}

function header(ctx: CanvasRenderingContext2D, subject: string, scope: string, pageNo: number, totalPages?: number) {
  round(ctx, M, 36, W - M * 2, 128, COLORS.white, "#cbdcdc", 24);
  text(ctx, "بوابة أستاذ لحوني التعليمية", W - M - 30, 76, 34, 700, COLORS.brand);
  text(ctx, "تقرير الحضور والانضباط", W - M - 30, 122, 25, 600, COLORS.muted);
  text(ctx, subject || "المادة", M + 30, 76, 27, 700, COLORS.brand, "left");
  text(ctx, scope || "نطاق التقرير", M + 30, 116, 18, 600, COLORS.muted, "left");
  if (totalPages) text(ctx, `صفحة ${pageNo} من ${totalPages}`, W / 2, 145, 16, 600, "#7a8d8d", "center");
}

function footer(ctx: CanvasRenderingContext2D, pageNo: number) {
  ctx.strokeStyle = "#d9e4e4"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(M, H - 46); ctx.lineTo(W - M, H - 46); ctx.stroke();
  text(ctx, "بوابة أستاذ لحوني التعليمية", W - M, H - 24, 15, 600, "#738687");
  text(ctx, `صفحة ${pageNo}`, M, H - 24, 15, 600, "#738687", "left");
}

function statusColor(label: string) {
  if (/غياب/.test(label)) return COLORS.absent;
  if (/تأخير/.test(label)) return COLORS.late;
  if (/استئذان/.test(label)) return COLORS.excused;
  if (/هروب/.test(label)) return COLORS.escaped;
  if (/حصص/.test(label)) return COLORS.lessons;
  return COLORS.brand;
}

function extractTable(report: HTMLElement) {
  const table = report.querySelector(".dav300-table table");
  if (!table) return { headers: [] as string[], rows: [] as string[][] };
  const headers = Array.from(table.querySelectorAll("thead th")).map(th => clean(th.textContent));
  const rows = Array.from(table.querySelectorAll("tbody tr"))
    .map(tr => Array.from(tr.querySelectorAll("td")).map(td => clean(td.textContent)))
    .filter(r => r.length > 1);
  return { headers, rows };
}

function columnWidths(headers: string[]) {
  const total = W - M * 2;
  if (headers.length >= 8) {
    // م، الاسم، الفصل، غياب، تأخير، استئذان، هروب، حصص المادة
    const base = [70, 430, 170, 150, 150, 150, 150, 200];
    const scale = total / base.reduce((a, b) => a + b, 0);
    return base.map(v => v * scale);
  }
  if (headers.length === 6) {
    // م، الاسم، الفصل، الحالة، الحصص، النسبة
    const base = [80, 500, 190, 220, 220, 210];
    const scale = total / base.reduce((a, b) => a + b, 0);
    return base.map(v => v * scale);
  }
  return headers.map((_, i) => i === 1 ? total * .32 : total * .68 / Math.max(headers.length - 1, 1));
}

async function downloadReport(button: HTMLButtonElement) {
  const report = button.closest(".daily-attendance-v300") as HTMLElement | null;
  if (!report || button.dataset.pdfBusy === "1") return;
  button.dataset.pdfBusy = "1";
  const original = button.textContent || "تحميل PDF مباشرة";
  button.disabled = true; button.textContent = "جاري تجهيز الطباعة...";

  try {
    const { jsPDF } = await import("jspdf");
    const subject = clean(report.querySelector(".dav300-head-badge span")?.textContent) || "المادة";
    const scope = clean(report.querySelector(".rank-scope")?.textContent) || "جميع الفصول";
    const { headers, rows } = extractTable(report);
    const canvases: HTMLCanvasElement[] = [];

    // الصفحة الأولى: ملخص واضح فقط
    {
      const { canvas, ctx } = page();
      header(ctx, subject, scope, 1);
      let y = 205;
      text(ctx, "ملخص تقرير الانضباط", W - M, y + 20, 31, 700, COLORS.ink); y += 62;
      text(ctx, "الإحصائيات مبنية على حصص المادة في نطاق التقرير المحدد", W - M, y, 19, 400, COLORS.muted); y += 42;

      const kpis = Array.from(report.querySelectorAll(".dav300-kpis article"));
      const gap = 16;
      const cw = (W - M * 2 - gap * Math.max(kpis.length - 1, 0)) / Math.max(kpis.length, 1);
      kpis.forEach((el, i) => {
        const x = W - M - cw - i * (cw + gap);
        const label = clean(el.querySelector("small")?.textContent);
        const val = clean(el.querySelector("strong")?.textContent);
        const desc = clean(el.querySelector("em")?.textContent);
        const c = statusColor(label);
        round(ctx, x, y, cw, 120, COLORS.white, COLORS.line, 16);
        ctx.fillStyle = c; ctx.fillRect(x + cw - 8, y, 8, 120);
        fitText(ctx, label, x + cw / 2, y + 28, cw - 26, 18, 14, 700, COLORS.muted, "center");
        text(ctx, val, x + cw / 2, y + 68, 32, 700, c, "center");
        fitText(ctx, desc, x + cw / 2, y + 100, cw - 24, 14, 11, 400, "#7d9091", "center");
      });
      y += 152;

      const groups = Array.from(report.querySelectorAll(".dav300-rank-group"));
      for (const group of groups.slice(0, 4)) {
        const title = clean(group.querySelector("h3")?.textContent);
        const c = statusColor(title);
        const rankingRows = Array.from(group.querySelectorAll(".rank-grid article")).slice(0, 5);
        const boxH = 54 + Math.max(1, rankingRows.length) * 54;
        if (y + boxH > H - 80) break;
        round(ctx, M, y, W - M * 2, boxH, COLORS.white, COLORS.line, 15);
        ctx.fillStyle = c; ctx.fillRect(W - M - 8, y, 8, 54);
        text(ctx, title, W - M - 24, y + 27, 22, 700, c);
        y += 54;
        if (!rankingRows.length) {
          text(ctx, "لا توجد حالات مسجلة", W - M - 24, y + 27, 17, 400, COLORS.muted);
          y += 54;
        } else {
          rankingRows.forEach((row, idx) => {
            if (idx % 2 === 1) { ctx.fillStyle = "#fafcfc"; ctx.fillRect(M + 2, y, W - M * 2 - 4, 54); }
            const name = clean(row.querySelector(".rank-student b")?.textContent);
            const cls = clean(row.querySelector(".rank-student small")?.textContent);
            const count = clean(row.querySelector(".rank-count")?.textContent);
            const percent = clean(row.querySelector(".rank-percent")?.textContent);
            text(ctx, `${idx + 1}`, W - M - 28, y + 27, 18, 700, c);
            fitText(ctx, name, W - M - 80, y + 20, 520, 19, 15, 700, COLORS.ink, "right");
            fitText(ctx, cls, W - M - 80, y + 40, 520, 13, 11, 400, COLORS.muted, "right");
            fitText(ctx, count, M + 300, y + 27, 330, 17, 13, 600, COLORS.ink, "center");
            text(ctx, percent, M + 90, y + 27, 19, 700, c, "center");
            y += 54;
          });
        }
        y += 14;
      }
      footer(ctx, 1);
      canvases.push(canvas);
    }

    // صفحات التفاصيل: جدول ثابت ومقروء
    if (headers.length && rows.length) {
      const widths = columnWidths(headers);
      const rowH = 60;
      const headH = 62;
      let rowIndex = 0;
      let pageNo = 2;
      while (rowIndex < rows.length) {
        const { canvas, ctx } = page();
        header(ctx, subject, scope, pageNo);
        let y = 198;
        text(ctx, "تفاصيل الطلاب", W - M, y + 18, 27, 700, COLORS.ink); y += 50;

        let x = W - M;
        headers.forEach((h, i) => {
          const cw = widths[i] || 120; x -= cw;
          const c = statusColor(h);
          ctx.fillStyle = c === COLORS.brand ? "#e9f0f0" : `${c}18`;
          ctx.fillRect(x, y, cw, headH);
          ctx.strokeStyle = COLORS.line; ctx.strokeRect(x, y, cw, headH);
          fitText(ctx, h, x + cw / 2, y + headH / 2, cw - 16, 18, 13, 700, c === COLORS.brand ? COLORS.ink : c, "center");
        });
        y += headH;

        while (rowIndex < rows.length && y + rowH <= H - 72) {
          const r = rows[rowIndex];
          x = W - M;
          r.forEach((value, i) => {
            const cw = widths[i] || 120; x -= cw;
            ctx.fillStyle = rowIndex % 2 ? "#fafcfc" : COLORS.white; ctx.fillRect(x, y, cw, rowH);
            ctx.strokeStyle = "#dde6e6"; ctx.strokeRect(x, y, cw, rowH);
            const isName = i === 1;
            const h = headers[i] || "";
            const c = /غياب/.test(h) ? COLORS.absent : /تأخير/.test(h) ? COLORS.late : /استئذان/.test(h) ? COLORS.excused : /هروب/.test(h) ? COLORS.escaped : COLORS.ink;
            fitText(ctx, value, x + cw / 2, y + rowH / 2, cw - 18, isName ? 21 : 18, isName ? 15 : 13, isName ? 700 : 600, c, "center");
          });
          y += rowH; rowIndex += 1;
        }
        footer(ctx, pageNo); canvases.push(canvas); pageNo += 1;
      }
    }

    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
    canvases.forEach((c, i) => {
      if (i) pdf.addPage("a4", "landscape");
      pdf.addImage(c.toDataURL("image/jpeg", 0.94), "JPEG", 0, 0, 297, 210, undefined, "FAST");
    });
    const blob = pdf.output("blob");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `تقرير-الانضباط-${subject}.pdf`; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) {
    console.error("discipline print v4 failed", error);
    alert("تعذر تجهيز طباعة تقرير الانضباط الآن.");
  } finally {
    button.dataset.pdfBusy = "0"; button.disabled = false; button.textContent = original;
  }
}

export default function DisciplineDownloadV4() {
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const button = isDownloadButton(event.target); if (!button) return;
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      void downloadReport(button);
    };
    window.addEventListener("click", handler, true);
    return () => window.removeEventListener("click", handler, true);
  }, []);
  return null;
}
