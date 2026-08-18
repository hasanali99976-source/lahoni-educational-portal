"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { getSubjectConfig, type SubjectKey } from "../../../lib/subject-config";
import { tenantCollection } from "../../../lib/teacher-tenant";
import "./timetable.css";

type Session={authenticated?:boolean;teacherId?:string;teacherName?:string;subjectKey?:SubjectKey};
type SavedClass={name?:string};
type Lesson={subject:string;className:string;notes:string};
type Schedule=Record<string,Lesson>;

const days=[
 {key:"sunday",label:"الأحد"},
 {key:"monday",label:"الإثنين"},
 {key:"tuesday",label:"الثلاثاء"},
 {key:"wednesday",label:"الأربعاء"},
 {key:"thursday",label:"الخميس"},
] as const;
const periods=Array.from({length:7},(_,index)=>index+1);
const emptyLesson=():Lesson=>({subject:"",className:"",notes:""});
const ar=new Intl.NumberFormat("ar-SA-u-nu-arab");
const keyFor=(day:string,period:number)=>`${day}-${period}`;

export default function TimetablePage(){
 const[session,setSession]=useState<Session|null>(null),[classes,setClasses]=useState<string[]>([]),[schedule,setSchedule]=useState<Schedule>({});
 const[selected,setSelected]=useState<{day:string;period:number}|null>(null),[draft,setDraft]=useState<Lesson>(emptyLesson()),[message,setMessage]=useState(""),[saving,setSaving]=useState(false);
 const teacherId=session?.teacherId||"",subjectKey=session?.subjectKey||"history";
 const subject=getSubjectConfig(subjectKey);
 const classesPath=useMemo(()=>teacherId?tenantCollection(teacherId,subjectKey,"classes"):"",[teacherId,subjectKey]);
 const timetablePath=useMemo(()=>teacherId?tenantCollection(teacherId,subjectKey,"timetable"):"",[teacherId,subjectKey]);

 useEffect(()=>{fetch("/api/teacher-session",{cache:"no-store"}).then(async response=>{const value=await response.json() as Session;if(!response.ok||!value.authenticated||!value.teacherId||!value.subjectKey)throw new Error();setSession(value)}).catch(()=>setMessage("انتهت الجلسة. سجّل الدخول من جديد."))},[]);
 useEffect(()=>{if(!classesPath||!timetablePath)return;const stopClasses=onSnapshot(collection(db,classesPath),snapshot=>{const names=snapshot.docs.map(item=>String((item.data() as SavedClass).name||"").trim()).filter(Boolean);setClasses([...new Set(names)].sort((a,b)=>a.localeCompare(b,"ar",{numeric:true,sensitivity:"base"})))});const stopTable=onSnapshot(doc(db,timetablePath,"weekly"),snapshot=>{const data=snapshot.data() as {lessons?:Schedule}|undefined;setSchedule(data?.lessons||{})});return()=>{stopClasses();stopTable()}},[classesPath,timetablePath]);

 const smart=useMemo(()=>{
  const dayLoads=days.map(day=>({day:day.label,key:day.key,count:periods.filter(period=>schedule[keyFor(day.key,period)]).length}));
  const total=dayLoads.reduce((sum,item)=>sum+item.count,0);
  const empty=35-total;
  const busiest=[...dayLoads].sort((a,b)=>b.count-a.count)[0];
  const quietest=[...dayLoads].sort((a,b)=>a.count-b.count)[0];
  const classCounts=new Map<string,number>();
  Object.values(schedule).forEach(lesson=>{if(lesson.className)classCounts.set(lesson.className,(classCounts.get(lesson.className)||0)+1)});
  const mostClass=[...classCounts.entries()].sort((a,b)=>b[1]-a[1])[0];
  const imbalance=busiest&&quietest?busiest.count-quietest.count:0;
  const suggestion=total===0?"ابدأ بإضافة أول حصة، وسيحلل المساعد توزيع أسبوعك تلقائيًا.":imbalance>=3?`توزيعك غير متوازن قليلًا؛ ${busiest.day} مزدحم أكثر من ${quietest.day}.`:empty>10?`باقي ${ar.format(empty)} خانة فارغة. يمكنك إكمالها تدريجيًا بدون ضغط.`:"جدولك متوازن ومكتمل بدرجة جيدة.";
  return{total,empty,busiest,quietest,mostClass,imbalance,suggestion};
 },[schedule]);

 function openCell(day:string,period:number){const current=schedule[keyFor(day,period)]||emptyLesson();setSelected({day,period});setDraft({...current,subject:current.subject||subject.label});setMessage("")}
 function closeEditor(){setSelected(null);setDraft(emptyLesson())}
 async function saveLesson(){if(!selected||!timetablePath)return;if(!draft.subject.trim()||!draft.className.trim())return setMessage("اختر المادة والفصل قبل الحفظ.");const cellKey=keyFor(selected.day,selected.period),next={...schedule,[cellKey]:{subject:draft.subject.trim(),className:draft.className.trim(),notes:draft.notes.trim()}};try{setSaving(true);await setDoc(doc(db,timetablePath,"weekly"),{lessons:next,teacherId,teacherName:session?.teacherName||"",subjectKey,updatedAt:new Date().toISOString()},{merge:true});setSchedule(next);setMessage("تم حفظ الحصة");closeEditor()}catch{setMessage("تعذر حفظ الحصة")}finally{setSaving(false)}}
 async function clearLesson(){if(!selected||!timetablePath)return;const next={...schedule};delete next[keyFor(selected.day,selected.period)];try{setSaving(true);await setDoc(doc(db,timetablePath,"weekly"),{lessons:next,teacherId,teacherName:session?.teacherName||"",subjectKey,updatedAt:new Date().toISOString()},{merge:true});setSchedule(next);setMessage("تم حذف الحصة");closeEditor()}catch{setMessage("تعذر حذف الحصة")}finally{setSaving(false)}}
 async function clearAll(){if(!timetablePath||!window.confirm("سيتم حذف جميع حصص الجدول الأسبوعي. هل أنت متأكد؟"))return;try{setSaving(true);await setDoc(doc(db,timetablePath,"weekly"),{lessons:{},teacherId,teacherName:session?.teacherName||"",subjectKey,updatedAt:new Date().toISOString()},{merge:true});setSchedule({});setMessage("تم تفريغ الجدول بالكامل")}catch{setMessage("تعذر تفريغ الجدول")}finally{setSaving(false)}}

 if(!session)return <main className="timetable-page"><section className="timetable-hero"><h1>الجدول الدراسي</h1><p>{message||"جارٍ تحميل الجدول..."}</p></section></main>;
 return <main className="timetable-page" dir="rtl">
  <section className="timetable-hero"><div><span>📅 تنظيم أسبوعك</span><h1>الجدول الدراسي الذكي</h1><p>جدول مختصر وسريع من الأحد إلى الخميس — سبع حصص يوميًا.</p></div><div className="timetable-actions no-print"><button className="print-main" onClick={()=>window.print()}>🖨 طباعة صفحة واحدة</button><button className="danger" onClick={clearAll} disabled={saving}>تفريغ الجدول</button></div></section>
  {message&&<p className="timetable-message no-print">{message}</p>}
  <section className="smart-strip no-print"><div className="smart-head"><span>✨ مساعد الجدول الذكي</span><strong>{smart.suggestion}</strong></div><div className="smart-stats"><article><small>الحصص المسجلة</small><b>{ar.format(smart.total)}</b></article><article><small>الخانات الفارغة</small><b>{ar.format(smart.empty)}</b></article><article><small>أكثر يوم ازدحامًا</small><b>{smart.busiest?.count?smart.busiest.day:"—"}</b></article><article><small>أكثر فصل تكرارًا</small><b>{smart.mostClass?smart.mostClass[0]:"—"}</b></article></div></section>
  <section className="timetable-meta"><strong>{session.teacherName}</strong><span>{subject.label}</span><span>{ar.format(smart.total)} حصة مسجلة</span></section>
  <section className="table-wrap"><table className="weekly-table"><thead><tr><th>اليوم</th>{periods.map(period=><th key={period}>الحصة {ar.format(period)}</th>)}</tr></thead><tbody>{days.map(day=><tr key={day.key}><th>{day.label}</th>{periods.map(period=>{const lesson=schedule[keyFor(day.key,period)];return <td key={period}><button className={`lesson-cell ${lesson?"filled":""}`} onClick={()=>openCell(day.key,period)}><small>{ar.format(period)}</small>{lesson?<><strong>{lesson.subject}</strong><span>{lesson.className}</span>{lesson.notes&&<em>{lesson.notes}</em>}</>:<b>＋</b>}</button></td>})}</tr>)}</tbody></table></section>
  <section className="mobile-days">{days.map(day=><article key={day.key}><h2>{day.label}</h2><div>{periods.map(period=>{const lesson=schedule[keyFor(day.key,period)];return <button key={period} className={lesson?"filled":""} onClick={()=>openCell(day.key,period)}><span>الحصة {ar.format(period)}</span>{lesson?<><strong>{lesson.subject}</strong><small>{lesson.className}</small></>:<b>إضافة مادة وفصل</b>}</button>})}</div></article>)}</section>
  {selected&&<div className="lesson-modal no-print" role="dialog" aria-modal="true"><div className="lesson-editor"><header><div><span>تعديل الحصة {ar.format(selected.period)}</span><h2>{days.find(day=>day.key===selected.day)?.label}</h2></div><button className="close" onClick={closeEditor}>×</button></header><label><span>المادة</span><input list="subject-options" value={draft.subject} onChange={event=>setDraft(current=>({...current,subject:event.target.value}))} placeholder="اسم المادة"/><datalist id="subject-options"><option value={subject.label}/><option value="القرآن الكريم"/><option value="الدراسات الإسلامية"/><option value="اللغة العربية"/><option value="الرياضيات"/><option value="العلوم"/><option value="اللغة الإنجليزية"/><option value="الدراسات الاجتماعية"/><option value="التفكير الناقد"/></datalist></label><label><span>الفصل</span><select value={draft.className} onChange={event=>setDraft(current=>({...current,className:event.target.value}))}><option value="">اختر الفصل</option>{classes.map(className=><option key={className} value={className}>{className}</option>)}</select>{!classes.length&&<small>أضف الفصول أولًا من تبويب إدارة الطلاب.</small>}</label><label><span>ملاحظات اختيارية</span><textarea value={draft.notes} onChange={event=>setDraft(current=>({...current,notes:event.target.value}))} placeholder="قاعة، نشاط، اختبار..."/></label><footer><button className="save" onClick={saveLesson} disabled={saving}>{saving?"جارٍ الحفظ...":"حفظ الحصة"}</button><button className="delete" onClick={clearLesson} disabled={saving}>حذف الحصة</button><button onClick={closeEditor}>إلغاء</button></footer></div></div>}
 </main>
}
