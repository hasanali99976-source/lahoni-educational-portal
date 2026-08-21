"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import "./admin-rebuild.css";

type Assignment = { id?: string; subjectId: string; grade: string; section: string; label?: string };
type Teacher = { id: string; name: string; active: boolean; subjectIds: string[]; assignments: Assignment[] };

const SUBJECTS = [
  ["quran-tafsir", "القرآن والتفسير"], ["digital-technology", "التقنية الرقمية"], ["critical-thinking", "التفكير الناقد"],
  ["islamic-studies", "الدراسات الإسلامية"], ["arabic", "اللغة العربية"], ["social-sciences", "العلوم الاجتماعية"],
  ["environmental-science", "علوم البيئة"], ["mathematics", "الرياضيات"], ["english", "اللغة الإنجليزية"],
  ["physics", "الفيزياء"], ["chemistry", "الكيمياء"], ["biology", "علم الأحياء"], ["fitness-health", "اللياقة والثقافة الصحية"],
  ["tawhid", "التوحيد"], ["arts", "الفنون"], ["history", "التاريخ"], ["linguistic-competencies", "الكفايات اللغوية"],
] as const;
const GRADES = ["الأول الثانوي", "الثاني الثانوي", "الثالث الثانوي"] as const;
const SECTIONS = ["الكل", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨"] as const;
const emptyAssignment = (): Assignment => ({ subjectId: "", grade: "", section: "" });

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeout = 10000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  try { return await fetch(input, { ...init, signal: controller.signal }); }
  finally { window.clearTimeout(timer); }
}

