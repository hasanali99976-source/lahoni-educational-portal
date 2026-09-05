"use client";

import { DragEvent, useMemo, useRef, useState } from "react";

type PreviewRow = { name: string; grade?: number; section?: string };
type PreviewResponse = { rows?: PreviewRow[]; total?: number; message?: string };

function ar(value: number) {
  return new Intl.NumberFormat("ar-SA-u-nu-arab").format(value || 0);
}

export default function StudentBulkUploader() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [grade, setGrade] = useState(1);
  const [section, setSection] = useState("1");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState("");

  const rows = useMemo(() => preview.map(row => ({
    name: row.name,
    grade: row.grade === 1 || row.grade === 2 || row.grade === 3 ? row.grade : grade,
    section: String(row.section || section).replace(/[^0-9]/g, "") || section,
  })), [preview, grade, section]);

  function chooseFile(next: File | null) {
    setFile(next);
    setPreview([]);
    setMessage(next ? `تم اختيار: ${next.name}` : "");
  }

  function dropFile(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    chooseFile(event.dataTransfer.files?.[0] || null);
  }

  async function readFile() {
    if (!file) return setMessage("اختر ملف القائمة أولًا.");
    setBusy(true); setMessage(""); setPreview([]);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/admin/students/import-preview", { method: "POST", body: form, cache: "no-store" });
      const data = await response.json().catch(() => ({})) as PreviewResponse;
      if (!response.ok) throw new Error(data.message || "تعذر قراءة الملف");
      setPreview(Array.isArray(data.rows) ? data.rows : []);
      setMessage(`تمت قراءة ${ar(Number(data.total || data.rows?.length || 0))} اسمًا. راجع المعاينة ثم اعتمد القائمة.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر قراءة الملف");
    } finally { setBusy(false); }
  }

  async function approve() {
    if (!rows.length) return setMessage("اعرض معاينة القائمة أولًا.");
    setBusy(true);
    let added = 0; let duplicates = 0; let failed = 0;
    try {
      for (let index = 0; index < rows.length; index += 5) {
        const batch = rows.slice(index, index + 5);
        const results = await Promise.all(batch.map(async row => {
          try {
            const response = await fetch("/api/admin/students", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(row),
              cache: "no-store",
            });
            const data = await response.json().catch(() => ({}));
            if (response.ok) return "added";
            if (String(data.message || "").includes("موجود")) return "duplicate";
            return "failed";
          } catch { return "failed"; }
        }));
        added += results.filter(item => item === "added").length;
        duplicates += results.filter(item => item === "duplicate").length;
        failed += results.filter(item => item === "failed").length;
        setMessage(`جارٍ الاعتماد: ${ar(Math.min(index + batch.length, rows.length))} من ${ar(rows.length)}…`);
      }
      setMessage(`تم الاعتماد: ${ar(added)} طالب جديد${duplicates ? ` • ${ar(duplicates)} مكرر تم تجاوزه` : ""}${failed ? ` • ${ar(failed)} تعذر إضافته` : ""}.`);
      window.setTimeout(() => window.location.reload(), 800);
    } finally { setBusy(false); }
  }

  return <section className="admin-bulk-roster" dir="rtl">
    <header><div><small>رفع ذكي للقوائم</small><h2>ارفع قائمة كاملة بضغطة واحدة</h2><p>ملف مدرسة كامل أو فصل محدد — Excel أو CSV أو PDF. نقرأ الأسماء أولًا ثم نعرض معاينة قبل إضافة أي طالب.</p></div><div className="admin-file-types"><span>Excel</span><span>CSV</span><span>PDF</span></div></header>

    <div className="admin-bulk-controls">
      <div
        className={`admin-bulk-drop ${dragging ? "dragging" : ""} ${file ? "has-file" : ""}`}
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={event => { if (event.key === "Enter" || event.key === " ") inputRef.current?.click(); }}
        onDragOver={event => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={dropFile}
      >
        <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv,.pdf,application/pdf" onChange={event => chooseFile(event.target.files?.[0] || null)} />
        <span className="admin-upload-icon">⬆</span>
        <b>{file ? file.name : "اسحب القائمة هنا أو اضغط لاختيار الملف"}</b>
        <small>{file ? "جاهز للقراءة والمعاينة" : "يقبل قائمة كاملة أو ملف فصل واحد، حتى لو كان فيه الاسم فقط."}</small>
      </div>

      <div className="admin-bulk-defaults">
        <div className="admin-bulk-scope"><small>إذا لم يكن الصف والفصل مكتوبين داخل الملف</small><b>طبّق هذه القيم تلقائيًا</b></div>
        <label>الصف الافتراضي<select value={grade} onChange={event => setGrade(Number(event.target.value))}><option value={1}>الأول الثانوي</option><option value={2}>الثاني الثانوي</option><option value={3}>الثالث الثانوي</option></select></label>
        <label>الفصل الافتراضي<select value={section} onChange={event => setSection(event.target.value)}>{[1,2,3,4,5,6,7,8].map(value => <option key={value} value={value}>{ar(value)}</option>)}</select></label>
        <button type="button" onClick={() => void readFile()} disabled={!file || busy}>{busy ? "جارٍ القراءة…" : "قراءة ومعاينة القائمة"}</button>
      </div>
    </div>

    {message && <p className="admin-bulk-message">{message}</p>}

    {!!rows.length && <div className="admin-bulk-preview">
      <header><div><small>قبل الحفظ</small><b>معاينة القائمة</b></div><span>{ar(rows.length)} طالبًا</span></header>
      <div>{rows.slice(0,20).map((row,index) => <article key={`${row.name}-${index}`}><span>{ar(index+1)}</span><strong>{row.name}</strong><small>صف {ar(row.grade)} • فصل {ar(Number(row.section))}</small></article>)}</div>
      {rows.length > 20 && <p>+ {ar(rows.length - 20)} اسمًا إضافيًا جاهزًا للاعتماد</p>}
      <button type="button" className="admin-bulk-approve" onClick={() => void approve()} disabled={busy}>{busy ? "جارٍ الاعتماد…" : `اعتماد وإضافة ${ar(rows.length)} طالبًا`}</button>
    </div>}
  </section>;
}
