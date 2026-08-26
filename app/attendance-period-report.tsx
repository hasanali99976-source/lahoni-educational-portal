"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import * as XLSX from "xlsx";
import { usePathname } from "next/navigation";
import { db } from "../lib/firebase";
import { tenantCollection } from "../lib/teacher-tenant";
import { useTeacherClient } from "../lib/teacher-client";

const PORTAL = "بوابة أستاذ لحوني التعليمية";
type Period = "day" | "week" | "month";
type Student = { id:string; name?:string; class?:string };
type Status = "present"|"absent"|"late"|"excused"|"escaped";
const labels:Record<Status,string>={present:"ح",absent:"غ",late:"ت",excused:"م",escaped:"هـ"};
const longLabels:Record<Status,string>={present:"حاضر",absent:"غائب",late:"متأخر",excused:"مستأذن",escaped:"هروب"};

function iso(d:Date){const o=d.getTimezoneOffset();return new Date(d.getTime()-o*60000).toISOString().slice(0,10)}
function range(base:string,period:Period){const d=new Date(`${base}T12:00:00`);if(period==="day")return[base];if(period==="week"){const day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);return Array.from({length:7},(_,i)=>{const x=new Date(d);x.setDate(d.getDate()+i);return iso(x)})}const y=d.getFullYear(),m=d.getMonth();return Array.from({length:new Date(y,m+1,0).getDate()},(_,i)=>iso(new Date(y,m,i+1)))}
function esc(v:string){return v.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]||c))}

