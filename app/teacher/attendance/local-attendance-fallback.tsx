"use client";

import { useEffect, useMemo, useState } from "react";
import { useTeacherClient } from "../../../lib/teacher-client";

type Status = "present" | "absent" | "late" | "excused" | "escaped";
type PendingStudent = { id: string; name: string; className: string };

const labels: Record<Status,string> = { present:"حاضر", absent:"غائب", late:"متأخر", excused:"مستأذن", escaped:"هروب" };
const today = () => new Date().toISOString().slice(0,10);

export default function LocalAttendanceFallback() {
  const session = useTeacherClient();
  const teacherId = session?.teacherId || "";
  const subjectKey = session?.subjectKey || "history";
  const studentsKey = `lahooni-pending-students:${teacherId}:${subjectKey}`;
  const [students,setStudents] = useState<PendingStudent[]>([]);
  const [selectedClass,setSelectedClass] = useState("");
  const [records,setRecords] = useState<Record<string,Status>>({});
  const [saved,setSaved] = useState(false);

  useEffect(() => {
    if (!teacherId) return;
    const load = () => {
      try {
        const value = JSON.parse(localStorage.getItem(studentsKey) || "[]");
        setStudents(Array.isArray(value) ? value : []);
      } catch { setStudents([]); }
    };
    load();
    window.addEventListener("storage", load);
    window.addEventListener("focus", load);
    return () => { window.removeEventListener("storage", load); window.removeEventListener("focus", load); };
  }, [studentsKey, teacherId]);

  const classes = useMemo(() => [...new Set(students.map(s=>s.className).filter(Boolean))], [students]);
  const visible = useMemo(() => students.filter(s=>s.className===selectedClass), [students,selectedClass]);

  useEffect(() => {
    if (!selectedClass) return;
    const key = `lahooni-local-attendance:${teacherId}:${subjectKey}:${selectedClass}:${today()}`;
    try { setRecords(JSON.parse(localStorage.getItem(key) || "{}")); } catch { setRecords({}); }
  }, [selectedClass,teacherId,subjectKey]);

  function saveLocal() {
    if (!selectedClass) return;
    const key = `lahooni-local-attendance:${teacherId}:${subjectKey}:${selectedClass}:${today()}`;
    localStorage.setItem(key, JSON.stringify(records));
    setSaved(true);
  }

  if (!students.length) return null;

  return <section dir="rtl" style={{margin:"0 0 18px",padding:18,border:"2px solid #d6a84b",borderRadius:18,background:"#fffaf0"}}>
    <h2 style={{marginTop:0}}>تحضير الأسماء المضافة الآن</h2>
    <p>هذه الأسماء محفوظة في جهازك وتقدر تحضّرها مباشرة حتى قبل رجوع قاعدة البيانات.</p>
    <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center",marginBottom:14}}>
      <select value={selectedClass} onChange={e=>setSelectedClass(e.target.value)} style={{padding:10,borderRadius:10,minWidth:220}}>
        <option value="">اختر الفصل</option>
        {classes.map(c=><option key={c}>{c}</option>)}
      </select>
      <button type="button" onClick={saveLocal} disabled={!selectedClass} style={{padding:"10px 16px",border:0,borderRadius:10,fontWeight:800}}>حفظ التحضير في الجهاز</button>
      {saved ? <strong>تم الحفظ</strong> : null}
    </div>
    {visible.map((student,index)=><article key={student.id} style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",padding:"12px 0",borderTop:"1px solid #ead8b1",flexWrap:"wrap"}}>
      <strong>{index+1}. {student.name}</strong>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{(Object.keys(labels) as Status[]).map(status=><button type="button" key={status} onClick={()=>setRecords(current=>({...current,[student.id]:status}))} style={{padding:"8px 11px",borderRadius:9,border:records[student.id]===status?"2px solid #8a5b00":"1px solid #ccc",fontWeight:700}}>{labels[status]}</button>)}</div>
    </article>)}
  </section>;
}
