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
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

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
    let mount: HTMLDivElement | null = null;
    const attach = () => {
      const editor = document.querySelector(".students-management .student-editor");
      if (!editor || mount) return;
      mount = document.createElement("div");
      mount.dataset.pendingStudents = "true";
      editor.insertAdjacentElement("afterend", mount);
      setPortalTarget(mount);
    };
    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      mount?.remove();
      setPortalTarget(null);
    };
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

      const next = [...pending, {
        id: crypto.randomUUID(),
        name: studentName,
        className,
        createdAt: new Date().toISOString(),
      }];
      savePending(next);
      setNotice(`تمت إضافة ${studentName} إلى ${className} وحفظه في هذا الجهاز.`);
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
        const code = nextCode(used, item.className);
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
      setNotice(remaining.length
        ? "بقيت أسماء لم تُرفع بعد، لكنها محفوظة في هذا الجهاز."
        : "تم رفع جميع الأسماء إلى الفصول في البوابة.");
    } catch {
      setNotice("قاعدة البيانات ما زالت متوقفة، لكن الأسماء محفوظة داخل فصولها في هذا الجهاز.");
    } finally {
      setSyncing(false);
    }
  }, [pending, savePending, subject, subjectKey, syncing, teacherId, teacherName]);

  const removePending = (id: string) => {
    const next = pending.filter(item => item.id !== id);
    savePending(next);
    setNotice("تم حذف الاسم المحفوظ مؤقتًا فقط، ولم تتأثر بيانات التحضير أو الدرجات.");
  };

  const grouped = useMemo(() => {
    const map = new Map<string, PendingStudent[]>();
    pending.forEach(item => map.set(item.className, [...(map.get(item.className) || []), item]));
    return [...map.entries()];
  }, [pending]);

  const panel = pending.length ? <section className="card" style={{marginBottom:18}}>
    <div className="class-toolbar" style={{marginBottom:12}}>
      <div><h2 style={{margin:0}}>الأسماء المضافة إلى الفصول</h2><small>محفوظة الآن في هذا الجهاز، ولن يضيع التحضير أو الدرجات.</small></div>
      <button className="btn primary" type="button" disabled={syncing} onClick={() => void syncPending()}>
        {syncing ? "جارٍ الرفع…" : "رفع الأسماء إلى البوابة"}
      </button>
    </div>
    {notice ? <p className="smart-message">{notice}</p> : null}
    <div className="table-wrap"><table><thead><tr><th>الفصل</th><th>اسم الطالب</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>
      {grouped.flatMap(([className, students]) => students.map((student, index) => <tr key={student.id}>
        <td>{index === 0 ? <strong>{className}</strong> : ""}</td>
        <td><strong>{student.name}</strong></td>
        <td>محفوظ في الفصل — بانتظار الرفع</td>
        <td><button type="button" onClick={() => removePending(student.id)}>حذف الاسم المؤقت</button></td>
      </tr>))}
    </tbody></table></div>
  </section> : notice ? <div className="smart-message" style={{marginBottom:16}}>{notice}</div> : null;

  return portalTarget && panel ? createPortal(panel, portalTarget) : null;
}
