"use client";

import { useEffect, useMemo, useState } from "react";
import { useTeacherClient } from "../../../lib/teacher-client";
import "./notes.css";

type Student = { id: string; code: string; name: string; className: string; grade?: number };
type Note = { id?: string; type?: string; label?: string; message?: string; createdAt?: string; teacherName?: string; subject?: string };
type NoteRow = { studentCode: string; studentName: string; className: string; notes: Note[] };

const presets = [
  { type: "positive", label: "تميز ومشاركة فعالة", message: "أظهر الطالب تميزًا ومشاركة فعالة في الحصة، ويستحق الاستمرار على هذا المستوى." },
  { type: "positive", label: "تحسن ملحوظ", message: "يوجد تحسن ملحوظ في مستوى الطالب واستجابته للمتابعة." },
  { type: "academic", label: "يحتاج مراجعة المهارة", message: "يحتاج الطالب إلى مراجعة المهارة المستهدفة والتدرب عليها بصورة منتظمة." },
  { type: "academic", label: "عدم إتقان", message: "لم يتحقق الإتقان المطلوب حتى الآن، ويُنصح بمتابعة الخطة العلاجية والتدريب الإضافي." },
  { type: "homework", label: "متابعة الواجبات", message: "يحتاج الطالب إلى مزيد من الانتظام في أداء الواجبات وتسليمها في الوقت المحدد." },
  { type: "participation", label: "ضعف المشاركة", message: "المشاركة الصفية أقل من المتوقع، ويُنصح بتشجيع الطالب على التفاعل وطرح الأسئلة." },
  { type: "attendance", label: "أثر الغياب أو التأخر", message: "أثر الغياب أو التأخر على متابعة الطالب للمحتوى، ويحتاج إلى تعويض ما فاته." },
  { type: "support", label: "خطة علاجية", message: "يُنصح بإدراج الطالب ضمن متابعة علاجية قصيرة مع تحديد المهارة وقياس التحسن." },
  { type: "enrichment", label: "مناسب للإثراء", message: "مستوى الطالب يسمح بتقديم نشاط إثرائي وتحديات إضافية لتنمية مهاراته." },
  { type: "parent", label: "التواصل مع ولي الأمر", message: "يُنصح بمتابعة الملاحظة مع ولي الأمر لتعزيز التحسن واستمرار المتابعة المنزلية." },
] as const;

function arabicDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Riyadh" }).format(date);
}

