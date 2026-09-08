"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { tenantCollection } from "../../../lib/teacher-tenant";
import { useTeacherClient } from "../../../lib/teacher-client";

type Status="absent"|"late"|"escaped";
type Mode=Status|"all";
type Period="day"|"week"|"month"|"all";
type Student={id:string;name:string;className:string};
type Row={id:string;name:string;className:string;absent:number;late:number;escaped:number;total:number};

const labels:Record<Status,string>={absent:"الغياب",late:"التأخير",escaped:"الهروب"};
function iso(d:Date){const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Riyadh",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d);const m=Object.fromEntries(p.map(x=>[x.type,x.value]));return `${m.year}-${m.month}-${m.day}`;}
function start(period:Period){if(period==="all")return "0000-00-00";const d=new Date();if(period==="week")d.setDate(d.getDate()-6);if(period==="month")d.setDate(d.getDate()-29);return iso(d)}
function clean(v:unknown){return String(v||"").trim()}
function esc(v:string){return v.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]||c))}

export default function DailyAttendanceInsights(){
  const session=useTeacherClient();
  const teacherId=session?.teacherId||"";
  const subjectKey=String(session?.subjectKey||"history");
  const [students,setStudents]=useState<Student[]>([]);
  const [attendance,setAttendance]=useState<any[]>([]);
  const [selectedClass,setSelectedClass]=useState("all");
  const [mode,setMode]=useState<Mode>("all");
  const [period,setPeriod]=useState<Period>("month");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");

  const load=useCallback(async()=>{
    if(!teacherId||!subjectKey)return;
    setLoading(true);setError("");
    try{
      const params=new URLSearchParams({subjectId:subjectKey});
      if(session?.activeGrade)params.set("grade",String(session.activeGrade));
      const rosterResponse=await fetch(`/api/teacher/students?${params.toString()}`,{cache:"no-store",credentials:"same-origin"});
      const rosterPayload=await rosterResponse.json().catch(()=>({}));
      const roster=(Array.isArray(rosterPayload.students)?rosterPayload.students:[]).map((s:any)=>({id:clean(s.code||s.id||s.accessCode).toUpperCase(),name:clean(s.name)||"طالب",className:clean(s.className||s.class)})).filter((s:Student)=>s.id&&s.name&&s.className);
      const path=tenantCollection(teacherId,subjectKey as any,"attendance");
      const snapshot=await getDocs(collection(db,path));
      setStudents(roster);setAttendance(snapshot.docs.map(d=>({id:d.id,...d.data()})));
    }catch{setError("تعذر تحميل إحصائيات الحضور الآن");}
    finally{setLoading(false)}
  },[teacherId,subjectKey,session?.activeGrade]);

  useEffect(()=>{void load()},[load]);
  useEffect(()=>{const f=()=>void load();window.addEventListener("lahooni:attendance-updated",f as EventListener);return()=>window.removeEventListener("lahooni:attendance-updated",f as EventListener)},[load]);

  const classes=useMemo(()=>[...new Set(students.map(s=>s.className).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ar",{numeric:true})),[students]);
  const rows=useMemo<Row[]>(()=>{
    const map=new Map<string,Row>();const from=start(period),today=iso(new Date());
    for(const s of students){if(selectedClass!=="all"&&s.className!==selectedClass)continue;map.set(s.id,{id:s.id,name:s.name,className:s.className,absent:0,late:0,escaped:0,total:0})}
    for(const doc of attendance){const date=clean(doc.date);if(date<from||date>today)continue;const cls=clean(doc.class);if(selectedClass!=="all"&&cls!==selectedClass)continue;const records=doc.records&&typeof doc.records==="object"?doc.records:{};for(const [id,val] of Object.entries(records)){if(val!=="absent"&&val!=="late"&&val!=="escaped")continue;const row=map.get(String(id).toUpperCase());if(row)row[val as Status]++;}}
    for(const r of map.values())r.total=mode==="all"?r.absent+r.late+r.escaped:r[mode];
    return [...map.values()].filter(r=>r.total>0).sort((a,b)=>b.total-a.total||b.absent-a.absent||a.name.localeCompare(b.name,"ar"));
  },[students,attendance,selectedClass,mode,period]);
  const leader=(key:Status)=>[...rows].sort((a,b)=>b[key]-a[key])[0];
  const absent=leader("absent"),late=leader("late"),escaped=leader("escaped");

  function printReport(){
    const title=mode==="all"?"الغياب والتأخير والهروب":labels[mode];const cls=selectedClass==="all"?"جميع الفصول":selectedClass;const body=rows.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.name)}</td><td>${esc(r.className)}</td><td>${r.absent}</td><td>${r.late}</td><td>${r.escaped}</td><td><b>${r.total}</b></td></tr>`).join("");const w=window.open("","_blank","width=1100,height=800");if(!w)return;w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير ${title}</title><style>@page{size:A4 landscape;margin:9mm}body{font-family:Arial;color:#173b46}.head{background:#073f4d;color:white;padding:15px;text-align:center}.meta{padding:10px;border:1px solid #ddd;margin:10px 0}table{width:100%;border-collapse:collapse}th{background:#0b6d72;color:white}th,td{padding:8px;border:1px solid #ddd;text-align:center}.tools{text-align:center;margin:10px}@media print{.tools{display:none}}</style></head><body><div class="tools"><button onclick="print()">طباعة / حفظ PDF</button></div><div class="head"><b>بوابة أستاذ لحوني التعليمية</b><br>تقرير ${title} — مرتب من الأكثر إلى الأقل</div><div class="meta">المعلم: ${esc(session?.teacherName||"")} | المادة: ${esc(session?.subject||"")} | النطاق: ${esc(cls)}</div><table><thead><tr><th>م</th><th>الطالب</th><th>الفصل</th><th>غياب</th><th>تأخير</th><th>هروب</th><th>الإجمالي</th></tr></thead><tbody>${body||'<tr><td colspan="7">لا توجد سجلات</td></tr>'}</tbody></table></body></html>`);w.document.close();
  }

  return <section className="daily-attendance-v300" dir="rtl">
    <div className="dav300-head"><div><small>مؤشرات الحضور والانضباط</small><h2>من الأكثر غيابًا أو تأخيرًا أو هروبًا؟</h2><p>اختَر الحالة والفصل، وستظهر لك النتائج مرتبة مباشرة من الأعلى إلى الأقل.</p></div></div>
    <div className="dav300-filters">
      <select value={mode} onChange={e=>setMode(e.target.value as Mode)}><option value="all">الكل: غياب + تأخير + هروب</option><option value="absent">الغياب فقط</option><option value="late">التأخير فقط</option><option value="escaped">الهروب فقط</option></select>
      <select value={selectedClass} onChange={e=>setSelectedClass(e.target.value)}><option value="all">جميع الفصول</option>{classes.map(c=><option key={c} value={c}>{c}</option>)}</select>
      <select value={period} onChange={e=>setPeriod(e.target.value as Period)}><option value="day">اليوم</option><option value="week">آخر 7 أيام</option><option value="month">آخر 30 يومًا</option><option value="all">جميع السجلات</option></select>
      <button type="button" onClick={printReport} disabled={loading}>طباعة التقرير</button>
    </div>
    <div className="dav300-kpis"><article><small>الأكثر غيابًا</small><strong>{absent?.name||"—"}</strong><span>{absent?`${absent.absent} غياب • ${absent.className}`:"لا توجد حالات"}</span></article><article><small>الأكثر تأخيرًا</small><strong>{late?.name||"—"}</strong><span>{late?`${late.late} تأخير • ${late.className}`:"لا توجد حالات"}</span></article><article><small>الأكثر هروبًا</small><strong>{escaped?.name||"—"}</strong><span>{escaped?`${escaped.escaped} هروب • ${escaped.className}`:"لا توجد حالات"}</span></article></div>
    {error?<div className="dav300-empty">{error}</div>:<div className="dav300-table"><table><thead><tr><th>الترتيب</th><th>اسم الطالب</th><th>الفصل</th><th>غياب</th><th>تأخير</th><th>هروب</th><th>الإجمالي</th></tr></thead><tbody>{rows.slice(0,30).map((r,i)=><tr key={r.id}><td>{i+1}</td><td className="name">{r.name}</td><td>{r.className}</td><td>{r.absent}</td><td>{r.late}</td><td>{r.escaped}</td><td><b>{r.total}</b></td></tr>)}{!loading&&rows.length===0?<tr><td colSpan={7} className="dav300-empty">لا توجد سجلات مطابقة للاختيار الحالي.</td></tr>:null}</tbody></table></div>}
  </section>
}
