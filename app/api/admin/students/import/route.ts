import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import pdfParse from "pdf-parse";
import { adminDb } from "../../../../../lib/server/firebase-admin";
import { requireSession } from "../../../../../lib/server/portal-auth";
import {
  SCHOOL_CLASSES_COLLECTION,
  SCHOOL_STUDENTS_COLLECTION,
  canonicalClassName,
  classId,
  clean,
  gradeNumber,
  nextStudentCode,
  normalizeArabic,
  normalizeStudentRecord,
  sectionNumber,
  studentIdentity,
  westernDigits,
  type SchoolStudent,
} from "../../../../../lib/school-roster";

export const runtime = "nodejs";

type ImportRow = { name: string; grade: number | null; section: string; code?: string; source?: string };

const NAME_KEYS = ["اسم الطالب", "الاسم", "الطالب", "اسم", "student name", "student", "name"];
const GRADE_KEYS = ["الصف", "المرحلة", "الصف الدراسي", "grade", "level"];
const SECTION_KEYS = ["الفصل", "الشعبة", "الفصل الدراسي", "section", "class"];
const CODE_KEYS = ["الكود", "رمز الطالب", "رقم الطالب", "الهوية", "السجل المدني", "code", "id", "student id"];

function normalizedKey(value: unknown) {
  return normalizeArabic(value).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function pickValue(row: Record<string, unknown>, keys: string[]) {
  const entries = Object.entries(row);
  for (const wanted of keys) {
    const normalizedWanted = normalizedKey(wanted);
    const found = entries.find(([key]) => normalizedKey(key) === normalizedWanted || normalizedKey(key).includes(normalizedWanted));
    if (found && clean(found[1])) return found[1];
  }
  return "";
}

function normalizeCode(value: unknown) {
  const raw = westernDigits(value).toUpperCase().replace(/\s+/g, "");
  return /^TH[123]\d{3}$/.test(raw) ? raw : "";
}

function rowFromObject(row: Record<string, unknown>, defaultGrade: number | null, defaultSection: string): ImportRow | null {
  const name = clean(pickValue(row, NAME_KEYS));
  if (!name) return null;
  const grade = gradeNumber(pickValue(row, GRADE_KEYS)) || defaultGrade;
  const section = sectionNumber(pickValue(row, SECTION_KEYS)) || defaultSection;
  return { name, grade, section, code: normalizeCode(pickValue(row, CODE_KEYS)), source: "sheet" };
}

function looksLikePersonName(value: string) {
  const text = clean(value);
  if (text.length < 5 || text.length > 90) return false;
  if (/وزارة|مدرسة|قائمة|كشف|الصف|الفصل|الشعبة|اسم الطالب|الإدارة|التعليم|التاريخ|المادة|الرقم|صفحة/.test(text)) return false;
  const words = text.split(/\s+/).filter(Boolean);
  const arabicWords = words.filter(word => /[\u0600-\u06FF]/.test(word));
  return arabicWords.length >= 2;
}

function rowsFromPdfText(text: string, defaultGrade: number | null, defaultSection: string) {
  const rows: ImportRow[] = [];
  const seen = new Set<string>();
  text.split(/\r?\n/).forEach(rawLine => {
    let line = clean(rawLine)
      .replace(/^[\s\-–—|:؛،,.]*[٠-٩۰-۹\d]{1,4}[\s\-–—|:؛،.)]+/, "")
      .replace(/\bTH[123]\d{3}\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!line) return;

    let grade = defaultGrade;
    let section = defaultSection;
    const gradeMatch = line.match(/(?:الصف\s*)?(الأول|الاول|الثاني|الثالث|[١٢٣123])\s*(?:الثانوي)?/);
    if (!grade && gradeMatch) grade = gradeNumber(gradeMatch[1]);
    const sectionMatch = line.match(/(?:الفصل|الشعبة)\s*[:\-]?\s*([٠-٩۰-۹\d]+)/);
    if (!section && sectionMatch) section = sectionNumber(sectionMatch[1]);
    line = line.replace(/(?:الصف\s*)?(الأول|الاول|الثاني|الثالث|[١٢٣123])\s*(?:الثانوي)?/g, "").replace(/(?:الفصل|الشعبة)\s*[:\-]?\s*[٠-٩۰-۹\d]+/g, "").trim();
    if (!looksLikePersonName(line)) return;
    const key = normalizeArabic(line);
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({ name: line, grade, section, source: "pdf" });
  });
  return rows;
}

