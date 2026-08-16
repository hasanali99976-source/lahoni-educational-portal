"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useRef, useState } from "react";
import "./teacher-shell.css";
import "./teacher-themes-v2.css";
import "./tab-fix.css";

const tabs = [
  { href: "/teacher/grades", key: "grades", label: "رصد الدرجات", note: "الوحدات والاختبارات" },
  { href: "/teacher/research", key: "research", label: "رصد البحث", note: "درجة البحث الفصلية" },
  { href: "/teacher/attendance", key: "attendance", label: "التحضير اليومي", note: "الحضور والغياب" },
  { href: "/teacher/reports", key: "reports", label: "ملخص الطالب", note: "التقارير والطباعة" },
  { href: "/teacher/follow-up", key: "follow", label: "المتابعة والإتقان", note: "التنبيهات والتحسين" },
  { href: "/teacher/students", key: "students", label: "إدارة الطلاب", note: "الفصول والبيانات" },
];
const IDLE_LIMIT = 3 * 60 * 1000;

type SubjectKey = "history" | "critical-thinking";
type TeacherSession = {
  authenticated?: boolean;
  teacherName?: string;
  subject?: string;
  subjectKey?: SubjectKey;
};

function TabIcon({ type }: { type: string }) {
  const c={width:26,height:26,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:1.9,strokeLinecap:"round" as const,strokeLinejoin:"round" as const};
  if(type==="grades")return <svg {...c}><path d="M4 19.5h16"/><path d="M6.5 16V9.5M11.8 16V5M17.1 16v-3.8"/><path d="m5.8 6.8 3-2.3 3 1.8 5.4-3"/></svg>;
  if(type==="research")return <svg {...c}><path d="M9 3h6M10 3v5.4l-4.4 7.4A3.4 3.4 0 0 0 8.5 21h7a3.4 3.4 0 0 0 2.9-5.2L14 8.4V3"/><path d="M7.5 15h9M10 12h4"/></svg>;
  if(type==="attendance")return <svg {...c}><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.2 2"/></svg>;
  if(type==="reports")return <svg {...c}><path d="M5 3.5h10l4 4V20.5H5zM15 3.5v4h4M8 12h8M8 16h6"/></svg>;
  if(type==="follow")return <svg {...c}><path d="M12 3.5 20 7v5.5c0 4.8-3.3 7.6-8 8.8-4.7-1.2-8-4-8-8.8V7z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg>;
  return <svg {...c}><path d="M16 20v-1.8a4.2 4.2 0 0 0-4.2-4.2H7.2A4.2 4.2 0 0 0 3 18.2V20"/><circle cx="9.5" cy="7" r="3.5"/><path d="M17 10.5a3.3 3.3 0 0 0 0-6.4M20.5 20v-1.8a4.2 4.2 0 0 0-3.1-4"/></svg>;
}

