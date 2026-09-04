"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { tenantCollection } from "../../../lib/teacher-tenant";
import { useTeacherClient } from "../../../lib/teacher-client";
import { calculateGradePlanResult, type GradeStudentLike } from "../../../lib/grade-plan";
import { useGradePlan } from "../../../lib/use-grade-plan";
import TeacherCompetitionProgress from "../competition-progress";
import "./dashboard-v10.css";

type Student = GradeStudentLike & { id:string; code?:string; name?:string; class?:string; className?:string };
type AttendanceStatus = "present"|"absent"|"late"|"excused"|"escaped";
type AttendanceRecord = { class?:string; date?:string; records?:Record<string,AttendanceStatus> };
type Lesson = { subject?:string; className?:string; notes?:string };

function dateKey(value:Date){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Riyadh",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(value);
  const map=Object.fromEntries(parts.map(part=>[part.type,part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}
function weekdayKey(value:Date){return new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Riyadh",weekday:"long"}).format(value).toLowerCase();}
function timeLabel(value:Date){return new Intl.DateTimeFormat("ar-SA",{timeZone:"Asia/Riyadh",hour:"numeric",minute:"2-digit"}).format(value);}
function dateLabel(value:Date){return new Intl.DateTimeFormat("ar-SA",{timeZone:"Asia/Riyadh",weekday:"long",day:"numeric",month:"long"}).format(value);}

export default function TeacherDashboardPage(){
  const session=useTeacherClient();
  const {activePlan}=useGradePlan(true);
  const [students,setStudents]=useState<Student[]>([]);
  const [attendance,setAttendance]=useState<AttendanceRecord[]>([]);
  const [timetable,setTimetable]=useState<Record<string,Lesson>>({});
  const [now,setNow]=useState<Date|null>(null);
  const [message,setMessage]=useState("");

  useEffect(()=>{setNow(new Date());const timer=window.setInterval(()=>setNow(new Date()),30000);return()=>window.clearInterval(timer);},[]);

  useEffect(()=>{
    if(!session?.teacherId||!session?.subjectKey)return;
    const controller=new AbortController();
    const params=new URLSearchParams({subjectId:session.subjectKey});
    if(session.activeGrade)params.set("grade",String(session.activeGrade));
    fetch(`/api/teacher/students?${params}`,{cache:"no-store",signal:controller.signal})
      .then(async response=>{const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||"تعذر تحميل فصولك");return data;})
      .then(data=>{
        const list=(Array.isArray(data.students)?data.students:[]).map((raw:Record<string,unknown>)=>{
          const code=String(raw.code||raw.id||"").trim().toUpperCase();
          const className=String(raw.className||raw.class||"").trim();
          return {...(raw as unknown as Student),id:code,code,name:String(raw.name||"").trim(),class:className,className} as Student;
        }).filter((student:Student)=>student.id&&student.name&&student.class);
        setStudents(list);setMessage("");
      }).catch(error=>{if((error as Error)?.name!=="AbortError")setMessage(error instanceof Error?error.message:"تعذر تحميل فصولك");});

    const stopAttendance=onSnapshot(collection(db,tenantCollection(session.teacherId,session.subjectKey as never,"attendance")),snapshot=>setAttendance(snapshot.docs.map(item=>item.data() as AttendanceRecord)),()=>setAttendance([]));
    fetch(`/api/teacher/timetable?subjectId=${encodeURIComponent(session.subjectKey)}`,{cache:"no-store",signal:controller.signal})
      .then(response=>response.ok?response.json():Promise.reject())
      .then(data=>setTimetable(data.lessons&&typeof data.lessons==="object"?data.lessons:{})).catch(()=>setTimetable({}));
    return()=>{controller.abort();stopAttendance();};
  },[session?.teacherId,session?.subjectKey,session?.activeGrade]);

  const today=now?dateKey(now):"";
  const weekday=now?weekdayKey(now):"";
  const classes=useMemo(()=>[...new Set(students.map(student=>String(student.class||"")).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ar",{numeric:true})),[students]);
  const lessons=useMemo(()=>Object.entries(timetable).flatMap(([cell,lesson])=>{
    const match=cell.match(/^(sunday|monday|tuesday|wednesday|thursday)-([1-7])$/);
    if(!match||match[1]!==weekday||!lesson.className)return[];
    return[{period:Number(match[2]),className:String(lesson.className),notes:String(lesson.notes||"")}];
  }).sort((a,b)=>a.period-b.period),[timetable,weekday]);
  const savedToday=useMemo(()=>new Set(attendance.filter(item=>item.date===today&&item.class).map(item=>String(item.class))),[attendance,today]);
  const studentStats=useMemo(()=>students.map(student=>{
    const result=activePlan?calculateGradePlanResult(activePlan,student):null;
    return {...student,average:result?Math.round(result.percentage):0,completion:result?.completion||0,hasGrade:Boolean(result&&result.recordedMaximum>0)};
  }),[students,activePlan]);
  const classStats=useMemo(()=>classes.map(name=>{
    const rows=studentStats.filter(student=>student.class===name);
    const graded=rows.filter(student=>student.hasGrade);
    const average=graded.length?Math.round(graded.reduce((sum,student)=>sum+student.average,0)/graded.length):0;
    const support=graded.filter(student=>student.average<60).length;
    return{name,students:rows.length,average,support,todayScheduled:lessons.some(lesson=>lesson.className===name),attendanceDone:savedToday.has(name),completion:graded.length?Math.round(graded.reduce((sum,student)=>sum+student.completion,0)/graded.length):0};
  }),[classes,studentStats,lessons,savedToday]);

  const supportStudents=studentStats.filter(student=>student.hasGrade&&student.average<60).sort((a,b)=>a.average-b.average);
  const incompleteClasses=lessons.filter(lesson=>!savedToday.has(lesson.className));
  const nextLesson=lessons.find(lesson=>!savedToday.has(lesson.className))||lessons[0];
  const graded=studentStats.filter(student=>student.hasGrade);
  const overall=graded.length?Math.round(graded.reduce((sum,student)=>sum+student.average,0)/graded.length):0;
  const completedAttendance=lessons.length?Math.round(((lessons.length-incompleteClasses.length)/lessons.length)*100):0;

  const aiInsight=supportStudents.length
    ? {title:`${supportStudents.length} طالب يحتاجون دعمًا`,copy:`أولوية البدء: ${supportStudents[0].name} في ${supportStudents[0].class} بمتوسط ${supportStudents[0].average}٪.`,href:"/teacher/follow-up",action:"فتح خطة المتابعة"}
    : incompleteClasses.length
      ? {title:`تبقى ${incompleteClasses.length} فصل في متابعة اليوم`,copy:"أنهِ سجل المتابعة أولًا، ثم انتقل للتحصيل. سأبقي الحالات المتكررة ظاهرة لك.",href:"/teacher/attendance",action:"إكمال سجل المتابعة"}
      : overall
        ? {title:"يومك الأساسي مكتمل",copy:`متوسط التحصيل الحالي ${overall}٪. راجع مقارنة الفصول لمعرفة أين يحتاج التدخل.`,href:"/teacher/report",action:"مقارنة الفصول"}
        : {title:"ابدأ بتجهيز بياناتك الأساسية",copy:"أضف الجدول واعتمد خطة الدرجات، وبعدها ستتحول هذه المساحة إلى مساعد يومي مبني على بياناتك.",href:"/teacher/timetable",action:"إعداد الجدول"};

  return <main className="teacher-home-v10" dir="rtl">
    {message?<p className="th10-message">{message}</p>:null}

    <section className="th10-pulse">
      <div className="th10-day"><small>اليوم الدراسي</small><h2>{now?dateLabel(now):"جارٍ تحديد اليوم"}</h2><span>{now?timeLabel(now):"—"}</span></div>
      <div className="th10-ai"><span>AI</span><div><small>قراءة ذكية لليوم</small><h2>{aiInsight.title}</h2><p>{aiInsight.copy}</p></div><Link href={aiInsight.href}>{aiInsight.action}</Link></div>
    </section>

    <section className="th10-kpis">
      <article><small>الحصة الأقرب</small><b>{nextLesson?.className||"لا توجد حصة"}</b><span>{nextLesson?`الحصة ${nextLesson.period}`:"راجع الجدول الدراسي"}</span></article>
      <article><small>إنجاز متابعة اليوم</small><b>{lessons.length?`${completedAttendance}٪`:"—"}</b><span>{lessons.length?`${lessons.length-incompleteClasses.length} من ${lessons.length} فصول":"لا توجد حصص اليوم"}</span></article>
      <article><small>متوسط التحصيل</small><b>{overall?`${overall}٪`:"—"}</b><span>{graded.length?`${graded.length} طالب لديه رصد":"لم يبدأ الرصد"}</span></article>
      <article><small>يحتاجون تدخلًا</small><b>{supportStudents.length}</b><span>{"أقل من 60٪ بعد وجود رصد"}</span></article>
    </section>

    <section className="th10-section-head"><div><small>مساحات العمل</small><h2>فصولك في نظرة أكاديمية واحدة</h2><p>ابدأ من الفصل، ثم انتقل للمتابعة أو التحصيل أو الملاحظة من نفس السياق.</p></div><Link href="/teacher/students">إدارة الفصول</Link></section>
    <section className="th10-classes">
      {classStats.map(item=><article key={item.name} className={item.todayScheduled?"today":""}>
        <header><div><small>{item.todayScheduled?"ضمن جدول اليوم":"فصل مسند"}</small><h3>{item.name}</h3></div><span>{item.students} طالب</span></header>
        <div className="th10-class-progress"><div><span>التحصيل</span><b>{item.average?`${item.average}٪`:"—"}</b></div><i><u style={{width:`${item.average}%`}}/></i></div>
        <div className="th10-class-meta"><span className={item.attendanceDone?"done":""}><b>{item.attendanceDone?"مكتمل":item.todayScheduled?"بانتظارك":"—"}</b><small>متابعة اليوم</small></span><span className={item.support?"warn":""}><b>{item.support}</b><small>يحتاج دعمًا</small></span><span><b>{item.completion?`${item.completion}٪`:"—"}</b><small>اكتمال الرصد</small></span></div>
        <footer><Link href="/teacher/attendance">سجل المتابعة</Link><Link href="/teacher/grades">التحصيل</Link><Link href="/teacher/notes">ملاحظة</Link></footer>
      </article>)}
      {!classStats.length?<div className="th10-empty"><b>لا توجد فصول مرتبطة بهذه المادة</b><span>ابدأ من إدارة الطلاب وحدد الفصول التي تدرسها.</span><Link href="/teacher/students">فتح إدارة الطلاب</Link></div>:null}
    </section>

    <section className="th10-bottom">
      <article className="th10-flow"><header><small>مسار العمل المقترح</small><h2>البوابة تمشي مع يومك، مو العكس</h2></header><div><Link href="/teacher/attendance"><b>01</b><span><strong>متابعة الفصل</strong><small>الحضور والانضباط أولًا</small></span></Link><Link href="/teacher/grades"><b>02</b><span><strong>رصد التحصيل</strong><small>إدخال سريع ثم حفظ</small></span></Link><Link href="/teacher/follow-up"><b>03</b><span><strong>قرار تعليمي</strong><small>إتقان، دعم، ملاحظة</small></span></Link></div></article>
      <article className="th10-race"><header><small>التنافس المهني</small><h2>تقدمك من العمل الحقيقي</h2><p>الدرجات والحضور والملاحظات والخطط المحفوظة فعليًا هي التي تحسب.</p></header><TeacherCompetitionProgress/></article>
    </section>
  </main>;
}
