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

function drawHeader(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null, options: StudentProgressPdfOptions) {
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, W, 198);
  ctx.fillStyle = TEAL;
  ctx.fillRect(0, 0, W, 14);
  roundedRect(ctx, W - 170, 32, 122, 122, 22, "#ffffff");
  if (logo) drawImageContain(ctx, logo, W - 160, 42, 102, 102, 2);
  drawFixedText(ctx, options.portalName, W - 198, 56, { size: 23, weight: 850, color: "#bfe8e4", maxWidth: 520 });
  drawFixedText(ctx, "بيان التقدم الأكاديمي للطالب", W - 198, 102, { size: 38, weight: 900, color: "#ffffff", maxWidth: 720 });
  drawFixedText(ctx, "شهادة متابعة شاملة للتحصيل والانضباط وملاحظات المعلمين", W - 198, 150, { size: 20, weight: 750, color: "#d9e9ed", maxWidth: 760 });
  roundedRect(ctx, 48, 61, 150, 58, 18, "#fff7e5");
  drawFixedText(ctx, "المستوى العام", 123, 79, { size: 13, weight: 850, color: "#8a6420", align: "center" });
  drawFixedText(ctx, options.statusLabel, 123, 105, { size: 20, weight: 900, color: "#8a6420", align: "center", maxWidth: 126 });
}

function drawIdentity(ctx: CanvasRenderingContext2D, options: StudentProgressPdfOptions) {
  roundedRect(ctx, 48, 224, W - 96, 132, 22, "#ffffff", LINE);
  const cols = [
    ["اسم الطالب", options.studentName],
    ["الصف / الفصل", options.className],
    ["كود الطالب", options.studentCode],
  ];
  const colW = (W - 128) / 3;
  cols.forEach(([label, value], index) => {
    const x = W - 64 - index * colW;
    drawFixedText(ctx, label, x, 263, { size: 16, weight: 800, color: MUTED, maxWidth: colW - 24 });
    drawFixedText(ctx, value, x, 311, { size: 26, weight: 900, color: INK, maxWidth: colW - 24 });
    if (index < 2) printLine(ctx, x - colW + 12, 246, x - colW + 12, 338, "#e4ecee", 1.3);
  });
}

function drawSummary(ctx: CanvasRenderingContext2D, options: StudentProgressPdfOptions) {
  const cards = [
    { label: "متوسط التحصيل", value: `${Math.round(options.overallAverage)}٪`, bg: "#e8f6f3", fg: "#0a716b" },
    { label: "متوسط الانضباط", value: `${Math.round(options.overallDiscipline)}٪`, bg: "#edf3fb", fg: "#2d5f9f" },
    { label: "عدد المواد", value: String(options.subjects.length), bg: "#fbf4e5", fg: "#8a6420" },
  ];
  const gap = 16;
  const cardW = (W - 96 - gap * 2) / 3;
  cards.forEach((card, index) => {
    const x = W - 48 - cardW - index * (cardW + gap);
    roundedRect(ctx, x, 382, cardW, 106, 18, card.bg);
    drawFixedText(ctx, card.label, x + cardW - 22, 414, { size: 16, weight: 850, color: card.fg, maxWidth: cardW - 44 });
    drawFixedText(ctx, card.value, x + cardW - 22, 454, { size: 30, weight: 900, color: card.fg, maxWidth: cardW - 44 });
  });
}

