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

export type AcademicCertificateItem = {
  section: string;
  label: string;
  recorded: boolean;
  value?: number | null;
  maximum: number;
};

export type AcademicSubjectCertificate = {
  portalName: string;
  studentName: string;
  className: string;
  studentCode: string;
  subjectKey: string;
  subject: string;
  teacher: string;
  earned: number;
  maximum: number;
  completion: number;
  latestUpdate?: string;
  items: AcademicCertificateItem[];
  fileName: string;
};

export type AcademicSummarySubject = {
  subject: string;
  teacher: string;
  earned: number;
  maximum: number;
  completion: number;
  latestUpdate?: string;
};

export type AcademicSummaryCertificate = {
  portalName: string;
  studentName: string;
  className: string;
  studentCode: string;
  subjects: AcademicSummarySubject[];
  fileName: string;
};

const W = 1240;
const H = 1754;
const NAVY = "#073b45";
const TEAL = "#0b8f88";
const GOLD = "#c99a36";
const INK = "#173d4b";
const MUTED = "#6f838b";
const LINE = "#dbe6e8";

function ar(value: number) {
  return new Intl.NumberFormat("ar-SA-u-nu-arab", { maximumFractionDigits: 2 }).format(Number.isFinite(value) ? value : 0);
}

function certificateNumber(studentCode: string, scope: string, latest = "") {
  const source = `${studentCode}|${scope}|${latest || "current"}`;
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
  return `LH-${String(hash).padStart(10, "0").slice(-10)}`;
}

async function savePdfMobileFriendly(pdf: jsPDF, fileName: string) {
  const blob = pdf.output("blob");
  const native = typeof window !== "undefined" ? window.OstadhApp : undefined;
  if (native?.saveBase64) {
    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(String(reader.result || "").split(",", 2)[1] || "");
      reader.onerror = () => reject(reader.error || new Error("pdf_read_failed"));
      reader.readAsDataURL(blob);
    });
    native.saveBase64(fileName, "application/pdf", base64);
    return;
  }

  const url = URL.createObjectURL(blob);
  const isiOS = /iPad|iPhone|iPod/i.test(navigator.userAgent);
  if (isiOS) {
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) window.location.assign(url);
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 8_000);
}

function drawBrandHeader(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null, title: string) {
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, W, 190);
  ctx.fillStyle = TEAL;
  ctx.fillRect(0, 0, W, 14);
  roundedRect(ctx, W - 154, 32, 106, 106, 22, "#ffffff");
  if (logo) drawImageContain(ctx, logo, W - 146, 40, 90, 90, 2);
  drawFixedText(ctx, "بوابة أستاذ لحوني التعليمية", W - 188, 58, { size: 21, weight: 850, color: "#bde7e3", maxWidth: 650 });
  drawFixedText(ctx, title, W - 188, 112, { size: 38, weight: 900, color: "#ffffff", maxWidth: 800 });
  drawFixedText(ctx, "بيان مختصر وواضح من آخر درجات محفوظة", W - 188, 154, { size: 16, weight: 750, color: "#d8e9ec", maxWidth: 760 });
}

function drawIdentitySeal(ctx: CanvasRenderingContext2D, x: number, y: number, logo: HTMLImageElement | null) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.04);
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = TEAL;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, 72, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, 61, 0, Math.PI * 2);
  ctx.stroke();
  if (logo) drawImageContain(ctx, logo, -39, -42, 78, 78, 2);
  drawFixedText(ctx, "ختم هوية البوابة", 0, 43, { size: 10.5, weight: 900, color: NAVY, align: "center", maxWidth: 112 });
  ctx.restore();
}

function compactRows(items: AcademicCertificateItem[]) {
  const rows = new Map<string, AcademicCertificateItem[]>();
  items.forEach(item => {
    const section = String(item.section || "الوحدة").trim() || "الوحدة";
    const current = rows.get(section) || [];
    current.push(item);
    rows.set(section, current);
  });
  return [...rows.entries()].map(([section, entries]) => ({ section, entries }));
}

function compactLabels(items: AcademicCertificateItem[]) {
  const labels: string[] = [];
  items.forEach(item => {
    const label = String(item.label || "الدرجة").trim() || "الدرجة";
    if (!labels.includes(label)) labels.push(label);
  });
  if (labels.length <= 5) return labels;
  return [...labels.slice(0, 4), "أخرى"];
}

function cellFor(entries: AcademicCertificateItem[], label: string, overflowLabels: string[]) {
  const selected = label === "أخرى" ? entries.filter(item => overflowLabels.includes(item.label)) : entries.filter(item => item.label === label);
  if (!selected.length) return "—";
  const maximum = selected.reduce((sum, item) => sum + Number(item.maximum || 0), 0);
  const recorded = selected.filter(item => item.recorded);
  if (!recorded.length) return `— / ${ar(maximum)}`;
  const earned = recorded.reduce((sum, item) => sum + Number(item.value ?? 0), 0);
  return `${ar(earned)} / ${ar(maximum)}`;
}

