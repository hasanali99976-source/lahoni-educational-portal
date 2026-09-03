"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { useTeacherClient } from "../../../lib/teacher-client";
import "./notes.css";

type Student = { id: string; code?: string; name?: string; class?: string; className?: string };
type Note = {
  id?: string;
  studentCode?: string;
  studentName?: string;
  className?: string;
  type?: string;
  label?: string;
  message?: string;
  createdAt?: string;
  teacherName?: string;
  subject?: string;
  visibleToParent?: boolean;
};

const noteTypes = [
  ["positive", "إيجابية"],
  ["academic", "أكاديمية"],
  ["homework", "واجب"],
  ["behavioral", "سلوكية"],
  ["followup", "متابعة"],
  ["alert", "تنبيه"],
] as const;

function codeOf(student: Student) {
  return String(student.code || student.id || "").trim().toUpperCase();
}

function dateText(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return new Intl.DateTimeFormat("ar-SA", { timeZone: "Asia/Riyadh", dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function TeacherNotesPage() {
  const session = useTeacherClient();
  const [students, setStudents] = useState<Student[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [type, setType] = useState<(typeof noteTypes)[number][0]>("followup");
  const [message, setMessage] = useState("");
  const [visibleToParent, setVisibleToParent] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const subjectId = String(session?.subjectKey || "");
  const grade = session?.activeGrade || null;

  async function load() {
    if (!subjectId) return;
    const params = new URLSearchParams({ subjectId });
    if (grade) params.set("grade", String(grade));
    const [studentsResponse, notesResponse] = await Promise.all([
      fetch(`/api/teacher/students?${params}`, { cache: "no-store" }),
      fetch(`/api/teacher/notes?subjectId=${encodeURIComponent(subjectId)}`, { cache: "no-store" }),
    ]);
    const studentsData = await studentsResponse.json().catch(() => ({}));
    const notesData = await notesResponse.json().catch(() => ({}));
    if (studentsResponse.ok) setStudents(Array.isArray(studentsData.students) ? studentsData.students : []);
    if (notesResponse.ok) setNotes(Array.isArray(notesData.notes) ? notesData.notes : []);
  }

  useEffect(() => { void load(); }, [subjectId, grade]);

  const classes = useMemo(() => [...new Set(students.map(item => String(item.className || item.class || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "ar", { numeric: true })), [students]);
  const visibleStudents = useMemo(() => students.filter(item => !selectedClass || String(item.className || item.class || "").trim() === selectedClass), [students, selectedClass]);
  const visibleNotes = useMemo(() => notes.filter(note => !selectedClass || note.className === selectedClass), [notes, selectedClass]);

  function openFor(scope: "single" | "class" | "all", code?: string) {
    if (scope === "single" && code) setSelectedCodes([code]);
    else if (scope === "class") setSelectedCodes(visibleStudents.map(codeOf));
    else setSelectedCodes(students.map(codeOf));
    setModalOpen(true);
    setStatus("");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!selectedCodes.length || !message.trim()) return;
    setBusy(true); setStatus("");
    try {
      const response = await fetch("/api/teacher/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId, studentCodes: selectedCodes, type, message, visibleToParent }),
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "تعذر حفظ الملاحظة");
      setMessage("");
      setModalOpen(false);
      setStatus(visibleToParent
        ? `تم حفظ الملاحظة لـ ${data.saved || selectedCodes.length} طالبًا وستظهر في بوابة الطالب وولي الأمر.`
        : `تم حفظ الملاحظة داخليًا لـ ${data.saved || selectedCodes.length} طالبًا.`);
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "تعذر حفظ الملاحظة الآن");
    } finally { setBusy(false); }
  }

  function exportExcel() {
    const rows = visibleNotes.map(note => ({
      "الطالب": note.studentName || "",
      "الكود": note.studentCode || "",
      "الفصل": note.className || "",
      "النوع": note.label || note.type || "",
      "الملاحظة": note.message || "",
      "تظهر لولي الأمر": note.visibleToParent === false ? "لا" : "نعم",
      "التاريخ": dateText(note.createdAt),
      "المعلم": note.teacherName || session?.teacherName || "",
      "المادة": note.subject || session?.subject || "",
    }));
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, selectedClass || "الملاحظات");
    XLSX.writeFile(workbook, `ملاحظات-${selectedClass || "جميع-الفصول"}.xlsx`);
  }

  function printNotes() {
    const rows = visibleNotes.map(note => `<tr><td>${note.studentName || ""}</td><td>${note.className || ""}</td><td>${note.label || ""}</td><td>${note.message || ""}</td><td>${dateText(note.createdAt)}</td></tr>`).join("");
    const popup = window.open("", "_blank", "width=1000,height=800");
    if (!popup) return;
    popup.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>ملاحظات ${selectedClass || "جميع الفصول"}</title><style>@page{size:A4;margin:12mm}body{font-family:Arial;color:#17395f}header{border-bottom:3px solid #c59a45;padding-bottom:10px;margin-bottom:14px}h1{margin:0;font-size:20px}small{color:#777}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #d7dce1;padding:7px;text-align:right}th{background:#102f50;color:white}footer{margin-top:12px;border-top:1px solid #ddd;padding-top:8px;font-size:10px;color:#777}</style></head><body><header><h1>بوابة أستاذ لحوني التعليمية</h1><small>${session?.teacherName || ""} — ${session?.subject || ""} — ${selectedClass || "جميع الفصول"}</small></header><table><thead><tr><th>الطالب</th><th>الفصل</th><th>النوع</th><th>الملاحظة</th><th>التاريخ</th></tr></thead><tbody>${rows}</tbody></table><footer>إعداد وتنفيذ: الأستاذ حسن علي الطويل • 2026</footer><script>window.onload=()=>window.print()</script></body></html>`);
    popup.document.close();
  }

  return <section className="teacher-notes-v105" dir="rtl">
    <header className="notes-hero">
      <div><small>التواصل التعليمي</small><h1>الملاحظات والتواصل</h1><p>أضف ملاحظة لطالب أو فصل أو جميع طلابك، وحدد هل تظهر لولي الأمر أم تبقى داخلية.</p></div>
      <button onClick={() => openFor("all")}>+ ملاحظة جديدة</button>
    </header>

    <div className="notes-toolbar">
      <label>الفصل<select value={selectedClass} onChange={event => setSelectedClass(event.target.value)}><option value="">جميع الفصول</option>{classes.map(item => <option key={item}>{item}</option>)}</select></label>
      <button onClick={() => openFor("class")} disabled={!visibleStudents.length}>ملاحظة للفصل</button>
      <button onClick={printNotes}>PDF {selectedClass ? "فصل" : "جميع الفصول"}</button>
      <button onClick={exportExcel}>Excel</button>
    </div>

    {status ? <p className="notes-status">{status}</p> : null}

    <div className="notes-student-grid">
      {visibleStudents.map(student => <article key={codeOf(student)}><div><strong>{student.name}</strong><small>{student.className || student.class} • {codeOf(student)}</small></div><button onClick={() => openFor("single", codeOf(student))}>إضافة ملاحظة</button></article>)}
    </div>

    <section className="notes-history"><div className="notes-history-head"><h2>آخر الملاحظات</h2><span>{visibleNotes.length} ملاحظة</span></div>
      <div className="notes-list">{visibleNotes.length ? visibleNotes.map((note, index) => <article key={note.id || `${note.studentCode}-${index}`}>
        <div><strong>{note.studentName || note.studentCode}</strong><small>{note.className} • {note.label || note.type} • {dateText(note.createdAt)}</small></div>
        <p>{note.message}</p>
        <span className={note.visibleToParent === false ? "internal" : "parent"}>{note.visibleToParent === false ? "داخلية" : "تظهر لولي الأمر"}</span>
      </article>) : <div className="notes-empty">لا توجد ملاحظات مسجلة حتى الآن.</div>}</div>
    </section>

    {modalOpen ? <div className="notes-modal" role="dialog" aria-modal="true"><form onSubmit={save} className="notes-modal-card">
      <header><div><small>إضافة ملاحظة</small><h2>{selectedCodes.length === 1 ? "ملاحظة لطالب" : `ملاحظة لـ ${selectedCodes.length} طالبًا`}</h2></div><button type="button" onClick={() => setModalOpen(false)}>×</button></header>
      <label>نوع الملاحظة<select value={type} onChange={event => setType(event.target.value as typeof type)}>{noteTypes.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <label>نص الملاحظة<textarea value={message} onChange={event => setMessage(event.target.value)} rows={5} placeholder="اكتب الملاحظة بشكل واضح ومختصر…" required /></label>
      <label className="notes-visible"><input type="checkbox" checked={visibleToParent} onChange={event => setVisibleToParent(event.target.checked)} /><span><b>إظهارها في بوابة الطالب وولي الأمر</b><small>سيظهر معها اليوم والتاريخ واسم المعلم والمادة.</small></span></label>
      <footer><button type="button" onClick={() => setModalOpen(false)}>إلغاء</button><button disabled={busy || !message.trim()}>{busy ? "جارٍ الحفظ…" : "حفظ الملاحظة"}</button></footer>
    </form></div> : null}
  </section>;
}