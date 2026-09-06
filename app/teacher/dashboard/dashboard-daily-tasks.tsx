"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTeacherClient } from "../../../lib/teacher-client";
import "./dashboard-daily-tasks.css";

type TimetableLesson={subject?:string;className?:string;notes?:string};
type WorkRow={id:string;period:number;className:string;prepared?:boolean;lessonTitle?:string};
type PendingTimetable={lessons?:Record<string,TimetableLesson>;classNames?:string[];updatedAt?:string};
type DailyLesson={period:number;className:string;notes:string;prepared:boolean;attendanceDone:boolean};

function riyadhDate(){const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Riyadh",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());const map=Object.fromEntries(parts.map(item=>[item.type,item.value]));return `${map.year}-${map.month}-${map.day}`;}
function riyadhWeekday(){return new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Riyadh",weekday:"long"}).format(new Date()).toLowerCase();}
function readPending(key:string):PendingTimetable|null{if(!key)return null;try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw) as PendingTimetable:null}catch{return null}}
function mergeSchedule(server:Record<string,TimetableLesson>,pending:PendingTimetable|null){if(!pending?.lessons)return server;const owned=new Set((pending.classNames||[]).map(String));const retained=Object.fromEntries(Object.entries(server).filter(([,lesson])=>!owned.has(String(lesson.className||""))));return{...retained,...pending.lessons};}

export default function DashboardDailyTasks(){
  const session=useTeacherClient();
  const subjectId=String(session?.subjectKey||"").split("--")[0];
  const workspaceKey=session?.workspaceKey||session?.subjectKey||subjectId;
  const storageKey=session?.teacherId?`ostadh-lahooni:timetable:${session.teacherId}:${workspaceKey}:${session.activeGrade||"all"}`:"";
  const today=useMemo(riyadhDate,[]);
  const day=useMemo(riyadhWeekday,[]);
  const [target,setTarget]=useState<Element|null>(null);
  const [lessons,setLessons]=useState<DailyLesson[]>([]);
  const [loading,setLoading]=useState(false);

  const load=useCallback(async()=>{
    if(!subjectId)return;
    setLoading(true);
    try{
      const timetableResponse=await fetch(`/api/teacher/timetable?subjectId=${encodeURIComponent(subjectId)}`,{cache:"no-store"});
      const timetableData=await timetableResponse.json().catch(()=>({}));
      const server=timetableResponse.ok&&timetableData.lessons&&typeof timetableData.lessons==="object"?timetableData.lessons as Record<string,TimetableLesson>:{};
      const timetable=mergeSchedule(server,readPending(storageKey));
      const scheduled=Object.entries(timetable).flatMap(([cell,lesson])=>{const match=cell.match(/^(sunday|monday|tuesday|wednesday|thursday)-([1-7])$/);if(!match||match[1]!==day||!lesson.className)return[];return[{period:Number(match[2]),className:String(lesson.className),notes:String(lesson.notes||"")}];}).sort((a,b)=>a.period-b.period);
      const params=new URLSearchParams({subjectId,date:today});
      [...new Set(scheduled.map(item=>item.className))].forEach(name=>params.append("className",name));
      const workResponse=await fetch(`/api/teacher/lesson-work?${params.toString()}`,{cache:"no-store"});
      const workData=await workResponse.json().catch(()=>({}));
      const rows=workResponse.ok&&Array.isArray(workData.rows)?workData.rows as WorkRow[]:[];
      const attendance=workResponse.ok&&workData.attendance&&typeof workData.attendance==="object"?workData.attendance as Record<string,boolean>:{};
      setLessons(scheduled.map(item=>{const work=rows.find(row=>Number(row.period)===item.period&&row.className===item.className);return{...item,prepared:Boolean(work?.prepared),attendanceDone:Boolean(attendance[item.className])};}));
    }finally{setLoading(false);}
  },[subjectId,storageKey,today,day]);

  useEffect(()=>{let cancelled=false;let attempts=0;const find=()=>{if(cancelled)return;const node=document.querySelector(".td16-tasks-panel .td16-task-list");if(node){node.classList.add("dtask-enhanced");setTarget(node);return;}attempts+=1;if(attempts<30)window.setTimeout(find,100);};find();return()=>{cancelled=true;};},[]);
  useEffect(()=>{void load();},[load]);
  useEffect(()=>{const refresh=()=>void load();const visible=()=>{if(document.visibilityState==="visible")void load();};window.addEventListener("lahooni:timetable-updated",refresh as EventListener);window.addEventListener("lahooni:timetable-synced",refresh as EventListener);window.addEventListener("focus",refresh);document.addEventListener("visibilitychange",visible);return()=>{window.removeEventListener("lahooni:timetable-updated",refresh as EventListener);window.removeEventListener("lahooni:timetable-synced",refresh as EventListener);window.removeEventListener("focus",refresh);document.removeEventListener("visibilitychange",visible);};},[load]);

  if(!target)return null;
  return createPortal(<div className="dtask-root" dir="rtl">
    <div className="dtask-shortcuts"><Link href="/teacher/preparation">تحضير المعلم</Link><Link href="/teacher/daily-report">تقرير اليوم</Link><Link href="/teacher/timetable">تعديل الجدول</Link><button type="button" onClick={()=>void load()} disabled={loading}>{loading?"تحديث…":"تحديث"}</button></div>
    {lessons.length?lessons.map(lesson=><section className="dtask-lesson" key={`${lesson.period}-${lesson.className}`}>
      <header><span>{lesson.period}</span><div><b>{lesson.className}</b><small>الحصة {lesson.period}{lesson.notes?` • ${lesson.notes}`:""}</small></div></header>
      <div className="dtask-actions">
        <Link className={lesson.prepared?"done":""} href={`/teacher/preparation?period=${lesson.period}&class=${encodeURIComponent(lesson.className)}`}><span>{lesson.prepared?"✓":"01"}</span><div><b>تحضير الحصة</b><small>{lesson.prepared?"التحضير محفوظ":"فتح تحضير المعلم"}</small></div><i>‹</i></Link>
        <Link className={lesson.attendanceDone?"done":""} href={`/teacher/attendance?class=${encodeURIComponent(lesson.className)}`}><span>{lesson.attendanceDone?"✓":"02"}</span><div><b>سجل المتابعة اليومي</b><small>{lesson.attendanceDone?"تم حفظ المتابعة":"تسجيل الحضور والانضباط"}</small></div><i>‹</i></Link>
      </div>
    </section>):<div className="dtask-empty"><b>لا توجد حصص مجدولة اليوم</b><span>أضف جدولك، وستظهر هنا تلقائيًا كتحضير ومتابعة يومية.</span></div>}
  </div>,target);
}
