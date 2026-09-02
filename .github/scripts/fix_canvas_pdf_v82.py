from pathlib import Path

ROOT = Path('.')
ATT = ROOT / 'app/teacher/attendance/page.tsx'
GRD = ROOT / 'app/teacher/grades/page.tsx'
SW = ROOT / 'public/sw.js'
HELPER = ROOT / 'lib/class-pdf-canvas.ts'

helper = r'''"use client";

export type AttendanceCanvasRow = {
  number: number;
  name: string;
  status: string;
};

export type GradesCanvasRow = {
  number: number;
  name: string;
  attendance: number | string;
  participation: number | string;
  homework: number | string;
  unitExam: number | string;
  total: number | string;
  notes: string;
};

type AttendanceCanvasOptions = {
  portalName: string;
  teacherName: string;
  subject: string;
  className: string;
  date: string;
  hijriDate: string;
  rows: AttendanceCanvasRow[];
  counts: { present: number; absent: number; late: number; excused: number; escaped: number };
};

type GradesCanvasOptions = {
  portalName: string;
  teacherName?: string;
  subject: string;
  stage: string;
  className: string;
  unitLabel: string;
  examLabel: string;
  rows: GradesCanvasRow[];
};

const WIDTH = 1600;
const HEIGHT = 1131;
const FONT_FAMILY = "Tajawal, Arial, sans-serif";

function canvasContext() {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas_context_unavailable");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, WIDTH, HEIGHT);
  context.textBaseline = "middle";
  context.direction = "rtl";
  return { canvas, context };
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, fill: string, stroke?: string) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
  context.fillStyle = fill;
  context.fill();
  if (stroke) {
    context.strokeStyle = stroke;
    context.lineWidth = 1.5;
    context.stroke();
  }
}

function setFont(context: CanvasRenderingContext2D, size: number, weight = 700) {
  context.font = `${weight} ${size}px ${FONT_FAMILY}`;
}

function fitFont(context: CanvasRenderingContext2D, value: string, maxWidth: number, startSize: number, minSize: number, weight = 700) {
  let size = startSize;
  while (size > minSize) {
    setFont(context, size, weight);
    if (context.measureText(value).width <= maxWidth) break;
    size -= 0.5;
  }
  return size;
}

function text(context: CanvasRenderingContext2D, value: unknown, x: number, y: number, options: { size?: number; minSize?: number; weight?: number; color?: string; align?: CanvasTextAlign; maxWidth?: number } = {}) {
  const raw = String(value ?? "");
  const size = options.maxWidth
    ? fitFont(context, raw, options.maxWidth, options.size ?? 18, options.minSize ?? 10, options.weight ?? 700)
    : (options.size ?? 18);
  setFont(context, size, options.weight ?? 700);
  context.fillStyle = options.color ?? "#173b49";
  context.textAlign = options.align ?? "right";
  context.fillText(raw, x, y);
}

function line(context: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color = "#d5e2e7", width = 1) {
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.strokeStyle = color;
  context.lineWidth = width;
  context.stroke();
}

function header(context: CanvasRenderingContext2D, title: string, rightLabel: string, rightValue: string) {
  const x = 28;
  const y = 22;
  const width = WIDTH - 56;
  const height = 105;
  roundedRect(context, x, y, width, height, 22, "#0f4c5a");
  roundedRect(context, x + 14, y + 14, 210, 36, 18, "#f5c34f");
  text(context, "صفحة واحدة — جميع الطلاب", x + 119, y + 32, { size: 14, weight: 900, color: "#173b49", align: "center" });
  text(context, title, x + 28, y + 76, { size: 31, minSize: 24, weight: 900, color: "#ffffff", align: "left", maxWidth: 560 });
  text(context, rightLabel, x + width - 28, y + 34, { size: 14, weight: 700, color: "#c9e2e8" });
  text(context, rightValue, x + width - 28, y + 72, { size: 28, minSize: 20, weight: 900, color: "#ffffff", maxWidth: 610 });
}

function metaBoxes(context: CanvasRenderingContext2D, items: Array<{ label: string; value: string }>, y: number) {
  const margin = 28;
  const gap = 10;
  const width = (WIDTH - margin * 2 - gap * (items.length - 1)) / items.length;
  items.forEach((item, index) => {
    const x = WIDTH - margin - width - index * (width + gap);
    roundedRect(context, x, y, width, 72, 14, "#f7fafb", "#cedde3");
    text(context, item.label, x + width - 14, y + 22, { size: 12, weight: 800, color: "#70858e", maxWidth: width - 28 });
    text(context, item.value || "—", x + width - 14, y + 50, { size: 18, minSize: 11, weight: 900, color: "#173b49", maxWidth: width - 28 });
  });
}

function summaryBoxes(context: CanvasRenderingContext2D, items: Array<{ label: string; value: number; fill: string; color: string }>, y: number) {
  const margin = 28;
  const gap = 10;
  const width = (WIDTH - margin * 2 - gap * (items.length - 1)) / items.length;
  items.forEach((item, index) => {
    const x = WIDTH - margin - width - index * (width + gap);
    roundedRect(context, x, y, width, 64, 14, item.fill, "#d5e2e7");
    text(context, item.value, x + width / 2, y + 24, { size: 22, weight: 900, color: item.color, align: "center" });
    text(context, item.label, x + width / 2, y + 48, { size: 12, weight: 900, color: item.color, align: "center" });
  });
}

function footer(context: CanvasRenderingContext2D, left: string, center: string, right: string) {
  const y = HEIGHT - 34;
  line(context, 28, y - 12, WIDTH - 28, y - 12, "#b9cbd1", 1.5);
  text(context, left, 28, y, { size: 12, weight: 900, color: "#2d5662", align: "left", maxWidth: 500 });
  text(context, center, WIDTH / 2, y, { size: 12, weight: 800, color: "#6a7f88", align: "center", maxWidth: 500 });
  text(context, right, WIDTH - 28, y, { size: 12, weight: 900, color: "#0d6b52", maxWidth: 500 });
}

function attendanceStatusStyle(status: string) {
  if (status === "حاضر") return { fill: "#dff4e7", color: "#13643d" };
  if (status === "غائب") return { fill: "#fde6e9", color: "#a72c39" };
  if (status === "متأخر") return { fill: "#fff0c9", color: "#8a5a05" };
  if (status === "مستأذن") return { fill: "#e3edff", color: "#2457a1" };
  return { fill: "#eee4ff", color: "#6239a4" };
}

export function renderAttendanceClassCanvas(options: AttendanceCanvasOptions) {
  const { canvas, context } = canvasContext();
  header(context, "تقرير الحضور اليومي", options.portalName, "سجل الحضور والمتابعة اليومية");
  metaBoxes(context, [
    { label: "المعلم", value: options.teacherName },
    { label: "المادة", value: options.subject },
    { label: "الفصل", value: options.className },
    { label: "التاريخ", value: options.date },
    { label: "التاريخ الهجري", value: options.hijriDate },
  ], 142);
  summaryBoxes(context, [
    { label: "إجمالي الطلاب", value: options.rows.length, fill: "#edf4f6", color: "#173b49" },
    { label: "حاضر", value: options.counts.present, fill: "#e0f3e7", color: "#13643d" },
    { label: "غائب", value: options.counts.absent, fill: "#fde6e9", color: "#a72c39" },
    { label: "متأخر", value: options.counts.late, fill: "#fff0c9", color: "#8a5a05" },
    { label: "مستأذن", value: options.counts.excused, fill: "#e3edff", color: "#2457a1" },
    { label: "هروب", value: options.counts.escaped, fill: "#eee4ff", color: "#6239a4" },
  ], 226);

  const tableTop = 306;
  const tableBottom = HEIGHT - 64;
  const margin = 28;
  const gap = 16;
  const columnCount = options.rows.length <= 18 ? 1 : 2;
  const rowsPerColumn = Math.ceil(options.rows.length / columnCount);
  const columnWidth = (WIDTH - margin * 2 - gap * (columnCount - 1)) / columnCount;
  const headerHeight = 42;
  const rowHeight = Math.floor((tableBottom - tableTop - headerHeight) / Math.max(1, rowsPerColumn));

  for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
    const x = WIDTH - margin - columnWidth - columnIndex * (columnWidth + gap);
    const rows = options.rows.slice(columnIndex * rowsPerColumn, (columnIndex + 1) * rowsPerColumn);
    roundedRect(context, x, tableTop, columnWidth, tableBottom - tableTop, 14, "#ffffff", "#bed0d6");
    context.save();
    context.beginPath();
    context.rect(x, tableTop, columnWidth, tableBottom - tableTop);
    context.clip();
    context.fillStyle = "#174b59";
    context.fillRect(x, tableTop, columnWidth, headerHeight);
    const numberWidth = Math.round(columnWidth * 0.09);
    const statusWidth = Math.round(columnWidth * 0.22);
    const nameWidth = columnWidth - numberWidth - statusWidth;
    const numberX = x + columnWidth;
    const nameX = x + columnWidth - numberWidth;
    const statusX = x + statusWidth;
    text(context, "م", numberX - numberWidth / 2, tableTop + headerHeight / 2, { size: 15, weight: 900, color: "#ffffff", align: "center" });
    text(context, "اسم الطالب", nameX - nameWidth / 2, tableTop + headerHeight / 2, { size: 16, weight: 900, color: "#ffffff", align: "center" });
    text(context, "الحالة", statusX - statusWidth / 2, tableTop + headerHeight / 2, { size: 15, weight: 900, color: "#ffffff", align: "center" });
    line(context, x + statusWidth, tableTop, x + statusWidth, tableBottom, "#d2e0e4", 1);
    line(context, x + statusWidth + nameWidth, tableTop, x + statusWidth + nameWidth, tableBottom, "#d2e0e4", 1);

    rows.forEach((row, index) => {
      const y = tableTop + headerHeight + index * rowHeight;
      context.fillStyle = index % 2 ? "#f7fafb" : "#ffffff";
      context.fillRect(x, y, columnWidth, rowHeight);
      line(context, x, y + rowHeight, x + columnWidth, y + rowHeight, "#d5e2e7", 1);
      text(context, row.number, x + columnWidth - numberWidth / 2, y + rowHeight / 2, { size: 15, weight: 900, color: "#184654", align: "center" });
      text(context, row.name, x + columnWidth - numberWidth - 12, y + rowHeight / 2, { size: Math.min(20, rowHeight * 0.43), minSize: 11, weight: 900, color: "#153c49", maxWidth: nameWidth - 24 });
      const statusStyle = attendanceStatusStyle(row.status);
      const pillWidth = Math.min(statusWidth - 22, 112);
      const pillHeight = Math.min(30, rowHeight - 8);
      const pillX = x + (statusWidth - pillWidth) / 2;
      const pillY = y + (rowHeight - pillHeight) / 2;
      roundedRect(context, pillX, pillY, pillWidth, pillHeight, pillHeight / 2, statusStyle.fill);
      text(context, row.status, pillX + pillWidth / 2, y + rowHeight / 2, { size: Math.min(14, pillHeight * 0.48), minSize: 9, weight: 900, color: statusStyle.color, align: "center", maxWidth: pillWidth - 12 });
    });
    context.restore();
  }

  footer(context, options.portalName, `${options.className} — ${options.date}`, `تم إدراج ${options.rows.length} من ${options.rows.length} طالبًا`);
  return canvas;
}

export function renderGradesClassCanvas(options: GradesCanvasOptions) {
  const { canvas, context } = canvasContext();
  header(context, "سجل رصد الدرجات", options.portalName, options.unitLabel);
  metaBoxes(context, [
    { label: "المعلم", value: options.teacherName || "—" },
    { label: "المادة", value: options.subject },
    { label: "المرحلة", value: options.stage },
    { label: "الفصل", value: options.className },
    { label: "عدد الطلاب", value: String(options.rows.length) },
  ], 142);

  const tableTop = 232;
  const tableBottom = HEIGHT - 64;
  const margin = 28;
  const gap = 16;
  const columnCount = options.rows.length <= 16 ? 1 : 2;
  const rowsPerColumn = Math.ceil(options.rows.length / columnCount);
  const columnWidth = (WIDTH - margin * 2 - gap * (columnCount - 1)) / columnCount;
  const headerHeight = 46;
  const rowHeight = Math.floor((tableBottom - tableTop - headerHeight) / Math.max(1, rowsPerColumn));

  const ratios = [0.055, 0.31, 0.09, 0.10, 0.09, 0.105, 0.09, 0.16];
  const labels = ["م", "اسم الطالب", "حضور", "مشاركة", "واجب", "اختبار", "المجموع", "ملاحظات"];

  for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
    const x = WIDTH - margin - columnWidth - columnIndex * (columnWidth + gap);
    const rows = options.rows.slice(columnIndex * rowsPerColumn, (columnIndex + 1) * rowsPerColumn);
    roundedRect(context, x, tableTop, columnWidth, tableBottom - tableTop, 14, "#ffffff", "#bed0d6");
    context.save();
    context.beginPath();
    context.rect(x, tableTop, columnWidth, tableBottom - tableTop);
    context.clip();
    context.fillStyle = "#174b59";
    context.fillRect(x, tableTop, columnWidth, headerHeight);

    const widths = ratios.map((ratio, index) => index === ratios.length - 1 ? 0 : Math.round(columnWidth * ratio));
    widths[widths.length - 1] = columnWidth - widths.slice(0, -1).reduce((sum, value) => sum + value, 0);
    const edges: number[] = [x + columnWidth];
    widths.forEach(width => edges.push(edges[edges.length - 1] - width));
    labels.forEach((label, index) => {
      const right = edges[index];
      const left = edges[index + 1];
      text(context, index === 5 ? options.examLabel.replace(/^اختبار\s*/, "") || label : label, (right + left) / 2, tableTop + headerHeight / 2, {
        size: columnCount === 1 ? 15 : 12.5,
        minSize: 8,
        weight: 900,
        color: "#ffffff",
        align: "center",
        maxWidth: Math.max(18, right - left - 8),
      });
      if (index > 0) line(context, right, tableTop, right, tableBottom, "#d2e0e4", 1);
    });

    rows.forEach((row, rowIndex) => {
      const y = tableTop + headerHeight + rowIndex * rowHeight;
      context.fillStyle = rowIndex % 2 ? "#f7fafb" : "#ffffff";
      context.fillRect(x, y, columnWidth, rowHeight);
      line(context, x, y + rowHeight, x + columnWidth, y + rowHeight, "#d5e2e7", 1);
      const values: Array<string | number> = [row.number, row.name, row.attendance, row.participation, row.homework, row.unitExam, row.total, row.notes || ""];
      values.forEach((value, index) => {
        const right = edges[index];
        const left = edges[index + 1];
        const cellWidth = right - left;
        if (index === 1 || index === 7) {
          text(context, value, right - 8, y + rowHeight / 2, {
            size: index === 1 ? Math.min(17, rowHeight * 0.39) : Math.min(13, rowHeight * 0.31),
            minSize: index === 1 ? 9 : 8,
            weight: index === 1 ? 900 : 700,
            color: index === 1 ? "#153c49" : "#526c77",
            maxWidth: cellWidth - 16,
          });
        } else {
          text(context, value, (right + left) / 2, y + rowHeight / 2, {
            size: Math.min(15, rowHeight * 0.34),
            minSize: 8,
            weight: index === 6 ? 900 : 700,
            color: index === 6 ? "#0f5c69" : "#31515d",
            align: "center",
            maxWidth: cellWidth - 8,
          });
        }
      });
    });
    context.restore();
  }

  footer(context, options.portalName, `${options.className} — ${options.unitLabel}`, `تم إدراج ${options.rows.length} من ${options.rows.length} طالبًا`);
  return canvas;
}
'''