function AssignmentEditor({ rows, setRows }: { rows: Assignment[]; setRows: (rows: Assignment[]) => void }) {
  const update = (index: number, key: keyof Assignment, value: string) => setRows(rows.map((row, i) => i === index ? { ...row, [key]: value } : row));
  return <div className="admin2-assignment-box">
    {rows.map((row, index) => <div className="admin2-assignment-row" key={index}>
      <label>المادة<select required value={row.subjectId} onChange={e => update(index, "subjectId", e.target.value)}><option value="">اختر المادة</option>{SUBJECTS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <label>الصف<select required value={row.grade} onChange={e => update(index, "grade", e.target.value)}><option value="">اختر الصف</option>{GRADES.map(grade => <option key={grade}>{grade}</option>)}</select></label>
      <label>الفصل<select required value={row.section} onChange={e => update(index, "section", e.target.value)}><option value="">اختر الفصل</option>{SECTIONS.map(section => <option key={section}>{section === "الكل" ? "جميع الفصول" : section}</option>)}</select></label>
      {rows.length > 1 && <button type="button" className="admin2-btn danger" onClick={() => setRows(rows.filter((_, i) => i !== index))}>حذف</button>}
    </div>)}
    <button type="button" className="admin2-btn soft" onClick={() => setRows([...rows, emptyAssignment()])}>+ إضافة صف أو فصل آخر</button>
  </div>;
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [username, setUsername] = useState("");
  const [teachers, setTeachers] = useState<Teacher[]>([]);
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
      if (!response.ok) throw new Error("load");
      const data = await response.json();
      setTeachers(Array.isArray(data.teachers) ? data.teachers : []);
      setAuthenticated(true);
    } catch {
      setAuthenticated(false);
      setMessage("تعذر تحميل جلسة الإدارة. سجّل الدخول بالاسم مرة أخرى.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function login(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetchWithTimeout("/api/auth/admin-name-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username }) });
      const data = await response.json();
      if (!response.ok || data.role !== "admin") { setMessage(data.message || "اسم المدير غير صحيح"); return; }
      await load();
    } catch { setMessage("تعذر تسجيل الدخول الآن. حاول مرة أخرى."); }
    finally { setBusy(false); }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", cache: "no-store" }).catch(() => undefined);
    setAuthenticated(false); setTeachers([]); setUsername(""); setMessage("");
  }

  async function createTeacher(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/teachers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, password: teacherPassword, assignments }) });
      const data = await response.json();
      if (!response.ok) { setMessage(data.message || "تعذر إضافة المعلم"); return; }
      setName(""); setTeacherPassword(""); setAssignments([emptyAssignment()]); setMessage("تمت إضافة المعلم وربطه بالمواد والفصول."); await load();
    } catch { setMessage("تعذر إضافة المعلم الآن."); }
    finally { setBusy(false); }
  }

  async function saveTeacher() {
    if (!editing) return; setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/teachers/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: editing.name, assignments: editing.assignments, password: resetPassword || undefined }) });
      const data = await response.json();
      if (!response.ok) { setMessage(data.message || "تعذر حفظ التعديل"); return; }
      setEditing(null); setResetPassword(""); setMessage("تم حفظ تعديلات المعلم."); await load();
    } catch { setMessage("تعذر حفظ التعديل الآن."); }
    finally { setBusy(false); }
  }

  async function toggle(teacher: Teacher) {
    await fetch(`/api/admin/teachers/${teacher.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !teacher.active }) });
    await load();
  }

  async function remove(teacher: Teacher) {
    if (!confirm(`حذف حساب ${teacher.name}؟`)) return;
    const response = await fetch(`/api/admin/teachers/${teacher.id}`, { method: "DELETE" });
    if (!response.ok) { setMessage("تعذر حذف الحساب"); return; }
    setMessage("تم حذف حساب المعلم."); await load();
  }

  const subjectLabel = (id: string) => SUBJECTS.find(([key]) => key === id)?.[1] || id;
  const assignmentLabel = (a: Assignment) => a.label || `${subjectLabel(a.subjectId)} — ${a.grade}${a.section ? ` — ${a.section === "الكل" ? "جميع الفصول" : `فصل ${a.section}`}` : ""}`;

  if (authenticated === null) return <main className="admin2 admin2-login" dir="rtl"><section className="admin2-login-card"><div className="admin2-brand"><span className="admin2-mark">إ</span><div><strong>بوابة أستاذ لحوني</strong><small>إدارة النظام</small></div></div><p>جارٍ تجهيز لوحة الإدارة…</p></section></main>;

  if (!authenticated) return <main className="admin2 admin2-login" dir="rtl"><section className="admin2-login-card">
    <Link className="admin2-back" href="/">← العودة إلى البوابة الرئيسية</Link>
    <div className="admin2-brand"><span className="admin2-mark">إ</span><div><strong>بوابة أستاذ لحوني</strong><small>إدارة النظام</small></div></div>
    <h1>دخول الإدارة</h1><p>اكتب اسم المدير فقط. لا توجد كلمة مرور لبوابة الإدارة.</p>
    <form onSubmit={login}><label>اسم المدير<input value={username} onChange={e => setUsername(e.target.value)} placeholder="حسن علي" autoComplete="username" required /></label>{message && <p className="admin2-message">{message}</p>}<button className="admin2-btn primary" disabled={busy}>{busy ? "جارٍ الدخول…" : "دخول الإدارة"}</button></form>
  </section></main>;

  return <main className="admin2" dir="rtl"><div className="admin2-shell">
    <header className="admin2-head"><div><small>لوحة الإدارة الجديدة</small><h1>إدارة بوابة أستاذ لحوني</h1><p>الحسابات والمواد والصفوف والفصول في مكان واحد.</p></div><div className="admin2-head-actions"><Link className="admin2-btn soft" href="/">الرئيسية</Link><button className="admin2-btn danger" onClick={logout}>تسجيل الخروج</button></div></header>
    <section className="admin2-stats"><article><span>عدد المعلمين</span><strong>{teachers.length}</strong></article><article><span>الحسابات المفعلة</span><strong>{teachers.filter(t => t.active).length}</strong></article><article><span>التكليفات الدراسية</span><strong>{teachers.reduce((sum, t) => sum + (t.assignments?.length || 0), 0)}</strong></article></section>
    {message && <p className="admin2-message">{message}</p>}
    <div className="admin2-grid">
      <section className="admin2-panel"><h2>إضافة معلم</h2><p>أنشئ حسابًا واحدًا للمعلم ثم أضف له أكثر من صف أو فصل عند الحاجة.</p><form className="admin2-form" onSubmit={createTeacher}><label>اسم المعلم<input value={name} onChange={e => setName(e.target.value)} placeholder="اسم المعلم" required /></label><label>الرقم السري للمعلم<input type="password" value={teacherPassword} onChange={e => setTeacherPassword(e.target.value)} minLength={8} placeholder="٨ خانات فأكثر" required /></label><AssignmentEditor rows={assignments} setRows={setAssignments} /><button className="admin2-btn primary" disabled={busy}>{busy ? "جارٍ الحفظ…" : "إضافة المعلم"}</button></form></section>
      <section className="admin2-panel"><h2>المعلمون الحاليون</h2><p>هذه البيانات تُقرأ من نفس قاعدة البيانات السابقة دون نقل أو حذف.</p><div className="admin2-list">{teachers.length === 0 ? <div className="admin2-empty">لا توجد حسابات معلمين.</div> : teachers.map(teacher => <article className="admin2-teacher" key={teacher.id}><span className="admin2-avatar">{teacher.name.trim().charAt(0) || "م"}</span><div><strong>{teacher.name}</strong><p>{teacher.assignments?.map(assignmentLabel).join(" • ") || "لا توجد تكليفات"}</p><span className={`admin2-state ${teacher.active ? "on" : "off"}`}>{teacher.active ? "مفعل" : "متوقف"}</span></div><div className="admin2-actions"><button className="admin2-btn soft" onClick={() => { setEditing({ ...teacher, assignments: teacher.assignments?.length ? teacher.assignments : [emptyAssignment()] }); setResetPassword(""); }}>تعديل</button><button className="admin2-btn soft" onClick={() => void toggle(teacher)}>{teacher.active ? "إيقاف" : "تفعيل"}</button><button className="admin2-btn danger" onClick={() => void remove(teacher)}>حذف</button></div></article>)}</div></section>
    </div>
    {editing && <div className="admin2-modal"><section className="admin2-modal-card"><header className="admin2-modal-head"><h2>تعديل {editing.name}</h2><button className="admin2-btn soft" onClick={() => setEditing(null)}>إغلاق</button></header><div className="admin2-form"><label>اسم المعلم<input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></label><label>تغيير الرقم السري للمعلم <small>اتركه فارغًا إذا لم ترغب بتغييره</small><input type="password" minLength={8} value={resetPassword} onChange={e => setResetPassword(e.target.value)} /></label><AssignmentEditor rows={editing.assignments} setRows={rows => setEditing({ ...editing, assignments: rows })} /></div><div className="admin2-modal-actions"><button className="admin2-btn soft" onClick={() => setEditing(null)}>إلغاء</button><button className="admin2-btn primary" disabled={busy} onClick={() => void saveTeacher()}>حفظ التعديلات</button></div></section></div>}
  </div></main>;
}
