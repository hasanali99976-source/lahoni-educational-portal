"use client";

import { jsPDF } from "jspdf";

export type AttendancePdfRow = {
  number: number;
  name: string;
  status: string;
};

export type AttendancePdfCounts = {
  present: number;
  absent: number;
  late: number;
  excused: number;
  escaped: number;
};

export type AttendancePdfClass = {
  className: string;
  rows: AttendancePdfRow[];
  counts: AttendancePdfCounts;
  accentColor?: string;
};

export type AttendancePdfDocumentOptions = {
  portalName: string;
  teacherName: string;
  subject: string;
  date: string;
  hijriDate: string;
  classes: AttendancePdfClass[];
  fileName: string;
};

const WIDTH = 1600;
const HEIGHT = 1131;
const ROWS_PER_PAGE = 18;
const FONT = "Tajawal, Arial, sans-serif";
const DEFAULT_ACCENT = "#0e4b59";
const CLASS_ACCENTS = ["#0e4b59", "#2457a1", "#6f3fa0", "#a34f2f", "#2f7a55", "#8a5a05", "#8f3555", "#3f5f8f"];

function chunks<T>(items: T[], size: number) {
  if (!items.length) return [] as T[][];
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
}

function createCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("attendance_pdf_canvas_unavailable");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.textBaseline = "middle";
  ctx.direction = "rtl";
  return { canvas, ctx };
}

function setFont(ctx: CanvasRenderingContext2D, size: number, weight = 700) {
  ctx.font = `${weight} ${size}px ${FONT}`;
}

function fittedSize(ctx: CanvasRenderingContext2D, value: string, maxWidth: number, preferred: number, minimum: number, weight = 700) {
  let size = preferred;
  while (size > minimum) {
    setFont(ctx, size, weight);
    if (ctx.measureText(value).width <= maxWidth) break;
    size -= 0.5;
  }
  return size;
}

