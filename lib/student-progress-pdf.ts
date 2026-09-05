"use client";

import { jsPDF } from "jspdf";
import {
  createPrintCanvas,
  drawFixedText,
  drawImageContain,
  ensurePrintFontsReady,
  loadPortalPrintLogo,
  printLine,
  roundedRect,
} from "./portal-print-system";

export type StudentProgressPdfSubject = {
  subject: string;
  teacher: string;
  percentage: number;
  discipline: number;
  noteCount: number;
  accent?: string;
};

export type StudentProgressPdfNote = {
  subject: string;
  text: string;
  teacher?: string;
  date?: string;
};

export type StudentProgressPdfOptions = {
  portalName: string;
  studentName: string;
  className: string;
  studentCode: string;
  overallAverage: number;
  overallDiscipline: number;
  statusLabel: string;
  subjects: StudentProgressPdfSubject[];
  notes: StudentProgressPdfNote[];
  fileName: string;
};

const W = 1240;
const H = 1754;
const NAVY = "#083d54";
const TEAL = "#0b8f88";
const GOLD = "#d3a64a";
const INK = "#173d4b";
const MUTED = "#6e838c";
const LINE = "#dbe6e8";

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

function drawHeader(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null, options: StudentProgressPdfOptions, page: number, pages: number) {
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, W, 205);
  ctx.fillStyle = TEAL;
  ctx.fillRect(0, 0, W, 14);
  roundedRect(ctx, W - 176, 34, 128, 128, 22, "#ffffff");
  if (logo) drawImageContain(ctx, logo, W - 166, 44, 108, 108, 2);
  drawFixedText(ctx, options.portalName, W - 205, 58, { size: 24, weight: 850, color: "#bfe8e4", maxWidth: 520 });
  drawFixedText(ctx, "بيان التقدم الأكاديمي للطالب", W - 205, 105, { size: 38, weight: 900, color: "#ffffff", maxWidth: 720 });
  drawFixedText(ctx, "تقرير شامل للتحصيل والانضباط ومتابعة المعلمين", W - 205, 154, { size: 21, weight: 750, color: "#d9e9ed", maxWidth: 720 });
  drawFixedText(ctx, `صفحة ${page} من ${pages}`, 54, 166, { size: 16, weight: 800, color: "#cfe1e5", align: "left" });
}

function drawIdentity(ctx: CanvasRenderingContext2D, options: StudentProgressPdfOptions) {
  roundedRect(ctx, 48, 232, W - 96, 142, 22, "#ffffff", LINE);
  const cols = [
    ["اسم الطالب", options.studentName],
    ["الصف / الفصل", options.className],
    ["كود الطالب", options.studentCode],
  ];
  const colW = (W - 128) / 3;
  cols.forEach(([label, value], index) => {
    const x = W - 64 - index * colW;
    drawFixedText(ctx, label, x, 275, { size: 17, weight: 800, color: MUTED, maxWidth: colW - 24 });
    drawFixedText(ctx, value, x, 326, { size: 27, weight: 900, color: INK, maxWidth: colW - 24 });
    if (index < 2) printLine(ctx, x - colW + 12, 255, x - colW + 12, 350, "#e4ecee", 1.3);
  });
}

function drawSummary(ctx: CanvasRenderingContext2D, options: StudentProgressPdfOptions) {
  const cards = [
    { label: "متوسط التحصيل", value: `${Math.round(options.overallAverage)}٪`, bg: "#e8f6f3", fg: "#0a716b" },
    { label: "متوسط الانضباط", value: `${Math.round(options.overallDiscipline)}٪`, bg: "#edf3fb", fg: "#2d5f9f" },
    { label: "المستوى العام", value: options.statusLabel, bg: "#fbf4e5", fg: "#8a6420" },
  ];
  const gap = 16;
  const cardW = (W - 96 - gap * 2) / 3;
  cards.forEach((card, index) => {
    const x = W - 48 - cardW - index * (cardW + gap);
    roundedRect(ctx, x, 400, cardW, 116, 19, card.bg);
    drawFixedText(ctx, card.label, x + cardW - 22, 433, { size: 17, weight: 850, color: card.fg, maxWidth: cardW - 44 });
    drawFixedText(ctx, card.value, x + cardW - 22, 477, { size: 31, weight: 900, color: card.fg, maxWidth: cardW - 44 });
  });
}

