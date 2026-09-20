"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { getSubjectConfig, type SubjectKey } from "../../lib/subject-config";
import { readLocalGradePlan, setGradePlanCurrentTeacher } from "../../lib/grade-plan-local";
import { TeacherClientContext, type TeacherClientAssignment, type TeacherClientSubject } from "../../lib/teacher-client";
import "./print-theme.css";
import "./teacher-v3.css";
import "./subject-themes-v5.css";
import "./mobile-card-tables.css";
import "./teacher-daily-v70.css";
import "./teacher-professional-v71.css";
import "./attendance-professional-v71.css";
import "./teacher-ui-v107.css";
import "./teacher-student-shell.css";

type TeacherTab = { href: string; key: string; label: string; note: string; badge?: string };
type TeacherSession = { teacherId?: string; teacherName?: string; subjectKey?: SubjectKey; workspaceKey?: string; activeGrade?: number | null; activeGradeLabel?: string; subject?: string; subjects?: TeacherClientSubject[]; assignments?: TeacherClientAssignment[]; };

const sideTabs: TeacherTab[] = [
  { href: "/teacher/dashboard", key: "dashboard", label: "يومي", note: "ملخص عمل المعلم" },
  { href: "/teacher/students", key: "students", label: "الطلاب", note: "الفصول وبيانات الدخول" },
  { href: "/teacher/follow-up", key: "follow", label: "الإتقان والمتابعة", note: "تحليل طلاب المعلم" },
  { href: "/teacher/daily-report", key: "evaluation", label: "السجل اليومي", note: "إحصائيات العمل اليومي" },
  { href: "/teacher/diagnostics", key: "diagnostics", label: "الاختبارات التشخيصية", note: "الاختبارات والنتائج" },
  { href: "/teacher/grade-plan", key: "gradeplan", label: "خطة رصد المعلم", note: "الرصد والمتابعة" },
  { href: "/teacher/reports", key: "evaluation", label: "التقارير", note: "التقارير والطباعة" },
  { href: "/teacher/notes", key: "evaluation", label: "الرسائل", note: "الملاحظات والرسائل" },
];

const primaryTabs: TeacherTab[] = [
  { href: "/teacher/dashboard", key: "dashboard", label: "يومي", note: "مركز العمل اليومي" },
  { href: "/teacher/timetable", key: "timetable", label: "الجدول الدراسي", note: "جدول الحصص الأسبوعي" },
  { href: "/teacher/attendance", key: "attendance", label: "سجل المتابعة", note: "الحضور والمتابعة" },
  { href: "/teacher/grades", key: "grades", label: "التحصيل العلمي", note: "الرصد والحفظ" },
  { href: "/teacher/students", key: "students", label: "الطلاب", note: "الفصول وبيانات الدخول" },
];
const moreTabs: TeacherTab[] = [
  { href: "/teacher/diagnostics", key: "diagnostics", label: "الاختبارات التشخيصية", note: "النتائج والخطط العلاجية" },
  { href: "/teacher/follow-up", key: "follow", label: "الإتقان والمتابعة", note: "تحليل طلاب المعلم" },
  { href: "/teacher/discipline", key: "evaluation", label: "الانضباط", note: "التأخر والاستئذان" },
  { href: "/teacher/notes", key: "evaluation", label: "الملاحظات", note: "الملاحظات التربوية" },
  { href: "/teacher/report", key: "evaluation", label: "ملخص عمل المعلم", note: "المؤشرات والمقارنات" },
  { href: "/teacher/reports", key: "evaluation", label: "مركز التقارير", note: "التقارير والطباعة" },
  { href: "/teacher/portfolio", key: "portfolio", label: "ملف الإنجاز", note: "الشواهد والطباعة" },
  { href: "/teacher/grade-plan", key: "gradeplan", label: "خطة رصد المعلم", note: "توزيع الدرجات والرصد" },
  { href: "/teacher/ai", key: "ai", label: "المساعد الذكي", note: "تحليل وخطط مقترحة", badge: "AI" },
];

