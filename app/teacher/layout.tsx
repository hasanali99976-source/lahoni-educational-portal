"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
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

const primaryTabs: TeacherTab[] = [
  { href: "/teacher/dashboard", key: "dashboard", label: "يومي", note: "مركز العمل اليومي" },
  { href: "/teacher/timetable", key: "timetable", label: "الجدول الدراسي", note: "جدول الحصص الأسبوعي" },
  { href: "/teacher/attendance", key: "attendance", label: "سجل المتابعة", note: "الحضور والمتابعة" },
  { href: "/teacher/grades", key: "grades", label: "التحصيل العلمي", note: "الرصد والحفظ" },
  { href: "/teacher/certificates", key: "certificate", label: "تقرير الطالب الكلي", note: "التحصيل والمتابعة والانضباط" },
  { href: "/teacher/students", key: "students", label: "إدارة الطلاب", note: "الفصول وبيانات الدخول" },
];
const moreTabs: TeacherTab[] = [
  { href: "/teacher/diagnostics", key: "diagnostics", label: "الاختبارات التشخيصية", note: "النتائج والخطط العلاجية" },
  { href: "/teacher/follow-up", key: "follow", label: "الإتقان والمتابعة", note: "تحليل طلاب المعلم" },
  { href: "/teacher/discipline", key: "evaluation", label: "الانضباط", note: "التأخر والاستئذان" },
  { href: "/teacher/notes", key: "evaluation", label: "الملاحظات", note: "الملاحظات التربوية" },
  { href: "/teacher/reports", key: "evaluation", label: "مركز التقارير", note: "التقارير والطباعة" },
  { href: "/teacher/portfolio", key: "portfolio", label: "ملف الإنجاز", note: "الشواهد والطباعة" },
  { href: "/teacher/grade-plan", key: "gradeplan", label: "خطة رصد المعلم", note: "توزيع الدرجات والرصد" },
  { href: "/teacher/ai", key: "ai", label: "المساعد الذكي", note: "تحليل وخطط مقترحة", badge: "AI" },
];

