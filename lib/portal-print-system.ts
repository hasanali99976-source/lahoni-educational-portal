"use client";

export const PRINT_WIDTH = 1680;
export const PRINT_HEIGHT = 1188;
export const PRINT_ACCENTS = ["#0b675f", "#365b94", "#71509a", "#9a5c39", "#3b785d", "#8a681e", "#8b4560", "#4a6689"];
export const PRINT_INK = "#173d45";
export const PRINT_MUTED = "#647b80";
export const STUDENT_NAME_FONT_SIZE = 13;
export const STUDENT_NAME_FONT_WEIGHT = 800;

export function portalPrintFont() {
  if (typeof window !== "undefined" && typeof document !== "undefined" && document.body) {
    return getComputedStyle(document.body).fontFamily || "Alexandria, Arial, sans-serif";
  }
  return "Alexandria, Arial, sans-serif";
}

export function createPrintCanvas(width = PRINT_WIDTH, height = PRINT_HEIGHT) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("portal_print_canvas_unavailable");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.textBaseline = "middle";
  ctx.direction = "rtl";
  return { canvas, ctx };
}

export function setPrintFont(ctx: CanvasRenderingContext2D, size: number, weight = 700) {
  ctx.font = `${weight} ${size}px ${portalPrintFont()}`;
}

export function fitPrintSize(ctx: CanvasRenderingContext2D, value: string, maxWidth: number, preferred: number, min: number, weight = 700) {
  let size = preferred;
  while (size > min) {
    setPrintFont(ctx, size, weight);
    if (ctx.measureText(value).width <= maxWidth) break;
    size -= 0.5;
  }
  return size;
}

export function ellipsizeFixed(ctx: CanvasRenderingContext2D, value: string, maxWidth: number, size = STUDENT_NAME_FONT_SIZE, weight = STUDENT_NAME_FONT_WEIGHT) {
  const raw = String(value || "").replace(/\s+/g, " ").trim();
  setPrintFont(ctx, size, weight);
  if (!maxWidth || ctx.measureText(raw).width <= maxWidth) return raw;
  const suffix = "…";
  let out = raw;
  while (out.length > 2 && ctx.measureText(`${out}${suffix}`).width > maxWidth) out = out.slice(0, -1).trimEnd();
  return `${out}${suffix}`;
}

export function drawFixedText(
  ctx: CanvasRenderingContext2D,
  value: unknown,
  x: number,
  y: number,
  options: { size?: number; weight?: number; color?: string; align?: CanvasTextAlign; maxWidth?: number; ellipsis?: boolean } = {},
) {
  const raw = String(value ?? "");
  const size = options.size ?? 18;
  const weight = options.weight ?? 700;
  setPrintFont(ctx, size, weight);
  ctx.fillStyle = options.color ?? PRINT_INK;
  ctx.textAlign = options.align ?? "right";
  const shown = options.maxWidth && options.ellipsis !== false ? ellipsizeFixed(ctx, raw, options.maxWidth, size, weight) : raw;
  ctx.fillText(shown, x, y);
}

export function drawFittedText(
  ctx: CanvasRenderingContext2D,
  value: unknown,
  x: number,
  y: number,
  options: { size?: number; min?: number; weight?: number; color?: string; align?: CanvasTextAlign; maxWidth?: number } = {},
) {
  const raw = String(value ?? "");
  const weight = options.weight ?? 700;
  const size = options.maxWidth ? fitPrintSize(ctx, raw, options.maxWidth, options.size ?? 18, options.min ?? 10, weight) : (options.size ?? 18);
  setPrintFont(ctx, size, weight);
  ctx.fillStyle = options.color ?? PRINT_INK;
  ctx.textAlign = options.align ?? "right";
  ctx.fillText(raw, x, y);
}

export function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
}

export function printLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color = "#d7e2df", width = 1.2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

export async function loadPortalPrintLogo(src = "/icons/lahooni-identity-320.jpg") {
  return new Promise<HTMLImageElement | null>(resolve => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

export function drawImageContain(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, w: number, h: number, padding = 0) {
  const iw = image.naturalWidth || image.width || 1;
  const ih = image.naturalHeight || image.height || 1;
  const aw = Math.max(1, w - padding * 2);
  const ah = Math.max(1, h - padding * 2);
  const scale = Math.min(aw / iw, ah / ih);
  const rw = iw * scale;
  const rh = ih * scale;
  const rx = x + (w - rw) / 2;
  const ry = y + (h - rh) / 2;
  ctx.drawImage(image, rx, ry, rw, rh);
}

export function ensurePrintFontsReady() {
  if (typeof document !== "undefined" && document.fonts?.ready) return document.fonts.ready;
  return Promise.resolve();
}
