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

export default function TeacherDashboardV29(){
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
    const subjectId=baseSubject(session.subjectKey);
    const controller=new AbortController();
    const params=new URLSearchParams({subjectId});if(session.activeGrade)params.set("grade",String(session.activeGrade));
    Promise.all([
      fetch(`/api/teacher/students?${params}`,{cache:"no-store",signal:controller.signal}).then(async response=>{const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||"تعذر تحميل الطلاب");return data;}),
      fetch(`/api/teacher/grade-data?subjectId=${encodeURIComponent(subjectId)}`,{cache:"no-store",signal:controller.signal}).then(async response=>{const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||"تعذر تحميل التحصيل");return data;}),
      fetch(`/api/teacher/timetable?subjectId=${encodeURIComponent(subjectId)}`,{cache:"no-store",signal:controller.signal}).then(async response=>response.ok?response.json():({})),
    ]).then(([data,academicData,timetableData])=>{
      const byCode=academicData.byCode&&typeof academicData.byCode==="object"?academicData.byCode as Record<string,Record<string,unknown>>:{};
      const list=(Array.isArray(data.students)?data.students:[]).map((raw:Record<string,unknown>)=>{
        const code=String(raw.code||raw.id||"").trim().toUpperCase();const className=String(raw.className||raw.class||"").trim();const academic=byCode[code]||{};
        return{...(raw as unknown as Student),id:code,code,name:String(raw.name||"").trim(),class:className,className,gradeValues:academic.gradeValues&&typeof academic.gradeValues==="object"?academic.gradeValues as GradeValueMap:raw.gradeValues as GradeValueMap,gradePlanValues:academic.gradePlanValues&&typeof academic.gradePlanValues==="object"?academic.gradePlanValues as Record<string,GradeValueMap>:raw.gradePlanValues as Record<string,GradeValueMap>,gradeDeductions:Array.isArray(academic.gradeDeductions)?academic.gradeDeductions as GradeDeduction[]:Array.isArray(raw.gradeDeductions)?raw.gradeDeductions as GradeDeduction[]:[]} as Student;
      }).filter((student:Student)=>student.id&&student.name&&student.class);
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
  const attendanceByClass=useMemo(()=>{const map:Record<string,{present:number;absent:number;late:number;escaped:number;excused:number;total:number}>={};todayRecords.forEach(item=>{const key=String(item.class||"");if(!key)return;const row={present:0,absent:0,late:0,escaped:0,excused:0,total:0};Object.values(item.records||{}).forEach(status=>{if(status in row){row[status as keyof typeof row]+=1;row.total+=1;}});map[key]=row;});return map;},[todayRecords]);

  const studentRows=useMemo<StudentRow[]>(()=>students.map(student=>{const result=activePlan?calculateGradePlanResult(activePlan,student):null;const deduction=result&&activePlan?deductionTotal(student,activePlan.id):0;const score=result?Math.max(0,Math.round(result.earned-deduction)):0;return{...student,score,completion:Math.round(result?.completion||0),hasGrade:Boolean(result&&result.recordedMaximum>0),deduction};}),[students,activePlan]);
  const classRows=useMemo(()=>classes.map(className=>{const rows=studentRows.filter(student=>student.class===className);const graded=rows.filter(student=>student.hasGrade);const average=graded.length?Math.round(graded.reduce((sum,item)=>sum+item.score,0)/graded.length):0;const completion=graded.length?Math.round(graded.reduce((sum,item)=>sum+item.completion,0)/graded.length):0;const deduction=rows.reduce((sum,item)=>sum+item.deduction,0);const todayInfo=attendanceByClass[className];return{className,students:rows.length,average,completion,deduction,scheduled:lessons.some(lesson=>lesson.className===className),attendanceDone:Boolean(todayInfo?.total),absent:todayInfo?.absent||0,late:todayInfo?.late||0,escaped:todayInfo?.escaped||0};}),[classes,studentRows,lessons,attendanceByClass]);

  const graded=studentRows.filter(student=>student.hasGrade);
  const overall=graded.length?Math.round(graded.reduce((sum,item)=>sum+item.score,0)/graded.length):0;
  const completion=graded.length?Math.round(graded.reduce((sum,item)=>sum+item.completion,0)/graded.length):0;
  const support=graded.filter(item=>item.score<60).length;
  const nextLesson=lessons.find(lesson=>!attendanceByClass[lesson.className]?.total)||lessons[0];
  const smartText=support?`${support} طالب يحتاجون متابعة أكاديمية. ابدأ بالأقل تحصيلًا ثم راجع اكتمال الرصد.`:attendanceSummary.absent?`لديك ${attendanceSummary.absent} حالة غياب اليوم. راجع الفصول قبل إغلاق المتابعة.`:lessons.length&&!attendanceSummary.total?"ابدأ بالحصة الأولى وسجل المتابعة مباشرة من جدول اليوم.":"الوضع مستقر. راجع التحصيل واكتمال الرصد للفصول الأقل من المتوسط.";

  const stats=[
    {key:"present",label:"حاضر",value:attendanceSummary.present},
    {key:"absent",label:"غائب",value:attendanceSummary.absent},
    {key:"late",label:"متأخر",value:attendanceSummary.late},
    {key:"escaped",label:"هروب",value:attendanceSummary.escaped},
    {key:"excused",label:"استئذان",value:attendanceSummary.excused},
  ];

  return <main className="teacher-dashboard-v29" dir="rtl">
    <section className="td29-commandbar">
      <div><small>{now?dateLabel(now):"اليوم الدراسي"}</small><h1>لوحة المعلم</h1><p>{session.subject||"المادة الحالية"} • {session.activeGradeLabel||"المرحلة الثانوية"}</p></div>
      <div className="td29-command-actions"><span>{now?timeLabel(now):"—"}</span><Link href="/teacher/attendance">فتح المتابعة</Link></div>
    </section>
    {message?<p className="td29-message">{message}</p>:null}

    <section className="td29-summary-line">
      <div className="td29-attendance-strip">{stats.map(item=><span key={item.key} data-state={item.key}><b>{item.value}</b><small>{item.label}</small></span>)}</div>
      <div className="td29-smart-note"><strong>تنبيه ذكي</strong><p>{smartText}</p></div>
    </section>

    <section className="td29-overview">
      <article><small>الحصة التالية</small><b>{nextLesson?.className||"لا توجد"}</b><span>{nextLesson?`الحصة ${nextLesson.period}`:"لا توجد حصة مجدولة"}</span></article>
      <article><small>إجمالي الطلاب</small><b>{students.length}</b><span>{classes.length} فصول مرتبطة</span></article>
      <article><small>متوسط التحصيل</small><b>{graded.length?`${overall}٪`:"—"}</b><span>{support} يحتاجون دعمًا</span></article>
      <article><small>اكتمال الرصد</small><b>{graded.length?`${completion}٪`:"—"}</b><span>{activePlan?"الخطة فعالة":"بانتظار خطة الدرجات"}</span></article>
    </section>

    <section className="td29-workspace-grid">
      <article className="td29-block td29-day">
        <header><div><small>متابعة اليوم</small><h2>الجدول والتحضير</h2></div><Link href="/teacher/timetable">الجدول الكامل</Link></header>
        <div className="td29-day-list">{lessons.length?lessons.map(lesson=>{const info=attendanceByClass[lesson.className];return <Link href="/teacher/attendance" key={`${lesson.period}-${lesson.className}`} className={info?.total?"done":""}><span className="period">{lesson.period}</span><div><b>{lesson.className}</b><small>{lesson.notes||session.subject||"الحصة الدراسية"}</small></div><div className="lesson-state">{info?.total?<><strong>تم</strong><small>{info.absent} غياب • {info.late} تأخير</small></>:<><strong>لم يسجل</strong><small>فتح التحضير</small></>}</div></Link>}):<div className="td29-empty"><b>لا توجد حصص لليوم</b><span>أضف جدولك وسيظهر هنا تلقائيًا.</span></div>}</div>
      </article>

      <article className="td29-block td29-class-list">
        <header><div><small>قوائم الطلاب</small><h2>الفصول</h2></div><Link href="/teacher/students">إدارة الطلاب</Link></header>
        <div>{classRows.length?classRows.map(item=><Link href="/teacher/students" key={item.className}><span className="class-pill">{item.className}</span><div><b>{item.students} طالب</b><small>{item.scheduled?"ضمن جدول اليوم":"فصل مسند"}</small></div><em>{item.attendanceDone?"متابعة مكتملة":"عرض"}</em></Link>):<div className="td29-empty"><b>لا توجد فصول مرتبطة</b><span>أضف الفصول من إدارة الطلاب.</span></div>}</div>
      </article>
    </section>

    <section className="td29-block td29-achievement">
      <header><div><small>التحصيل العلمي</small><h2>قراءة سريعة للفصول</h2><p>بدون جدول مزدحم؛ كل فصل يظهر حالته ومتوسطه واكتمال الرصد بوضوح.</p></div><Link href="/teacher/grades">فتح سجل الدرجات</Link></header>
      <div className="td29-achievement-list">{classRows.length?classRows.map(item=>{const state=item.average>=90?"excellent":item.average>=60?"stable":item.average?"support":"empty";return <Link href="/teacher/grades" key={item.className} className="td29-achievement-row" data-state={state}><div className="td29-class-title"><span>{item.className}</span><small>{item.students} طالب</small></div><div className="td29-score"><b>{item.average?`${item.average}٪`:"—"}</b><i><u style={{width:`${Math.min(100,item.average)}%`}}/></i><small>متوسط التحصيل</small></div><div className="td29-completion"><b>{item.completion?`${item.completion}٪`:"—"}</b><span>اكتمال الرصد</span></div><div className="td29-deduction"><b>{item.deduction?`−${item.deduction}`:"0"}</b><span>خصومات</span></div><div className="td29-status"><b>{state==="excellent"?"متميز":state==="stable"?"مستقر":state==="support"?"يحتاج متابعة":"بانتظار الرصد"}</b><small>{item.absent||item.late||item.escaped?`${item.absent} غياب • ${item.late} تأخير • ${item.escaped} هروب`:"لا ملاحظات يومية"}</small></div></Link>}):<div className="td29-empty"><b>لا توجد بيانات تحصيل بعد</b><span>عند رصد الدرجات ستظهر قراءة الفصول هنا.</span></div>}</div>
    </section>
  </main>;
}