function TabIcon({ type }: { type: string }) {
  const common = { width: 23, height: 23, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (type === "dashboard") return <svg {...common}><path d="M4 13h6V4H4zM14 20h6V11h-6zM4 20h6v-3H4zM14 7h6V4h-6z"/></svg>;
  if (type === "certificate") return <svg {...common}><path d="M6 3.5h12v17H6z"/><path d="M9 8h6M9 12h6"/><circle cx="12" cy="16" r="2"/><path d="m10.7 17.5-.5 3 1.8-1 1.8 1-.5-3"/></svg>;
  if (type === "grades") return <svg {...common}><path d="M4 19.5h16M6.5 16V9.5M11.8 16V5M17.1 16v-3.8"/><path d="m5.8 6.8 3-2.3 3 1.8 5.4-3"/></svg>;
  if (type === "attendance") return <svg {...common}><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.2 2"/></svg>;
  if (type === "timetable") return <svg {...common}><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M8 3v4M16 3v4M3.5 9.5h17M8 13h2M14 13h2M8 17h2M14 17h2"/></svg>;
  if (type === "diagnostics") return <svg {...common}><path d="M9 3h6l1 2h3v16H5V5h3z"/><path d="m8 11 2 2 4-4M8 17h8"/></svg>;
  if (type === "evaluation") return <svg {...common}><rect x="4" y="4.5" width="16" height="16" rx="2"/><path d="M8 2.8v3.4M16 2.8v3.4M7.5 10h9M8 14h3M14 14h2M8 17h3"/></svg>;
  if (type === "portfolio") return <svg {...common}><path d="M8 4h8l1 3h3v13H4V7h3zM9 11h6M9 15h6"/></svg>;
  if (type === "follow") return <svg {...common}><path d="M12 3.5 20 7v5.5c0 4.8-3.3 7.6-8 8.8-4.7-1.2-8-4-8-8.8V7z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg>;
  if (type === "ai") return <svg {...common}><circle cx="12" cy="12" r="4"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/></svg>;
  return <svg {...common}><path d="M16 20v-1.8a4.2 4.2 0 0 0-4.2-4.2H7.2A4.2 4.2 0 0 0 3 18.2V20"/><circle cx="9.5" cy="7" r="3.5"/><path d="M17 10.5a3.3 3.3 0 0 0 0-6.4M20.5 20v-1.8a4.2 4.2 0 0 0-3.1-4"/></svg>;
}

export default function TeacherLayout({ children }: { children: ReactNode }) {
  const pathname=usePathname(); const router=useRouter(); const isLoginPage=pathname==="/teacher"; const entryRedirectKey="lahooni:teacher-entry-complete";
  const [ready,setReady]=useState(false); const [menuOpen,setMenuOpen]=useState(false);
  const [teacherId,setTeacherId]=useState<string>(); const [teacherName,setTeacherName]=useState("المعلم"); const [subjectKey,setSubjectKey]=useState<SubjectKey>("history"); const [workspaceKey,setWorkspaceKey]=useState("history"); const [activeGrade,setActiveGrade]=useState<number|null>(null); const [activeGradeLabel,setActiveGradeLabel]=useState(""); const [subjectName,setSubjectName]=useState("التاريخ"); const [subjects,setSubjects]=useState<TeacherClientSubject[]>([]); const [assignments,setAssignments]=useState<TeacherClientAssignment[]>([]); const [switchingSubject,setSwitchingSubject]=useState(false); const [todayLabel,setTodayLabel]=useState("");
  function applySession(session:TeacherSession){const next=session.subjectKey||"history";if(session.teacherId)setGradePlanCurrentTeacher(session.teacherId);setTeacherId(session.teacherId);setTeacherName(session.teacherName||"المعلم");setSubjectKey(next);setWorkspaceKey(session.workspaceKey||next);setActiveGrade(session.activeGrade||null);setActiveGradeLabel(session.activeGradeLabel||"");setSubjectName(session.subject||getSubjectConfig(next).label);setSubjects(Array.isArray(session.subjects)?session.subjects:[]);setAssignments(Array.isArray(session.assignments)?session.assignments:[]);}
  function clearSessionState(){setTeacherId(undefined);setTeacherName("المعلم");setSubjectKey("history");setWorkspaceKey("history");setActiveGrade(null);setActiveGradeLabel("");setSubjectName("التاريخ");setSubjects([]);setAssignments([]);setMenuOpen(false);}
  async function logout(){try{await Promise.all([fetch("/api/teacher-logout",{method:"POST",cache:"no-store"}),signOut(auth)]);}finally{window.location.replace("/teacher");}}
  useEffect(()=>{setMenuOpen(false);},[pathname]);
  useEffect(()=>{if(!isLoginPage)[...primaryTabs,...moreTabs].forEach(tab=>router.prefetch(tab.href));},[isLoginPage,router]);
  useEffect(()=>{setTodayLabel(new Intl.DateTimeFormat("ar-SA",{timeZone:"Asia/Riyadh",weekday:"long",day:"numeric",month:"long"}).format(new Date()));},[]);
  useEffect(()=>{if(isLoginPage){setReady(false);clearSessionState();return;}setReady(false);let active=true;fetch("/api/teacher-session",{cache:"no-store",credentials:"same-origin"}).then(r=>r.ok?r.json():Promise.reject()).then((s:TeacherSession)=>{if(!active)return;if(!s.teacherId)throw new Error();applySession(s);setReady(true);}).catch(()=>{if(active)window.location.replace("/teacher");});return()=>{active=false;};},[isLoginPage]);
  async function changeSubject(next:string){if(next===workspaceKey||switchingSubject)return;try{setSwitchingSubject(true);const response=await fetch("/api/teacher-session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({workspaceKey:next}),cache:"no-store",credentials:"same-origin"});if(!response.ok)throw new Error();const switched=await response.json();setSubjectKey(switched.subjectId as SubjectKey);setWorkspaceKey(switched.workspaceKey||next);setActiveGrade(switched.activeGrade||null);setActiveGradeLabel(switched.activeGradeLabel||"");setSubjectName(getSubjectConfig(switched.subjectId).label);window.location.replace(pathname);}finally{setSwitchingSubject(false);}}
  if(isLoginPage){try{if(typeof window!=="undefined"&&sessionStorage.getItem(entryRedirectKey)==="1"){window.location.replace("/teacher/dashboard");return <main className="teacher-shell-loading">جارٍ فتح يومي…</main>;}}catch{}return <>{children}</>;} if(!ready)return <main className="teacher-shell-loading">جارٍ تجهيز بوابة المعلم…</main>;
  const contextValue={authenticated:true,teacherId,teacherName,subjectKey,workspaceKey,activeGrade,activeGradeLabel,subject:subjectName,subjects,assignments,setSubject:changeSubject,refresh:async()=>{const response=await fetch("/api/teacher-session",{cache:"no-store",credentials:"same-origin"});if(response.ok)applySession(await response.json());}};
  const shellTabs=[...primaryTabs,...moreTabs.filter(tab=>!primaryTabs.some(primary=>primary.href===tab.href))];
  return <TeacherClientContext.Provider key={`${teacherId||"teacher"}:${workspaceKey}`} value={contextValue}>
    <div className="teacher-student-shell" dir="rtl" data-subject={subjectKey}>
      <style jsx global>{`
        .tss-sidebar{overflow-x:hidden!important;padding:12px 12px 10px!important}
        .tss-brand-stacked{flex:0 0 auto!important;min-height:116px!important;padding:6px 4px 12px!important;gap:5px!important;overflow:visible!important}
        .tss-brand-stacked img{display:block!important;width:68px!important;height:68px!important;min-width:68px!important;min-height:68px!important;object-fit:contain!important;opacity:1!important;visibility:visible!important;margin:0 auto!important}
        .tss-brand-stacked span{width:100%!important;text-align:center!important;overflow:visible!important}
        .tss-brand-stacked b{display:block!important;font-size:14px!important;line-height:1.35!important;white-space:nowrap!important}
        .tss-brand-stacked small{display:block!important;font-size:7.5px!important;line-height:1.45!important;white-space:normal!important}
        .tss-nav{flex:1 1 auto!important;align-content:start!important;gap:2px!important;margin-top:6px!important;overflow:visible!important}
        .tss-nav a{grid-template-columns:26px minmax(0,1fr)!important;gap:8px!important;min-height:38px!important;padding:5px 7px!important;overflow:visible!important}
        .tss-nav a b{font-size:9.7px!important;line-height:1.25!important;white-space:nowrap!important;overflow:visible!important;text-overflow:clip!important}
        .tss-footer{flex:0 0 auto!important;margin-top:8px!important;padding-top:8px!important}
        .tss-motto{display:block!important;text-align:center!important;color:#efcb73!important;font-size:9px!important;font-weight:900!important;line-height:1.5!important;margin:0 0 7px!important;letter-spacing:.1px!important}
        @media(max-height:760px) and (min-width:981px){.tss-brand-stacked{min-height:96px!important}.tss-brand-stacked img{width:54px!important;height:54px!important;min-width:54px!important;min-height:54px!important}.tss-nav a{min-height:34px!important;padding-block:3px!important}.tss-nav a b{font-size:9px!important}.tss-motto{font-size:8px!important;margin-bottom:4px!important}}
      `}</style>
      <aside className={`tss-sidebar ${menuOpen?"open":""}`} aria-label="خدمات المعلم">
        <Link prefetch={false} href="/" className="tss-brand tss-brand-stacked">
          <Image src="/icons/ostadh-lahooni-192.jpg" alt="شعار بوابة أستاذ لحوني التعليمية" width={68} height={68} priority unoptimized/>
          <span><b>بوابة المعلم</b><small>بوابة أستاذ لحوني التعليمية</small></span>
        </Link>
        <nav className="tss-nav">{shellTabs.map(tab=>{const active=pathname.startsWith(tab.href);return <Link prefetch={true} key={tab.href} href={tab.href} className={active?"active":""} onClick={()=>setMenuOpen(false)}><TabIcon type={tab.key}/><span><b>{tab.label}</b><small>{tab.note}</small></span></Link>})}</nav>
        <footer className="tss-footer"><span className="tss-motto">بالعِلم نصنع المستقبل</span><button type="button" className="tss-logout" onClick={logout}><span>↪</span><b>تسجيل الخروج</b></button></footer>
      </aside>
      <button type="button" className="tss-backdrop" aria-label="إغلاق القائمة" onClick={()=>setMenuOpen(false)}/>
      <main className="tss-main">
        <header className="tss-head tss-head-reference">
          <div className="tss-teacher-identity"><div className="tss-reference-avatar" aria-label="هوية المعلم"><span className="tss-ref-head"><i className="tss-ref-shemagh"/><i className="tss-ref-face"/><i className="tss-ref-agal"/></span><span className="tss-ref-body"/></div><div><h1>أ. {teacherName.replace(/^أ\.?\s*/,"")}</h1><p>معلم {subjectName}</p></div></div>
          <div className="tss-reference-date"><span className="tss-date-icon">▣</span><div><strong>{todayLabel}</strong><small>بوابة المعلم التعليمية</small></div></div>
          <div className="tss-reference-actions"><button type="button" className="tss-reference-bell" aria-label="التنبيهات">♧<i/></button><div className="tss-reference-welcome"><span>❧</span><div><strong>مرحبًا أ. {teacherName.replace(/^أ\.?\s*/,"")}</strong><small>دائمًا نصنع الأثر</small></div></div><button type="button" className="tss-mobile-menu" onClick={()=>setMenuOpen(v=>!v)}>القائمة</button></div>
        </header>
        <div className="tss-content">{children}</div>
      </main>
    </div>
  </TeacherClientContext.Provider>;
}