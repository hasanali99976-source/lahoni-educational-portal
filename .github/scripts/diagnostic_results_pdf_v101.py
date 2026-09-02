from pathlib import Path

component_path = Path('app/teacher/diagnostics/diagnostic-results.tsx')
text = component_path.read_text(encoding='utf-8')

import_line = 'import { downloadDiagnosticResultsPdf, type DiagnosticResultsPdfClass } from "../../../lib/diagnostic-results-pdf";\n'
anchor = 'import type { SubjectKey } from "../../../lib/subject-config";\n'
if import_line not in text:
    text = text.replace(anchor, anchor + import_line)

start = text.find('  function reportPage(key: string, rows: RosterRow[], index: number) {')
end = text.find('\n  return <section className="diag-results"', start)
if start < 0 or end < 0:
    raise SystemExit('diagnostic report function block not found')

replacement = r'''  function buildPdfClass(key: string): DiagnosticResultsPdfClass | null {
    const rows = rowsForClass(key);
    if (!rows.length) return null;
    const completed = rows.filter(row => row.result);
    const completedTotal = completed.length;
    const pendingTotal = Math.max(0, rows.length - completedTotal);
    const classAverage = completedTotal
      ? Math.round(completed.reduce((sum, row) => sum + percentOf(row.result as Result), 0) / completedTotal)
      : 0;
    return {
      className: classDisplay(key),
      studentCount: rows.length,
      completedCount: completedTotal,
      pendingCount: pendingTotal,
      average: classAverage,
      rows: rows.map((row, index) => {
        const result = row.result;
        return {
          number: index + 1,
          studentName: row.student.name || row.student.id,
          status: result ? "عمل الاختبار" : "لم يعمل الاختبار",
          score: result ? `${result.score}/${result.total}` : "—",
          percentage: result ? percentOf(result) : null,
          level: result ? resultLevel(result) : "بانتظار الاختبار",
          weakSkills: result?.weakSkills?.length ? result.weakSkills.join("، ") : result ? "لا توجد مهارات ضعيفة مسجلة" : "—",
          plan: result
            ? (result.teacherPlan || result.aiPlan || result.plan || fallbackPlan(result, row.student.name || "الطالب", subjectName))
            : "لم يؤد الطالب الاختبار بعد، لذلك لا توجد خطة تشخيصية حتى الآن.",
          submittedAt: result ? formatDate(result.submittedAt) : "—",
        };
      }),
    };
  }

  async function printClassReport() {
    if (!className || !testId) return window.alert("اختر الفصول والاختبار أولًا.");
    const reportClasses = (className === "all" ? classes : [className])
      .map(buildPdfClass)
      .filter((item): item is DiagnosticResultsPdfClass => Boolean(item));
    if (!reportClasses.length) return window.alert("لا توجد أسماء في الفصول المحددة.");
    setMessage("جارٍ تجهيز تقرير PDF كامل للنتائج والخطط…");
    try {
      const result = await downloadDiagnosticResultsPdf({
        portalName: PORTAL_NAME,
        subjectName,
        diagnosticTitle,
        classes: reportClasses,
        fileName: `نتائج-${diagnosticTitle.replace(/[\\/:*?\"<>|]/g, "-")}-${className === "all" ? "جميع-الفصول" : classDisplay(className)}.pdf`,
      });
      setMessage(`تم إنشاء التقرير كاملًا: ${result.studentCount} طالبًا، ${result.classCount} فصل، ${result.pageCount} صفحة.`);
    } catch (error) {
      console.error("diagnostic-results-pdf-v101", error);
      setMessage("تعذر إنشاء تقرير PDF الآن.");
    }
  }
'''
text = text[:start] + replacement + text[end:]
component_path.write_text(text, encoding='utf-8')

