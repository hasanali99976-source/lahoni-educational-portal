"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTeacherClient } from "../../../lib/teacher-client";
import "./discipline-safe.css";

type AttendanceStatus="present"|"absent"|"late"|"excused"|"escaped";
type AttendanceRecord={class?:string;date?:string;records?:Record<string,AttendanceStatus>};
type Student={id?:string;code?:string;name?:string;class?:string;className?:string};
type Lesson={className?:string;subject?:string};
type ReportType="all"|"absent"|"late"|"escaped"|"excused";
type Scope="class"|"all"|"student"|"highRisk";
type MetricKey="absent"|"late"|"escaped"|"excused";
type Row={code:string;name:string;className:string;absent:number;late:number;escaped:number;excused:number;total:number;scheduledLessons:number;absenceRate:number;nonAttendanceRate:number};

const reportLabels:Record<ReportType,string>={all:"تقرير الانضباط الشامل",absent:"تقرير الغياب",late:"تقرير التأخير",escaped:"تقرير الهروب",excused:"تقرير الاستئذان"};
const metricLabels:Record<MetricKey,string>={absent:"الغياب",late:"التأخير",escaped:"الهروب",excused:"الاستئذان"};
const statusField:Record<Exclude<ReportType,"all">,MetricKey>={absent:"absent",late:"late",escaped:"escaped",excused:"excused"};
const dayIndex:Record<string,number>={sunday:0,monday:1,tuesday:2,wednesday:3,thursday:4};
const ar=(n:number)=>new Intl.NumberFormat("ar-SA-u-nu-arab",{maximumFractionDigits:1}).format(Number.isFinite(n)?n:0);
const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Riyadh",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const asDate=(value:string)=>new Date(`${value}T12:00:00Z`);
const prettyDate=(value:string)=>value?new Intl.DateTimeFormat("ar-SA",{year:"numeric",month:"long",day:"numeric"}).format(asDate(value)):"—";

