"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTeacherClient } from "../../../lib/teacher-client";
import "./daily-report.css";

type TimetableLesson = { subject?: string; className?: string; notes?: string };
type PendingTimetable = { lessons?: Record<string, TimetableLesson>; classNames?: string[]; updatedAt?: string };
type WorkRow = { id:string; period:number; className:string; lessonTitle?:string; prepared?:boolean; completed?:boolean; completedWork?:string; updatedAt?:string };
type DailyLesson = { period:number; className:string; notes:string; prepared:boolean; attendanceDone:boolean; completed:boolean; lessonTitle:string; completedWork:string };

const ar=(value:number)=>new Intl.NumberFormat("ar-SA-u-nu-arab").format(value);
function riyadhDate(){const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Riyadh",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());const map=Object.fromEntries(parts.map(item=>[item.type,item.value]));return `${map.year}-${map.month}-${map.day}`;}
function weekday(){return new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Riyadh",weekday:"long"}).format(new Date()).toLowerCase();}
function dateLabel(){return new Intl.DateTimeFormat("ar-SA",{timeZone:"Asia/Riyadh",weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date());}
function readPending(key:string):PendingTimetable|null{if(!key)return null;try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw) as PendingTimetable:null}catch{return null}}
function merge(server:Record<string,TimetableLesson>,pending:PendingTimetable|null){if(!pending?.lessons)return server;const owned=new Set((pending.classNames||[]).map(String));const retained=Object.fromEntries(Object.entries(server).filter(([,lesson])=>!owned.has(String(lesson.className||""))));return{...retained,...pending.lessons};}

export default function DailyTeacherReportPage(){
  const session=useTeacherClient();
  const subjectId=String(session?.subjectKey||"").split("--")[0];
  const today=useMemo(riyadhDate,[]);
  const todayLabel=useMemo(dateLabel,[]);
  const day=useMemo(weekday,[]);
  const workspaceKey=session?.workspaceKey||session?.subjectKey||subjectId;
  const storageKey=session?.teacherId?`ostadh-lahooni:timetable:${session.teacherId}:${workspaceKey}:${session.activeGrade||"all"}`:"";
  const [lessons,setLessons]=useState<DailyLesson[]>([]);
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState("");

  const load=useCallback(async()=>{
    if(!subjectId)return;
    setLoading(true);
    try{
      const timetableResponse=await fetch(`/api/teacher/timetable?subjectId=${encodeURIComponent(subjectId)}`,{cache:"no-store"});
      const timetableData=await timetableResponse.json().catch(()=>({}));
      const server=timetableResponse.ok&&timetableData.lessons&&typeof timetableData.lessons==="object"?timetableData.lessons as Record<string,TimetableLesson>:{};
      const timetable=merge(server,readPending(storageKey));
      const scheduled=Object.entries(timetable).flatMap(([cell,lesson])=>{const match=cell.match(/^(sunday|monday|tuesday|wednesday|thursday)-([1-7])$/);if(!match||match[1]!==day||!lesson.className)return[];return[{period:Number(match[2]),className:String(lesson.className),notes:String(lesson.notes||"")}];}).sort((a,b)=>a.period-b.period);
      const params=new URLSearchParams({subjectId,date:today});
      [...new Set(scheduled.map(item=>item.className))].forEach(name=>params.append("className",name));
      const workResponse=await fetch(`/api/teacher/lesson-work?${params.toString()}`,{cache:"no-store"});
      const workData=await workResponse.json().catch(()=>({}));
      if(!workResponse.ok)throw new Error(workData.message||"تعذر تحميل تقرير اليوم");
      const rows=Array.isArray(workData.rows)?workData.rows as WorkRow[]:[];
      const attendance=workData.attendance&&typeof workData.attendance==="object"?workData.attendance as Record<string,boolean>:{};
      setLessons(scheduled.map(item=>{const row=rows.find(work=>Number(work.period)===item.period&&work.className===item.className);return{...item,prepared:Boolean(row?.prepared),attendanceDone:Boolean(attendance[item.className]),completed:Boolean(row?.completed),lessonTitle:String(row?.lessonTitle||item.notes||session?.subject||""),completedWork:String(row?.completedWork||"")};}));
      setMessage("");
    }catch(error){setMessage(error instanceof Error?error.message:"تعذر تحميل تقرير اليوم");}
    finally{setLoading(false);}
  },[subjectId,storageKey,day,today,session?.subject]);

  useEffect(()=>{void load();},[load]);
  useEffect(()=>{const refresh=()=>void load();window.addEventListener("lahooni:timetable-updated",refresh as EventListener);window.addEventListener("lahooni:timetable-synced",refresh as EventListener);window.addEventListener("focus",refresh);return()=>{window.removeEventListener("lahooni:timetable-updated",refresh as EventListener);window.removeEventListener("lahooni:timetable-synced",refresh as EventListener);window.removeEventListener("focus",refresh);};},[load]);

  const prepared=lessons.filter(item=>item.prepared).length;
  const attended=lessons.filter(item=>item.attendanceDone).length;
  const completed=lessons.filter(item=>item.completed).length;

  return <main className="daily-report-page" dir="rtl">
    <section className="dr-head"><div><small>التقرير اليومي</small><h1>تقرير عمل المعلم</h1><p>{todayLabel} • {session?.subject||"المادة"}{session?.activeGradeLabel?` • ${session.activeGradeLabel}`:""}</p></div><div className="dr-actions"><button type="button" onClick={()=>void load()} disabled={loading}>{loading?"تحديث…":"تحديث"}</button><button type="button" onClick={()=>window.print()}>طباعة / PDF</button></div></section>
    {message?<p className="dr-message">{message}</p>:null}
    <section className="dr-kpis"><article><small>حصص الجدول</small><b>{ar(lessons.length)}</b></article><article><small>تم التحضير</small><b>{ar(prepared)}</b></article><article><small>تمت المتابعة</small><b>{ar(attended)}</b></article><article><small>العمل المنجز</small><b>{ar(completed)}</b></article></section>
    <section className="dr-table-wrap"><header><div><small>حصص اليوم من الجدول مباشرة</small><h2>التقرير اليومي</h2></div><Link href="/teacher/timetable">فتح الجدول</Link></header>{lessons.length?<table><thead><tr><th>الحصة</th><th>الفصل</th><th>عنوان الدرس</th><th>التحضير</th><th>المتابعة</th><th>العمل المنجز</th><th>الإجراء</th></tr></thead><tbody>{lessons.map(lesson=><tr key={`${lesson.period}-${lesson.className}`}><td>{ar(lesson.period)}</td><td><b>{lesson.className}</b></td><td>{lesson.lessonTitle||"—"}</td><td><span className={lesson.prepared?"ok":"pending"}>{lesson.prepared?"محضّر":"لم يُحضّر"}</span></td><td><span className={lesson.attendanceDone?"ok":"pending"}>{lesson.attendanceDone?"محفوظة":"لم تُسجل"}</span></td><td>{lesson.completedWork||"—"}</td><td className="dr-links"><Link href={`/teacher/preparation?period=${lesson.period}&class=${encodeURIComponent(lesson.className)}`}>التحضير</Link><Link href={`/teacher/attendance?class=${encodeURIComponent(lesson.className)}`}>المتابعة</Link></td></tr>)}</tbody></table>:<div className="dr-empty"><b>لا توجد حصص في جدول اليوم</b><span>أضف الحصص من الجدول الدراسي، وستنعكس هنا تلقائيًا.</span></div>}</section>
    <footer className="dr-footer"><span>المعلم: {session?.teacherName||"—"}</span><span>التاريخ: {today}</span><span>بوابة أستاذ لحوني التعليمية</span></footer>
  </main>;
}
