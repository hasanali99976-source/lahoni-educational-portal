"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { collection, deleteDoc, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
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
  sharedRosterId?: string;
  rosterActive?: boolean;
  linkedFromSharedRoster?: boolean;
  active?: boolean;
  firstTeacherId?: string;
  firstTeacherName?: string;
  [key: string]: unknown;
};

type Assignment = { id: string; subjectId: string; grade: string; section: string; label: string };

const SHARED_STUDENTS = "school_shared_students";
const SHARED_CLASSES = "school_shared_classes";
const ARCHIVED_STUDENTS = "archivedStudents";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

const clean = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();
const normalizeArabic = (value: unknown) => clean(value)
  .replace(/[إأآ]/g, "ا")
  .replace(/ى/g, "ي")
  .replace(/ة/g, "ه")
  .replace(/[٠-٩]/g, digit => String(ARABIC_DIGITS.indexOf(digit)))
  .toLowerCase();
const normalizeClass = (value: unknown) => clean(value);
const identityOf = (student: Student) => `${normalizeArabic(student.class)}|${normalizeArabic(student.name)}`;
const legacyRosterId = (student: Student) => encodeURIComponent(`${identityOf(student)}|${codeOf(student)}`).replace(/%/g, "_").slice(0, 180);
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
  const archivePath = useMemo(() => teacherId ? tenantCollection(teacherId, subjectKey, ARCHIVED_STUDENTS) : "", [teacherId, subjectKey]);

  const [localStudents, setLocalStudents] = useState<Student[]>([]);
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
    if (!teacherId || !studentsPath) return;
    const stopStudents = onSnapshot(collection(db, studentsPath), snapshot => {
      setLocalStudents(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as Student)));
      localReady.current = true;
    });
    const stopShared = onSnapshot(collection(db, SHARED_STUDENTS), snapshot => {
      setSharedStudents(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as Student)));
      sharedReady.current = true;
    });
    return () => { stopStudents(); stopShared(); };
  }, [teacherId, studentsPath]);

  const subjectAssignments = useMemo(
    () => assignments.filter(item => item.subjectId === subjectKey),
    [assignments, subjectKey],
  );

  useEffect(() => {
    if (!teacherId || !studentsPath || !classesPath || !archivePath || !localReady.current || !sharedReady.current || syncing.current || !subjectAssignments.length) return;
    syncing.current = true;

    const run = async () => {
      const sharedById = new Map(sharedStudents.map(student => [student.id, student]));
      const sharedByCode = new Map<string, Student>();
      const sharedByIdentity = new Map<string, Student>();
      sharedStudents.forEach(student => {
        const code = codeOf(student);
        const identity = identityOf(student);
        if (code && !sharedByCode.has(code)) sharedByCode.set(code, student);
        if (identity !== "|" && !sharedByIdentity.has(identity)) sharedByIdentity.set(identity, student);
      });

      const localBySharedId = new Map<string, Student>();
      const localByCode = new Map<string, Student>();
      const localByIdentity = new Map<string, Student>();
      localStudents.forEach(student => {
        if (student.rosterActive === false) return;
        const rosterId = clean(student.sharedRosterId);
        const code = codeOf(student);
        const identity = identityOf(student);
        if (rosterId) localBySharedId.set(rosterId, student);
        if (code) localByCode.set(code, student);
        if (identity !== "|") localByIdentity.set(identity, student);
      });

      const findShared = (student: Student) => {
        const rosterId = clean(student.sharedRosterId);
        return (rosterId ? sharedById.get(rosterId) : undefined)
          || sharedByCode.get(codeOf(student))
          || sharedByIdentity.get(identityOf(student));
      };

      const archiveLocal = async (student: Student, reason: "deleted" | "transferred") => {
        const { id, ...data } = student;
        await setDoc(doc(db, archivePath, id), {
          ...data,
          sharedRosterId: clean(student.sharedRosterId),
          rosterActive: false,
          archivedReason: reason,
          archivedAt: serverTimestamp(),
        }, { merge: true });
        await deleteDoc(doc(db, studentsPath, id));
      };

      const ensureLocalFromShared = async (shared: Student) => {
        const name = clean(shared.name);
        const className = normalizeClass(shared.class);
        const code = codeOf(shared) || shared.id;
        if (!name || !className || !code) return;

        const identity = identityOf(shared);
        const existing = localBySharedId.get(shared.id) || localByCode.get(code) || localByIdentity.get(identity);
        const localId = existing?.id || code;
        const profile = {
          name,
          class: className,
          grade: shared.grade || null,
          accessCode: code,
          studentCode: code,
          teacherId,
          teacherName,
          subjectKey,
          subject,
          sharedRosterId: shared.id,
          rosterActive: true,
          linkedFromSharedRoster: true,
          updatedAt: serverTimestamp(),
        };

        await setDoc(doc(db, classesPath, classId(className)), {
          name: className,
          teacherId,
          teacherName,
          subjectKey,
          linkedFromAssignment: true,
          updatedAt: serverTimestamp(),
        }, { merge: true });

        if (existing) {
          await setDoc(doc(db, studentsPath, localId), profile, { merge: true });
          return;
        }

        const archivedReference = doc(db, archivePath, localId);
        const archivedSnapshot = await getDoc(archivedReference);
        const archivedData = archivedSnapshot.exists() ? archivedSnapshot.data() : {};
        await setDoc(doc(db, studentsPath, localId), {
          ...archivedData,
          ...profile,
          createdAt: archivedData.createdAt || serverTimestamp(),
          restoredAt: archivedSnapshot.exists() ? serverTimestamp() : null,
        }, { merge: true });
        if (archivedSnapshot.exists()) await deleteDoc(archivedReference);
      };

      // ترحيل السجلات القديمة إلى السجل الموحد، مع تثبيت معرف لا يتغير عند تعديل الاسم أو الفصل.
      for (const student of localStudents) {
        if (student.rosterActive === false) continue;
        const name = clean(student.name);
        const className = normalizeClass(student.class);
        if (!name || !className) continue;

        const shared = findShared(student);
        if (!shared) {
          const sharedRosterId = clean(student.sharedRosterId) || legacyRosterId({ ...student, name, class: className });
          const code = codeOf(student);
          await setDoc(doc(db, SHARED_STUDENTS, sharedRosterId), {
            name,
            class: className,
            grade: student.grade || null,
            accessCode: code,
            studentCode: code,
            active: true,
            firstTeacherId: student.teacherId || teacherId,
            firstTeacherName: student.teacherName || teacherName,
            lastTeacherId: teacherId,
            lastTeacherName: teacherName,
            updatedAt: serverTimestamp(),
          }, { merge: true });
          await setDoc(doc(db, studentsPath, student.id), {
            sharedRosterId,
            rosterActive: true,
            updatedAt: serverTimestamp(),
          }, { merge: true });
          continue;
        }

        const sharedClass = normalizeClass(shared.class);
        if (shared.active === false) {
          await archiveLocal({ ...student, sharedRosterId: shared.id }, "deleted");
          continue;
        }
        if (!subjectAssignments.some(item => assignmentMatchesClass(item, sharedClass))) {
          await archiveLocal({ ...student, sharedRosterId: shared.id }, "transferred");
          continue;
        }

        await setDoc(doc(db, studentsPath, student.id), {
          name: clean(shared.name),
          class: sharedClass,
          grade: shared.grade || null,
          accessCode: codeOf(shared) || codeOf(student),
          studentCode: codeOf(shared) || codeOf(student),
          sharedRosterId: shared.id,
          rosterActive: true,
          linkedFromSharedRoster: true,
          updatedAt: serverTimestamp(),
        }, { merge: true });
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

      // إضافة أو تحديث الطالب في كل مادة مسندة للفصل، مع دمج الملف الشخصي فقط والإبقاء على الدرجات كما هي.
      for (const shared of sharedStudents) {
        const className = normalizeClass(shared.class);
        if (shared.active === false || !className || !subjectAssignments.some(item => assignmentMatchesClass(item, className))) continue;
        await ensureLocalFromShared(shared);
      }
    };

    void run().finally(() => { syncing.current = false; });
  }, [teacherId, teacherName, subjectKey, subject, studentsPath, classesPath, archivePath, localStudents, sharedStudents, subjectAssignments]);

  return null;
}