function text(
  ctx: CanvasRenderingContext2D,
  value: unknown,
  x: number,
  y: number,
  options: { size?: number; min?: number; weight?: number; color?: string; align?: CanvasTextAlign; maxWidth?: number } = {},
) {
  const raw = String(value ?? "");
  const size = options.maxWidth
    ? fittedSize(ctx, raw, options.maxWidth, options.size ?? 18, options.min ?? 11, options.weight ?? 700)
    : (options.size ?? 18);
  setFont(ctx, size, options.weight ?? 700);
  ctx.fillStyle = options.color ?? "#173b49";
  ctx.textAlign = options.align ?? "right";
  ctx.fillText(raw, x, y);
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color = "#d6e2e6", width = 1.3) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number, fill: string, stroke?: string) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function statusStyle(status: string) {
  if (status === "حاضر") return { fill: "#e0f3e7", color: "#13643d" };
  if (status === "غائب") return { fill: "#fde6e9", color: "#a72c39" };
  if (status === "متأخر") return { fill: "#fff0c9", color: "#8a5a05" };
  if (status === "مستأذن") return { fill: "#e3edff", color: "#2457a1" };
  return { fill: "#eee4ff", color: "#6239a4" };
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  options: AttendancePdfDocumentOptions,
  classReport: AttendancePdfClass,
  accent: string,
  pageIndex: number,
  pageCount: number,
  classIndex: number,
) {
  rounded(ctx, 28, 22, WIDTH - 56, 106, 22, accent);
  text(ctx, options.portalName, WIDTH - 58, 48, { size: 17, weight: 900, color: "#d8edf1", maxWidth: 570 });
  text(ctx, "سجل الحضور والمتابعة اليومية", WIDTH - 58, 84, { size: 27, min: 19, weight: 900, color: "#ffffff", maxWidth: 650 });
  text(ctx, "تقرير الحضور اليومي", 58, 82, { size: 31, min: 24, weight: 900, color: "#ffffff", align: "left", maxWidth: 560 });
  rounded(ctx, 54, 37, 188, 34, 17, "#f5c34f");
  text(ctx, `صفحة ${pageIndex + 1} من ${pageCount}`, 148, 54, { size: 15, weight: 900, color: "#173b49", align: "center" });

  const meta = [
    ["المعلم", options.teacherName],
    ["المادة", options.subject],
    ["الفصل", classReport.className],
    ["التاريخ", options.date],
    ["التاريخ الهجري", options.hijriDate],
  ];
  const gap = 10;
  const margin = 28;
  const boxW = (WIDTH - margin * 2 - gap * (meta.length - 1)) / meta.length;
  meta.forEach(([label, value], index) => {
    const x = WIDTH - margin - boxW - index * (boxW + gap);
    rounded(ctx, x, 143, boxW, 66, 13, "#f7fafb", "#cfdee3");
    text(ctx, label, x + boxW - 13, 164, { size: 12.5, weight: 800, color: "#71868e", maxWidth: boxW - 26 });
    text(ctx, value, x + boxW - 13, 189, { size: 17, min: 11.5, weight: 900, maxWidth: boxW - 26 });
  });

  const summary = [
    ["إجمالي الفصل", classReport.rows.length, "#edf4f6", "#173b49"],
    ["حاضر", classReport.counts.present, "#e0f3e7", "#13643d"],
    ["غائب", classReport.counts.absent, "#fde6e9", "#a72c39"],
    ["متأخر", classReport.counts.late, "#fff0c9", "#8a5a05"],
    ["مستأذن", classReport.counts.excused, "#e3edff", "#2457a1"],
    ["هروب", classReport.counts.escaped, "#eee4ff", "#6239a4"],
  ] as const;
  const summaryW = (WIDTH - 56 - gap * 5) / 6;
  summary.forEach(([label, value, fill, color], index) => {
    const x = WIDTH - 28 - summaryW - index * (summaryW + gap);
    rounded(ctx, x, 223, summaryW, 58, 12, fill, "#d5e2e7");
    text(ctx, value, x + summaryW / 2, 243, { size: 21, weight: 900, color, align: "center" });
    text(ctx, label, x + summaryW / 2, 266, { size: 13, weight: 900, color, align: "center" });
  });

  text(ctx, `الفصل ${classIndex + 1} من ${options.classes.length}`, 30, 265, { size: 13, weight: 900, color: accent, align: "left", maxWidth: 220 });
}

