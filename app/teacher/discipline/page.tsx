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
type MetricKey="absent"|"late"|"escaped"|"excused";
type Row={code:string;name:string;className:string;absent:number;late:number;escaped:number;excused:number;total:number;scheduledLessons:number;absenceRate:number};

const reportLabels:Record<ReportType,string>={all:"تقرير الانضباط الشامل",absent:"تقرير الغياب",late:"تقرير التأخير",escaped:"تقرير الهروب",excused:"تقرير الاستئذان"};
const metricLabels:Record<MetricKey,string>={absent:"الغياب",late:"التأخير",escaped:"الهروب",excused:"الاستئذان"};
const statusField:Record<Exclude<ReportType,"all">,MetricKey>={absent:"absent",late:"late",escaped:"escaped",excused:"excused"};
const dayIndex:Record<string,number>={sunday:0,monday:1,tuesday:2,wednesday:3,thursday:4};
const ar=(n:number)=>new Intl.NumberFormat("ar-SA-u-nu-arab",{maximumFractionDigits:1}).format(Number.isFinite(n)?n:0);
const riyadhToday=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Riyadh",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
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

  const firstRecordedDate=useMemo(()=>attendance.map(r=>String(r.date||"")).filter(Boolean).sort()[0]||"2026-08-23",[attendance]);
  const reportEnd=riyadhToday();

  const periodsByClass=useMemo(()=>{
    const map=new Map<string,Map<number,number>>();
    Object.entries(timetable).forEach(([cell,lesson])=>{
      const match=cell.match(/^(sunday|monday|tuesday|wednesday|thursday)-([1-7])$/);
      const className=String(lesson?.className||"").trim();
      if(!match||!className)return;
      const weekday=dayIndex[match[1]];
      const perDay=map.get(className)||new Map<number,number>();
      perDay.set(weekday,(perDay.get(weekday)||0)+1);
      map.set(className,perDay);
    });
    return map;
  },[timetable]);

  function scheduledLessons(className:string){
    const schedule=periodsByClass.get(className);
    if(!schedule||!firstRecordedDate||firstRecordedDate>reportEnd)return 0;
    let total=0;const cursor=asDate(firstRecordedDate);const end=asDate(reportEnd);
    while(cursor<=end){total+=schedule.get(cursor.getUTCDay())||0;cursor.setUTCDate(cursor.getUTCDate()+1);}
    return total;
  }

  const rows=useMemo<Row[]>(()=>students.map(student=>{
    const code=String(student.code||student.id||"").trim().toUpperCase();
    const name=String(student.name||"").trim();
    const className=String(student.className||student.class||"").trim();
    let absent=0,late=0,escaped=0,excused=0;
    attendance.forEach(record=>{
      if(record.class&&record.class!==className)return;
      const status=record.records?.[code];
      if(status==="absent")absent++;
      if(status==="late")late++;
      if(status==="escaped")escaped++;
      if(status==="excused")excused++;
    });
    const lessons=scheduledLessons(className);
    const total=absent+late+escaped+excused;
    const absenceRate=lessons?Math.min(100,Math.round(absent/lessons*1000)/10):0;
    return{code,name,className,absent,late,escaped,excused,total,scheduledLessons:lessons,absenceRate};
  }).filter(r=>r.code&&r.name),[students,attendance,firstRecordedDate,reportEnd,periodsByClass]);

  const scoped=useMemo(()=>rows.filter(r=>scope==="all"||scope==="class"&&r.className===selectedClass||scope==="student"&&r.code===selectedStudent),[rows,scope,selectedClass,selectedStudent]);
  const visible=useMemo(()=>scoped.filter(r=>(!query.trim()||r.name.includes(query.trim())||r.code.includes(query.trim().toUpperCase()))&&(reportType==="all"||r[statusField[reportType]]>0)).sort((a,b)=>{const av=reportType==="all"?a.total:a[statusField[reportType]];const bv=reportType==="all"?b.total:b[statusField[reportType]];return bv-av||a.name.localeCompare(b.name,"ar");}),[scoped,query,reportType]);

  const totals=visible.reduce((s,r)=>({absent:s.absent+r.absent,late:s.late+r.late,escaped:s.escaped+r.escaped,excused:s.excused+r.excused,total:s.total+r.total}),{absent:0,late:0,escaped:0,excused:0,total:0});
  const affected=visible.filter(r=>r.total>0).length;
  const repeated=visible.filter(r=>r.total>=2).length;
  const urgent=visible.filter(r=>r.escaped>0||r.absent>=3||r.late>=3).length;
  const avgAbsence=visible.length?visible.reduce((s,r)=>s+r.absenceRate,0)/visible.length:0;
  const scopeLabel=scope==="all"?"جميع الفصول":scope==="student"?(rows.find(r=>r.code===selectedStudent)?.name||"طالب محدد"):(selectedClass||"فصل محدد");

  const metricStats=useMemo(()=>((Object.keys(metricLabels) as MetricKey[]).map(key=>{
    const ranked=[...visible].filter(r=>r[key]>0).sort((a,b)=>b[key]-a[key]||a.name.localeCompare(b.name,"ar"));
    return{key,label:metricLabels[key],count:totals[key],students:ranked.length,top:ranked[0]||null};
  })),[visible,totals.absent,totals.late,totals.escaped,totals.excused]);

  const table=<table><thead><tr><th>#</th><th>الطالب</th><th>الفصل</th><th>الحصص</th><th className="abs">الغياب</th><th className="late">التأخير</th><th className="esc">الهروب</th><th className="exc">الاستئذان</th><th>نسبة الغياب</th><th>الحالة</th></tr></thead><tbody>{visible.map((r,i)=><tr key={r.code}><td>{ar(i+1)}</td><td><b>{r.name}</b><small>{r.code}</small></td><td>{r.className}</td><td>{ar(r.scheduledLessons)}</td><td className="abs">{ar(r.absent)}</td><td className="late">{ar(r.late)}</td><td className="esc">{ar(r.escaped)}</td><td className="exc">{ar(r.excused)}</td><td>{r.scheduledLessons?`${ar(r.absenceRate)}٪`:"—"}</td><td><span className={r.escaped>0||r.absent>=3||r.late>=3?"risk":r.total?"watch":"clear"}>{r.escaped>0||r.absent>=3||r.late>=3?"يحتاج متابعة":r.total?"ملاحظة":"منتظم"}</span></td></tr>)}</tbody></table>;

  return <main className="discipline-v40" dir="rtl">
    <div className="discipline-screen">
      <section className="dv40-hero"><div><small>لوحة الانضباط الذكية</small><h1>الانضباط الطلابي</h1><p>إحصاءات سلوكية مستقلة عن التحصيل الدراسي، من أول حصة مسجلة حتى يوم إنشاء التقرير.</p></div><div className="dv40-hero-actions"><span>الفترة التلقائية<br/><b>{prettyDate(firstRecordedDate)} — {prettyDate(reportEnd)}</b></span><Link href="/teacher/attendance">الحضور اليومي ←</Link></div></section>
      <section className="dv40-controls"><label><span>نوع التقرير</span><select value={reportType} onChange={e=>setReportType(e.target.value as ReportType)}><option value="all">شامل</option><option value="absent">الغياب</option><option value="late">التأخير</option><option value="escaped">الهروب</option><option value="excused">الاستئذان</option></select></label><label><span>النطاق</span><select value={scope} onChange={e=>setScope(e.target.value as Scope)}><option value="class">فصل محدد</option><option value="all">جميع الفصول</option><option value="student">طالب محدد</option></select></label>{scope==="class"?<label><span>الفصل</span><select value={selectedClass} onChange={e=>setSelectedClass(e.target.value)}>{classes.map(c=><option key={c}>{c}</option>)}</select></label>:null}{scope==="student"?<label><span>الطالب</span><select value={selectedStudent} onChange={e=>setSelectedStudent(e.target.value)}><option value="">اختر الطالب</option>{rows.map(r=><option key={r.code} value={r.code}>{r.name} — {r.className}</option>)}</select></label>:null}<label><span>بحث</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="اسم الطالب أو الكود"/></label><button onClick={()=>window.print()}>🖨 طباعة التقرير</button></section>
      <section className="dv40-metrics">{metricStats.map(stat=><article key={stat.key} className={stat.key}><div><span>{stat.label}</span><b>{ar(stat.count)}</b></div><p>{ar(stat.students)} طالب لديهم حالة</p><small>{stat.top?`الأكثر: ${stat.top.name} (${ar(stat.top[stat.key])})`:"لا توجد حالات"}</small></article>)}<article className="affected"><div><span>طلاب متأثرون</span><b>{ar(affected)}</b></div><p>من {ar(visible.length)} طالب</p><small>أي طالب لديه حالة واحدة فأكثر</small></article><article className="repeated"><div><span>حالات متكررة</span><b>{ar(repeated)}</b></div><p>مرتان فأكثر</p><small>للمتابعة الوقائية</small></article><article className="urgent"><div><span>تحتاج متابعة</span><b>{ar(urgent)}</b></div><p>هروب أو تكرار غياب/تأخير</p><small>أولوية للمعلم والمرشد</small></article><article className="rate"><div><span>متوسط الغياب</span><b>{ar(avgAbsence)}٪</b></div><p>حسب عدد حصص المادة</p><small>وليس حسب أيام الدوام</small></article></section>
      <section className="dv40-rankings">{(Object.keys(metricLabels) as MetricKey[]).map(key=>{const ranked=[...visible].filter(r=>r[key]>0).sort((a,b)=>b[key]-a[key]).slice(0,5);return <article key={key}><header><span className={key}/><div><small>أعلى الطلاب</small><h3>{metricLabels[key]}</h3></div></header>{ranked.length?ranked.map((r,i)=><div className="rank-row" key={r.code}><b>{i+1}</b><span>{r.name}<small>{r.className}</small></span><strong>{ar(r[key])}</strong></div>):<p className="empty">لا توجد حالات.</p>}</article>;})}</section>
      <section className="dv40-table"><header><div><small>السجل التفصيلي</small><h2>{reportLabels[reportType]}</h2></div><span>{ar(visible.length)} طالب</span></header><div>{table}</div></section>
    </div>
    <section className="discipline-print-only"><header><small>بوابة أستاذ لحوني التعليمية</small><h1>{reportLabels[reportType]}</h1><p>المعلم: {session.teacherName||"—"} · المادة: {session.subject||"—"} · النطاق: {scopeLabel}</p><p>الفترة: من أول حصة مسجلة {prettyDate(firstRecordedDate)} حتى {prettyDate(reportEnd)}</p></header><div className="print-kpis">{metricStats.map(stat=><article key={stat.key} className={stat.key}><span>{stat.label}</span><b>{ar(stat.count)}</b><small>{ar(stat.students)} طالب</small></article>)}<article><span>طلاب متأثرون</span><b>{ar(affected)}</b><small>من {ar(visible.length)}</small></article><article><span>متوسط الغياب</span><b>{ar(avgAbsence)}٪</b><small>حسب الحصص</small></article></div><section className="print-summary"><b>ملخص التقرير:</b> تم تسجيل {ar(totals.total)} حالة؛ منها {ar(totals.absent)} غياب، {ar(totals.late)} تأخير، {ar(totals.escaped)} هروب، و{ar(totals.excused)} استئذان. توجد {ar(repeated)} حالات متكررة و{ar(urgent)} حالات تستحق متابعة.</section><div className="print-table">{table}</div><footer>بوابة أستاذ لحوني التعليمية · {new Intl.DateTimeFormat("ar-SA",{dateStyle:"long",timeStyle:"short"}).format(new Date())}</footer></section>
    <style jsx global>{`.discipline-v40{font-family:"Segoe UI",Tahoma,Arial,sans-serif;color:#173743}.discipline-print-only{display:none}.dv40-hero{display:flex;justify-content:space-between;align-items:center;gap:18px;padding:25px;border-radius:24px;background:linear-gradient(125deg,#103f54,#087a76);color:#fff}.dv40-hero h1{margin:4px 0;font-size:30px}.dv40-hero p{margin:0;color:#d6e8e8}.dv40-hero-actions{display:flex;align-items:center;gap:10px}.dv40-hero-actions>span{padding:9px 12px;border:1px solid #ffffff26;border-radius:13px;background:#ffffff10;font-size:10px}.dv40-hero-actions a{padding:12px 14px;border-radius:13px;background:#fff;color:#0c655f;text-decoration:none;font-weight:900}.dv40-controls{display:flex;flex-wrap:wrap;gap:9px;align-items:end;margin:14px 0;padding:13px;border:1px solid #dce7e9;border-radius:18px;background:#fff}.dv40-controls label{display:grid;gap:5px;min-width:145px;flex:1}.dv40-controls label span{font-size:10px;font-weight:900;color:#627983}.dv40-controls select,.dv40-controls input{height:41px;border:1px solid #cedde1;border-radius:11px;background:#fbfdfd;padding:0 10px}.dv40-controls button{height:41px;padding:0 15px;border:0;border-radius:11px;background:#173f52;color:#fff;font-weight:900}.dv40-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.dv40-metrics article{padding:15px;border-radius:17px;border:1px solid #e0e8ea;background:#fff;box-shadow:0 8px 22px #153d5010;position:relative;overflow:hidden}.dv40-metrics article:before{content:"";position:absolute;right:0;top:0;bottom:0;width:5px;background:#65808b}.dv40-metrics article.absent:before{background:#cf4d5b}.dv40-metrics article.late:before{background:#d99928}.dv40-metrics article.escaped:before{background:#7555b4}.dv40-metrics article.excused:before{background:#3e82b4}.dv40-metrics article.affected:before{background:#278b72}.dv40-metrics article.repeated:before{background:#d4772b}.dv40-metrics article.urgent:before{background:#394d59}.dv40-metrics article.rate:before{background:#0c8b84}.dv40-metrics article div{display:flex;justify-content:space-between;align-items:center}.dv40-metrics span{font-size:11px;font-weight:900;color:#657b84}.dv40-metrics b{font-size:27px}.dv40-metrics p{margin:4px 0;color:#4f6872;font-size:10px}.dv40-metrics small{color:#8a9a9f;font-size:9px}.dv40-rankings{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0}.dv40-rankings article{padding:13px;border:1px solid #dce6e8;border-radius:17px;background:#fff}.dv40-rankings header{display:flex;align-items:center;gap:8px;margin-bottom:9px}.dv40-rankings header>span{width:9px;height:36px;border-radius:9px;background:#78909a}.dv40-rankings header>span.absent{background:#cf4d5b}.dv40-rankings header>span.late{background:#d99928}.dv40-rankings header>span.escaped{background:#7555b4}.dv40-rankings header>span.excused{background:#3e82b4}.dv40-rankings h3{margin:1px 0;font-size:14px}.rank-row{display:grid;grid-template-columns:25px 1fr auto;gap:7px;align-items:center;padding:7px 0;border-top:1px solid #eef2f3}.rank-row>b{width:22px;height:22px;display:grid;place-items:center;border-radius:7px;background:#eef4f5;font-size:9px}.rank-row span{font-size:10px;font-weight:850}.rank-row span small{display:block;color:#8a9a9f;font-size:8px}.rank-row strong{font-size:14px}.empty{font-size:10px;color:#87979d}.dv40-table{border:1px solid #d9e5e8;border-radius:19px;background:#fff;overflow:hidden}.dv40-table>header{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid #e5edef}.dv40-table h2{margin:2px 0}.dv40-table>div{overflow:auto;max-height:68vh}.dv40-table table,.discipline-print-only table{width:100%;border-collapse:collapse;min-width:900px}.dv40-table th,.dv40-table td,.discipline-print-only th,.discipline-print-only td{padding:10px 8px;border-bottom:1px solid #e7edef;text-align:center;font-size:10px}.dv40-table th{position:sticky;top:0;background:#edf4f5;z-index:2}.dv40-table td:nth-child(2),.discipline-print-only td:nth-child(2){text-align:right}.dv40-table td:nth-child(2) small,.discipline-print-only td:nth-child(2) small{display:block;color:#94a1a5}.abs{background:#fff1f2!important}.late{background:#fff7e8!important}.esc{background:#f4efff!important}.exc{background:#edf6ff!important}.risk,.watch,.clear{display:inline-block;padding:5px 8px;border-radius:99px;font-size:8px;font-weight:900}.risk{background:#ffe8ec;color:#ad3c4b}.watch{background:#fff4d9;color:#95660e}.clear{background:#e8f7ef;color:#267156}@media(max-width:1000px){.dv40-metrics,.dv40-rankings{grid-template-columns:repeat(2,1fr)}}@media(max-width:650px){.dv40-hero{align-items:flex-start;flex-direction:column}.dv40-hero-actions{width:100%;flex-direction:column;align-items:stretch}.dv40-metrics,.dv40-rankings{grid-template-columns:1fr 1fr}}@media print{@page{size:A4 portrait;margin:10mm}.discipline-screen{display:none!important}.discipline-print-only{display:block!important;color:#172f38!important;background:#fff!important}.discipline-print-only header{text-align:center;padding-bottom:5mm;border-bottom:2px solid #0c6f6b;margin-bottom:5mm}.discipline-print-only header small{display:block!important;color:#0c6f6b!important;font-size:9pt!important;font-weight:900}.discipline-print-only header h1{margin:2mm 0!important;font-size:19pt!important}.discipline-print-only header p{margin:1mm 0!important;font-size:9pt!important}.print-kpis{display:grid!important;grid-template-columns:repeat(3,1fr)!important;gap:3mm!important;margin-bottom:4mm!important}.print-kpis article{display:block!important;padding:3mm!important;border:1px solid #cfdadc!important;border-radius:3mm!important;background:#f8fbfb!important}.print-kpis span{display:block!important;font-size:8pt!important}.print-kpis b{display:block!important;font-size:15pt!important;margin:1mm 0!important}.print-kpis small{display:block!important;font-size:7pt!important}.print-summary{display:block!important;padding:3mm!important;margin-bottom:4mm!important;background:#edf7f6!important;border:1px solid #c8e1df!important;font-size:8.5pt!important}.discipline-print-only table{min-width:0!important}.discipline-print-only th,.discipline-print-only td{padding:1.8mm 1mm!important;font-size:7.2pt!important;border:1px solid #ccd5d8!important}.discipline-print-only th{background:#e8f1f1!important;color:#173743!important}.discipline-print-only footer{display:block!important;margin-top:5mm!important;padding-top:3mm!important;border-top:1px solid #d7e0e2!important;text-align:center!important;font-size:7pt!important;color:#75878d!important}}
    `}</style>
  </main>;
}
