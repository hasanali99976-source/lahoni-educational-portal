"use client";

import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type Student = { id:string; name?:string; nationalId?:string; class?:string; attendance?:number; homework?:number; participation?:number; research?:number; tests?:number[] };

export default function GradesPage(){
  const [students,setStudents]=useState<Student[]>([]);
  const [selected,setSelected]=useState("");
  const [form,setForm]=useState({attendance:0,homework:0,participation:0,research:0,tests:[0,0,0,0,0]});
  const [message,setMessage]=useState("");

  useEffect(()=>onSnapshot(collection(db,"students"),snap=>setStudents(snap.docs.map(d=>({id:d.id,...d.data()})) as Student[])),[]);

  function choose(id:string){
    setSelected(id); const s=students.find(x=>x.id===id);
    if(s) setForm({attendance:s.attendance||0,homework:s.homework||0,participation:s.participation||0,research:s.research||0,tests:Array.isArray(s.tests)?[...s.tests,0,0,0,0,0].slice(0,5):[0,0,0,0,0]});
  }

  const total=form.attendance+form.homework+form.participation+form.research+form.tests.reduce((a,b)=>a+b,0);

  async function save(){
    if(!selected){setMessage("اختر طالبًا أولًا");return;}
    await updateDoc(doc(db,"students",selected),{...form,total,percentage:Math.min(100,total)});
    setMessage("تم حفظ الدرجات");
  }

  return <main className="shell dashboard"><div className="container"><section className="card">
    <h1>رصد الدرجات</h1>
    <select className="field" value={selected} onChange={e=>choose(e.target.value)}><option value="">اختر الطالب</option>{students.map(s=><option key={s.id} value={s.id}>{s.name} — {s.class}</option>)}</select>
    <div className="grade-grid">
      {([['attendance','الحضور'],['homework','الواجبات'],['participation','المشاركة'],['research','البحث']] as const).map(([key,label])=><label key={key}>{label}<input className="field" type="number" min="0" value={form[key]} onChange={e=>setForm({...form,[key]:Number(e.target.value)})}/></label>)}
      {form.tests.map((value,index)=><label key={index}>اختبار الوحدة {index+1}<input className="field" type="number" min="0" value={value} onChange={e=>{const tests=[...form.tests];tests[index]=Number(e.target.value);setForm({...form,tests});}}/></label>)}
    </div>
    <div className="summary-box"><strong>المجموع: {total}</strong><span>النسبة: {Math.min(100,total)}%</span></div>
    <button className="btn primary" onClick={save}>حفظ الدرجات</button>{message&&<p className="notice">{message}</p>}
  </section></div></main>
}
