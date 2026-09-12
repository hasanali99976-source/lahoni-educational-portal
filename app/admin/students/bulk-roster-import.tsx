"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "./bulk-roster-import.css";

type PreviewRow = { name: string; grade: number | null; section: string; code?: string; source?: string };

const grades = [
  { value: "1", label: "الأول الثانوي" },
  { value: "2", label: "الثاني الثانوي" },
  { value: "3", label: "الثالث الثانوي" },
];
const sections = ["1", "2", "3", "4", "5", "6", "7", "8"];

function ar(value: number) { return new Intl.NumberFormat("ar-SA-u-nu-arab").format(value || 0); }

export default function BulkRosterImport() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [defaultGrade, setDefaultGrade] = useState("");
  const [defaultSection, setDefaultSection] = useState("");
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => { document.body.classList.remove("show-roster-advanced"); return () => document.body.classList.remove("show-roster-advanced"); }, []);

  const preparedRows = useMemo(() => rows.map(row => ({ ...row, grade: row.grade || (defaultGrade ? Number(defaultGrade) : null), section: row.section || defaultSection })), [rows, defaultGrade, defaultSection]);
  const incomplete = preparedRows.filter(row => !row.grade || !row.section).length;

  function selectFile(next: File | null) { setFile(next); setRows([]); setMessage(""); }

  async function preview() {
    if (!file) return setMessage("اختر ملف القائمة من جهازك أولًا.");
    setBusy(true); setMessage("");
    try {
      const form = new FormData(); form.set("file", file); if (defaultGrade) form.set("defaultGrade", defaultGrade); if (defaultSection) form.set("defaultSection", defaultSection);
      const response = await fetch("/api/admin/students/import", { method: "POST", body: form, cache: "no-store" });
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message || "تعذر قراءة الملف");
      setRows(Array.isArray(data.rows) ? data.rows : []); setMessage(`تمت قراءة ${ar(Number(data.count || data.rows?.length || 0))} اسمًا. راجع المعاينة ثم اعتمد القائمة.`);
    } catch (error) { setRows([]); setMessage(error instanceof Error ? error.message : "تعذر قراءة الملف."); }
    finally { setBusy(false); }
  }

  async function commit() {
    if (!preparedRows.length) return; if (incomplete) return setMessage(`يوجد ${ar(incomplete)} طالب بدون صف أو فصل. اختر الصف والفصل الافتراضيين ثم أعد الاعتماد.`);
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/students/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: preparedRows }), cache: "no-store" });
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message || "تعذر اعتماد القائمة");
      setMessage(`تمت إضافة ${ar(Number(data.imported || 0))} طالب بنجاح${data.skipped ? `، وتجاوز ${ar(Number(data.skipped))} سجل موجود أو غير مكتمل` : ""}. يتم تحديث القائمة الآن…`);
      setTimeout(() => window.location.reload(), 1200);
    } catch (error) { setMessage(error instanceof Error ? error.message : "تعذر اعتماد القائمة."); }
    finally { setBusy(false); }
  }

  function toggleAdvanced() { const next = !showAdvanced; setShowAdvanced(next); document.body.classList.toggle("show-roster-advanced", next); }

  return <section className="smart-roster-import-shell direct-upload" dir="rtl">
    <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv,.pdf,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" onChange={event => selectFile(event.target.files?.[0] || null)} hidden />
    <div className="roster-direct-bar">
      <div><small>إضافة جماعية</small><strong>تحميل أسماء الطلاب من ملف خارجي</strong><span>Excel أو CSV أو PDF من جهازك</span></div>
      <button type="button" className="roster-device-button" onClick={() => inputRef.current?.click()}>⇧ تحميل ملف من الجهاز</button>
      <button type="button" className="roster-advanced-inline" onClick={toggleAdvanced}>{showAdvanced ? "إخفاء المتقدم" : "إدارة متقدمة"}</button>
    </div>

    {file && <section className="roster-file-workflow">
      <div className="roster-file-selected"><span>✓</span><div><small>الملف المحدد</small><strong>{file.name}</strong><em>{(file.size / 1024).toFixed(0)} KB</em></div><button type="button" onClick={() => { setFile(null); setRows([]); setMessage(""); if (inputRef.current) inputRef.current.value = ""; }}>تغيير الملف</button></div>
      <div className="roster-file-options"><label>الصف الافتراضي<select value={defaultGrade} onChange={event => setDefaultGrade(event.target.value)}><option value="">اكتشاف من الملف</option>{grades.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label>الفصل الافتراضي<select value={defaultSection} onChange={event => setDefaultSection(event.target.value)}><option value="">اكتشاف من الملف</option>{sections.map(item => <option key={item} value={item}>فصل {item}</option>)}</select></label><button type="button" className="roster-preview-button" onClick={() => void preview()} disabled={busy}>{busy ? "جارٍ القراءة…" : "قراءة ومعاينة"}</button></div>
    </section>}

    {message && <div className="roster-import-message">{message}</div>}
    {rows.length > 0 && <section className="roster-preview-panel"><header><div><small>معاينة قبل الاعتماد</small><h2>{ar(preparedRows.length)} طالبًا تم اكتشافهم</h2></div><div className={incomplete ? "roster-preview-warning" : "roster-preview-ready"}>{incomplete ? `${ar(incomplete)} يحتاج تحديد صف/فصل` : "جاهز للاعتماد ✓"}</div></header><div className="roster-preview-table"><div className="roster-preview-row heading"><span>م</span><span>اسم الطالب</span><span>الصف</span><span>الفصل</span></div>{preparedRows.slice(0, 10).map((row, index) => <div className="roster-preview-row" key={`${row.name}-${index}`}><span>{ar(index + 1)}</span><strong>{row.name}</strong><span>{row.grade ? grades.find(item => Number(item.value) === Number(row.grade))?.label || row.grade : "—"}</span><span>{row.section || "—"}</span></div>)}</div>{preparedRows.length > 10 && <p className="roster-preview-more">+ {ar(preparedRows.length - 10)} طالب آخر في الملف</p>}<div className="roster-preview-actions"><button type="button" onClick={() => { setRows([]); setMessage(""); }}>إلغاء المعاينة</button><button type="button" className="primary" onClick={() => void commit()} disabled={busy || incomplete > 0}>{busy ? "جارٍ الإضافة…" : `اعتماد وإضافة ${ar(preparedRows.length)} طالب`}</button></div></section>}
  </section>;
}
