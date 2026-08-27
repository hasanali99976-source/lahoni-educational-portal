"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { tenantCollection, type SubjectKey } from "../../../lib/teacher-tenant";
import { useTeacherClient } from "../../../lib/teacher-client";

type AttendanceStatus = "present" | "absent" | "late" | "excused" | "escaped";
type PendingStudent = { id:string; name:string; className:string; code?:string; createdAt?:string };

const STATUS_LABELS: Record<AttendanceStatus,string> = {
  present:"حاضر",
  absent:"غائب",
  late:"متأخر",
  excused:"مستأذن",
  escaped:"هروب",
};

function clean(value:unknown) { return String(value ?? "").replace(/\s+/g," ").trim(); }
function dateValue() { const d = new Date(); const offset = d.getTimezoneOffset(); return new Date(d.getTime() - offset * 60000).toISOString().slice(0,10); }
function safeId(value:string) { return encodeURIComponent(value).replace(/%/g,"_"); }

export default function PendingAttendance() {
  const session = useTeacherClient();
  const teacherId = session?.teacherId || "";
  const teacherName = session?.teacherName || "المعلم";
  const subjectKey = (session?.subjectKey as SubjectKey) || "history";
  const subject = session?.subject || "";
  const studentsStorageKey = useMemo(() => `lahooni-pending-students:${teacherId}:${subjectKey}`, [teacherId,subjectKey]);
  const [students,setStudents] = useState<PendingStudent[]>([]);
  const [selectedClass,setSelectedClass] = useState("");
  const [selectedDate,setSelectedDate] = useState(dateValue());
  const [records,setRecords] = useState<Record<string,AttendanceStatus>>({});
  const [message,setMessage] = useState("");
  const [saving,setSaving] = useState(false);

  useEffect(() => {
    if (!teacherId) return;
    const load = () => {
      try {
        const parsed = JSON.parse(localStorage.getItem(studentsStorageKey) || "[]");
        const list = Array.isArray(parsed) ? parsed.filter(item => item && clean(item.name) && clean(item.className)) : [];
        setStudents(list);
      } catch { setStudents([]); }
    };
    load();
    window.addEventListener("storage",load);
    window.addEventListener("focus",load);
    return () => { window.removeEventListener("storage",load); window.removeEventListener("focus",load); };
  }, [studentsStorageKey,teacherId]);

  const classes = useMemo(() => [...new Set(students.map(item => clean(item.className)))].sort((a,b)=>a.localeCompare(b,"ar")), [students]);
  const classStudents = useMemo(() => students.filter(item => clean(item.className) === selectedClass), [students,selectedClass]);

  useEffect(() => {
    if (!selectedClass && classes.length) setSelectedClass(classes[0]);
    if (selectedClass && !classes.includes(selectedClass)) setSelectedClass(classes[0] || "");
  }, [classes,selectedClass]);

  const attendanceStorageKey = useMemo(() => teacherId && selectedClass ? `lahooni-local-attendance:${teacherId}:${subjectKey}:${selectedClass}:${selectedDate}` : "", [teacherId,subjectKey,selectedClass,selectedDate]);

  useEffect(() => {
    if (!attendanceStorageKey) { setRecords({}); return; }
    try {
      const saved = JSON.parse(localStorage.getItem(attendanceStorageKey) || "{}");
      setRecords(Object.fromEntries(classStudents.map(student => [student.id, saved[student.id] || "present"])));
    } catch {
      setRecords(Object.fromEntries(classStudents.map(student => [student.id,"present"])));
    }
  }, [attendanceStorageKey,classStudents]);

  async function saveAttendance() {
    if (!selectedClass || !classStudents.length) return setMessage("اختر فصلًا يحتوي على أسماء");
    setSaving(true);
    const payload = {
      class:selectedClass,
      date:selectedDate,
      records,
      students:classStudents.map(student => ({ id:student.id, name:student.name, class:student.className })),
      teacherId,
      teacherName,
      subjectKey,
      subject,
      savedLocallyAt:new Date().toISOString(),
    };
    localStorage.setItem(attendanceStorageKey,JSON.stringify(records));
    localStorage.setItem(`${attendanceStorageKey}:details`,JSON.stringify(payload));
    setMessage("تم حفظ التحضير على هذا الجهاز");

    try {
      const attendancePath = tenantCollection(teacherId,subjectKey,"attendance");
      await setDoc(doc(db,attendancePath,`${safeId(selectedClass)}_${selectedDate}_pending`),payload,{merge:true});
      setMessage("تم رفع التحضير إلى البوابة بنجاح");
    } catch {
      setMessage("تم حفظ التحضير على الجهاز، وسيبقى محفوظًا حتى عودة قاعدة البيانات");
    } finally { setSaving(false); }
  }

  if (!students.length) return null;

  const counts = classStudents.reduce((result,student) => {
    const status = records[student.id] || "present";
    result[status] += 1;
    return result;
  },{present:0,absent:0,late:0,excused:0,escaped:0} as Record<AttendanceStatus,number>);

  return <section dir="rtl" style={{marginBottom:18,padding:18,borderRadius:20,border:"2px solid #c7983e",background:"linear-gradient(135deg,#fffdf7,#fff)",boxShadow:"0 12px 30px rgba(0,0,0,.08)"}}>
    <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap",marginBottom:14}}>
      <div><strong style={{fontSize:21}}>تحضير الأسماء المضافة حديثًا</strong><p style={{margin:"5px 0 0",lineHeight:1.7}}>تظهر هنا الأسماء التي أضفتها قبل عودة قاعدة البيانات، ويمكن تحضيرها الآن.</p></div>
      <span style={{padding:"8px 12px",borderRadius:999,background:"#fff3cf",fontWeight:800}}>{classStudents.length} طالب</span>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:10,marginBottom:14}}>
      <label><small style={{display:"block",marginBottom:5}}>الفصل</small><select value={selectedClass} onChange={event=>setSelectedClass(event.target.value)} style={{width:"100%",padding:11,borderRadius:10,border:"1px solid #bbb"}}>{classes.map(item=><option key={item}>{item}</option>)}</select></label>
      <label><small style={{display:"block",marginBottom:5}}>التاريخ</small><input type="date" value={selectedDate} onChange={event=>setSelectedDate(event.target.value)} style={{width:"100%",padding:10,borderRadius:10,border:"1px solid #bbb"}}/></label>
    </div>

    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12,fontWeight:800}}>
      <span>حاضر: {counts.present}</span><span>غائب: {counts.absent}</span><span>متأخر: {counts.late}</span><span>مستأذن: {counts.excused}</span><span>هروب: {counts.escaped}</span>
    </div>

    <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th style={{padding:9,borderBottom:"1px solid #ddd"}}>م</th><th style={{padding:9,borderBottom:"1px solid #ddd",textAlign:"right"}}>اسم الطالب</th><th style={{padding:9,borderBottom:"1px solid #ddd"}}>الحالة</th></tr></thead><tbody>{classStudents.map((student,index)=><tr key={student.id}><td style={{padding:9,borderBottom:"1px solid #eee",textAlign:"center"}}>{index+1}</td><td style={{padding:9,borderBottom:"1px solid #eee",fontWeight:800}}>{student.name}</td><td style={{padding:9,borderBottom:"1px solid #eee"}}><div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"center"}}>{(Object.keys(STATUS_LABELS) as AttendanceStatus[]).map(status=><button type="button" key={status} onClick={()=>setRecords(current=>({...current,[student.id]:status}))} style={{border:records[student.id]===status?"2px solid #173f61":"1px solid #bbb",borderRadius:9,padding:"7px 9px",fontWeight:700,background:records[student.id]===status?"#e7f0f7":"#fff",cursor:"pointer"}}>{STATUS_LABELS[status]}</button>)}</div></td></tr>)}</tbody></table></div>

    <button type="button" disabled={saving} onClick={()=>void saveAttendance()} style={{marginTop:14,width:"100%",border:0,borderRadius:12,padding:13,fontWeight:900,fontSize:16,cursor:"pointer"}}>{saving?"جارٍ الحفظ…":"حفظ التحضير الآن"}</button>
    {message?<p style={{margin:"12px 0 0",fontWeight:800}}>{message}</p>:null}
  </section>;
}
