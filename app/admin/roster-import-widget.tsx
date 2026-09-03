"use client";

import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import "./roster-import-widget.css";

type PreviewRow = {
  id: string;
  name: string;
  grade: number;
  section: string;
  className: string;
  status: "ready" | "duplicate" | "missing";
  note: string;
};

type ExistingStudent = { name?: string; grade?: number; section?: string; code?: string; className?: string };

const GRADES = [
  { value: 1, label: "الأول الثانوي" },
  { value: 2, label: "الثاني الثانوي" },
  { value: 3, label: "الثالث الثانوي" },
];
const SECTIONS = ["1", "2", "3", "4", "5", "6", "7", "8"];
const ar = new Intl.NumberFormat("ar-SA-u-nu-arab");

function normalizeDigits(value: unknown) {
  return String(value ?? "")
    .replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .trim();
}

function cleanName(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function gradeFrom(value: unknown) {
  const text = normalizeDigits(value).toLowerCase();
  if (!text) return 0;
  if (/^(1|اول|الأول|الاول)/.test(text)) return 1;
  if (/^(2|ثاني|الثاني)/.test(text)) return 2;
  if (/^(3|ثالث|الثالث)/.test(text)) return 3;
  const number = Number(text.match(/[123]/)?.[0] || 0);
  return number >= 1 && number <= 3 ? number : 0;
}

function sectionFrom(value: unknown) {
  const text = normalizeDigits(value);
  const match = text.match(/[1-8]/);
  return match?.[0] || "";
}

function classNameFor(grade: number, section: string) {
  return `${GRADES.find(item => item.value === grade)?.label || `الصف ${grade}`} - فصل ${section}`;
}

function valueFrom(row: Record<string, unknown>, names: string[]) {
  const keys = Object.keys(row);
  const key = keys.find(candidate => names.some(name => candidate.replace(/\s+/g, "").toLowerCase().includes(name.replace(/\s+/g, "").toLowerCase())));
  return key ? row[key] : undefined;
}

function decodePdfLiteral(value: string) {
  return value.replace(/\\([()\\])/g, "$1").replace(/\\n/g, " ").replace(/\\r/g, " ").replace(/\\[0-7]{1,3}/g, " ");
}

async function rowsFromFile(file: File) {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".pdf")) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const text = new TextDecoder("latin1").decode(bytes);
    const values = [...text.matchAll(/\(([^()]*(?:\\.[^()]*)*)\)\s*Tj/g)].map(match => decodePdfLiteral(match[1] || ""));
    const lines = values.map(cleanName).filter(value => value.length >= 3);
    return lines.map(name => ({ "اسم الطالب": name } as Record<string, unknown>));
  }
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  return workbook.SheetNames.flatMap(sheetName => XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName]!, { defval: "" }));
}

