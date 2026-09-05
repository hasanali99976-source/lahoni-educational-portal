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

function dateLabel(value?: string) {
  if (!value) return "لم يُسجل تحديث بعد";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "لم يُسجل تحديث بعد";
  return new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(date);
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

function drawBrandHeader(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null, title: string, subtitle: string) {
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, W, 220);
  ctx.fillStyle = TEAL;
  ctx.fillRect(0, 0, W, 14);
  roundedRect(ctx, W - 174, 36, 126, 126, 24, "#ffffff");
  if (logo) drawImageContain(ctx, logo, W - 164, 46, 106, 106, 2);
  drawFixedText(ctx, "بوابة أستاذ لحوني التعليمية", W - 206, 58, { size: 23, weight: 850, color: "#bde7e3", maxWidth: 560 });
  drawFixedText(ctx, title, W - 206, 108, { size: 38, weight: 900, color: "#ffffff", maxWidth: 780 });
  drawFixedText(ctx, subtitle, W - 206, 160, { size: 18, weight: 750, color: "#d8e9ec", maxWidth: 820 });
}

function drawIdentity(ctx: CanvasRenderingContext2D, studentName: string, className: string, studentCode: string, certificateId: string) {
  roundedRect(ctx, 48, 246, W - 96, 132, 22, "#ffffff", LINE);
  const values = [
    ["اسم الطالب", studentName],
    ["الصف / الفصل", className],
    ["كود الطالب", studentCode],
    ["رقم الشهادة", certificateId],
  ];
  const colW = (W - 128) / values.length;
  values.forEach(([label, value], index) => {
    const x = W - 64 - index * colW;
    drawFixedText(ctx, label, x, 282, { size: 13.5, weight: 800, color: MUTED, maxWidth: colW - 18 });
    drawFixedText(ctx, value, x, 332, { size: 20, weight: 900, color: INK, maxWidth: colW - 18 });
    if (index < values.length - 1) printLine(ctx, x - colW + 8, 267, x - colW + 8, 358, "#e6edef", 1.1);
  });
}

function drawSeal(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.08);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 68, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 57, 0, Math.PI * 2);
  ctx.stroke();
  drawFixedText(ctx, "معتمد", 0, -9, { size: 22, weight: 900, color: "#9a742c", align: "center", maxWidth: 100 });
  drawFixedText(ctx, "أستاذ لحوني", 0, 22, { size: 12, weight: 850, color: "#9a742c", align: "center", maxWidth: 100 });
  ctx.restore();
}

