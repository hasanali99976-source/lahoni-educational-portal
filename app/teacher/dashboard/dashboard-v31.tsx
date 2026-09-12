"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { tenantCollection } from "../../../lib/teacher-tenant";
import { useTeacherClient } from "../../../lib/teacher-client";
import { calculateGradePlanResult, type GradeStudentLike, type GradeValueMap } from "../../../lib/grade-plan";
import { useGradePlan } from "../../../lib/use-grade-plan";

type GradeDeduction={planId?:string;amount?:number;reversedAt?:string};
type Student=GradeStudentLike&{id:string;code?:string;name?:string;class?:string;className?:string;gradeDeductions?:GradeDeduction[];gradePlanValues?:Record<string,GradeValueMap>};
type AttendanceStatus="present"|"absent"|"late"|"excused"|"escaped";
type AttendanceRecord={class?:string;date?:string;records?:Record<string,AttendanceStatus>};
type Lesson={subject?:string;className?:string;notes?:string};
type StudentRow=Student&{score:number;completion:number;hasGrade:boolean;deduction:number};

function baseSubject(value:string){return String(value||"").trim().split("--")[0];}
function dateKey(value:Date){const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Riyadh",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(value);const map=Object.fromEntries(parts.map(part=>[part.type,part.value]));return `${map.year}-${map.month}-${map.day}`;}
function weekdayKey(value:Date){return new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Riyadh",weekday:"long"}).format(value).toLowerCase();}
function dateLabel(value:Date){return new Intl.DateTimeFormat("ar-SA",{timeZone:"Asia/Riyadh",weekday:"long",day:"numeric",month:"long"}).format(value);}
function timeLabel(value:Date){return new Intl.DateTimeFormat("ar-SA",{timeZone:"Asia/Riyadh",hour:"numeric",minute:"2-digit"}).format(value);}
function deductionTotal(student:Student,planId:string){return (Array.isArray(student.gradeDeductions)?student.gradeDeductions:[]).filter(item=>!item.reversedAt&&(!item.planId||item.planId===planId)).reduce((sum,item)=>sum+Math.max(0,Number(item.amount||0)),0);}

export default function TeacherDashboardV31(){
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
    const subjectId=baseSubject(session.subjectKey);const controller=new AbortController();const params=new URLSearchParams({subjectId});if(session.activeGrade)params.set("grade",String(session.activeGrade));
    Promise.all([
      fetch(`/api/teacher/students?${params}`,{cache:"no-store",signal:controller.signal}).then(async response=>{const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||"تعذر تحميل الطلاب");return data;}),
      fetch(`/api/teacher/grade-data?subjectId=${encodeURIComponent(subjectId)}`,{cache:"no-store",signal:controller.signal}).then(async response=>{const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||"تعذر تحميل التحصيل");return data;}),
      fetch(`/api/teacher/timetable?subjectId=${encodeURIComponent(subjectId)}`,{cache:"no-store",signal:controller.signal}).then(async response=>response.ok?response.json():({})),
    ]).then(([data,academicData,timetableData])=>{
      const byCode=academicData.byCode&&typeof academicData.byCode==="object"?academicData.byCode as Record<string,Record<string,unknown>>:{};
      const list=(Array.isArray(data.students)?data.students:[]).map((raw:Record<string,unknown>)=>{const code=String(raw.code||raw.id||"").trim().toUpperCase();const className=String(raw.className||raw.class||"").trim();const academic=byCode[code]||{};return{...(raw as unknown as Student),id:code,code,name:String(raw.name||"").trim(),class:className,className,gradeValues:academic.gradeValues&&typeof academic.gradeValues==="object"?academic.gradeValues as GradeValueMap:raw.gradeValues as GradeValueMap,gradePlanValues:academic.gradePlanValues&&typeof academic.gradePlanValues==="object"?academic.gradePlanValues as Record<string,GradeValueMap>:raw.gradePlanValues as Record<string,GradeValueMap>,gradeDeductions:Array.isArray(academic.gradeDeductions)?academic.gradeDeductions as GradeDeduction[]:Array.isArray(raw.gradeDeductions)?raw.gradeDeductions as GradeDeduction[]:[]} as Student;}).filter((student:Student)=>student.id&&student.name&&student.class);
      setStudents(list);setTimetable(timetableData.lessons&&typeof timetableData.lessons==="object"?timetableData.lessons:{});setMessage("");
    }).catch(error=>{if((error as Error)?.name!=="AbortError")setMessage(error instanceof Error?error.message:"تعذر تحميل بيانات المتابعة");});
    const stopAttendance=onSnapshot(collection(db,tenantCollection(session.teacherId,session.subjectKey as never,"attendance")),snapshot=>setAttendance(snapshot.docs.map(item=>item.data() as AttendanceRecord)),()=>setAttendance([]));
    return()=>{controller.abort();stopAttendance();};
  },[session?.teacherId,session?.subjectKey,session?.activeGrade]);

  const today=now?dateKey(now):"";const weekday=now?weekdayKey(now):"";
  const classes=useMemo(()=>[...new Set(students.map(student=>String(student.class||"")).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ar",{numeric:true})),[students]);
  const lessons=useMemo(()=>Object.entries(timetable).flatMap(([cell,lesson])=>{const match=cell.match(/^(sunday|monday|tuesday|wednesday|thursday)-([1-7])$/);if(!match||match[1]!==weekday||!lesson.className)return[];return[{period:Number(match[2]),className:String(lesson.className),notes:String(lesson.notes||"")}];}).sort((a,b)=>a.period-b.period),[timetable,weekday]);
  const todayRecords=useMemo(()=>attendance.filter(item=>item.date===today),[attendance,today]);
  const attendanceSummary=useMemo(()=>{const result={present:0,absent:0,late:0,escaped:0,excused:0,total:0};todayRecords.forEach(item=>Object.values(item.records||{}).forEach(status=>{if(status in result){result[status as keyof typeof result]+=1;result.total+=1;}}));return result;},[todayRecords]);
  const completedClasses=useMemo(()=>new Set(todayRecords.filter(item=>item.class).map(item=>String(item.class))),[todayRecords]);
  const studentRows=useMemo<StudentRow[]>(()=>students.map(student=>{const result=activePlan?calculateGradePlanResult(activePlan,student):null;const deduction=result&&activePlan?deductionTotal(student,activePlan.id):0;const score=result?Math.max(0,Math.round(result.earned-deduction)):0;return{...student,score,completion:Math.round(result?.completion||0),hasGrade:Boolean(result&&result.recordedMaximum>0),deduction};}),[students,activePlan]);
  const overall=useMemo(()=>{const graded=studentRows.filter(item=>item.hasGrade);return graded.length?Math.round(graded.reduce((sum,item)=>sum+item.score,0)/graded.length):0;},[studentRows]);
  const support=studentRows.filter(item=>item.hasGrade&&item.score<60).length;
  const uncompletedLessons=lessons.filter(item=>!completedClasses.has(item.className));
  const teacherFirstName=String(session.teacherName||"المعلم").replace(/^أ\.?\s*/,"").split(/\s+/)[0]||"المعلم";
  const hour=now?Number(new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Riyadh",hour:"2-digit",hour12:false}).format(now)):12;
  const greeting=hour<12?"صباح الخير":hour<18?"مساء الخير":"مساء الخير";

  const subjectItems=(session.subjects||[]).slice(0,5);

  return <main className="teacher-dashboard-v31" dir="rtl">
    {message?<p className="td31-message">{message}</p>:null}

    <section className="td31-hero">
      <div className="td31-welcome">
        <small>{greeting}</small>
        <h1>أ. {teacherFirstName}</h1>
        <div className="td31-meta"><span>{now?dateLabel(now):"اليوم الدراسي"}</span><i>•</i><span>{now?timeLabel(now):""}</span></div>
      </div>
      <div className="td31-subject-strip" aria-label="المواد">
        <span className="td31-subject-label">المادة الحالية</span>
        <strong>{session.subject||"المادة"}</strong>
        <small>{session.activeGradeLabel||"المرحلة الثانوية"}</small>
        {subjectItems.length>1?<div className="td31-subject-pills">{subjectItems.map((item,index)=><span key={`${item.subjectKey||item.subject||index}`} className={String(item.subjectKey||"")===String(session.subjectKey||"")?"active":""}>{item.subject||item.subjectKey||"مادة"}</span>)}</div>:null}
      </div>
    </section>

    <section className="td31-kpis">
      <div data-kpi="lessons"><span>حصص اليوم</span><b>{lessons.length}</b><small>{uncompletedLessons.length?`${uncompletedLessons.length} بانتظار التحضير`:"مكتملة"}</small></div>
      <div data-kpi="students"><span>الطلاب</span><b>{students.length}</b><small>{classes.length} فصول</small></div>
      <div data-kpi="attendance"><span>الحضور</span><b>{attendanceSummary.present}</b><small>{attendanceSummary.absent} غياب • {attendanceSummary.late} تأخير</small></div>
      <div data-kpi="grades"><span>التحصيل</span><b>{studentRows.some(item=>item.hasGrade)?`${overall}%`:"—"}</b><small>{support?`${support} يحتاجون دعمًا`:"مستقر"}</small></div>
    </section>

    <section className="td31-centers" aria-label="اختصارات العمل">
      <Link href="/teacher/timetable" data-center="day"><b>الجدول</b><small>حصص اليوم</small></Link>
      <Link href="/teacher/attendance" data-center="attendance"><b>الحضور</b><small>تسجيل سريع</small></Link>
      <Link href="/teacher/students" data-center="students"><b>الطلاب</b><small>الفصول والسجلات</small></Link>
      <Link href="/teacher/grades" data-center="grades"><b>الدرجات</b><small>الرصد والتحصيل</small></Link>
      <Link href="/teacher/follow-up" data-center="follow"><b>المتابعة</b><small>دعم وإتقان</small></Link>
      <Link href="/teacher/reports" data-center="reports"><b>التقارير</b><small>طباعة وتحليل</small></Link>
    </section>

    <section className="td31-lower">
      <article className="td31-today">
        <header><div><small>متابعة مباشرة</small><h2>حصص اليوم</h2></div><Link href="/teacher/timetable">الجدول الكامل</Link></header>
        <div>{lessons.length?lessons.map(lesson=>{const done=completedClasses.has(lesson.className);return <Link href="/teacher/attendance" key={`${lesson.period}-${lesson.className}`} className={done?"done":""}><b>{lesson.period}</b><div><strong>{lesson.className}</strong><small>{lesson.notes||session.subject||"حصة دراسية"}</small></div><span>{done?"تم":"ابدأ"}</span></Link>}):<p className="td31-empty">لا توجد حصص مسجلة لهذا اليوم.</p>}</div>
      </article>

      <article className="td31-alerts">
        <header><small>قراءة سريعة</small><h2>ما يحتاج انتباهك</h2></header>
        <div className="td31-alert-list"><Link href="/teacher/follow-up"><span>دعم تعليمي</span><b>{support}</b><small>طلاب أقل من 60%</small></Link><Link href="/teacher/attendance"><span>غياب اليوم</span><b>{attendanceSummary.absent}</b><small>حالات مسجلة</small></Link><Link href="/teacher/grades"><span>متوسط التحصيل</span><b>{studentRows.some(item=>item.hasGrade)?`${overall}%`:"—"}</b><small>للمادة الحالية</small></Link></div>
      </article>
    </section>
  </main>;
}