function TabIcon({ type }: { type: string }) {
  const common = { width: 23, height: 23, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (type === "dashboard") return <svg {...common}><path d="M4 13h6V4H4zM14 20h6V11h-6zM4 20h6v-3H4zM14 7h6V4h-6z"/></svg>;
  if (type === "grades") return <svg {...common}><path d="M4 19.5h16M6.5 16V9.5M11.8 16V5M17.1 16v-3.8"/><path d="m5.8 6.8 3-2.3 3 1.8 5.4-3"/></svg>;
  if (type === "gradeplan") return <svg {...common}><circle cx="12" cy="12" r="8.5"/><path d="M8 8h8M8 12h5M8 16h3"/><path d="m15.5 15 1.5 1.5 3-3"/></svg>;
  if (type === "attendance") return <svg {...common}><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.2 2"/></svg>;
  if (type === "timetable") return <svg {...common}><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M8 3v4M16 3v4M3.5 9.5h17M8 13h2M14 13h2M8 17h2M14 17h2"/></svg>;
  if (type === "preparation") return <svg {...common}><path d="M6 3.5h9l3 3V20H6z"/><path d="M14.5 3.5V7H18M9 11h6M9 15h6"/><path d="m8.5 18 1.2 1.2 2.2-2.4"/></svg>;
  if (type === "diagnostics") return <svg {...common}><path d="M9 3h6l1 2h3v16H5V5h3z"/><path d="m8 11 2 2 4-4M8 17h8"/></svg>;
  if (type === "evaluation") return <svg {...common}><rect x="4" y="4.5" width="16" height="16" rx="2"/><path d="M8 2.8v3.4M16 2.8v3.4M7.5 10h9M8 14h3M14 14h2M8 17h3"/></svg>;
  if (type === "portfolio") return <svg {...common}><path d="M8 4h8l1 3h3v13H4V7h3zM9 11h6M9 15h6"/></svg>;
  if (type === "follow") return <svg {...common}><path d="M12 3.5 20 7v5.5c0 4.8-3.3 7.6-8 8.8-4.7-1.2-8-4-8-8.8V7z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg>;
  if (type === "ai") return <svg {...common}><circle cx="12" cy="12" r="4"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/></svg>;
  if (type === "more") return <svg {...common}><circle cx="5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.3" fill="currentColor" stroke="none"/></svg>;
  return <svg {...common}><path d="M16 20v-1.8a4.2 4.2 0 0 0-4.2-4.2H7.2A4.2 4.2 0 0 0 3 18.2V20"/><circle cx="9.5" cy="7" r="3.5"/><path d="M17 10.5a3.3 3.3 0 0 0 0-6.4M20.5 20v-1.8a4.2 4.2 0 0 0-3.1-4"/></svg>;
}

export default function TeacherLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname(); const isLoginPage = pathname === "/teacher";
  const [ready,setReady]=useState(false); const [hasGradePlan,setHasGradePlan]=useState(false); const [menuOpen,setMenuOpen]=useState(false);
  const [teacherId,setTeacherId]=useState<string>(); const [teacherName,setTeacherName]=useState("المعلم"); const [subjectKey,setSubjectKey]=useState<SubjectKey>("history"); const [workspaceKey,setWorkspaceKey]=useState("history"); const [activeGrade,setActiveGrade]=useState<number|null>(null); const [activeGradeLabel,setActiveGradeLabel]=useState(""); const [subjectName,setSubjectName]=useState("التاريخ"); const [subjects,setSubjects]=useState<TeacherClientSubject[]>([]); const [assignments,setAssignments]=useState<TeacherClientAssignment[]>([]); const [switchingSubject,setSwitchingSubject]=useState(false); const [todayLabel,setTodayLabel]=useState("");
  const subjectConfig=getSubjectConfig(subjectKey); const moreActive=moreTabs.some(tab=>pathname.startsWith(tab.href));
  function applySession(session:TeacherSession){const next=session.subjectKey||"history";if(session.teacherId)setGradePlanCurrentTeacher(session.teacherId);setTeacherId(session.teacherId);setTeacherName(session.teacherName||"المعلم");setSubjectKey(next);setWorkspaceKey(session.workspaceKey||next);setActiveGrade(session.activeGrade||null);setActiveGradeLabel(session.activeGradeLabel||"");setSubjectName(session.subject||getSubjectConfig(next).label);setSubjects(Array.isArray(session.subjects)?session.subjects:[]);setAssignments(Array.isArray(session.assignments)?session.assignments:[]);setHasGradePlan(Boolean(session.teacherId&&readLocalGradePlan(session.teacherId)));}
  function clearSessionState(){setTeacherId(undefined);setTeacherName("المعلم");setSubjectKey("history");setWorkspaceKey("history");setActiveGrade(null);setActiveGradeLabel("");setSubjectName("التاريخ");setSubjects([]);setAssignments([]);setHasGradePlan(false);setMenuOpen(false);}
  function speakTeacherWelcome(name=teacherName){try{if(!("speechSynthesis" in window))return;window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(`مرحبًا أستاذ ${name||"المعلم"}. أهلًا بك في بوابة أستاذ لحوني التعليمية، ونتمنى لك يومًا دراسيًا موفقًا.`);utterance.lang="ar-SA";utterance.rate=.92;utterance.pitch=1;window.speechSynthesis.speak(utterance);}catch{}}
  async function logout(){try{window.speechSynthesis?.cancel();sessionStorage.removeItem("lahooni:teacher-welcome");sessionStorage.removeItem("lahooni:teacher-subject-picked");}catch{}setReady(false);clearSessionState();try{await Promise.all([fetch("/api/teacher-logout",{method:"POST",cache:"no-store"}),signOut(auth)]);}finally{window.location.replace("/teacher");}}
  useEffect(()=>{setMenuOpen(false);},[pathname]);
  useEffect(()=>{setTodayLabel(new Intl.DateTimeFormat("ar-SA",{timeZone:"Asia/Riyadh",weekday:"long",day:"numeric",month:"long"}).format(new Date()));},[]);
  useEffect(()=>{if(!ready||isLoginPage||!teacherName)return;try{if(sessionStorage.getItem("lahooni:teacher-welcome")==="1")return;sessionStorage.setItem("lahooni:teacher-welcome","1");window.setTimeout(()=>speakTeacherWelcome(teacherName),180);}catch{}},[ready,isLoginPage,teacherName]);
  useEffect(()=>{if(isLoginPage){setReady(false);clearSessionState();return;}setReady(false);clearSessionState();let active=true;fetch("/api/teacher-session",{cache:"no-store",credentials:"same-origin"}).then(r=>r.ok?r.json():Promise.reject(new Error("session_failed"))).then((s:TeacherSession)=>{if(!active)return;if(!s.teacherId)throw new Error("missing_teacher_identity");applySession(s);setReady(true);}).catch(()=>{if(active){clearSessionState();window.location.replace("/teacher");}});return()=>{active=false;};},[isLoginPage]);
  async function changeSubject(next:string){if(next===workspaceKey||switchingSubject)return;try{setSwitchingSubject(true);const response=await fetch("/api/teacher-session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({workspaceKey:next}),cache:"no-store",credentials:"same-origin"});if(!response.ok)throw new Error();const session=await response.json().catch(()=>null);if(session?.teacherId)applySession(session);setMenuOpen(false);window.location.assign(pathname);}finally{setSwitchingSubject(false);}}
  if(isLoginPage)return <>{children}</>; if(!ready)return <main className="teacher-shell-loading">جارٍ تجهيز بوابة المعلم…</main>;
  const contextValue={authenticated:true,teacherId,teacherName,subjectKey,workspaceKey,activeGrade,activeGradeLabel,subject:subjectName,subjects,assignments,setSubject:changeSubject,refresh:async()=>{const response=await fetch("/api/teacher-session",{cache:"no-store",credentials:"same-origin"});if(response.ok)applySession(await response.json());}};
  const renderHeaderTab=(tab:TeacherTab)=>{const active=pathname.startsWith(tab.href);return <Link prefetch={false} key={tab.href} href={tab.href} className={active?"active":""}><TabIcon type={tab.key}/><span>{tab.label}</span></Link>;};
  const renderCommandTab=(tab:TeacherTab)=>{const active=pathname.startsWith(tab.href);return <Link prefetch={false} key={tab.href} href={tab.href} className={active?"active":""}><TabIcon type={tab.key}/><span className="teacher-command-link-copy"><b>{tab.label}</b><small>{tab.note}</small></span></Link>;};
  const shellTabs=[...primaryTabs,...moreTabs.filter(tab=>!primaryTabs.some(primary=>primary.href===tab.href))];
  const currentTab=shellTabs.find(tab=>pathname.startsWith(tab.href));
  return <TeacherClientContext.Provider key={`${teacherId||"teacher"}:${workspaceKey}`} value={contextValue}>
    <div className="teacher-student-shell" dir="rtl" data-subject={subjectKey}>
      <aside className={`tss-sidebar ${menuOpen?"open":""}`} aria-label="خدمات المعلم">
        <Link prefetch={false} href="/" className="tss-brand">
          <Image src="/icons/ostadh-lahooni-192.jpg" alt="شعار بوابة أستاذ لحوني التعليمية" width={40} height={40} priority/>
          <span><small>بوابة أستاذ لحوني التعليمية</small><b>بوابة المعلم</b></span>
        </Link>
        <div className="tss-profile"><div className="tss-profile-avatar" aria-label="هوية المعلم"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="24" r="12" fill="currentColor"/><path d="M15 58c1-14 8-22 17-22s16 8 17 22H15Z" fill="currentColor"/><path d="M20 17c4-9 20-12 27-2l-4 7c-6-4-16-5-23-1v-4Z" fill="#fff"/><path d="M18 18c8-7 22-8 30-1" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round"/></svg></div><div><small>مرحبًا بك</small><strong>{teacherName}</strong><span>مساحة المعلم</span></div></div>

        <nav className="tss-nav">{shellTabs.map(tab=>{const active=pathname.startsWith(tab.href);return <Link prefetch={false} key={tab.href} href={tab.href} className={active?"active":""} onClick={()=>setMenuOpen(false)}><TabIcon type={tab.key}/><span><b>{tab.label}</b><small>{tab.note}</small></span></Link>})}</nav>
        <footer className="tss-footer"><span>بالعلم .. نصنع المستقبل</span><Link prefetch={false} href="/">العودة للرئيسية</Link><button type="button" onClick={logout}>تسجيل الخروج</button></footer>
      </aside>
      <button type="button" className="tss-backdrop" aria-label="إغلاق القائمة" onClick={()=>setMenuOpen(false)}/>
      <main className="tss-main">
        <header className="tss-head">
          <div className="tss-teacher-identity"><div className="tss-identity-mark" aria-label="هوية المعلم"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="24" r="12" fill="currentColor"/><path d="M15 58c1-14 8-22 17-22s16 8 17 22H15Z" fill="currentColor"/><path d="M20 17c4-9 20-12 27-2l-4 7c-6-4-16-5-23-1v-4Z" fill="#fff"/><path d="M18 18c8-7 22-8 30-1" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round"/></svg></div><div><small>هوية المعلم</small><h1>{teacherName}</h1><p>{subjectName}{activeGradeLabel?` — ${activeGradeLabel}`:""}</p></div></div>
          <div className="tss-head-center"><small>بوابة المعلم / {subjectName}</small><strong>{currentTab?.label||"بوابة المعلم"}</strong><span>{currentTab?.note||"مساحة العمل التعليمية"}</span></div>
          <div className="tss-head-actions">
            <span>{todayLabel}</span>
            {subjects.length>1?<label className="tss-top-subject"><small>تغيير المادة</small><select aria-label="تغيير المادة أو المرحلة" value={workspaceKey} onChange={e=>void changeSubject(e.target.value)} disabled={switchingSubject}>{subjects.map(subject=><option key={subject.workspaceKey} value={subject.workspaceKey}>{subject.subjectName}{subject.gradeLabel?` — ${subject.gradeLabel}`:""}</option>)}</select></label>:null}
            <button type="button" className="tss-mobile-menu" onClick={()=>setMenuOpen(v=>!v)}>القائمة</button>
            <button type="button" onClick={()=>speakTeacherWelcome()}>🔊 الترحيب</button>
            {hasGradePlan?<Link prefetch={false} href="/teacher/grade-plan">الخطة جاهزة</Link>:<Link prefetch={false} href="/teacher/grade-plan">إعداد الخطة</Link>}
          </div>
        </header>
        <div className="tss-content">{children}</div>
      </main>
    </div>
  </TeacherClientContext.Provider>;
}