function drawSubjectTable(ctx: CanvasRenderingContext2D, subjects: StudentProgressPdfSubject[], startY: number) {
  const x = 48;
  const w = W - 96;
  const headerH = 58;
  const rowH = 66;
  const widths = [280, 300, 180, 180, 140];
  const labels = ["المادة", "المعلم", "التحصيل", "الانضباط", "الملاحظات"];
  const totalH = headerH + Math.max(subjects.length, 1) * rowH;
  roundedRect(ctx, x, startY, w, totalH, 18, "#ffffff", LINE);
  ctx.fillStyle = NAVY;
  ctx.fillRect(x, startY, w, headerH);
  let cursor = x + w;
  labels.forEach((label, index) => {
    const ww = widths[index];
    drawFixedText(ctx, label, cursor - ww / 2, startY + headerH / 2, { size: 18, weight: 900, color: "#ffffff", align: "center", maxWidth: ww - 12 });
    cursor -= ww;
    if (index < labels.length - 1) printLine(ctx, cursor, startY, cursor, startY + totalH, "#dbe6e8", 1.2);
  });
  if (!subjects.length) {
    drawFixedText(ctx, "بانتظار رصد المواد", W / 2, startY + headerH + rowH / 2, { size: 21, weight: 800, color: MUTED, align: "center" });
    return totalH;
  }
  subjects.forEach((subject, row) => {
    const y = startY + headerH + row * rowH;
    ctx.fillStyle = row % 2 ? "#f8fbfb" : "#ffffff";
    ctx.fillRect(x, y, w, rowH);
    ctx.fillStyle = subject.accent || TEAL;
    ctx.fillRect(W - 53, y + 12, 5, rowH - 24);
    printLine(ctx, x, y + rowH, x + w, y + rowH, "#e4ecee", 1.1);
    let r = x + w;
    const values = [subject.subject, subject.teacher, `${Math.round(clamp(subject.percentage))}٪`, `${Math.round(clamp(subject.discipline))}٪`, String(subject.noteCount)];
    values.forEach((value, index) => {
      const ww = widths[index];
      drawFixedText(ctx, value, r - ww / 2, y + rowH / 2, {
        size: index < 2 ? 19 : 21,
        weight: index === 0 || index >= 2 ? 900 : 750,
        color: index === 2 ? (subject.accent || TEAL) : INK,
        align: "center",
        maxWidth: ww - 20,
      });
      r -= ww;
    });
  });
  return totalH;
}

function drawNotes(ctx: CanvasRenderingContext2D, notes: StudentProgressPdfNote[], startY: number) {
  drawFixedText(ctx, "أبرز ملاحظات المعلمين", W - 48, startY, { size: 25, weight: 900, color: NAVY, maxWidth: 600 });
  const shown = notes.slice(0, 4);
  let y = startY + 38;
  if (!shown.length) {
    roundedRect(ctx, 48, y, W - 96, 78, 16, "#f7fafb", LINE);
    drawFixedText(ctx, "لا توجد ملاحظات مسجلة حاليًا.", W - 70, y + 39, { size: 19, weight: 750, color: MUTED, maxWidth: W - 150 });
    return y + 78;
  }
  shown.forEach(note => {
    roundedRect(ctx, 48, y, W - 96, 96, 16, "#fffaf0", "#ecdcae");
    drawFixedText(ctx, note.subject, W - 70, y + 28, { size: 18, weight: 900, color: "#8a6420", maxWidth: 260 });
    drawFixedText(ctx, note.text, W - 70, y + 61, { size: 18, weight: 750, color: INK, maxWidth: W - 280 });
    drawFixedText(ctx, [note.teacher, note.date].filter(Boolean).join(" • "), 70, y + 70, { size: 14, weight: 750, color: MUTED, align: "left", maxWidth: 300 });
    y += 108;
  });
  return y;
}

function drawFooter(ctx: CanvasRenderingContext2D, options: StudentProgressPdfOptions) {
  printLine(ctx, 48, H - 136, W - 48, H - 136, "#cbdadc", 1.5);
  drawFixedText(ctx, "متابعة ولي الأمر: __________________________", W - 48, H - 98, { size: 17, weight: 800, color: MUTED, maxWidth: 470 });
  drawFixedText(ctx, options.portalName, W / 2, H - 98, { size: 16, weight: 900, color: TEAL, align: "center", maxWidth: 360 });
  drawFixedText(ctx, new Intl.DateTimeFormat("ar-SA", { dateStyle: "long" }).format(new Date()), 48, H - 98, { size: 15, weight: 750, color: MUTED, align: "left", maxWidth: 320 });
}

export async function downloadStudentProgressPdf(options: StudentProgressPdfOptions) {
  await ensurePrintFontsReady();
  const logo = await loadPortalPrintLogo();
  const groups: StudentProgressPdfSubject[][] = [];
  const pageSize = 8;
  if (!options.subjects.length) groups.push([]);
  for (let i = 0; i < options.subjects.length; i += pageSize) groups.push(options.subjects.slice(i, i + pageSize));
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });

  groups.forEach((subjects, index) => {
    const { canvas, ctx } = createPrintCanvas(W, H);
    drawHeader(ctx, logo, options, index + 1, groups.length);
    drawIdentity(ctx, options);
    drawSummary(ctx, options);
    const tableHeight = drawSubjectTable(ctx, subjects, 548);
    if (index === 0) drawNotes(ctx, options.notes, Math.min(1180, 548 + tableHeight + 38));
    drawFooter(ctx, options);
    if (index) pdf.addPage("a4", "portrait");
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 210, 297, undefined, "FAST");
  });

  pdf.save(options.fileName);
  return { pageCount: groups.length, subjectCount: options.subjects.length };
}
