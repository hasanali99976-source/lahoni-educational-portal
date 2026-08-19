"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { SUBJECT_CONFIG, getSubjectConfig } from "../../../lib/subject-config";
import { useTeacherClient } from "../../../lib/teacher-client";
import "./subjects.css";

type SubjectRecord = { teacherId:string; subjectId:string; subjectName:string; grade:string; classSections?:string[]; imageUrl?:string; isActive:boolean; createdAt:string; updatedAt:string };
const availableSubjects = Object.values(SUBJECT_CONFIG);
const gradeOptions = ["الأول الثانوي", "الثاني الثانوي", "الثالث الثانوي"];

function normalizeSubjectId(value:string){return value.trim().toLowerCase().replace(/[أإآ]/g,"ا").replace(/ة/g,"ه").replace(/ى/g,"ي").replace(/[^a-z0-9\u0600-\u06ff]+/g,"-").replace(/^-+|-+$/g,"")||`subject-${Date.now()}`}
function groupFor(key:string){
  if(["history"].includes(key))return"history";
  if(["geography","social-studies","citizenship"].includes(key))return"earth";
  if(["mathematics","financial-literacy"].includes(key))return"math";
  if(["science","physics","chemistry","biology","earth-science"].includes(key))return"science";
  if(["critical-thinking"].includes(key))return"mind";
  if(["digital-technology","computer-science"].includes(key))return"tech";
  if(["arabic","english"].includes(key))return"language";
  if(["islamic-studies","quran","tafsir","hadith","fiqh","tawhid"].includes(key))return"book";
  if(["art"].includes(key))return"art";
  if(["physical-education","health-education"].includes(key))return"sport";
  return"general";
}
function SubjectArt({subjectKey,compact=false}:{subjectKey:string;compact?:boolean}){
  const group=groupFor(subjectKey);
  return <div className={`subject-art subject-art-${group} ${compact?"compact":""}`} aria-hidden="true">
    <svg viewBox="0 0 220 140" role="img">
      <defs><linearGradient id={`g-${subjectKey}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="currentColor" stopOpacity=".95"/><stop offset="1" stopColor="currentColor" stopOpacity=".35"/></linearGradient></defs>
      <circle className="orbit one" cx="110" cy="70" r="53"/><circle className="orbit two" cx="110" cy="70" r="38"/>
      {group==="history"&&<g><path d="M47 104h126M60 94h100M69 55h82l13 16H56zM72 75v19M94 75v19M116 75v19M138 75v19"/><circle cx="110" cy="42" r="8"/></g>}
      {group==="earth"&&<g><circle cx="110" cy="70" r="42"/><path d="M68 70h84M110 28c18 18 18 66 0 84M110 28c-18 18-18 66 0 84M79 47c20 9 42 9 62 0M79 93c20-9 42-9 62 0"/></g>}
      {group==="math"&&<g className="math-symbols"><text x="45" y="54">π</text><text x="94" y="87">∑</text><text x="145" y="52">√</text><text x="153" y="106">x²</text><path d="M48 107 86 76l29 18 55-55"/></g>}
      {group==="science"&&<g><path d="M91 35h38M100 35v31l-28 45h76l-28-45V35M84 91h52"/><circle className="bubble b1" cx="89" cy="78" r="6"/><circle className="bubble b2" cx="137" cy="57" r="4"/><circle className="bubble b3" cx="122" cy="98" r="5"/></g>}
      {group==="mind"&&<g><path d="M106 38c-18-14-42 1-36 20-15 5-13 28 3 32-4 17 15 27 29 17 8 10 27 5 27-9 17 2 25-20 10-29 9-16-10-34-26-25-1-5-3-8-7-10z"/><path d="M94 48v51M126 50v46M80 67h48M91 84h43"/></g>}
      {group==="tech"&&<g><rect x="58" y="35" width="104" height="68" rx="10"/><path d="M88 116h44M110 103v13M76 55h68M76 73h38M76 88h51"/><circle className="pulse-dot" cx="145" cy="88" r="5"/></g>}
      {group==="language"&&<g><path d="M54 101c27-6 48-29 65-56l16 13c-18 30-38 48-67 60zM120 44l12-18 18 14-16 18"/><path d="M90 102c23-3 43 0 67 9"/></g>}
      {group==="book"&&<g><path d="M48 42h50c13 0 20 8 20 19v54H68c-12 0-20-7-20-18zM172 42h-50c-13 0-20 8-20 19v54h50c12 0 20-7 20-18z"/><path d="M68 61h25M68 76h25M127 61h25M127 76h25"/></g>}
      {group==="art"&&<g><path d="M75 100c-20-26-1-64 34-68 37-4 62 23 56 48-5 19-28 12-31 25-3 11-38 17-59-5z"/><circle cx="92" cy="57" r="7"/><circle cx="118" cy="50" r="7"/><circle cx="141" cy="65" r="7"/><circle cx="94" cy="83" r="7"/><path d="M145 102l28-42"/></g>}
      {group==="sport"&&<g><circle className="ball" cx="110" cy="72" r="39"/><path d="m110 42 18 13-7 21H99l-7-21zM74 63l18-8M146 63l-18-8M84 97l15-21M136 97l-15-21M101 111l-17-14M119 111l17-14"/></g>}
      {group==="general"&&<g><path d="M48 47h124v70H48zM48 47l62 39 62-39M84 117V92h52v25"/><circle cx="110" cy="34" r="8"/></g>}
    </svg>
  </div>
}

export default function TeacherSubjectsPage(){
  const session=useTeacherClient();
  const [subjects,setSubjects]=useState<SubjectRecord[]>([]),[subjectId,setSubjectId]=useState("history"),[subjectName,setSubjectName]=useState(getSubjectConfig("history").label),[grade,setGrade]=useState(""),[editingId,setEditingId]=useState<string|null>(null),[message,setMessage]=useState(""),[saving,setSaving]=useState(false),[search,setSearch]=useState("");
  useEffect(()=>{if(!session?.teacherId)return;return onSnapshot(collection(db,`teachers/${session.teacherId}/subjects`),snap=>setSubjects(snap.docs.map(i=>({subjectId:i.id,...(i.data() as Omit<SubjectRecord,"subjectId">)})).sort((a,b)=>a.subjectName.localeCompare(b.subjectName,"ar"))))},[session?.teacherId]);
  const activeCount=useMemo(()=>subjects.filter(i=>i.isActive!==false).length,[subjects]);
  const filtered=useMemo(()=>availableSubjects.filter(i=>i.label.includes(search.trim())),[search]);
  function resetForm(){setSubjectId("history");setSubjectName(getSubjectConfig("history").label);setGrade("");setEditingId(null)}
  function choosePreset(value:string){setSubjectId(value);setSubjectName(value==="custom"?"":getSubjectConfig(value).label)}
  async function saveSubject(e:FormEvent){e.preventDefault();if(!session?.teacherId)return;const name=subjectName.trim(),finalId=editingId||normalizeSubjectId(subjectId==="custom"?name:subjectId||name);if(!name)return setMessage("اختر المادة.");if(!grade)return setMessage("اختر الصف.");setSaving(true);setMessage("");try{const existing=subjects.find(i=>i.subjectId===finalId),now=new Date().toISOString();await setDoc(doc(db,`teachers/${session.teacherId}/subjects`,finalId),{teacherId:session.teacherId,subjectId:finalId,subjectName:name,grade,classSections:[],isActive:existing?.isActive??true,createdAt:existing?.createdAt||now,updatedAt:now},{merge:true});setMessage(editingId?"تم تحديث المادة.":"تمت إضافة المادة.");resetForm();await session.refresh?.()}catch{setMessage("تعذر الحفظ الآن.")}finally{setSaving(false)}}
  function editSubject(item:SubjectRecord){setEditingId(item.subjectId);setSubjectId(item.subjectId);setSubjectName(item.subjectName);setGrade(item.grade||"");window.scrollTo({top:0,behavior:"smooth"})}
  async function toggleSubject(item:SubjectRecord){if(!session?.teacherId)return;const next=item.isActive===false;await setDoc(doc(db,`teachers/${session.teacherId}/subjects`,item.subjectId),{isActive:next,updatedAt:new Date().toISOString()},{merge:true});setMessage(next?"تم تفعيل المادة.":"تم إخفاء المادة.");await session.refresh?.()}
  async function openSubject(item:SubjectRecord){if(item.isActive===false)return setMessage("فعّل المادة أولًا.");await session.setSubject?.(item.subjectId);setMessage(`تم فتح ${item.subjectName}.`)}
  async function removeSubject(item:SubjectRecord){if(!session?.teacherId||!window.confirm(`حذف مادة «${item.subjectName}» من قائمتك؟`))return;await deleteDoc(doc(db,`teachers/${session.teacherId}/subjects`,item.subjectId));setMessage("تم حذف المادة من القائمة.");if(editingId===item.subjectId)resetForm();await session.refresh?.()}

  return <main className="subjects-page" dir="rtl">
    <section className="subjects-hero"><div><span>مركز المواد</span><h1>اختر مادّتك بصريًا</h1><p>كل مادة لها مشهد تعليمي وحركة وهوية مستقلة. اختر المادة ثم الصف وأضفها إلى بوابتك.</p></div><div className="subjects-summary"><b>{subjects.length}</b><small>إجمالي المواد</small><b>{activeCount}</b><small>مواد مفعلة</small></div></section>

    <section className="subject-picker-card">
      <header><div><h2>{editingId?"تعديل المادة":"إضافة مادة جديدة"}</h2><p>اضغط على بطاقة المادة بدل القائمة التقليدية.</p></div>{editingId&&<button onClick={resetForm}>إلغاء</button>}</header>
      {!editingId&&<><div className="subject-search"><span>⌕</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث عن المادة..."/></div><div className="subject-picker-grid">{filtered.map(item=><button type="button" key={item.key} data-group={groupFor(item.key)} className={subjectId===item.key?"selected":""} onClick={()=>choosePreset(item.key)}><SubjectArt subjectKey={item.key} compact/><strong>{item.label}</strong><small>{item.welcomePoints[0]}</small><i>✓</i></button>)}</div></>}
      <form onSubmit={saveSubject}>
        {subjectId==="custom"&&<div><label>اسم المادة</label><input value={subjectName} onChange={e=>setSubjectName(e.target.value)} placeholder="اكتب اسم المادة"/></div>}
        <div className="grade-step"><label>اختر الصف الدراسي</label><div className="grade-options">{gradeOptions.map(item=><button type="button" key={item} className={grade===item?"selected":""} onClick={()=>setGrade(item)}>{item}</button>)}</div></div>
        <div className="chosen-preview"><SubjectArt subjectKey={subjectId}/><div><small>المادة المختارة</small><h3>{subjectName}</h3><p>{grade||"اختر الصف لإكمال الإضافة"}</p></div></div>
        {message&&<p className="subject-message">{message}</p>}
        <button className="save-subject" disabled={saving}>{saving?"جارٍ الحفظ...":editingId?"حفظ التعديل":"إضافة المادة إلى بوابتي"}</button>
      </form>
    </section>

    <section className="subjects-list"><header><div><h2>موادي</h2><p>بطاقات تعليمية واضحة؛ اضغط «فتح المادة» لتتغير هوية البوابة كاملة.</p></div></header>
      {!subjects.length&&<div className="empty-subjects"><span>📚</span><h3>لا توجد مواد مضافة</h3><p>اختر بطاقة مادة من الأعلى ثم حدد الصف.</p></div>}
      <div className="subjects-grid">{subjects.map(item=><article key={item.subjectId} data-group={groupFor(item.subjectId)} className={item.isActive===false?"inactive":""}>
        <div className="subject-cover"><SubjectArt subjectKey={item.subjectId}/><span className="subject-state">{item.isActive===false?"مخفية":"مفعلة"}</span></div>
        <div className="subject-info"><h3>{item.subjectName}</h3><p>{item.grade||"لم يحدد الصف"}</p><small>{getSubjectConfig(item.subjectId).welcomePoints.join(" • ")}</small></div>
        <div className="subject-actions"><button onClick={()=>openSubject(item)}>فتح المادة</button><button onClick={()=>editSubject(item)}>تعديل</button><button onClick={()=>toggleSubject(item)}>{item.isActive===false?"تفعيل":"إخفاء"}</button><button className="danger" onClick={()=>removeSubject(item)}>حذف</button></div>
      </article>)}</div>
    </section>
  </main>
}
