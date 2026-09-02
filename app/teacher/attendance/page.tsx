"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, setDoc } from "firebase/firestore";
import * as XLSX from "xlsx";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { db } from "../../../lib/firebase";
import { tenantCollection, type SubjectKey } from "../../../lib/teacher-tenant";
import { useTeacherClient } from "../../../lib/teacher-client";
import { canonicalClassName, gradeNumber as rosterGradeNumber, sectionNumber as rosterSectionNumber } from "../../../lib/school-roster";
import {
  assignmentClassNames,
  classMatchesAssignments,
  clean,
  hasDetailedAssignments,
  loadDeletedCodes,
  loadLocalRoster,
  mergeStudents,
  normalizeClass,
  saveLocalRoster,
  studentCode,
  type UnifiedStudent,
} from "../../../lib/unified-roster";
import "./attendance.css";

type AttendanceStatus = "present" | "absent" | "late" | "excused" | "escaped";
type AttendanceDocument = {
  class?: string;
  date?: string;
  records?: Record<string, AttendanceStatus>;
  teacherId?: string;
  subjectKey?: string;
  updatedAt?: string;
};
type RangeRow = {
  number: number;
  name: string;
  present: number;
  absentDates: string[];
  lateDates: string[];
  excusedDates: string[];
  escapedDates: string[];
  attendanceRate: number;
};
type TimetableLesson = { className?: string };

const PORTAL_NAME = "بوابة أستاذ لحوني التعليمية";
const ATTENDANCE_START_DATE = "2026-08-23";
const ATTENDANCE_START_LABEL = "الأحد 23/8/2026";
const SCHOOL_DAY_END_HOUR = 15;
const TIMETABLE_DAY_INDEX = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4 } as const;
const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "حاضر",
  absent: "غائب",
  late: "متأخر",
  excused: "مستأذن",
  escaped: "هروب",
};

function toDateInput(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function attendanceToday() {
  return toDateInput(new Date());
}

function riyadhHour(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Riyadh",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Number(parts.find(part => part.type === "hour")?.value || 0);
}

function isFutureAttendanceDate(value: string) {
  return Boolean(value && value > attendanceToday());
}

function clampAttendanceDate(value: string) {
  const today = attendanceToday();
  if (!value) return today;
  if (value < ATTENDANCE_START_DATE) return ATTENDANCE_START_DATE;
  return value > today ? today : value;
}

function formatHijri(value: string) {
  return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-arab", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function formatShortDate(value: string) {
  const [, month, day] = value.split("-");
  return `${day}/${month}`;
}

function safeId(value: string) {
  return encodeURIComponent(value).replace(/%/g, "_");
}

function safeFile(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "-");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[character] || character));
}

function startOfCurrentWeek() {
  const date = new Date();
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  return toDateInput(date);
}

function datesText(values: string[]) {
  return values.length ? values.map(formatShortDate).join("، ") : "—";
}

function attendanceKey(teacherId: string, subjectKey: string, className: string, date: string) {
  return `lahooni-attendance:${teacherId}:${subjectKey}:${safeId(className)}:${date}`;
}

function legacyAttendanceKey(teacherId: string, subjectKey: string, className: string, date: string) {
  return `lahooni-local-attendance:${teacherId}:${subjectKey}:${className}:${date}`;
}

function attendanceIndexKey(teacherId: string, subjectKey: string) {
  return `lahooni-attendance-index:${teacherId}:${subjectKey}`;
}

function attendanceDeletedKey(teacherId: string, subjectKey: string, className: string, date: string) {
  return `lahooni-attendance-deleted:${teacherId}:${subjectKey}:${safeId(className)}:${date}`;
}

function readRecords(key: string) {
  if (typeof window === "undefined" || !key) return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "null");
    return parsed && typeof parsed === "object" ? parsed as Record<string, AttendanceStatus> : null;
  } catch {
    return null;
  }
}

function readAttendanceIndex(teacherId: string, subjectKey: string) {
  if (typeof window === "undefined" || !teacherId) return {} as Record<string, AttendanceDocument>;
  try {
    const parsed = JSON.parse(localStorage.getItem(attendanceIndexKey(teacherId, subjectKey)) || "{}");
    return parsed && typeof parsed === "object" ? parsed as Record<string, AttendanceDocument> : {};
  } catch {
    return {};
  }
}

function withTimeout<T>(promise: Promise<T>, milliseconds: number) {
  return Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => window.setTimeout(() => reject(new Error("timeout")), milliseconds)),
  ]);
}

function canonicalClassFromParts(gradeValue: unknown, sectionValue: unknown, classValue: unknown) {
  const rawClassName = clean(classValue);
  const grade = rosterGradeNumber(gradeValue || rawClassName);
  const section = rosterSectionNumber(sectionValue, rawClassName);
  return grade && section
    ? canonicalClassName(grade, section)
    : normalizeClass(rawClassName) || rawClassName;
}

function classNamesFromPayload(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return value.map(item => {
    if (typeof item === "string") return normalizeClass(item) || clean(item);
    if (!item || typeof item !== "object") return "";
    const row = item as Record<string, unknown>;
    return canonicalClassFromParts(
      row.grade,
      row.section,
      row.name || row.className || row.class || row.id,
    );
  }).filter(Boolean);
}