pdf = r'''"use client";

import { jsPDF } from "jspdf";

export type DiagnosticResultsPdfRow = {
  number: number;
  studentName: string;
  status: string;
  score: string;
  percentage: number | null;
  level: string;
  weakSkills: string;
  plan: string;
  submittedAt: string;
};

export type DiagnosticResultsPdfClass = {
  className: string;
  studentCount: number;
  completedCount: number;
  pendingCount: number;
  average: number;
  rows: DiagnosticResultsPdfRow[];
  accentColor?: string;
};

export type DiagnosticResultsPdfOptions = {
  portalName: string;
  subjectName: string;
  diagnosticTitle: string;
  classes: DiagnosticResultsPdfClass[];
  fileName: string;
};

type Segment = {
  classIndex: number;
  row: DiagnosticResultsPdfRow;
  planLines: string[];
  continuation: boolean;
  finalSegment: boolean;
};

type PageModel = {
  classIndex: number;
  segments: Segment[];
};

const WIDTH = 1600;
const HEIGHT = 1131;
const MARGIN = 38;
const TOP = 265;
const BOTTOM = HEIGHT - 72;
const FONT = "Tajawal, Arial, Tahoma, sans-serif";
const CLASS_ACCENTS = ["#0e4b59", "#2457a1", "#6f3fa0", "#a34f2f", "#2f7a55", "#8a5a05", "#8f3555", "#3f5f8f"];
const PLAN_FONT = 13.5;
const PLAN_LINE_H = 22;
const CARD_BASE_H = 116;
const MIN_CARD_H = 150;
const MAX_PLAN_LINES_PER_SEGMENT = 20;

function createCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("diagnostic_results_pdf_canvas_unavailable");
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
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color = "#d3dfe5", width = 1.3) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function wrap(ctx: CanvasRenderingContext2D, value: unknown, maxWidth: number, size: number, weight = 700) {
  const raw = String(value ?? "").trim();
  if (!raw) return ["—"];
  setFont(ctx, size, weight);
  const words = raw.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !current) current = candidate;
    else { lines.push(current); current = word; }
  }
  if (current) lines.push(current);
  return lines;
}

function text(ctx: CanvasRenderingContext2D, value: unknown, x: number, y: number, size: number, color = "#173b49", weight = 700, align: CanvasTextAlign = "right", maxWidth?: number) {
  const raw = String(value ?? "");
  let fontSize = size;
  if (maxWidth) {
    while (fontSize > 9) {
      setFont(ctx, fontSize, weight);
      if (ctx.measureText(raw).width <= maxWidth) break;
      fontSize -= 0.5;
    }
  }
  setFont(ctx, fontSize, weight);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(raw, x, y);
}

function cardHeight(segment: Segment) {
  return Math.max(MIN_CARD_H, CARD_BASE_H + segment.planLines.length * PLAN_LINE_H);
}

function buildPages(options: DiagnosticResultsPdfOptions) {
  const probe = createCanvas();
  const pages: PageModel[] = [];
  options.classes.forEach((classReport, classIndex) => {
    let current: PageModel = { classIndex, segments: [] };
    let used = 0;
    classReport.rows.forEach(row => {
      const allLines = wrap(probe.ctx, row.plan, 1000, PLAN_FONT, 700);
      const pieces: string[][] = [];
      for (let i = 0; i < allLines.length; i += MAX_PLAN_LINES_PER_SEGMENT) pieces.push(allLines.slice(i, i + MAX_PLAN_LINES_PER_SEGMENT));
      if (!pieces.length) pieces.push(["—"]);
      pieces.forEach((planLines, pieceIndex) => {
        const segment: Segment = {
          classIndex,
          row,
          planLines,
          continuation: pieceIndex > 0,
          finalSegment: pieceIndex === pieces.length - 1,
        };
        const h = cardHeight(segment) + 12;
        const capacity = BOTTOM - TOP;
        if (current.segments.length && used + h > capacity) {
          pages.push(current);
          current = { classIndex, segments: [] };
          used = 0;
        }
        current.segments.push(segment);
        used += h;
      });
    });
    if (current.segments.length) pages.push(current);
  });
  return pages;
}

function drawHeader(ctx: CanvasRenderingContext2D, options: DiagnosticResultsPdfOptions, classReport: DiagnosticResultsPdfClass, accent: string, pageIndex: number, pageCount: number, classIndex: number) {
  rounded(ctx, MARGIN, 24, WIDTH - MARGIN * 2, 112, 22, accent);
  text(ctx, options.portalName, WIDTH - MARGIN - 26, 51, 17, "#dbecef", 900, "right", 560);
  text(ctx, "نتائج الاختبار التشخيصي والخطط", WIDTH - MARGIN - 26, 91, 29, "#ffffff", 900, "right", 710);
  rounded(ctx, MARGIN + 18, 45, 250, 48, 24, "#f5c34f");
  text(ctx, `الفصل ${classIndex + 1} من ${options.classes.length}`, MARGIN + 143, 69, 15, "#173b49", 900, "center", 210);
  text(ctx, `صفحة ${pageIndex + 1} من ${pageCount}`, MARGIN + 20, 117, 12.5, "#dcebef", 800, "left", 250);

  const meta = [
    ["المادة", options.subjectName],
    ["الاختبار", options.diagnosticTitle],
    ["الفصل", classReport.className],
  ];
  const gap = 10;
  const w = (WIDTH - MARGIN * 2 - gap * 2) / 3;
  meta.forEach(([label, value], index) => {
    const x = WIDTH - MARGIN - w - index * (w + gap);
    rounded(ctx, x, 151, w, 54, 11, "#f7fafb", "#d2dfe4");
    text(ctx, label, x + w - 14, 168, 11.5, "#768b94", 800, "right", w - 28);
    text(ctx, value, x + w - 14, 190, 15.5, "#173b49", 900, "right", w - 28);
  });

  const stats = [
    ["عدد الطلاب", classReport.studentCount],
    ["عملوا الاختبار", classReport.completedCount],
    ["لم يعملوا", classReport.pendingCount],
    ["متوسط المنجزين", `${classReport.average}%`],
  ];
  const sw = (WIDTH - MARGIN * 2 - gap * 3) / 4;
  stats.forEach(([label, value], index) => {
    const x = WIDTH - MARGIN - sw - index * (sw + gap);
    rounded(ctx, x, 215, sw, 44, 10, index === 1 ? "#eef8f4" : index === 2 ? "#fff7e9" : "#f8fafb", "#d4e0e5");
    text(ctx, value, x + sw / 2, 229, 15, index === 1 ? "#14755e" : index === 2 ? "#9a650e" : accent, 900, "center", sw - 20);
    text(ctx, label, x + sw / 2, 248, 10.5, "#738790", 800, "center", sw - 20);
  });
}

function drawSegment(ctx: CanvasRenderingContext2D, segment: Segment, y: number, accent: string) {
  const x = MARGIN;
  const w = WIDTH - MARGIN * 2;
  const h = cardHeight(segment);
  const row = segment.row;
  const pending = row.percentage === null;
  rounded(ctx, x, y, w, h, 15, pending ? "#fffaf1" : "#ffffff", pending ? "#e3c27f" : "#bfd0d7");
  rounded(ctx, x + w - 69, y + 15, 46, 46, 23, pending ? "#dfad43" : accent);
  text(ctx, row.number, x + w - 46, y + 38, 16, "#ffffff", 900, "center");
  text(ctx, segment.continuation ? `${row.studentName} — تكملة الخطة` : row.studentName, x + w - 86, y + 30, 18, "#173b49", 900, "right", 430);
  text(ctx, row.status, x + w - 86, y + 55, 11.5, pending ? "#9a650e" : "#168066", 900, "right", 250);

  const info = [
    ["الدرجة", row.score],
    ["النسبة", row.percentage === null ? "—" : `${row.percentage}%`],
    ["المستوى", row.level],
    ["التسليم", row.submittedAt],
  ];
  const infoStart = x + 22;
  const infoW = 165;
  info.forEach(([label, value], index) => {
    const bx = infoStart + index * (infoW + 8);
    rounded(ctx, bx, y + 15, infoW, 48, 9, "#f4f8fa", "#d5e1e6");
    text(ctx, label, bx + infoW - 10, y + 28, 9.5, "#7a8e97", 800, "right", infoW - 20);
    text(ctx, value, bx + infoW - 10, y + 47, 12.5, "#244653", 900, "right", infoW - 20);
  });

  line(ctx, x + 18, y + 74, x + w - 18, y + 74);
  text(ctx, "المهارات الضعيفة", x + w - 22, y + 92, 11, "#748a93", 800);
  const skillLines = wrap(ctx, row.weakSkills, w - 210, 12.5, 700).slice(0, 2);
  setFont(ctx, 12.5, 700); ctx.fillStyle = "#3c5b68"; ctx.textAlign = "right";
  skillLines.forEach((entry, index) => ctx.fillText(entry, x + w - 145, y + 92 + index * 20));

  const planTop = y + CARD_BASE_H;
  rounded(ctx, x + 18, planTop - 24, w - 36, h - (planTop - y) + 10, 11, "#f8fbfc", "#dbe5e9");
  text(ctx, segment.continuation ? "تكملة الخطة" : "الخطة العلاجية / الإثرائية", x + w - 32, planTop - 7, 11, accent, 900);
  setFont(ctx, PLAN_FONT, 700); ctx.fillStyle = "#264754"; ctx.textAlign = "right";
  segment.planLines.forEach((entry, index) => ctx.fillText(entry, x + w - 34, planTop + 20 + index * PLAN_LINE_H));
  if (!segment.finalSegment) text(ctx, "يتبع في الصفحة التالية ←", x + 32, y + h - 18, 10.5, accent, 900, "left");
  return y + h + 12;
}

function drawFooter(ctx: CanvasRenderingContext2D, options: DiagnosticResultsPdfOptions, classReport: DiagnosticResultsPdfClass, pageIndex: number, pageCount: number) {
  const y = HEIGHT - 34;
  line(ctx, MARGIN, y - 18, WIDTH - MARGIN, y - 18, "#bdcdd3", 1.4);
  text(ctx, options.portalName, WIDTH - MARGIN, y, 11.5, "#55717c", 900, "right", 420);
  text(ctx, classReport.className, WIDTH / 2, y, 11.5, "#647c85", 800, "center", 300);
  text(ctx, `صفحة ${pageIndex + 1} من ${pageCount}`, MARGIN, y, 11.5, "#55717c", 900, "left", 260);
}

export async function downloadDiagnosticResultsPdf(options: DiagnosticResultsPdfOptions) {
  const usable = options.classes.filter(item => item.rows.length);
  if (!usable.length) throw new Error("diagnostic_results_pdf_no_students");
  if (document.fonts?.ready) await document.fonts.ready;
  const normalized: DiagnosticResultsPdfOptions = { ...options, classes: usable };
  const pages = buildPages(normalized);
  if (!pages.length) throw new Error("diagnostic_results_pdf_no_pages");

  const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [WIDTH, HEIGHT], compress: true });
  pages.forEach((page, pageIndex) => {
    if (pageIndex > 0) pdf.addPage([WIDTH, HEIGHT], "landscape");
    const { canvas, ctx } = createCanvas();
    const classReport = usable[page.classIndex];
    const accent = classReport.accentColor || CLASS_ACCENTS[page.classIndex % CLASS_ACCENTS.length];
    drawHeader(ctx, normalized, classReport, accent, pageIndex, pages.length, page.classIndex);
    let y = TOP + 10;
    page.segments.forEach(segment => { y = drawSegment(ctx, segment, y, accent); });
    drawFooter(ctx, normalized, classReport, pageIndex, pages.length);
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.93), "JPEG", 0, 0, WIDTH, HEIGHT, undefined, "FAST");
  });
  pdf.save(options.fileName);
  return {
    pageCount: pages.length,
    classCount: usable.length,
    studentCount: usable.reduce((sum, item) => sum + item.studentCount, 0),
  };
}
'''
Path('lib/diagnostic-results-pdf.ts').write_text(pdf, encoding='utf-8')

pwa_path = Path('app/pwa-register.tsx')
pwa = pwa_path.read_text(encoding='utf-8')
import re
pwa = re.sub(r'ostadh-lahooni-v\d+[^\"]*', 'ostadh-lahooni-v101-diagnostic-results-full-pdf', pwa)
pwa = re.sub(r'/sw\.js\?v=[^\"]+', '/sw.js?v=101-diagnostic-results-full-pdf', pwa)
pwa_path.write_text(pwa, encoding='utf-8')

sw_path = Path('public/sw.js')
sw = sw_path.read_text(encoding='utf-8')
sw = re.sub(r'const CACHE_NAME = "[^"]+";', 'const CACHE_NAME = "ostadh-lahooni-v101-diagnostic-results-full-pdf";', sw, count=1)
sw_path.write_text(sw, encoding='utf-8')
