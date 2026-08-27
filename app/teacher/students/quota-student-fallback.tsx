"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { getSubjectConfig } from "../../../lib/subject-config";
import { useTeacherClient } from "../../../lib/teacher-client";
import { tenantCollection, type SubjectKey } from "../../../lib/teacher-tenant";

type PendingStudent = { id:string; name:string; className:string; code:string; createdAt:string };

const clean = (value:unknown) => String(value ?? "").replace(/\s+/g," ").trim();
const normalizeArabic = (value:unknown) => clean(value).replace(/[إأآ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").toLowerCase();
const identityOf = (name:unknown,className:unknown) => `${normalizeArabic(name)}|${normalizeArabic(className)}`;
const codePattern = /^TH[123]\d{3}$/;

function gradeNumber(className:string):1|2|3|null {
  const value = normalizeArabic(className);
  if (/(^|\s)(1|١|اول|الاول|first)(\s|$)/.test(value)) return 1;
  if (/(^|\s)(2|٢|ثاني|الثاني|second)(\s|$)/.test(value)) return 2;
  if (/(^|\s)(3|٣|ثالث|الثالث|third)(\s|$)/.test(value)) return 3;
  return null;
}

function nextCode(used:Set<string>,className:string) {
  const grade = gradeNumber(className);
  if (!grade) return "";
  const prefix = `TH${grade}`;
  for (let number=1; number<=999; number++) {
    const candidate = `${prefix}${String(number).padStart(3,"0")}`;
    if (!used.has(candidate)) return candidate;
  }
  return "";
}

function setInputValue(input:HTMLInputElement,value:string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")?.set;
  setter?.call(input,value);
  input.dispatchEvent(new Event("input",{bubbles:true}));
}

function normalizeStored(raw:unknown):PendingStudent[] {
  if (!Array.isArray(raw)) return [];
  const used = new Set<string>();
  const result:PendingStudent[] = [];
  for (const value of raw) {
    if (!value || typeof value !== "object") continue;
    const item = value as Record<string,unknown>;
    const name = clean(item.name);
    const className = clean(item.className || item.class);
    if (!name || !className || !gradeNumber(className)) continue;
    const requested = clean(item.code).toUpperCase();
    const code = codePattern.test(requested) && !used.has(requested) ? requested : nextCode(used,className);
    if (!code) continue;
    used.add(code);
    result.push({
      id:clean(item.id) || crypto.randomUUID(),
      name,
      className,
      code,
      createdAt:clean(item.createdAt) || new Date().toISOString(),
    });
  }
  return result;
}

export default function QuotaStudentFallback() {
  const session = useTeacherClient();
  const teacherId = session?.teacherId || "";
  const teacherName = session?.teacherName || "المعلم";
  const subjectKey = (session?.subjectKey as SubjectKey) || "history";
  const subject = session?.subject || getSubjectConfig(subjectKey).label;
  const storageKey = useMemo(()=>`lahooni-pending-students:${teacherId}:${subjectKey}`,[teacherId,subjectKey]);
  const [pending,setPending] = useState<PendingStudent[]>([]);
  const [syncing,setSyncing] = useState(false);
  const [notice,setNotice] = useState("");
  const [tableTarget,setTableTarget] = useState<HTMLTableSectionElement|null>(null);
  const [messageTarget,setMessageTarget] = useState<HTMLElement|null>(null);
  const [selectedClass,setSelectedClass] = useState("");
  const syncingRef = useRef(false);

  const persistPending = useCallback((items:PendingStudent[])=>{
    setPending(items);
    if (teacherId) localStorage.setItem(storageKey,JSON.stringify(items));
  },[storageKey,teacherId]);

  const removePending = useCallback((id:string)=>{
    setPending(current=>{
      const next=current.filter(item=>item.id!==id);
      if (teacherId) localStorage.setItem(storageKey,JSON.stringify(next));
      return next;
    });
  },[storageKey,teacherId]);

  useEffect(()=>{
    if (!teacherId) return;
    try {
      const migrated = normalizeStored(JSON.parse(localStorage.getItem(storageKey)||"[]"));
      localStorage.setItem(storageKey,JSON.stringify(migrated));
      setPending(migrated);
    } catch {
      setPending([]);
    }
  },[storageKey,teacherId]);

  useEffect(()=>{
    const attach=()=>{
      setTableTarget(document.querySelector<HTMLTableSectionElement>(".students-management .table-wrap tbody"));
      setMessageTarget(document.querySelector<HTMLElement>(".students-management .students-toolbar"));
      setSelectedClass(clean(document.querySelector(".students-management .class-toolbar h2")?.textContent));
    };
    attach();
    const observer=new MutationObserver(attach);
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});
    return ()=>observer.disconnect();
  },[]);

  const uploadItems = useCallback(async(items:PendingStudent[])=>{
    if (!teacherId || !items.length || syncingRef.current) return;
    syncingRef.current=true;
    setSyncing(true);
    const studentsPath=tenantCollection(teacherId,subjectKey,"students");
    let uploaded=0;

    try {
      for (const item of items) {
        const grade=gradeNumber(item.className);
        if (!grade) continue;

        let code=item.code;
        const used=new Set(pending.map(entry=>entry.code).filter(Boolean));
        for (let attempts=0; attempts<100; attempts++) {
          if (!codePattern.test(code)) code=nextCode(used,item.className);
          if (!code) break;
          const existing=await getDoc(doc(db,studentsPath,code));
          if (!existing.exists()) break;
          const data=existing.data();
          if (identityOf(data.name,data.class)===identityOf(item.name,item.className)) {
            removePending(item.id);
            uploaded++;
            code="";
            break;
          }
          used.add(code);
          code=nextCode(used,item.className);
        }
        if (!code) continue;

        await setDoc(doc(db,studentsPath,code),{
          name:item.name,
          class:item.className,
          grade,
          accessCode:code,
          studentCode:code,
          teacherId,
          teacherName,
          subjectKey,
          subject,
          sharedRosterId:item.id,
          rosterActive:true,
          attendance:0,
          homework:0,
          participation:0,
          research:0,
          tests:[0,0,0,0,0],
          createdAt:serverTimestamp(),
          updatedAt:serverTimestamp(),
        },{merge:true});
        removePending(item.id);
        uploaded++;
      }

      if (uploaded) setNotice(`تم رفع ${uploaded===1?"الاسم":"الأسماء"} إلى الخادم تلقائيًا.`);
    } catch (error) {
      const code=clean((error as {code?:string})?.code);
      setNotice(code.includes("resource-exhausted")
        ? "Firebase ممتلئة حاليًا؛ الأسماء محفوظة وستُرفع تلقائيًا عند عودة الحصة."
        : "تعذر اتصال الخادم؛ الأسماء محفوظة وستُعاد المحاولة تلقائيًا.");
    } finally {
      syncingRef.current=false;
      setSyncing(false);
    }
  },[pending,removePending,subject,subjectKey,teacherId,teacherName]);

  useEffect(()=>{
    if (!teacherId || !pending.length) return;
    const timer=window.setTimeout(()=>void uploadItems(pending),1200);
    return ()=>window.clearTimeout(timer);
  },[pending.length,storageKey,teacherId,uploadItems]);

  useEffect(()=>{
    if (!teacherId) return;
    const retry=()=>{ if (pending.length) void uploadItems(pending); };
    const visibility=()=>{ if (document.visibilityState==="visible") retry(); };
    window.addEventListener("online",retry);
    window.addEventListener("focus",retry);
    document.addEventListener("visibilitychange",visibility);
    const interval=window.setInterval(retry,15*60*1000);
    return ()=>{
      window.removeEventListener("online",retry);
      window.removeEventListener("focus",retry);
      document.removeEventListener("visibilitychange",visibility);
      window.clearInterval(interval);
    };
  },[pending,teacherId,uploadItems]);

  useEffect(()=>{
    const handleAdd=(event:Event)=>{
      const button=(event.target as Element|null)?.closest("button");
      if (!button || clean(button.textContent)!=="إضافة الطالب") return;
      const editor=button.closest(".student-editor");
      const inputs=editor?.querySelectorAll<HTMLInputElement>("input.field");
      const studentName=clean(inputs?.[0]?.value);
      const className=clean(inputs?.[1]?.value);
      if (!studentName || !className || !gradeNumber(className)) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const duplicate=pending.some(item=>identityOf(item.name,item.className)===identityOf(studentName,className));
      if (duplicate) { setNotice("الاسم موجود مسبقًا في هذا الفصل."); return; }

      const previewCode=clean(editor?.querySelector(".student-code-preview strong")?.textContent).toUpperCase();
      const used=new Set(pending.map(item=>item.code).filter(code=>codePattern.test(code)));
      const code=codePattern.test(previewCode)&&!used.has(previewCode) ? previewCode : nextCode(used,className);
      if (!code) { setNotice("تعذر إنشاء كود للطالب."); return; }

      const item={id:crypto.randomUUID(),name:studentName,className,code,createdAt:new Date().toISOString()};
      persistPending([...pending,item]);
      setNotice(`تمت إضافة ${studentName} — الكود ${code}. الحفظ في الخادم تلقائي.`);
      if (inputs?.[0]) setInputValue(inputs[0],"");
      window.setTimeout(()=>void uploadItems([item]),0);
    };
    document.addEventListener("click",handleAdd,true);
    return ()=>document.removeEventListener("click",handleAdd,true);
  },[pending,persistPending,uploadItems]);

  const visiblePending=pending.filter(item=>!selectedClass||item.className===selectedClass);
  const rows=tableTarget ? createPortal(<>{visiblePending.map((student,index)=><tr key={`pending-${student.id}`}>
    <td>{index+1}</td>
    <td><strong>{student.name}</strong></td>
    <td>{student.className}</td>
    <td><button className="code-button" type="button">{student.code}</button></td>
    <td><div className="row-actions"><span>{syncing?"جارٍ الحفظ…":"محفوظ"}</span><button type="button" onClick={()=>removePending(student.id)}>حذف</button></div></td>
  </tr>)}</>,tableTarget) : null;

  const banner=messageTarget&&(notice||pending.length) ? createPortal(<div className="smart-message" style={{marginTop:10}}>
    <strong>{notice||`الأسماء محفوظة، والرفع إلى الخادم تلقائي عند توفر Firebase.`}</strong>
  </div>,messageTarget) : null;

  return <>{rows}{banner}</>;
}
