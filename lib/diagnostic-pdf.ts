"use client";

import { jsPDF } from "jspdf";

export type DiagnosticPdfQuestion = {
  id?: string;
  text: string;
  options: string[];
  correctIndex: number;
  skill?: string;
};

export type DiagnosticPdfOptions = {
  portalName: string;
  teacherName: string;
  subject: string;
  gradeLabel?: string;
  title: string;
  instructions?: string;
  questions: DiagnosticPdfQuestion[];
  teacherCopy?: boolean;
  fileName: string;
};

const WIDTH = 1240;
const HEIGHT = 1754;
const MARGIN = 62;
const BOTTOM = HEIGHT - 86;
const FONT = "Tajawal, Arial, Tahoma, sans-serif";
const LETTERS = ["أ", "ب", "ج", "د", "هـ", "و", "ز", "ح"];

function createCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("diagnostic_pdf_canvas_unavailable");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.direction = "rtl";
  ctx.textBaseline = "middle";
  return { canvas, ctx };
}

function setFont(ctx: CanvasRenderingContext2D, size: number, weight = 700) {
  ctx.font = `${weight} ${size}px ${FONT}`;
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
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color = "#d3dfe5", width = 1.5) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function wrap(ctx: CanvasRenderingContext2D, value: unknown, maxWidth: number, size: number, weight = 700) {
  const raw = String(value ?? "").trim();
  if (!raw) return [""];
  setFont(ctx, size, weight);
  const words = raw.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  words.forEach(word => {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !current) current = candidate;
    else { lines.push(current); current = word; }
  });
  if (current) lines.push(current);
  return lines;
}

function drawWrapped(ctx: CanvasRenderingContext2D, value: unknown, right: number, top: number, maxWidth: number, size: number, lineHeight: number, color = "#173b49", weight = 700) {
  const lines = wrap(ctx, value, maxWidth, size, weight);
  setFont(ctx, size, weight);
  ctx.fillStyle = color;
  ctx.textAlign = "right";
  lines.forEach((entry, index) => ctx.fillText(entry, right, top + index * lineHeight + lineHeight / 2));
  return lines.length * lineHeight;
}

function drawHeader(ctx: CanvasRenderingContext2D, options: DiagnosticPdfOptions, pageNumber: number) {
  rounded(ctx, MARGIN, 38, WIDTH - MARGIN * 2, 102, 22, "#173f61");
  setFont(ctx, 25, 900);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "right";
  ctx.fillText(options.portalName, WIDTH - MARGIN - 28, 72);
  setFont(ctx, 17, 800);
  ctx.fillStyle = "#d8e8f2";
  ctx.fillText("الاختبارات التشخيصية", WIDTH - MARGIN - 28, 112);
  rounded(ctx, MARGIN + 24, 59, 245, 54, 27, options.teacherCopy ? "#dff5eb" : "#f5c34f");
  setFont(ctx, 16, 900);
  ctx.fillStyle = "#173f61";
  ctx.textAlign = "center";
  ctx.fillText(options.teacherCopy ? "نسخة المعلم بالإجابات" : "نسخة الطالب", MARGIN + 146, 86);
  setFont(ctx, 14, 800);
  ctx.fillStyle = "#657d89";
  ctx.textAlign = "left";
  ctx.fillText(`صفحة ${pageNumber}`, MARGIN, 161);
  return 180;
}

function drawFirstPageIntro(ctx: CanvasRenderingContext2D, options: DiagnosticPdfOptions, startY: number) {
  let y = startY;
  const boxW = WIDTH - MARGIN * 2;
  rounded(ctx, MARGIN, y, boxW, 118, 18, "#f6f9fb", "#c6d6de");
  y += 18;
  const titleH = drawWrapped(ctx, options.title, WIDTH - MARGIN - 24, y, boxW - 48, 30, 39, "#15394d", 900);
  y += Math.max(45, titleH) + 8;
  drawWrapped(ctx, options.instructions || "اختر الإجابة الصحيحة لكل سؤال، ثم راجع إجاباتك قبل التسليم.", WIDTH - MARGIN - 24, y, boxW - 48, 15, 23, "#617782", 700);
  y = startY + 138;

  const gap = 12;
  const cellW = (boxW - gap * 2) / 3;
  const cells = [
    ["اسم الطالب", "________________________________"],
    ["الفصل", "____________"],
    ["التاريخ", "____ / ____ / ______"],
  ];
  cells.forEach(([label, value], index) => {
    const x = WIDTH - MARGIN - cellW - index * (cellW + gap);
    rounded(ctx, x, y, cellW, 64, 12, "#ffffff", "#c7d5dc");
    setFont(ctx, 12, 800); ctx.fillStyle = "#738791"; ctx.textAlign = "right"; ctx.fillText(label, x + cellW - 14, y + 19);
    setFont(ctx, 15, 800); ctx.fillStyle = "#213f4e"; ctx.fillText(value, x + cellW - 14, y + 44);
  });
  y += 78;

  const meta = [
    ["المادة", options.subject],
    ["الصف", options.gradeLabel || "—"],
    ["المعلم", options.teacherName],
    ["عدد الأسئلة", String(options.questions.length)],
  ];
  const metaW = (boxW - gap * 3) / 4;
  meta.forEach(([label, value], index) => {
    const x = WIDTH - MARGIN - metaW - index * (metaW + gap);
    rounded(ctx, x, y, metaW, 58, 11, "#eef5f8", "#d3e0e5");
    setFont(ctx, 11, 800); ctx.fillStyle = "#71858f"; ctx.textAlign = "right"; ctx.fillText(label, x + metaW - 12, y + 18);
    setFont(ctx, 14, 900); ctx.fillStyle = "#173f61"; ctx.fillText(value, x + metaW - 12, y + 41);
  });
  return y + 78;
}

