"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import "./admin.css";

type Teacher = { id: string; username: string; name: string; active: boolean; subjectIds: string[] };
const SUBJECTS = [
  ["history", "التاريخ"], ["geography", "الجغرافيا"], ["critical-thinking", "التفكير الناقد"],
  ["islamic-studies", "الدراسات الإسلامية"], ["quran", "القرآن الكريم والتفسير"], ["arabic", "اللغة العربية"],
  ["english", "اللغة الإنجليزية"], ["mathematics", "الرياضيات"], ["science", "العلوم"],
  ["digital-technology", "التقنية الرقمية"], ["art", "التربية الفنية"], ["physical-education", "التربية البدنية"],
] as const;

export default function AdminPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [teacherUsername, setTeacherUsername] = useState("");
  const [teacherPassword, setTeacherPassword] = useState("");
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/teachers", { cache: "no-store" });
    if (response.status === 401) { setAuthenticated(false); return; }
    const data = await response.json();
    setTeachers(data.teachers || []); setAuthenticated(true);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function login(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
    const data = await response.json(); setBusy(false);
    if (!response.ok || data.role !== "admin") return setMessage(data.message || "هذا الحساب لا يملك صلاحية الإدارة");
    setPassword(""); await load();
  }

  async function createTeacher(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    const response = await fetch("/api/admin/teachers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, username: teacherUsername, password: teacherPassword, subjectIds }) });
    const data = await response.json(); setBusy(false);
    if (!response.ok) return setMessage(data.message || "تعذر إنشاء الحساب");
    setName(""); setTeacherUsername(""); setTeacherPassword(""); setSubjectIds([]); setMessage("تم إنشاء حساب المعلم وعزل مواده بنجاح."); await load();
  }

  async function toggle(teacher: Teacher) {
    await fetch(`/api/admin/teachers/${teacher.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !teacher.active }) });
    await load();
  }

  if (authenticated === null) return <main className="admin-loading">جارٍ تجهيز لوحة الإدارة…</main>;
  if (!authenticated) return <main className="admin-login" dir="rtl"><section><Link href="/">العودة للرئيسية</Link><span>إدارة البوابة</span><h1>دخول مدير النظام</h1><p>من هنا تنشئ حسابات المعلمين وتحدد المواد والصلاحيات.</p><form onSubmit={login}><label>اسم المستخدم<input value={username} onChange={(event) => setUsername(event.target.value)} required /></label><label>كلمة المرور<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label><small className="admin-password-hint">تلميح كلمة المرور: تاريخ ميلادي بالهجري</small>{message && <p className="admin-message error">{message}</p>}<button disabled={busy}>{busy ? "جارٍ الدخول…" : "دخول لوحة الإدارة"}</button></form></section></main>;

  return <main className="admin-page" dir="rtl">
    <header><div><span>لوحة التحكم المركزية</span><h1>إدارة بوابة أستاذ لحوني</h1><p>الحسابات والمواد والعزل من مكان واحد.</p></div><Link href="/">عرض البوابة</Link></header>
    <section className="admin-stats"><article><strong>{teachers.length}</strong><span>حساب معلم</span></article><article><strong>{teachers.filter((item) => item.active).length}</strong><span>حساب مفعل</span></article><article><strong>{new Set(teachers.flatMap((item) => item.subjectIds)).size}</strong><span>مادة مرتبطة</span></article></section>
    <section className="admin-grid"><form className="admin-card" onSubmit={createTeacher}><span>حساب جديد</span><h2>إضافة معلم</h2><label>اسم المعلم<input value={name} onChange={(event) => setName(event.target.value)} placeholder="مثال: حسن علي الطويل" required /></label><label>اسم المستخدم<input dir="ltr" value={teacherUsername} onChange={(event) => setTeacherUsername(event.target.value)} placeholder="hasan.altawil" required /></label><label>كلمة المرور المؤقتة<input dir="ltr" type="password" value={teacherPassword} onChange={(event) => setTeacherPassword(event.target.value)} minLength={8} required /></label><fieldset><legend>المواد المسموحة</legend>{SUBJECTS.map(([id, label]) => <label className="subject-check" key={id}><input type="checkbox" checked={subjectIds.includes(id)} onChange={(event) => setSubjectIds((current) => event.target.checked ? [...current, id] : current.filter((value) => value !== id))} /><span>{label}</span></label>)}</fieldset>{message && <p className="admin-message">{message}</p>}<button disabled={busy}>{busy ? "جارٍ الإنشاء…" : "إنشاء الحساب"}</button></form>
      <section className="admin-card teachers-card"><span>المعلمون</span><h2>الحسابات الحالية</h2>{!teachers.length && <p className="empty">لا توجد حسابات معلمين بعد.</p>}<div className="teacher-list">{teachers.map((teacher) => <article key={teacher.id}><div><strong>{teacher.name}</strong><small>@{teacher.username}</small><p>{teacher.subjectIds.map((id) => SUBJECTS.find(([key]) => key === id)?.[1] || id).join(" • ")}</p></div><button className={teacher.active ? "danger" : ""} onClick={() => toggle(teacher)}>{teacher.active ? "إيقاف" : "تفعيل"}</button></article>)}</div></section></section>
  </main>;
}