async function previewFile(file: File, defaultGrade: number | null, defaultSection: string) {
  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    const parsed = await pdfParse(buffer);
    return rowsFromPdfText(parsed.text || "", defaultGrade, defaultSection);
  }

  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  const objects = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
  return objects.map(row => rowFromObject(row, defaultGrade, defaultSection)).filter((row): row is ImportRow => !!row);
}

async function importRows(rows: ImportRow[]) {
  const database = adminDb();
  const existingSnapshot = await database.collection(SCHOOL_STUDENTS_COLLECTION).get();
  const existing = existingSnapshot.docs
    .map(document => normalizeStudentRecord(document.data() as Record<string, unknown>, document.id))
    .filter((student): student is SchoolStudent => !!student);
  const identities = new Set(existing.map(studentIdentity));
  const usedStudents: Array<Pick<SchoolStudent, "code">> = existing.map(student => ({ code: student.code }));
  const imported: SchoolStudent[] = [];
  const skipped: Array<{ name: string; reason: string }> = [];

  for (const raw of rows.slice(0, 1200)) {
    const name = clean(raw.name);
    const grade = gradeNumber(raw.grade);
    const section = sectionNumber(raw.section);
    if (!name || !grade || !section) {
      skipped.push({ name: name || "سطر غير معروف", reason: "الصف أو الفصل غير محدد" });
      continue;
    }
    const identity = studentIdentity({ name, grade, section });
    if (identities.has(identity)) {
      skipped.push({ name, reason: "الطالب موجود مسبقًا في نفس الصف والفصل" });
      continue;
    }
    let code = normalizeCode(raw.code);
    if (!code || usedStudents.some(item => item.code === code)) code = nextStudentCode(usedStudents, grade);
    if (!code) {
      skipped.push({ name, reason: "تعذر إنشاء كود طالب جديد" });
      continue;
    }
    const student: SchoolStudent = { id: code, code, name, grade, section, className: canonicalClassName(grade, section), active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    imported.push(student);
    identities.add(identity);
    usedStudents.push({ code });
  }

  for (let index = 0; index < imported.length; index += 350) {
    const group = imported.slice(index, index + 350);
    const batch = database.batch();
    const classMap = new Map<string, { grade: number; section: string }>();
    group.forEach(student => classMap.set(classId(student.grade, student.section), { grade: student.grade, section: student.section }));
    classMap.forEach(({ grade, section }, id) => {
      batch.set(database.collection(SCHOOL_CLASSES_COLLECTION).doc(id), { id, grade, section, name: canonicalClassName(grade, section), active: true, updatedAt: new Date().toISOString() }, { merge: true });
    });
    group.forEach(student => {
      batch.set(database.collection(SCHOOL_STUDENTS_COLLECTION).doc(student.code), {
        ...student,
        accessCode: student.code,
        studentCode: student.code,
        class: student.className,
        rosterActive: true,
      }, { merge: true });
    });
    await batch.commit();
  }

  return { imported, skipped };
}

export async function POST(request: Request) {
  const session = await requireSession("admin");
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await request.json().catch(() => ({}));
      const rows = Array.isArray(body.rows) ? body.rows as ImportRow[] : [];
      if (!rows.length) return NextResponse.json({ ok: false, message: "لا توجد صفوف صالحة للاستيراد." }, { status: 400 });
      const result = await importRows(rows);
      return NextResponse.json({ ok: true, imported: result.imported.length, skipped: result.skipped.length, skippedRows: result.skipped.slice(0, 100), students: result.imported });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ ok: false, message: "اختر ملف القائمة أولًا." }, { status: 400 });
    const defaultGrade = gradeNumber(form.get("defaultGrade"));
    const defaultSection = sectionNumber(form.get("defaultSection"));
    const extension = file.name.toLowerCase();
    if (!/\.(xlsx|xls|csv|pdf)$/.test(extension)) return NextResponse.json({ ok: false, message: "الصيغ المدعومة: Excel وCSV وPDF." }, { status: 400 });
    const rows = await previewFile(file, defaultGrade, defaultSection);
    if (!rows.length) return NextResponse.json({ ok: false, message: "لم أجد أسماء طلاب واضحة في الملف. جرّب تحديد الصف والفصل قبل الرفع أو استخدم Excel بأعمدة: اسم الطالب، الصف، الفصل." }, { status: 422 });
    return NextResponse.json({ ok: true, preview: true, fileName: file.name, rows: rows.slice(0, 1200), count: rows.length, needsGrade: rows.some(row => !row.grade), needsSection: rows.some(row => !row.section) });
  } catch (error) {
    console.error("student roster import failed", error);
    return NextResponse.json({ ok: false, message: "تعذر قراءة الملف الآن. تأكد أن الملف غير محمي وأن القائمة واضحة." }, { status: 500 });
  }
}