function drawSubjectTable(ctx: CanvasRenderingContext2D, subjects: StudentProgressPdfSubject[], startY: number, maxHeight: number) {
  const x = 48;
  const w = W - 96;
  const headerH = 54;
  const count = Math.max(subjects.length, 1);
  const rowH = Math.max(42, Math.min(64, (maxHeight - headerH) / count));
  const widths = [280, 300, 180, 180, 140];
  const labels = ["المادة", "المعلم", "التحصيل", "الانضباط", "الملاحظات"];
  const totalH = headerH + count * rowH;
  roundedRect(ctx, x, startY, w, totalH, 18, "#ffffff", LINE);
  ctx.fillStyle = NAVY;
  ctx.fillRect(x, startY, w, headerH);
  let cursor = x + w;
  labels.forEach((label, index) => {
    const ww = widths[index];
    drawFixedText(ctx, label, cursor - ww / 2, startY + headerH / 2, { size: 17, weight: 900, color: "#ffffff", align: "center", maxWidth: ww - 12 });
    cursor -= ww;
    if (index < labels.length - 1) printLine(ctx, cursor, startY, cursor, startY + totalH, "#dbe6e8", 1.2);
  });
  if (!subjects.length) {
    drawFixedText(ctx, "بانتظار رصد المواد", W / 2, startY + headerH + rowH / 2, { size: 20, weight: 800, color: MUTED, align: "center" });
    return totalH;
  }
  const dense = subjects.length >= 12;
  subjects.forEach((subject, row) => {
    const y = startY + headerH + row * rowH;
    ctx.fillStyle = row % 2 ? "#f8fbfb" : "#ffffff";
    ctx.fillRect(x, y, w, rowH);
    ctx.fillStyle = subject.accent || TEAL;
    ctx.fillRect(W - 53, y + 9, 5, Math.max(18, rowH - 18));
    printLine(ctx, x, y + rowH, x + w, y + rowH, "#e4ecee", 1.1);
    let r = x + w;
    const values = [subject.subject, subject.teacher, `${Math.round(clamp(subject.percentage))}٪`, `${Math.round(clamp(subject.discipline))}٪`, String(subject.noteCount)];
    values.forEach((value, index) => {
      const ww = widths[index];
      drawFixedText(ctx, value, r - ww / 2, y + rowH / 2, {
        size: dense ? (index < 2 ? 16 : 18) : (index < 2 ? 18 : 20),
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

function drawNotes(ctx: CanvasRenderingContext2D, notes: StudentProgressPdfNote[], startY: number, maxNotes: number) {
  drawFixedText(ctx, "أبرز ملاحظات المعلمين", W - 48, startY, { size: 23, weight: 900, color: NAVY, maxWidth: 600 });
  const shown = notes.slice(0, maxNotes);
  let y = startY + 34;
  if (!shown.length) {
    roundedRect(ctx, 48, y, W - 96, 70, 15, "#f7fafb", LINE);
    drawFixedText(ctx, "لا توجد ملاحظات مسجلة حاليًا.", W - 70, y + 35, { size: 18, weight: 750, color: MUTED, maxWidth: W - 150 });
    return;
  }
  shown.forEach(note => {
    roundedRect(ctx, 48, y, W - 96, 82, 15, "#fffaf0", "#ecdcae");
    drawFixedText(ctx, note.subject, W - 70, y + 24, { size: 17, weight: 900, color: "#8a6420", maxWidth: 250 });
    drawFixedText(ctx, note.text, W - 70, y + 52, { size: 16.5, weight: 750, color: INK, maxWidth: W - 290 });
    drawFixedText(ctx, [note.teacher, note.date].filter(Boolean).join(" • "), 70, y + 57, { size: 13, weight: 750, color: MUTED, align: "left", maxWidth: 300 });
    y += 91;
  });
}

function drawFooter(ctx: CanvasRenderingContext2D, options: StudentProgressPdfOptions) {
  printLine(ctx, 48, H - 124, W - 48, H - 124, "#cbdadc", 1.5);
  drawFixedText(ctx, "متابعة ولي الأمر: __________________________", W - 48, H - 88, { size: 16, weight: 800, color: MUTED, maxWidth: 470 });
  drawFixedText(ctx, options.portalName, W / 2, H - 88, { size: 15.5, weight: 900, color: TEAL, align: "center", maxWidth: 360 });
  drawFixedText(ctx, new Intl.DateTimeFormat("ar-SA", { dateStyle: "long" }).format(new Date()), 48, H - 88, { size: 14.5, weight: 750, color: MUTED, align: "left", maxWidth: 320 });
}

export async function downloadStudentProgressPdf(options: StudentProgressPdfOptions) {
  await ensurePrintFontsReady();
  const logo = await loadPortalPrintLogo();
  const { canvas, ctx } = createPrintCanvas(W, H);
  drawHeader(ctx, logo, options);
  drawIdentity(ctx, options);
  drawSummary(ctx, options);
  const maxNotes = options.subjects.length > 12 ? 2 : 3;
  const noteReserve = maxNotes * 91 + 58;
  const tableMax = Math.max(430, H - 620 - noteReserve - 140);
  const tableHeight = drawSubjectTable(ctx, options.subjects, 520, tableMax);
  const notesY = Math.min(H - noteReserve - 140, 520 + tableHeight + 28);
  drawNotes(ctx, options.notes, notesY, maxNotes);
  drawFooter(ctx, options);

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 210, 297, undefined, "FAST");
  pdf.save(options.fileName);
  return { pageCount: 1, subjectCount: options.subjects.length };
}
