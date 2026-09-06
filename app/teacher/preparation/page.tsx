"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTeacherClient } from "../../../lib/teacher-client";
import "./preparation.css";

type TimetableLesson = { subject?: string; className?: string; notes?: string };
type WorkRow = {
  id: string; date: string; period: number; className: string; lessonTitle?: string;
  objectives?: string; strategies?: string; introduction?: string; lessonFlow?: string;
  activity?: string; assessment?: string; homework?: string; values?: string;
  preparation?: string; completedWork?: string; prepared?: boolean; updatedAt?: string;
};
type Lesson = { period: number; className: string; notes: string; work?: WorkRow };
type PendingTimetable = { lessons?: Record<string, TimetableLesson>; classNames?: string[]; updatedAt?: string };

type FormState = {
  lessonTitle: string; objectives: string; strategies: string; introduction: string;
  lessonFlow: string; activity: string; assessment: string; homework: string; values: string;
};

const emptyForm: FormState = { lessonTitle:"", objectives:"", strategies:"", introduction:"", lessonFlow:"", activity:"", assessment:"", homework:"", values:"" };
const ar = (value:number) => new Intl.NumberFormat("ar-SA-u-nu-arab").format(value);
function riyadhDate(){const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Riyadh",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());const map=Object.fromEntries(parts.map(p=>[p.type,p.value]));return `${map.year}-${map.month}-${map.day}`;}
function weekday(){return new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Riyadh",weekday:"long"}).format(new Date()).toLowerCase();}
function readPending(key:string):PendingTimetable|null{try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw) as PendingTimetable:null}catch{return null}}
function merge(server:Record<string,TimetableLesson>,pending:PendingTimetable|null){if(!pending?.lessons)return server;const owned=new Set((pending.classNames||[]).map(String));const retained=Object.fromEntries(Object.entries(server).filter(([,lesson])=>!owned.has(String(lesson.className||""))));return {...retained,...pending.lessons};}
function escapeHtml(value:string){return value.replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch]||ch));}

