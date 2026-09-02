"use client";

import { jsPDF } from "jspdf";

export type GradebookPdfColumn = {
  id: string;
  label: string;
  max: number;
};

export type GradebookPdfRow = {
  number: number;
  name: string;
  values: number[];
  sectionTotal: number;
  overallTotal: number;
  percentage: number;
};

export type GradebookPdfSection = {
  id: string;
  label: string;
  max: number;
  columns: GradebookPdfColumn[];
  rows: GradebookPdfRow[];
};

export type GradebookPdfClass = {
  className: string;
  sections: GradebookPdfSection[];
  accentColor?: string;
};

export type GradebookPdfDocumentOptions = {
  portalName: string;
  teacherName: string;
  subject: string;
  gradeLabel?: string;
  planLabel: string;
  planVersion: number;
  classes: GradebookPdfClass[];
  fileName: string;
};

const WIDTH = 1600;
const HEIGHT = 1131;
const FONT = "Tajawal, Arial, sans-serif";
const CLASS_ACCENTS = ["#0e4b59", "#2457a1", "#6f3fa0", "#a34f2f", "#2f7a55", "#8a5a05", "#8f3555", "#3f5f8f"];
const MAX_COLUMNS_PER_PAGE = 6;

function chunks<T>(items: T[], size: number) {
  if (!items.length) return [[]] as T[][];
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
}

function createCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("gradebook_pdf_canvas_unavailable");
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
    ? fittedSize(ctx, raw, options.maxWidth, options.size ?? 18, options.min ?? 10, options.weight ?? 700)
    : (options.size ?? 18);
  setFont(ctx, size, options.weight ?? 700);
  ctx.fillStyle = options.color ?? "#173b49";
  ctx.textAlign = options.align ?? "right";
  ctx.fillText(raw, x, y);
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color = "#d6e2e6", width = 1.2) {
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
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  options: GradebookPdfDocumentOptions,
  classReport: GradebookPdfClass,
  section: GradebookPdfSection,
  accent: string,
  classIndex: number,
  columnPageIndex: number,
  columnPageCount: number,
) {
  rounded(ctx, 28, 22, WIDTH - 56, 106, 22, accent);
  text(ctx, options.portalName, WIDTH - 58, 48, { size: 17, weight: 900, color: "#d8edf1", maxWidth: 570 });
  text(ctx, "سجل رصد الدرجات", WIDTH - 58, 84, { size: 28, min: 21, weight: 900, color: "#ffffff", maxWidth: 650 });
  text(ctx, "تقرير الدرجات الكامل", 58, 82, { size: 30, min: 23, weight: 900, color: "#ffffff", align: "left", maxWidth: 500 });
  rounded(ctx, 54, 37, 240, 34, 17, "#f5c34f");
  text(ctx, `الفصل ${classIndex + 1} من ${options.classes.length}`, 174, 54, { size: 14.5, weight: 900, color: "#173b49", align: "center" });

  const meta = [
    ["المعلم", options.teacherName],
    ["المادة", options.subject],
    ["المرحلة", options.gradeLabel || "—"],
    ["الفصل", classReport.className],
    ["القسم", section.label],
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

  const average = section.rows.length
    ? Math.round((section.rows.reduce((sum, row) => sum + row.sectionTotal, 0) / section.rows.length) * 100) / 100
    : 0;
  const summary = [
    ["عدد الطلاب", section.rows.length],
    ["درجة القسم", section.max],
    ["متوسط الفصل", average],
    ["الخطة", `${options.planLabel} — نسخة ${options.planVersion}`],
  ] as const;
  const summaryW = (WIDTH - 56 - gap * 3) / 4;
  summary.forEach(([label, value], index) => {
    const x = WIDTH - 28 - summaryW - index * (summaryW + gap);
    rounded(ctx, x, 223, summaryW, 58, 12, index === 3 ? "#eef6f7" : "#f7fafb", "#d5e2e7");
    text(ctx, value, x + summaryW / 2, 243, { size: 19, min: 11, weight: 900, color: index === 3 ? accent : "#173b49", align: "center", maxWidth: summaryW - 28 });
    text(ctx, label, x + summaryW / 2, 266, { size: 12.5, weight: 900, color: "#71868e", align: "center" });
  });

  if (columnPageCount > 1) {
    text(ctx, `جزء الأعمدة ${columnPageIndex + 1} من ${columnPageCount}`, 30, 265, { size: 13, weight: 900, color: accent, align: "left", maxWidth: 260 });
  }
}

function drawTable(
  ctx: CanvasRenderingContext2D,
  section: GradebookPdfSection,
  columns: Array<{ column: GradebookPdfColumn; originalIndex: number }>,
  accent: string,
) {
  const top = 299;
  const bottom = HEIGHT - 63;
  const x = 28;
  const w = WIDTH - 56;
  const headerH = 58;
  const fittedRows = Math.max(18, section.rows.length);
  const rowH = Math.floor((bottom - top - headerH) / fittedRows);
  const compact = section.rows.length > 24;
  const numberW = 70;
  const nameW = 355;
  const sectionTotalW = 145;
  const overallW = 145;
  const percentW = 115;
  const fixed = numberW + nameW + sectionTotalW + overallW + percentW;
  const gradeW = Math.max(95, (w - fixed) / Math.max(columns.length, 1));
  const tableW = fixed + gradeW * columns.length;
  const right = x + tableW;
  const numberSize = compact ? 11 : 14;
  const nameSize = compact ? 12 : 15;
  const gradeSize = compact ? 11 : 14;

  rounded(ctx, x, top, tableW, bottom - top, 13, "#ffffff", "#bfd1d7");
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, top, tableW, bottom - top);
  ctx.clip();
  ctx.fillStyle = accent;
  ctx.fillRect(x, top, tableW, headerH);

  let cursor = right;
  const headerCell = (width: number, label: string, sub = "") => {
    const center = cursor - width / 2;
    text(ctx, label, center, top + 22, { size: 14, min: 9.5, weight: 900, color: "#ffffff", align: "center", maxWidth: width - 10 });
    if (sub) text(ctx, sub, center, top + 43, { size: 10.5, min: 8.5, weight: 800, color: "#d8edf1", align: "center", maxWidth: width - 10 });
    cursor -= width;
    line(ctx, cursor, top, cursor, bottom, "rgba(255,255,255,.28)", 1);
  };

  headerCell(numberW, "م");
  headerCell(nameW, "اسم الطالب");
  columns.forEach(({ column }) => headerCell(gradeW, column.label, `من ${column.max}`));
  headerCell(sectionTotalW, "مجموع القسم", `من ${section.max}`);
  headerCell(overallW, "المجموع الحالي", "من 100");
  headerCell(percentW, "النسبة", "%");

  section.rows.forEach((row, rowIndex) => {
    const y = top + headerH + rowIndex * rowH;
    ctx.fillStyle = rowIndex % 2 ? "#f6fafb" : "#ffffff";
    ctx.fillRect(x, y, tableW, rowH);
    line(ctx, x, y + rowH, x + tableW, y + rowH);
    let cellRight = right;
    const cell = (width: number, value: unknown, options: { align?: CanvasTextAlign; name?: boolean; strong?: boolean; color?: string } = {}) => {
      const center = cellRight - width / 2;
      if (options.name) {
        text(ctx, value, cellRight - 14, y + rowH / 2, { size: nameSize, min: 9.5, weight: 900, color: options.color, maxWidth: width - 28 });
      } else {
        text(ctx, value, center, y + rowH / 2, { size: options.strong ? gradeSize + 1 : gradeSize, min: 8.5, weight: options.strong ? 900 : 800, color: options.color, align: options.align || "center", maxWidth: width - 10 });
      }
      cellRight -= width;
      line(ctx, cellRight, y, cellRight, y + rowH);
    };

    cell(numberW, row.number, { strong: true });
    cell(nameW, row.name, { name: true });
    columns.forEach(({ originalIndex }) => cell(gradeW, row.values[originalIndex] ?? 0));
    cell(sectionTotalW, row.sectionTotal, { strong: true, color: accent });
    cell(overallW, row.overallTotal, { strong: true, color: "#0d6b52" });
    cell(percentW, `${row.percentage}%`, { strong: true });
  });
  ctx.restore();
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  options: GradebookPdfDocumentOptions,
  classReport: GradebookPdfClass,
  section: GradebookPdfSection,
  pageIndex: number,
  pageCount: number,
) {
  const y = HEIGHT - 31;
  line(ctx, 28, y - 17, WIDTH - 28, y - 17, "#b9cbd1", 1.5);
  text(ctx, options.portalName, 28, y, { size: 12.5, weight: 900, color: "#2d5662", align: "left", maxWidth: 480 });
  text(ctx, `${classReport.className} — ${section.label}`, WIDTH / 2, y, { size: 12.5, weight: 800, color: "#647b84", align: "center", maxWidth: 520 });
  text(ctx, `إجمالي الطلاب: ${section.rows.length} | صفحة ${pageIndex + 1} من ${pageCount}`, WIDTH - 28, y, { size: 12.5, weight: 900, color: "#0d6b52", maxWidth: 520 });
}