export default function AttendancePage() {
  const session = useTeacherClient();
  const teacherId = session?.teacherId || "";
  const teacherName = session?.teacherName || "";
  const subjectKey = (session?.subjectKey as SubjectKey) || "history";
  const subject = session?.subject || "";
  const ready = !!teacherId && !!session?.subjectKey;
  const assignments = session?.assignments || [];

  const [localStudents, setLocalStudents] = useState<UnifiedStudent[]>([]);
  const [officialStudents, setOfficialStudents] = useState<UnifiedStudent[]>([]);
  const [officialClasses, setOfficialClasses] = useState<string[]>([]);
  const [timetableClasses, setTimetableClasses] = useState<string[]>([]);
  const [timetableLessons, setTimetableLessons] = useState<Record<string, TimetableLesson>>({});
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedDate, setSelectedDate] = useState(clampAttendanceDate(toDateInput(new Date())));
  const [reportFrom, setReportFrom] = useState(clampAttendanceDate(startOfCurrentWeek()));
  const [reportTo, setReportTo] = useState(clampAttendanceDate(toDateInput(new Date())));
  const [records, setRecords] = useState<Record<string, AttendanceStatus>>({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hasSavedRecord, setHasSavedRecord] = useState(false);
  const [reporting, setReporting] = useState(false);
  const autoFillKeyRef = useRef("");
  const cloudSyncTimerRef = useRef<number | null>(null);
  const [clockTick, setClockTick] = useState(0);

  const attendancePath = useMemo(
    () => (teacherId ? tenantCollection(teacherId, subjectKey, "attendance") : ""),
    [teacherId, subjectKey],
  );

  useEffect(() => () => {
    if (cloudSyncTimerRef.current !== null) window.clearTimeout(cloudSyncTimerRef.current);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setClockTick(value => value + 1), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const assignmentScoped = useMemo(
    () => hasDetailedAssignments(assignments, subjectKey),
    [assignments, subjectKey],
  );
  const assignedClasses = useMemo(
    () => assignmentClassNames(assignments, subjectKey),
    [assignments, subjectKey],
  );
  const classAllowed = (className: string) => !assignmentScoped || classMatchesAssignments(className, assignments, subjectKey);

  useEffect(() => {
    if (!teacherId) return;
    const load = () => setLocalStudents(loadLocalRoster(teacherId, subjectKey));
    load();
    window.addEventListener("storage", load);
    window.addEventListener("lahooni-roster-updated", load as EventListener);
    return () => {
      window.removeEventListener("storage", load);
      window.removeEventListener("lahooni-roster-updated", load as EventListener);
    };
  }, [teacherId, subjectKey]);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 8000);
    const params = new URLSearchParams({ subjectId: subjectKey });
    if (session?.activeGrade) params.set("grade", String(session.activeGrade));

    fetch(`/api/teacher/students?${params.toString()}`, {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(response => response.ok ? response.json() : Promise.reject(new Error("roster_load_failed")))
      .then(data => {
        if (!active) return;
        const list = (Array.isArray(data.students) ? data.students : []).map((student: Record<string, unknown>) => {
          const code = String(student.code || student.accessCode || student.studentCode || student.id || "").trim().toUpperCase();
          const className = canonicalClassFromParts(
            student.grade,
            student.section,
            student.className || student.class,
          );
          return {
            ...student,
            id: code,
            code,
            accessCode: code,
            studentCode: code,
            class: className,
            className,
            active: student.active !== false,
            rosterActive: student.active !== false,
          } as UnifiedStudent;
        }).filter((student: UnifiedStudent) => !!student.id && !!student.name && !!student.class);

        const receivedClasses = [
          ...classNamesFromPayload(data.classes),
          ...classNamesFromPayload(data.availableClasses),
        ];
        setOfficialClasses([...new Set(receivedClasses)]);
        setOfficialStudents(list);
        const cached = loadLocalRoster(teacherId, subjectKey);
        const merged = mergeStudents(cached, list);
        setLocalStudents(merged);
        if (JSON.stringify(cached) !== JSON.stringify(merged)) saveLocalRoster(teacherId, merged, subjectKey);
      })
      .catch(() => {
        if (active) setMessage(current => current || "تعذر تحديث القائمة الرسمية، وتم عرض النسخة المحفوظة على الجهاز.");
      })
      .finally(() => window.clearTimeout(timer));

    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [ready, teacherId, subjectKey, session?.activeGrade]);


  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    fetch(`/api/teacher/timetable?subjectId=${encodeURIComponent(subjectKey)}`, {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(response => response.ok ? response.json() : Promise.reject(new Error("timetable_load_failed")))
      .then(data => {
        const lessonMap = data.lessons && typeof data.lessons === "object"
          ? data.lessons as Record<string, TimetableLesson>
          : {};
        const lessons = Object.values(lessonMap);
        setTimetableLessons(lessonMap);
        setTimetableClasses([...new Set(lessons.map(lesson => normalizeClass(lesson.className)).filter(Boolean))]);
      })
      .catch(() => {
        setTimetableLessons({});
        setTimetableClasses([]);
      });
    return () => controller.abort();
  }, [ready, subjectKey]);

  // القائمة الرسمية التي يعرضها الخادم هي المرجع نفسه المستخدم في صفحة الدرجات.
  // لا نعيد فلترتها في المتصفح حتى لا يسقط فصل صحيح بسبب صيغة تكليف قديمة.
  const scopedOfficialStudents = useMemo(() => officialStudents, [officialStudents]);
  const scopedLocalStudents = useMemo(
    () => localStudents.filter(student => classAllowed(normalizeClass(student.class) || clean(student.class))),
    [localStudents, assignmentScoped, assignments, subjectKey],
  );

  const students = useMemo(() => {
    const deleted = loadDeletedCodes(teacherId);
    const source = scopedOfficialStudents.length
      ? scopedOfficialStudents
      : mergeStudents(scopedLocalStudents, scopedOfficialStudents);
    return source.filter(student => {
      const code = studentCode(student);
      return !deleted.has(code) && student.active !== false && student.rosterActive !== false;
    });
  }, [scopedOfficialStudents, scopedLocalStudents, teacherId]);

  const officialStudentClasses = useMemo(
    () => officialStudents
      .map(student => normalizeClass(student.class) || clean(student.class))
      .filter(Boolean),
    [officialStudents],
  );

  const classes = useMemo(() => {
    const officialSource = [...officialClasses, ...officialStudentClasses].filter(Boolean);
    const fallbackSource = [
      ...assignedClasses,
      ...timetableClasses,
      ...students.map(student => normalizeClass(student.class) || clean(student.class)),
    ].filter(Boolean).filter(classAllowed);
    const source = officialSource.length ? officialSource : fallbackSource;
    return [...new Set(source)].sort((a, b) => a.localeCompare(b, "ar", { numeric: true }));
  }, [officialClasses, officialStudentClasses, assignedClasses, timetableClasses, students, assignmentScoped, assignments, subjectKey]);

  useEffect(() => {
    if (!ready || !teacherId || !attendancePath || !students.length || !Object.keys(timetableLessons).length) return;
    const today = attendanceToday();
    const lastCompletedDate = riyadhHour() >= SCHOOL_DAY_END_HOUR
      ? today
      : toDateInput(new Date(`${today}T12:00:00+03:00`));
    const completedDate = riyadhHour() >= SCHOOL_DAY_END_HOUR
      ? lastCompletedDate
      : (() => {
          const value = new Date(`${today}T12:00:00+03:00`);
          value.setDate(value.getDate() - 1);
          return toDateInput(value);
        })();
    const runKey = `${teacherId}:${subjectKey}:${completedDate}:${students.length}:${Object.keys(timetableLessons).length}`;
    if (autoFillKeyRef.current === runKey) return;
    autoFillKeyRef.current = runKey;
    let active = true;

    async function autoSaveMissedScheduledDays() {
      const endDate = completedDate;
      if (endDate < ATTENDANCE_START_DATE) return;

      const rosterByClass = new Map<string, UnifiedStudent[]>();
      students.forEach(student => {
        const className = normalizeClass(student.class) || clean(student.class);
        if (!className) return;
        rosterByClass.set(className, [...(rosterByClass.get(className) || []), student]);
      });

      const scheduleByDay = new Map<number, Set<string>>();
      Object.entries(timetableLessons).forEach(([cell, lesson]) => {
        const match = cell.match(/^(sunday|monday|tuesday|wednesday|thursday)-[1-7]$/);
        const className = normalizeClass(lesson.className) || clean(lesson.className);
        if (!match || !className) return;
        const weekday = TIMETABLE_DAY_INDEX[match[1] as keyof typeof TIMETABLE_DAY_INDEX];
        const classes = scheduleByDay.get(weekday) || new Set<string>();
        classes.add(className);
        scheduleByDay.set(weekday, classes);
      });
      if (!scheduleByDay.size) return;

      const existing = new Set<string>();
      const localIndex = readAttendanceIndex(teacherId, subjectKey);
      Object.values(localIndex).forEach(item => {
        const className = normalizeClass(item.class) || clean(item.class);
        if (className && item.date) existing.add(`${className}|${item.date}`);
      });
      try {
        const snapshot = await withTimeout(getDocs(collection(db, attendancePath)), 6500);
        snapshot.docs.forEach(item => {
          const data = item.data() as AttendanceDocument;
          const className = normalizeClass(data.class) || clean(data.class);
          if (className && data.date) existing.add(`${className}|${data.date}`);
        });
      } catch {
        // النسخة المحلية تكفي لإكمال الأيام غير المسجلة عند ضعف الاتصال.
      }

      const pending: { className: string; date: string; records: Record<string, AttendanceStatus> }[] = [];
      const cursor = new Date(`${ATTENDANCE_START_DATE}T12:00:00`);
      const last = new Date(`${endDate}T12:00:00`);
      while (cursor <= last) {
        const date = toDateInput(cursor);
        const classes = scheduleByDay.get(cursor.getDay());
        classes?.forEach(className => {
          const canonical = normalizeClass(className) || className;
          const roster = rosterByClass.get(canonical) || [];
          if (!roster.length || existing.has(`${canonical}|${date}`)) return;
          if (localStorage.getItem(attendanceDeletedKey(teacherId, subjectKey, canonical, date))) return;
          pending.push({
            className: canonical,
            date,
            records: Object.fromEntries(roster.map(student => [studentCode(student), "present" as AttendanceStatus])),
          });
          existing.add(`${canonical}|${date}`);
        });
        cursor.setDate(cursor.getDate() + 1);
      }
      if (!pending.length) return;

      const nextIndex = readAttendanceIndex(teacherId, subjectKey);
      let saved = 0;
      for (const item of pending) {
        if (!active) return;
        const payload = {
          class: item.className,
          date: item.date,
          hijriDate: formatHijri(item.date),
          records: item.records,
          teacherId,
          teacherName,
          subjectKey,
          subject,
          autoSaved: true,
          autoSavedReason: "missed_scheduled_day",
          updatedAt: new Date().toISOString(),
        };
        try {
          await withTimeout(setDoc(doc(db, attendancePath, `${safeId(item.className)}_${item.date}`), payload, { merge: true }), 5000);
        } catch {
          // يحفظ محليًا ويُعاد دمجه عند توفر الاتصال.
        }
        const key = attendanceKey(teacherId, subjectKey, item.className, item.date);
        localStorage.setItem(key, JSON.stringify(item.records));
        localStorage.setItem(`${key}:details`, JSON.stringify(payload));
        nextIndex[`${safeId(item.className)}_${item.date}`] = payload;
        saved += 1;
      }
      localStorage.setItem(attendanceIndexKey(teacherId, subjectKey), JSON.stringify(nextIndex));
      if (active && saved) setMessage(`تم الحفظ التلقائي لـ ${saved} تحضير فائت حسب جدول المعلم، والحالة الافتراضية لجميع الطلاب: حاضر.`);
    }

    void autoSaveMissedScheduledDays();
    return () => { active = false; };
  }, [ready, teacherId, teacherName, subjectKey, subject, attendancePath, students, timetableLessons, clockTick]);

  const classStudents = useMemo(
    () => students.filter(student => (normalizeClass(student.class) || clean(student.class)) === selectedClass),
    [students, selectedClass],
  );

  useEffect(() => {
    if (!classes.length) {
      setSelectedClass("");
      return;
    }
    if (!selectedClass || !classes.includes(selectedClass)) setSelectedClass(classes[0]);
  }, [classes, selectedClass]);

  useEffect(() => {
    if (!selectedClass || !attendancePath) {
      setRecords({});
      setHasSavedRecord(false);
      return;
    }
    const defaults = Object.fromEntries(classStudents.map(student => [studentCode(student), "present" as AttendanceStatus]));
    if (selectedDate < ATTENDANCE_START_DATE) {
      setRecords(defaults);
      setHasSavedRecord(false);
      return;
    }

    const key = attendanceKey(teacherId, subjectKey, selectedClass, selectedDate);
    const documentId = `${safeId(selectedClass)}_${selectedDate}`;
    const applyLocalFallback = () => {
      const local = readRecords(key) || readRecords(legacyAttendanceKey(teacherId, subjectKey, selectedClass, selectedDate));
      if (local && !localStorage.getItem(attendanceDeletedKey(teacherId, subjectKey, selectedClass, selectedDate))) {
        setRecords(Object.fromEntries(classStudents.map(student => [studentCode(student), local[studentCode(student)] || "present"])));
        setHasSavedRecord(true);
      } else {
        setRecords(defaults);
        setHasSavedRecord(false);
      }
    };
    applyLocalFallback();

    const unsubscribe = onSnapshot(
      doc(db, attendancePath, documentId),
      snapshot => {
        if (!snapshot.exists()) {
          applyLocalFallback();
          return;
        }
        const data = snapshot.data() as AttendanceDocument;
        const saved = data.records || {};
        const next = Object.fromEntries(classStudents.map(student => [studentCode(student), saved[studentCode(student)] || saved[student.id] || "present"])) as Record<string, AttendanceStatus>;
        setRecords(next);
        setHasSavedRecord(true);
        localStorage.setItem(key, JSON.stringify(next));
        localStorage.setItem(`${key}:details`, JSON.stringify(data));
        const index = readAttendanceIndex(teacherId, subjectKey);
        index[documentId] = data;
        localStorage.setItem(attendanceIndexKey(teacherId, subjectKey), JSON.stringify(index));
        localStorage.removeItem(attendanceDeletedKey(teacherId, subjectKey, selectedClass, selectedDate));
      },
      () => applyLocalFallback(),
    );

    return unsubscribe;
  }, [selectedClass, selectedDate, classStudents, attendancePath, teacherId, subjectKey]);

  const counts = useMemo(() => {
    const values = classStudents.map(student => records[studentCode(student)] || "present");
    return {
      present: values.filter(value => value === "present").length,
      absent: values.filter(value => value === "absent").length,
      late: values.filter(value => value === "late").length,
      excused: values.filter(value => value === "excused").length,
      escaped: values.filter(value => value === "escaped").length,
    };
  }, [classStudents, records]);

  function persistLocal(nextRecords: Record<string, AttendanceStatus>) {
    if (!selectedClass || !teacherId || selectedDate < ATTENDANCE_START_DATE || isFutureAttendanceDate(selectedDate)) return;
    const payload: AttendanceDocument = {
      class: selectedClass,
      date: selectedDate,
      records: nextRecords,
      teacherId,
      subjectKey,
      updatedAt: new Date().toISOString(),
    };
    const key = attendanceKey(teacherId, subjectKey, selectedClass, selectedDate);
    localStorage.setItem(key, JSON.stringify(nextRecords));
    localStorage.setItem(`${key}:details`, JSON.stringify(payload));
    const index = readAttendanceIndex(teacherId, subjectKey);
    index[`${safeId(selectedClass)}_${selectedDate}`] = payload;
    localStorage.setItem(attendanceIndexKey(teacherId, subjectKey), JSON.stringify(index));
    localStorage.removeItem(attendanceDeletedKey(teacherId, subjectKey, selectedClass, selectedDate));
    setHasSavedRecord(true);
    window.dispatchEvent(new CustomEvent("lahooni:attendance-updated", { detail: payload }));
  }

  function queueCloudAttendanceSync(nextRecords: Record<string, AttendanceStatus>) {
    const className = selectedClass;
    const date = selectedDate;
    const path = attendancePath;
    if (!className || !path || date < ATTENDANCE_START_DATE || isFutureAttendanceDate(date)) return;
    if (cloudSyncTimerRef.current !== null) window.clearTimeout(cloudSyncTimerRef.current);
    cloudSyncTimerRef.current = window.setTimeout(async () => {
      cloudSyncTimerRef.current = null;
      try {
        await withTimeout(setDoc(
          doc(db, path, `${safeId(className)}_${date}`),
          {
            class: className,
            date,
            hijriDate: formatHijri(date),
            records: nextRecords,
            teacherId,
            teacherName,
            subjectKey,
            subject,
            autoSaved: false,
            autoSavedReason: null,
            manualEdited: true,
            manualEditedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          { merge: true },
        ), 5000);
        setMessage("تمت مزامنة التعديل فورًا في التطبيق والويب وبوابة الطالب");
      } catch {
        setMessage("تم حفظ التعديل على الجهاز، وستتم مزامنته عند الضغط على حفظ التحضير أو عودة الاتصال");
      }
    }, 450);
  }

  function clearLocalAttendance() {
    if (!selectedClass || !teacherId) return;
    const key = attendanceKey(teacherId, subjectKey, selectedClass, selectedDate);
    localStorage.removeItem(key);
    localStorage.removeItem(`${key}:details`);
    localStorage.removeItem(legacyAttendanceKey(teacherId, subjectKey, selectedClass, selectedDate));
    const index = readAttendanceIndex(teacherId, subjectKey);
    delete index[`${safeId(selectedClass)}_${selectedDate}`];
    localStorage.setItem(attendanceIndexKey(teacherId, subjectKey), JSON.stringify(index));
    localStorage.setItem(attendanceDeletedKey(teacherId, subjectKey, selectedClass, selectedDate), "1");
  }

  function setStudentStatus(student: UnifiedStudent, status: AttendanceStatus) {
    if (selectedDate < ATTENDANCE_START_DATE) {
      setMessage(`يبدأ التحضير من ${ATTENDANCE_START_LABEL} ولا يمكن التسجيل قبل هذا التاريخ.`);
      return;
    }
    if (isFutureAttendanceDate(selectedDate)) {
      setMessage("لا يفتح تحضير اليوم إلا عند الساعة 12:00 منتصف الليل مع بداية اليوم نفسه.");
      return;
    }
    const code = studentCode(student);
    const next = { ...records, [code]: status };
    setRecords(next);
    persistLocal(next);
    queueCloudAttendanceSync(next);
    setMessage("تم الحفظ مباشرة وجارٍ توحيد التعديل في التطبيق والويب وبوابة الطالب");
  }

  function moveDay(amount: number) {
    const date = new Date(`${selectedDate}T12:00:00`);
    date.setDate(date.getDate() + amount);
    setSelectedDate(clampAttendanceDate(toDateInput(date)));
  }

  async function saveAttendance() {
    if (!selectedClass || !attendancePath) return setMessage("اختر الفصل أولًا");
    if (selectedDate < ATTENDANCE_START_DATE) return setMessage(`يبدأ التحضير من ${ATTENDANCE_START_LABEL} ولا يمكن الحفظ قبل هذا التاريخ.`);
    if (isFutureAttendanceDate(selectedDate)) return setMessage("لا يفتح تحضير اليوم إلا عند الساعة 12:00 منتصف الليل مع بداية اليوم نفسه.");
    persistLocal(records);
    if (cloudSyncTimerRef.current !== null) {
      window.clearTimeout(cloudSyncTimerRef.current);
      cloudSyncTimerRef.current = null;
    }
    setMessage("تم حفظ التحضير بنجاح");
    setSaving(true);
    try {
      await withTimeout(setDoc(
        doc(db, attendancePath, `${safeId(selectedClass)}_${selectedDate}`),
        {
          class: selectedClass,
          date: selectedDate,
          hijriDate: formatHijri(selectedDate),
          records,
          teacherId,
          teacherName,
          subjectKey,
          subject,
          autoSaved: false,
          autoSavedReason: null,
          manualEdited: true,
          manualEditedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      ), 4000);
      setMessage("تم حفظ التحضير ومزامنته في التطبيق والويب وبوابة الطالب");
    } catch {
      setMessage("تم حفظ التحضير بنجاح على الجهاز، وستتم المزامنة عند توفر الاتصال");
    } finally {
      setSaving(false);
    }
  }

  async function deleteAttendance() {
    if (!selectedClass || !attendancePath) return setMessage("اختر الفصل أولًا");
    if (selectedDate < ATTENDANCE_START_DATE) return setMessage(`لا توجد تحاضير معتمدة قبل ${ATTENDANCE_START_LABEL}.`);
    if (!hasSavedRecord) return setMessage("لا يوجد تحضير محفوظ لهذا الفصل في التاريخ المحدد");
    const approved = window.confirm(`هل تريد حذف تحضير ${selectedClass} بتاريخ ${selectedDate} نهائيًا؟`);
    if (!approved) return;
    setDeleting(true);
    try {
      await withTimeout(deleteDoc(doc(db, attendancePath, `${safeId(selectedClass)}_${selectedDate}`)), 5000);
      clearLocalAttendance();
      setRecords(Object.fromEntries(classStudents.map(student => [studentCode(student), "present"])));
      setHasSavedRecord(false);
      setMessage("تم حذف التحضير من الجهاز والسحابة بنجاح");
    } catch {
      setMessage("تعذر حذف التحضير من السحابة؛ تحقق من الاتصال ثم أعد المحاولة حتى لا يعود السجل لاحقًا");
    } finally {
      setDeleting(false);
    }
  }

  function reportRows() {
    return classStudents.map((student, index) => ({
      number: index + 1,
      name: clean(student.name) || "طالب بدون اسم",
      className: selectedClass,
      status: STATUS_LABELS[records[studentCode(student)] || "present"],
      notes: "",
    }));
  }

  function exportExcel() {
    const rows = reportRows();
    if (!selectedClass || !rows.length) return setMessage("الفصل ظاهر في الجدول، لكن لا توجد له أسماء طلاب مسجلة بعد.");
    const details = rows.map(row => ({
      "م": row.number,
      "اسم الطالب": row.name,
      "الفصل": row.className,
      "حالة الطالب": row.status,
      "ملاحظات": row.notes,
    }));
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(details);
    sheet["!cols"] = [{ wch: 6 }, { wch: 34 }, { wch: 22 }, { wch: 18 }, { wch: 28 }];
    XLSX.utils.book_append_sheet(workbook, sheet, "الحضور اليومي");
    XLSX.writeFile(workbook, `تقرير-حضور-${safeFile(selectedClass)}-${selectedDate}.xlsx`);
  }

  async function downloadAttendancePdf() {
    const rows = reportRows();
    if (!selectedClass || !rows.length) return setMessage("الفصل ظاهر في الجدول، لكن لا توجد له أسماء طلاب مسجلة بعد.");
    setMessage("جارٍ تجهيز التحضير PDF في صفحة واحدة...");

    const columnCount = rows.length > 48 ? 3 : rows.length > 24 ? 2 : 1;
    const rowsPerColumn = Math.ceil(rows.length / columnCount);
    const rowHeight = Math.max(18, Math.min(29, Math.floor(500 / Math.max(rowsPerColumn, 1))));
    const rowFontSize = rowHeight <= 20 ? 10 : rowHeight <= 24 ? 11 : 12;
    const columns = Array.from({ length: columnCount }, (_, columnIndex) =>
      rows.slice(columnIndex * rowsPerColumn, (columnIndex + 1) * rowsPerColumn),
    );
    const statusClass = (status: string) => {
      if (status === "حاضر") return "present";
      if (status === "غائب") return "absent";
      if (status === "متأخر") return "late";
      if (status === "مستأذن") return "excused";
      return "escaped";
    };
    const tablesHtml = columns.map(columnRows => `
      <table>
        <colgroup><col style="width:34px"><col><col style="width:76px"></colgroup>
        <thead><tr><th>م</th><th>اسم الطالب</th><th>الحالة</th></tr></thead>
        <tbody>${columnRows.map(row => `<tr><td class="number">${row.number}</td><td class="student-name">${escapeHtml(row.name)}</td><td><span class="status ${statusClass(row.status)}">${escapeHtml(row.status)}</span></td></tr>`).join("")}</tbody>
      </table>`).join("");

    const sheet = document.createElement("section");
    sheet.dir = "rtl";
    sheet.setAttribute("aria-hidden", "true");
    sheet.style.cssText = "position:fixed;left:-12000px;top:0;width:1123px;height:794px;background:#fff;z-index:-1;overflow:hidden;";
    sheet.innerHTML = `
      <style>
        *{box-sizing:border-box}
        .pdf-sheet{width:1123px;height:794px;padding:20px 24px 16px;background:#fff;color:#123946;font-family:'Tajawal','Segoe UI',Tahoma,Arial,sans-serif;display:grid;grid-template-rows:auto auto auto 1fr auto;gap:8px;overflow:hidden}
        .pdf-head{min-height:70px;border-radius:16px;padding:12px 18px;display:flex;align-items:center;justify-content:space-between;background:linear-gradient(135deg,#082d38,#0d5665 72%,#137586);color:#fff}
        .pdf-brand small,.pdf-title small{display:block;font-size:10px;color:#cde8ec;font-weight:700}.pdf-brand strong{display:block;margin-top:3px;font-size:21px}.pdf-title{text-align:left}.pdf-title strong{display:block;font-size:23px}.pdf-title span{display:inline-block;margin-top:4px;padding:3px 9px;border-radius:999px;background:#e7b649;color:#17353e;font-size:10px;font-weight:900}
        .pdf-meta{display:grid;grid-template-columns:1.25fr 1fr 1fr 1fr 1.3fr;gap:6px}.pdf-meta div{min-height:39px;border:1px solid #d8e5e9;border-radius:9px;background:#f8fbfc;padding:6px 9px}.pdf-meta small{display:block;color:#6a8089;font-size:8px;font-weight:800}.pdf-meta strong{display:block;margin-top:2px;font-size:11px;color:#153e4b}
        .pdf-summary{display:grid;grid-template-columns:repeat(6,1fr);gap:6px}.pdf-summary article{border:1px solid #dce7ea;border-radius:9px;text-align:center;padding:4px;background:#f8fbfc}.pdf-summary strong{display:block;font-size:16px;line-height:1.05}.pdf-summary span{display:block;margin-top:2px;font-size:8px;font-weight:900}.pdf-summary .all{background:#eef6f8;color:#164858}.pdf-summary .present{background:#e5f7ec;color:#12653b}.pdf-summary .absent{background:#fdebed;color:#9e2935}.pdf-summary .late{background:#fff4d9;color:#8b5a06}.pdf-summary .excused{background:#e8f1ff;color:#2459a8}.pdf-summary .escaped{background:#f1eaff;color:#6036a5}
        .pdf-tables{min-height:0;display:grid;grid-template-columns:repeat(${columnCount},minmax(0,1fr));gap:9px;align-items:start;overflow:hidden}
        table{width:100%;border-collapse:collapse;table-layout:fixed;border:1px solid #bfcfd5}th{height:25px;background:#143f4d;color:#fff;border:1px solid #315966;font-size:9px;padding:3px}td{height:${rowHeight}px;border:1px solid #dbe5e8;padding:2px 5px;text-align:center;font-size:${rowFontSize}px;line-height:1.08;overflow:hidden}tbody tr:nth-child(even){background:#f7fafb}.student-name{text-align:right!important;font-weight:800;white-space:nowrap;text-overflow:ellipsis}.number{font-weight:900}.status{display:inline-block;min-width:56px;padding:3px 5px;border-radius:999px;font-size:${Math.max(8, rowFontSize - 2)}px;font-weight:900}.status.present{background:#dcf6e6;color:#12653b}.status.absent{background:#fde4e7;color:#a12230}.status.late{background:#ffefc4;color:#885802}.status.excused{background:#dfeaff;color:#1f52a0}.status.escaped{background:#ecdefe;color:#5b2e9e}
        .pdf-footer{display:flex;align-items:center;justify-content:space-between;border-top:1px dashed #b7c7cc;padding-top:6px;color:#607780;font-size:9px}.pdf-footer strong{color:#174653}.pdf-footer span{font-weight:800}
      </style>
      <div class="pdf-sheet">
        <header class="pdf-head"><div class="pdf-brand"><small>بوابة أستاذ لحوني التعليمية</small><strong>سجل التحضير اليومي</strong></div><div class="pdf-title"><small>تقرير جاهز للرفع والحفظ</small><strong>${escapeHtml(selectedClass)}</strong><span>جميع الطلاب في صفحة واحدة</span></div></header>
        <section class="pdf-meta"><div><small>المعلم</small><strong>${escapeHtml(teacherName)}</strong></div><div><small>المادة</small><strong>${escapeHtml(subject)}</strong></div><div><small>الفصل</small><strong>${escapeHtml(selectedClass)}</strong></div><div><small>التاريخ الميلادي</small><strong>${selectedDate}</strong></div><div><small>التاريخ الهجري</small><strong>${escapeHtml(formatHijri(selectedDate))}</strong></div></section>
        <section class="pdf-summary"><article class="all"><strong>${rows.length}</strong><span>إجمالي الطلاب</span></article><article class="present"><strong>${counts.present}</strong><span>حاضر</span></article><article class="absent"><strong>${counts.absent}</strong><span>غائب</span></article><article class="late"><strong>${counts.late}</strong><span>متأخر</span></article><article class="excused"><strong>${counts.excused}</strong><span>مستأذن</span></article><article class="escaped"><strong>${counts.escaped}</strong><span>هروب</span></article></section>
        <section class="pdf-tables">${tablesHtml}</section>
        <footer class="pdf-footer"><strong>بوابة أستاذ لحوني التعليمية</strong><span>عدد الطلاب: ${rows.length}</span><span>${escapeHtml(selectedClass)} — ${selectedDate}</span></footer>
      </div>`;

    document.body.appendChild(sheet);
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const canvas = await html2canvas(sheet, {
        scale: 2,
        backgroundColor: "#ffffff",
        logging: false,
        useCORS: true,
        width: 1123,
        height: 794,
        windowWidth: 1123,
        windowHeight: 794,
      });
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.96), "JPEG", 0, 0, 297, 210, undefined, "FAST");
      pdf.save(`تحضير-${safeFile(selectedClass)}-${selectedDate}.pdf`);
      setMessage(`تم تنزيل PDF صفحة واحدة ويحتوي جميع طلاب الفصل (${rows.length} طالبًا).`);
    } catch {
      setMessage("تعذر إنشاء PDF الآن. أعد المحاولة من المتصفح أو التطبيق بعد تحديث الصفحة.");
    } finally {
      sheet.remove();
    }
  }

  function printAdminReport() {
    const rows = reportRows();
    if (!selectedClass || !rows.length) return setMessage("الفصل ظاهر في الجدول، لكن لا توجد له أسماء طلاب مسجلة بعد.");
    const popup = window.open("", "_blank", "width=1280,height=920");
    if (!popup) return setMessage("اسمح بالنوافذ المنبثقة لفتح التقرير");
    const logoUrl = `${window.location.origin}/icons/ostadh-lahooni-192.jpg`;
    const statusClass = (status: string) => {
      if (status === "حاضر") return "present";
      if (status === "غائب") return "absent";
      if (status === "متأخر") return "late";
      if (status === "مستأذن") return "excused";
      return "escaped";
    };
    const pageSize = 13;
    const pageGroups = Array.from({ length: Math.ceil(rows.length / pageSize) }, (_, pageIndex) => rows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize));
    const pagesHtml = pageGroups.map((pageRows, pageIndex) => {
      const bodyRows = pageRows.map(row => `<tr><td class="index">${row.number}</td><td class="student-name">${escapeHtml(row.name)}</td><td>${escapeHtml(row.className)}</td><td><span class="status ${statusClass(row.status)}">${escapeHtml(row.status)}</span></td><td class="notes"></td></tr>`).join("");
      return `<section class="print-sheet">
        <header class="report-top"><div class="brand"><img src="${logoUrl}" alt="شعار البوابة"><div><strong>${PORTAL_NAME}</strong><small>بوابة تحضير الطلاب والمتابعة اليومية</small></div></div><div class="title"><span>صفحة ${pageIndex + 1} من ${pageGroups.length}</span><h1>تقرير الحضور اليومي</h1></div></header>
        <main class="report-body">
          <section class="meta"><div><small>المعلم</small><strong>${escapeHtml(teacherName)}</strong></div><div><small>المادة</small><strong>${escapeHtml(subject)}</strong></div><div><small>الفصل</small><strong>${escapeHtml(selectedClass)}</strong></div><div><small>التاريخ الميلادي</small><strong>${selectedDate}</strong></div><div><small>التاريخ الهجري</small><strong>${escapeHtml(formatHijri(selectedDate))}</strong></div></section>
          <section class="summary"><article class="all"><strong>${rows.length}</strong><span>إجمالي الطلاب</span></article><article class="present"><strong>${counts.present}</strong><span>حاضر</span></article><article class="absent"><strong>${counts.absent}</strong><span>غائب</span></article><article class="late"><strong>${counts.late}</strong><span>متأخر</span></article><article class="excused"><strong>${counts.excused}</strong><span>مستأذن</span></article><article class="escaped"><strong>${counts.escaped}</strong><span>هروب</span></article></section>
          <table><colgroup><col style="width:10mm"><col><col style="width:34mm"><col style="width:30mm"><col style="width:38mm"></colgroup><thead><tr><th>م</th><th>اسم الطالب</th><th>الفصل</th><th>الحالة</th><th>ملاحظات</th></tr></thead><tbody>${bodyRows}</tbody></table>
          ${pageIndex === pageGroups.length - 1 ? `<section class="signatures"><div><small>توقيع المعلم</small><strong>____________________________</strong></div><div><small>اعتماد الإدارة</small><strong>____________________________</strong></div></section>` : ''}
          <footer class="report-footer"><b>${PORTAL_NAME}</b><span class="seal">تحضير يومي موثّق</span><span>${escapeHtml(selectedClass)} — ${selectedDate}</span></footer>
        </main>
      </section>`;
    }).join("");

    popup.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>تقرير حضور ${escapeHtml(selectedClass)}</title><style>
@page{size:A4 landscape;margin:5mm}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#e8eef2;color:#102a35;font-family:'Tajawal','Segoe UI',Tahoma,Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.toolbar{position:sticky;top:0;z-index:5;display:flex;justify-content:center;align-items:center;gap:10px;padding:12px;background:linear-gradient(135deg,#082d38,#0d5262);box-shadow:0 8px 25px rgba(5,38,47,.22)}
.toolbar button{border:0;border-radius:12px;padding:11px 22px;font:800 13px inherit;cursor:pointer}.toolbar .print{background:#e7b649;color:#102a35}.toolbar .close{background:#fff;color:#163d49}
.print-sheet{width:287mm;min-height:198mm;margin:7mm auto;background:#fff;border-radius:5mm;overflow:visible;box-shadow:0 18px 50px rgba(16,42,53,.18);position:relative;break-after:page;page-break-after:always}.print-sheet:last-child{break-after:auto;page-break-after:auto}
.report-top{display:flex;align-items:center;justify-content:space-between;padding:5mm 8mm 4mm;background:linear-gradient(135deg,#082d38 0%,#0d5665 74%,#137586 100%);color:#fff;position:relative;overflow:hidden}
.brand{display:flex;align-items:center;gap:4mm}.brand img{width:14mm;height:14mm;border-radius:3mm;object-fit:cover;border:1mm solid rgba(255,255,255,.22);background:#fff}.brand strong{display:block;font-size:14px}.brand small{display:block;margin-top:1mm;font-size:8px;color:#cce8ec}.title{text-align:left}.title span{display:inline-block;padding:1.2mm 3mm;border-radius:99px;background:#e7b649;color:#18333a;font-size:8px;font-weight:900}.title h1{font-size:18px;margin:2mm 0 0;line-height:1.1}
.report-body{padding:3mm 7mm 4mm}.meta{display:grid;grid-template-columns:1.35fr 1fr 1fr 1.05fr 1.45fr;gap:2mm;margin-bottom:2.5mm}.meta div{border:1px solid #dbe6ea;border-radius:2.5mm;background:#f8fbfc;padding:1.8mm 2.5mm;min-height:10.5mm}.meta small{display:block;color:#67808a;font-size:7px;font-weight:700;margin-bottom:.5mm}.meta strong{font-size:9px;color:#123946}
.summary{display:grid;grid-template-columns:repeat(6,1fr);gap:2mm;margin-bottom:2.5mm}.summary article{border-radius:2.5mm;padding:1.5mm 2mm;text-align:center;border:1px solid #e0eaed;background:#fff}.summary strong{display:block;font-size:13px;line-height:1}.summary span{display:block;margin-top:.7mm;font-size:7px;font-weight:800}.summary .all{background:#eef6f8;color:#164858}.summary .present{background:#e5f7ec;color:#12653b}.summary .absent{background:#fdebed;color:#9e2935}.summary .late{background:#fff4d9;color:#8b5a06}.summary .excused{background:#e8f1ff;color:#2459a8}.summary .escaped{background:#f1eaff;color:#6036a5}
table{width:100%;border-collapse:collapse;table-layout:fixed;border:1px solid #cad9de}thead th{background:#143f4d;color:#fff;font-size:8px;padding:2mm;border:1px solid #315966}tbody td{padding:1.4mm 2mm;font-size:8px;border:1px solid #dce6e9;text-align:center;height:7.2mm}tbody tr:nth-child(even){background:#f7fafb}.student-name{text-align:right!important;font-weight:800;color:#173e4a}.index{width:10mm;font-weight:900}.notes{width:38mm}.status{display:inline-flex;align-items:center;justify-content:center;min-width:22mm;padding:1mm 2mm;border-radius:99px;font-size:7.2px;font-weight:900}.status.present{background:#dcf6e6;color:#12653b}.status.absent{background:#fde4e7;color:#a12230}.status.late{background:#ffefc4;color:#885802}.status.excused{background:#dfeaff;color:#1f52a0}.status.escaped{background:#ecdefe;color:#5b2e9e}
.signatures{display:grid;grid-template-columns:1fr 1fr;gap:12mm;margin:3mm 3mm 0;padding-top:2mm;border-top:1px dashed #a9bdc4}.signatures div{text-align:center}.signatures small{display:block;color:#617780;font-size:7.5px}.signatures strong{display:block;margin-top:2mm;font-size:8px;color:#173d49}.report-footer{display:flex;justify-content:space-between;align-items:center;margin-top:2mm;padding:2mm 1mm 0;color:#5d737b;font-size:7px}.report-footer b{color:#174653}.report-footer .seal{border:1px solid #d5a535;color:#8a6612;border-radius:99px;padding:.8mm 3mm;font-weight:900}
@media print{html,body{background:#fff!important}.toolbar{display:none!important}.print-sheet{width:100%!important;min-height:0!important;margin:0!important;border-radius:0!important;box-shadow:none!important;overflow:visible!important;break-after:page!important;page-break-after:always!important}.print-sheet:last-child{break-after:auto!important;page-break-after:auto!important}table,tr,td,th{break-inside:avoid!important;page-break-inside:avoid!important}}
</style></head><body><div class="toolbar"><button class="print" onclick="window.print()">طباعة أو حفظ PDF</button><button class="close" onclick="window.close()">إغلاق المعاينة</button></div>${pagesHtml}</body></html>`);
    popup.document.close();
  }

  async function buildRangeRows(): Promise<{ rows: RangeRow[]; days: string[] }> {
    if (!selectedClass || !attendancePath || !reportFrom || !reportTo) throw new Error("اختر الفصل والفترة");
    if (reportFrom < ATTENDANCE_START_DATE) throw new Error(`تبدأ التقارير من ${ATTENDANCE_START_LABEL}`);
    if (reportFrom > reportTo) throw new Error("تاريخ البداية يجب أن يكون قبل تاريخ النهاية");
    const localDocuments = Object.values(readAttendanceIndex(teacherId, subjectKey));
    let serverDocuments: AttendanceDocument[] = [];
    try {
      const snapshot = await withTimeout(getDocs(collection(db, attendancePath)), 5500);
      serverDocuments = snapshot.docs.map(item => item.data() as AttendanceDocument);
    } catch {
      serverDocuments = [];
    }
    const merged = new Map<string, AttendanceDocument>();
    [...serverDocuments, ...localDocuments].forEach(item => {
      if (!item.class || !item.date) return;
      merged.set(`${item.class}|${item.date}`, item);
    });
    const documents = [...merged.values()]
      .filter(item => item.class === selectedClass && !!item.date && item.date! >= ATTENDANCE_START_DATE && item.date! >= reportFrom && item.date! <= reportTo)
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    const days = [...new Set(documents.map(item => item.date || "").filter(Boolean))];
    const rows = classStudents.map((student, index) => {
      const code = studentCode(student);
      const dates = {
        absentDates: [] as string[],
        lateDates: [] as string[],
        excusedDates: [] as string[],
        escapedDates: [] as string[],
      };
      let present = 0;
      documents.forEach(item => {
        const date = item.date || "";
        const status = item.records?.[code] || "present";
        if (status === "present") present += 1;
        if (status === "absent") dates.absentDates.push(date);
        if (status === "late") dates.lateDates.push(date);
        if (status === "excused") dates.excusedDates.push(date);
        if (status === "escaped") dates.escapedDates.push(date);
      });
      const counted = documents.length;
      const attendanceRate = counted
        ? Math.round(((present + dates.lateDates.length + dates.excusedDates.length) / counted) * 100)
        : 0;
      return {
        number: index + 1,
        name: clean(student.name) || "طالب بدون اسم",
        present,
        ...dates,
        attendanceRate,
      };
    });
    return { rows, days };
  }

  async function printRangePdf() {
    try {
      setReporting(true);
      const { rows, days } = await buildRangeRows();
      if (!classStudents.length) return setMessage("الفصل ظاهر في الجدول، لكن لا توجد له أسماء طلاب مسجلة بعد.");
      if (!days.length) return setMessage("لا توجد سجلات حضور محفوظة في الفترة المحددة");
      const popup = window.open("", "_blank", "width=1280,height=920");
      if (!popup) return setMessage("اسمح بالنوافذ المنبثقة لفتح تقرير PDF");
      const logoUrl = `${window.location.origin}/icons/ostadh-lahooni-192.jpg`;
      const totalAbsences = rows.reduce((sum, row) => sum + row.absentDates.length, 0);
      const totalLate = rows.reduce((sum, row) => sum + row.lateDates.length, 0);
      const totalExcused = rows.reduce((sum, row) => sum + row.excusedDates.length, 0);
      const totalEscaped = rows.reduce((sum, row) => sum + row.escapedDates.length, 0);
      const averageRate = rows.length
        ? Math.round(rows.reduce((sum, row) => sum + row.attendanceRate, 0) / rows.length)
        : 0;
      const bodyRows = rows.map(row => `<tr><td>${row.number}</td><td class="student-name">${escapeHtml(row.name)}</td><td>${row.present}</td><td>${escapeHtml(datesText(row.absentDates))}</td><td>${escapeHtml(datesText(row.lateDates))}</td><td>${escapeHtml(datesText(row.excusedDates))}</td><td>${escapeHtml(datesText(row.escapedDates))}</td><td><strong class="rate">${row.attendanceRate}%</strong></td></tr>`).join("");
      popup.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>تقرير حضور ${escapeHtml(selectedClass)} من ${reportFrom} إلى ${reportTo}</title><style>
@page{size:A4 landscape;margin:5mm}
*{box-sizing:border-box}html,body{margin:0;padding:0;background:#e8eef2;color:#102a35;font-family:'Tajawal','Segoe UI',Tahoma,Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.toolbar{position:sticky;top:0;z-index:5;display:flex;justify-content:center;gap:10px;padding:12px;background:linear-gradient(135deg,#082d38,#0d5262)}.toolbar button{border:0;border-radius:12px;padding:11px 22px;font:800 13px inherit;cursor:pointer}.toolbar .print{background:#e7b649;color:#102a35}.toolbar .close{background:#fff;color:#163d49}
.page{width:287mm;min-height:200mm;margin:7mm auto;background:#fff;border-radius:5mm;overflow:hidden;box-shadow:0 18px 50px rgba(16,42,53,.18)}
.report-top{display:flex;align-items:center;justify-content:space-between;padding:6mm 8mm 4.5mm;background:linear-gradient(135deg,#082d38 0%,#0d5665 74%,#137586 100%);color:#fff}.brand{display:flex;align-items:center;gap:4mm}.brand img{width:17mm;height:17mm;border-radius:4mm;object-fit:cover;border:1.2mm solid rgba(255,255,255,.22);background:#fff}.brand strong{display:block;font-size:15px}.brand small{display:block;margin-top:1mm;font-size:9px;color:#cce8ec}.title{text-align:left}.title span{display:inline-block;padding:1.4mm 3mm;border-radius:99px;background:#e7b649;color:#18333a;font-size:8px;font-weight:900}.title h1{font-size:18px;margin:2.5mm 0 0}
.report-body{padding:4mm 6mm 5mm}.meta{display:grid;grid-template-columns:1.35fr 1fr 1fr 1.3fr 1fr;gap:2mm;margin-bottom:3mm}.meta div{border:1px solid #dbe6ea;border-radius:3mm;background:#f8fbfc;padding:2.2mm 3mm;min-height:13mm}.meta small{display:block;color:#67808a;font-size:7.5px;font-weight:700;margin-bottom:.8mm}.meta strong{font-size:9px;color:#123946}
.summary{display:grid;grid-template-columns:repeat(6,1fr);gap:2mm;margin-bottom:3.5mm}.summary article{border-radius:3mm;padding:2mm;text-align:center;border:1px solid #e0eaed;background:#f8fbfc}.summary strong{display:block;font-size:14px}.summary span{font-size:7.5px;font-weight:800}.summary .good{background:#e5f7ec;color:#12653b}.summary .warn{background:#fff4d9;color:#8b5a06}.summary .bad{background:#fdebed;color:#9e2935}
table{width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed;border:1px solid #cad9de;border-radius:3mm;overflow:hidden}thead th{background:#143f4d;color:#fff;font-size:7.5px;padding:2.2mm 1.3mm;border-left:1px solid rgba(255,255,255,.16)}tbody td{padding:1.55mm 1.3mm;font-size:7.3px;border-top:1px solid #dce6e9;border-left:1px solid #e5edef;text-align:center;height:7.7mm;word-break:break-word}tbody tr:nth-child(even){background:#f7fafb}.student-name{text-align:right!important;font-weight:800;color:#173e4a}.rate{display:inline-block;min-width:14mm;padding:1mm 2mm;border-radius:99px;background:#e5f7ec;color:#12653b}
.signatures{display:grid;grid-template-columns:1fr 1fr;gap:12mm;margin:4mm 3mm 0;padding-top:3mm;border-top:1px dashed #a9bdc4}.signatures div{text-align:center}.signatures small{display:block;color:#617780;font-size:8px}.signatures strong{display:block;margin-top:3mm;font-size:8.5px;color:#173d49}.footer{display:flex;justify-content:space-between;margin-top:3mm;color:#5d737b;font-size:7.5px}
@media print{html,body{background:#fff!important;overflow:visible!important}.toolbar{display:none!important}.page{width:auto!important;min-height:0!important;height:auto!important;margin:0!important;border-radius:0!important;box-shadow:none!important;overflow:visible!important}.report-body{overflow:visible!important;padding-bottom:2mm}table{overflow:visible!important;border-radius:0!important;break-inside:auto!important;page-break-inside:auto!important}thead{display:table-header-group!important}tbody{display:table-row-group!important;overflow:visible!important}tr,td,th{break-inside:avoid!important;page-break-inside:avoid!important}.signatures,.report-footer,.footer{break-inside:avoid!important;page-break-inside:avoid!important}.report-top{padding-top:5mm}}
</style></head><body><div class="toolbar"><button class="print" onclick="window.print()">طباعة أو حفظ PDF</button><button class="close" onclick="window.close()">إغلاق المعاينة</button></div><section class="page"><header class="report-top"><div class="brand"><img src="${logoUrl}" alt="شعار البوابة"><div><strong>${PORTAL_NAME}</strong><small>بوابة تحضير الطلاب والمتابعة اليومية</small></div></div><div class="title"><span>تقرير فترة معتمد</span><h1>تقرير الحضور الأسبوعي والفترة المحددة</h1></div></header><main class="report-body"><section class="meta"><div><small>المعلم</small><strong>${escapeHtml(teacherName)}</strong></div><div><small>المادة</small><strong>${escapeHtml(subject)}</strong></div><div><small>الفصل</small><strong>${escapeHtml(selectedClass)}</strong></div><div><small>الفترة</small><strong>${reportFrom} إلى ${reportTo}</strong></div><div><small>أيام التحضير</small><strong>${days.length} يوم</strong></div></section><section class="summary"><article><strong>${rows.length}</strong><span>إجمالي الطلاب</span></article><article class="good"><strong>${averageRate}%</strong><span>متوسط الحضور</span></article><article class="bad"><strong>${totalAbsences}</strong><span>حالات الغياب</span></article><article class="warn"><strong>${totalLate}</strong><span>حالات التأخير</span></article><article><strong>${totalExcused}</strong><span>حالات الاستئذان</span></article><article class="bad"><strong>${totalEscaped}</strong><span>حالات الهروب</span></article></section><table><colgroup><col style="width:9mm"><col style="width:43mm"><col style="width:14mm"><col><col><col><col><col style="width:19mm"></colgroup><thead><tr><th>م</th><th>اسم الطالب</th><th>الحضور</th><th>تواريخ الغياب</th><th>تواريخ التأخير</th><th>تواريخ الاستئذان</th><th>تواريخ الهروب</th><th>نسبة الحضور</th></tr></thead><tbody>${bodyRows}</tbody></table><section class="signatures"><div><small>توقيع المعلم</small><strong>____________________________</strong></div><div><small>اعتماد الإدارة</small><strong>____________________________</strong></div></section><footer class="footer"><b>${PORTAL_NAME}</b><span>${escapeHtml(selectedClass)} — ${reportFrom} إلى ${reportTo}</span></footer></main></section></body></html>`);
      popup.document.close();
      setMessage("تم تجهيز تقرير الفترة PDF");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تجهيز تقرير PDF");
    } finally {
      setReporting(false);
    }
  }

  async function exportRangeExcel() {
    try {
      setReporting(true);
      const { rows, days } = await buildRangeRows();
      if (!classStudents.length) return setMessage("الفصل ظاهر في الجدول، لكن لا توجد له أسماء طلاب مسجلة بعد.");
      if (!days.length) return setMessage("لا توجد سجلات حضور محفوظة في الفترة المحددة");
      const details = rows.map(row => ({
        "م": row.number,
        "اسم الطالب": row.name,
        "الحضور": row.present,
        "تواريخ الغياب": datesText(row.absentDates),
        "تواريخ التأخير": datesText(row.lateDates),
        "تواريخ الاستئذان": datesText(row.excusedDates),
        "تواريخ الهروب": datesText(row.escapedDates),
        "نسبة الحضور": `${row.attendanceRate}%`,
      }));
      const workbook = XLSX.utils.book_new();
      const sheet = XLSX.utils.json_to_sheet(details);
      sheet["!cols"] = [{ wch: 6 }, { wch: 30 }, { wch: 10 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(workbook, sheet, "تواريخ حالات الطلاب");
      XLSX.writeFile(workbook, `تقرير-حضور-${safeFile(selectedClass)}-${reportFrom}-إلى-${reportTo}.xlsx`);
      setMessage("تم تحميل تقرير الفترة");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تصدير التقرير");
    } finally {
      setReporting(false);
    }
  }

  if (!ready) return <main className="attendance-page attendance-command-center" dir="rtl"><section className="attendance-card attendance-loading"><p>{message || "جارٍ تجهيز بيانات الحساب..."}</p></section></main>;
  const statuses = Object.entries(STATUS_LABELS) as [AttendanceStatus, string][];
  const totalStudents = classStudents.length;
  const dailyRate = totalStudents ? Math.round(((counts.present + counts.late + counts.excused) / totalStudents) * 100) : 0;

  return <main className="attendance-page attendance-command-center" dir="rtl">
    <section className="attendance-card">
      <header className="attendance-head attendance-hero">
        <div className="attendance-head-copy">
          <span className="attendance-eyebrow">بوابة تحضير الطلاب</span>
          <h1>التحضير اليومي — {subject}</h1>
          <p>سجّل حالة كل طالب بلمسة واحدة. يبدأ احتساب التحضير رسميًا من {ATTENDANCE_START_LABEL}، وكل تغيير يُحفظ مباشرة ثم يُزامن سحابيًا.</p>
          <div className="attendance-hero-badges"><span>مزامنة لحظية بين التطبيق والويب</span><span>مرتبط بالجدول</span><span>تحضير تلقائي بعد نهاية اليوم</span><span>تقارير جاهزة</span></div>
        </div>
        <div className="hijri-card">
          <small>اليوم الدراسي</small>
          <strong>{formatHijri(selectedDate)}</strong>
          <div className="attendance-day-nav"><button type="button" onClick={() => moveDay(-1)} aria-label="اليوم السابق">السابق</button><button type="button" className="today" onClick={() => setSelectedDate(attendanceToday())}>اليوم</button><button type="button" onClick={() => moveDay(1)} aria-label="اليوم التالي">التالي</button></div>
        </div>
      </header>

      <section className="attendance-setup-panel">
        <div className="attendance-primary-controls">
          <label><span>الفصل</span><select data-attendance-class-select="true" value={selectedClass} onChange={event => setSelectedClass(event.target.value)}><option value="">اختر الفصل</option>{classes.map(className => <option key={className} value={className}>{className}</option>)}</select></label>
          <label><span>تاريخ التحضير</span><input data-attendance-date-input="true" type="date" min={ATTENDANCE_START_DATE} max={attendanceToday()} value={selectedDate} onChange={event => setSelectedDate(clampAttendanceDate(event.target.value))}/><small className="attendance-start-note">البداية المعتمدة: {ATTENDANCE_START_LABEL}</small></label>
        </div>
        <div className="attendance-main-actions">
          <button className="attendance-save" onClick={() => void saveAttendance()} disabled={!selectedClass || saving || deleting}>{saving ? "جارٍ الحفظ..." : "حفظ التحضير"}</button>
          <button type="button" className="attendance-delete" onClick={() => void deleteAttendance()} disabled={!selectedClass || !hasSavedRecord || deleting || saving}>{deleting ? "جارٍ الحذف..." : "حذف التحضير"}</button>
          <button type="button" className="attendance-pdf" onClick={() => void downloadAttendancePdf()} disabled={!selectedClass || !classStudents.length}>تحميل التحضير PDF</button>
          <button type="button" className="attendance-excel" onClick={exportExcel} disabled={!selectedClass || !classStudents.length}>تحميل Excel</button>
        </div>
      </section>

      <section className="attendance-overview" aria-label="ملخص التحضير اليومي">
        <article className="total"><span>طلاب الفصل</span><strong>{totalStudents}</strong><small>{selectedClass || "لم يُحدد الفصل"}</small></article>
        <article className="present"><span>الحضور</span><strong>{counts.present}</strong><small>حاضر الآن</small></article>
        <article className="absent"><span>الغياب</span><strong>{counts.absent}</strong><small>يحتاج متابعة</small></article>
        <article className="rate"><span>نسبة الالتزام</span><strong>{dailyRate}%</strong><small>حضور وتأخير واستئذان</small></article>
      </section>

      <section className="attendance-workspace">
        <header className="attendance-list-head">
          <div><span>قائمة الطلاب</span><h2>{selectedClass ? `تحضير ${selectedClass}` : "اختر الفصل لبدء التحضير"}</h2><p>الحالة الملوّنة هي الحالة المعتمدة حاليًا لكل طالب.</p></div>
          <div className="attendance-date-chip"><small>التاريخ</small><strong>{selectedDate}</strong></div>
        </header>

        <div className="attendance-stats">
          <span className="present">حاضر: {counts.present}</span><span className="absent">غائب: {counts.absent}</span><span className="late">متأخر: {counts.late}</span><span className="excused">مستأذن: {counts.excused}</span><span className="escaped">هروب: {counts.escaped}</span>
        </div>

        <div className="attendance-list">
          {classStudents.map((student, index) => {
            const currentStatus = records[studentCode(student)] || "present";
            return <article className={`attendance-student-card status-${currentStatus}`} key={studentCode(student)}>
              <div className="student-info"><b>{index + 1}</b><div><strong>{student.name || "طالب بدون اسم"}</strong><small>{selectedClass} <i>•</i> {studentCode(student)}</small></div><em>{STATUS_LABELS[currentStatus]}</em></div>
              <div className="status-buttons" role="group" aria-label={`حالة الطالب ${student.name || ""}`}>{statuses.map(([status, label]) => <button type="button" key={status} className={currentStatus === status ? `active ${status}` : status} onClick={() => setStudentStatus(student, status)} aria-pressed={currentStatus === status}>{label}</button>)}</div>
            </article>;
          })}
          {!selectedClass ? <div className="attendance-empty"><strong>ابدأ باختيار الفصل</strong><p>ستظهر قائمة الطلاب مباشرة مع حالات التحضير.</p></div> : null}
          {selectedClass && !classStudents.length ? <div className="attendance-empty"><strong>لا توجد أسماء مسجلة لهذا الفصل</strong><p>الفصل مرتبط بالجدول أو الإسناد، لكنه لا يحتوي طلابًا حتى الآن.</p></div> : null}
        </div>
      </section>

      <details className="attendance-range-report">
        <summary><div><span>التقارير المتقدمة</span><strong>تقرير أسبوعي أو فترة محددة</strong></div><small>اضغط للفتح</small></summary>
        <div className="attendance-range-content"><p>يعرض تواريخ الغياب والتأخير والاستئذان والهروب لكل طالب خلال الفترة، ويمكن تحميله بصيغتي Excel وPDF.</p><div className="attendance-range-controls"><label><span>من تاريخ</span><input type="date" min={ATTENDANCE_START_DATE} value={reportFrom} onChange={event => setReportFrom(clampAttendanceDate(event.target.value))}/></label><label><span>إلى تاريخ</span><input type="date" min={ATTENDANCE_START_DATE} value={reportTo} onChange={event => setReportTo(clampAttendanceDate(event.target.value))}/></label><button type="button" className="attendance-range-excel" onClick={() => void exportRangeExcel()} disabled={!selectedClass || reporting}>{reporting ? "جارٍ التجهيز..." : "تحميل تقرير الفترة Excel"}</button><button type="button" className="attendance-range-pdf" onClick={() => void printRangePdf()} disabled={!selectedClass || reporting}>{reporting ? "جارٍ التجهيز..." : "معاينة وحفظ PDF"}</button></div></div>
      </details>

      {message ? <p className="attendance-message" role="status">{message}</p> : null}
    </section>
  </main>;
}