HELPER.write_text(helper, encoding='utf-8')


def replace_function(text: str, signature: str, replacement: str) -> str:
    start = text.find(signature)
    if start < 0:
        raise SystemExit(f'missing signature: {signature}')
    brace = text.find('{', start)
    if brace < 0:
        raise SystemExit(f'missing opening brace: {signature}')
    depth = 0
    i = brace
    in_string = None
    escape = False
    template_depth = 0
    while i < len(text):
        ch = text[i]
        if in_string:
            if escape:
                escape = False
            elif ch == '\\':
                escape = True
            elif ch == in_string:
                in_string = None
            i += 1
            continue
        if ch in ('"', "'", '`'):
            in_string = ch
            i += 1
            continue
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                return text[:start] + replacement + text[i+1:]
        i += 1
    raise SystemExit(f'unclosed function: {signature}')

att = ATT.read_text(encoding='utf-8')
if 'class-pdf-canvas' not in att:
    att = att.replace('import { jsPDF } from "jspdf";\n', 'import { jsPDF } from "jspdf";\nimport { renderAttendanceClassCanvas } from "../../../lib/class-pdf-canvas";\n')
att_fn = r'''  async function downloadAttendancePdf() {
    const rows = reportRows();
    if (!selectedClass || !rows.length) return setMessage("الفصل ظاهر في الجدول، لكن لا توجد له أسماء طلاب مسجلة بعد.");
    setMessage(`جارٍ إنشاء PDF واضح لـ ${rows.length} طالبًا...`);
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      const canvas = renderAttendanceClassCanvas({
        portalName: PORTAL_NAME,
        teacherName,
        subject,
        className: selectedClass,
        date: selectedDate,
        hijriDate: formatHijri(selectedDate),
        rows: rows.map(row => ({ number: row.number, name: row.name, status: row.status })),
        counts,
      });
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.96), "JPEG", 0, 0, 297, 210, undefined, "FAST");
      pdf.save(`تحضير-${safeFile(selectedClass)}-${selectedDate}.pdf`);
      setMessage(`تم تنزيل التحضير كاملًا: ${rows.length} طالبًا في صفحة واحدة.`);
    } catch (error) {
      console.error("attendance-direct-canvas-pdf", error);
      setMessage("تعذر إنشاء PDF الآن. حدّث الصفحة ثم أعد المحاولة.");
    }
  }'''