function drawTable(ctx: CanvasRenderingContext2D, rows: AttendancePdfRow[], accent: string) {
  const top = 299;
  const bottom = HEIGHT - 63;
  const x = 28;
  const w = WIDTH - 56;
  const headerH = 46;
  const fittedRows = Math.max(ROWS_PER_PAGE, rows.length);
  const rowH = Math.floor((bottom - top - headerH) / fittedRows);
  const compact = rows.length > ROWS_PER_PAGE;
  const numberSize = compact ? Math.max(11, 17 - (rows.length - ROWS_PER_PAGE) * 0.24) : 17;
  const nameSize = compact ? Math.max(11.5, 19 - (rows.length - ROWS_PER_PAGE) * 0.3) : 19;
  const statusSize = compact ? Math.max(10, 15 - (rows.length - ROWS_PER_PAGE) * 0.22) : 15;
  const numberW = 105;
  const statusW = 260;
  const nameW = w - numberW - statusW;

  rounded(ctx, x, top, w, bottom - top, 13, "#ffffff", "#bfd1d7");
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, top, w, bottom - top);
  ctx.clip();
  ctx.fillStyle = accent;
  ctx.fillRect(x, top, w, headerH);
  text(ctx, "م", x + w - numberW / 2, top + headerH / 2, { size: 16, weight: 900, color: "#ffffff", align: "center" });
  text(ctx, "اسم الطالب", x + statusW + nameW / 2, top + headerH / 2, { size: 17, weight: 900, color: "#ffffff", align: "center" });
  text(ctx, "الحالة", x + statusW / 2, top + headerH / 2, { size: 16, weight: 900, color: "#ffffff", align: "center" });
  line(ctx, x + statusW, top, x + statusW, bottom);
  line(ctx, x + statusW + nameW, top, x + statusW + nameW, bottom);

  rows.forEach((row, index) => {
    const y = top + headerH + index * rowH;
    ctx.fillStyle = index % 2 ? "#f6fafb" : "#ffffff";
    ctx.fillRect(x, y, w, rowH);
    line(ctx, x, y + rowH, x + w, y + rowH);
    text(ctx, row.number, x + w - numberW / 2, y + rowH / 2, { size: numberSize, min: 9.5, weight: 900, align: "center" });
    text(ctx, row.name, x + w - numberW - 18, y + rowH / 2, { size: nameSize, min: 10.5, weight: 900, maxWidth: nameW - 36 });
    const style = statusStyle(row.status);
    const pillPad = Math.max(3, Math.min(7, Math.floor(rowH * 0.18)));
    rounded(ctx, x + 55, y + pillPad, statusW - 110, Math.max(12, rowH - pillPad * 2), Math.max(6, (rowH - pillPad * 2) / 2), style.fill);
    text(ctx, row.status, x + statusW / 2, y + rowH / 2, { size: statusSize, min: 9, weight: 900, color: style.color, align: "center", maxWidth: statusW - 130 });
  });
  ctx.restore();
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  options: AttendancePdfDocumentOptions,
  classReport: AttendancePdfClass,
  pageRows: AttendancePdfRow[],
  classPageIndex: number,
  classPageCount: number,
) {
  const y = HEIGHT - 31;
  line(ctx, 28, y - 17, WIDTH - 28, y - 17, "#b9cbd1", 1.5);
  text(ctx, options.portalName, 28, y, { size: 12.5, weight: 900, color: "#2d5662", align: "left", maxWidth: 480 });
  text(ctx, `${classReport.className} — ${options.date}`, WIDTH / 2, y, { size: 12.5, weight: 800, color: "#647b84", align: "center", maxWidth: 520 });
  text(ctx, `طلاب الصفحة: ${pageRows.length} | إجمالي الفصل: ${classReport.rows.length} | ${classPageIndex + 1}/${classPageCount}`, WIDTH - 28, y, { size: 12.5, weight: 900, color: "#0d6b52", maxWidth: 560 });
}

function renderPage(
  options: AttendancePdfDocumentOptions,
  classReport: AttendancePdfClass,
  pageRows: AttendancePdfRow[],
  pageIndex: number,
  pageCount: number,
  classIndex: number,
) {
  const { canvas, ctx } = createCanvas();
  const accent = classReport.accentColor || CLASS_ACCENTS[classIndex % CLASS_ACCENTS.length] || DEFAULT_ACCENT;
  drawHeader(ctx, options, classReport, accent, pageIndex, pageCount, classIndex);
  drawTable(ctx, pageRows, accent);
  drawFooter(ctx, options, classReport, pageRows, pageIndex, pageCount);
  return canvas;
}

export async function downloadAttendancePdfDocument(options: AttendancePdfDocumentOptions) {
  const usableClasses = options.classes.filter(item => item.rows.length > 0);
  if (!usableClasses.length) throw new Error("attendance_pdf_no_students");
  if (document.fonts?.ready) await document.fonts.ready;

  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  let pageCount = 0;
  let studentCount = 0;

  usableClasses.forEach((classReport, classIndex) => {
    const pages = [classReport.rows];
    pages.forEach((pageRows, pageIndex) => {
      const canvas = renderPage(options, classReport, pageRows, pageIndex, pages.length, classIndex);
      if (pageCount > 0) pdf.addPage("a4", "landscape");
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.96), "JPEG", 0, 0, 297, 210, undefined, "FAST");
      pageCount += 1;
    });
    studentCount += classReport.rows.length;
  });

  pdf.save(options.fileName);
  return { pageCount, classCount: usableClasses.length, studentCount };
}