export default function DisciplinePage(){
  const session=useTeacherClient();
  const [students,setStudents]=useState<Student[]>([]);
  const [attendance,setAttendance]=useState<AttendanceRecord[]>([]);
  const [timetable,setTimetable]=useState<Record<string,Lesson>>({});
  const [selectedClass,setSelectedClass]=useState("");
  const [query,setQuery]=useState("");
  const [reportType,setReportType]=useState<ReportType>("all");
  const [scope,setScope]=useState<Scope>("class");
  const [selectedStudent,setSelectedStudent]=useState("");
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState("");
  const [printMode,setPrintMode]=useState<"report"|"classPages">("report");

  const loadData=useCallback(async()=>{
    if(!session.teacherId||!session.subjectKey)return;
    const subjectId=String(session.subjectKey).split("--")[0];
    const params=new URLSearchParams({subjectId});
    if(session.activeGrade)params.set("grade",String(session.activeGrade));
    setLoading(true);setMessage("");
    const controller=new AbortController();
    try{
      const [studentsResponse,timetableResponse,disciplineResponse]=await Promise.all([
        fetch(`/api/teacher/students?${params}`,{cache:"no-store",credentials:"same-origin",signal:controller.signal}),
        fetch(`/api/teacher/timetable?subjectId=${encodeURIComponent(subjectId)}`,{cache:"no-store",credentials:"same-origin",signal:controller.signal}),
        fetch(`/api/teacher/discipline?subjectId=${encodeURIComponent(subjectId)}`,{cache:"no-store",credentials:"same-origin",signal:controller.signal}),
      ]);
      const [studentsData,timetableData,disciplineData]=await Promise.all([
        studentsResponse.json().catch(()=>({})),timetableResponse.json().catch(()=>({})),disciplineResponse.json().catch(()=>({})),
      ]);
      setStudents(studentsResponse.ok&&Array.isArray(studentsData.students)?studentsData.students:[]);
      setTimetable(timetableResponse.ok&&timetableData.lessons&&typeof timetableData.lessons==="object"?timetableData.lessons:{});
      setAttendance(disciplineResponse.ok&&Array.isArray(disciplineData.attendance)?disciplineData.attendance:[]);
      if(!disciplineResponse.ok)setMessage(disciplineData.message||"تعذر تحديث سجل الانضباط الآن.");
    }catch{setMessage("تعذر تحديث سجل الانضباط الآن.");}
    finally{setLoading(false);}
    return()=>controller.abort();
  },[session.teacherId,session.subjectKey,session.activeGrade]);

  useEffect(()=>{void loadData();},[loadData]);

  const classes=useMemo(()=>[...new Set(students.map(s=>String(s.className||s.class||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ar",{numeric:true})),[students]);
  useEffect(()=>{if(classes.length&&(!selectedClass||!classes.includes(selectedClass)))setSelectedClass(classes[0]);},[classes,selectedClass]);

  const firstRecordedDate=useMemo(()=>attendance.map(r=>String(r.date||"")).filter(Boolean).sort()[0]||"2026-08-23",[attendance]);
  const reportEnd=today();
  const periodsByClass=useMemo(()=>{
    const map=new Map<string,Map<number,number>>();
    Object.entries(timetable).forEach(([cell,lesson])=>{
      const match=cell.match(/^(sunday|monday|tuesday|wednesday|thursday)-([1-7])$/);
      const className=String(lesson?.className||"").trim();
      if(!match||!className)return;
      const weekday=dayIndex[match[1]];
      const perDay=map.get(className)||new Map<number,number>();
      perDay.set(weekday,(perDay.get(weekday)||0)+1);map.set(className,perDay);
    });return map;
  },[timetable]);
  const scheduledLessons=(className:string)=>{const schedule=periodsByClass.get(className);if(!schedule||firstRecordedDate>reportEnd)return 0;let total=0;const cursor=asDate(firstRecordedDate);const end=asDate(reportEnd);while(cursor<=end){total+=schedule.get(cursor.getUTCDay())||0;cursor.setUTCDate(cursor.getUTCDate()+1);}return total;};

  const rows=useMemo<Row[]>(()=>students.map(student=>{
    const code=String(student.code||student.id||"").trim().toUpperCase();
    const name=String(student.name||"").trim();
    const className=String(student.className||student.class||"").trim();
    let absent=0,late=0,escaped=0,excused=0;
    attendance.forEach(record=>{if(record.class&&record.class!==className)return;const status=record.records?.[code];if(status==="absent")absent++;if(status==="late")late++;if(status==="escaped")escaped++;if(status==="excused")excused++;});
    const lessons=scheduledLessons(className);const total=absent+late+escaped+excused;const absenceRate=lessons?Math.min(100,Math.round(absent/lessons*1000)/10):0;const nonAttendanceRate=lessons?Math.min(100,Math.round(total/lessons*1000)/10):0;
    return{code,name,className,absent,late,escaped,excused,total,scheduledLessons:lessons,absenceRate,nonAttendanceRate};
  }).filter(r=>r.code&&r.name),[students,attendance,firstRecordedDate,reportEnd,periodsByClass]);

  const scoped=useMemo(()=>rows.filter(r=>scope==="all"||scope==="class"&&r.className===selectedClass||scope==="student"&&r.code===selectedStudent||scope==="highRisk"&&r.nonAttendanceRate>=40),[rows,scope,selectedClass,selectedStudent]);
  const visible=useMemo(()=>scoped.filter(r=>(!query.trim()||r.name.includes(query.trim())||r.code.includes(query.trim().toUpperCase()))&&(reportType==="all"||r[statusField[reportType]]>0)).sort((a,b)=>{const av=reportType==="all"?a.total:a[statusField[reportType]];const bv=reportType==="all"?b.total:b[statusField[reportType]];return bv-av||a.name.localeCompare(b.name,"ar");}),[scoped,query,reportType]);
  const totals=visible.reduce((s,r)=>({absent:s.absent+r.absent,late:s.late+r.late,escaped:s.escaped+r.escaped,excused:s.excused+r.excused,total:s.total+r.total}),{absent:0,late:0,escaped:0,excused:0,total:0});
  const affected=visible.filter(r=>r.total>0).length;const over40=visible.filter(r=>r.nonAttendanceRate>=40).length;const repeated=visible.filter(r=>r.total>=2).length;const urgent=visible.filter(r=>r.escaped>0||r.absent>=3||r.late>=3).length;const avgAbsence=visible.length?visible.reduce((s,r)=>s+r.absenceRate,0)/visible.length:0;
  const metricStats=(Object.keys(metricLabels) as MetricKey[]).map(key=>{const ranked=[...visible].filter(r=>r[key]>0).sort((a,b)=>b[key]-a[key]);return{key,label:metricLabels[key],count:totals[key],students:ranked.length,top:ranked[0]||null};});
  const scopeLabel=scope==="all"?"جميع الفصول":scope==="highRisk"?"عدم الالتزام ٤٠٪ فأكثر":scope==="student"?(rows.find(r=>r.code===selectedStudent)?.name||"طالب محدد"):(selectedClass||"فصل محدد");
  const table=<table className="discipline-report-table"><thead><tr><th>#</th><th>الطالب</th><th>الفصل</th><th>الحصص</th><th>الغياب</th><th>التأخير</th><th>الهروب</th><th>الاستئذان</th><th>نسبة الغياب</th><th>عدم الالتزام</th><th>الحالة</th></tr></thead><tbody>{visible.map((r,i)=><tr key={r.code}><td>{ar(i+1)}</td><td><b>{r.name}</b><small>{r.code}</small></td><td>{r.className}</td><td>{ar(r.scheduledLessons)}</td><td className="abs">{ar(r.absent)}</td><td className="late">{ar(r.late)}</td><td className="esc">{ar(r.escaped)}</td><td className="exc">{ar(r.excused)}</td><td>{r.scheduledLessons?`${ar(r.absenceRate)}٪`:"—"}</td><td className={r.nonAttendanceRate>=40?"nonatt-high":"nonatt"}>{r.scheduledLessons?`${ar(r.nonAttendanceRate)}٪`:"—"}</td><td><span className={r.escaped>0||r.absent>=3||r.late>=3?"risk":r.total?"watch":"clear"}>{r.escaped>0||r.absent>=3||r.late>=3?"يحتاج متابعة":r.total?"ملاحظة":"منتظم"}</span></td></tr>)}</tbody></table>;

  return <main className="discipline-safe" dir="rtl"><div className="screen">
    <section className="hero"><div><small>لوحة الانضباط الذكية</small><h1>الانضباط الطلابي</h1><p>نفس بياناتك المحفوظة، بقراءة واحدة آمنة بدل المراقبة المستمرة لقاعدة البيانات.</p></div><div className="hero-actions"><button onClick={()=>void loadData()} disabled={loading}>{loading?"جارٍ التحديث…":"تحديث البيانات"}</button><Link href="/teacher/attendance">الحضور اليومي ←</Link></div></section>
    {message?<p className="message">{message}</p>:null}
    <section className="controls"><label><span>نوع التقرير</span><select value={reportType} onChange={e=>setReportType(e.target.value as ReportType)}><option value="all">شامل</option><option value="absent">الغياب</option><option value="late">التأخير</option><option value="escaped">الهروب</option><option value="excused">الاستئذان</option></select></label><label><span>النطاق</span><select value={scope} onChange={e=>setScope(e.target.value as Scope)}><option value="class">فصل محدد</option><option value="all">جميع الفصول</option><option value="highRisk">الأعلى في عدم الالتزام (٤٠٪ فأكثر)</option><option value="student">طالب محدد</option></select></label>{scope==="class"?<label><span>الفصل</span><select value={selectedClass} onChange={e=>setSelectedClass(e.target.value)}>{classes.map(c=><option key={c}>{c}</option>)}</select></label>:null}{scope==="student"?<label><span>الطالب</span><select value={selectedStudent} onChange={e=>setSelectedStudent(e.target.value)}><option value="">اختر الطالب</option>{rows.map(r=><option key={r.code} value={r.code}>{r.name} — {r.className}</option>)}</select></label>:null}<label><span>بحث</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="اسم الطالب أو الكود"/></label><button onClick={()=>{setPrintMode(scope==="all"?"classPages":"report");setTimeout(()=>window.print(),60)}}>🖨 طباعة التقرير</button></section>
    <section className="metrics">{metricStats.map(stat=><article key={stat.key}><div><span>{stat.label}</span><b>{ar(stat.count)}</b></div><p>{ar(stat.students)} طالب لديهم حالة</p><small>{stat.top?`الأكثر: ${stat.top.name} (${ar(stat.top[stat.key])})`:"لا توجد حالات"}</small></article>)}<article><div><span>طلاب متأثرون</span><b>{ar(affected)}</b></div><p>من {ar(visible.length)} طالب</p><small>أي طالب لديه حالة واحدة فأكثر</small></article><article><div><span>حالات متكررة</span><b>{ar(repeated)}</b></div><p>مرتان فأكثر</p><small>للمتابعة الوقائية</small></article><article><div><span>تحتاج متابعة</span><b>{ar(urgent)}</b></div><p>هروب أو تكرار غياب/تأخير</p><small>أولوية للمعلم والمرشد</small></article><article><div><span>فوق ٤٠٪ عدم التزام</span><b>{ar(over40)}</b></div><p>من إجمالي حصص المادة</p><small>يشمل الغياب والتأخير والهروب والاستئذان</small></article><article><div><span>متوسط الغياب</span><b>{ar(avgAbsence)}٪</b></div><p>حسب عدد حصص المادة</p><small>وليس حسب أيام الدوام</small></article></section>
    <section className="rankings">{metricStats.map(stat=>{const ranked=[...visible].filter(r=>r[stat.key]>0).sort((a,b)=>b[stat.key]-a[stat.key]).slice(0,5);return <article key={stat.key}><h3>أعلى الطلاب — {stat.label}</h3>{ranked.length?ranked.map((r,i)=><div className="rank-row" key={r.code}><b>{i+1}</b><span>{r.name}<small>{r.className}</small></span><strong>{ar(r[stat.key])}</strong></div>):<p>لا توجد حالات.</p>}</article>;})}</section>
    <section className="table-card"><header><div><small>السجل التفصيلي</small><h2>{reportLabels[reportType]}</h2></div><span>{ar(visible.length)} طالب</span></header><div className="table-wrap">{table}</div></section>
  </div><section className={`discipline-print ${printMode==="classPages"?"print-all-classes":"print-single-report"}`}>
      <div className="print-cover-head">
        <div className="print-brand"><img src="/icons/ostadh-lahooni-192.jpg" alt="شعار البوابة"/><div><small>بوابة أستاذ لحوني التعليمية</small><strong>ملف الانضباط الطلابي</strong></div></div>
        <div className="print-report-title"><span>تقرير رسمي</span><h1>{reportLabels[reportType]}</h1><p>{scopeLabel}</p></div>
        <div className="print-meta"><span>المعلم</span><b>{session.teacherName||"—"}</b><span>المادة</span><b>{session.subject||"—"}</b><span>الفترة</span><b>{prettyDate(firstRecordedDate)} — {prettyDate(reportEnd)}</b></div>
      </div>
      <div className="print-summary">
        <span>إجمالي الطلاب<b>{ar(visible.length)}</b></span><span className="sum-risk">عدم الالتزام ٤٠٪ فأكثر<b>{ar(over40)}</b></span><span className="sum-abs">الغياب<b>{ar(totals.absent)}</b></span><span className="sum-late">التأخير<b>{ar(totals.late)}</b></span><span className="sum-esc">الهروب<b>{ar(totals.escaped)}</b></span><span className="sum-exc">الاستئذان<b>{ar(totals.excused)}</b></span>
      </div>
      <div className="print-legend"><span className="lg-abs">غياب</span><span className="lg-late">تأخير</span><span className="lg-esc">هروب</span><span className="lg-exc">استئذان</span><span className="lg-risk">عدم التزام ٤٠٪ فأكثر</span></div>
      {printMode==="classPages"?classes.map(c=><section className="print-class-page" key={c}><div className="print-section-title"><div><small>تقرير الفصل</small><h2>{c}</h2></div><span>{ar(visible.filter(r=>r.className===c).length)} طالب</span></div><table className="discipline-report-table"><thead><tr><th>#</th><th>الطالب</th><th>الحصص</th><th>الغياب</th><th>التأخير</th><th>الهروب</th><th>الاستئذان</th><th>عدم الالتزام</th><th>الحالة</th></tr></thead><tbody>{visible.filter(r=>r.className===c).map((r,i)=><tr key={r.code}><td>{ar(i+1)}</td><td><b>{r.name}</b><small>{r.code}</small></td><td>{ar(r.scheduledLessons)}</td><td className="abs">{ar(r.absent)}</td><td className="late">{ar(r.late)}</td><td className="esc">{ar(r.escaped)}</td><td className="exc">{ar(r.excused)}</td><td className={r.nonAttendanceRate>=40?"nonatt-high":"nonatt"}>{r.scheduledLessons?`${ar(r.nonAttendanceRate)}٪`:"—"}</td><td><span className={r.nonAttendanceRate>=40?"risk":r.total?"watch":"clear"}>{r.nonAttendanceRate>=40?"يحتاج متابعة":r.total?"ملاحظة":"منتظم"}</span></td></tr>)}</tbody></table></section>):<section className="print-class-page print-current-report"><div className="print-section-title"><div><small>تفاصيل التقرير</small><h2>{scopeLabel}</h2></div><span>{ar(visible.length)} طالب</span></div>{table}</section>}
      <div className="print-signatures"><span>معلم المادة<br/><b>{session.teacherName||"—"}</b><small>{session.subject||"—"}</small></span><span>اعتماد التقرير<br/><b>التوقيع: ........................</b></span><span>تاريخ التقرير<br/><b>{prettyDate(reportEnd)}</b></span></div>
      <footer><span>بوابة أستاذ لحوني التعليمية</span><b>تقرير الانضباط الطلابي</b><span>صفحة مخصصة للطباعة</span></footer>
    </section></main>;
}