export async function downloadStudentAcademicSubjectPdf(options: AcademicSubjectCertificate) {
  await ensurePrintFontsReady();
  const logo = await loadPortalPrintLogo();
  const { canvas, ctx } = createPrintCanvas(W, H);
  drawBrandHeader(ctx, logo, "شهادة التحصيل الأكاديمي");
  const certNo = certificateNumber(options.studentCode, options.subjectKey, options.latestUpdate);

  roundedRect(ctx, 48, 222, W - 96, 174, 24, "#ffffff", LINE);
  const identity = [
    ["الطالب", options.studentName],
    ["المادة", options.subject],
    ["المعلم", options.teacher],
  ];
  const identityWidth = (W - 140) / identity.length;
  identity.forEach(([label, value], index) => {
    const x = W - 70 - index * identityWidth;
    drawFixedText(ctx, label, x, 262, { size: 13.5, weight: 900, color: TEAL, maxWidth: identityWidth - 24 });
    drawFixedText(ctx, value, x, 310, { size: 22, weight: 900, color: INK, maxWidth: identityWidth - 24 });
    if (index < identity.length - 1) printLine(ctx, x - identityWidth + 10, 246, x - identityWidth + 10, 342, "#e6edef", 1.2);
  });
  drawFixedText(ctx, `${options.className} • ${options.studentCode}`, W - 70, 370, { size: 13.5, weight: 750, color: MUTED, maxWidth: 700 });

  const rows = compactRows(options.items);
  const labels = compactLabels(options.items);
  const overflowLabels = options.items.map(item => item.label).filter(label => !labels.slice(0, 4).includes(label));
  const startY = 438;
  const headerH = 62;
  const rowH = Math.max(70, Math.min(102, (H - startY - 380) / Math.max(rows.length, 1)));
  const tableH = headerH + rowH * Math.max(rows.length, 1);
  const unitW = 230;
  const totalW = 160;
  const scoreW = (W - 96 - unitW - totalW) / Math.max(labels.length, 1);

  roundedRect(ctx, 48, startY, W - 96, tableH, 20, "#ffffff", LINE);
  ctx.fillStyle = NAVY;
  ctx.fillRect(48, startY, W - 96, headerH);

  let cursor = W - 48;
  const columns = [{ label: "الوحدة", width: unitW }, ...labels.map(label => ({ label, width: scoreW })), { label: "المجموع", width: totalW }];
  columns.forEach((column, index) => {
    drawFixedText(ctx, column.label, cursor - column.width / 2, startY + headerH / 2, { size: 14.5, weight: 900, color: "#ffffff", align: "center", maxWidth: column.width - 14 });
    cursor -= column.width;
    if (index < columns.length - 1) printLine(ctx, cursor, startY, cursor, startY + tableH, "#d6e2e5", 1);
  });

  if (!rows.length) {
    drawFixedText(ctx, "بانتظار رصد درجات الوحدات.", W / 2, startY + headerH + rowH / 2, { size: 19, weight: 800, color: MUTED, align: "center" });
  } else {
    rows.forEach((row, index) => {
      const y = startY + headerH + index * rowH;
      ctx.fillStyle = index % 2 ? "#f8fbfb" : "#ffffff";
      ctx.fillRect(48, y, W - 96, rowH);
      printLine(ctx, 48, y + rowH, W - 48, y + rowH, "#e5edef", 1);
      const rowEarned = row.entries.filter(item => item.recorded).reduce((sum, item) => sum + Number(item.value ?? 0), 0);
      const rowMaximum = row.entries.reduce((sum, item) => sum + Number(item.maximum || 0), 0);
      const values = [row.section, ...labels.map(label => cellFor(row.entries, label, overflowLabels)), `${ar(rowEarned)} / ${ar(rowMaximum)}`];
      let x = W - 48;
      values.forEach((value, columnIndex) => {
        const width = columns[columnIndex].width;
        drawFixedText(ctx, value, x - width / 2, y + rowH / 2, {
          size: columnIndex === 0 ? 16 : 14,
          weight: columnIndex === values.length - 1 ? 900 : 800,
          color: columnIndex === values.length - 1 ? TEAL : INK,
          align: "center",
          maxWidth: width - 14,
        });
        x -= width;
      });
    });
  }

  const summaryY = Math.min(H - 330, startY + tableH + 38);
  roundedRect(ctx, 48, summaryY, W - 96, 126, 20, "#f5faf9", LINE);
  drawFixedText(ctx, "النتيجة الحالية", W - 74, summaryY + 38, { size: 14, weight: 900, color: TEAL, maxWidth: 250 });
  drawFixedText(ctx, `${ar(options.earned)} / ${ar(options.maximum)}`, W - 74, summaryY + 82, { size: 30, weight: 900, color: NAVY, maxWidth: 310 });
  drawFixedText(ctx, `اكتمال الرصد ${ar(options.completion)}٪`, 350, summaryY + 62, { size: 17, weight: 850, color: MUTED, maxWidth: 280, align: "center" });

  const footerY = H - 150;
  printLine(ctx, 48, footerY - 34, W - 48, footerY - 34, "#d5e1e4", 1.3);
  drawFixedText(ctx, options.portalName, W - 48, footerY + 4, { size: 14, weight: 900, color: TEAL, maxWidth: 480 });
  drawFixedText(ctx, `رقم البيان ${certNo}`, W - 48, footerY + 40, { size: 12.5, weight: 750, color: MUTED, maxWidth: 420 });
  drawIdentitySeal(ctx, 132, H - 92, logo);

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 210, 297, undefined, "FAST");
  await savePdfMobileFriendly(pdf, options.fileName);
  return { pageCount: 1, certificateNumber: certNo };
}

