"use client";

export type AttendancePageRow = { number: number; name: string; status: string };
export type GradePageRow = {
  number: number;
  name: string;
  attendance: number | string;
  participation: number | string;
  homework: number | string;
  unitExam: number | string;
  total: number | string;
  notes: string;
};

type AttendanceOptions = {
  portalName: string;
  teacherName: string;
  subject: string;
  className: string;
  date: string;
  hijriDate: string;
  rows: AttendancePageRow[];
  counts: { present: number; absent: number; late: number; excused: number; escaped: number };
  accentColor?: string;
};

type GradesOptions = {
  portalName: string;
  teacherName?: string;
  subject: string;
  stage: string;
  className: string;
  unitLabel: string;
  examLabel: string;
  rows: GradePageRow[];
};

const WIDTH = 1600;
const HEIGHT = 1131;
const ATTENDANCE_ROWS_PER_PAGE = 18;
const GRADES_ROWS_PER_PAGE = 16;
const FONT = "Tajawal, Arial, sans-serif";

function chunks<T>(items: T[], size: number) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
}

function createCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_context_unavailable");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.textBaseline = "middle";
  ctx.direction = "rtl";
  return { canvas, ctx };
}

function font(ctx: CanvasRenderingContext2D, size: number, weight = 700) {
  ctx.font = `${weight} ${size}px ${FONT}`;
}

function fitSize(ctx: CanvasRenderingContext2D, value: string, maxWidth: number, preferred: number, minimum: number, weight = 700) {
  let size = preferred;
  while (size > minimum) {
    font(ctx, size, weight);
    if (ctx.measureText(value).width <= maxWidth) break;
    size -= 0.5;
  }
  return size;
}