function questionHeight(ctx: CanvasRenderingContext2D, question: DiagnosticPdfQuestion) {
  const innerW = WIDTH - MARGIN * 2 - 40;
  const qLines = wrap(ctx, question.text, innerW, 20, 900).length;
  let height = 70 + qLines * 31 + 14;
  question.options.forEach(option => {
    const lines = wrap(ctx, option, innerW - 86, 16, 700).length;
    height += Math.max(48, lines * 24 + 18) + 8;
  });
  return height + 18;
}

function drawQuestion(ctx: CanvasRenderingContext2D, question: DiagnosticPdfQuestion, index: number, y: number, teacherCopy: boolean) {
  const x = MARGIN;
  const w = WIDTH - MARGIN * 2;
  const h = questionHeight(ctx, question);
  rounded(ctx, x, y, w, h, 16, "#ffffff", "#a9bcc6");
  rounded(ctx, x + 14, y + 14, 150, 38, 19, "#e8f0f5");
  setFont(ctx, 15, 900); ctx.fillStyle = "#173f61"; ctx.textAlign = "center"; ctx.fillText(`السؤال ${index + 1}`, x + 89, y + 33);
  setFont(ctx, 12, 800); ctx.fillStyle = "#6a808b"; ctx.textAlign = "right"; ctx.fillText(`المهارة: ${question.skill || "غير محددة"}`, x + w - 20, y + 33);
  line(ctx, x + 16, y + 62, x + w - 16, y + 62);
  let cursor = y + 76;
  cursor += drawWrapped(ctx, question.text, x + w - 20, cursor, w - 40, 20, 31, "#122f40", 900) + 10;

  question.options.forEach((option, optionIndex) => {
    const optionLines = wrap(ctx, option, w - 126, 16, 700);
    const optionH = Math.max(48, optionLines.length * 24 + 18);
    const correct = teacherCopy && question.correctIndex === optionIndex;
    rounded(ctx, x + 20, cursor, w - 40, optionH, 11, correct ? "#e8f7f1" : "#f9fbfc", correct ? "#58a58d" : "#cfdae0");
    rounded(ctx, x + w - 64, cursor + (optionH - 34) / 2, 34, 34, 17, correct ? "#168066" : "#ffffff", correct ? "#168066" : "#9db1bb");
    setFont(ctx, 13, 900); ctx.fillStyle = correct ? "#ffffff" : "#173f61"; ctx.textAlign = "center"; ctx.fillText(LETTERS[optionIndex] || String(optionIndex + 1), x + w - 47, cursor + optionH / 2);
    setFont(ctx, 16, 700); ctx.fillStyle = "#294754"; ctx.textAlign = "right";
    optionLines.forEach((entry, lineIndex) => ctx.fillText(entry, x + w - 82, cursor + 18 + lineIndex * 24));
    if (correct) {
      setFont(ctx, 11, 900); ctx.fillStyle = "#08715c"; ctx.textAlign = "left"; ctx.fillText("الإجابة الصحيحة", x + 38, cursor + optionH / 2);
    }
    cursor += optionH + 8;
  });
  return y + h + 14;
}

function drawFooter(ctx: CanvasRenderingContext2D, options: DiagnosticPdfOptions, page: number, pages: number) {
  line(ctx, MARGIN, HEIGHT - 67, WIDTH - MARGIN, HEIGHT - 67, "#b8c9d1", 1.5);
  setFont(ctx, 11, 800);
  ctx.fillStyle = "#607985";
  ctx.textAlign = "right";
  ctx.fillText(options.portalName, WIDTH - MARGIN, HEIGHT - 42);
  ctx.textAlign = "center";
  ctx.fillText(`${options.subject} • ${options.title}`, WIDTH / 2, HEIGHT - 42);
  ctx.textAlign = "left";
  ctx.fillText(`صفحة ${page} من ${pages}`, MARGIN, HEIGHT - 42);
}

export async function downloadDiagnosticPdfDocument(options: DiagnosticPdfOptions) {
  if (!options.questions.length) throw new Error("diagnostic_pdf_no_questions");
  if (document.fonts?.ready) await document.fonts.ready;

  const pageQuestionGroups: number[][] = [];
  const probe = createCanvas();
  let current: number[] = [];
  let y = 360;
  options.questions.forEach((question, index) => {
    const h = questionHeight(probe.ctx, question) + 14;
    if (current.length && y + h > BOTTOM) {
      pageQuestionGroups.push(current);
      current = [];
      y = 194;
    }
    current.push(index);
    y += h;
  });
  if (current.length) pageQuestionGroups.push(current);

  const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: [WIDTH, HEIGHT], compress: true });
  pageQuestionGroups.forEach((indexes, pageIndex) => {
    if (pageIndex > 0) pdf.addPage([WIDTH, HEIGHT], "portrait");
    const { canvas, ctx } = createCanvas();
    let cursor = drawHeader(ctx, options, pageIndex + 1);
    if (pageIndex === 0) cursor = drawFirstPageIntro(ctx, options, cursor);
    else cursor += 14;
    indexes.forEach(questionIndex => { cursor = drawQuestion(ctx, options.questions[questionIndex], questionIndex, cursor, Boolean(options.teacherCopy)); });
    drawFooter(ctx, options, pageIndex + 1, pageQuestionGroups.length);
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.93), "JPEG", 0, 0, WIDTH, HEIGHT, undefined, "FAST");
  });
  pdf.save(options.fileName);
  return { pageCount: pageQuestionGroups.length, questionCount: options.questions.length };
}
