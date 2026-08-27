"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { tenantCollection, type SubjectKey } from "../../../lib/teacher-tenant";
import { useTeacherClient } from "../../../lib/teacher-client";

type Student = {
  id: string;
  name?: string;
  class?: string;
  accessCode?: string;
  studentCode?: string;
  grade?: number;
  teacherId?: string;
  teacherName?: string;
  subjectKey?: string;
  subject?: string;
  [key: string]: unknown;
};

type SavedClass = { id: string; name?: string; [key: string]: unknown };
type Assignment = { id: string; subjectId: string; grade: string; section: string; label: string };

const SHARED_STUDENTS = "school_shared_students";
const SHARED_CLASSES = "school_shared_classes";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

const clean = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();
const normalizeArabic = (value: unknown) => clean(value)
  .replace(/[إأآ]/g, "ا")
  .replace(/ى/g, "ي")
  .replace(/ة/g, "ه")
  .replace(/[٠-٩]/g, digit => String(ARABIC_DIGITS.indexOf(digit)))
  .toLowerCase();
const normalizeClass = (value: unknown) => clean(value);
const rosterId = (student: Student) => {
  const identity = `${normalizeArabic(student.class)}|${normalizeArabic(student.name)}`;
  return encodeURIComponent(identity).replace(/%/g, "_").slice(0, 180);
};
const classId = (name: string) => encodeURIComponent(normalizeArabic(name)).replace(/%/g, "_").slice(0, 140);
const codeOf = (student: Student) => clean(student.accessCode || student.studentCode || student.id).toUpperCase();

function assignmentMatchesClass(assignment: Assignment, className: string) {
  const classKey = normalizeArabic(className);
  const gradeKey = normalizeArabic(assignment.grade);
  const sectionKey = normalizeArabic(assignment.section);
  if (!classKey || !gradeKey || !classKey.includes(gradeKey)) return false;
  if (!sectionKey || sectionKey === "الكل") return true;
  const exactKey = normalizeArabic(`${assignment.grade} ${assignment.section}`);
  return classKey === exactKey || classKey.endsWith(` ${sectionKey}`) || classKey.endsWith(` فصل ${sectionKey}`);
}

export default function SharedRosterSync() {
  const session = useTeacherClient();
  const teacherId = session?.teacherId || "";
  const teacherName = session?.teacherName || "المعلم";
  const subjectKey = (session?.subjectKey as SubjectKey) || "history";
  const subject = session?.subject || "";

  const studentsPath = useMemo(() => teacherId ? tenantCollection(teacherId, subjectKey, "students") : "", [teacherId, subjectKey]);
  const classesPath = useMemo(() => teacherId ? tenantCollection(teacherId, subjectKey, "classes") : "", [teacherId, subjectKey]);

  const [localStudents, setLocalStudents] = useState<Student[]>([]);
  const [localClasses, setLocalClasses] = useState<SavedClass[]>([]);
  const [sharedStudents, setSharedStudents] = useState<Student[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const localReady = useRef(false);
  const sharedReady = useRef(false);
  const syncing = useRef(false);

  useEffect(() => {
    let active = true;
    fetch("/api/teacher-session", { cache: "no-store" })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (!active) return;
        setAssignments(Array.isArray(data?.assignments) ? data.assignments : []);
      })
      .catch(() => active && setAssignments([]));
    return () => { active = false; };
  }, [teacherId, subjectKey]);

  useEffect(() => {
    if (!teacherId || !studentsPath || !classesPath) return;
    const stopStudents = onSnapshot(collection(db, studentsPath), snapshot => {
      setLocalStudents(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as Student)));
      localReady.current = true;
    });
    const stopClasses = onSnapshot(collection(db, classesPath), snapshot => {
      setLocalClasses(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as SavedClass)));
    });
    const stopShared = onSnapshot(collection(db, SHARED_STUDENTS), snapshot => {
      setSharedStudents(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as Student)));
      sharedReady.current = true;
    });
    return () => { stopStudents(); stopClasses(); stopShared(); };
  }, [teacherId, studentsPath, classesPath]);

  const subjectAssignments = useMemo(
    () => assignments.filter(item => item.subjectId === subjectKey),
    [assignments, subjectKey],
  );

  useEffect(() => {
    if (!teacherId || !localReady.current || !sharedReady.current || syncing.current || !subjectAssignments.length) return;
    syncing.current = true;

    const run = async () => {
      const sharedByIdentity = new Map(sharedStudents.map(student => [`${normalizeArabic(student.class)}|${normalizeArabic(student.name)}`, student]));
      const localByIdentity = new Map(localStudents.map(student => [`${normalizeArabic(student.class)}|${normalizeArabic(student.name)}`, student]));

      // كل طالب يضيفه أي معلم يُحفظ في سجل المدرسة المشترك.
      for (const student of localStudents) {
        const name = clean(student.name);
        const className = normalizeClass(student.class);
        if (!name || !className) continue;
        const identity = `${normalizeArabic(className)}|${normalizeArabic(name)}`;
        const existingShared = sharedByIdentity.get(identity);
        const sharedCode = codeOf(existingShared || student);
        await setDoc(doc(db, SHARED_STUDENTS, rosterId({ ...student, name, class: className })), {
          name,
          class: className,
          grade: student.grade || existingShared?.grade || null,
          accessCode: sharedCode,
          studentCode: sharedCode,
          firstTeacherId: existingShared?.teacherId || student.teacherId || teacherId,
          firstTeacherName: existingShared?.teacherName || student.teacherName || teacherName,
          updatedAt: serverTimestamp(),
        }, { merge: true });
        await setDoc(doc(db, SHARED_CLASSES, classId(className)), { name: className, updatedAt: serverTimestamp() }, { merge: true });
      }

      // الفصول المحددة للمعلم من الإدارة تُنشأ تلقائيًا في مادته.
      for (const assignment of subjectAssignments) {
        if (normalizeArabic(assignment.section) !== "الكل") {
          const assignedClass = normalizeClass(`${assignment.grade} ${assignment.section}`);
          await setDoc(doc(db, classesPath, classId(assignedClass)), {
            name: assignedClass,
            teacherId,
            teacherName,
            subjectKey,
            linkedFromAssignment: true,
            updatedAt: serverTimestamp(),
          }, { merge: true });
        }
      }

      // نسخ طلاب كل فصل مسند للمعلم مباشرة، دون أن يضيف الفصل يدويًا.
      for (const shared of sharedStudents) {
        const name = clean(shared.name);
        const className = normalizeClass(shared.class);
        if (!name || !className || !subjectAssignments.some(item => assignmentMatchesClass(item, className))) continue;
        const identity = `${normalizeArabic(className)}|${normalizeArabic(name)}`;
        if (localByIdentity.has(identity)) continue;
        const code = codeOf(shared) || shared.id;
        await setDoc(doc(db, classesPath, classId(className)), {
          name: className,
          teacherId,
          teacherName,
          subjectKey,
          linkedFromAssignment: true,
          updatedAt: serverTimestamp(),
        }, { merge: true });
        await setDoc(doc(db, studentsPath, code), {
          name,
          class: className,
          grade: shared.grade || null,
          accessCode: code,
          studentCode: code,
          teacherId,
          teacherName,
          subjectKey,
          subject,
          linkedFromSharedRoster: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
    };

    void run().finally(() => { syncing.current = false; });
  }, [teacherId, teacherName, subjectKey, subject, studentsPath, classesPath, localStudents, localClasses, sharedStudents, subjectAssignments]);

  return null;
}