export default function AttendancePeriodReport(){
 const pathname=usePathname(); const session=useTeacherClient();
 const teacherId=session?.teacherId||"", subjectKey=session?.subjectKey||"history", teacherName=session?.teacherName||"", subject=session?.subject||"";
 const [students,setStudents]=useState<Student[]>([]),[selectedClass,setSelectedClass]=useState(""),[date,setDate]=useState(iso(new Date())),[period,setPeriod]=useState<Period>("day"),[busy,setBusy]=useState(false),[msg,setMsg]=useState("");
 const studentsPath=useMemo(()=>teacherId?tenantCollection(teacherId,subjectKey as any,"students"):"",[teacherId,subjectKey]);
 const attendancePath=useMemo(()=>teacherId?tenantCollection(teacherId,subjectKey as any,"attendance"):"",[teacherId,subjectKey]);
 useEffect(()=>{if(pathname!=="/teacher/attendance"||!studentsPath)return;getDocs(collection(db,studentsPath)).then(s=>setStudents(s.docs.map(d=>({id:d.id,...d.data()} as Student)))).catch(()=>setMsg("تعذر تحميل الطلاب"))},[pathname,studentsPath]);
 const classes=useMemo(()=>Array.from(new Set(students.map(s=>(s.class||"").trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"ar")),[students]);
 if(pathname!=="/teacher/attendance")return null;

 async function build(){
  if(!selectedClass)return setMsg("اختر الفصل أولًا"); setBusy(true); setMsg("");
  try{
   const dates=range(date,period); const classStudents=students.filter(s=>(s.class||"").trim()===selectedClass).sort((a,b)=>(a.name||"").localeCompare(b.name||"","ar"));
   const snap=await getDocs(collection(db,attendancePath)); const docs=snap.docs.map(d=>d.data()).filter((x:any)=>x.class===selectedClass&&dates.includes(x.date));
   const byDate=new Map<string,Record<string,Status>>(docs.map((x:any)=>[x.date,x.records||{}]));
   return {dates,classStudents,byDate};
  } finally{setBusy(false)}
 }

 async function exportExcel(){const data=await build();if(!data)return;const {dates,classStudents,byDate}=data;
  const rows=classStudents.map((s,i)=>{const base:any={"م":i+1,"اسم الطالب":s.name||""};if(period!=="month")dates.forEach(d=>base[d]=longLabels[byDate.get(d)?.[s.id]||"present"]);else{const c:any={present:0,absent:0,late:0,excused:0,escaped:0};dates.forEach(d=>c[byDate.get(d)?.[s.id]||"present"]++);base["حاضر"]=c.present;base["غائب"]=c.absent;base["متأخر"]=c.late;base["مستأذن"]=c.excused;base["هروب"]=c.escaped}return base});
  const summary=[{"البيان":"اسم البوابة","القيمة":PORTAL},{"البيان":"المعلم","القيمة":teacherName},{"البيان":"المادة","القيمة":subject},{"البيان":"الفصل","القيمة":selectedClass},{"البيان":"الفترة","القيمة":period==="day"?"يومي":period==="week"?"أسبوعي":"شهري"},{"البيان":"من","القيمة":dates[0]},{"البيان":"إلى","القيمة":dates.at(-1)||dates[0]}];
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(summary),"ملخص");XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),"تقرير الحضور");XLSX.writeFile(wb,`تقرير-${period}-${selectedClass}-${date}.xlsx`);setMsg("تم تجهيز ملف Excel")}

 async function printOnePage(){const data=await build();if(!data)return;const {dates,classStudents,byDate}=data;const title=period==="day"?"تقرير حضور يومي":period==="week"?"تقرير حضور أسبوعي":"تقرير حضور شهري";
  const heads=period!=="month"?dates.map(d=>`<th>${d.slice(5)}</th>`).join(""):`<th>حاضر</th><th>غائب</th><th>متأخر</th><th>مستأذن</th><th>هروب</th>`;
  const body=classStudents.map((s,i)=>{let cells="";if(period!=="month")cells=dates.map(d=>`<td>${labels[byDate.get(d)?.[s.id]||"present"]}</td>`).join("");else{const c:any={present:0,absent:0,late:0,excused:0,escaped:0};dates.forEach(d=>c[byDate.get(d)?.[s.id]||"present"]++);cells=`<td>${c.present}</td><td>${c.absent}</td><td>${c.late}</td><td>${c.excused}</td><td>${c.escaped}</td>`}return `<tr><td>${i+1}</td><td class="name">${esc(s.name||"")}</td>${cells}</tr>`}).join("");
  const w=window.open("","_blank","width=1200,height=850");if(!w)return setMsg("اسمح بالنوافذ المنبثقة");w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${title}</title><style>@page{size:A4 landscape;margin:6mm}*{box-sizing:border-box}body{font-family:Arial;margin:0;color:#111}.page{width:285mm;min-height:198mm;padding:5mm;position:relative}.brand{text-align:center;font-weight:900;color:#173f61;border-bottom:2px solid #173f61;padding:4px}h1{text-align:center;font-size:17px;margin:6px}.meta{display:flex;justify-content:space-between;font-size:10px;border:1px solid #333;padding:5px}table{width:100%;border-collapse:collapse;margin-top:5px;table-layout:fixed}th,td{border:1px solid #333;padding:3px;text-align:center;font-size:${period==="month"?"9":"8"}px}.name{text-align:right;width:27%}th{background:#eef3f6}footer{position:absolute;bottom:2mm;right:5mm;left:5mm;border-top:1px solid #555;padding-top:3px;display:flex;justify-content:space-between;font-size:9px}.toolbar{text-align:center;padding:8px;background:#173f61}.toolbar button{padding:8px 18px;font-weight:700}@media print{.toolbar{display:none}.page{width:285mm;height:198mm;overflow:hidden}}</style></head><body><div class="toolbar"><button onclick="print()">طباعة أو حفظ PDF</button></div><section class="page"><div class="brand">${PORTAL}</div><h1>${title}</h1><div class="meta"><span>المعلم: ${esc(teacherName)}</span><span>المادة: ${esc(subject)}</span><span>الفصل: ${esc(selectedClass)}</span><span>الفترة: ${dates[0]} إلى ${dates.at(-1)}</span></div><table><thead><tr><th>م</th><th class="name">اسم الطالب</th>${heads}</tr></thead><tbody>${body}</tbody></table><footer><strong>${PORTAL}</strong><span>صفحة واحدة</span></footer></section></body></html>`);w.document.close()}

 return <section className="attendance-period-report" dir="rtl" style={{margin:"16px auto",width:"min(1200px,calc(100% - 24px))",padding:16,border:"1px solid #d7e0e7",borderRadius:18,background:"#fff"}}><h2 style={{marginTop:0}}>تقرير الحضور للإدارة — صفحة واحدة</h2><div style={{display:"flex",flexWrap:"wrap",gap:10}}><select value={selectedClass} onChange={e=>setSelectedClass(e.target.value)}><option value="">اختر الفصل</option>{classes.map(c=><option key={c}>{c}</option>)}</select><input type="date" value={date} onChange={e=>setDate(e.target.value)}/><select value={period} onChange={e=>setPeriod(e.target.value as Period)}><option value="day">يومي</option><option value="week">أسبوعي</option><option value="month">شهري</option></select><button disabled={busy} onClick={printOnePage}>تقرير صفحة واحدة</button><button disabled={busy} onClick={exportExcel}>تحميل Excel</button></div><small>اليومي يعرض حالة كل طالب، الأسبوعي يعرض أيام الأسبوع، والشهري يعرض إجمالي الحالات لكل طالب.</small>{msg&&<p>{msg}</p>}</section>
}