export async function downloadStudentAcademicSummaryPdf(options: AcademicSummaryCertificate) {
  await ensurePrintFontsReady();
  const logo = await loadPortalPrintLogo();
  const { canvas, ctx } = createPrintCanvas(W, H);
  const latest = options.subjects.map(item => item.latestUpdate || "").sort().at(-1) || "";
  drawBrandHeader(ctx, logo, "السجل الأكاديمي الشامل");
  const certNo = certificateNumber(options.studentCode, "all-subjects", latest);

  roundedRect(ctx, 48, 222, W - 96, 142, 22, "#ffffff", LINE);
  drawFixedText(ctx, "الطالب", W - 72, 258, { size: 13, weight: 900, color: TEAL, maxWidth: 180 });
  drawFixedText(ctx, options.studentName, W - 72, 302, { size: 23, weight: 900, color: INK, maxWidth: 520 });
  drawFixedText(ctx, `${options.className} • ${options.studentCode}`, W - 72, 338, { size: 13, weight: 750, color: MUTED, maxWidth: 620 });

  const startY = 408;
  const rows = options.subjects;
  const headerH = 58;
  const rowH = Math.max(54, Math.min(78, (H - startY - 260 - headerH) / Math.max(rows.length, 1)));
  const widths = [320, 320, 250, 190];
  const labels = ["المادة", "المعلم", "الدرجة", "اكتمال الرصد"];
  const tableH = headerH + rowH * Math.max(rows.length, 1);
  roundedRect(ctx, 48, startY, W - 96, tableH, 18, "#ffffff", LINE);
  ctx.fillStyle = NAVY;
  ctx.fillRect(48, startY, W - 96, headerH);
  let cursor = W - 48;
  labels.forEach((label, index) => {
    const width = widths[index];
    drawFixedText(ctx, label, cursor - width / 2, startY + headerH / 2, { size: 16, weight: 900, color: "#ffffff", align: "center", maxWidth: width - 12 });
    cursor -= width;
    if (index < labels.length - 1) printLine(ctx, cursor, startY, cursor, startY + tableH, "#d8e3e6", 1);
  });

  if (!rows.length) {
    drawFixedText(ctx, "لا توجد مواد مرتبطة حاليًا.", W / 2, startY + headerH + rowH / 2, { size: 18, weight: 800, color: MUTED, align: "center" });
  } else {
    rows.forEach((row, index) => {
      const y = startY + headerH + index * rowH;
      ctx.fillStyle = index % 2 ? "#f8fbfb" : "#ffffff";
      ctx.fillRect(48, y, W - 96, rowH);
      printLine(ctx, 48, y + rowH, W - 48, y + rowH, "#e5edef", 1);
      const values = [row.subject, row.teacher, row.completion > 0 ? `${ar(row.earned)} / ${ar(row.maximum)}` : "—", `${ar(row.completion)}٪`];
      let x = W - 48;
      values.forEach((value, column) => {
        const width = widths[column];
        drawFixedText(ctx, value, x - width / 2, y + rowH / 2, { size: 15.5, weight: column === 2 ? 900 : 780, color: column === 2 ? TEAL : INK, align: "center", maxWidth: width - 16 });
        x -= width;
      });
    });
  }

  drawIdentitySeal(ctx, 132, H - 92, logo);
  drawFixedText(ctx, options.portalName, W - 48, H - 82, { size: 14, weight: 900, color: TEAL, maxWidth: 480 });
  drawFixedText(ctx, `رقم البيان ${certNo}`, W - 48, H - 48, { size: 12, weight: 750, color: MUTED, maxWidth: 420 });

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 210, 297, undefined, "FAST");
  await savePdfMobileFriendly(pdf, options.fileName);
  return { pageCount: 1, certificateNumber: certNo };
}
