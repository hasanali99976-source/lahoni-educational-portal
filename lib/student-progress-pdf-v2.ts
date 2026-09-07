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

export type StudentReportSubjectV2 = {
  subject: string;
  teacher: string;
  score: number;
  availableMaximum: number;
  deduction: number;
  discipline: number;
  reason?: string;
};

export type StudentReportNoteV2 = {
  kind: "teacher" | "deduction";
  subject: string;
  text: string;
  teacher?: string;
  date?: string;
};

export type StudentProgressPdfV2Options = {
  portalName: string;
  studentName: string;
  className: string;
  studentCode: string;
  subjects: StudentReportSubjectV2[];
  notes: StudentReportNoteV2[];
  fileName: string;
};

const W = 1240;
const H = 1754;
const NAVY = "#083d54";
const TEAL = "#0b8f88";
const GOLD = "#b77a1d";
const INK = "#173d4b";
const MUTED = "#6e838c";
const LINE = "#d5e1e4";

const clamp = (value: number) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
const ar = (value: number) => new Intl.NumberFormat("ar-SA-u-nu-arab", { maximumFractionDigits: 2 }).format(Number.isFinite(value) ? value : 0);

function pageBase(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null, title: string, subtitle: string) {
  ctx.fillStyle = "#f4f8f9";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, W, 184);
  ctx.fillStyle = TEAL;
  ctx.fillRect(0, 0, W, 14);
  roundedRect(ctx, W - 164, 28, 116, 116, 20, "#ffffff");
  if (logo) drawImageContain(ctx, logo, W - 154, 38, 96, 96, 2);
  drawFixedText(ctx, title, W - 190, 76, { size: 35, weight: 900, color: "#fff", maxWidth: 760 });
  drawFixedText(ctx, subtitle, W - 190, 127, { size: 18, weight: 750, color: "#d5e9ed", maxWidth: 780 });
}

function footer(ctx: CanvasRenderingContext2D, portalName: string, pageLabel: string) {
  printLine(ctx, 48, H - 104, W - 48, H - 104, "#cbdadd", 1.4);
  drawFixedText(ctx, portalName, W - 48, H - 70, { size: 14.5, weight: 900, color: TEAL, maxWidth: 420 });
  drawFixedText(ctx, pageLabel, W / 2, H - 70, { size: 13.5, weight: 800, color: MUTED, align: "center", maxWidth: 240 });
  drawFixedText(ctx, new Intl.DateTimeFormat("ar-SA", { dateStyle: "long" }).format(new Date()), 48, H - 70, { size: 13.5, weight: 750, color: MUTED, align: "left", maxWidth: 300 });
}

function identity(ctx: CanvasRenderingContext2D, options: StudentProgressPdfV2Options) {
  roundedRect(ctx, 48, 214, W - 96, 126, 20, "#fff", LINE);
  const cols = [
    ["اسم الطالب", options.studentName],
    ["الصف / الفصل", options.className || "غير محدد"],
    ["كود الطالب", options.studentCode],
  ];
  const colW = (W - 128) / 3;
  cols.forEach(([label, value], index) => {
    const x = W - 64 - index * colW;
    drawFixedText(ctx, label, x, 252, { size: 14.5, weight: 800, color: MUTED, maxWidth: colW - 22 });
    drawFixedText(ctx, value, x, 300, { size: 24, weight: 900, color: INK, maxWidth: colW - 22 });
    if (index < 2) printLine(ctx, x - colW + 10, 234, x - colW + 10, 322, "#e1e9eb", 1.2);
  });
}

function summary(ctx: CanvasRenderingContext2D, options: StudentProgressPdfV2Options) {
  const subjects = options.subjects;
  const academicAverage = subjects.length ? subjects.reduce((sum, item) => sum + clamp(item.score), 0) / subjects.length : 0;
  const disciplineAverage = subjects.length ? subjects.reduce((sum, item) => sum + clamp(item.discipline), 0) / subjects.length : 100;
  const totalDeduction = subjects.reduce((sum, item) => sum + Math.max(0, item.deduction || 0), 0);
  const cards = [
    { label: "متوسط التحصيل بعد الخصم", value: `${ar(academicAverage)} / ١٠٠`, bg: "#eaf6f3", fg: "#0b756e" },
    { label: "إجمالي الخصومات", value: totalDeduction > 0 ? `− ${ar(totalDeduction)}` : "٠", bg: "#fff7e8", fg: GOLD },
    { label: "متوسط الانضباط", value: `${ar(disciplineAverage)}٪`, bg: "#edf3fb", fg: "#315e95" },
  ];
  const gap = 16;
  const cardW = (W - 96 - gap * 2) / 3;
  cards.forEach((card, index) => {
    const x = W - 48 - cardW - index * (cardW + gap);
    roundedRect(ctx, x, 370, cardW, 106, 17, card.bg);
    drawFixedText(ctx, card.label, x + cardW - 20, 404, { size: 14.5, weight: 850, color: card.fg, maxWidth: cardW - 40 });
    drawFixedText(ctx, card.value, x + cardW - 20, 447, { size: 25, weight: 900, color: card.fg, maxWidth: cardW - 40 });
  });
}

