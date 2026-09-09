"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { tenantCollection } from "../../../lib/teacher-tenant";
import { useTeacherClient } from "../../../lib/teacher-client";

type AttendanceStatus="present"|"absent"|"late"|"excused"|"escaped";
type AttendanceRecord={class?:string;date?:string;records?:Record<string,AttendanceStatus>};
type Student={id?:string;code?:string;name?:string;class?:string;className?:string};
type Lesson={className?:string;subject?:string};
type ReportType="all"|"absent"|"late"|"escaped"|"excused";
type Scope="class"|"all"|"student";
type Row={code:string;name:string;className:string;absent:number;late:number;escaped:number;excused:number;total:number;scheduledLessons:number;absenceRate:number;disciplineRate:number};

const reportLabels:Record<ReportType,string>={all:"تقرير انضباط شامل",absent:"تقرير الغياب",late:"تقرير التأخير",escaped:"تقرير الهروب",excused:"تقرير الاستئذان"};
const statusField:Record<Exclude<ReportType,"all">,keyof Pick<Row,"absent"|"late"|"escaped"|"excused">>={absent:"absent",late:"late",escaped:"escaped",excused:"excused"};
const dayIndex:Record<string,number>={sunday:0,monday:1,tuesday:2,wednesday:3,thursday:4};
const ar=(n:number)=>new Intl.NumberFormat("ar-SA-u-nu-arab",{maximumFractionDigits:1}).format(Number.isFinite(n)?n:0);
const todayRiyadh=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Riyadh",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const dayDate=(value:string)=>new Date(`${value}T12:00:00Z`);

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
  const [fromDate,setFromDate]=useState("2026-08-23");
  const [toDate,setToDate]=useState(todayRiyadh());

  useEffect(()=>{
    if(!session.teacherId||!session.subjectKey)return;
    const controller=new AbortController();
    const subjectId=String(session.subjectKey).split("--")[0];
    const params=new URLSearchParams({subjectId});
    if(session.activeGrade)params.set("grade",String(session.activeGrade));
    fetch(`/api/teacher/students?${params}`,{cache:"no-store",signal:controller.signal}).then(async r=>r.ok?r.json():Promise.reject()).then(d=>setStudents(Array.isArray(d.students)?d.students:[])).catch(()=>setStudents([]));
    fetch(`/api/teacher/timetable?subjectId=${encodeURIComponent(subjectId)}`,{cache:"no-store",signal:controller.signal}).then(async r=>r.ok?r.json():Promise.reject()).then(d=>setTimetable(d.lessons&&typeof d.lessons==="object"?d.lessons:{})).catch(()=>setTimetable({}));
    const stop=onSnapshot(collection(db,tenantCollection(session.teacherId,session.subjectKey as never,"attendance")),snap=>setAttendance(snap.docs.map(d=>d.data() as AttendanceRecord)),()=>setAttendance([]));
    return()=>{controller.abort();stop();};
  },[session.teacherId,session.subjectKey,session.activeGrade]);

  const classes=useMemo(()=>[...new Set(students.map(s=>String(s.className||s.class||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ar",{numeric:true})),[students]);
  useEffect(()=>{if(classes.length&&(!selectedClass||!classes.includes(selectedClass)))setSelectedClass(classes[0]);},[classes,selectedClass]);

  const periodsByClass=useMemo(()=>{
    const map=new Map<string,Map<number,number>>();
    Object.entries(timetable).forEach(([cell,lesson])=>{
      const match=cell.match(/^(sunday|monday|tuesday|wednesday|thursday)-([1-7])$/);
      const className=String(lesson?.className||"").trim(); if(!match||!className)return;
      const weekday=dayIndex[match[1]]; const perDay=map.get(className)||new Map<number,number>(); perDay.set(weekday,(perDay.get(weekday)||0)+1); map.set(className,perDay);
    });
    return map;
  },[timetable]);

  function scheduledLessons(className:string){
    const schedule=periodsByClass.get(className); if(!schedule||!fromDate||!toDate||fromDate>toDate)return 0;
    let total=0; const cursor=dayDate(fromDate); const end=dayDate(toDate);
    while(cursor<=end){total+=schedule.get(cursor.getUTCDay())||0;cursor.setUTCDate(cursor.getUTCDate()+1);} return total;
  }

  const rows=useMemo<Row[]>(()=>students.map(student=>{
    const code=String(student.code||student.id||"").trim().toUpperCase(); const name=String(student.name||"").trim(); const className=String(student.className||student.class||"").trim();
    let absent=0,late=0,escaped=0,excused=0;
    attendance.forEach(record=>{const date=String(record.date||"");if(date<fromDate||date>toDate)return;if(record.class&&record.class!==className)return;const status=record.records?.[code];if(status==="absent")absent++;if(status==="late")late++;if(status==="escaped")escaped++;if(status==="excused")excused++;});
    const expected=scheduledLessons(className);const total=absent+late+escaped+excused;const absenceRate=expected?Math.min(100,Math.round(absent/expected*1000)/10):0;const disciplineRate=expected?Math.max(0,Math.round((1-(absent+late*.5+escaped)/expected)*1000)/10):100;
    return{code,name,className,absent,late,escaped,excused,total,scheduledLessons:expected,absenceRate,disciplineRate};
  }).filter(r=>r.code&&r.name),[students,attendance,fromDate,toDate,periodsByClass]);

  const scoped=useMemo(()=>rows.filter(r=>scope==="all"||scope==="class"&&r.className===selectedClass||scope==="student"&&r.code===selectedStudent),[rows,scope,selectedClass,selectedStudent]);
  const visible=useMemo(()=>scoped.filter(r=>(!query.trim()||r.name.includes(query.trim())||r.code.includes(query.trim().toUpperCase()))&&(reportType==="all"||r[statusField[reportType]]>0)).sort((a,b)=>{const av=reportType==="all"?a.total:a[statusField[reportType]];const bv=reportType==="all"?b.total:b[statusField[reportType]];return bv-av||a.name.localeCompare(b.name,"ar");}),[scoped,query,reportType]);
  const totals=visible.reduce((s,r)=>({absent:s.absent+r.absent,late:s.late+r.late,escaped:s.escaped+r.escaped,excused:s.excused+r.excused,total:s.total+r.total,lessons:s.lessons+r.scheduledLessons}),{absent:0,late:0,escaped:0,excused:0,total:0,lessons:0});
  const affected=visible.filter(r=>r.total>0).length;const repeated=visible.filter(r=>r.total>=2).length;const urgent=visible.filter(r=>r.total>=3||r.escaped>0).length;const avgDiscipline=visible.length?visible.reduce((s,r)=>s+r.disciplineRate,0)/visible.length:100;const avgAbsence=visible.length?visible.reduce((s,r)=>s+r.absenceRate,0)/visible.length:0;const top=visible.slice(0,5);
  const scopeLabel=scope==="all"?"جميع الفصول":scope==="student"?(visible[0]?.name||"طالب محدد"):(selectedClass||"فصل محدد");

  return <main className="discipline-v30" dir="rtl">
    <section className="dv30-hero no-print"><div><small>لوحة تحليل الانضباط الذكية</small><h1>الانضباط الطلابي</h1><p>النسب هنا مبنية على عدد حصص المادة المجدولة فعليًا داخل فترة التقرير.</p></div><Link href="/teacher/attendance">الحضور اليومي ←</Link></section>
    <section className="dv30-controls no-print">
      <label><span>نوع التقرير</span><select value={reportType} onChange={e=>setReportType(e.target.value as ReportType)}><option value="all">شامل</option><option value="absent">الغياب</option><option value="late">التأخير</option><option value="escaped">الهروب</option><option value="excused">الاستئذان</option></select></label>
      <label><span>النطاق</span><select value={scope} onChange={e=>setScope(e.target.value as Scope)}><option value="class">فصل محدد</option><option value="all">جميع الفصول</option><option value="student">طالب محدد</option></select></label>
      {scope==="class"?<label><span>الفصل</span><select value={selectedClass} onChange={e=>setSelectedClass(e.target.value)}>{classes.map(c=><option key={c}>{c}</option>)}</select></label>:null}
      {scope==="student"?<label><span>الطالب</span><select value={selectedStudent} onChange={e=>setSelectedStudent(e.target.value)}><option value="">اختر الطالب</option>{rows.map(r=><option key={r.code} value={r.code}>{r.name} — {r.className}</option>)}</select></label>:null}
      <label><span>من</span><input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)}/></label><label><span>إلى</span><input type="date" value={toDate} onChange={e=>setToDate(e.target.value)}/></label>
      <label><span>بحث</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="اسم الطالب أو الكود"/></label><button className="dv30-print" onClick={()=>window.print()}>🖨 طباعة التقرير التحليلي</button>
    </section>
    <section className="dv30-print-head"><small>بوابة أستاذ لحوني التعليمية</small><h1>{reportLabels[reportType]}</h1><p>المعلم: {session.teacherName||"—"} · المادة: {session.subject||"المادة الحالية"} · النطاق: {scopeLabel} · الفترة: {fromDate} — {toDate}</p></section>
    <section className="dv30-kpis"><article className="red"><span>الغياب</span><b>{ar(totals.absent)}</b><small>متوسط النسبة {ar(avgAbsence)}٪</small></article><article className="amber"><span>التأخير</span><b>{ar(totals.late)}</b><small>حالة مسجلة</small></article><article className="purple"><span>الهروب</span><b>{ar(totals.escaped)}</b><small>أولوية متابعة</small></article><article className="blue"><span>الاستئذان</span><b>{ar(totals.excused)}</b><small>حالة مسجلة</small></article><article className="teal"><span>متوسط الانضباط</span><b>{ar(avgDiscipline)}٪</b><small>بحسب الحصص المجدولة</small></article><article className="orange"><span>حالات متكررة</span><b>{ar(repeated)}</b><small>مرتان فأكثر</small></article><article className="dark"><span>تحتاج متابعة</span><b>{ar(urgent)}</b><small>3 حالات أو هروب</small></article><article className="green"><span>الطلاب المتأثرون</span><b>{ar(affected)}</b><small>من {ar(visible.length)} طالب</small></article></section>
    <section className="dv30-analysis"><article><small>قراءة سريعة</small><h2>{totals.total===0?"لا توجد حالات في النطاق المحدد":"يوجد ما يستحق المتابعة"}</h2><p>{totals.total===0?"لم تُسجل حالات وفق خيارات التقرير الحالية.":`تم رصد ${ar(totals.total)} حالة عبر ${ar(totals.lessons)} حصة مجدولة للطلاب الظاهرين، منها ${ar(totals.absent)} غياب و${ar(totals.late)} تأخير و${ar(totals.escaped)} هروب.`}</p></article><article><small>الأكثر حاجة للمتابعة</small><div className="dv30-top">{top.length?top.map((r,i)=><div key={r.code}><b>{i+1}</b><span>{r.name}<small>{r.className}</small></span><strong>{reportType==="all"?r.total:r[statusField[reportType]]}</strong></div>):<p>لا توجد حالات.</p>}</div></article></section>
    <section className="dv30-table-wrap"><header><div><small>تفاصيل التقرير</small><h2>{reportLabels[reportType]}</h2></div><span>{ar(visible.length)} طالب</span></header><table><thead><tr><th>#</th><th>الطالب</th><th>الفصل</th><th>الحصص</th><th className="abs">الغياب</th><th className="late">التأخير</th><th className="esc">الهروب</th><th className="exc">الاستئذان</th><th>نسبة الغياب</th><th>مؤشر الانضباط</th><th>التصنيف</th></tr></thead><tbody>{visible.map((r,i)=><tr key={r.code}><td>{ar(i+1)}</td><td><b>{r.name}</b><small>{r.code}</small></td><td>{r.className}</td><td>{ar(r.scheduledLessons)}</td><td className="abs">{ar(r.absent)}</td><td className="late">{ar(r.late)}</td><td className="esc">{ar(r.escaped)}</td><td className="exc">{ar(r.excused)}</td><td>{r.scheduledLessons?`${ar(r.absenceRate)}٪`:"—"}</td><td><b>{r.scheduledLessons?`${ar(r.disciplineRate)}٪`:"—"}</b></td><td><span className={r.total>=3||r.escaped>0?"risk":r.total?"watch":"clear"}>{r.total>=3||r.escaped>0?"متابعة عاجلة":r.total?"تحت المتابعة":"مستقر"}</span></td></tr>)}</tbody></table></section>
    <style jsx global>{`.discipline-v30{font-family:"Tajawal","Segoe UI",Tahoma,Arial,sans-serif;color:#173640}.dv30-hero{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:28px;border-radius:26px;background:linear-gradient(135deg,#113e52,#087d77);color:#fff;box-shadow:0 18px 45px rgba(17,62,82,.16)}.dv30-hero h1{margin:5px 0;font-size:30px}.dv30-hero p{margin:0;opacity:.82}.dv30-hero a{padding:12px 16px;border-radius:14px;background:#fff;color:#0b665f;font-weight:900;text-decoration:none}.dv30-controls{display:grid;grid-template-columns:repeat(4,minmax(150px,1fr));gap:10px;margin:16px 0;padding:15px;border:1px solid #dce6e8;border-radius:20px;background:#fff}.dv30-controls label{display:grid;gap:5px}.dv30-controls span{font-size:11px;font-weight:800;color:#617981}.dv30-controls select,.dv30-controls input{height:42px;border:1px solid #ccdadd;border-radius:12px;padding:0 10px;background:#fbfdfd}.dv30-print{height:42px;border:0;border-radius:12px;background:#153f52;color:#fff;font-weight:900}.dv30-print-head{display:none}.dv30-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:11px;margin:15px 0}.dv30-kpis article{padding:16px;border-radius:18px;border:1px solid #e0e7e9;background:#fff;position:relative;overflow:hidden}.dv30-kpis article:before{content:"";position:absolute;right:0;inset-block:0;width:5px;background:currentColor}.dv30-kpis span{display:block;font-size:11px;font-weight:800;color:#63777f}.dv30-kpis b{display:block;margin:5px 0;font-size:27px}.dv30-kpis small{font-size:10px;color:#829298}.dv30-kpis .red{color:#c84c58}.dv30-kpis .amber{color:#d48c20}.dv30-kpis .purple{color:#7655b5}.dv30-kpis .blue{color:#357fb0}.dv30-kpis .teal{color:#18877d}.dv30-kpis .orange{color:#c46d28}.dv30-kpis .dark{color:#354d59}.dv30-kpis .green{color:#38825e}.dv30-analysis{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:15px 0}.dv30-analysis>article{padding:18px;border:1px solid #dce6e8;border-radius:20px;background:#fff}.dv30-analysis p{color:#637980;line-height:1.8}.dv30-top{display:grid;gap:7px}.dv30-top>div{display:grid;grid-template-columns:28px 1fr auto;align-items:center;gap:9px;padding:8px;border-radius:11px;background:#f5f8f9}.dv30-top>div>b{width:26px;height:26px;border-radius:8px;background:#173f51;color:#fff;display:grid;place-items:center}.dv30-top span small{display:block;color:#87979d}.dv30-table-wrap{border:1px solid #d9e4e6;border-radius:20px;background:#fff;overflow:auto}.dv30-table-wrap>header{display:flex;justify-content:space-between;align-items:center;padding:16px 18px;border-bottom:1px solid #e4ebed}.dv30-table-wrap table{width:100%;border-collapse:separate;border-spacing:0;min-width:1050px}.dv30-table-wrap th,.dv30-table-wrap td{padding:11px 9px;text-align:center;border-bottom:1px solid #edf1f2}.dv30-table-wrap th{position:sticky;top:0;background:#edf4f5;font-size:11px}.dv30-table-wrap td{font-size:11px}.dv30-table-wrap td:nth-child(2){text-align:right}.dv30-table-wrap td:nth-child(2) small{display:block;color:#91a0a5}.dv30-table-wrap .abs{background:#fff1f2}.dv30-table-wrap .late{background:#fff7e8}.dv30-table-wrap .esc{background:#f4efff}.dv30-table-wrap .exc{background:#edf6ff}.risk,.watch,.clear{display:inline-block;padding:5px 8px;border-radius:99px;font-size:9px;font-weight:900}.risk{background:#ffe9ec;color:#ad3948}.watch{background:#fff4d9;color:#95660e}.clear{background:#e9f7f0;color:#277357}@media(max-width:1000px){.dv30-controls{grid-template-columns:repeat(2,1fr)}.dv30-kpis{grid-template-columns:repeat(2,1fr)}.dv30-analysis{grid-template-columns:1fr}}@media print{.dv30-print-head{display:block;text-align:center;border-bottom:2px solid #153f52;padding-bottom:8mm;margin-bottom:6mm}.dv30-print-head h1{font-size:18pt;margin:2mm 0}.dv30-kpis{grid-template-columns:repeat(4,1fr)!important;gap:3mm!important}.dv30-kpis article{padding:3mm!important;break-inside:avoid}.dv30-analysis{grid-template-columns:1fr 1fr!important;gap:3mm!important;break-inside:avoid}.dv30-table-wrap{overflow:visible!important;border-radius:0!important}.dv30-table-wrap table{min-width:0!important}.dv30-table-wrap th,.dv30-table-wrap td{padding:2mm 1mm!important;font-size:7.2pt!important}.dv30-table-wrap th{position:static!important}}`}</style>
  </main>;
}
