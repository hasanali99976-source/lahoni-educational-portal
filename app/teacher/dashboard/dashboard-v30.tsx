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
function deductionTotal(student:Student,planId:string){return (Array.isArray(student.gradeDeductions)?student.gradeDeductions:[]).filter(item=>!item.reversedAt&&(!item.planId||item.planId===planId)).reduce((sum,item)=>sum+Math.max(0,Number(item.amount||0)),0);}

export default function TeacherDashboardV30(){
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
  const classRows=useMemo(()=>classes.map(className=>{const rows=studentRows.filter(student=>student.class===className);const graded=rows.filter(student=>student.hasGrade);const average=graded.length?Math.round(graded.reduce((sum,item)=>sum+item.score,0)/graded.length):0;const completion=graded.length?Math.round(graded.reduce((sum,item)=>sum+item.completion,0)/graded.length):0;const deduction=rows.reduce((sum,item)=>sum+item.deduction,0);const record=todayRecords.find(item=>item.class===className);const statuses=Object.values(record?.records||{});return{className,students:rows.length,average,completion,deduction,scheduled:lessons.some(lesson=>lesson.className===className),done:completedClasses.has(className),absent:statuses.filter(s=>s==="absent").length,late:statuses.filter(s=>s==="late").length,escaped:statuses.filter(s=>s==="escaped").length};}),[classes,studentRows,lessons,todayRecords,completedClasses]);
  const overall=useMemo(()=>{const graded=studentRows.filter(item=>item.hasGrade);return graded.length?Math.round(graded.reduce((sum,item)=>sum+item.score,0)/graded.length):0;},[studentRows]);
  const support=studentRows.filter(item=>item.hasGrade&&item.score<60).length;
  const recorded=studentRows.filter(item=>item.hasGrade).length;
  const uncompletedLessons=lessons.filter(item=>!completedClasses.has(item.className)).length;
  const attentionText=support?`${support} طالب يحتاجون دعمًا في التحصيل`:attendanceSummary.absent?`${attendanceSummary.absent} حالة غياب تحتاج مراجعة`:uncompletedLessons?`${uncompletedLessons} حصة اليوم لم يكتمل تحضيرها بعد`:"المتابعة اليومية مستقرة ولا توجد أولوية عاجلة";

  return <main className="teacher-dashboard-v30" dir="rtl">
    {message?<p className="td30-message">{message}</p>:null}
    <section className="td30-titleline"><div><span>مساحة المعلم</span><h1>لوحة المتابعة التعليمية</h1><p>{now?dateLabel(now):"اليوم الدراسي"} • {session.subject||"المادة"} • {session.activeGradeLabel||"المرحلة الثانوية"}</p></div><Link href="/teacher/ai">المساعد الذكي</Link></section>

    <section className="td30-priority"><span>الأولوية الآن</span><strong>{attentionText}</strong><small>تتغير تلقائيًا حسب بيانات اليوم والتحصيل.</small></section>

    <section className="td30-statusbar" aria-label="مؤشرات اليوم">
      <article data-tone="green"><small>حضور</small><b>{attendanceSummary.present}</b></article>
      <article data-tone="red"><small>غياب</small><b>{attendanceSummary.absent}</b></article>
      <article data-tone="amber"><small>تأخير</small><b>{attendanceSummary.late}</b></article>
      <article data-tone="violet"><small>هروب</small><b>{attendanceSummary.escaped}</b></article>
      <article data-tone="blue"><small>استئذان</small><b>{attendanceSummary.excused}</b></article>
      <article data-tone="navy"><small>متوسط التحصيل</small><b>{recorded?`${overall}%`:"—"}</b></article>
    </section>

    <section className="td30-main-grid">
      <article className="td30-card td30-today"><header><div><span>01</span><div><small>مهام اليوم</small><h2>جدول المتابعة</h2></div></div><Link href="/teacher/timetable">الجدول الكامل</Link></header><div className="td30-today-list">{lessons.length?lessons.map(lesson=>{const row=classRows.find(item=>item.className===lesson.className);return <Link href="/teacher/attendance" key={`${lesson.period}-${lesson.className}`} className={row?.done?"done":""}><b>{lesson.period}</b><div><strong>{lesson.className}</strong><small>{lesson.notes||session.subject||"حصة دراسية"}</small></div><div className="td30-lesson-state"><span>{row?.done?"تم التحضير":"بانتظار التحضير"}</span>{row?.done?<small>{row.absent?`غياب ${row.absent}`:"لا غياب"}{row.late?` • تأخير ${row.late}`:""}</small>:null}</div></Link>}):<div className="td30-empty">لا توجد حصص مسجلة لهذا اليوم.</div>}</div></article>

      <article className="td30-card td30-classes"><header><div><span>02</span><div><small>قوائم الطلاب</small><h2>الفصول</h2></div></div><Link href="/teacher/students">إدارة القوائم</Link></header><div className="td30-class-grid">{classRows.length?classRows.map(item=><Link href="/teacher/students" key={item.className}><strong>{item.className}</strong><b>{item.students}</b><small>طالب</small><span>{item.scheduled?"ضمن جدول اليوم":"فصل مسند"}</span></Link>):<div className="td30-empty">لا توجد فصول مرتبطة بالمادة.</div>}</div></article>
    </section>

    <section className="td30-card td30-achievement"><header><div><span>03</span><div><small>التحصيل العلمي</small><h2>صورة الفصول الأكاديمية</h2><p>قراءة سريعة للفصل بدل جدول أرقام مزدحم.</p></div></div><Link href="/teacher/grades">فتح سجل الدرجات</Link></header><div className="td30-achievement-grid">{classRows.length?classRows.map(item=>{const state=item.average>=90?"excellent":item.average>=70?"good":item.average?"support":"empty";return <Link href="/teacher/grades" key={item.className} data-state={state}><div className="td30-class-head"><strong>{item.className}</strong><span>{item.students} طالب</span></div><div className="td30-score"><b>{item.average?`${item.average}%`:"—"}</b><small>متوسط التحصيل</small><i><u style={{width:`${item.average}%`}}/></i></div><div className="td30-mini"><span><b>{item.completion?`${item.completion}%`:"—"}</b><small>اكتمال الرصد</small></span><span><b>{item.deduction?`−${item.deduction}`:"0"}</b><small>الخصومات</small></span></div><div className="td30-state">{state==="excellent"?"متميز":state==="good"?"مستقر":state==="support"?"يحتاج متابعة":"بانتظار الرصد"}</div></Link>}):<div className="td30-empty">يظهر التحصيل هنا بعد ربط الفصول وخطة الدرجات.</div>}</div></section>

    <section className="td30-tools"><Link href="/teacher/attendance"><span>الحضور والانضباط</span><small>تحضير، غياب، تأخير، هروب واستئذان</small></Link><Link href="/teacher/follow-up"><span>المتابعة التعليمية</span><small>إتقان، دعم، إثراء وخطط علاجية</small></Link><Link href="/teacher/reports"><span>التقارير</span><small>تقارير وملفات جاهزة للطباعة</small></Link><Link href="/teacher/grade-plan"><span>خطة الدرجات</span><small>توزيع الرصد وضبط بنود المادة</small></Link></section>
  </main>;
}
