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

  const studentRows=useMemo<StudentRow[]>(()=>students.map(student=>{const result=activePlan?calculateGradePlanResult(activePlan,student):null;const deduction=result&&activePlan?deductionTotal(student,activePlan.id):0;const score=result?Math.max(0,Math.round(result.earned-deduction)):0;return{...student,score,completion:Math.round(result?.completion||0),hasGrade:Boolean(result&&result.recordedMaximum>0),deduction};}),[students,activePlan]);
  const classRows=useMemo(()=>classes.map(className=>{const rows=studentRows.filter(student=>student.class===className);const graded=rows.filter(student=>student.hasGrade);const average=graded.length?Math.round(graded.reduce((sum,item)=>sum+item.score,0)/graded.length):0;const completion=graded.length?Math.round(graded.reduce((sum,item)=>sum+item.completion,0)/graded.length):0;const deduction=rows.reduce((sum,item)=>sum+item.deduction,0);return{className,students:rows.length,average,completion,deduction,scheduled:lessons.some(lesson=>lesson.className===className)};}),[classes,studentRows,lessons]);

  const stats=[
    {key:"present",label:"الحضور",value:attendanceSummary.present},
    {key:"absent",label:"الغياب",value:attendanceSummary.absent},
    {key:"late",label:"التأخير",value:attendanceSummary.late},
    {key:"escaped",label:"الهروب",value:attendanceSummary.escaped},
    {key:"excused",label:"الاستئذان",value:attendanceSummary.excused},
  ];

  return <main className="teacher-dashboard-v29" dir="rtl">
    <header className="td29-page-head">
      <div><small>{now?dateLabel(now):"المتابعة اليومية"}</small><h1>متابعة اليوم</h1><p>{session.subject||"المادة الحالية"} • {session.activeGradeLabel||"المرحلة الثانوية"}</p></div>
      <div className="td29-clock"><span>{now?timeLabel(now):"—"}</span><small>آخر تحديث تلقائي</small></div>
    </header>
    {message?<p className="td29-message">{message}</p>:null}

    <section className="td29-stats" aria-label="ملخص حضور اليوم">
      {stats.map(item=><article key={item.key} data-state={item.key}><span>{item.label}</span><b>{item.value}</b><small>طالب</small></article>)}
    </section>

    <section className="td29-top-grid">
      <article className="td29-panel td29-today">
        <header><div><small>جدول اليوم</small><h2>الحصص المجدولة</h2></div><Link href="/teacher/timetable">عرض الجدول كاملًا</Link></header>
        <div className="td29-lessons">{lessons.length?lessons.map(lesson=><Link href="/teacher/attendance" key={`${lesson.period}-${lesson.className}`}><span>{lesson.period}</span><div><b>{lesson.className}</b><small>{lesson.notes||session.subject||"الحصة الدراسية"}</small></div><em>فتح المتابعة</em></Link>):<div className="td29-empty"><b>لا توجد حصص مسجلة اليوم</b><span>يمكنك إضافة الجدول من صفحة الجدول الدراسي.</span></div>}</div>
      </article>

      <article className="td29-panel td29-classes">
        <header><div><small>قوائم الطلاب</small><h2>الفصول المرتبطة</h2></div><Link href="/teacher/students">إدارة القوائم</Link></header>
        <div>{classRows.length?classRows.map(item=><Link href="/teacher/students" key={item.className}><span className={item.scheduled?"today":""}>{item.className}</span><div><b>{item.students} طالب</b><small>{item.scheduled?"ضمن جدول اليوم":"فصل مسند"}</small></div><em>عرض القائمة</em></Link>):<div className="td29-empty"><b>لا توجد فصول مرتبطة</b><span>أضف فصولك من إدارة الطلاب.</span></div>}</div>
      </article>
    </section>

    <section className="td29-panel td29-achievement">
      <header><div><small>التحصيل العلمي</small><h2>ملخص الفصول</h2><p>المتوسط بعد الخصومات المسجلة في خطة المادة.</p></div><Link href="/teacher/grades">فتح سجل التحصيل</Link></header>
      <div className="td29-table-wrap"><table><thead><tr><th>الفصل</th><th>الطلاب</th><th>متوسط التحصيل</th><th>اكتمال الرصد</th><th>الخصومات</th><th>الحالة</th></tr></thead><tbody>{classRows.map(item=><tr key={item.className}><td><b>{item.className}</b></td><td>{item.students}</td><td><strong>{item.average?`${item.average} / 100`:"—"}</strong></td><td>{item.completion?`${item.completion}٪`:"—"}</td><td>{item.deduction?`−${item.deduction}`:"—"}</td><td><span className={item.average>=90?"excellent":item.average>=60?"stable":item.average?"support":"empty"}>{item.average>=90?"متميز":item.average>=60?"مستقر":item.average?"يحتاج متابعة":"بانتظار الرصد"}</span></td></tr>)}</tbody></table></div>
    </section>
  </main>;
}