export async function downloadGradebookPdfDocument(options: GradebookPdfDocumentOptions) {
  const usableClasses = options.classes.filter(item => item.sections.some(section => section.rows.length > 0));
  if (!usableClasses.length) throw new Error("gradebook_pdf_no_students");
  if (document.fonts?.ready) await document.fonts.ready;

  const pages: Array<{
    classReport: GradebookPdfClass;
    section: GradebookPdfSection;
    classIndex: number;
    columns: Array<{ column: GradebookPdfColumn; originalIndex: number }>;
    columnPageIndex: number;
    columnPageCount: number;
  }> = [];

  usableClasses.forEach((classReport, classIndex) => {
    classReport.sections.filter(section => section.rows.length > 0).forEach(section => {
      const indexed = section.columns.map((column, originalIndex) => ({ column, originalIndex }));
      const columnPages = chunks(indexed, MAX_COLUMNS_PER_PAGE);
      columnPages.forEach((columns, columnPageIndex) => pages.push({
        classReport,
        section,
        classIndex,
        columns,
        columnPageIndex,
        columnPageCount: columnPages.length,
      }));
    });
  });

  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  pages.forEach((pageData, pageIndex) => {
    const { canvas, ctx } = createCanvas();
    const accent = pageData.classReport.accentColor || CLASS_ACCENTS[pageData.classIndex % CLASS_ACCENTS.length];
    drawHeader(ctx, options, pageData.classReport, pageData.section, accent, pageData.classIndex, pageData.columnPageIndex, pageData.columnPageCount);
    drawTable(ctx, pageData.section, pageData.columns, accent);
    drawFooter(ctx, options, pageData.classReport, pageData.section, pageIndex, pages.length);
    if (pageIndex > 0) pdf.addPage("a4", "landscape");
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.96), "JPEG", 0, 0, 297, 210, undefined, "FAST");
  });

  pdf.save(options.fileName);
  const uniqueStudents = usableClasses.reduce((sum, item) => sum + Math.max(0, item.sections[0]?.rows.length || 0), 0);
  return {
    classCount: usableClasses.length,
    studentCount: uniqueStudents,
    pageCount: pages.length,
  };
}
