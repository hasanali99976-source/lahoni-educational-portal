"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import "../grades/register.css";

type Student = { id: string; name?: string; nationalId?: string; class?: string; researchScore?: number };

export default function ResearchPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [scores, setScores] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => onSnapshot(collection(db, "students"), snapshot => { const list = snapshot.docs.map(item => ({ id: item.id, ...item.data() })) as Student[]; list.sort((a,b)=>(a.name||"").localeCompare(b.name||"","ar")); setStudents(list); }), []);
  const classes = useMemo(() => Array.from(new Set(students.map(s=>(s.class||"").trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"ar")), [students]);
  const classStudents = useMemo(() => students.filter(s=>(s.class||"").trim()===selectedClass), [students,selectedClass]);
  useEffect(() => { setScores(Object.fromEntries(classStudents.map(student=>[student.id,Number(student.researchScore||0)]))); }, [classStudents]);
  function updateScore(studentId:string,raw:string){ const value=Math.max(0,Math.min(5,Number(raw)||0)); setScores(current=>({...current,[studentId]:value})); }
  function applyAll(){ setScores(Object.fromEntries(classStudents.map(student=>[student.id,5]))); }
  async function save(){ if(!selectedClass)return setMessage("اختر الفصل أولًا"); try{setSaving(true);setMessage("");await Promise.all(classStudents.map(student=>updateDoc(doc(db,"students",student.id),{researchScore:Number(scores[student.id]||0),researchUpdatedAt:new Date().toISOString()})));setMessage("تم حفظ درجات البحث بنجاح");}catch(error){console.error(error);setMessage("تعذر حفظ درجات البحث")}finally{setSaving(false)} }
  async function clearAll(){ if(!selectedClass)return setMessage("اختر الفصل أولًا");if(!window.confirm(`هل تريد حذف جميع درجات البحث للفصل ${selectedClass}؟`))return;try{setSaving(true);setScores(Object.fromEntries(classStudents.map(student=>[student.id,0])));await Promise.all(classStudents.map(student=>updateDoc(doc(db,"students",student.id),{researchScore:0,researchUpdatedAt:new Date().toISOString()})));setMessage("تم حذف جميع درجات البحث")}catch(error){console.error(error);setMessage("تعذر حذف درجات البحث")}finally{setSaving(false)} }
  return <main className="gradebook-page research-page" dir="rtl"><div className="gradebook-wrap"><section className="gradebook-card">
    <style>{`.research-page .research-mobile-list{display:none!important}.research-page .research-desktop-table{display:block!important}.research-page .gradebook-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}.research-page .research-table{min-width:760px}`}</style>
    <header className="gradebook-head"><div><h1>رصد البحث</h1><p>درجة البحث من ٥ درجات، وتُرصد مرة واحدة فقط طوال الفصل الدراسي.</p></div><div className="gradebook-actions"><label>الفصل<select value={selectedClass} onChange={e=>setSelectedClass(e.target.value)}><option value="">اختر الفصل</option>{classes.map(name=><option key={name}>{name}</option>)}</select></label><Link href="/teacher/grades" className="research-link">← رصد الوحدات</Link><button type="button" className="save-button" onClick={applyAll} disabled={!selectedClass}>✓ تطبيق ٥ على الجميع</button><button type="button" className="save-button" onClick={save} disabled={!selectedClass||saving}>{saving?"جارٍ الحفظ...":"💾 حفظ"}</button><button type="button" className="delete-all-button" onClick={clearAll} disabled={!selectedClass||saving}>🗑 حذف الكل</button></div></header>
    <div className="gradebook-scroll research-desktop-table"><table className="gradebook-table research-table"><thead><tr><th className="sticky-number">م</th><th className="national-id-head">السجل المدني</th><th className="sticky-name">اسم الطالب</th><th className="exam-head"><span>البحث</span><small>من ٥</small></th></tr></thead><tbody>{classStudents.map((student,index)=><tr key={student.id}><td className="sticky-number">{index+1}</td><td className="national-id-cell">{student.nationalId}</td><td className="sticky-name"><strong>{student.name}</strong></td><td className="exam-cell"><input className="grade-input" type="number" inputMode="numeric" min="0" max="5" step="1" value={scores[student.id]||0} onChange={e=>updateScore(student.id,e.target.value)} onFocus={e=>e.currentTarget.select()}/></td></tr>)}{!selectedClass&&<tr><td colSpan={4} className="empty-row">اختر الفصل لعرض الطلاب</td></tr>}</tbody></table></div>
    <footer className="gradebook-footer"><span>البحث يُضاف تلقائيًا إلى مجموع الطالب النهائي</span><span>الدرجة القصوى: ٥</span><span>عدد الطلاب: {classStudents.length}</span></footer>{message&&<p className="gradebook-message">{message}</p>}
  </section></div></main>;
}
