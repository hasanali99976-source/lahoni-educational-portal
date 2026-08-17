"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { tenantCollection, type SubjectKey } from "../../../lib/teacher-tenant";
import "./attendance.css";

type AttendanceStatus = "present" | "absent" | "late" | "excused" | "escaped";
type Student = { id: string; name?: string; nationalId?: string; class?: string };
type Session = { authenticated?: boolean; teacherId?: string; teacherName?: string; subjectKey?: SubjectKey; subject?: string };

function toDateInput(date: Date) { const offset=date.getTimezoneOffset(); return new Date(date.getTime()-offset*60000).toISOString().slice(0,10); }
function formatHijri(value:string){return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-arab",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date(`${value}T12:00:00`));}
function safeId(value:string){return encodeURIComponent(value).replace(/%/g,"_");}

export default function AttendancePage(){
 const [students,setStudents]=useState<Student[]>([]),[selectedClass,setSelectedClass]=useState(""),[selectedDate,setSelectedDate]=useState(toDateInput(new Date())),[records,setRecords]=useState<Record<string,AttendanceStatus>>({}),[message,setMessage]=useState(""),[saving,setSaving]=useState(false);
 const [teacherId,setTeacherId]=useState(""),[subjectKey,setSubjectKey]=useState<SubjectKey>("history"),[teacherName,setTeacherName]=useState(""),[subject,setSubject]=useState(""),[ready,setReady]=useState(false);
 const studentsPath=useMemo(()=>teacherId?tenantCollection(teacherId,subjectKey,"students"):"",[teacherId,subjectKey]);
 const attendancePath=useMemo(()=>teacherId?tenantCollection(teacherId,subjectKey,"attendance"):"",[teacherId,subjectKey]);
 useEffect(()=>{fetch("/api/teacher-session",{cache:"no-store"}).then(async r=>{const s=await r.json() as Session;if(!r.ok||!s.authenticated||!s.teacherId||!s.subjectKey)throw new Error();setTeacherId(s.teacherId);setTeacherName(s.teacherName||"");setSubjectKey(s.subjectKey);setSubject(s.subject||"");setReady(true)}).catch(()=>setMessage("انتهت الجلسة. سجّل الدخول من جديد."))},[]);
 useEffect(()=>{if(!ready||!studentsPath)return;return onSnapshot(collection(db,studentsPath),snap=>{const list=snap.docs.map(d=>({id:d.id,...d.data()})) as Student[];list.sort((a,b)=>(a.name||"").localeCompare(b.name||"","ar"));setStudents(list)},()=>setMessage("تعذر تحميل طلاب هذا الحساب"))},[ready,studentsPath]);
 const classes=useMemo(()=>Array.from(new Set(students.map(s=>(s.class||"").trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"ar")),[students]);
 const classStudents=useMemo(()=>students.filter(s=>(s.class||"").trim()===selectedClass),[students,selectedClass]);
 useEffect(()=>{async function load(){if(!selectedClass||!attendancePath){setRecords({});return}const snap=await getDoc(doc(db,attendancePath,`${safeId(selectedClass)}_${selectedDate}`));const saved=(snap.data()?.records||{}) as Record<string,AttendanceStatus>;setRecords(Object.fromEntries(classStudents.map(s=>[s.id,saved[s.id]||"present"])))}load().catch(()=>setMessage("تعذر تحميل التحضير لهذا اليوم"))},[selectedClass,selectedDate,classStudents,attendancePath]);
 const counts=useMemo(()=>{const v=classStudents.map(s=>records[s.id]||"present");return{present:v.filter(x=>x==="present").length,absent:v.filter(x=>x==="absent").length,late:v.filter(x=>x==="late").length,excused:v.filter(x=>x==="excused").length,escaped:v.filter(x=>x==="escaped").length}},[classStudents,records]);
 function moveDay(amount:number){const d=new Date(`${selectedDate}T12:00:00`);d.setDate(d.getDate()+amount);setSelectedDate(toDateInput(d));}
 async function saveAttendance(){if(!selectedClass||!attendancePath)return setMessage("اختر الفصل أولًا");try{setSaving(true);await setDoc(doc(db,attendancePath,`${safeId(selectedClass)}_${selectedDate}`),{class:selectedClass,date:selectedDate,hijriDate:formatHijri(selectedDate),records,teacherId,teacherName,subjectKey,subject,updatedAt:new Date().toISOString()},{merge:true});setMessage("تم حفظ التحضير لهذا الحساب فقط")}catch{setMessage("تعذر حفظ التحضير")}finally{setSaving(false)}}
 if(!ready)return <main className="attendance-page" dir="rtl"><section className="attendance-card"><p>{message||"جارٍ تجهيز بيانات الحساب..."}</p></section></main>;
 const statuses:[AttendanceStatus,string][]=[["present","حاضر"],["absent","غائب"],["late","متأخر"],["excused","مستأذن"],["escaped","هروب"]];
 return <main className="attendance-page" dir="rtl"><section className="attendance-card"><header className="attendance-head"><div><h1>التحضير اليومي — {subject}</h1><p>المعلم: {teacherName}. تظهر هنا فصول وطلاب هذا الحساب فقط.</p></div><div className="hijri-card"><small>التاريخ الهجري</small><strong>{formatHijri(selectedDate)}</strong><div><button onClick={()=>moveDay(-1)}>اليوم السابق</button><button onClick={()=>setSelectedDate(toDateInput(new Date()))}>اليوم</button><button onClick={()=>moveDay(1)}>اليوم التالي</button></div></div></header><div className="attendance-controls"><label>الفصل<select value={selectedClass} onChange={e=>setSelectedClass(e.target.value)}><option value="">اختر الفصل</option>{classes.map(n=><option key={n}>{n}</option>)}</select></label><label>التاريخ<input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)}/></label><button onClick={saveAttendance} disabled={!selectedClass||saving}>{saving?"جارٍ الحفظ...":"حفظ التحضير"}</button></div><div className="attendance-stats"><span className="present">حاضر: {counts.present}</span><span className="absent">غائب: {counts.absent}</span><span>متأخر: {counts.late}</span><span>مستأذن: {counts.excused}</span><span className="escaped">هروب: {counts.escaped}</span></div><div className="attendance-list">{classStudents.map((student,index)=><article key={student.id}><div className="student-info"><b>{index+1}</b><div><strong>{student.name}</strong><small>{student.nationalId}</small></div></div><div className="status-buttons">{statuses.map(([status,label])=><button key={status} className={records[student.id]===status?`active ${status}`:""} onClick={()=>setRecords(c=>({...c,[student.id]:status}))}>{label}</button>)}</div></article>)}{!selectedClass&&<p className="attendance-empty">اختر الفصل لعرض طلاب {subject} فقط.</p>}</div>{message&&<p className="attendance-message">{message}</p>}</section></main>;
}