export default function TeacherLayout({ children }: { children: ReactNode }) {
  const pathname=usePathname(),router=useRouter(),isLoginPage=pathname==="/teacher";
  const [ready,setReady]=useState(isLoginPage),[soundOn,setSoundOn]=useState(true);
  const [teacherName,setTeacherName]=useState("المعلم");
  const [subject,setSubject]=useState("المادة");
  const [subjectKey,setSubjectKey]=useState<SubjectKey>("history");
  const idleTimer=useRef<ReturnType<typeof setTimeout>|null>(null),lastHeartbeat=useRef(0);
  function playTone(kind:"tab"|"off"="tab"){
    if(!soundOn&&kind!=="off")return;
    try{const A=window.AudioContext||(window as typeof window&{webkitAudioContext?:typeof AudioContext}).webkitAudioContext;if(!A)return;const ctx=new A(),g=ctx.createGain();g.connect(ctx.destination);g.gain.setValueAtTime(.0001,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.08,ctx.currentTime+.015);(kind==="off"?[440,330]:[659.25,783.99]).forEach((f,i)=>{const o=ctx.createOscillator();o.type="sine";o.frequency.value=f;o.connect(g);const s=ctx.currentTime+i*.07;o.start(s);o.stop(s+.12)});g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.34);setTimeout(()=>void ctx.close(),500)}catch{}
  }
  function toggleSound(){const n=!soundOn;setSoundOn(n);localStorage.setItem("lahooni-sound",n?"on":"off");if(!n)playTone("off")}
  async function logout(){try{await fetch("/api/teacher-logout",{method:"POST",cache:"no-store"})}finally{router.replace("/teacher");router.refresh()}}
  useEffect(()=>setSoundOn(localStorage.getItem("lahooni-sound")!=="off"),[]);
  useEffect(()=>{
    if(isLoginPage){setReady(true);return}
    let active=true,busy=false;
    const applySession=(session:TeacherSession)=>{setTeacherName(session.teacherName||"المعلم");setSubject(session.subject||"المادة");setSubjectKey(session.subjectKey||"history")};
    const check=async()=>{const r=await fetch("/api/teacher-session",{cache:"no-store"});if(!r.ok)throw new Error();const session=await r.json() as TeacherSession;if(active){applySession(session);setReady(true)}};
    const reset=()=>{if(idleTimer.current)clearTimeout(idleTimer.current);idleTimer.current=setTimeout(()=>void logout(),IDLE_LIMIT)};
    const activity=()=>{reset();const now=Date.now();if(now-lastHeartbeat.current<30000||busy)return;busy=true;fetch("/api/teacher-session",{cache:"no-store"}).then(async r=>{if(!r.ok)throw new Error();const session=await r.json() as TeacherSession;if(active)applySession(session);lastHeartbeat.current=Date.now()}).catch(()=>void logout()).finally(()=>busy=false)};
    const nav=performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming|undefined;
    if(nav?.type==="reload"){void logout();return()=>{active=false}};
    const onPageShow=(event:PageTransitionEvent)=>{if(event.persisted)void logout()};
    window.addEventListener("pageshow",onPageShow);
    check().catch(()=>active&&router.replace("/teacher"));reset();const events=["pointerdown","keydown","touchstart","scroll","mousemove"];events.forEach(e=>window.addEventListener(e,activity,{passive:true}));return()=>{active=false;if(idleTimer.current)clearTimeout(idleTimer.current);events.forEach(e=>window.removeEventListener(e,activity));window.removeEventListener("pageshow",onPageShow)}
  },[isLoginPage,pathname,router]);
  if(isLoginPage)return <>{children}</>;
  if(!ready)return <main className="teacher-shell-loading"><span className="loading-orbit"/>جارٍ تجهيز بوابة المعلم...</main>;
  return <div className={`teacher-app-shell theme-${subjectKey}`} dir="rtl">
    <aside className="teacher-sidebar">
      <div className="teacher-shell-brand"><div className="teacher-shell-logo">{subjectKey==="history"?"ح":"ف"}</div><div><strong>أستاذ لحوني</strong><small>بوابة {subject} التعليمية</small></div></div>
      <nav className="teacher-tabs" aria-label="أقسام بوابة المعلم">{tabs.map(tab=>{const active=pathname.startsWith(tab.href);return <Link key={tab.href} href={tab.href} className={active?"active":""} onClick={()=>playTone()}><span className="teacher-tab-icon"><TabIcon type={tab.key}/></span><span className="teacher-tab-copy"><b>{tab.label}</b><small>{tab.note}</small></span></Link>})}</nav>
      <div className="teacher-header-actions"><button className={`sound-toggle ${soundOn?"on":"off"}`} onClick={toggleSound}>{soundOn?"🔊 تشغيل الصوت":"🔇 الصوت مكتوم"}</button><button className="teacher-logout" onClick={logout}>تسجيل خروج</button></div>
    </aside>
    <main className="teacher-main">
      <section className="teacher-welcome-strip"><div className="teacher-welcome-copy"><span className="teacher-welcome-badge">لوحة المعلم — {subject}</span><h2>أهلًا أستاذ {teacherName}، كل أدواتك في مكان واحد</h2><p>رصد درجات {subject} والحضور والمتابعة والتقارير بتصميم واضح وسريع.</p><div className="teacher-welcome-points"><span>{subjectKey==="history"?"سجل الحضارات":"تحليل منطقي"}</span><span>تقارير فورية</span><span>{subjectKey==="history"?"متابعة دقيقة":"تفكير متعمق"}</span></div></div><div className="welcome-illustration"><img src="/students-learning.svg" alt="تعليم تفاعلي"/></div></section>
      <div className="teacher-page-content">{children}</div>
    </main>
  </div>
}
