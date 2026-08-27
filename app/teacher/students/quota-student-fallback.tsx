"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { collection, doc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { getSubjectConfig } from "../../../lib/subject-config";
import { useTeacherClient } from "../../../lib/teacher-client";
import { tenantCollection, type SubjectKey } from "../../../lib/teacher-tenant";

type PendingStudent = {
  id: string;
  name: string;
  className: string;
  code: string;
  createdAt: string;
};

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
  const [tableTarget, setTableTarget] = useState<HTMLTableSectionElement | null>(null);
  const [messageTarget, setMessageTarget] = useState<HTMLElement | null>(null);

  const savePending = useCallback((items: PendingStudent[]) => {
    setPending(items);
    if (teacherId) localStorage.setItem(storageKey, JSON.stringify(items));
  }, [storageKey, teacherId]);

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
    const attach = () => {
      setTableTarget(document.querySelector<HTMLTableSectionElement>(".students-management .table-wrap tbody"));
      setMessageTarget(document.querySelector<HTMLElement>(".students-management .students-toolbar"));
    };
    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleAdd = (event: Event) => {
      const button = (event.target as Element | null)?.closest("button");
      if (!button || clean(button.textContent) !== "إضافة الطالب") return;
      const editor = button.closest(".student-editor");
      const inputs = editor?.querySelectorAll<HTMLInputElement>("input.field");
      const studentName = clean(inputs?.[0]?.value);
      const className = clean(inputs?.[1]?.value);
      if (!studentName || !className || !gradeNumber(className)) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const duplicate = pending.some(item => normalizeArabic(item.name) === normalizeArabic(studentName)
        && normalizeArabic(item.className) === normalizeArabic(className));
      if (duplicate) {
        setNotice("الاسم موجود مسبقًا في هذا الفصل.");
        return;
      }

      const previewCode = clean(editor?.querySelector(".student-code-preview strong")?.textContent).toUpperCase();
      const used = new Set(pending.map(item => item.code).filter(code => codePattern.test(code)));
      const code = codePattern.test(previewCode) && !used.has(previewCode)
        ? previewCode
        : nextCode(used, className);
      if (!code) {
        setNotice("تعذر إنشاء كود للطالب.");
        return;
      }

      const next = [...pending, {
        id: crypto.randomUUID(),
        name: studentName,
        className,
        code,
        createdAt: new Date().toISOString(),
      }];
      savePending(next);
      setNotice(`تمت إضافة ${studentName} إلى ${className} — الكود: ${code}`);
      if (inputs?.[0]) setInputValue(inputs[0], "");
    };

    document.addEventListener("click", handleAdd, true);
    return () => document.removeEventListener("click", handleAdd, true);
  }, [pending, savePending]);

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
      localSnapshot.docs.forEach(item => {
        const code = codeOf({ id: item.id, ...item.data() });
        if (codePattern.test(code)) used.add(code);
      });
      sharedSnapshot.docs.forEach(item => {
        const code = codeOf({ id: item.id, ...item.data() });
        if (codePattern.test(code)) used.add(code);
      });

      const remaining = [...pending];
      for (const item of [...pending]) {
        const grade = gradeNumber(item.className);
        if (!grade) continue;
        const code = codePattern.test(item.code) && !used.has(item.code)
          ? item.code
          : nextCode(used, item.className);
        if (!code) continue;
        used.add(code);

        await setDoc(doc(db, classesPath, classId(item.className)), {
          name: item.className,
          teacherId,
          teacherName,
          subjectKey,
          updatedAt: serverTimestamp(),
        }, { merge: true });
        await setDoc(doc(db, SHARED_STUDENTS, item.id), {
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
          sharedRosterId: item.id,
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
        savePending([...remaining]);
      }
      setNotice(remaining.length ? "بقيت أسماء لم تُرفع بعد." : "تم رفع جميع الأسماء إلى البوابة.");
    } catch {
      setNotice("الأسماء موجودة الآن داخل القوائم بأكوادها، وتعذر فقط رفعها للخادم حاليًا.");
    } finally {
      setSyncing(false);
    }
  }, [pending, savePending, subject, subjectKey, syncing, teacherId, teacherName]);

  const selectedClass = clean(document?.querySelector(".students-management .class-toolbar h2")?.textContent);
  const visiblePending = pending.filter(item => !selectedClass || item.className === selectedClass);

  const rows = tableTarget ? createPortal(<>
    {visiblePending.map((student, index) => <tr key={`pending-${student.id}`}>
      <td>{index + 1}</td>
      <td><strong>{student.name}</strong></td>
      <td>{student.className}</td>
      <td><button className="code-button" type="button">{student.code}</button></td>
      <td><div className="row-actions"><button type="button" onClick={() => savePending(pending.filter(item => item.id !== student.id))}>حذف</button></div></td>
    </tr>)}
  </>, tableTarget) : null;

  const banner = messageTarget && (notice || pending.length) ? createPortal(
    <div className="smart-message" style={{marginTop:10}}>
      <strong>{notice || `تمت إضافة ${pending.length} طالبًا بأكوادهم داخل القوائم.`}</strong>
      {pending.length ? <button className="btn secondary" type="button" disabled={syncing} onClick={() => void syncPending()} style={{marginInlineStart:10}}>{syncing ? "جارٍ الرفع…" : "رفع للخادم"}</button> : null}
    </div>,
    messageTarget
  ) : null;

  return <>{rows}{banner}</>;
}
