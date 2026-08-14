"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type Student={id:string;name?:string;class?:string;nationalId?:string;total?:number;percentage?:number};

export default function ReportsPage(){
  const [students,setStudents]=useState<Student[]>([]);
  const [selected,setSelected]=useState("");
  useEffect(()=>onSnapshot(collection(db,"students"),snap=>setStudents(snap.docs.map(d=>({id:d.id,...d.data()})) as Student[])),[]);
  const values=students.map(s=>Number(s.percentage??s.total??0));
  const average=values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length):0;
  const highest=values.length?Math.max(...values):0;
  const distribution=useMemo(()=>[
    {label:"ممتاز",count:values.filter(v=>v>=90).length},
    {label:"جيد جدًا",count:values.filter(v=>v>=80&&v<90).length},
    {label:"جيد",count:values.filter(v=>v>=70&&v<80).length},
    {label:"مقبول",count:values.filter(v=>v>=60&&v<70).length},
    {label:"أقل من 60",count:values.filter(v=>v<60).length},
  ],[students]);
  const student=students.find(s=>s.id===selected);
  return <main className="shell dashboard"><div className="container">
    <section className="cards report-cards"><div className="card"><h3>عدد الطلاب</h3><strong>{students.length}</strong></div><div className="card"><h3>متوسط الدرجات</h3><strong>{average}%</strong></div><div className="card"><h3>أعلى درجة</h3><strong>{highest}%</strong></div></section>
    <section className="card" style={{marginTop:18}}><h1>توزيع الدرجات</h1>{distribution.map(item=><div className="distribution-row" key={item.label}><span>{item.label}</span><div className="bar"><i style={{width:`${students.length?item.count/students.length*100:0}%`}}/></div><strong>{item.count}</strong></div>)}</section>
    <section className="card" style={{marginTop:18}}><h2>ملخص طالب</h2><select className="field" value={selected} onChange={e=>setSelected(e.target.value)}><option value="">اختر الطالب</option>{students.map(s=><option key={s.id} value={s.id}>{s.name} — {s.class}</option>)}</select>{student&&<div className="student-summary"><p><b>الاسم:</b> {student.name}</p><p><b>الهوية:</b> {student.nationalId}</p><p><b>الفصل:</b> {student.class}</p><p><b>النسبة:</b> {student.percentage??student.total??0}%</p></div>}<button className="btn secondary" onClick={()=>window.print()}>طباعة التقرير</button></section>
  </div></main>
}