function subjectTable(ctx: CanvasRenderingContext2D, subjects: StudentReportSubjectV2[]) {
  const x = 48;
  const y = 508;
  const w = W - 96;
  const headerH = 52;
  const rowH = Math.max(48, Math.min(62, (H - y - 190 - headerH) / Math.max(subjects.length, 1)));
  const widths = [240, 230, 190, 160, 140, 184];
  const labels = ["المادة", "المعلم", "التحصيل", "السقف المتاح", "الخصم", "الانضباط"];
  const totalH = headerH + Math.max(subjects.length, 1) * rowH;
  roundedRect(ctx, x, y, w, totalH, 17, "#fff", LINE);
  ctx.fillStyle = NAVY;
  ctx.fillRect(x, y, w, headerH);
  let cursor = x + w;
  labels.forEach((label, index) => {
    const ww = widths[index];
    drawFixedText(ctx, label, cursor - ww / 2, y + headerH / 2, { size: 15, weight: 900, color: "#fff", align: "center", maxWidth: ww - 12 });
    cursor -= ww;
    if (index < labels.length - 1) printLine(ctx, cursor, y, cursor, y + totalH, "#d8e4e6", 1.1);
  });
  if (!subjects.length) {
    drawFixedText(ctx, "بانتظار رصد المواد", W / 2, y + headerH + rowH / 2, { size: 20, weight: 800, color: MUTED, align: "center" });
    return;
  }
  subjects.forEach((subject, row) => {
    const yy = y + headerH + row * rowH;
    ctx.fillStyle = row % 2 ? "#f7fafb" : "#fff";
    ctx.fillRect(x, yy, w, rowH);
    if (subject.deduction > 0) {
      ctx.fillStyle = "#fff8e8";
      ctx.fillRect(x, yy, w, rowH);
    }
    printLine(ctx, x, yy + rowH, x + w, yy + rowH, "#dfe8ea", 1.05);
    const values = [
      subject.subject,
      subject.teacher,
      `${ar(subject.score)} / ١٠٠`,
      `${ar(subject.availableMaximum)} / ١٠٠`,
      subject.deduction > 0 ? `− ${ar(subject.deduction)}` : "٠",
      `${ar(subject.discipline)}٪`,
    ];
    let r = x + w;
    values.forEach((value, index) => {
      const ww = widths[index];
      drawFixedText(ctx, value, r - ww / 2, yy + rowH / 2, {
        size: index < 2 ? 15.5 : 17,
        weight: index === 0 || index >= 2 ? 900 : 750,
        color: index === 4 && subject.deduction > 0 ? GOLD : index === 2 ? TEAL : INK,
        align: "center",
        maxWidth: ww - 16,
      });
      r -= ww;
    });
  });
}

function notesPage(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null, options: StudentProgressPdfV2Options, notes: StudentReportNoteV2[], pageIndex: number, pageCount: number) {
  pageBase(ctx, logo, "الملاحظات والخصومات", "كل ما سجله المعلمون وما تم خصمه من التحصيل، مع السبب.");
  let y = 226;
  notes.forEach(note => {
    const deduction = note.kind === "deduction";
    const bg = deduction ? "#fff7e7" : "#ffffff";
    const border = deduction ? "#e8d2a0" : LINE;
    const accent = deduction ? GOLD : TEAL;
    roundedRect(ctx, 48, y, W - 96, 126, 16, bg, border);
    roundedRect(ctx, W - 222, y + 18, 150, 34, 10, deduction ? "#f7e8bf" : "#e6f4f1");
    drawFixedText(ctx, deduction ? "خصم من التحصيل" : "ملاحظة المعلم", W - 147, y + 35, { size: 12.5, weight: 900, color: accent, align: "center", maxWidth: 132 });
    drawFixedText(ctx, note.subject, W - 244, y + 34, { size: 18, weight: 900, color: INK, maxWidth: 360 });
    drawFixedText(ctx, note.text, W - 72, y + 77, { size: 16.5, weight: 780, color: INK, maxWidth: W - 190 });
    drawFixedText(ctx, [note.teacher, note.date].filter(Boolean).join(" • "), W - 72, y + 105, { size: 12.5, weight: 740, color: MUTED, maxWidth: W - 190 });
    y += 140;
  });
  footer(ctx, options.portalName, `صفحة ${pageIndex} من ${pageCount}`);
}

export async function downloadStudentProgressPdfV2(options: StudentProgressPdfV2Options) {
  await ensurePrintFontsReady();
  const logo = await loadPortalPrintLogo();
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });

  const first = createPrintCanvas(W, H);
  pageBase(first.ctx, logo, "بيان التقدم الأكاديمي", "التحصيل بعد الخصم، السقف المتاح، الانضباط وملاحظات المعلمين.");
  identity(first.ctx, options);
  summary(first.ctx, options);
  subjectTable(first.ctx, options.subjects);
  footer(first.ctx, options.portalName, "صفحة ١");
  pdf.addImage(first.canvas.toDataURL("image/png"), "PNG", 0, 0, 210, 297, undefined, "FAST");

  const chunks: StudentReportNoteV2[][] = [];
  const sortedNotes = [...options.notes].sort((a, b) => Number(b.kind === "deduction") - Number(a.kind === "deduction"));
  for (let i = 0; i < sortedNotes.length; i += 10) chunks.push(sortedNotes.slice(i, i + 10));
  const pageCount = 1 + chunks.length;
  chunks.forEach((chunk, index) => {
    pdf.addPage("a4", "portrait");
    const page = createPrintCanvas(W, H);
    notesPage(page.ctx, logo, options, chunk, index + 2, pageCount);
    pdf.addImage(page.canvas.toDataURL("image/png"), "PNG", 0, 0, 210, 297, undefined, "FAST");
  });

  pdf.save(options.fileName);
  return { pageCount, subjectCount: options.subjects.length, noteCount: options.notes.length };
}
