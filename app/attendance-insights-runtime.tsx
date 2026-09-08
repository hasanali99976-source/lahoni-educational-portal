"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { collection, getDocs } from "firebase/firestore";
import { usePathname } from "next/navigation";
import { db } from "../lib/firebase";
import { tenantCollection } from "../lib/teacher-tenant";
import { useTeacherClient } from "../lib/teacher-client";

type Student={id:string;name:string;className:string};
type Status="absent"|"late"|"escaped";
type Mode=Status|"all";
type Period="day"|"week"|"month"|"all";
type Row={id:string;name:string;className:string;absent:number;late:number;escaped:number;total:number};
const AR:Record<Status,string>={absent:"الغياب",late:"التأخير",escaped:"الهروب"};

function iso(d:Date){const o=d.getTimezoneOffset();return new Date(d.getTime()-o*60000).toISOString().slice(0,10)}
function fromPeriod(period:Period){const now=new Date();if(period==="all")return "0000-00-00";if(period==="day")return iso(now);const d=new Date(now);d.setDate(d.getDate()-(period==="week"?6:29));return iso(d)}
function esc(v:string){return v.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]||c))}
function cleanClass(value:unknown){return String(value||"").trim().replace(/\s+/g," ")}

export default function AttendanceInsightsRuntime(){
 const pathname=usePathname();
 const session=useTeacherClient();
 const teacherId=session?.teacherId||"", subjectKey=session?.subjectKey||"history", teacherName=session?.teacherName||"", subject=session?.subject||"";
 const [students,setStudents]=useState<Student[]>([]),[attendance,setAttendance]=useState<any[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const [selectedClass,setSelectedClass]=useState("all"),[mode,setMode]=useState<Mode>("all"),[period,setPeriod]=useState<Period>("month"),[host,setHost]=useState<HTMLElement|null>(null);
 const active=pathname==="/teacher/attendance";
 const attendancePath=useMemo(()=>teacherId?tenantCollection(teacherId,subjectKey as any,"attendance"):"",[teacherId,subjectKey]);

 useEffect(()=>{
   if(!active){setHost(null);return;}
   let timer=0;let observer:MutationObserver|undefined;
   const mount=()=>{
     const card=document.querySelector(".attendance-page .attendance-card");
     const workspace=card?.querySelector(".attendance-workspace");
     if(!card||!workspace)return;
     let node=card.querySelector<HTMLElement>("#attendance-insights-daily-host");
     if(!node){node=document.createElement("div");node.id="attendance-insights-daily-host";card.insertBefore(node,workspace);}
     setHost(node);
   };
   timer=window.setTimeout(mount,40);
   observer=new MutationObserver(mount);observer.observe(document.body,{childList:true,subtree:true});
   return()=>{window.clearTimeout(timer);observer?.disconnect();setHost(null);};
 },[active]);

 const load=useCallback(async()=>{
  if(!active||!attendancePath)return;
  setBusy(true);setError("");
  try{
   const params=new URLSearchParams({subjectId:subjectKey});
   const [rosterResponse,aa]=await Promise.all([
     fetch(`/api/teacher/students?${params.toString()}`,{cache:"no-store",credentials:"same-origin"}),
     getDocs(collection(db,attendancePath)),
   ]);
   const rosterPayload=rosterResponse.ok?await rosterResponse.json():{};
   const official=Array.isArray(rosterPayload?.students)?rosterPayload.students:[];
   const normalized:Student[]=official.map((s:any)=>({
     id:String(s.code||s.id||s.accessCode||s.studentCode||"").trim().toUpperCase(),
     name:String(s.name||"").trim(),
     className:cleanClass(s.className||s.class),
   })).filter((s:Student)=>s.id&&s.name&&s.className);
   setStudents(normalized);
   setAttendance(aa.docs.map(d=>({id:d.id,...d.data()})));
   if(!normalized.length)setError("لا توجد أسماء طلاب في القائمة الرسمية لهذه المادة حتى الآن.");
  }catch{setError("تعذر تحميل تقرير الغياب والتأخير والهروب الآن");}
  finally{setBusy(false)}
 },[active,attendancePath,subjectKey]);

 useEffect(()=>{void load()},[load]);
 useEffect(()=>{
   if(!active)return;
   const refresh=()=>void load();
   window.addEventListener("lahooni:attendance-updated",refresh as EventListener);
   return()=>window.removeEventListener("lahooni:attendance-updated",refresh as EventListener);
 },[active,load]);

 const classes=useMemo(()=>Array.from(new Set(students.map(s=>s.className).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"ar",{numeric:true})),[students]);
 const rows=useMemo<Row[]>(()=>{
  const start=fromPeriod(period),today=iso(new Date());
  const map=new Map<string,Row>();
  for(const s of students){if(selectedClass!=="all"&&s.className!==selectedClass)continue;map.set(s.id,{id:s.id,name:s.name,className:s.className,absent:0,late:0,escaped:0,total:0})}
  for(const doc of attendance){const date=String(doc?.date||"");if(date<start||date>today)continue;const cls=cleanClass(doc?.class);if(selectedClass!=="all"&&cls!==selectedClass)continue;const records=doc?.records||{};for(const [studentId,value] of Object.entries(records)){if(value!=="absent"&&value!=="late"&&value!=="escaped")continue;const key=String(studentId).trim().toUpperCase();const r=map.get(key);if(!r)continue;r[value as Status]++;}}
  for(const r of map.values())r.total=mode==="all"?r.absent+r.late+r.escaped:r[mode];
  return Array.from(map.values()).filter(r=>r.total>0).sort((a,b)=>b.total-a.total||b.absent-a.absent||a.name.localeCompare(b.name,"ar"));
 },[students,attendance,selectedClass,mode,period]);

 const leaders=useMemo(()=>{
  const max=(k:Status)=>[...rows].filter(r=>r[k]>0).sort((a,b)=>b[k]-a[k])[0];
  return {absent:max("absent"),late:max("late"),escaped:max("escaped")};
 },[rows]);

 function printReport(){
  const label=mode==="all"?"الغياب والتأخير والهروب":AR[mode];const classLabel=selectedClass==="all"?"جميع الفصول":selectedClass;const periodLabel=period==="day"?"اليوم":period==="week"?"آخر 7 أيام":period==="month"?"آخر 30 يومًا":"جميع السجلات";
  const body=rows.map((r,i)=>`<tr><td>${i+1}</td><td class="n">${esc(r.name)}</td><td>${esc(r.className)}</td><td>${r.absent}</td><td>${r.late}</td><td>${r.escaped}</td><td><b>${r.total}</b></td></tr>`).join("");
  const w=window.open("","_blank","width=1100,height=800");if(!w)return;
  w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير ${label}</title><style>@page{size:A4 landscape;margin:8mm}body{font-family:Arial;color:#173b46;margin:0}.bar{background:#073f4d;color:#fff;padding:14px 18px;text-align:center}.meta{display:flex;gap:10px;justify-content:space-between;padding:10px;border:1px solid #dbe5e8;margin:10px 0;font-size:12px}table{width:100%;border-collapse:collapse}th{background:#0a5965;color:#fff}th,td{border:1px solid #d8e2e5;padding:8px;text-align:center}.n{text-align:right;font-weight:700}.foot{margin-top:10px;color:#71858d;font-size:10px}.tools{text-align:center;padding:8px}.tools button{padding:9px 20px;font-weight:bold}@media print{.tools{display:none}}</style></head><body><div class="tools"><button onclick="print()">طباعة / حفظ PDF</button></div><div class="bar"><b>بوابة أستاذ لحوني التعليمية</b><br/>تقرير ${label} — مرتب من الأكثر إلى الأقل</div><div class="meta"><span>المعلم: ${esc(teacherName)}</span><span>المادة: ${esc(subject)}</span><span>النطاق: ${esc(classLabel)}</span><span>الفترة: ${periodLabel}</span></div><table><thead><tr><th>م</th><th>اسم الطالب</th><th>الفصل</th><th>غياب</th><th>تأخير</th><th>هروب</th><th>الإجمالي المختار</th></tr></thead><tbody>${body||'<tr><td colspan="7">لا توجد سجلات مطابقة</td></tr>'}</tbody></table><div class="foot">تم إنشاء التقرير من سجل الحضور الحالي — ${new Date().toLocaleString("ar-SA")}</div></body></html>`);w.document.close();
 }

 if(!active||!host)return null;
 const panel=<section className="attendance-insights-v2" dir="rtl">
   <div className="ai2-head"><div><span>إحصائيات اليومي</span><h2>الغياب والتأخير والهروب</h2><p>اعرف مباشرة أكثر الطلاب تكرارًا، ثم اطبع التقرير الذي يناسبك.</p></div><button type="button" onClick={load} disabled={busy}>{busy?"جاري التحديث…":"تحديث"}</button></div>
   <div className="ai2-kpis">
    <article className="absent"><small>الأكثر غيابًا</small><strong>{leaders.absent?.name||"—"}</strong><span>{leaders.absent?`${leaders.absent.absent} مرات • ${leaders.absent.className}`:"لا توجد حالات"}</span></article>
    <article className="late"><small>الأكثر تأخيرًا</small><strong>{leaders.late?.name||"—"}</strong><span>{leaders.late?`${leaders.late.late} مرات • ${leaders.late.className}`:"لا توجد حالات"}</span></article>
    <article className="escaped"><small>الأكثر هروبًا</small><strong>{leaders.escaped?.name||"—"}</strong><span>{leaders.escaped?`${leaders.escaped.escaped} مرات • ${leaders.escaped.className}`:"لا توجد حالات"}</span></article>
   </div>
   <div className="ai2-report-box"><div className="ai2-report-title"><strong>إنشاء تقرير مرتب</strong><small>اختر الحالة والفصل والفترة، وسيظهر الأكثر أولًا.</small></div><div className="ai2-filters">
    <label><span>نوع التقرير</span><select value={mode} onChange={e=>setMode(e.target.value as Mode)}><option value="all">الكل: غياب + تأخير + هروب</option><option value="absent">الغياب فقط</option><option value="late">التأخير فقط</option><option value="escaped">الهروب فقط</option></select></label>
    <label><span>الفصل</span><select value={selectedClass} onChange={e=>setSelectedClass(e.target.value)}><option value="all">جميع الفصول</option>{classes.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
    <label><span>الفترة</span><select value={period} onChange={e=>setPeriod(e.target.value as Period)}><option value="day">اليوم</option><option value="week">آخر 7 أيام</option><option value="month">آخر 30 يومًا</option><option value="all">جميع السجلات</option></select></label>
    <button type="button" className="print" onClick={printReport} disabled={busy||!students.length}>طباعة التقرير</button>
   </div></div>
   {error?<div className="ai2-empty">{error}</div>:<div className="ai2-ranking"><div className="ai2-ranking-head"><strong>الترتيب</strong><span>{rows.length} طالب لديهم حالات مطابقة</span></div><table><thead><tr><th>#</th><th>الطالب</th><th>الفصل</th><th>غياب</th><th>تأخير</th><th>هروب</th><th>الإجمالي</th></tr></thead><tbody>{rows.slice(0,40).map((r,i)=><tr key={r.id}><td>{i+1}</td><td className="name">{r.name}</td><td>{r.className}</td><td>{r.absent}</td><td>{r.late}</td><td>{r.escaped}</td><td><b>{r.total}</b></td></tr>)}{!busy&&rows.length===0?<tr><td colSpan={7} className="ai2-empty">لا توجد حالات مطابقة للاختيار الحالي.</td></tr>:null}</tbody></table></div>}
 </section>;
 return createPortal(panel,host);
}
