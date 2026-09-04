"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { SUBJECT_CONFIG } from "../../lib/subject-config";
import TeacherActivityLeaderboard from "./teacher-activity-leaderboard";
import "./admin-rebuild.css";

type Assignment = { id?: string; subjectId: string; grade: string; section: string; label?: string };
type Teacher = { id: string; name: string; active: boolean; subjectIds: string[]; assignments: Assignment[] };

const SUBJECTS = Object.values(SUBJECT_CONFIG)
  .map(item => [item.key, item.label] as const)
  .sort((a, b) => a[1].localeCompare(b[1], "ar"));
const GRADES = ["الأول الثانوي", "الثاني الثانوي", "الثالث الثانوي"] as const;
const SECTIONS = ["الكل", "١", "٢", "٣", "٤", "٥", "٦", "٧"] as const;
const emptyAssignment = (): Assignment => ({ subjectId: "", grade: "", section: "" });

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeout = 10000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  try { return await fetch(input, { ...init, signal: controller.signal, cache: "no-store" }); }
  finally { window.clearTimeout(timer); }
}

function AssignmentEditor({ rows, setRows }: { rows: Assignment[]; setRows: (rows: Assignment[]) => void }) {
  const update = (index: number, key: keyof Assignment, value: string) => setRows(rows.map((row, i) => i === index ? { ...row, [key]: value } : row));
  return <div className="admin2-assignment-box">
    <div className="admin2-assignment-title"><span>ربط العمل الدراسي</span><small>يمكن للمعلم أن يكون مرتبطًا بأكثر من مادة أو مرحلة.</small></div>
    {rows.map((row, index) => <div className="admin2-assignment-row" key={index}>
      <label>المادة<select required value={row.subjectId} onChange={event => update(index, "subjectId", event.target.value)}><option value="">اختر المادة</option>{SUBJECTS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <label>الصف<select required value={row.grade} onChange={event => update(index, "grade", event.target.value)}><option value="">اختر الصف</option>{GRADES.map(item => <option key={item}>{item}</option>)}</select></label>
      <label>الفصل<select required value={row.section} onChange={event => update(index, "section", event.target.value)}><option value="">اختر الفصل</option>{SECTIONS.map(item => <option key={item}>{item === "الكل" ? "جميع الفصول" : item}</option>)}</select></label>
      {rows.length > 1 && <button type="button" className="admin2-btn danger compact" onClick={() => setRows(rows.filter((_, i) => i !== index))}>حذف</button>}
    </div>)}
    <button type="button" className="admin2-btn soft admin2-add-assignment" onClick={() => setRows([...rows, emptyAssignment()])}>+ إضافة تكليف آخر</button>
  </div>;
}

function arabicNumber(value: number) {
  return new Intl.NumberFormat("ar-SA-u-nu-arab").format(value || 0);
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
  const [deleting, setDeleting] = useState<Teacher | null>(null);
  const [deleteSubjectData, setDeleteSubjectData] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetchWithTimeout("/api/admin/teachers");
      if (response.status === 401 || response.status === 403) { setAuthenticated(false); return; }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "load");
      setTeachers(Array.isArray(data.teachers) ? data.teachers : []);
      setAuthenticated(true);
      if (data.databaseUnavailable) setMessage(data.message || "قاعدة البيانات غير متاحة مؤقتًا.");
      else setMessage(current => current.includes("قاعدة البيانات") || current.includes("ضغط") ? "" : current);
    } catch {
      setAuthenticated(false);
      setMessage("تعذر التحقق من جلسة الإدارة الآن. حاول فتح الصفحة مرة أخرى.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function login(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetchWithTimeout("/api/auth/admin-name-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.role !== "admin") { setMessage(data.message || "اسم المدير غير صحيح"); return; }
      setAuthenticated(true); await load();
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
      const response = await fetch("/api/admin/teachers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, password: teacherPassword, assignments }), cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setMessage(data.message || "تعذر إضافة المعلم"); return; }
      setName(""); setTeacherPassword(""); setAssignments([emptyAssignment()]); setShowCreate(false);
      setMessage("تمت إضافة المعلم وربطه بالمواد والصفوف والفصول."); await load();
    } catch { setMessage("تعذر إضافة المعلم الآن."); }
    finally { setBusy(false); }
  }

  async function saveTeacher() {
    if (!editing) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/teachers/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: editing.name, assignments: editing.assignments, password: resetPassword || undefined }), cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setMessage(data.message || "تعذر حفظ التعديل"); return; }
      setEditing(null); setResetPassword(""); setMessage("تم حفظ تعديلات المعلم وتحديث المواد."); await load();
    } catch { setMessage("تعذر حفظ التعديل الآن."); }
    finally { setBusy(false); }
  }

  async function toggle(teacher: Teacher) {
    setBusy(true);
    try {
      await fetch(`/api/admin/teachers/${teacher.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !teacher.active }), cache: "no-store" });
      await load();
    } finally { setBusy(false); }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true); setMessage("");
    try {
      const suffix = deleteSubjectData ? "?deleteSubjectData=1" : "";
      const response = await fetch(`/api/admin/teachers/${deleting.id}${suffix}`, { method: "DELETE", cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setMessage(data.message || "تعذر حذف الحساب"); return; }
      const teacherName = deleting.name;
      const removeData = deleteSubjectData;
      setDeleting(null); setDeleteSubjectData(false);
      setMessage(removeData
        ? `تم حذف حساب ${teacherName} وبيانات مواده وفتح فصوله للمعلمين الآخرين.`
        : `تم حذف حساب ${teacherName} مع حفظ بيانات المواد والدرجات القديمة، وفتح فصوله للمعلمين الآخرين.`);
      await load();
    } catch { setMessage("تعذر إكمال الحذف الآن."); }
    finally { setBusy(false); }
  }

  const subjectLabel = (id: string) => SUBJECTS.find(([key]) => key === id)?.[1] || id;
  const assignmentLabel = (assignment: Assignment) => assignment.label || `${subjectLabel(assignment.subjectId)} — ${assignment.grade}${assignment.section ? ` — ${assignment.section === "الكل" ? "جميع الفصول" : `فصل ${assignment.section}`}` : ""}`;
  const uniqueSubjectCount = useMemo(() => new Set(teachers.flatMap(item => item.subjectIds || [])).size, [teachers]);
  const assignmentCount = useMemo(() => teachers.reduce((sum, item) => sum + (item.assignments?.length || 0), 0), [teachers]);
  const activeCount = useMemo(() => teachers.filter(item => item.active).length, [teachers]);
  const inactiveCount = teachers.length - activeCount;
  const filteredTeachers = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("ar");
    if (!term) return teachers;
    return teachers.filter(teacher => teacher.name.toLocaleLowerCase("ar").includes(term) || teacher.assignments?.some(assignment => assignmentLabel(assignment).toLocaleLowerCase("ar").includes(term)));
  }, [teachers, search]);

  if (authenticated === null) return <main className="admin2 admin2-login" dir="rtl"><section className="admin2-login-card"><div className="admin2-brand"><span className="admin2-mark">إ</span><div><strong>بوابة أستاذ لحوني</strong><small>مركز قيادة الإدارة</small></div></div><p>جارٍ تجهيز لوحة الإدارة الذكية…</p></section></main>;

  if (!authenticated) return <main className="admin2 admin2-login" dir="rtl"><section className="admin2-login-card">
    <Link className="admin2-back" href="/">← العودة إلى البوابة الرئيسية</Link>
    <div className="admin2-brand"><span className="admin2-mark">إ</span><div><strong>بوابة أستاذ لحوني</strong><small>مركز قيادة الإدارة</small></div></div>
    <h1>دخول الإدارة</h1><p>دخول مباشر وآمن إلى مركز إدارة المعلمين والطلاب ومتابعة العمل الفعلي داخل البوابة.</p>
    <form onSubmit={login}><label>اسم المدير<input value={username} onChange={event => setUsername(event.target.value)} placeholder="اسم المدير" autoComplete="username" required /></label>{message && <p className="admin2-message">{message}</p>}<button className="admin2-btn primary" disabled={busy}>{busy ? "جارٍ الدخول…" : "دخول الإدارة"}</button></form>
  </section></main>;

  return <main className="admin2 admin-smart-command" dir="rtl"><div className="admin2-shell">
    <header className="admin2-head">
      <div><small>تبويب المعلمين</small><h1>مركز قيادة المعلمين</h1><p>إدارة الحسابات والتكليفات ومتابعة الاستخدام الحقيقي للبوابة من شاشة واحدة.</p></div>
      <div className="admin2-head-actions"><button className="admin2-btn soft" onClick={() => void load()} disabled={busy}>تحديث البيانات</button><button className="admin2-btn danger" onClick={logout}>تسجيل الخروج</button></div>
    </header>

    <section className="admin2-stats">
      <article><span>عدد المعلمين</span><strong>{arabicNumber(teachers.length)}</strong><small>حسابات مسجلة</small></article>
      <article><span>الحسابات المفعلة</span><strong>{arabicNumber(activeCount)}</strong><small>{inactiveCount ? `${arabicNumber(inactiveCount)} متوقفة` : "جميعها فعالة"}</small></article>
      <article><span>التكليفات الدراسية</span><strong>{arabicNumber(assignmentCount)}</strong><small>مادة / صف / فصل</small></article>
      <article><span>المواد المشغلة</span><strong>{arabicNumber(uniqueSubjectCount)}</strong><small>ضمن البوابة</small></article>
    </section>

    <TeacherActivityLeaderboard />

    {message && <p className="admin2-message admin2-global-message">{message}</p>}

    <section className="admin-teacher-commandbar">
      <div className="admin-teacher-search"><span>⌕</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="ابحث باسم المعلم أو المادة أو الصف…" /><small>{arabicNumber(filteredTeachers.length)} نتيجة</small></div>
      <button type="button" className="admin2-btn primary admin-create-trigger" onClick={() => setShowCreate(value => !value)}>{showCreate ? "إغلاق إضافة معلم" : "+ إضافة معلم"}</button>
    </section>

    {showCreate && <section className="admin2-panel admin-create-panel">
      <header className="admin-panel-heading"><div><small>حساب جديد</small><h2>إضافة معلم وربط عمله</h2><p>أنشئ الحساب ثم اربطه بالمادة والمرحلة المطلوبة. يمكن تعديل الربط لاحقًا بدون فقد البيانات.</p></div><button type="button" className="admin2-btn soft" onClick={() => setShowCreate(false)}>إغلاق</button></header>
      <form className="admin2-form admin-create-form" onSubmit={createTeacher}>
        <div className="admin-create-credentials"><label>اسم المعلم<input value={name} onChange={event => setName(event.target.value)} placeholder="اسم المعلم" required /></label><label>الرقم السري للمعلم<input type="password" value={teacherPassword} onChange={event => setTeacherPassword(event.target.value)} minLength={8} placeholder="٨ خانات فأكثر" required /></label></div>
        <AssignmentEditor rows={assignments} setRows={setAssignments} />
        <div className="admin-create-submit"><span>سيظهر الحساب مباشرة في بوابة المعلم بعد الحفظ.</span><button className="admin2-btn primary" disabled={busy}>{busy ? "جارٍ الحفظ…" : "حفظ وإضافة المعلم"}</button></div>
      </form>
    </section>}

    <section className="admin2-panel admin-teachers-panel">
      <header className="admin-panel-heading"><div><small>إدارة الحسابات</small><h2>المعلمون الحاليون</h2><p>التعديل والتفعيل والحذف من نفس القائمة، مع إبقاء البيانات القديمة آمنة عند الحاجة.</p></div><span className="admin-live-indicator"><i /> بيانات حية</span></header>
      <div className="admin2-list">{filteredTeachers.length === 0 ? <div className="admin2-empty">{search ? "لا توجد نتائج مطابقة للبحث." : "لا توجد حسابات معلمين."}</div> : filteredTeachers.map(teacher => <article className="admin2-teacher" key={teacher.id}>
        <span className="admin2-avatar">{teacher.name.trim().charAt(0) || "م"}</span>
        <div className="admin-teacher-copy"><div className="admin-teacher-name-row"><strong>{teacher.name}</strong><span className={`admin2-state ${teacher.active ? "on" : "off"}`}>{teacher.active ? "مفعل" : "متوقف"}</span></div><p>{teacher.assignments?.map(assignmentLabel).join(" • ") || "لا توجد تكليفات"}</p><small>{arabicNumber(teacher.assignments?.length || 0)} تكليفات دراسية</small></div>
        <div className="admin2-actions"><button className="admin2-btn soft" onClick={() => { setEditing({ ...teacher, assignments: teacher.assignments?.length ? teacher.assignments : [emptyAssignment()] }); setResetPassword(""); }}>تعديل</button><button className="admin2-btn soft" onClick={() => void toggle(teacher)} disabled={busy}>{teacher.active ? "إيقاف" : "تفعيل"}</button><button className="admin2-btn danger" onClick={() => { setDeleting(teacher); setDeleteSubjectData(false); }}>حذف</button></div>
      </article>)}</div>
    </section>

    {editing && <div className="admin2-modal"><section className="admin2-modal-card"><header className="admin2-modal-head"><div><small>تعديل الحساب</small><h2>{editing.name}</h2></div><button className="admin2-btn soft" onClick={() => setEditing(null)}>إغلاق</button></header><div className="admin2-form"><label>اسم المعلم<input value={editing.name} onChange={event => setEditing({ ...editing, name: event.target.value })} /></label><label>تغيير الرقم السري <small>اتركه فارغًا إذا لم ترغب بتغييره</small><input type="password" minLength={8} value={resetPassword} onChange={event => setResetPassword(event.target.value)} /></label><AssignmentEditor rows={editing.assignments} setRows={rows => setEditing({ ...editing, assignments: rows })} /></div><div className="admin2-modal-actions"><button className="admin2-btn soft" onClick={() => setEditing(null)}>إلغاء</button><button className="admin2-btn primary" disabled={busy} onClick={() => void saveTeacher()}>حفظ التعديلات</button></div></section></div>}

    {deleting && <div className="admin2-modal"><section className="admin2-modal-card"><header className="admin2-modal-head"><div><small>صلاحيات الحذف</small><h2>حذف حساب {deleting.name}</h2></div><button className="admin2-btn soft" onClick={() => setDeleting(null)}>إغلاق</button></header><p>اختر هل تُحفظ درجات وبيانات مواد المعلم القديمة أم تُحذف معها. في الحالتين ستُفتح فصوله للمعلمين الآخرين.</p><label className="admin2-delete-choice"><input type="checkbox" checked={deleteSubjectData} onChange={event => setDeleteSubjectData(event.target.checked)} /><span><strong>حذف بيانات المواد والدرجات التابعة لهذا المعلم</strong><small>اترك الخيار غير محدد لحذف الحساب فقط مع حفظ البيانات القديمة.</small></span></label><div className="admin2-modal-actions"><button className="admin2-btn soft" onClick={() => setDeleting(null)}>إلغاء</button><button className="admin2-btn danger" disabled={busy} onClick={() => void confirmDelete()}>{busy ? "جارٍ الحذف…" : deleteSubjectData ? "حذف الحساب والمواد" : "حذف الحساب وحفظ المواد"}</button></div></section></div>}
  </div></main>;
}
