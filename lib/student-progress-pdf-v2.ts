"use client";

import { jsPDF } from "jspdf";
import {
  createPrintCanvas,
  drawFixedText,
  drawImageContain,
  ensurePrintFontsReady,
  fitPrintSize,
  loadPortalPrintLogo,
  printLine,
  roundedRect,
  setPrintFont,
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
  ctx.fillRect(0, 0, W, 156);
  ctx.fillStyle = TEAL;
  ctx.fillRect(0, 0, W, 12);
  roundedRect(ctx, W - 142, 24, 94, 94, 18, "#ffffff");
  if (logo) drawImageContain(ctx, logo, W - 134, 32, 78, 78, 2);
  drawFixedText(ctx, title, W - 166, 62, { size: 30, weight: 900, color: "#fff", maxWidth: 770 });
  drawFixedText(ctx, subtitle, W - 166, 108, { size: 15.5, weight: 750, color: "#d5e9ed", maxWidth: 800 });
}

function footer(ctx: CanvasRenderingContext2D, portalName: string) {
  printLine(ctx, 48, H - 88, W - 48, H - 88, "#cbdadd", 1.3);
  drawFixedText(ctx, portalName, W - 48, H - 57, { size: 13.5, weight: 900, color: TEAL, maxWidth: 420 });
  drawFixedText(ctx, "صفحة واحدة", W / 2, H - 57, { size: 12.5, weight: 800, color: MUTED, align: "center", maxWidth: 220 });
  drawFixedText(ctx, new Intl.DateTimeFormat("ar-SA", { dateStyle: "long" }).format(new Date()), 48, H - 57, { size: 12.5, weight: 750, color: MUTED, align: "left", maxWidth: 300 });
}

