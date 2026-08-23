"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import "../admin/admin-rebuild.css";

type Assignment = { id: string; subjectId: string; label?: string; grade?: string; section?: string };
type Teacher = { id: string; name: string; active: boolean; assignments: Assignment[] };
type Overview = { supervisor: { name: string; subjectIds: string[]; permissionLevel: string }; teachers: Teacher[] };

const SUBJECTS: Record<string,string> = { history:"التاريخ", mathematics:"الرياضيات", physics:"الفيزياء", chemistry:"الكيمياء", biology:"علم الأحياء", english:"اللغة الإنجليزية", arabic:"اللغة العربية", "quran-tafsir":"القرآن والتفسير", "digital-technology":"التقنية الرقمية", "critical-thinking":"التفكير الناقد", "islamic-studies":"الدراسات الإسلامية", "social-sciences":"العلوم الاجتماعية", "environmental-science":"علوم البيئة", "fitness-health":"اللياقة والثقافة الصحية", tawhid:"التوحيد", arts:"الفنون", "linguistic-competencies":"الكفايات اللغوية" };

export default function SupervisorPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/supervisor/overview", { cache: "no-store" });
    if (!response.ok) { setAuthenticated(false); return; }
    const data = await response.json(); setOverview(data); setAuthenticated(true);
    if (!subjectId && data.supervisor?.subjectIds?.length) setSubjectId(data.supervisor.subjectIds[0]);
  }
  useEffect(() => { void load(); }, []);

  async function login(event: FormEvent) {
    event.preventDefault(); setMessage("");
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
    const data = await response.json();
    if (!response.ok || data.role !== "supervisor") { setMessage(data.message || "بيانات الدخول غير صحيحة"); return; }
    await load();
  }

  const filteredTeachers = useMemo(() => (overview?.teachers || []).filter(teacher => teacher.assignments.some(item => item.subjectId === subjectId)), [overview, subjectId]);
  const selectedTeacher = filteredTeachers.find(item => item.id === teacherId) || null;
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); setAuthenticated(false); setOverview(null); }

  if (authenticated === null) return <main className="admin2 admin2-login" dir="rtl"><section className="admin2-login-card"><p>جارٍ تجهيز بوابة المنسق…</p></section></main>;
  if (!authenticated) return <main className="admin2 admin2-login" dir="rtl"><section className="admin2-login-card"><Link className="admin2-back" href="/">← الرئيسية</Link><div className="admin2-brand"><span className="admin2-mark">م</span><div><strong>بوابة منسق المادة</strong><small>متابعة المعلمين والمواد</small></div></div><h1>دخول المنسق</h1><form onSubmit={login}><label>اسم الدخول<input value={username} onChange={e => setUsername(e.target.value)} required /></label><label>الرقم السري<input type="password" value={password} onChange={e => setPassword(e.target.value)} required /></label>{message && <p className="admin2-message">{message}</p>}<button className="admin2-btn primary">دخول</button></form></section></main>;

  return <main className="admin2" dir="rtl"><div className="admin2-shell">
    <header className="admin2-head"><div><small>بوابة منسق المادة</small><h1>مرحبًا {overview?.supervisor.name}</h1><p>اختر المادة ثم المعلم، وبعدها افتح لوحة المعلم للعرض.</p></div><div className="admin2-head-actions"><Link className="admin2-btn soft" href="/">الرئيسية</Link><button className="admin2-btn danger" onClick={() => void logout()}>تسجيل الخروج</button></div></header>
    <section className="admin2-stats"><article><span>المواد</span><strong>{overview?.supervisor.subjectIds.length || 0}</strong></article><article><span>المعلمون</span><strong>{overview?.teachers.length || 0}</strong></article><article><span>الصلاحية</span><strong>{overview?.supervisor.permissionLevel === "view" ? "عرض" : overview?.supervisor.permissionLevel === "comment" ? "تعليق" : "إدارة"}</strong></article></section>
    <section className="admin2-panel"><h2>اختيار نطاق المتابعة</h2><div className="admin2-form"><label>المادة<select value={subjectId} onChange={e => { setSubjectId(e.target.value); setTeacherId(""); }}>{overview?.supervisor.subjectIds.map(id => <option key={id} value={id}>{SUBJECTS[id] || id}</option>)}</select></label><label>المعلم<select value={teacherId} onChange={e => setTeacherId(e.target.value)}><option value="">اختر المعلم</option>{filteredTeachers.map(teacher => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}</select></label></div></section>
    <section className="admin2-panel"><h2>المعلمون ضمن الصلاحية</h2><div className="admin2-list">{filteredTeachers.length === 0 ? <div className="admin2-empty">لا يوجد معلم مرتبط بالمادة المختارة.</div> : filteredTeachers.map(teacher => <article className="admin2-teacher" key={teacher.id}><span className="admin2-avatar">{teacher.name.charAt(0)}</span><div><strong>{teacher.name}</strong><p>{teacher.assignments.filter(item => item.subjectId === subjectId).map(item => `${item.label || SUBJECTS[item.subjectId] || item.subjectId}${item.grade ? ` — ${item.grade}` : ""}${item.section ? ` — فصل ${item.section}` : ""}`).join(" • ")}</p><span className={`admin2-state ${teacher.active ? "on" : "off"}`}>{teacher.active ? "مفعل" : "متوقف"}</span></div><div className="admin2-actions"><button className="admin2-btn primary" onClick={() => setTeacherId(teacher.id)}>فتح لوحة المعلم للعرض</button></div></article>)}</div></section>
    {selectedTeacher && <section className="admin2-panel"><h2>لوحة {selectedTeacher.name} — عرض المنسق</h2><p>أنت الآن داخل نطاق هذا المعلم ومادة {SUBJECTS[subjectId] || subjectId}. هذه جلسة عرض للمنسق ولا تستخدم رقم المعلم السري ولا تسمح بتغيير بياناته.</p><div className="admin2-stats"><article><span>المادة</span><strong>{SUBJECTS[subjectId] || subjectId}</strong></article><article><span>التكليفات</span><strong>{selectedTeacher.assignments.filter(item => item.subjectId === subjectId).length}</strong></article><article><span>الحالة</span><strong>{selectedTeacher.active ? "مفعل" : "متوقف"}</strong></article></div></section>}
  </div></main>;
}
