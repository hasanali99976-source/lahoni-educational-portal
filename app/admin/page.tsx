"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

type Assignment = { id?: string; subjectId: string; grade: string; section: string; label?: string };
type Teacher = { id: string; name: string; active: boolean; subjectIds: string[]; assignments: Assignment[] };

const SUBJECTS = [
  ["quran-tafsir", "القرآن والتفسير"], ["digital-technology", "التقنية الرقمية"],
  ["critical-thinking", "التفكير الناقد"], ["islamic-studies", "الدراسات الإسلامية"],
  ["arabic", "اللغة العربية"], ["social-sciences", "العلوم الاجتماعية"],
  ["environmental-science", "علوم البيئة"], ["mathematics", "الرياضيات"],
  ["english", "اللغة الإنجليزية"], ["physics", "الفيزياء"], ["chemistry", "الكيمياء"],
  ["biology", "علم الأحياء"], ["fitness-health", "اللياقة والثقافة الصحية"],
  ["tawhid", "التوحيد"], ["arts", "الفنون"], ["history", "التاريخ"],
  ["linguistic-competencies", "الكفايات اللغوية"],
] as const;
const GRADES = ["الأول الثانوي", "الثاني الثانوي", "الثالث الثانوي"] as const;
const SECTIONS = ["الكل", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨"] as const;
const emptyAssignment = (): Assignment => ({ subjectId: "", grade: "", section: "" });

function AssignmentEditor({ rows, setRows }: { rows: Assignment[]; setRows: (rows: Assignment[]) => void }) {
  const update = (index: number, key: keyof Assignment, value: string) =>
    setRows(rows.map((row, current) => current === index ? { ...row, [key]: value } : row));
  return <fieldset><legend>المواد والصفوف والفصول</legend><div className="v3-assignment-list">
    {rows.map((row, index) => <div className="v3-assignment-row" key={index}>
      <label>المادة<select value={row.subjectId} onChange={event => update(index, "subjectId", event.target.value)} required><option value="">اختر المادة</option>{SUBJECTS.map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label>
      <label>الصف الدراسي<select value={row.grade} onChange={event => update(index, "grade", event.target.value)} required><option value="">اختر الصف</option>{GRADES.map(grade => <option key={grade}>{grade}</option>)}</select></label>
      <label>الفصل<select value={row.section} onChange={event => update(index, "section", event.target.value)} required><option value="">اختر الفصل</option>{SECTIONS.map(section => <option key={section}>{section}</option>)}</select></label>
      {rows.length > 1 && <button type="button" className="v3-remove-assignment" onClick={() => setRows(rows.filter((_, current) => current !== index))}>حذف</button>}
    </div>)}
  </div><button type="button" className="v3-add-assignment" onClick={() => setRows([...rows, emptyAssignment()])}>+ إضافة مادة أو فصل آخر</button></fieldset>;
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeout = 10000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  try { return await fetch(input, { ...init, signal: controller.signal }); }
  finally { window.clearTimeout(timer); }
}

export default function AdminPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [teacherPassword, setTeacherPassword] = useState("");
  const [assignments, setAssignments] = useState<Assignment[]>([emptyAssignment()]);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetchWithTimeout("/api/admin/teachers", { cache: "no-store" });
      if (response.status === 401 || response.status === 403) { setAuthenticated(false); return; }
      if (!response.ok) throw new Error("load_failed");
      const data = await response.json();
      setTeachers(data.teachers || []);
      setAuthenticated(true);
    } catch {
      setAuthenticated(false);
      setMessage("تعذر التحقق من الجلسة. يمكنك تسجيل الدخول بالاسم ثم المحاولة مجددًا.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function login(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setMessage("");
    try {
      const response = await fetchWithTimeout("/api/auth/admin-name-login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await response.json();
      if (!response.ok || data.role !== "admin") { setMessage(data.message || "اسم المدير غير صحيح"); return; }
      await load();
    } catch { setMessage("تعذر تسجيل الدخول الآن. تحقق من الاتصال وحاول مجددًا."); }
    finally { setBusy(false); }
  }

  async function createTeacher(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/teachers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, password: teacherPassword, assignments }) });
      const data = await response.json();
      if (!response.ok) { setMessage(data.message || "تعذر إضافة المعلم"); return; }
      setName(""); setTeacherPassword(""); setAssignments([emptyAssignment()]);
      setMessage("تمت إضافة المعلم وربط مواده وصفوفه بنجاح"); await load();
    } finally { setBusy(false); }
  }

  async function saveTeacher() {
    if (!editing) return; setBusy(true);
    try {
      const response = await fetch(`/api/admin/teachers/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: editing.name, assignments: editing.assignments, password: resetPassword || undefined }) });
      const data = await response.json();
      if (!response.ok) { setMessage(data.message || "تعذر حفظ التعديل"); return; }
      setEditing(null); setResetPassword(""); setMessage("تم تحديث حساب المعلم"); await load();
    } finally { setBusy(false); }
  }

  async function toggle(teacher: Teacher) { await fetch(`/api/admin/teachers/${teacher.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !teacher.active }) }); await load(); }
  async function remove(teacher: Teacher) { if (!confirm(`حذف حساب ${teacher.name}؟`)) return; const response = await fetch(`/api/admin/teachers/${teacher.id}`, { method: "DELETE" }); if (!response.ok) return setMessage("تعذر حذف الحساب"); setMessage("تم حذف حساب المعلم"); await load(); }
  const subjectLabel = (id: string) => SUBJECTS.find(([key]) => key === id)?.[1] || id;
  const assignmentLabel = (assignment: Assignment) => assignment.label || `${subjectLabel(assignment.subjectId)} — ${assignment.grade}${assignment.section ? ` — ${assignment.section === "الكل" ? "جميع الفصول" : `فصل ${assignment.section}`}` : ""}`;

  if (authenticated === null) return <main className="v3-loading">جارٍ تجهيز إدارة البوابة…</main>;
  if (!authenticated) return <main className="v3-login v3-admin-login" dir="rtl"><section className="v3-login-card">
    <Link href="/" className="v3-back">← العودة إلى البوابة الرئيسية</Link><span className="v3-login-icon">◈</span><small>هوية الإدارة</small>
    <h1>دخول إدارة البوابة</h1><p>أدخل اسم المدير فقط للوصول إلى لوحة الإدارة.</p>
    <form onSubmit={login}><label>اسم المدير<input value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" placeholder="حسن علي" required /></label>
      {message && <p className="v3-error">{message}</p>}<button className="v3-primary" disabled={busy}>{busy ? "جارٍ التحقق…" : "دخول الإدارة"}</button></form>
  </section><aside><b>إدارة مركزية واضحة</b><h2>المعلمون والمواد<br />في مكان واحد</h2><p>أنشئ حساب المعلم وحدد المادة والصف والفصل لكل تكليف.</p></aside></main>;

  return <main className="v3-admin" dir="rtl"><header><div><small>لوحة التحكم المركزية</small><h1>إدارة بوابة أستاذ لحوني</h1><p>إضافة المعلمين وتحديد المادة والصف والفصل لكل تكليف.</p></div><Link href="/">العودة إلى البوابة الرئيسية</Link></header>
    <section className="v3-stats"><article><strong>{teachers.length}</strong><span>معلم</span></article><article><strong>{teachers.filter(item => item.active).length}</strong><span>حساب مفعل</span></article><article><strong>{teachers.reduce((sum, teacher) => sum + teacher.assignments.length, 0)}</strong><span>تكليف دراسي</span></article></section>
    <div className="v3-admin-grid"><form className="v3-panel v3-create-teacher" onSubmit={createTeacher}><small>حساب جديد</small><h2>إضافة معلم</h2><p>اسم المعلم نفسه هو اسم الدخول.</p>
      <label>اسم المعلم<input value={name} onChange={event => setName(event.target.value)} required /></label><label>الرقم السري<input type="password" value={teacherPassword} onChange={event => setTeacherPassword(event.target.value)} minLength={8} required /></label>
      <AssignmentEditor rows={assignments} setRows={setAssignments} />{message && <p className="v3-notice">{message}</p>}<button className="v3-primary" disabled={busy}>{busy ? "جارٍ الإضافة…" : "إضافة المعلم"}</button></form>
      <section className="v3-panel v3-teachers"><small>الحسابات الحالية</small><h2>المعلمون</h2>{!teachers.length && <p className="v3-empty">لم تتم إضافة معلمين بعد.</p>}<div className="v3-teacher-list">{teachers.map(teacher => <article key={teacher.id}><span className="v3-avatar">{teacher.name.trim().charAt(0) || "م"}</span><div><strong>{teacher.name}</strong><p>{teacher.assignments.map(assignmentLabel).join(" • ") || "لا توجد مواد"}</p><small className={teacher.active ? "active" : "inactive"}>{teacher.active ? "حساب مفعل" : "حساب متوقف"}</small></div><div className="v3-row-actions"><button onClick={() => { setEditing({ ...teacher, assignments: teacher.assignments.length ? teacher.assignments : [emptyAssignment()] }); setResetPassword(""); }}>تعديل الحساب</button><button onClick={() => toggle(teacher)}>{teacher.active ? "إيقاف" : "تفعيل"}</button><button className="danger" onClick={() => remove(teacher)}>حذف</button></div></article>)}</div></section>
    </div>
    {editing && <div className="v3-modal" role="dialog" aria-modal="true"><section><header><div><small>إدارة الحساب</small><h2>تعديل {editing.name}</h2></div><button onClick={() => setEditing(null)}>×</button></header><label>اسم المعلم<input value={editing.name} onChange={event => setEditing({ ...editing, name: event.target.value })} /></label><label>تغيير الرقم السري <small>اتركه فارغًا إذا لم ترد تغييره</small><input type="password" minLength={8} value={resetPassword} onChange={event => setResetPassword(event.target.value)} /></label><AssignmentEditor rows={editing.assignments} setRows={rows => setEditing({ ...editing, assignments: rows })} /><div className="v3-modal-actions"><button onClick={() => setEditing(null)}>إلغاء</button><button className="v3-primary" onClick={saveTeacher} disabled={busy}>حفظ التعديلات</button></div></section></div>}
  </main>;
}
