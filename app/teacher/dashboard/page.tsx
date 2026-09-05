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
import "./dashboard-v11.css";

type Student=GradeStudentLike&{id:string;code?:string;name?:string;class?:string;className?:string};
type AttendanceStatus="present"|"absent"|"late"|"excused"|"escaped";
type AttendanceRecord={class?:string;date?:string;records?:Record<string,AttendanceStatus>};
type Lesson={subject?:string;className?:string;notes?:string};

function dateKey(value:Date){const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Riyadh",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(value);const map=Object.fromEntries(parts.map(part=>[part.type,part.value]));return `${map.year}-${map.month}-${map.day}`;}
function weekdayKey(value:Date){return new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Riyadh",weekday:"long"}).format(value).toLowerCase();}
function timeLabel(value:Date){return new Intl.DateTimeFormat("ar-SA",{timeZone:"Asia/Riyadh",hour:"numeric",minute:"2-digit"}).format(value);}
function dateLabel(value:Date){return new Intl.DateTimeFormat("ar-SA",{timeZone:"Asia/Riyadh",weekday:"long",day:"numeric",month:"long"}).format(value);}
function subjectTagline(subjectId:string){
  if(subjectId.includes("history"))return"الأحداث • الحضارات • المصادر";
  if(subjectId.includes("critical"))return"تحليل • استدلال • قرار";
  if(subjectId.includes("math"))return"مسائل • أنماط • حلول";
  if(["science","physics","chemistry","biology"].some(key=>subjectId.includes(key)))return"استكشاف • تجربة • فهم";
  if(subjectId.includes("geography"))return"مكان • خرائط • عالم";
  if(subjectId.includes("arabic"))return"قراءة • كتابة • بلاغة";
  if(subjectId.includes("english"))return"Reading • Writing • Skills";
  return"تعلم • متابعة • أثر";
}

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
    const controller=new AbortController();const params=new URLSearchParams({subjectId:session.subjectKey});if(session.activeGrade)params.set("grade",String(session.activeGrade));
    fetch(`/api/teacher/students?${params}`,{cache:"no-store",signal:controller.signal}).then(async response=>{const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||"تعذر تحميل فصولك");return data;}).then(data=>{const list=(Array.isArray(data.students)?data.students:[]).map((raw:Record<string,unknown>)=>{const code=String(raw.code||raw.id||"").trim().toUpperCase();const className=String(raw.className||raw.class||"").trim();return{...(raw as unknown as Student),id:code,code,name:String(raw.name||"").trim(),class:className,className} as Student;}).filter((student:Student)=>student.id&&student.name&&student.class);setStudents(list);setMessage("");}).catch(error=>{if((error as Error)?.name!=="AbortError")setMessage(error instanceof Error?error.message:"تعذر تحميل فصولك");});
    const stopAttendance=onSnapshot(collection(db,tenantCollection(session.teacherId,session.subjectKey as never,"attendance")),snapshot=>setAttendance(snapshot.docs.map(item=>item.data() as AttendanceRecord)),()=>setAttendance([]));
    fetch(`/api/teacher/timetable?subjectId=${encodeURIComponent(session.subjectKey)}`,{cache:"no-store",signal:controller.signal}).then(response=>response.ok?response.json():Promise.reject()).then(data=>setTimetable(data.lessons&&typeof data.lessons==="object"?data.lessons:{})).catch(()=>setTimetable({}));
    return()=>{controller.abort();stopAttendance();};
  },[session?.teacherId,session?.subjectKey,session?.activeGrade]);

  const today=now?dateKey(now):"";const weekday=now?weekdayKey(now):"";
  const classes=useMemo(()=>[...new Set(students.map(student=>String(student.class||"")).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ar",{numeric:true})),[students]);
  const lessons=useMemo(()=>Object.entries(timetable).flatMap(([cell,lesson])=>{const match=cell.match(/^(sunday|monday|tuesday|wednesday|thursday)-([1-7])$/);if(!match||match[1]!==weekday||!lesson.className)return[];return[{period:Number(match[2]),className:String(lesson.className),notes:String(lesson.notes||"")}];}).sort((a,b)=>a.period-b.period),[timetable,weekday]);
  const savedToday=useMemo(()=>new Set(attendance.filter(item=>item.date===today&&item.class).map(item=>String(item.class))),[attendance,today]);
  const studentStats=useMemo(()=>students.map(student=>{const result=activePlan?calculateGradePlanResult(activePlan,student):null;return{...student,average:result?Math.round(result.percentage):0,completion:result?.completion||0,hasGrade:Boolean(result&&result.recordedMaximum>0)};}),[students,activePlan]);
  const classStats=useMemo(()=>classes.map(name=>{const rows=studentStats.filter(student=>student.class===name);const gradedRows=rows.filter(student=>student.hasGrade);const average=gradedRows.length?Math.round(gradedRows.reduce((sum,student)=>sum+student.average,0)/gradedRows.length):0;const support=gradedRows.filter(student=>student.average<60).length;return{name,students:rows.length,average,support,todayScheduled:lessons.some(lesson=>lesson.className===name),attendanceDone:savedToday.has(name),completion:gradedRows.length?Math.round(gradedRows.reduce((sum,student)=>sum+student.completion,0)/gradedRows.length):0};}),[classes,studentStats,lessons,savedToday]);

  const supportStudents=studentStats.filter(student=>student.hasGrade&&student.average<60).sort((a,b)=>a.average-b.average);
  const incompleteClasses=lessons.filter(lesson=>!savedToday.has(lesson.className));
  const nextLesson=lessons.find(lesson=>!savedToday.has(lesson.className))||lessons[0];
  const graded=studentStats.filter(student=>student.hasGrade);
  const overall=graded.length?Math.round(graded.reduce((sum,student)=>sum+student.average,0)/graded.length):0;
  const averageCompletion=graded.length?Math.round(graded.reduce((sum,student)=>sum+student.completion,0)/graded.length):0;
  const completedAttendance=lessons.length?Math.round(((lessons.length-incompleteClasses.length)/lessons.length)*100):0;
  const excellentStudents=graded.filter(student=>student.average>=90).length;
  const subjectWorkspaces=session.subjects?.length?session.subjects:[{workspaceKey:session.workspaceKey||session.subjectKey||"subject",subjectId:session.subjectKey||"history",subjectName:session.subject||"المادة",grade:session.activeGrade||undefined,gradeLabel:session.activeGradeLabel||undefined}];

  const aiInsight=supportStudents.length
    ? {title:`${supportStudents.length} طالب يحتاجون دعمًا`,copy:`ابدأ بـ ${supportStudents[0].name} في ${supportStudents[0].class}. متوسطه الحالي ${supportStudents[0].average}٪.`,href:"/teacher/follow-up",action:"فتح خطة الدعم"}
    : incompleteClasses.length
      ? {title:`تبقى ${incompleteClasses.length} فصل في متابعة اليوم`,copy:"أنهِ سجل المتابعة أولًا، وبعدها انتقل للتحصيل. الحالات المتكررة ستبقى ظاهرة لك.",href:"/teacher/attendance",action:"إكمال المتابعة"}
      : overall
        ? {title:"الأعمال الأساسية مستقرة",copy:`متوسط التحصيل الحالي ${overall}٪. الآن أفضل وقت لمقارنة الفصول أو مراجعة المتميزين والمتعثرين.`,href:"/teacher/report",action:"مقارنة الفصول"}
        : {title:"جهّز بياناتك الأساسية",copy:"أضف جدولك واعتمد الخطة الدراسية؛ بعدها تتحول الصفحة إلى مساعد يومي مبني على بياناتك الفعلية.",href:"/teacher/timetable",action:"فتح الجدول"};

  const taskRows=[...lessons.slice(0,4).map(lesson=>({title:`حصة ${session.subject||"المادة"} • ${lesson.className}`,meta:`الحصة ${lesson.period}${lesson.notes?` • ${lesson.notes}`:""}`,done:savedToday.has(lesson.className),href:"/teacher/attendance"})),...(supportStudents.length?[{title:`متابعة ${supportStudents[0].name}`,meta:`${supportStudents[0].class} • يحتاج تدخلًا تعليميًا`,done:false,href:"/teacher/follow-up"}]:[])].slice(0,5);

  return <main className="teacher-dashboard-v16" dir="rtl">
    {message?<p className="td16-message">{message}</p>:null}

    <section className="td16-hero">
      <div className="td16-hero-copy">
        <small>{now?dateLabel(now):"يومك الدراسي"}</small>
        <h1>مرحبًا {session.teacherName||"أستاذنا"}</h1>
        <p>مساحة تعليمية ذكية تجمع موادك وفصولك ومهامك وقراءة الأداء في مكان واحد.</p>
        <div><span>{session.subject||"المادة الحالية"}</span><b>{session.activeGradeLabel||"المرحلة الثانوية"}</b><em>{now?timeLabel(now):"—"}</em></div>
      </div>
      <div className="td16-hero-art" data-subject={session.subjectKey||"history"} aria-hidden="true"><span/><i/><b/></div>
      <div className="td16-focus">
        <span>AI</span><div><small>الأولوية الذكية</small><h2>{aiInsight.title}</h2><p>{aiInsight.copy}</p></div><Link href={aiInsight.href}>{aiInsight.action}</Link>
      </div>
    </section>

    <section className="td16-kpis">
      <article data-tone="mint"><span>الحضور اليوم</span><b>{lessons.length?`${completedAttendance}٪`:"—"}</b><small>{lessons.length-incompleteClasses.length} من {lessons.length||0} فصول</small><i style={{width:`${completedAttendance}%`}}/></article>
      <article data-tone="blue"><span>متوسط التحصيل</span><b>{overall?`${overall}٪`:"—"}</b><small>{graded.length} طالب لديهم رصد</small><i style={{width:`${overall}%`}}/></article>
      <article data-tone="gold"><span>اكتمال الرصد</span><b>{averageCompletion?`${averageCompletion}٪`:"—"}</b><small>{excellentStudents} طالب متميز</small><i style={{width:`${averageCompletion}%`}}/></article>
      <article data-tone="purple"><span>يحتاجون دعمًا</span><b>{supportStudents.length}</b><small>{classes.length} فصول مرتبطة</small><i style={{width:`${students.length?Math.min(100,Math.round((supportStudents.length/students.length)*100)):0}%`}}/></article>
    </section>

    <section className="td16-main-grid">
      <article className="td16-subjects-panel">
        <header><div><small>المواد المسندة لي</small><h2>مساحاتك التعليمية</h2></div><span>{subjectWorkspaces.length} مادة</span></header>
        <div className="td16-subject-cards">{subjectWorkspaces.map(subject=>{const active=subject.workspaceKey===session.workspaceKey;return <button type="button" key={subject.workspaceKey} data-subject={subject.subjectId} className={active?"active":""} onClick={()=>{if(!active)void session.setSubject?.(subject.workspaceKey);}}><span className="td16-subject-art" data-subject={subject.subjectId}/><div><small>{subject.gradeLabel||"مساحة تعليمية"}</small><h3>{subject.subjectName}</h3><p>{subjectTagline(subject.subjectId)}</p></div><footer><b>{active?students.length:"فتح"}</b><span>{active?"طالب في المادة":"الانتقال للمادة"}</span></footer></button>;})}</div>
      </article>

      <article className="td16-tasks-panel">
        <header><div><small>مهامي اليوم</small><h2>اليوم الدراسي</h2></div><Link href="/teacher/timetable">عرض الجدول</Link></header>
        <div className="td16-task-list">{taskRows.length?taskRows.map((task,index)=><Link href={task.href} key={`${task.title}-${index}`} className={task.done?"done":""}><span>{task.done?"✓":String(index+1).padStart(2,"0")}</span><div><b>{task.title}</b><small>{task.meta}</small></div><i>‹</i></Link>):<div className="td16-task-empty"><b>لا توجد مهام مجدولة اليوم</b><span>أضف جدولك ليظهر يومك تلقائيًا.</span></div>}</div>
      </article>

      <article className="td16-class-panel">
        <header><div><small>الفصول والطلاب</small><h2>نظرة سريعة</h2></div><Link href="/teacher/students">كل الفصول</Link></header>
        <div>{classStats.slice(0,4).map(item=><Link href="/teacher/attendance" key={item.name}><span className="td16-ring" style={{background:`conic-gradient(${item.average>=90?"#0ca58c":item.average>=70?"#2f7df4":"#d69a3f"} ${item.average||0}%, #e7eef2 0)`}}><i>{item.average?`${item.average}٪`:"—"}</i></span><div><b>{item.name}</b><small>{item.students} طالب • {item.attendanceDone?"المتابعة مكتملة":item.todayScheduled?"بانتظار المتابعة":"فصل مسند"}</small></div><em>‹</em></Link>)}</div>
      </article>
    </section>

    <section className="td16-analytics-grid">
      <article className="td16-rings-panel">
        <header><small>مؤشرات الأداء</small><h2>الصورة الأكاديمية</h2></header>
        <div><span><i style={{background:`conic-gradient(#0ca58c ${completedAttendance}%,#edf2f4 0)`}}><b>{lessons.length?`${completedAttendance}٪`:"—"}</b></i><strong>الحضور</strong><small>اليوم</small></span><span><i style={{background:`conic-gradient(#2f7df4 ${overall}%,#edf2f4 0)`}}><b>{overall?`${overall}٪`:"—"}</b></i><strong>التحصيل</strong><small>الحالي</small></span><span><i style={{background:`conic-gradient(#d5a63e ${averageCompletion}%,#edf2f4 0)`}}><b>{averageCompletion?`${averageCompletion}٪`:"—"}</b></i><strong>الرصد</strong><small>الاكتمال</small></span><span><i style={{background:`conic-gradient(#7a56d8 ${students.length?Math.max(0,100-Math.round((supportStudents.length/students.length)*100)):0}%,#edf2f4 0)`}}><b>{students.length?`${Math.max(0,100-Math.round((supportStudents.length/students.length)*100))}٪`:"—"}</b></i><strong>الاستقرار</strong><small>الأكاديمي</small></span></div>
      </article>

      <article className="td16-next-panel"><header><small>الحصة الأقرب</small><span>{lessons.length} حصص اليوم</span></header><h2>{nextLesson?.className||"لا توجد حصة مسجلة"}</h2><p>{nextLesson?`الحصة ${nextLesson.period}${nextLesson.notes?` • ${nextLesson.notes}`:""}`:"أضف جدولك مرة واحدة ليظهر يومك تلقائيًا."}</p><div><Link href={nextLesson?"/teacher/attendance":"/teacher/timetable"}>{nextLesson?"فتح سجل الفصل":"إعداد الجدول"}</Link><Link href="/teacher/notes">إضافة ملاحظة</Link></div></article>

      <article className="td16-race-panel"><header><small>المنافسة بين المعلمين</small><h2>تقدمك المهني</h2></header><p>يُحسب من العمل الحقيقي المحفوظ داخل البوابة.</p><TeacherCompetitionProgress/></article>
    </section>

    <section className="td16-section-head"><div><small>الفصول التعليمية</small><h2>كل فصل مساحة عمل مستقلة</h2><p>المتابعة والتحصيل والملاحظات تبدأ من الفصل نفسه.</p></div><Link href="/teacher/students">إدارة الطلاب والفصول</Link></section>
    <section className="td16-classes">{classStats.map(item=><article key={item.name} className={item.todayScheduled?"today":""}><header><div><small>{item.todayScheduled?"ضمن جدول اليوم":"فصل مسند"}</small><h3>{item.name}</h3></div><span>{item.students} طالب</span></header><div className="td16-class-progress"><div><span>التحصيل</span><b>{item.average?`${item.average}٪`:"—"}</b></div><i><u style={{width:`${item.average}%`}}/></i></div><div className="td16-class-meta"><span className={item.attendanceDone?"done":""}><b>{item.attendanceDone?"مكتمل":item.todayScheduled?"بانتظارك":"—"}</b><small>متابعة اليوم</small></span><span className={item.support?"warn":""}><b>{item.support}</b><small>يحتاج دعمًا</small></span><span><b>{item.completion?`${item.completion}٪`:"—"}</b><small>اكتمال الرصد</small></span></div><footer><Link href="/teacher/attendance">متابعة</Link><Link href="/teacher/grades">تحصيل</Link><Link href="/teacher/notes">ملاحظة</Link></footer></article>)}{!classStats.length?<div className="td16-empty"><b>لا توجد فصول مرتبطة بهذه المادة</b><span>حدد فصولك من إدارة الطلاب، وستظهر هنا مباشرة.</span><Link href="/teacher/students">إدارة الطلاب</Link></div>:null}</section>

    <section className="td16-bottom"><article><header><small>مسار العمل الذكي</small><h2>ثلاث خطوات تكفي لمعظم يومك</h2></header><div><Link href="/teacher/attendance"><b>01</b><span><strong>متابعة الفصل</strong><small>الحضور والانضباط</small></span></Link><Link href="/teacher/grades"><b>02</b><span><strong>رصد التحصيل</strong><small>الوحدة أو الفترة الحالية</small></span></Link><Link href="/teacher/follow-up"><b>03</b><span><strong>قرار تعليمي</strong><small>إتقان، دعم أو إثراء</small></span></Link></div></article><article className="td16-recommend"><header><small>توصية تربوية ذكية</small><h2>{aiInsight.title}</h2></header><p>{aiInsight.copy}</p><Link href={aiInsight.href}>{aiInsight.action}</Link></article></section>
  </main>;
}