export default function RosterImportWidget() {
  const pathname = usePathname();
  const visible = pathname === "/admin/students";
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [overrideClass, setOverrideClass] = useState(true);
  const [grade, setGrade] = useState(1);
  const [section, setSection] = useState("1");
  const readyRows = useMemo(() => rows.filter(row => row.status === "ready"), [rows]);

  if (!visible) return null;

  async function loadExisting(): Promise<ExistingStudent[]> {
    const response = await fetch("/api/admin/students", { cache: "no-store" });
    if (!response.ok) throw new Error("تعذر قراءة القائمة الحالية");
    const data = await response.json().catch(() => ({}));
    return Array.isArray(data.students) ? data.students : [];
  }

  async function chooseFile(file?: File) {
    if (!file) return;
    setBusy(true); setMessage("جارٍ قراءة الملف وعرض المعاينة…"); setRows([]);
    try {
      const [source, existing] = await Promise.all([rowsFromFile(file), loadExisting()]);
      if (!source.length) throw new Error(file.name.toLowerCase().endsWith(".pdf") ? "تعذر استخراج أسماء واضحة من PDF. استخدم PDF نصيًا أو ملف Excel." : "الملف لا يحتوي صفوفًا قابلة للقراءة.");
      const existingKeys = new Set(existing.map(student => `${cleanName(student.name)}|${Number(student.grade || 0)}|${normalizeDigits(student.section)}`));
      const preview = source.map((raw, index) => {
        const name = cleanName(valueFrom(raw, ["اسم الطالب", "الطالب", "الاسم", "name", "student"]));
        const rowGrade = overrideClass ? grade : gradeFrom(valueFrom(raw, ["الصف", "grade", "المستوى"]));
        const rowSection = overrideClass ? section : sectionFrom(valueFrom(raw, ["الفصل", "section", "الشعبة", "class"]));
        const missing = name.length < 3 || !rowGrade || !rowSection;
        const duplicate = !missing && existingKeys.has(`${name}|${rowGrade}|${rowSection}`);
        return {
          id: `${index}-${name}`,
          name: name || "—",
          grade: rowGrade,
          section: rowSection,
          className: rowGrade && rowSection ? classNameFor(rowGrade, rowSection) : "—",
          status: missing ? "missing" as const : duplicate ? "duplicate" as const : "ready" as const,
          note: missing ? "بيانات ناقصة" : duplicate ? "موجود مسبقًا — لن يُستبدل" : "جاهز للإضافة",
        };
      });
      setRows(preview);
      setMessage(`تمت المعاينة: ${ar.format(preview.filter(row => row.status === "ready").length)} جاهز، ${ar.format(preview.filter(row => row.status === "duplicate").length)} مكرر، ${ar.format(preview.filter(row => row.status === "missing").length)} ناقص.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر قراءة الملف");
    } finally { setBusy(false); }
  }

  async function importReady() {
    if (!readyRows.length || busy) return;
    setBusy(true); setMessage("جارٍ إضافة الطلاب دون استبدال أي سجل موجود…");
    let saved = 0; let failed = 0;
    for (const row of readyRows) {
      try {
        const response = await fetch("/api/admin/students", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: row.name, grade: row.grade, section: row.section }), cache: "no-store" });
        if (response.ok) saved += 1;
        else {
          const data = await response.json().catch(() => ({}));
          if (String(data.message || "").includes("موجود مسبق")) saved += 0;
          else failed += 1;
        }
      } catch { failed += 1; }
    }
    setBusy(false);
    setMessage(`اكتمل الاستيراد: أضيف ${ar.format(saved)} طالبًا${failed ? `، وتعذر ${ar.format(failed)} سجلًا` : ""}. لم يتم استبدال أي طالب موجود.`);
    if (saved) window.setTimeout(() => window.location.reload(), 700);
  }

  async function exportExcel() {
    setBusy(true);
    try {
      const students = await loadExisting();
      const workbook = XLSX.utils.book_new();
      const classes = [...new Set(students.map(student => student.className || classNameFor(Number(student.grade || 0), normalizeDigits(student.section))).filter(Boolean))];
      classes.forEach(className => {
        const classRows = students.filter(student => (student.className || classNameFor(Number(student.grade || 0), normalizeDigits(student.section))) === className)
          .map((student, index) => ({ "م": index + 1, "اسم الطالب": student.name || "", "الكود": student.code || "", "الفصل": className }));
        const sheet = XLSX.utils.json_to_sheet(classRows);
        sheet["!cols"] = [{ wch: 6 }, { wch: 34 }, { wch: 14 }, { wch: 28 }];
        XLSX.utils.book_append_sheet(workbook, sheet, String(className).slice(0, 28) || "فصل");
      });
      XLSX.writeFile(workbook, "قوائم-طلاب-بوابة-أستاذ-لحوني.xlsx");
      setMessage("تم تجهيز Excel، وكل فصل في ورقة مستقلة.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "تعذر التصدير"); }
    finally { setBusy(false); }
  }

  return <aside className="roster-import-v105" dir="rtl">
    <button type="button" className="roster-import-launch" onClick={() => setOpen(true)}>رفع / استيراد القوائم</button>
    {open && <div className="roster-import-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setOpen(false); }}><section className="roster-import-modal" role="dialog" aria-modal="true"><header><div><small>بوابة الإدارة</small><h2>استيراد وتصدير قوائم الطلاب</h2><p>المعاينة إلزامية، والمكرر لا يُستبدل تلقائيًا.</p></div><button type="button" onClick={() => setOpen(false)} disabled={busy}>×</button></header><div className="roster-import-options"><label className="roster-mode"><input type="checkbox" checked={overrideClass} onChange={event => setOverrideClass(event.target.checked)}/><span>الملف لفصل واحد — استخدم الفصل المحدد أدناه</span></label>{overrideClass && <div className="roster-class-select"><label>الصف<select value={grade} onChange={event => setGrade(Number(event.target.value))}>{GRADES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label>الفصل<select value={section} onChange={event => setSection(event.target.value)}>{SECTIONS.map(value => <option key={value}>{value}</option>)}</select></label></div>}<p>{overrideClass ? "كل الأسماء في الملف ستوضع في الفصل المحدد." : "لعدة فصول: أضف أعمدة الصف والفصل داخل Excel. في PDF يفضّل استخدام فصل واحد."}</p></div><div className="roster-file-actions"><label className="roster-file-button">اختيار Excel أو PDF<input type="file" accept=".xlsx,.xls,.csv,.pdf" onChange={event => void chooseFile(event.target.files?.[0])} disabled={busy}/></label><button type="button" onClick={() => void exportExcel()} disabled={busy}>تصدير جميع الفصول Excel</button></div>{message && <p className="roster-import-message">{message}</p>}<div className="roster-preview"><div className="roster-preview-head"><span>المعاينة</span><b>{ar.format(rows.length)} سجل</b></div>{rows.slice(0, 120).map(row => <article key={row.id} className={row.status}><strong>{row.name}</strong><span>{row.className}</span><small>{row.note}</small></article>)}{rows.length > 120 && <p>تم عرض أول ١٢٠ سجلًا فقط، وسيتم استيراد جميع السجلات الجاهزة.</p>}</div><footer><button type="button" onClick={() => setOpen(false)} disabled={busy}>إلغاء</button><button type="button" className="primary" onClick={() => void importReady()} disabled={busy || !readyRows.length}>{busy ? "جارٍ التنفيذ…" : `استيراد ${ar.format(readyRows.length)} طالبًا جاهزًا`}</button></footer></section></div>}
  </aside>;
}
