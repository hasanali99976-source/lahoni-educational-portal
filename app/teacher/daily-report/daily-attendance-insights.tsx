"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { tenantCollection } from "../../../lib/teacher-tenant";
import { useTeacherClient } from "../../../lib/teacher-client";

type Status="absent"|"late"|"excused"|"escaped";
type Period="day"|"week"|"month"|"all";
type Student={id:string;name:string;className:string};
type Row={id:string;name:string;className:string;absent:number;late:number;excused:number;escaped:number};

const labels:Record<Status,string>={absent:"الغياب",late:"التأخير",excused:"الاستئذان",escaped:"الهروب"};
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
  const [selectedClasses,setSelectedClasses]=useState<string[]>([]);
  const [selectedStudent,setSelectedStudent]=useState("");
  const [mode,setMode]=useState<Status>("absent");
  const [period,setPeriod]=useState<Period>("day");
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
      const roster=(Array.isArray(rosterPayload.students)?rosterPayload.students:[])
        .map((s:any)=>({id:clean(s.code||s.id||s.accessCode).toUpperCase(),name:clean(s.name)||"طالب",className:clean(s.className||s.class)}))
        .filter((s:Student)=>s.id&&s.name&&s.className);
      const path=tenantCollection(teacherId,subjectKey as any,"attendance");
      const snapshot=await getDocs(collection(db,path));
      setStudents(roster);setAttendance(snapshot.docs.map(d=>({id:d.id,...d.data()})));
    }catch{setError("تعذر تحميل تقرير الحضور والانضباط الآن");}
    finally{setLoading(false)}
  },[teacherId,subjectKey,session?.activeGrade]);

  useEffect(()=>{void load()},[load]);
  useEffect(()=>{const f=()=>void load();window.addEventListener("lahooni:attendance-updated",f as EventListener);return()=>window.removeEventListener("lahooni:attendance-updated",f as EventListener)},[load]);

  const classes=useMemo(()=>[...new Set(students.map(s=>s.className).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ar",{numeric:true})),[students]);
  useEffect(()=>{if(classes.length&&!selectedClasses.length)setSelectedClasses(classes)},[classes,selectedClasses.length]);
  const scopeClasses=selectedClasses.length?selectedClasses:classes;
  const visibleStudents=useMemo(()=>students.filter(s=>scopeClasses.includes(s.className)).sort((a,b)=>a.name.localeCompare(b.name,"ar")),[students,scopeClasses]);

  const rows=useMemo<Row[]>(()=>{
    const map=new Map<string,Row>();const from=start(period),today=iso(new Date());
    for(const s of students){if(scopeClasses.length&&!scopeClasses.includes(s.className))continue;map.set(s.id,{id:s.id,name:s.name,className:s.className,absent:0,late:0,excused:0,escaped:0})}
    for(const doc of attendance){
      const date=clean(doc.date);if(date<from||date>today)continue;
      const cls=clean(doc.class);if(scopeClasses.length&&!scopeClasses.includes(cls))continue;
      const records=doc.records&&typeof doc.records==="object"?doc.records:{};
      for(const [id,val] of Object.entries(records)){
        if(val!=="absent"&&val!=="late"&&val!=="excused"&&val!=="escaped")continue;
        const row=map.get(String(id).toUpperCase());if(row)row[val as Status]++;
      }
    }
    return [...map.values()].filter(r=>r[mode]>0).sort((a,b)=>b[mode]-a[mode]||a.name.localeCompare(b.name,"ar"));
  },[students,attendance,scopeClasses,mode,period]);

  function toggleClass(cls:string){setSelectedStudent("");setSelectedClasses(prev=>prev.includes(cls)?prev.filter(x=>x!==cls):[...prev,cls])}
  function printRows(reportRows:Row[],scopeLabel:string){
    const title=labels[mode];
    const body=reportRows.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.name)}</td><td>${esc(r.className)}</td><td><b>${r[mode]}</b></td></tr>`).join("");
    const w=window.open("","_blank","width=1000,height=780");if(!w)return;
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير ${title}</title><style>@page{size:A4;margin:12mm}body{font-family:Arial;color:#173b46}.head{background:#073f4d;color:white;padding:16px;text-align:center;border-radius:12px}.meta{padding:10px;border:1px solid #ddd;margin:12px 0;border-radius:10px}table{width:100%;border-collapse:collapse}th{background:#0b6d72;color:white}th,td{padding:9px;border:1px solid #ddd;text-align:center}.tools{text-align:center;margin:10px}.tools button{padding:9px 18px;border:0;border-radius:9px;background:#0b6d72;color:#fff;font-weight:700}@media print{.tools{display:none}}</style></head><body><div class="tools"><button onclick="print()">طباعة / حفظ PDF</button></div><div class="head"><b>بوابة أستاذ لحوني التعليمية</b><br>تقرير ${title}</div><div class="meta">المعلم: ${esc(session?.teacherName||"")} | المادة: ${esc(session?.subject||"")} | النطاق: ${esc(scopeLabel)}</div><table><thead><tr><th>م</th><th>الطالب</th><th>الفصل</th><th>عدد حالات ${title}</th></tr></thead><tbody>${body||'<tr><td colspan="4">لا توجد سجلات</td></tr>'}</tbody></table></body></html>`);w.document.close();
  }
  function printSelectedStudent(){const student=students.find(s=>s.id===selectedStudent);if(!student)return;const row=rows.find(r=>r.id===student.id);const empty:Row={id:student.id,name:student.name,className:student.className,absent:0,late:0,excused:0,escaped:0};printRows(row?[row]:[empty],`الطالب: ${student.name} • ${student.className}`)}
  function printSelectedClasses(){printRows(rows,scopeClasses.length===classes.length?"جميع الفصول":scopeClasses.length===1?`الفصل: ${scopeClasses[0]}`:`الفصول: ${scopeClasses.join("، ")}`)}

  return <section className="daily-attendance-v300" dir="rtl">
    <div className="dav300-head"><div><small>تقرير مستقل داخل تبويب اليوم</small><h2>تقرير الحضور والانضباط</h2><p>اختر نوع التقرير: الغياب أو التأخير أو الاستئذان أو الهروب، ثم اختر طالبًا أو فصلًا أو عدة فصول أو جميع الفصول.</p></div></div>
    <div className="dav300-filters">
      <select value={mode} onChange={e=>setMode(e.target.value as Status)}>
        <option value="absent">تقرير الغياب</option><option value="late">تقرير التأخير</option><option value="excused">تقرير الاستئذان</option><option value="escaped">تقرير الهروب</option>
      </select>
      <select value={period} onChange={e=>setPeriod(e.target.value as Period)}><option value="day">اليوم</option><option value="week">آخر 7 أيام</option><option value="month">آخر 30 يومًا</option><option value="all">جميع السجلات</option></select>
      <select value={selectedStudent} onChange={e=>setSelectedStudent(e.target.value)}><option value="">اختر طالبًا</option>{visibleStudents.map(s=><option key={s.id} value={s.id}>{s.name} — {s.className}</option>)}</select>
      <button type="button" onClick={printSelectedStudent} disabled={!selectedStudent||loading}>طباعة الطالب</button>
    </div>
    <div className="dav300-class-picker"><div className="dav300-class-title"><b>نطاق التقرير</b><span>طالب، فصل، عدة فصول، أو جميع الفصول</span></div><div className="dav300-class-chips"><button type="button" className={selectedClasses.length===classes.length?"active":""} onClick={()=>{setSelectedStudent("");setSelectedClasses(classes)}}>جميع الفصول</button>{classes.map(cls=><button type="button" key={cls} className={selectedClasses.includes(cls)?"active":""} onClick={()=>toggleClass(cls)}>{cls}</button>)}</div><button type="button" className="dav300-print-scope" onClick={printSelectedClasses} disabled={!scopeClasses.length||loading}>طباعة التقرير</button></div>
    {error?<div className="dav300-empty">{error}</div>:<div className="dav300-table"><table><thead><tr><th>م</th><th>اسم الطالب</th><th>الفصل</th><th>{labels[mode]}</th></tr></thead><tbody>{rows.slice(0,150).map((r,i)=><tr key={r.id}><td>{i+1}</td><td className="name">{r.name}</td><td>{r.className}</td><td><b>{r[mode]}</b></td></tr>)}{!loading&&rows.length===0?<tr><td colSpan={4} className="dav300-empty">لا توجد سجلات مطابقة للاختيار الحالي.</td></tr>:null}</tbody></table></div>}
  </section>
}
