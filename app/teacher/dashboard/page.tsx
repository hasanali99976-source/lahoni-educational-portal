"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useTeacherClient } from "../../../lib/teacher-client";
import "./dashboard-v11.css";

type Lesson={subject?:string;className?:string;notes?:string};
type Schedule=Record<string,Lesson>;
const DAY_KEYS=["sunday","monday","tuesday","wednesday","thursday"];
function dateLabel(value: Date) {return new Intl.DateTimeFormat("ar-SA", { timeZone: "Asia/Riyadh", weekday: "long", day: "numeric", month: "long" }).format(value);}
function timeLabel(value: Date) {return new Intl.DateTimeFormat("ar-SA", { timeZone: "Asia/Riyadh", hour: "numeric", minute: "2-digit" }).format(value);}
function riyadhDay(){return new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Riyadh",weekday:"long"}).format(new Date()).toLowerCase();}

export default function TeacherDashboardPage() {
  const session = useTeacherClient();
  const [now, setNow] = useState<Date | null>(null);
  const [schedule,setSchedule]=useState<Schedule>({});
  useEffect(() => {setNow(new Date());const timer = window.setInterval(() => setNow(new Date()), 60_000);return () => window.clearInterval(timer);}, []);
  useEffect(()=>{if(!session.teacherId||!session.subjectKey)return;const controller=new AbortController();fetch(`/api/teacher/timetable?subjectId=${encodeURIComponent(session.subjectKey)}`,{signal:controller.signal,cache:"no-store"}).then(async r=>{const d=await r.json().catch(()=>({}));if(r.ok&&d.lessons&&typeof d.lessons==="object")setSchedule(d.lessons as Schedule);}).catch(()=>{});return()=>controller.abort();},[session.teacherId,session.subjectKey]);
  const classLabels = useMemo(() => {const rows = Array.isArray(session.assignments) ? session.assignments : [];return [...new Set(rows.map(item => String(item.grade || "").trim()).filter(Boolean))].slice(0, 6);}, [session.assignments]);
  const today=riyadhDay();
  const todayLessons=useMemo(()=>DAY_KEYS.includes(today)?Array.from({length:7},(_,i)=>i+1).map(period=>({period,lesson:schedule[`${today}-${period}`]})).filter(x=>x.lesson?.className):[],[schedule,today]);
  const next=todayLessons[0];
  const ar=new Intl.NumberFormat("ar-SA-u-nu-arab");

  return <main className="teacher-dashboard-v11" dir="rtl">
    <section className="td11-hero"><div className="td11-greeting"><small>مرحبًا {session.teacherName || "أستاذنا"}</small><h2>{now ? dateLabel(now) : "يومك الدراسي"}</h2><p>{session.subject || "المادة"}{session.activeGradeLabel ? ` • ${session.activeGradeLabel}` : ""}</p><span>{now ? timeLabel(now) : "—"}</span></div><div className="td11-ai"><span>AI</span><div><small>الأولوية الآن</small><h2>{todayLessons.length?`لديك ${ar.format(todayLessons.length)} حصص اليوم`:"يومك الدراسي"}</h2><p>{next?`الحصة ${ar.format(next.period)} • ${next.lesson?.className}${next.lesson?.notes?` • ${next.lesson.notes}`:""}`:"لا توجد حصص مسجلة لهذا اليوم في الجدول الحالي."}</p></div><Link href="/teacher/timetable" prefetch={false}>فتح يومي الدراسي</Link></div></section>
    <section className="td11-day-grid"><article className="td11-next"><header><small>حصص اليوم</small><span>الجدول الدراسي</span></header><div><b>{todayLessons.length?`${ar.format(todayLessons.length)} حصص مسجلة`:"لا توجد حصص مسجلة"}</b><p>{todayLessons.length?todayLessons.map(x=>`${ar.format(x.period)}- ${x.lesson?.className}`).join(" • "):"يمكنك إضافة حصصك من الجدول الدراسي."}</p></div><footer><Link href="/teacher/timetable" prefetch={false}>فتح الجدول</Link></footer></article><article className="td11-progress"><header><small>المتابعة اليومية</small><b>{todayLessons.length?ar.format(todayLessons.length):"—"}</b></header><div className="td11-progress-line"><i><span style={{width:todayLessons.length?`${Math.min(100,todayLessons.length/7*100)}%`:"0%"}}/></i><p>حصص اليوم ظاهرة مباشرة من جدولك المحفوظ.</p></div><footer><Link href="/teacher/attendance" prefetch={false}>سجل المتابعة</Link><Link href="/teacher/grades" prefetch={false}>التحصيل العلمي</Link></footer></article><article className="td11-academic"><header><small>معلومات اليوم</small><b>{session.activeGradeLabel||"المرحلة الحالية"}</b></header><div><span><b>{ar.format(todayLessons.length)}</b><small>حصة اليوم</small></span><span><b>{ar.format(new Set(todayLessons.map(x=>x.lesson?.className)).size)}</b><small>فصل اليوم</small></span><span><b>{session.subject||"المادة"}</b><small>المادة</small></span></div><Link href="/teacher/timetable" prefetch={false}>تفاصيل اليوم</Link></article></section>
    <section className="td11-section-head"><div><small>فصولي التعليمية</small><h2>كل فصل مساحة عمل مستقلة</h2><p>المتابعة والتحصيل والملاحظات تبدأ من الفصل نفسه.</p></div><Link href="/teacher/students" prefetch={false}>إدارة الطلاب والفصول</Link></section>
    <section className="td11-classes">{classLabels.length ? classLabels.map(name => <article key={name}><header><div><small>فصل مسند</small><h3>{name}</h3></div><span>مساحة تعليمية</span></header><div className="td11-class-bars"><div><span>التحصيل</span><b>جاهز للرصد</b></div></div><div className="td11-class-meta"><span><b>{ar.format(todayLessons.filter(x=>x.lesson?.className===name).length)}</b><small>حصص اليوم</small></span><span><b>—</b><small>يحتاج دعمًا</small></span><span><b>—</b><small>اكتمال الرصد</small></span></div><footer><Link href="/teacher/attendance" prefetch={false}>متابعة</Link><Link href="/teacher/grades" prefetch={false}>تحصيل</Link><Link href="/teacher/notes" prefetch={false}>ملاحظة</Link></footer></article>) : <div className="td11-empty"><b>فصولك محفوظة داخل إدارة الطلاب</b><span>افتح القسم لعرض القوائم والبيانات الفعلية.</span><Link href="/teacher/students" prefetch={false}>إدارة الطلاب</Link></div>}</section>
    <section className="td11-bottom"><article className="td11-workflow"><header><small>مسار يوم المعلم</small><h2>ثلاث خطوات تكفي لمعظم عملك</h2></header><div><Link href="/teacher/attendance" prefetch={false}><b>01</b><span><strong>متابعة الفصل</strong><small>الحضور والانضباط</small></span></Link><Link href="/teacher/grades" prefetch={false}><b>02</b><span><strong>رصد التحصيل</strong><small>الوحدة أو الفترة الحالية</small></span></Link><Link href="/teacher/follow-up" prefetch={false}><b>03</b><span><strong>قرار تعليمي</strong><small>إتقان، دعم أو إثراء</small></span></Link></div></article><article className="td11-race"><header><small>مساحة المعلم</small><h2>أدواتك الأساسية</h2><p>بيانات اليوم من جدولك الفعلي، مع إبقاء إصلاحات الأداء ومنع القراءات الخلفية الثقيلة.</p></header><div className="td11-progress"><footer><Link href="/teacher/reports" prefetch={false}>مركز التقارير</Link><Link href="/teacher/portfolio" prefetch={false}>ملف الإنجاز</Link></footer></div></article></section>
  </main>;
}