export default function TeacherNotesPage() {
  const session = useTeacherClient();
  const [students, setStudents] = useState<Student[]>([]);
  const [rows, setRows] = useState<NoteRow[]>([]);
  const [className, setClassName] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [custom, setCustom] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

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
    const studentData = await studentsResponse.json().catch(() => ({}));
    const notesData = await notesResponse.json().catch(() => ({}));
    if (studentsResponse.ok) {
      const list = (Array.isArray(studentData.students) ? studentData.students : []).map((student: Record<string, unknown>) => ({
        id: String(student.id || student.code || ""),
        code: String(student.code || student.id || ""),
        name: String(student.name || ""),
        className: String(student.className || student.class || ""),
        grade: Number(student.grade || 0),
      })).filter((student: Student) => student.code && student.name);
      setStudents(list);
      if (!className && list[0]?.className) setClassName(list[0].className);
    }
    if (notesResponse.ok) setRows(Array.isArray(notesData.rows) ? notesData.rows : []);
  }

  useEffect(() => { void load(); }, [subjectId, grade]);

  const classes = useMemo(() => [...new Set(students.map(student => student.className).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ar", { numeric: true })), [students]);
  const classStudents = useMemo(() => students.filter(student => !className || student.className === className).sort((a, b) => a.name.localeCompare(b.name, "ar")), [students, className]);
  const selectedStudent = students.find(student => student.code === studentCode) || null;
  const selectedRow = rows.find(row => row.studentCode === studentCode) || null;
  const preset = presets[selectedPreset];
  const noteText = custom.trim() || preset.message;

  useEffect(() => {
    if (!classStudents.some(student => student.code === studentCode)) setStudentCode(classStudents[0]?.code || "");
  }, [className, classStudents, studentCode]);

  async function save() {
    if (!selectedStudent || !noteText.trim()) return setMessage("اختر الطالب واكتب الملاحظة.");
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/teacher/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId,
          subject: session?.subject || subjectId,
          studentCode: selectedStudent.code,
          type: custom.trim() ? "custom" : preset.type,
          label: custom.trim() ? "ملاحظة مخصصة" : preset.label,
          message: noteText,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "تعذر حفظ الملاحظة");
      setCustom("");
      setMessage("تم حفظ الملاحظة وستظهر للطالب وولي الأمر في بوابتهم.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر حفظ الملاحظة");
    } finally { setBusy(false); }
  }

  async function remove(noteId?: string) {
    if (!noteId || !selectedStudent) return;
    if (!confirm("حذف هذه الملاحظة؟")) return;
    setBusy(true);
    try {
      const response = await fetch("/api/teacher/notes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId, studentCode: selectedStudent.code, noteId }),
      });
      if (!response.ok) throw new Error();
      await load();
      setMessage("تم حذف الملاحظة.");
    } catch { setMessage("تعذر حذف الملاحظة."); }
    finally { setBusy(false); }
  }

  return <main className="teacher-notes-workspace" dir="rtl">
    <header className="teacher-notes-hero"><div><small>التواصل والمتابعة</small><h1>ملاحظات الطالب وولي الأمر</h1><p>اختر الفصل والطالب، ثم استخدم ملاحظة جاهزة أو اكتب ملاحظتك الخاصة. تظهر الملاحظة مباشرة في بوابة الطالب وولي الأمر.</p></div><span>✎</span></header>

    {message ? <div className="teacher-notes-message">{message}</div> : null}

    <section className="teacher-notes-grid">
      <article className="teacher-notes-compose">
        <div className="teacher-notes-selectors">
          <label><span>الفصل</span><select value={className} onChange={event => setClassName(event.target.value)}>{classes.map(item => <option key={item}>{item}</option>)}</select></label>
          <label><span>الطالب</span><select value={studentCode} onChange={event => setStudentCode(event.target.value)}>{classStudents.map(student => <option key={student.code} value={student.code}>{student.name}</option>)}</select></label>
        </div>

        <div className="teacher-notes-presets"><header><div><b>ملاحظات سريعة مقترحة</b><small>اختر الأنسب ثم عدّل النص إذا احتجت</small></div></header><div>{presets.map((item, index) => <button key={item.label} type="button" className={selectedPreset === index ? "active" : ""} onClick={() => { setSelectedPreset(index); setCustom(""); }}>{item.label}</button>)}</div></div>

        <label className="teacher-notes-text"><span>نص الملاحظة</span><textarea value={custom} onChange={event => setCustom(event.target.value)} placeholder={preset.message}/><small>{custom.trim() ? "ملاحظة مخصصة من المعلم" : `سيتم حفظ: ${preset.label}`}</small></label>
        <div className="teacher-notes-preview"><small>ستظهر للطالب وولي الأمر</small><strong>{selectedStudent?.name || "اختر الطالب"}</strong><p>{noteText}</p></div>
        <button className="teacher-notes-save" type="button" disabled={busy || !selectedStudent} onClick={() => void save()}>{busy ? "جارٍ الحفظ…" : "حفظ الملاحظة"}</button>
      </article>

      <aside className="teacher-notes-history"><header><div><small>{selectedStudent?.className || ""}</small><h2>{selectedStudent?.name || "سجل الملاحظات"}</h2></div><span>{selectedRow?.notes?.length || 0}</span></header><div className="teacher-notes-list">{selectedRow?.notes?.map(note => <article key={note.id || `${note.createdAt}-${note.message}`}><div><b>{note.label || "ملاحظة"}</b><small>{arabicDate(note.createdAt)}</small></div><p>{note.message}</p><button type="button" disabled={busy} onClick={() => void remove(note.id)}>حذف</button></article>)}{!selectedRow?.notes?.length ? <div className="teacher-notes-empty"><span>◌</span><b>لا توجد ملاحظات لهذا الطالب</b><small>أضف أول ملاحظة من النموذج.</small></div> : null}</div></aside>
    </section>
  </main>;
}
