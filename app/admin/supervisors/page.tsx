"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import "../admin-rebuild.css";

type Teacher = { id: string; name: string; active: boolean; subjectIds: string[] };
type Supervisor = { id: string; name: string; username: string; active: boolean; subjectIds: string[]; teacherIds: string[]; permissionLevel: "view" | "comment" | "manage" };

const SUBJECTS = [["quran-tafsir","القرآن والتفسير"],["digital-technology","التقنية الرقمية"],["critical-thinking","التفكير الناقد"],["islamic-studies","الدراسات الإسلامية"],["arabic","اللغة العربية"],["social-sciences","العلوم الاجتماعية"],["environmental-science","علوم البيئة"],["mathematics","الرياضيات"],["english","اللغة الإنجليزية"],["physics","الفيزياء"],["chemistry","الكيمياء"],["biology","علم الأحياء"],["fitness-health","اللياقة والثقافة الصحية"],["tawhid","التوحيد"],["arts","الفنون"],["history","التاريخ"],["linguistic-competencies","الكفايات اللغوية"]] as const;

export default function SupervisorsAdminPage() {
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [teacherIds, setTeacherIds] = useState<string[]>([]);
  const [permissionLevel, setPermissionLevel] = useState<Supervisor["permissionLevel"]>("view");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/supervisors", { cache: "no-store" });
    if (response.status === 401) { window.location.href = "/admin"; return; }
    const data = await response.json();
    setSupervisors(data.supervisors || []);
    setTeachers(data.teachers || []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  function toggleSubject(subjectId: string) {
    if (subjectIds.includes(subjectId)) {
      setSubjectIds(subjectIds.filter(id => id !== subjectId));
      const validTeacherIds = teachers.filter(teacher => teacher.subjectIds.some(id => id !== subjectId && subjectIds.includes(id))).map(teacher => teacher.id);
      setTeacherIds(teacherIds.filter(id => validTeacherIds.includes(id)));
    } else {
      setSubjectIds([...subjectIds, subjectId]);
    }
  }

  function toggleTeacher(teacherId: string) {
    setTeacherIds(teacherIds.includes(teacherId) ? teacherIds.filter(id => id !== teacherId) : [...teacherIds, teacherId]);
  }

  async function createSupervisor(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    const response = await fetch("/api/admin/supervisors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, username, password, subjectIds, teacherIds, permissionLevel }) });
    const data = await response.json();
    if (!response.ok) setMessage(data.message || "تعذر إضافة المنسق");
    else { setName(""); setUsername(""); setPassword(""); setSubjectIds([]); setTeacherIds([]); setPermissionLevel("view"); setMessage("تمت إضافة المنسق بنجاح."); await load(); }
    setBusy(false);
  }

  async function toggle(supervisor: Supervisor) { await fetch(`/api/admin/supervisors/${supervisor.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !supervisor.active }) }); await load(); }
  async function remove(supervisor: Supervisor) { if (!confirm(`حذف حساب المنسق ${supervisor.name}؟`)) return; await fetch(`/api/admin/supervisors/${supervisor.id}`, { method: "DELETE" }); await load(); }
  const subjectLabel = (id: string) => SUBJECTS.find(item => item[0] === id)?.[1] || id;

  return <main className="admin2" dir="rtl"><div className="admin2-shell">
    <header className="admin2-head"><div><small>إدارة المنسقين</small><h1>منسقو المواد</h1><p>اختر المادة، وسيظهر معلموها مباشرة أسفلها.</p></div><div className="admin2-head-actions"><Link className="admin2-btn soft" href="/admin">العودة للإدارة</Link></div></header>
    {message && <p className="admin2-message">{message}</p>}
    <div className="admin2-grid">
      <section className="admin2-panel"><h2>إضافة منسق</h2><form className="admin2-form" onSubmit={createSupervisor}>
        <label>اسم المنسق<input value={name} onChange={e => setName(e.target.value)} required /></label>
        <label>اسم الدخول<input value={username} onChange={e => setUsername(e.target.value)} required /></label>
        <label>الرقم السري<input type="password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} required /></label>
        <label>نوع الصلاحية<select value={permissionLevel} onChange={e => setPermissionLevel(e.target.value as Supervisor["permissionLevel"])}><option value="view">عرض فقط</option><option value="comment">عرض وكتابة ملاحظات</option><option value="manage">إدارة كاملة دون إدارة المستخدمين</option></select></label>
        <div><strong>المواد والمعلمون</strong><div className="admin2-assignment-box">{SUBJECTS.map(([id,label]) => {
          const subjectTeachers = teachers.filter(teacher => teacher.active && teacher.subjectIds.includes(id));
          const selected = subjectIds.includes(id);
          return <div key={id} className="admin2-assignment-row" style={{alignItems:"flex-start"}}>
            <label style={{minWidth:"190px"}}><input type="checkbox" checked={selected} onChange={() => toggleSubject(id)} /> {label}</label>
            <div style={{flex:1}}>{selected ? (subjectTeachers.length ? subjectTeachers.map(teacher => <label key={teacher.id} style={{display:"block",marginBottom:"6px"}}><input type="checkbox" checked={teacherIds.includes(teacher.id)} onChange={() => toggleTeacher(teacher.id)} /> {teacher.name}</label>) : <span>لا يوجد معلم مرتبط بهذه المادة.</span>) : <span>اختر المادة لإظهار معلميها.</span>}</div>
          </div>;
        })}</div></div>
        <button className="admin2-btn primary" disabled={busy}>{busy ? "جارٍ الحفظ…" : "إضافة المنسق"}</button>
      </form></section>
      <section className="admin2-panel"><h2>المنسقون الحاليون</h2><div className="admin2-list">{supervisors.length === 0 ? <div className="admin2-empty">لا توجد حسابات منسقين.</div> : supervisors.map(supervisor => <article className="admin2-teacher" key={supervisor.id}><span className="admin2-avatar">{supervisor.name.charAt(0)}</span><div><strong>{supervisor.name}</strong><p>{supervisor.subjectIds.map(subjectLabel).join(" • ")}</p><p>{supervisor.teacherIds.length} معلم مرتبط</p><span className={`admin2-state ${supervisor.active ? "on" : "off"}`}>{supervisor.active ? "مفعل" : "متوقف"}</span></div><div className="admin2-actions"><button className="admin2-btn soft" onClick={() => void toggle(supervisor)}>{supervisor.active ? "إيقاف" : "تفعيل"}</button><button className="admin2-btn danger" onClick={() => void remove(supervisor)}>حذف</button></div></article>)}</div></section>
    </div>
  </div></main>;
}