function text(ctx: CanvasRenderingContext2D, value: unknown, x: number, y: number, options: { size?: number; min?: number; weight?: number; color?: string; align?: CanvasTextAlign; maxWidth?: number } = {}) {
  const raw = String(value ?? "");
  const size = options.maxWidth ? fitSize(ctx, raw, options.maxWidth, options.size ?? 18, options.min ?? 12, options.weight ?? 700) : (options.size ?? 18);
  font(ctx, size, options.weight ?? 700);
  ctx.fillStyle = options.color ?? "#173b49";
  ctx.textAlign = options.align ?? "right";
  ctx.fillText(raw, x, y);
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color = "#d6e2e6", width = 1.3) {
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
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function reportHeader(ctx: CanvasRenderingContext2D, title: string, portalName: string, subtitle: string, pageIndex: number, pageCount: number, accentColor = "#0e4b59") {
  rounded(ctx, 28, 22, WIDTH - 56, 104, 20, accentColor);
  text(ctx, portalName, WIDTH - 56, 48, { size: 17, weight: 900, color: "#d8edf1", maxWidth: 560 });
  text(ctx, subtitle, WIDTH - 56, 83, { size: 26, min: 18, weight: 900, color: "#ffffff", maxWidth: 620 });
  text(ctx, title, 56, 78, { size: 31, min: 24, weight: 900, color: "#ffffff", align: "left", maxWidth: 610 });
  rounded(ctx, 54, 37, 170, 34, 17, "#f5c34f");
  text(ctx, `الصفحة ${pageIndex + 1} من ${pageCount}`, 139, 54, { size: 15, weight: 900, color: "#173b49", align: "center" });
}

function meta(ctx: CanvasRenderingContext2D, items: Array<{ label: string; value: string }>, y: number) {
  const margin = 28;
  const gap = 10;
  const width = (WIDTH - margin * 2 - gap * (items.length - 1)) / items.length;
  items.forEach((item, index) => {
    const x = WIDTH - margin - width - index * (width + gap);
    rounded(ctx, x, y, width, 66, 12, "#f7fafb", "#cfdee3");
    text(ctx, item.label, x + width - 13, y + 20, { size: 13, weight: 800, color: "#71868e", maxWidth: width - 26 });
    text(ctx, item.value || "—", x + width - 13, y + 45, { size: 17, min: 12, weight: 900, maxWidth: width - 26 });
  });
}

function footer(ctx: CanvasRenderingContext2D, left: string, center: string, right: string) {
  const y = HEIGHT - 32;
  line(ctx, 28, y - 16, WIDTH - 28, y - 16, "#b9cbd1", 1.5);
  text(ctx, left, 28, y, { size: 13, weight: 900, color: "#2d5662", align: "left", maxWidth: 500 });
  text(ctx, center, WIDTH / 2, y, { size: 13, weight: 800, color: "#647b84", align: "center", maxWidth: 500 });
  text(ctx, right, WIDTH - 28, y, { size: 13, weight: 900, color: "#0d6b52", maxWidth: 520 });
}

function statusStyle(status: string) {
  if (status === "حاضر") return { fill: "#dff4e7", color: "#13643d" };
  if (status === "غائب") return { fill: "#fde6e9", color: "#a72c39" };
  if (status === "متأخر") return { fill: "#fff0c9", color: "#8a5a05" };
  if (status === "مستأذن") return { fill: "#e3edff", color: "#2457a1" };
  return { fill: "#eee4ff", color: "#6239a4" };
}

export function renderAttendancePdfPages(options: AttendanceOptions) {
  const pages = chunks(options.rows, ATTENDANCE_ROWS_PER_PAGE);
  return pages.map((pageRows, pageIndex) => {
    const { canvas, ctx } = createCanvas();
    reportHeader(ctx, "تقرير الحضور اليومي", options.portalName, "سجل الحضور والمتابعة اليومية", pageIndex, pages.length, options.accentColor || "#0e4b59");
    meta(ctx, [
      { label: "المعلم", value: options.teacherName },
      { label: "المادة", value: options.subject },
      { label: "الفصل", value: options.className },
      { label: "التاريخ", value: options.date },
      { label: "الهجري", value: options.hijriDate },
    ], 142);

    const summaryY = 220;
    const summaryItems = [
      ["إجمالي الفصل", options.rows.length, "#edf4f6", "#173b49"],
      ["حاضر", options.counts.present, "#e0f3e7", "#13643d"],
      ["غائب", options.counts.absent, "#fde6e9", "#a72c39"],
      ["متأخر", options.counts.late, "#fff0c9", "#8a5a05"],
      ["مستأذن", options.counts.excused, "#e3edff", "#2457a1"],
      ["هروب", options.counts.escaped, "#eee4ff", "#6239a4"],
    ] as const;
    const gap = 10;
    const boxW = (WIDTH - 56 - gap * 5) / 6;
    summaryItems.forEach(([label, value, fill, color], index) => {
      const x = WIDTH - 28 - boxW - index * (boxW + gap);
      rounded(ctx, x, summaryY, boxW, 58, 12, fill, "#d5e2e7");
      text(ctx, value, x + boxW / 2, summaryY + 20, { size: 21, weight: 900, color, align: "center" });
      text(ctx, label, x + boxW / 2, summaryY + 43, { size: 13, weight: 900, color, align: "center" });
    });

    const top = 296;
    const bottom = HEIGHT - 62;
    const x = 28;
    const w = WIDTH - 56;
    const headerH = 44;
    const rowH = Math.floor((bottom - top - headerH) / ATTENDANCE_ROWS_PER_PAGE);
    const numberW = 105;
    const statusW = 260;
    const nameW = w - numberW - statusW;
    rounded(ctx, x, top, w, bottom - top, 12, "#ffffff", "#bfd1d7");
    ctx.fillStyle = options.accentColor || "#174b59";
    ctx.fillRect(x, top, w, headerH);
    text(ctx, "م", x + w - numberW / 2, top + headerH / 2, { size: 16, weight: 900, color: "#ffffff", align: "center" });
    text(ctx, "اسم الطالب", x + statusW + nameW / 2, top + headerH / 2, { size: 17, weight: 900, color: "#ffffff", align: "center" });
    text(ctx, "الحالة", x + statusW / 2, top + headerH / 2, { size: 16, weight: 900, color: "#ffffff", align: "center" });
    line(ctx, x + statusW, top, x + statusW, bottom);
    line(ctx, x + statusW + nameW, top, x + statusW + nameW, bottom);

    pageRows.forEach((row, index) => {
      const y = top + headerH + index * rowH;
      ctx.fillStyle = index % 2 ? "#f6fafb" : "#ffffff";
      ctx.fillRect(x, y, w, rowH);
      line(ctx, x, y + rowH, x + w, y + rowH);
      text(ctx, row.number, x + w - numberW / 2, y + rowH / 2, { size: 17, weight: 900, align: "center" });
      text(ctx, row.name, x + w - numberW - 18, y + rowH / 2, { size: 18, min: 13, weight: 900, maxWidth: nameW - 36 });
      const style = statusStyle(row.status);
      rounded(ctx, x + 55, y + 7, statusW - 110, rowH - 14, (rowH - 14) / 2, style.fill);
      text(ctx, row.status, x + statusW / 2, y + rowH / 2, { size: 15, weight: 900, color: style.color, align: "center", maxWidth: statusW - 130 });
    });

    footer(ctx, options.portalName, `${options.className} — ${options.date}`, `طلاب الصفحة: ${pageRows.length} | إجمالي الفصل: ${options.rows.length}`);
    return canvas;
  });
}

export function renderGradesPdfPages(options: GradesOptions) {
  const pages = chunks(options.rows, GRADES_ROWS_PER_PAGE);
  return pages.map((pageRows, pageIndex) => {
    const { canvas, ctx } = createCanvas();
    reportHeader(ctx, "سجل رصد الدرجات", options.portalName, options.unitLabel, pageIndex, pages.length);
    meta(ctx, [
      { label: "المعلم", value: options.teacherName || "—" },
      { label: "المادة", value: options.subject },
      { label: "المرحلة", value: options.stage },
      { label: "الفصل", value: options.className },
      { label: "إجمالي الطلاب", value: String(options.rows.length) },
    ], 142);

    const top = 226;
    const bottom = HEIGHT - 62;
    const x = 28;
    const w = WIDTH - 56;
    const headerH = 46;
    const rowH = Math.floor((bottom - top - headerH) / GRADES_ROWS_PER_PAGE);
    const ratios = [0.055, 0.31, 0.09, 0.10, 0.09, 0.105, 0.09, 0.16];
    const labels = ["م", "اسم الطالب", "حضور", "مشاركة", "واجب", options.examLabel.replace(/^اختبار\s*/, "") || "اختبار", "المجموع", "ملاحظات"];
    const widths = ratios.map((ratio, index) => index === ratios.length - 1 ? 0 : Math.round(w * ratio));
    widths[widths.length - 1] = w - widths.slice(0, -1).reduce((sum, value) => sum + value, 0);
    const edges = [x + w];
    widths.forEach(width => edges.push(edges[edges.length - 1] - width));

    rounded(ctx, x, top, w, bottom - top, 12, "#ffffff", "#bfd1d7");
    ctx.fillStyle = "#174b59";
    ctx.fillRect(x, top, w, headerH);
    labels.forEach((label, index) => {
      const right = edges[index];
      const left = edges[index + 1];
      text(ctx, label, (right + left) / 2, top + headerH / 2, { size: 15, min: 11, weight: 900, color: "#ffffff", align: "center", maxWidth: right - left - 10 });
      if (index > 0) line(ctx, right, top, right, bottom);
    });

    pageRows.forEach((row, rowIndex) => {
      const y = top + headerH + rowIndex * rowH;
      ctx.fillStyle = rowIndex % 2 ? "#f6fafb" : "#ffffff";
      ctx.fillRect(x, y, w, rowH);
      line(ctx, x, y + rowH, x + w, y + rowH);
      const values: Array<string | number> = [row.number, row.name, row.attendance, row.participation, row.homework, row.unitExam, row.total, row.notes || ""];
      values.forEach((value, index) => {
        const right = edges[index];
        const left = edges[index + 1];
        const cellW = right - left;
        if (index === 1) {
          text(ctx, value, right - 12, y + rowH / 2, { size: 17, min: 13, weight: 900, maxWidth: cellW - 24 });
        } else if (index === 7) {
          text(ctx, value, right - 10, y + rowH / 2, { size: 14, min: 11, weight: 700, color: "#526c77", maxWidth: cellW - 20 });
        } else {
          text(ctx, value, (right + left) / 2, y + rowH / 2, { size: 15, min: 12, weight: index === 6 ? 900 : 700, color: index === 6 ? "#0f5c69" : "#31515d", align: "center", maxWidth: cellW - 10 });
        }
      });
    });

    footer(ctx, options.portalName, `${options.className} — ${options.unitLabel}`, `طلاب الصفحة: ${pageRows.length} | إجمالي الفصل: ${options.rows.length}`);
    return canvas;
  });
}