att = replace_function(att, '  async function downloadAttendancePdf()', att_fn)
att = replace_function(att, '  function printAdminReport()', '  function printAdminReport() {\n    void downloadAttendancePdf();\n  }')
if 'html2canvas(' not in att:
    att = att.replace('import html2canvas from "html2canvas";\n', '')
att = att.replace('تحميل PDF صفحة واحدة — كل الطلاب', 'تحميل PDF واضح — صفحة واحدة')
ATT.write_text(att, encoding='utf-8')

grd = GRD.read_text(encoding='utf-8')
if 'class-pdf-canvas' not in grd:
    grd = grd.replace('import { jsPDF } from "jspdf";\n', 'import { jsPDF } from "jspdf";\nimport { renderGradesClassCanvas } from "../../../lib/class-pdf-canvas";\n')
grd_fn = r'''  async function downloadGradesPdf() {
    if (!classStudents.length) return setMessage("اختر فصلًا يحتوي على طلاب أولًا");
    setMessage(`جارٍ إنشاء سجل واضح لـ ${classStudents.length} طالبًا...`);
    const allRows = classStudents.map((student, index) => {
      const row = grades[student.id] || emptyGrade;
      return {
        number: index + 1,
        name: student.name,
        attendance: row.attendance,
        participation: row.participation,
        homework: row.homework,
        unitExam: row.unitExam,
        total: calculateUnitTotal(row),
        notes: row.notes || "",
      };
    });
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      const canvas = renderGradesClassCanvas({
        portalName: "بوابة أستاذ لحوني التعليمية",
        teacherName: session.teacherName || "",
        subject: session.subject || "المادة",
        stage: session.activeGradeLabel || "",
        className: selectedClass,
        unitLabel: unitInfo.label,
        examLabel: unitInfo.examLabel,
        rows: allRows,
      });
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.96), "JPEG", 0, 0, 297, 210, undefined, "FAST");
      pdf.save(`درجات-${selectedClass}-${unitInfo.label}.pdf`);
      setMessage(`تم تنزيل سجل الدرجات كاملًا: ${allRows.length} طالبًا في صفحة واحدة.`);
    } catch (error) {
      console.error("grades-direct-canvas-pdf", error);
      setMessage("تعذر إنشاء PDF الآن. حدّث الصفحة ثم أعد المحاولة.");
    }
  }'''
grd = replace_function(grd, '  async function downloadGradesPdf()', grd_fn)
if 'html2canvas(' not in grd:
    grd = grd.replace('import html2canvas from "html2canvas";\n', '')
grd = grd.replace('📄 PDF صفحة واحدة — كل الطلاب', '📄 PDF واضح — صفحة واحدة')
GRD.write_text(grd, encoding='utf-8')

sw = SW.read_text(encoding='utf-8')
import re
sw = re.sub(r'const CACHE_NAME = "[^"]+";', 'const CACHE_NAME = "ostadh-lahooni-v82-direct-canvas-pdf";', sw, count=1)
SW.write_text(sw, encoding='utf-8')

print('patched attendance + grades to direct canvas PDF and bumped cache')
