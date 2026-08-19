"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useRef, useState } from "react";
import { getSubjectConfig, type SubjectKey } from "../../lib/subject-config";
import { TeacherClientContext } from "../../lib/teacher-client";
import "./teacher-shell.css";
import "./teacher-themes-v2.css";
import "./mobile-shell.css";
import "./print-theme.css";
import "./tab-fix.css";

const tabs = [
  { href: "/teacher/dashboard", key: "dashboard", label: "الرئيسية", note: "ملخص الأداء والتنبيهات" },
  { href: "/teacher/subjects", key: "subjects", label: "إدارة المواد", note: "اختيار المادة والصف" },
  { href: "/teacher/students", key: "students", label: "إدارة الطلاب", note: "الطلاب والبيانات" },
  { href: "/teacher/grades", key: "grades", label: "الدرجات", note: "الرصد والاختبارات" },
  { href: "/teacher/attendance", key: "attendance", label: "الحضور والغياب", note: "التحضير اليومي" },
  { href: "/teacher/research", key: "research", label: "البحث والمهام", note: "الرصد والتكليفات" },
  { href: "/teacher/reports", key: "reports", label: "التقارير", note: "الملخص والطباعة" },
  { href: "/teacher/follow-up", key: "follow", label: "المتابعة والإتقان", note: "التنبيهات والتحسين" },
  { href: "/teacher/timetable", key: "timetable", label: "الجدول الدراسي", note: "الحصص الأسبوعية" },
  { href: "/teacher/portfolio", key: "portfolio", label: "ملف الإنجاز", note: "الإنجاز المهني" },
  { href: "/teacher/ai", key: "ai", label: "الذكاء الاصطناعي", note: "مساعد المعلم الذكي", badge: "جديد" },
];
const IDLE_LIMIT = 3 * 60 * 1000;

type TeacherSession = { authenticated?: boolean; teacherId?: string; teacherName?: string; subject?: string; subjectKey?: SubjectKey };

function TabIcon({ type }: { type: string }) {
  const c={width:25,height:25,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:1.9,strokeLinecap:"round" as const,strokeLinejoin:"round" as const};
  if(type==="dashboard")return <svg {...c}><path d="M4 13h6V4H4zM14 20h6V11h-6zM4 20h6v-3H4zM14 7h6V4h-6z"/></svg>;
  if(type==="subjects")return <svg {...c}><path d="M4 5.5h6.5A3.5 3.5 0 0 1 14 9v10H7.5A3.5 3.5 0 0 0 4 22z"/><path d="M20 5.5h-6.5A3.5 3.5 0 0 0 10 9v10h6.5A3.5 3.5 0 0 1 20 22z"/></svg>;
  if(type==="timetable")return <svg {...c}><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M7 3v4M17 3v4M3.5 9h17M8 12h2M14 12h2M8 16h2M14 16h2"/></svg>;
  if(type==="portfolio")return <svg {...c}><path d="M8 4h8l1 3h3v13H4V7h3z"/><path d="M9 11h6M9 15h6"/><path d="M10 4h4"/></svg>;
  if(type==="grades")return <svg {...c}><path d="M4 19.5h16"/><path d="M6.5 16V9.5M11.8 16V5M17.1 16v-3.8"/><path d="m5.8 6.8 3-2.3 3 1.8 5.4-3"/></svg>;
  if(type==="research")return <svg {...c}><path d="M9 3h6M10 3v5.4l-4.4 7.4A3.4 3.4 0 0 0 8.5 21h7a3.4 3.4 0 0 0 2.9-5.2L14 8.4V3"/><path d="M7.5 15h9M10 12h4"/></svg>;
  if(type==="attendance")return <svg {...c}><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.2 2"/></svg>;
  if(type==="reports")return <svg {...c}><path d="M5 3.5h10l4 4V20.5H5zM15 3.5v4h4M8 12h8M8 16h6"/></svg>;
  if(type==="follow")return <svg {...c}><path d="M12 3.5 20 7v5.5c0 4.8-3.3 7.6-8 8.8-4.7-1.2-8-4-8-8.8V7z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg>;
  if(type==="ai")return <svg {...c}><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/><circle cx="12" cy="12" r="4"/><path d="M10.5 11.5h.01M13.5 11.5h.01M10.5 13.6c.9.6 2.1.6 3 0"/></svg>;
  return <svg {...c}><path d="M16 20v-1.8a4.2 4.2 0 0 0-4.2-4.2H7.2A4.2 4.2 0 0 0 3 18.2V20"/><circle cx="9.5" cy="7" r="3.5"/><path d="M17 10.5a3.3 3.3 0 0 0 0-6.4M20.5 20v-1.8a4.2 4.2 0 0 0-3.1-4"/></svg>;
}