export async function downloadStudentAcademicSubjectPdf(options: AcademicSubjectCertificate) {
  await ensurePrintFontsReady();
  const logo = await loadPortalPrintLogo();
  const { canvas, ctx } = createPrintCanvas(W, H);
  drawBrandHeader(ctx, logo, "شهادة التحصيل الأكاديمي", `${options.subject} • مرتبطة بآخر رصد محفوظ من معلم المادة`);
  const certNo = certificateNumber(options.studentCode, options.subjectKey, options.latestUpdate);
  drawIdentity(ctx, options.studentName, options.className, options.studentCode, certNo);

  roundedRect(ctx, 48, 402, W - 96, 126, 22, "#f7fbfb", LINE);
  drawFixedText(ctx, options.subject, W - 76, 442, { size: 30, weight: 900, color: NAVY, maxWidth: 420 });
  drawFixedText(ctx, `المعلم: ${options.teacher}`, W - 76, 484, { size: 18, weight: 800, color: MUTED, maxWidth: 480 });
  roundedRect(ctx, 70, 423, 260, 82, 18, "#e8f6f3");
  drawFixedText(ctx, "الدرجة الحالية", 304, 447, { size: 13.5, weight: 850, color: "#0a716b", maxWidth: 220 });
  drawFixedText(ctx, `${ar(options.earned)} / ${ar(options.maximum)}`, 304, 484, { size: 25, weight: 900, color: "#0a716b", maxWidth: 220 });

  const rows = options.items;
  const startY = 562;
  const available = H - startY - 230;
  const rowH = Math.max(30, Math.min(52, available / Math.max(rows.length + 1, 1)));
  const headerH = 54;
  roundedRect(ctx, 48, startY, W - 96, Math.min(available, headerH + rowH * Math.max(rows.length, 1)), 18, "#ffffff", LINE);
  ctx.fillStyle = NAVY;
  ctx.fillRect(48, startY, W - 96, headerH);
  const widths = [300, 360, 200, 200];
  const labels = ["القسم / الوحدة", "بند التقييم", "درجة الطالب", "الحالة"];
  let cursor = W - 48;
  labels.forEach((label, index) => {
    const width = widths[index];
    drawFixedText(ctx, label, cursor - width / 2, startY + headerH / 2, { size: 16, weight: 900, color: "#ffffff", align: "center", maxWidth: width - 14 });
    cursor -= width;
    if (index < labels.length - 1) printLine(ctx, cursor, startY, cursor, startY + headerH + rowH * Math.max(rows.length, 1), "#d9e4e7", 1);
  });
  if (!rows.length) {
    drawFixedText(ctx, "لم يعتمد المعلم بنودًا تفصيلية بعد.", W / 2, startY + headerH + rowH / 2, { size: 18, weight: 800, color: MUTED, align: "center" });
  } else {
    rows.forEach((item, index) => {
      const y = startY + headerH + index * rowH;
      ctx.fillStyle = index % 2 ? "#f8fbfb" : "#ffffff";
      ctx.fillRect(48, y, W - 96, rowH);
      printLine(ctx, 48, y + rowH, W - 48, y + rowH, "#e6edef", 1);
      const values = [
        item.section,
        item.label,
        item.recorded ? `${ar(Number(item.value ?? 0))} / ${ar(item.maximum)}` : `— / ${ar(item.maximum)}`,
        item.recorded ? "تم الرصد" : "لم تُرصد بعد",
      ];
      let x = W - 48;
      values.forEach((value, column) => {
        const width = widths[column];
        drawFixedText(ctx, value, x - width / 2, y + rowH / 2, {
          size: rowH < 38 ? 13 : 15.5,
          weight: column === 2 ? 900 : 780,
          color: column === 3 ? (item.recorded ? "#0b7d6d" : "#8a6b45") : INK,
          align: "center",
          maxWidth: width - 16,
        });
        x -= width;
      });
    });
  }

  const footerY = H - 176;
  printLine(ctx, 48, footerY, W - 48, footerY, "#ccdadd", 1.4);
  drawFixedText(ctx, `آخر رصد: ${dateLabel(options.latestUpdate)}`, W - 48, footerY + 38, { size: 15, weight: 800, color: MUTED, maxWidth: 520 });
  drawFixedText(ctx, `اكتمال الرصد ${ar(options.completion)}٪`, W - 48, footerY + 76, { size: 15, weight: 800, color: TEAL, maxWidth: 380 });
  drawFixedText(ctx, "هذه الشهادة صادرة آليًا من بيانات المعلم المحفوظة ولا تغيّر توزيع خطة المادة.", W / 2, H - 54, { size: 13.5, weight: 750, color: MUTED, align: "center", maxWidth: 760 });
  drawSeal(ctx, 128, H - 92);

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
  drawBrandHeader(ctx, logo, "السجل الأكاديمي الشامل", "شهادة موحدة لجميع المواد المرتبطة بالطالب في بوابة أستاذ لحوني التعليمية");
  const certNo = certificateNumber(options.studentCode, "all-subjects", latest);
  drawIdentity(ctx, options.studentName, options.className, options.studentCode, certNo);

  const startY = 424;
  const rows = options.subjects;
  const headerH = 58;
  const rowH = Math.max(48, Math.min(76, (H - startY - 250 - headerH) / Math.max(rows.length, 1)));
  const widths = [290, 300, 210, 180, 140];
  const labels = ["المادة", "المعلم", "الدرجة", "اكتمال الرصد", "الحالة"];
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
      const recorded = row.maximum > 0 && row.completion > 0;
      const values = [
        row.subject,
        row.teacher,
        recorded ? `${ar(row.earned)} / ${ar(row.maximum)}` : "—",
        `${ar(row.completion)}٪`,
        recorded ? "مرصود" : "لم تُرصد بعد",
      ];
      let x = W - 48;
      values.forEach((value, column) => {
        const width = widths[column];
        drawFixedText(ctx, value, x - width / 2, y + rowH / 2, { size: 15.5, weight: column === 2 ? 900 : 780, color: column === 4 ? (recorded ? "#0b7d6d" : "#8a6b45") : INK, align: "center", maxWidth: width - 16 });
        x -= width;
      });
    });
  }

  const footerY = Math.min(H - 190, startY + tableH + 42);
  roundedRect(ctx, 48, footerY, W - 96, 112, 18, "#f8fbfb", LINE);
  drawFixedText(ctx, "اعتماد السجل", W - 72, footerY + 34, { size: 15, weight: 850, color: TEAL, maxWidth: 280 });
  drawFixedText(ctx, "يعكس هذا السجل آخر درجات محفوظة من معلمي المواد، ويُظهر البنود غير المرصودة دون تحويلها إلى صفر.", W - 72, footerY + 76, { size: 16, weight: 800, color: INK, maxWidth: 800 });
  drawSeal(ctx, 128, H - 92);
  drawFixedText(ctx, options.portalName, W / 2, H - 62, { size: 14, weight: 900, color: TEAL, align: "center", maxWidth: 420 });

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 210, 297, undefined, "FAST");
  await savePdfMobileFriendly(pdf, options.fileName);
  return { pageCount: 1, certificateNumber: certNo };
}
