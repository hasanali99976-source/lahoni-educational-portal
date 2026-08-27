"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { tenantCollection, type SubjectKey } from "../../../lib/teacher-tenant";
import { useTeacherClient } from "../../../lib/teacher-client";

type Status = "present" | "absent" | "late" | "excused" | "escaped";
type DraftRow = { name:string; index:number; status:Status };
type Draft = { className:string; date:string; rows:DraftRow[]; savedAt:string };
type Queue = Record<string,Draft>;
type StudentRecord = { id:string; name:string; className:string };

const labelToStatus:Record<string,Status> = {
  "حاضر":"present",
  "غائب":"absent",
  "متأخر":"late",
  "مستأذن":"excused",
  "هروب":"escaped",
};
const statusToLabel:Record<Status,string> = {
  present:"حاضر",
  absent:"غائب",
  late:"متأخر",
  excused:"مستأذن",
  escaped:"هروب",
};

function clean(value:unknown) { return String(value ?? "").replace(/\s+/g," ").trim(); }
function normalize(value:unknown) { return clean(value).replace(/[إأآ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").toLowerCase(); }
function safeId(value:string) { return encodeURIComponent(value).replace(/%/g,"_"); }
function readJson<T>(key:string,fallback:T):T {
  try { const value=JSON.parse(localStorage.getItem(key)||""); return value as T; }
  catch { return fallback; }
}

export default function LocalAttendanceFallback() {
  const session=useTeacherClient();
  const teacherId=session?.teacherId||"";
  const teacherName=session?.teacherName||"المعلم";
  const subjectKey=(session?.subjectKey as SubjectKey)||"history";
  const subject=session?.subject||"";
  const draftPrefix=useMemo(()=>`lahooni-attendance-draft:${teacherId}:${subjectKey}`,[teacherId,subjectKey]);
  const queueKey=useMemo(()=>`lahooni-attendance-queue:${teacherId}:${subjectKey}`,[teacherId,subjectKey]);
  const pendingStudentsKey=useMemo(()=>`lahooni-pending-students:${teacherId}:${subjectKey}`,[teacherId,subjectKey]);
  const [notice,setNotice]=useState("");
  const restoreTimer=useRef<number|null>(null);
  const noticeTimer=useRef<number|null>(null);
  const syncing=useRef(false);
  const restoring=useRef(false);

  const showNotice=useCallback((value:string)=>{
    setNotice(value);
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current=window.setTimeout(()=>setNotice(""),2600);
  },[]);

  const currentSelection=useCallback(()=>{
    const root=document.querySelector<HTMLElement>(".attendance-page");
    const controls=root?.querySelector<HTMLElement>(".attendance-controls");
    const className=clean(controls?.querySelector<HTMLSelectElement>("select")?.value);
    const date=clean(controls?.querySelector<HTMLInputElement>('input[type="date"]')?.value);
    return {root,className,date};
  },[]);

  const readDraftFromPage=useCallback(():Draft|null=>{
    const {root,className,date}=currentSelection();
    if (!root||!className||!date) return null;
    const rows:Array<DraftRow>=[];
    root.querySelectorAll<HTMLElement>(".attendance-list article").forEach((article,index)=>{
      const name=clean(article.querySelector(".student-info strong")?.textContent);
      if (!name) return;
      const active=[...article.querySelectorAll<HTMLButtonElement>(".status-buttons button")].find(button=>button.classList.contains("active"));
      const status=labelToStatus[clean(active?.textContent)]||"present";
      rows.push({name,index,status});
    });
    return {className,date,rows,savedAt:new Date().toISOString()};
  },[currentSelection]);

  const saveDraft=useCallback((show=false)=>{
    if (!teacherId) return null;
    const draft=readDraftFromPage();
    if (!draft) return null;
    const id=`${safeId(draft.className)}_${draft.date}`;
    localStorage.setItem(`${draftPrefix}:${id}`,JSON.stringify(draft));
    const queue=readJson<Queue>(queueKey,{});
    queue[id]=draft;
    localStorage.setItem(queueKey,JSON.stringify(queue));
    if (show) showNotice("تم حفظ التحضير مباشرة");
    return draft;
  },[draftPrefix,queueKey,readDraftFromPage,showNotice,teacherId]);

  const restoreDraft=useCallback(()=>{
    if (!teacherId||restoring.current) return;
    const {root,className,date}=currentSelection();
    if (!root||!className||!date) return;
    const id=`${safeId(className)}_${date}`;
    const draft=readJson<Draft|null>(`${draftPrefix}:${id}`,null);
    if (!draft?.rows?.length) return;
    restoring.current=true;
    const articles=[...root.querySelectorAll<HTMLElement>(".attendance-list article")];
    draft.rows.forEach(row=>{
      const article=articles.find((item,index)=>index===row.index&&normalize(item.querySelector(".student-info strong")?.textContent)===normalize(row.name))
        || articles.find(item=>normalize(item.querySelector(".student-info strong")?.textContent)===normalize(row.name));
      const button=[...(article?.querySelectorAll<HTMLButtonElement>(".status-buttons button")||[])].find(item=>clean(item.textContent)===statusToLabel[row.status]);
      if (button&&!button.classList.contains("active")) button.click();
    });
    window.setTimeout(()=>{restoring.current=false;},0);
  },[currentSelection,draftPrefix,teacherId]);

  const scheduleRestore=useCallback(()=>{
    if (restoreTimer.current) window.clearTimeout(restoreTimer.current);
    restoreTimer.current=window.setTimeout(restoreDraft,80);
  },[restoreDraft]);

  const syncQueue=useCallback(async()=>{
    if (!teacherId||syncing.current) return;
    const queue=readJson<Queue>(queueKey,{});
    const entries=Object.entries(queue);
    if (!entries.length) return;
    syncing.current=true;
    try {
      const studentsPath=tenantCollection(teacherId,subjectKey,"students");
      const attendancePath=tenantCollection(teacherId,subjectKey,"attendance");
      const snapshot=await getDocs(collection(db,studentsPath));
      const students:StudentRecord[]=snapshot.docs.map(item=>({id:item.id,name:clean(item.data().name),className:clean(item.data().class)}));
      const pending=readJson<Array<Record<string,unknown>>>(pendingStudentsKey,[]);
      pending.forEach(item=>students.push({
        id:clean(item.code||item.id),
        name:clean(item.name),
        className:clean(item.className),
      }));
      const remaining:Queue={...queue};
      for (const [id,draft] of entries) {
        const used=new Set<string>();
        const records:Record<string,Status>={};
        draft.rows.forEach(row=>{
          const student=students.find(item=>!used.has(item.id)&&normalize(item.name)===normalize(row.name)&&normalize(item.className)===normalize(draft.className));
          const studentId=student?.id||`local_${safeId(row.name)}_${row.index}`;
          used.add(studentId);
          records[studentId]=row.status;
        });
        await setDoc(doc(db,attendancePath,id),{
          class:draft.className,
          date:draft.date,
          records,
          teacherId,
          teacherName,
          subjectKey,
          subject,
          updatedAt:new Date().toISOString(),
        },{merge:true});
        delete remaining[id];
        localStorage.setItem(queueKey,JSON.stringify(remaining));
      }
    } catch {
      // يبقى التحضير محفوظًا محليًا ويعاد رفعه عند توفر الخادم.
    } finally {
      syncing.current=false;
    }
  },[pendingStudentsKey,queueKey,subject,subjectKey,teacherId,teacherName]);

  useEffect(()=>{
    if (!teacherId) return;
    const handleClick=(event:MouseEvent)=>{
      const button=(event.target as Element|null)?.closest<HTMLButtonElement>("button");
      if (!button) return;
      if (clean(button.textContent)==="حفظ التحضير") {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        saveDraft(true);
        void syncQueue();
        return;
      }
      if (button.closest(".status-buttons")&&!restoring.current) window.setTimeout(()=>saveDraft(false),0);
    };
    const handleChange=(event:Event)=>{
      const target=event.target as Element|null;
      if (target?.closest(".attendance-page .attendance-controls")) {
        window.setTimeout(scheduleRestore,30);
        window.setTimeout(scheduleRestore,250);
      }
    };
    document.addEventListener("click",handleClick,true);
    document.addEventListener("change",handleChange,true);
    const observer=new MutationObserver(scheduleRestore);
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:["class"]});
    window.setTimeout(scheduleRestore,250);
    window.setTimeout(()=>void syncQueue(),1200);
    window.addEventListener("online",syncQueue);
    return ()=>{
      document.removeEventListener("click",handleClick,true);
      document.removeEventListener("change",handleChange,true);
      observer.disconnect();
      window.removeEventListener("online",syncQueue);
      if (restoreTimer.current) window.clearTimeout(restoreTimer.current);
      if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    };
  },[saveDraft,scheduleRestore,syncQueue,teacherId]);

  if (!notice) return null;
  return <div dir="rtl" style={{position:"fixed",left:"50%",bottom:24,transform:"translateX(-50%)",zIndex:9999,background:"#173f61",color:"#fff",padding:"12px 20px",borderRadius:12,fontWeight:900,boxShadow:"0 10px 30px rgba(0,0,0,.22)",pointerEvents:"none"}}>{notice}</div>;
}
