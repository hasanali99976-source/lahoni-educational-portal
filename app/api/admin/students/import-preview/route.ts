import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import pdfParse from "pdf-parse";
import { requireSession } from "../../../../../lib/server/portal-auth";

type PreviewRow = { name: string; grade?: number; section?: string; source: string };

const arabicDigits: Record<string, string> = { "٠":"0","١":"1","٢":"2","٣":"3","٤":"4","٥":"5","٦":"6","٧":"7","٨":"8","٩":"9" };
function latin(value: unknown) { return String(value ?? "").replace(/[٠-٩]/g, digit => arabicDigits[digit] || digit).trim(); }
function cleanName(value: unknown) {
  return String(value ?? "").replace(/^\s*[\d٠-٩]+\s*[-.)،:]?\s*/, "").replace(/\s+/g, " ").trim();
}
function gradeFrom(value: unknown): number | undefined {
  const text = latin(value).toLowerCase();
  if (/\b1\b/.test(text) || text.includes("الأول") || text.includes("اول") || text.includes("first")) return 1;
  if (/\b2\b/.test(text) || text.includes("الثاني") || text.includes("ثاني") || text.includes("second")) return 2;
  if (/\b3\b/.test(text) || text.includes("الثالث") || text.includes("ثالث") || text.includes("third")) return 3;
  return undefined;
}
function sectionFrom(value: unknown): string | undefined {
  const text = latin(value);
  const match = text.match(/(?:فصل|شعبة|section)?\s*([1-8])\b/i);
  return match?.[1];
}
function looksLikeName(value: string) {
  if (value.length < 3 || value.length > 90) return false;
  if (/^(اسم|الاسم|اسم الطالب|الطالب|name|student)$/i.test(value)) return false;
  if (/^(الصف|الفصل|الشعبة|الرقم|السجل|الهوية|م)$/i.test(value)) return false;
  if (/^[\d\s./-]+$/.test(latin(value))) return false;
  return /[\u0600-\u06ffA-Za-z]/.test(value);
}
function uniqueRows(rows: PreviewRow[]) {
  const seen = new Set<string>();
  return rows.filter(row => {
    const key = `${row.name.replace(/\s+/g, " ").toLowerCase()}|${row.grade || ""}|${row.section || ""}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).slice(0, 1200);
}

function spreadsheetRows(buffer: Buffer): PreviewRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const output: PreviewRow[] = [];
  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
    if (!rows.length) return;
    const first = rows.slice(0, 8);
    let headerIndex = -1; let nameCol = -1; let gradeCol = -1; let sectionCol = -1;
    first.forEach((row, index) => {
      if (headerIndex >= 0 || !Array.isArray(row)) return;
      row.forEach((cell, column) => {
        const text = String(cell || "").trim().toLowerCase();
        if (nameCol < 0 && (text.includes("اسم الطالب") || text === "الاسم" || text === "اسم" || text.includes("student name"))) { headerIndex = index; nameCol = column; }
      });
    });
    if (headerIndex >= 0) {
      const header = rows[headerIndex] as unknown[];
      header.forEach((cell, column) => {
        const text = String(cell || "").trim().toLowerCase();
        if (gradeCol < 0 && (text.includes("الصف") || text.includes("grade"))) gradeCol = column;
        if (sectionCol < 0 && (text.includes("الفصل") || text.includes("الشعبة") || text.includes("section"))) sectionCol = column;
      });
    }
    const sourceRows = rows.slice(headerIndex >= 0 ? headerIndex + 1 : 0);
    sourceRows.forEach(raw => {
      if (!Array.isArray(raw)) return;
      let name = nameCol >= 0 ? cleanName(raw[nameCol]) : "";
      if (!name) {
        const candidates = raw.map(cleanName).filter(looksLikeName).sort((a, b) => b.length - a.length);
        name = candidates[0] || "";
      }
      if (!looksLikeName(name)) return;
      output.push({
        name,
        grade: gradeCol >= 0 ? gradeFrom(raw[gradeCol]) : raw.map(gradeFrom).find(Boolean),
        section: sectionCol >= 0 ? sectionFrom(raw[sectionCol]) : undefined,
        source: sheetName,
      });
    });
  });
  return uniqueRows(output);
}

function pdfRows(buffer: Buffer): Promise<PreviewRow[]> {
  return pdfParse(buffer).then(result => {
    const rows: PreviewRow[] = [];
    String(result.text || "").split(/\r?\n/).forEach((line, index) => {
      const normalized = line.replace(/\t/g, "  ").replace(/\s+/g, " ").trim();
      if (!normalized || normalized.length < 3) return;
      if (/اسم الطالب|قائمة الطلاب|كشف الطلاب|الصف|الفصل|الشعبة/.test(normalized) && normalized.length < 35) return;
      const parts = normalized.split(/\s{2,}|[,،;|]/).map(cleanName).filter(Boolean);
      const candidates = (parts.length ? parts : [cleanName(normalized)]).filter(looksLikeName).sort((a, b) => b.length - a.length);
      const name = candidates[0] || "";
      if (!looksLikeName(name)) return;
      rows.push({ name, grade: gradeFrom(normalized), section: sectionFrom(normalized), source: `PDF-${index + 1}` });
    });
    return uniqueRows(rows);
  });
}

export async function POST(request: Request) {
  const session = await requireSession("admin");
  if (!session) return NextResponse.json({ ok: false, message: "غير مصرح" }, { status: 401 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ ok: false, message: "اختر ملفًا صالحًا" }, { status: 400 });
    if (file.size > 12 * 1024 * 1024) return NextResponse.json({ ok: false, message: "حجم الملف أكبر من 12MB" }, { status: 413 });
    const name = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());
    let rows: PreviewRow[] = [];
    if (name.endsWith(".pdf") || file.type === "application/pdf") rows = await pdfRows(buffer);
    else if (/\.(xlsx|xls|csv)$/.test(name)) rows = spreadsheetRows(buffer);
    else return NextResponse.json({ ok: false, message: "الصيغ المدعومة: Excel وCSV وPDF" }, { status: 400 });
    if (!rows.length) return NextResponse.json({ ok: false, message: "لم أجد أسماء واضحة في الملف. جرّب ملفًا يحتوي عمود اسم الطالب أو PDF نصي واضح." }, { status: 422 });
    return NextResponse.json({ ok: true, total: rows.length, rows, fileName: file.name }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("admin roster preview failed", error);
    return NextResponse.json({ ok: false, message: "تعذر تحليل الملف الآن" }, { status: 500 });
  }
}
