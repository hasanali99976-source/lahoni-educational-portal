"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type UnitGrade = { participation:number; research:number; test:number };
type Student = { id:string; name?:string; nationalId?:string; class?:string; units?:Record<string,UnitGrade> };
type AttendanceStatus = "present" | "absent" | "late" | "excused";

const units = [
  ["unit1","الوحدة الأولى"],
  ["unit2","الوحدة الثانية"],
  ["unit3","الوحدة الثالثة"],
  ["unit4","الوحدة الرابعة"],
  ["unit5","الوحدة الخامسة"],
] as const;

const emptyGrade:UnitGrade = { participation:0, research:0, test:0 };
const today = new Date().toISOString().slice(0,10);
const safeId = (value:string) => encodeURIComponent(value).replace(/%/g,"_");

export default function GradesPage(){
  const [students,setStudents]=useState<Student[]>([]);
  const [selectedClass,setSelectedClass]=useState("");
  const [selectedUnit,setSelectedUnit]=useState("unit1");
  const [date,setDate]=useState(today);
  const [attendance,setAttendance]=useState<Record<string,AttendanceStatus>>({});
  const [grades,setGrades]=useState<Record<string,UnitGrade>>({});
  const [maxGrades,setMaxGrades]=useState<UnitGrade>({participation:5,research:5,test:10});
  const [savingAttendance,setSavingAttendance]=useState(false);
  const [savingGrades,setSavingGrades]=useState(false);
  const [message,setMessage]=useState("");

  useEffect(()=>onSnapshot(collection(db,"students"),snap=>{
    const list=snap.docs.map(d=>({id:d.id,...d.data()})) as Student[];
    list.sort((a,b)=>(a.name||"").localeCompare(b.name||"","ar"));
    setStudents(list);
  }),[]);

  const classes=useMemo(()=>Array.from(new Set(students.map(s=>(s.class||"").trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"ar")),[students]);
  const classStudents=useMemo(()=>students.filter(s=>(s.class||"").trim()===selectedClass),[students,selectedClass]);

  useEffect(()=>{
    const next:Record<string,UnitGrade>={};
    classStudents.forEach(student=>{ next[student.id]={...emptyGrade,...(student.units?.[selectedUnit]||{})}; });
    setGrades(next);
  },[classStudents,selectedUnit]);

  useEffect(()=>{
    async function loadAttendance(){
      if(!selectedClass||!date){setAttendance({});return;}
      const ref=doc(db,"attendance",`${safeId(selectedClass)}_${date}`);
      const snap=await getDoc(ref);
      const saved=(snap.data()?.records||{}) as Record<string,AttendanceStatus>;
      const next:Record<string,AttendanceStatus>={};
      classStudents.forEach(student=>{next[student.id]=saved[student.id]||"present";});
      setAttendance(next);
    }
    loadAttendance().catch(()=>setMessage("تعذر تحميل تحضير هذا اليوم"));
  },[selectedClass,date,classStudents]);

  function setAllAttendance(status:AttendanceStatus){
    const next:Record<string,AttendanceStatus>={};
    classStudents.forEach(student=>{next[student.id]=status;});
    setAttendance(next);
  }

  async function saveAttendance(){
    if(!selectedClass){setMessage("اختر الفصل أولًا");return;}
    try{
      setSavingAttendance(true);setMessage("");
      await setDoc(doc(db,"attendance",`${safeId(selectedClass)}_${date}`),{
        class:selectedClass,date,records:attendance,updatedAt:new Date().toISOString()
      },{merge:true});
      setMessage(`تم حفظ تحضير ${selectedClass} ليوم ${date}`);
    }catch{setMessage("تعذر حفظ التحضير");}
    finally{setSavingAttendance(false);}
  }

  function setGrade(studentId:string,key:keyof UnitGrade,raw:string){
    const parsed=Number(raw); const value=Number.isFinite(parsed)?Math.max(0,Math.min(maxGrades[key],parsed)):0;
    setGrades(current=>({...current,[studentId]:{...(current[studentId]||emptyGrade),[key]:value}}));
  }

  function setMaximum(key:keyof UnitGrade,raw:string){
    const parsed=Number(raw); const value=Number.isFinite(parsed)?Math.max(0,parsed):0;
    setMaxGrades(current=>({...current,[key]:value}));
  }

  function fillColumn(key:keyof UnitGrade){
    setGrades(current=>{
      const next={...current};
      classStudents.forEach(student=>{next[student.id]={...(next[student.id]||emptyGrade),[key]:maxGrades[key]};});
      return next;
    });
  }

  const maxTotal=maxGrades.participation+maxGrades.research+maxGrades.test;

  async function saveGrades(){
    if(!selectedClass){setMessage("اختر الفصل أولًا");return;}
    try{
      setSavingGrades(true);setMessage("");
      await Promise.all(classStudents.map(student=>{
        const grade=grades[student.id]||emptyGrade;
        const total=grade.participation+grade.research+grade.test;
        const percentage=maxTotal?Math.round((total/maxTotal)*1000)/10:0;
        return updateDoc(doc(db,"students",student.id),{
          [`units.${selectedUnit}`]:{...grade,total,maximumTotal:maxTotal,percentage,maxGrades}
        });
      }));
      setMessage("تم حفظ درجات الفصل");
    }catch{setMessage("تعذر حفظ الدرجات");}
    finally{setSavingGrades(false);}
  }

  return <main className="shell dashboard"><div className="container">
    <section className="card compact-card">
      <h1>التحضير ورصد الدرجات</h1>
      <div className="compact-controls">
        <label>الفصل<select className="compact-field" value={selectedClass} onChange={e=>setSelectedClass(e.target.value)}><option value="">اختر الفصل</option>{classes.map(c=><option key={c}>{c}</option>)}</select></label>
        <label>الوحدة<select className="compact-field" value={selectedUnit} onChange={e=>setSelectedUnit(e.target.value)}>{units.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
        <label>التاريخ<input className="compact-field" type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
        <div className="compact-stat">عدد الطلاب: <strong>{classStudents.length}</strong></div>
      </div>
      {message&&<p className="notice">{message}</p>}
    </section>

    <section className="card compact-card" style={{marginTop:14}}>
      <div className="section-head"><div><h2>التحضير اليومي</h2><p>كل تاريخ يُحفظ مستقلاً ويمكن الرجوع إليه لاحقًا.</p></div><div className="quick-actions"><button className="tiny-btn" onClick={()=>setAllAttendance("present")}>حاضر للجميع</button><button className="tiny-btn" onClick={()=>setAllAttendance("absent")}>غائب للجميع</button></div></div>
      <div className="table-wrap"><table className="compact-table"><thead><tr><th>#</th><th>اسم الطالب</th><th>حالة اليوم</th></tr></thead><tbody>
        {classStudents.map((student,index)=><tr key={student.id}><td>{index+1}</td><td>{student.name}</td><td><select className="status-select" value={attendance[student.id]||"present"} onChange={e=>setAttendance(current=>({...current,[student.id]:e.target.value as AttendanceStatus}))}><option value="present">حاضر</option><option value="absent">غائب</option><option value="late">متأخر</option><option value="excused">مستأذن</option></select></td></tr>)}
        {!selectedClass&&<tr><td colSpan={3}>اختر الفصل لعرض الطلاب</td></tr>}
      </tbody></table></div>
      <button className="btn primary compact-save" onClick={saveAttendance} disabled={!selectedClass||savingAttendance}>{savingAttendance?"جارٍ حفظ التحضير...":"حفظ تحضير اليوم"}</button>
    </section>

    <section className="card compact-card" style={{marginTop:14}}>
      <div className="section-head"><div><h2>رصد الدرجات</h2><p>أعلى درجة موجودة في رأس كل عمود ويمكن تعديلها.</p></div><strong>المجموع الأعلى: {maxTotal}</strong></div>
      <div className="table-wrap"><table className="compact-table grades-table"><thead><tr><th>#</th><th>اسم الطالب</th>
        {([['participation','المشاركة'],['research','البحث'],['test','الاختبار']] as const).map(([key,label])=><th key={key}><span>{label}</span><div className="header-grade"><input type="number" min="0" value={maxGrades[key]} onChange={e=>setMaximum(key,e.target.value)}/><button title="تطبيق الدرجة الكاملة على الجميع" onClick={()=>fillColumn(key)}>✓</button></div></th>)}
        <th>المجموع</th><th>النسبة</th></tr></thead><tbody>
        {classStudents.map((student,index)=>{const grade=grades[student.id]||emptyGrade;const total=grade.participation+grade.research+grade.test;const pct=maxTotal?Math.round((total/maxTotal)*1000)/10:0;return <tr key={student.id}><td>{index+1}</td><td>{student.name}</td>{(['participation','research','test'] as const).map(key=><td key={key}><input className="mini-grade" type="number" min="0" max={maxGrades[key]} value={grade[key]} onChange={e=>setGrade(student.id,key,e.target.value)}/></td>)}<td><strong>{total}</strong></td><td>{pct}%</td></tr>})}
        {!selectedClass&&<tr><td colSpan={7}>اختر الفصل لعرض الطلاب</td></tr>}
      </tbody></table></div>
      <button className="btn primary compact-save" onClick={saveGrades} disabled={!selectedClass||savingGrades}>{savingGrades?"جارٍ حفظ الدرجات...":"حفظ درجات الفصل"}</button>
    </section>
  </div></main>;
}