export default function TeacherLayout({ children }: { children: ReactNode }) {
  const pathname=usePathname(),router=useRouter(),isLoginPage=pathname==="/teacher";
  const [ready,setReady]=useState(isLoginPage),[soundOn,setSoundOn]=useState(true);
  const [teacherId,setTeacherId]=useState<string|undefined>(undefined),[teacherName,setTeacherName]=useState("المعلم"),[subjectKey,setSubjectKey]=useState<SubjectKey>("history");
  const subjectConfig=getSubjectConfig(subjectKey);
  const idleTimer=useRef<ReturnType<typeof setTimeout>|null>(null),lastHeartbeat=useRef(0);
  function playTone(kind:"tab"|"off"="tab"){if(!soundOn&&kind!=="off")return;try{const A=window.AudioContext||(window as typeof window&{webkitAudioContext?:typeof AudioContext}).webkitAudioContext;if(!A)return;const ctx=new A(),g=ctx.createGain();g.connect(ctx.destination);g.gain.setValueAtTime(.0001,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.08,ctx.currentTime+.015);(kind==="off"?[440,330]:[659.25,783.99]).forEach((f,i)=>{const o=ctx.createOscillator();o.type="sine";o.frequency.value=f;o.connect(g);const s=ctx.currentTime+i*.07;o.start(s);o.stop(s+.12)});g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.34);setTimeout(()=>void ctx.close(),500)}catch{}}
  function toggleSound(){const next=!soundOn;setSoundOn(next);localStorage.setItem("lahooni-sound",next?"on":"off");if(!next)playTone("off")}
  async function logout(){try{await fetch("/api/teacher-logout",{method:"POST",cache:"no-store"})}finally{router.replace("/teacher");router.refresh()}}
  useEffect(()=>setSoundOn(localStorage.getItem("lahooni-sound")!=="off"),[]);
  useEffect(()=>{if(isLoginPage){setReady(true);return}let active=true,busy=false;const applySession=(session:TeacherSession)=>{setTeacherId(session.teacherId);setTeacherName(session.teacherName||"المعلم");setSubjectKey(session.subjectKey||"history")};const check=async()=>{const response=await fetch("/api/teacher-session",{cache:"no-store"});if(!response.ok)throw new Error();const session=await response.json() as TeacherSession;if(active){applySession(session);setReady(true)}};const reset=()=>{if(idleTimer.current)clearTimeout(idleTimer.current);idleTimer.current=setTimeout(()=>void logout(),IDLE_LIMIT)};const activity=()=>{reset();const now=Date.now();if(now-lastHeartbeat.current<30000||busy)return;busy=true;fetch("/api/teacher-session",{cache:"no-store"}).then(async response=>{if(!response.ok)throw new Error();const session=await response.json() as TeacherSession;if(active)applySession(session);lastHeartbeat.current=Date.now()}).catch(()=>void logout()).finally(()=>busy=false)};check().catch(()=>active&&router.replace("/teacher"));reset();const events=["pointerdown","keydown","touchstart","scroll","mousemove"];events.forEach(eventName=>window.addEventListener(eventName,activity,{passive:true}));return()=>{active=false;if(idleTimer.current)clearTimeout(idleTimer.current);events.forEach(eventName=>window.removeEventListener(eventName,activity))}},[isLoginPage,pathname,router]);
  if(isLoginPage)return <>{children}</>;
  if(!ready)return <main className="teacher-shell-loading"><span className="loading-orbit"/>جارٍ تجهيز بوابة المعلم...</main>;
  const providerValue={authenticated:true,teacherId,teacherName,subjectKey,subject:subjectConfig.label,setSubject:async(subjectId:string)=>{try{const r=await fetch('/api/teacher-session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subjectId}),cache:'no-store'});if(!r.ok)throw new Error();setSubjectKey(subjectId as SubjectKey)}catch(err){console.error(err)}},refresh:async()=>{try{const r=await fetch('/api/teacher-session',{cache:'no-store'});if(!r.ok)return;const s=await r.json();setTeacherId(s.teacherId);setTeacherName(s.teacherName||'المعلم');setSubjectKey(s.subjectKey||'history')}catch{}}};
  return <TeacherClientContext.Provider value={providerValue}><div className={`teacher-app-shell ${subjectConfig.themeClass}`} dir="rtl" data-subject={subjectKey}><aside className="teacher-sidebar"><div className="teacher-shell-brand"><div className="teacher-shell-logo">{subjectConfig.shortMark}</div><div><strong>بوابة المعلم</strong><small>{teacherName} • {subjectConfig.label}</small></div></div><div className="teacher-nav-title">أقسام ملف المعلم</div><nav className="teacher-tabs" aria-label="أقسام بوابة المعلم">{tabs.map(tab=>{const active=pathname.startsWith(tab.href);return <Link key={tab.href} href={tab.href} className={`${active?"active":""} ${tab.key==="ai"?"ai-tab":""}`} onClick={()=>playTone()}><span className="teacher-tab-icon"><TabIcon type={tab.key}/></span><span className="teacher-tab-copy"><b>{tab.label}</b><small>{tab.note}</small></span>{tab.badge&&<em>{tab.badge}</em>}</Link>})}</nav><div className="teacher-header-actions"><button className={`sound-toggle ${soundOn?"on":"off"}`} onClick={toggleSound}>{soundOn?"🔊 الصوت مفعل":"🔇 الصوت مكتوم"}</button><button className="teacher-logout" onClick={logout}>تسجيل خروج</button></div></aside><main className="teacher-main"><section className="teacher-welcome-strip"><div className="teacher-welcome-copy"><span className="teacher-welcome-badge">ملف المعلم — {subjectConfig.label}</span><h2>أهلًا أستاذ {teacherName}</h2><p>كل أدوات الإدارة والرصد والتقارير والذكاء الاصطناعي في مكان واحد واضح.</p><div className="teacher-welcome-points">{subjectConfig.welcomePoints.map(point=><span key={point}>{point}</span>)}</div></div><Link className="teacher-ai-quick" href="/teacher/ai"><span>AI</span><div><b>المساعد الذكي</b><small>تحليل • تلخيص • اقتراحات</small></div></Link></section><div className="teacher-page-content">{children}</div></main></div></TeacherClientContext.Provider>
}