function identity(ctx: CanvasRenderingContext2D, options: StudentProgressPdfV2Options) {
  roundedRect(ctx, 48, 178, W - 96, 92, 17, "#fff", LINE);
  const cols = [
    ["اسم الطالب", options.studentName],
    ["الصف / الفصل", options.className || "غير محدد"],
    ["كود الطالب", options.studentCode],
  ];
  const colW = (W - 128) / 3;
  cols.forEach(([label, value], index) => {
    const x = W - 64 - index * colW;
    drawFixedText(ctx, label, x, 205, { size: 12.5, weight: 800, color: MUTED, maxWidth: colW - 22 });
    drawFixedText(ctx, value, x, 242, { size: 19, weight: 900, color: INK, maxWidth: colW - 22 });
    if (index < 2) printLine(ctx, x - colW + 10, 193, x - colW + 10, 255, "#e1e9eb", 1.1);
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
  const gap = 14;
  const cardW = (W - 96 - gap * 2) / 3;
  cards.forEach((card, index) => {
    const x = W - 48 - cardW - index * (cardW + gap);
    roundedRect(ctx, x, 290, cardW, 76, 14, card.bg);
    drawFixedText(ctx, card.label, x + cardW - 18, 315, { size: 12.5, weight: 850, color: card.fg, maxWidth: cardW - 36 });
    drawFixedText(ctx, card.value, x + cardW - 18, 344, { size: 20, weight: 900, color: card.fg, maxWidth: cardW - 36 });
  });
}

function subjectTable(ctx: CanvasRenderingContext2D, subjects: StudentReportSubjectV2[]) {
  const x = 48;
  const y = 390;
  const w = W - 96;
  const headerH = 40;
  const maxBodyH = 500;
  const count = Math.max(subjects.length, 1);
  const rowH = Math.max(38, Math.min(58, maxBodyH / count));
  const widths = [245, 225, 200, 170, 130, 174];
  const labels = ["المادة", "المعلم", "التحصيل", "السقف المتاح", "الخصم", "الانضباط"];
  const totalH = headerH + count * rowH;
  roundedRect(ctx, x, y, w, totalH, 14, "#fff", LINE);
  ctx.fillStyle = NAVY;
  ctx.fillRect(x, y, w, headerH);
  let cursor = x + w;
  labels.forEach((label, index) => {
    const ww = widths[index];
    drawFixedText(ctx, label, cursor - ww / 2, y + headerH / 2, { size: 12.5, weight: 900, color: "#fff", align: "center", maxWidth: ww - 10 });
    cursor -= ww;
    if (index < labels.length - 1) printLine(ctx, cursor, y, cursor, y + totalH, "#d8e4e6", 1);
  });
  if (!subjects.length) {
    drawFixedText(ctx, "بانتظار رصد المواد", W / 2, y + headerH + rowH / 2, { size: 17, weight: 800, color: MUTED, align: "center" });
    return y + totalH;
  }
  subjects.forEach((subject, row) => {
    const yy = y + headerH + row * rowH;
    ctx.fillStyle = subject.deduction > 0 ? "#fff8e8" : row % 2 ? "#f7fafb" : "#fff";
    ctx.fillRect(x, yy, w, rowH);
    printLine(ctx, x, yy + rowH, x + w, yy + rowH, "#dfe8ea", 1);
    const available = Number(subject.availableMaximum || 100);
    const values = [
      subject.subject,
      subject.teacher,
      `${ar(subject.score)} / ${ar(available)}`,
      `${ar(available)} / ١٠٠`,
      subject.deduction > 0 ? `− ${ar(subject.deduction)}` : "٠",
      `${ar(subject.discipline)}٪`,
    ];
    let r = x + w;
    values.forEach((value, index) => {
      const ww = widths[index];
      drawFixedText(ctx, value, r - ww / 2, yy + rowH / 2, {
        size: index < 2 ? 12.5 : 14,
        weight: index === 0 || index >= 2 ? 900 : 750,
        color: index === 4 && subject.deduction > 0 ? GOLD : index === 2 ? TEAL : INK,
        align: "center",
        maxWidth: ww - 12,
      });
      r -= ww;
    });
  });
  return y + totalH;
}

function drawCompactNoteText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, preferred = 12.5) {
  const raw = String(text || "").replace(/\s+/g, " ").trim();
  const size = fitPrintSize(ctx, raw, maxWidth, preferred, 8.5, 760);
  setPrintFont(ctx, size, 760);
  ctx.fillStyle = INK;
  ctx.textAlign = "right";
  ctx.fillText(raw, x, y, maxWidth);
}

function desiredPanelHeight(noteCount: number, maxHeight: number) {
  if (noteCount <= 0) return Math.min(maxHeight, 142);
  const visibleRows = Math.min(noteCount, 6);
  return Math.min(maxHeight, 116 + visibleRows * 68 + Math.max(0, visibleRows - 1) * 7);
}

function drawNotesPanel(
  ctx: CanvasRenderingContext2D,
  notes: StudentReportNoteV2[],
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  emptyText: string,
  accent: string,
  soft: string,
  footerText: string,
) {
  roundedRect(ctx, x, y, w, h, 16, "#fff", LINE);
  roundedRect(ctx, x + 10, y + 10, w - 20, 42, 12, soft);
  drawFixedText(ctx, title, x + w - 24, y + 31, { size: 13.5, weight: 900, color: accent, maxWidth: w - 130 });
  drawFixedText(ctx, `${ar(notes.length)} سجل`, x + 24, y + 31, { size: 10, weight: 850, color: accent, align: "left", maxWidth: 90 });

  const listTop = y + 62;
  if (!notes.length) {
    roundedRect(ctx, x + 14, listTop, w - 28, 54, 11, "#fafcfc", LINE);
    drawFixedText(ctx, emptyText, x + w - 28, listTop + 27, { size: 11.5, weight: 800, color: MUTED, maxWidth: w - 56 });
    return;
  }

  const footerH = 30;
  const listBottom = y + h - footerH - 14;
  const listH = Math.max(58, listBottom - listTop);
  const maxRows = Math.max(1, Math.floor((listH + 7) / 68));
  const visible = notes.slice(0, maxRows);
  const hidden = Math.max(0, notes.length - visible.length);
  const gap = 7;
  const cardH = Math.max(56, Math.min(68, (listH - gap * Math.max(0, visible.length - 1)) / visible.length));

  visible.forEach((note, index) => {
    const yy = listTop + index * (cardH + gap);
    roundedRect(ctx, x + 14, yy, w - 28, cardH, 11, index % 2 ? "#fbfdfd" : "#fff", accent === GOLD ? "#ead6a7" : LINE);
    drawFixedText(ctx, note.subject, x + w - 28, yy + 19, { size: 11.3, weight: 900, color: INK, maxWidth: w - 150 });
    drawFixedText(ctx, note.kind === "deduction" ? "خصم" : "ملاحظة", x + 28, yy + 19, { size: 9.2, weight: 900, color: accent, align: "left", maxWidth: 70 });
    drawCompactNoteText(ctx, note.text, x + w - 28, yy + Math.min(cardH - 17, 42), w - 56, cardH < 62 ? 9.7 : 11.2);
    const meta = [note.teacher, note.date].filter(Boolean).join(" • ");
    if (meta && cardH >= 64) drawFixedText(ctx, meta, x + 28, yy + cardH - 12, { size: 8.5, weight: 700, color: MUTED, align: "left", maxWidth: w - 56 });
  });

  const bottomText = hidden > 0 ? `و ${ar(hidden)} سجلات إضافية محفوظة في البوابة.` : footerText;
  drawFixedText(ctx, bottomText, x + w - 18, y + h - 13, { size: 8.8, weight: 800, color: accent, maxWidth: w - 36 });
}

function notesBlock(ctx: CanvasRenderingContext2D, notes: StudentReportNoteV2[], startY: number) {
  const x = 48;
  const w = W - 96;
  const footerTop = H - 108;
  const safeStart = Math.max(startY + 14, 560);
  const sectionTitleH = 38;
  const panelGap = 14;
  const panelY = safeStart + sectionTitleH + 9;
  const panelW = (w - panelGap) / 2;
  const maxPanelH = Math.max(140, footerTop - panelY);

  roundedRect(ctx, x, safeStart, w, sectionTitleH, 12, "#eaf2f4", LINE);
  drawFixedText(ctx, "تفاصيل المتابعة", W - 68, safeStart + sectionTitleH / 2, { size: 14, weight: 900, color: NAVY, maxWidth: 360 });
  drawFixedText(ctx, "الخصومات وأسبابها وملاحظات المعلمين", 68, safeStart + sectionTitleH / 2, { size: 10.5, weight: 800, color: MUTED, align: "left", maxWidth: 360 });

  const deductionNotes = notes.filter(note => note.kind === "deduction");
  const teacherNotes = notes.filter(note => note.kind === "teacher");
  const deductionH = desiredPanelHeight(deductionNotes.length, maxPanelH);
  const teacherH = desiredPanelHeight(teacherNotes.length, maxPanelH);
  const rightX = x + w - panelW;
  const leftX = x;

  drawNotesPanel(
    ctx,
    deductionNotes,
    rightX,
    panelY,
    panelW,
    deductionH,
    "الخصومات وأسبابها",
    "لا توجد خصومات مسجلة حاليًا.",
    GOLD,
    "#fff7e8",
    "الخصومات محسوبة ضمن السقف المتاح في الجدول.",
  );

  drawNotesPanel(
    ctx,
    teacherNotes,
    leftX,
    panelY,
    panelW,
    teacherH,
    "ملاحظات المعلمين",
    "لا توجد ملاحظات إضافية من المعلمين حاليًا.",
    TEAL,
    "#eaf6f3",
    "يعرض البيان أحدث ملاحظات المعلمين المتاحة.",
  );
}

export async function downloadStudentProgressPdfV2(options: StudentProgressPdfV2Options) {
  await ensurePrintFontsReady();
  const logo = await loadPortalPrintLogo();
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });

  const page = createPrintCanvas(W, H);
  pageBase(page.ctx, logo, "بيان التقدم الأكاديمي", "التحصيل، السقف المتاح، الخصومات وأسبابها وملاحظات المعلمين في صفحة واحدة.");
  identity(page.ctx, options);
  summary(page.ctx, options);
  const tableEnd = subjectTable(page.ctx, options.subjects);
  notesBlock(page.ctx, options.notes, tableEnd);
  footer(page.ctx, options.portalName);
  pdf.addImage(page.canvas.toDataURL("image/png"), "PNG", 0, 0, 210, 297, undefined, "FAST");

  pdf.save(options.fileName);
  return { pageCount: 1, subjectCount: options.subjects.length, noteCount: options.notes.length };
}
