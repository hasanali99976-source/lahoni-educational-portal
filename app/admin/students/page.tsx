"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import "./students-admin.css";
import "./students-command-v3.css";

type Student = { id: string; code: string; name: string; grade: number; section: string; className: string; active: boolean };
type SchoolClass = { id: string; grade: number; section: string; name: string; active: boolean };
type ImportRow = { name: string; grade?: number | null; section?: string; code?: string; source?: string };

const GRADES = [
  { value: 1, label: "الأول الثانوي" },
  { value: 2, label: "الثاني الثانوي" },
  { value: 3, label: "الثالث الثانوي" },
];
const ar = (value: string | number) => String(value).replace(/\d/g, digit => "٠١٢٣٤٥٦٧٨٩"[Number(digit)] || digit);

async function api(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(input, { ...init, signal: controller.signal, cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "تعذر تنفيذ العملية");
    return data;
  } finally { window.clearTimeout(timer); }
}

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [grade, setGrade] = useState(1);
  const [classId, setClassId] = useState("");
  const [search, setSearch] = useState("");
  const [newStudent, setNewStudent] = useState("");
  const [showClass, setShowClass] = useState(false);
  const [newClassSection, setNewClassSection] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<ImportRow[]>([]);
  const [editing, setEditing] = useState<Student | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api("/api/admin/students");
      setStudents(Array.isArray(data.students) ? data.students : []);
      setClasses(Array.isArray(data.classes) ? data.classes : []);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تحميل الطلاب");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const gradeClasses = useMemo(() => classes.filter(item => item.grade === grade).sort((a, b) => Number(a.section) - Number(b.section)), [classes, grade]);

  useEffect(() => {
    if (!gradeClasses.length) { setClassId(""); return; }
    if (!gradeClasses.some(item => item.id === classId)) setClassId(gradeClasses[0].id);
  }, [gradeClasses, classId]);

  const selectedClass = useMemo(() => classes.find(item => item.id === classId) || null, [classes, classId]);
  const classStudents = useMemo(() => selectedClass ? students.filter(student => student.grade === selectedClass.grade && student.section === selectedClass.section).sort((a, b) => a.name.localeCompare(b.name, "ar")) : [], [students, selectedClass]);
  const visibleStudents = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("ar");
    return q ? classStudents.filter(student => student.name.toLocaleLowerCase("ar").includes(q) || student.code.toLowerCase().includes(q)) : classStudents;
  }, [classStudents, search]);
  const gradeCount = useMemo(() => students.filter(student => student.grade === grade).length, [students, grade]);

  async function addClass(event: FormEvent) {
    event.preventDefault();
    const section = newClassSection.replace(/[^0-9٠-٩]/g, "").trim();
    if (!section) return setMessage("اكتب رقم الفصل.");
    setBusy(true);
    try {
      const data = await api("/api/admin/students/classes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ grade, section }) });
      await load();
      setShowClass(false); setNewClassSection("");
      if (data.schoolClass?.id) setClassId(data.schoolClass.id);
      setMessage("تمت إضافة الفصل وأصبح جاهزًا للقائمة.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "تعذر إضافة الفصل"); }
    finally { setBusy(false); }
  }

  async function addStudent(event: FormEvent) {
    event.preventDefault();
    if (!selectedClass) return setMessage("اختر الفصل أولًا.");
    const name = newStudent.replace(/\s+/g, " ").trim();
    if (name.length < 3) return setMessage("اكتب اسم الطالب كاملًا.");
    setBusy(true);
    try {
      const data = await api("/api/admin/students", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, grade: selectedClass.grade, section: selectedClass.section }) });
      setNewStudent(""); await load();
      setMessage(`تمت إضافة ${name} • الكود ${data.student?.code || "تم إنشاؤه"}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "تعذر إضافة الطالب"); }
    finally { setBusy(false); }
  }

  async function removeStudent(student: Student) {
    if (!confirm(`حذف ${student.name} من القائمة الحالية؟`)) return;
    setBusy(true);
    try { await api(`/api/admin/students/${student.id}`, { method: "DELETE" }); await load(); setMessage("تم حذف الطالب من القائمة الحالية."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "تعذر حذف الطالب"); }
    finally { setBusy(false); }
  }

  async function saveEdit() {
    if (!editing) return;
    setBusy(true);
    try {
      await api(`/api/admin/students/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: editing.name, grade: editing.grade, section: editing.section }) });
      setEditing(null); await load(); setMessage("تم حفظ تعديل الطالب أو نقله للفصل الجديد.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "تعذر حفظ التعديل"); }
    finally { setBusy(false); }
  }

  async function removeClass(item: SchoolClass) {
    const count = students.filter(student => student.grade === item.grade && student.section === item.section).length;
    if (count) return setMessage("لا يمكن حذف فصل يحتوي طلابًا. انقل الطلاب أو احذفهم أولًا.");
    if (!confirm(`حذف ${item.name}؟`)) return;
    setBusy(true);
    try { await api(`/api/admin/students/classes/${item.id}`, { method: "DELETE" }); await load(); setMessage("تم حذف الفصل."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "تعذر حذف الفصل"); }
    finally { setBusy(false); }
  }

  async function previewFile() {
    if (!file || !selectedClass) return setMessage("اختر الفصل والملف أولًا.");
    setBusy(true); setPreviewRows([]);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("defaultGrade", String(selectedClass.grade));
      form.append("defaultSection", selectedClass.section);
      const data = await api("/api/admin/students/import", { method: "POST", body: form }, 30000);
      const rows = Array.isArray(data.rows) ? data.rows as ImportRow[] : [];
      setPreviewRows(rows);
      setMessage(`تمت قراءة ${ar(rows.length)} اسمًا. راجعها ثم اعتمد القائمة.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "تعذر قراءة الملف"); }
    finally { setBusy(false); }
  }

  async function importPreview() {
    if (!previewRows.length || !selectedClass) return;
    setBusy(true);
    try {
      const rows = previewRows.map(row => ({ ...row, grade: row.grade || selectedClass.grade, section: row.section || selectedClass.section }));
      const data = await api("/api/admin/students/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }) }, 30000);
      await load(); setShowUpload(false); setFile(null); setPreviewRows([]);
      setMessage(`تمت إضافة ${ar(data.imported || 0)} طالبًا${data.skipped ? ` • وتجاوز ${ar(data.skipped)} سجلًا مكررًا أو ناقصًا` : ""}.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "تعذر اعتماد القائمة"); }
    finally { setBusy(false); }
  }

  async function downloadPdf() {
    if (!selectedClass || !classStudents.length) return setMessage("لا توجد أسماء في الفصل لتحميل الكشف.");
    setBusy(true);
    try {
      const sheet = document.getElementById("roster-pdf-sheet");
      if (!sheet) throw new Error("تعذر تجهيز الكشف");
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(sheet, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = 210, pageH = 297, margin = 8, usableW = pageW - margin * 2, usableH = pageH - margin * 2;
      const naturalH = canvas.height * usableW / canvas.width;
      const fitScale = Math.min(1, usableH / naturalH);
      const renderW = usableW * fitScale;
      const renderH = naturalH * fitScale;
      const x = (pageW - renderW) / 2;
      const data = canvas.toDataURL("image/png");
      pdf.addImage(data, "PNG", x, margin, renderW, renderH);
      pdf.save(`كشف_${selectedClass.name}.pdf`);
      setMessage("تم تجهيز كشف الفصل كاملًا في صفحة A4 واحدة.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "تعذر إنشاء PDF"); }
    finally { setBusy(false); }
  }

  return <section className="roster-v3" dir="rtl">
    <header className="roster-v3-hero">
      <div><small>إدارة الطلاب والفصول</small><h1>القائمة بدون تعقيد</h1><p>اختر الصف، ثم الفصل، وكل الأدوات تظهر للفصل الذي تعمل عليه فقط.</p></div>
      <div className="roster-v3-hero-actions"><button onClick={() => setShowClass(true)}>+ إضافة فصل</button><button className="primary" disabled={!selectedClass} onClick={() => setShowUpload(true)}>رفع كشف كامل</button></div>
    </header>

    {message && <div className="roster-v3-message">{message}</div>}

    <section className="roster-v3-step"><header><span>١</span><div><b>اختر الصف</b><small>{ar(gradeCount)} طالبًا في الصف المحدد</small></div></header><div className="roster-v3-grades">{GRADES.map(item => <button key={item.value} className={grade === item.value ? "active" : ""} onClick={() => { setGrade(item.value); setSearch(""); }}>{item.label}<small>{ar(students.filter(student => student.grade === item.value).length)}</small></button>)}</div></section>

    <section className="roster-v3-step"><header><span>٢</span><div><b>اختر الفصل</b><small>لن تظهر لك إلا قائمة الفصل الذي تختاره</small></div></header><div className="roster-v3-classes">{gradeClasses.map(item => {
      const count = students.filter(student => student.grade === item.grade && student.section === item.section).length;
      return <button key={item.id} className={classId === item.id ? "active" : ""} onClick={() => { setClassId(item.id); setSearch(""); }}><b>فصل {ar(item.section)}</b><small>{ar(count)} طالب</small></button>;
    })}<button className="add-class" onClick={() => setShowClass(true)}>＋<small>فصل جديد</small></button>{!gradeClasses.length && <p className="roster-v3-no-class">لا يوجد فصل لهذا الصف. اضغط «إضافة فصل» واكتب رقمه.</p>}</div></section>

    {selectedClass ? <section className="roster-v3-work">
      <header className="roster-v3-work-head"><div><small>٣ • قائمة العمل</small><h2>{selectedClass.name}</h2><p>{ar(classStudents.length)} طالبًا</p></div><div><button onClick={() => void downloadPdf()} disabled={busy || !classStudents.length}>تحميل كشف PDF</button><button className="upload" onClick={() => setShowUpload(true)}>رفع كشف</button><button className="delete" onClick={() => void removeClass(selectedClass)} disabled={busy}>حذف الفصل</button></div></header>

      <form className="roster-v3-add-student" onSubmit={addStudent}><div><b>إضافة طالب لهذا الفصل</b><small>الصف والفصل محددان تلقائيًا</small></div><input value={newStudent} onChange={event => setNewStudent(event.target.value)} placeholder="اسم الطالب كاملًا" /><button disabled={busy}>{busy ? "..." : "+ إضافة"}</button></form>

      <div className="roster-v3-listbar"><div><b>الطلاب</b><small>اضغط تعديل لنقل الطالب أو تغيير اسمه</small></div><input value={search} onChange={event => setSearch(event.target.value)} placeholder="بحث بالاسم أو الكود" /></div>

      {loading ? <div className="roster-v3-empty">جارٍ تحميل القائمة…</div> : <div className="roster-v3-table"><div className="head"><span>م</span><span>اسم الطالب</span><span>الكود</span><span>الإجراء</span></div>{visibleStudents.map((student, index) => <div className="row" key={student.id}><span>{ar(index + 1)}</span><strong>{student.name}</strong><code>{student.code}</code><div><button onClick={() => setEditing({ ...student })}>تعديل</button><button className="danger" onClick={() => void removeStudent(student)}>حذف</button></div></div>)}{!visibleStudents.length && <div className="roster-v3-empty">لا توجد أسماء في هذا الفصل بعد. أضف طالبًا أو ارفع كشفًا كاملًا.</div>}</div>}
    </section> : <section className="roster-v3-select-hint"><span>🎓</span><b>اختر فصلًا لتظهر قائمته وأدواته</b><small>لن نعرض لك نماذج أو خيارات لا تحتاجها الآن.</small></section>}

    {showClass && <div className="roster-v3-modal"><form onSubmit={addClass}><header><div><small>فصل جديد في {GRADES.find(item => item.value === grade)?.label}</small><h2>أضف رقم الفصل</h2></div><button type="button" onClick={() => setShowClass(false)}>×</button></header><label>رقم الفصل<input inputMode="numeric" value={newClassSection} onChange={event => setNewClassSection(event.target.value)} placeholder="مثال: 1" autoFocus /></label><footer><button type="button" onClick={() => setShowClass(false)}>إلغاء</button><button className="primary" disabled={busy}>إضافة الفصل</button></footer></form></div>}

    {showUpload && selectedClass && <div className="roster-v3-modal"><section className="roster-v3-upload"><header><div><small>{selectedClass.name}</small><h2>رفع كشف الطلاب</h2></div><button type="button" onClick={() => { setShowUpload(false); setFile(null); setPreviewRows([]); }}>×</button></header><label className="roster-v3-drop"><input type="file" accept=".xlsx,.xls,.csv,.pdf,application/pdf" onChange={event => { setFile(event.target.files?.[0] || null); setPreviewRows([]); }} /><span>⬆</span><b>{file?.name || "اختر Excel أو CSV أو PDF"}</b><small>سيُستخدم الصف والفصل المحددان تلقائيًا إذا لم يكونا موجودين في الملف.</small></label><button className="roster-v3-read" onClick={() => void previewFile()} disabled={!file || busy}>{busy ? "جارٍ القراءة…" : "قراءة ومعاينة"}</button>{previewRows.length > 0 && <div className="roster-v3-preview"><div><b>وجدنا {ar(previewRows.length)} اسمًا</b><small>أول الأسماء:</small>{previewRows.slice(0,8).map((row,index) => <span key={`${row.name}-${index}`}>{ar(index + 1)}. {row.name}</span>)}</div><button onClick={() => void importPreview()} disabled={busy}>اعتماد وإضافة القائمة</button></div>}</section></div>}

    {editing && <div className="roster-v3-modal"><section><header><div><small>الكود ثابت: {editing.code}</small><h2>تعديل أو نقل الطالب</h2></div><button type="button" onClick={() => setEditing(null)}>×</button></header><label>اسم الطالب<input value={editing.name} onChange={event => setEditing({ ...editing, name: event.target.value })} /></label><label>الصف<select value={editing.grade} onChange={event => setEditing({ ...editing, grade: Number(event.target.value) })}>{GRADES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label>رقم الفصل<input value={editing.section} onChange={event => setEditing({ ...editing, section: event.target.value.replace(/[^0-9٠-٩]/g, "") })} /></label><footer><button onClick={() => setEditing(null)}>إلغاء</button><button className="primary" onClick={() => void saveEdit()} disabled={busy}>حفظ</button></footer></section></div>}

    <div id="roster-pdf-sheet" className="roster-pdf-sheet" aria-hidden="true"><div className="pdf-brand">بوابة أستاذ لحوني التعليمية</div><h1>كشف الطلاب</h1><h2>{selectedClass ? `${GRADES.find(item => item.value === selectedClass.grade)?.label || ""} • الفصل ${ar(selectedClass.section)}` : ""}</h2><p>عدد الطلاب: {ar(classStudents.length)}</p><table><thead><tr><th>م</th><th>اسم الطالب</th><th>الصف والفصل</th><th>الكود</th></tr></thead><tbody>{classStudents.map((student,index) => <tr key={student.id}><td>{ar(index+1)}</td><td>{student.name}</td><td>{GRADES.find(item => item.value === student.grade)?.label || ""} • فصل {ar(student.section)}</td><td>{student.code}</td></tr>)}</tbody></table></div>
  </section>;
}