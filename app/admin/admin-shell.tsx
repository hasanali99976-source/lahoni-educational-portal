"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import "./admin-shell.css";

type PreviewRow = { name: string; grade?: number; section?: string; source?: string };

type PreviewResponse = { ok?: boolean; rows?: PreviewRow[]; total?: number; message?: string };

function ar(value: number) {
  return new Intl.NumberFormat("ar-SA-u-nu-arab").format(value || 0);
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [total, setTotal] = useState(0);
  const [grade, setGrade] = useState(1);
  const [section, setSection] = useState("1");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const studentsTab = pathname.startsWith("/admin/students");

  useEffect(() => {
    let alive = true;
    fetch("/api/admin/teachers", { cache: "no-store" })
      .then(response => { if (alive) setAuthorized(response.ok); })
      .catch(() => { if (alive) setAuthorized(false); });
    return () => { alive = false; };
  }, [pathname]);

  const effectiveRows = useMemo(() => preview.map(row => ({
    ...row,
    grade: row.grade === 1 || row.grade === 2 || row.grade === 3 ? row.grade : grade,
    section: String(row.section || section).replace(/[^0-9]/g, "") || section,
  })), [preview, grade, section]);

  async function previewFile() {
    if (!file) return setMessage("اختر ملف القائمة أولًا.");
    setBusy(true); setMessage(""); setPreview([]); setTotal(0);
    try {
      const data = new FormData();
      data.append("file", file);
      const response = await fetch("/api/admin/students/import-preview", { method: "POST", body: data, cache: "no-store" });
      const result = await response.json().catch(() => ({})) as PreviewResponse;
      if (!response.ok) throw new Error(result.message || "تعذر قراءة الملف");
      setPreview(Array.isArray(result.rows) ? result.rows : []);
      setTotal(Number(result.total || result.rows?.length || 0));
      setMessage(`تمت قراءة ${ar(Number(result.total || result.rows?.length || 0))} اسمًا. راجع المعاينة ثم اضغط اعتماد القائمة.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر قراءة الملف");
    } finally { setBusy(false); }
  }

  async function importRows() {
    if (!effectiveRows.length) return setMessage("اعرض معاينة القائمة أولًا.");
    setBusy(true); setMessage("جارٍ إضافة القائمة…");
    let added = 0; let skipped = 0; let failed = 0;
    try {
      for (let index = 0; index < effectiveRows.length; index += 5) {
        const batch = effectiveRows.slice(index, index + 5);
        const results = await Promise.all(batch.map(async row => {
          try {
            const response = await fetch("/api/admin/students", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: row.name, grade: row.grade, section: row.section }),
              cache: "no-store",
            });
            const data = await response.json().catch(() => ({}));
            if (response.ok) return "added" as const;
            if (String(data.message || "").includes("موجود")) return "skipped" as const;
            return "failed" as const;
          } catch { return "failed" as const; }
        }));
        added += results.filter(item => item === "added").length;
        skipped += results.filter(item => item === "skipped").length;
        failed += results.filter(item => item === "failed").length;
        setMessage(`جارٍ الاعتماد: ${ar(Math.min(index + batch.length, effectiveRows.length))} من ${ar(effectiveRows.length)}…`);
      }
      setMessage(`تم اعتماد القائمة: أضيف ${ar(added)} طالبًا${skipped ? `، وتجاوزنا ${ar(skipped)} مكررًا` : ""}${failed ? `، وتعذر ${ar(failed)} سجلًا` : ""}.`);
      window.dispatchEvent(new Event("lahooni-admin-roster-imported"));
      window.setTimeout(() => window.location.reload(), 700);
    } finally { setBusy(false); }
  }

  if (authorized !== true) return <>{children}</>;

  return <div className={`admin-smart-shell ${studentsTab ? "students-active" : "teachers-active"} ${manualOpen ? "manual-open" : ""}`} dir="rtl">
    <aside className="admin-smart-sidebar">
      <div className="admin-smart-brand"><span>ل</span><div><b>إدارة البوابة</b><small>مركز القيادة الذكي</small></div></div>
      <nav>
        <Link className={!studentsTab ? "active" : ""} href="/admin"><span>👨‍🏫</span><div><b>المعلمون</b><small>الحسابات • التحدي • التكليفات</small></div></Link>
        <Link className={studentsTab ? "active" : ""} href="/admin/students"><span>🎓</span><div><b>الطلاب</b><small>القوائم • الرفع • الفصول</small></div></Link>
      </nav>
      <div className="admin-smart-tip"><b>مركز ذكي</b><p>المعلم يتصدر بالعمل المحفوظ فعليًا، والطلاب يدارون بقوائم كاملة بدل الإدخال المرهق.</p></div>
      <Link className="admin-smart-home" href="/">العودة للرئيسية</Link>
    </aside>

    <section className="admin-smart-content">
      {studentsTab && <section className="admin-bulk-roster">
        <header><div><small>الطريق الأسرع</small><h2>رفع قائمة الطلاب كاملة</h2><p>ارفع Excel أو CSV أو PDF، نقرأ الأسماء أولًا ونريك معاينة قبل إضافة أي طالب.</p></div><span className="admin-file-badges"><i>Excel</i><i>CSV</i><i>PDF</i></span></header>
        <div className="admin-bulk-grid">
          <label className="admin-drop-zone"><input type="file" accept=".xlsx,.xls,.csv,.pdf,application/pdf" onChange={event => { setFile(event.target.files?.[0] || null); setPreview([]); setMessage(""); }} /><span>⬆</span><b>{file ? file.name : "اختر ملف القائمة أو اسحبه هنا"}</b><small>لا تُضاف البيانات قبل المعاينة والاعتماد.</small></label>
          <div className="admin-default-class"><label>الصف الافتراضي<select value={grade} onChange={event => setGrade(Number(event.target.value))}><option value={1}>الأول الثانوي</option><option value={2}>الثاني الثانوي</option><option value={3}>الثالث الثانوي</option></select></label><label>الفصل الافتراضي<select value={section} onChange={event => setSection(event.target.value)}>{[1,2,3,4,5,6,7,8].map(value => <option key={value} value={value}>{ar(value)}</option>)}</select></label><button onClick={() => void previewFile()} disabled={!file || busy}>{busy ? "جارٍ القراءة…" : "قراءة ومعاينة القائمة"}</button></div>
        </div>
        {message && <p className="admin-bulk-message">{message}</p>}
        {!!preview.length && <div className="admin-preview-box"><header><b>معاينة أول {ar(Math.min(20, preview.length))} اسمًا</b><span>الإجمالي {ar(total || preview.length)}</span></header><div>{effectiveRows.slice(0,20).map((row,index) => <article key={`${row.name}-${index}`}><span>{ar(index+1)}</span><b>{row.name}</b><small>صف {ar(row.grade || grade)} • فصل {ar(Number(row.section || section))}</small></article>)}</div><button className="admin-import-approve" onClick={() => void importRows()} disabled={busy}>{busy ? "جارٍ الاعتماد…" : `اعتماد وإضافة ${ar(effectiveRows.length)} طالبًا`}</button></div>}
        <button className="admin-manual-toggle" type="button" onClick={() => setManualOpen(value => !value)}>{manualOpen ? "إخفاء الإدخال اليدوي" : "إظهار الخيارات اليدوية المتقدمة"}</button>
      </section>}
      {children}
    </section>
  </div>;
}