export default function TeacherPreparationPage(){
  const session=useTeacherClient();
  const subjectId=String(session?.subjectKey||"").split("--")[0];
  const today=useMemo(riyadhDate,[]);
  const day=useMemo(weekday,[]);
  const workspaceKey=session?.workspaceKey||session?.subjectKey||subjectId;
  const storageKey=session?.teacherId?`ostadh-lahooni:timetable:${session.teacherId}:${workspaceKey}:${session.activeGrade||"all"}`:"";
  const [lessons,setLessons]=useState<Lesson[]>([]);
  const [selected,setSelected]=useState<Lesson|null>(null);
  const [form,setForm]=useState<FormState>(emptyForm);
  const [loading,setLoading]=useState(false);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");

  const load=useCallback(async()=>{
    if(!subjectId)return;
    setLoading(true);
    try{
      const timetableResponse=await fetch(`/api/teacher/timetable?subjectId=${encodeURIComponent(subjectId)}`,{cache:"no-store"});
      const timetableData=await timetableResponse.json().catch(()=>({}));
      const server=timetableResponse.ok&&timetableData.lessons&&typeof timetableData.lessons==="object"?timetableData.lessons as Record<string,TimetableLesson>:{};
      const timetable=merge(server,storageKey?readPending(storageKey):null);
      const scheduled=Object.entries(timetable).flatMap(([cell,lesson])=>{const match=cell.match(/^(sunday|monday|tuesday|wednesday|thursday)-([1-7])$/);if(!match||match[1]!==day||!lesson.className)return[];return[{period:Number(match[2]),className:String(lesson.className),notes:String(lesson.notes||"")}];}).sort((a,b)=>a.period-b.period);
      const params=new URLSearchParams({subjectId,date:today});
      [...new Set(scheduled.map(item=>item.className))].forEach(name=>params.append("className",name));
      const workResponse=await fetch(`/api/teacher/lesson-work?${params.toString()}`,{cache:"no-store"});
      const workData=await workResponse.json().catch(()=>({}));
      const rows=workResponse.ok&&Array.isArray(workData.rows)?workData.rows as WorkRow[]:[];
      const next=scheduled.map(item=>({...item,work:rows.find(row=>Number(row.period)===item.period&&row.className===item.className)}));
      setLessons(next);
      if(selected){const current=next.find(item=>item.period===selected.period&&item.className===selected.className);if(current)open(current);}
      setMessage("");
    }catch(error){setMessage(error instanceof Error?error.message:"تعذر تحميل تحضير اليوم");}
    finally{setLoading(false);}
  },[subjectId,day,today,storageKey]);

  useEffect(()=>{void load();},[load]);
  useEffect(()=>{const refresh=()=>void load();window.addEventListener("lahooni:timetable-updated",refresh as EventListener);window.addEventListener("focus",refresh);return()=>{window.removeEventListener("lahooni:timetable-updated",refresh as EventListener);window.removeEventListener("focus",refresh);};},[load]);

  function open(lesson:Lesson){setSelected(lesson);const row=lesson.work;setForm({lessonTitle:row?.lessonTitle||lesson.notes||"",objectives:row?.objectives||"",strategies:row?.strategies||"",introduction:row?.introduction||"",lessonFlow:row?.lessonFlow||row?.preparation||"",activity:row?.activity||"",assessment:row?.assessment||"",homework:row?.homework||"",values:row?.values||""});setMessage("");}
  function update<K extends keyof FormState>(key:K,value:FormState[K]){setForm(current=>({...current,[key]:value}));}

  async function save(){
    if(!selected||!subjectId)return;
    if(!form.lessonTitle.trim())return setMessage("اكتب عنوان الدرس أولًا.");
    setSaving(true);setMessage("");
    try{
      const response=await fetch("/api/teacher/lesson-work",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({subjectId,date:today,period:selected.period,className:selected.className,...form})});
      const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||"تعذر حفظ التحضير");
      const row=data.row as WorkRow;setLessons(current=>current.map(item=>item.period===selected.period&&item.className===selected.className?{...item,work:row}:item));setSelected(current=>current?{...current,work:row}:current);setMessage("تم حفظ تحضير الحصة.");
    }catch(error){setMessage(error instanceof Error?error.message:"تعذر حفظ التحضير");}finally{setSaving(false);}
  }

  function printPreparation(){
    if(!selected)return;
    const popup=window.open("","_blank","width=980,height=900");if(!popup)return setMessage("اسمح بالنوافذ المنبثقة لطباعة التحضير.");
    const fields=[["الأهداف",form.objectives],["الاستراتيجيات",form.strategies],["التمهيد",form.introduction],["سير الدرس",form.lessonFlow],["النشاط",form.activity],["التقويم",form.assessment],["الواجب",form.homework],["القيم",form.values]].filter(([,value])=>String(value).trim());
    popup.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تحضير ${escapeHtml(form.lessonTitle)}</title><style>@page{size:A4;margin:12mm}*{box-sizing:border-box}body{font-family:Tahoma,Arial,sans-serif;color:#173b45;margin:0}.top{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #0a756e;padding-bottom:10px}.top h1{margin:3px 0;font-size:24px}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0}.meta div,.field{border:1px solid #d9e5e3;border-radius:10px;padding:9px}.meta small,.field small{display:block;color:#75898e;font-size:10px}.meta b{font-size:12px}.fields{display:grid;grid-template-columns:1fr 1fr;gap:8px}.field p{margin:5px 0 0;white-space:pre-wrap;line-height:1.7;font-size:11px}.field.wide{grid-column:1/-1}footer{margin-top:12px;padding-top:8px;border-top:1px dashed #b9c8c5;display:flex;justify-content:space-between;font-size:10px}.toolbar{position:fixed;left:12px;top:12px}.toolbar button{padding:8px 12px;border:0;border-radius:8px;background:#0a756e;color:#fff;font-weight:bold}@media print{.toolbar{display:none}}</style></head><body><button class="toolbar" onclick="window.print()">طباعة / PDF</button><section class="top"><div><small>بوابة أستاذ لحوني التعليمية</small><h1>تحضير درس</h1></div><b>${escapeHtml(session?.subject||"المادة")}</b></section><section class="meta"><div><small>عنوان الدرس</small><b>${escapeHtml(form.lessonTitle)}</b></div><div><small>الفصل</small><b>${escapeHtml(selected.className)}</b></div><div><small>الحصة</small><b>${ar(selected.period)}</b></div><div><small>التاريخ</small><b>${today}</b></div></section><section class="fields">${fields.map(([label,value])=>`<article class="field ${label==="سير الدرس"?"wide":""}"><small>${label}</small><p>${escapeHtml(String(value))}</p></article>`).join("")}</section><footer><span>إعداد المعلم: ${escapeHtml(session?.teacherName||"المعلم")}</span><span>زمن الحصة: 50 دقيقة</span></footer></body></html>`);popup.document.close();
  }

  return <main className="prep-page" dir="rtl">
    <section className="prep-head"><div><small>التحضير اليومي</small><h1>تحضير المعلم</h1><p>الحصص تأتي تلقائيًا من جدولك الحالي. اختر الحصة وأكمل تحضيرها، ويُحفظ التحضير بتاريخ الحصة والفصل.</p></div><div><button type="button" onClick={()=>void load()} disabled={loading}>{loading?"تحديث…":"تحديث"}</button><Link href="/teacher/timetable">تعديل الجدول</Link></div></section>
    {message?<p className="prep-message">{message}</p>:null}
    <section className="prep-layout">
      <aside className="prep-lessons"><header><small>حصص اليوم</small><b>{ar(lessons.length)} حصة</b></header>{lessons.length?lessons.map(lesson=><button type="button" key={`${lesson.period}-${lesson.className}`} className={selected?.period===lesson.period&&selected.className===lesson.className?"active":""} onClick={()=>open(lesson)}><span>{ar(lesson.period)}</span><div><b>{lesson.className}</b><small>{lesson.notes||session?.subject||"المادة"}</small></div><i>{lesson.work?.prepared?"محضرة":"تحضير"}</i></button>):<div className="prep-empty"><b>لا توجد حصص مجدولة اليوم</b><span>أضفها من الجدول الدراسي، وستظهر هنا مباشرة.</span></div>}</aside>
      <section className="prep-form">{selected?<><header><div><small>{selected.className} • الحصة {ar(selected.period)}</small><h2>{form.lessonTitle||"تحضير الحصة"}</h2></div><span>{selected.work?.prepared?"محفوظ":"غير مكتمل"}</span></header><div className="prep-fields"><label className="wide"><span>عنوان الدرس</span><input value={form.lessonTitle} onChange={e=>update("lessonTitle",e.target.value)} placeholder="عنوان الدرس الفعلي"/></label><label><span>الأهداف</span><textarea value={form.objectives} onChange={e=>update("objectives",e.target.value)} placeholder="الأهداف التعليمية المختصرة"/></label><label><span>الاستراتيجيات</span><textarea value={form.strategies} onChange={e=>update("strategies",e.target.value)} placeholder="مثل: حوار، تعلم تعاوني، حل مشكلات"/></label><label><span>التمهيد</span><textarea value={form.introduction} onChange={e=>update("introduction",e.target.value)} placeholder="تهيئة مختصرة للدرس"/></label><label><span>النشاط</span><textarea value={form.activity} onChange={e=>update("activity",e.target.value)} placeholder="نشاط الطالب أثناء الحصة"/></label><label className="wide"><span>سير الدرس</span><textarea value={form.lessonFlow} onChange={e=>update("lessonFlow",e.target.value)} placeholder="تسلسل العرض والتنفيذ خلال الحصة"/></label><label><span>التقويم</span><textarea value={form.assessment} onChange={e=>update("assessment",e.target.value)} placeholder="سؤال، مهمة، بطاقة خروج..."/></label><label><span>الواجب</span><textarea value={form.homework} onChange={e=>update("homework",e.target.value)} placeholder="الواجب أو المهمة الختامية"/></label><label className="wide"><span>القيم والمهارات</span><textarea value={form.values} onChange={e=>update("values",e.target.value)} placeholder="القيم أو المهارات المرتبطة بالدرس"/></label></div><footer><button className="save" type="button" onClick={()=>void save()} disabled={saving}>{saving?"جارٍ الحفظ…":"حفظ التحضير"}</button><button type="button" onClick={printPreparation}>طباعة A4</button></footer></>:<div className="prep-form-empty"><b>اختر حصة من اليمين</b><span>سيظهر نموذج التحضير هنا مباشرة.</span></div>}</section>
    </section>
  </main>;
}
