"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { getSubjectConfig } from "../../../lib/subject-config";
import { useTeacherClient } from "../../../lib/teacher-client";
import { tenantCollection, type SubjectKey } from "../../../lib/teacher-tenant";

type PendingStudent = {
  id: string;
  name: string;
  className: string;
  code?: string;
  createdAt: string;
};

type Attempt = { name: string; className: string; at: number };

const SHARED_STUDENTS = "school_shared_students";
const clean = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();
const normalizeArabic = (value: unknown) => clean(value)
  .replace(/[إأآ]/g, "ا")
  .replace(/ى/g, "ي")
  .replace(/ة/g, "ه")
  .toLowerCase();
const classId = (name: string) => encodeURIComponent(name.replace(/\//g, "-")).slice(0, 120);
const codePattern = /^TH[123]\d{3}$/;

function gradeNumber(className: string): 1 | 2 | 3 | null {
  const value = normalizeArabic(className);
  if (/(^|\s)(1|١|اول|الاول|first)(\s|$)/.test(value)) return 1;
  if (/(^|\s)(2|٢|ثاني|الثاني|second)(\s|$)/.test(value)) return 2;
  if (/(^|\s)(3|٣|ثالث|الثالث|third)(\s|$)/.test(value)) return 3;
  return null;
}

function codeOf(value: Record<string, unknown> & { id?: string }) {
  return clean(value.accessCode || value.studentCode || value.id).toUpperCase();
}

function nextCode(used: Set<string>, className: string) {
  const grade = gradeNumber(className);
  if (!grade) return "";
  const prefix = `TH${grade}`;
  for (let number = 1; number <= 999; number++) {
    const candidate = `${prefix}${String(number).padStart(3, "0")}`;
    if (!used.has(candidate)) return candidate;
  }
  return "";
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

export default function QuotaStudentFallback() {
  const session = useTeacherClient();
  const teacherId = session?.teacherId || "";
  const teacherName = session?.teacherName || "المعلم";
  const subjectKey = (session?.subjectKey as SubjectKey) || "history";
  const subject = session?.subject || getSubjectConfig(subjectKey).label;
  const storageKey = useMemo(() => `lahooni-pending-students:${teacherId}:${subjectKey}`, [teacherId, subjectKey]);
  const [pending, setPending] = useState<PendingStudent[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState("");
  const lastAttempt = useRef<Attempt | null>(null);

  useEffect(() => {
    if (!teacherId) return;
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || "[]");
      setPending(Array.isArray(stored) ? stored : []);
    } catch {
      setPending([]);
    }
  }, [storageKey, teacherId]);

  useEffect(() => {
    const captureAttempt = (event: Event) => {
      const button = (event.target as Element | null)?.closest("button");
      if (!button || clean(button.textContent) !== "إضافة الطالب") return;
      const editor = button.closest(".student-editor");
      const inputs = editor?.querySelectorAll<HTMLInputElement>("input.field");
      const studentName = clean(inputs?.[0]?.value);
      const className = clean(inputs?.[1]?.value);
      if (studentName && className) lastAttempt.current = { name: studentName, className, at: Date.now() };
    };

    const observeFailure = () => {
      const message = document.querySelector(".students-management .smart-message");
      if (clean(message?.textContent) !== "تعذر حفظ الطالب") return;
      const attempt = lastAttempt.current;
      if (!attempt || Date.now() - attempt.at > 20000 || !gradeNumber(attempt.className)) return;
      lastAttempt.current = null;

      setPending(current => {
        const duplicate = current.some(item => normalizeArabic(item.name) === normalizeArabic(attempt.name) && normalizeArabic(item.className) === normalizeArabic(attempt.className));
        if (duplicate) return current;
        const next = [...current, {
          id: crypto.randomUUID(),
          name: attempt.name,
          className: attempt.className,
          createdAt: new Date().toISOString(),
        }];
        localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
      setNotice("تم حفظ الطالب مؤقتًا في هذا الجهاز، وسيُرفع تلقائيًا عند عودة قاعدة البيانات.");

      const editor = document.querySelector(".student-editor");
      const inputs = editor?.querySelectorAll<HTMLInputElement>("input.field");
      if (inputs?.[0]) setInputValue(inputs[0], "");
    };

    document.addEventListener("click", captureAttempt, true);
    const observer = new MutationObserver(observeFailure);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    return () => {
      document.removeEventListener("click", captureAttempt, true);
      observer.disconnect();
    };
  }, [storageKey]);

  const syncPending = useCallback(async () => {
    if (!teacherId || !pending.length || syncing) return;
    setSyncing(true);
    setNotice("");
    const studentsPath = tenantCollection(teacherId, subjectKey, "students");
    const classesPath = tenantCollection(teacherId, subjectKey, "classes");

    try {
      const [localSnapshot, sharedSnapshot] = await Promise.all([
        getDocs(collection(db, studentsPath)),
        getDocs(collection(db, SHARED_STUDENTS)),
      ]);
      const used = new Set<string>();
      localSnapshot.docs.forEach(item => { const code = codeOf({ id: item.id, ...item.data() }); if (codePattern.test(code)) used.add(code); });
      sharedSnapshot.docs.forEach(item => { const code = codeOf({ id: item.id, ...item.data() }); if (codePattern.test(code)) used.add(code); });

      const remaining = [...pending];
      for (const item of [...pending]) {
        const grade = gradeNumber(item.className);
        if (!grade) continue;
        const code = item.code || nextCode(used, item.className);
        if (!code) continue;
        used.add(code);
        const rosterId = item.id;

        await setDoc(doc(db, classesPath, classId(item.className)), {
          name: item.className,
          teacherId,
          teacherName,
          subjectKey,
          updatedAt: serverTimestamp(),
        }, { merge: true });
        await setDoc(doc(db, SHARED_STUDENTS, rosterId), {
          name: item.name,
          class: item.className,
          grade,
          accessCode: code,
          studentCode: code,
          active: true,
          firstTeacherId: teacherId,
          firstTeacherName: teacherName,
          lastTeacherId: teacherId,
          lastTeacherName: teacherName,
          updatedAt: serverTimestamp(),
        }, { merge: true });
        await setDoc(doc(db, studentsPath, code), {
          name: item.name,
          class: item.className,
          grade,
          accessCode: code,
          studentCode: code,
          teacherId,
          teacherName,
          subjectKey,
          subject,
          sharedRosterId: rosterId,
          rosterActive: true,
          attendance: 0,
          homework: 0,
          participation: 0,
          research: 0,
          tests: [0, 0, 0, 0, 0],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true });

        const index = remaining.findIndex(entry => entry.id === item.id);
        if (index >= 0) remaining.splice(index, 1);
        localStorage.setItem(storageKey, JSON.stringify(remaining));
        setPending([...remaining]);
      }
      setNotice(remaining.length ? "بقيت أسماء لم تُرفع بعد. ستظل محفوظة في هذا الجهاز." : "تم رفع جميع الأسماء المحفوظة مؤقتًا إلى البوابة.");
    } catch {
      setNotice("قاعدة البيانات ما زالت متوقفة، والأسماء محفوظة بأمان في هذا الجهاز.");
    } finally {
      setSyncing(false);
    }
  }, [pending, storageKey, subject, subjectKey, syncing, teacherId, teacherName]);

  useEffect(() => {
    if (!pending.length) return;
    const onFocus = () => void syncPending();
    window.addEventListener("online", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("online", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [pending.length, syncPending]);

  if (!pending.length && !notice) return null;

  return <aside dir="rtl" style={{position:"fixed",left:16,bottom:16,zIndex:9999,width:"min(390px,calc(100vw - 32px))",background:"#fff",border:"1px solid #d7b56d",borderRadius:18,boxShadow:"0 16px 50px rgba(0,0,0,.18)",padding:16}}>
    <strong style={{display:"block",fontSize:17,marginBottom:6}}>الحفظ المؤقت للطلاب</strong>
    {notice ? <p style={{margin:"0 0 10px",lineHeight:1.7}}>{notice}</p> : null}
    {pending.length ? <><p style={{margin:"0 0 8px"}}>محفوظ في هذا الجهاز: <strong>{pending.length}</strong></p><div style={{maxHeight:150,overflow:"auto",marginBottom:10}}>{pending.map(item=><div key={item.id} style={{padding:"7px 0",borderBottom:"1px solid #eee"}}><strong>{item.name}</strong><small style={{display:"block"}}>{item.className}</small></div>)}</div><button type="button" disabled={syncing} onClick={()=>void syncPending()} style={{width:"100%",border:0,borderRadius:12,padding:"11px 14px",fontWeight:800,cursor:"pointer"}}>{syncing ? "جارٍ محاولة الرفع…" : "محاولة الرفع الآن"}</button></> : null}
  </aside>;
}
