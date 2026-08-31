"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import * as XLSX from "xlsx";
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
const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "حاضر",
  absent: "غائب",
  late: "متأخر",
  excused: "مستأذن",
  escaped: "هروب",
};

function toDateInput(date: Date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
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
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedDate, setSelectedDate] = useState(toDateInput(new Date()));
  const [reportFrom, setReportFrom] = useState(startOfCurrentWeek());
  const [reportTo, setReportTo] = useState(toDateInput(new Date()));
  const [records, setRecords] = useState<Record<string, AttendanceStatus>>({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [reporting, setReporting] = useState(false);
  const loadSequence = useRef(0);

  const attendancePath = useMemo(
    () => (teacherId ? tenantCollection(teacherId, subjectKey, "attendance") : ""),
    [teacherId, subjectKey],
  );
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
        const lessons = data.lessons && typeof data.lessons === "object"
          ? Object.values(data.lessons as Record<string, TimetableLesson>)
          : [];
        setTimetableClasses([...new Set(lessons.map(lesson => normalizeClass(lesson.className)).filter(Boolean))]);
      })
      .catch(() => setTimetableClasses([]));
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
    const sequence = ++loadSequence.current;
    async function load() {
      if (!selectedClass || !attendancePath) {
        setRecords({});
        return;
      }
      const key = attendanceKey(teacherId, subjectKey, selectedClass, selectedDate);
      const local = readRecords(key) || readRecords(legacyAttendanceKey(teacherId, subjectKey, selectedClass, selectedDate));
      if (local) {
        if (sequence === loadSequence.current) {
          setRecords(Object.fromEntries(classStudents.map(student => [studentCode(student), local[studentCode(student)] || "present"])));
        }
        return;
      }
      try {
        const snapshot = await withTimeout(getDoc(doc(db, attendancePath, `${safeId(selectedClass)}_${selectedDate}`)), 4000);
        const saved = (snapshot.data()?.records || {}) as Record<string, AttendanceStatus>;
        if (sequence === loadSequence.current) {
          setRecords(Object.fromEntries(classStudents.map(student => [studentCode(student), saved[studentCode(student)] || saved[student.id] || "present"])));
        }
      } catch {
        if (sequence === loadSequence.current) {
          setRecords(Object.fromEntries(classStudents.map(student => [studentCode(student), "present"])));
        }
      }
    }
    void load();
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
    if (!selectedClass || !teacherId) return;
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
  }

  function setStudentStatus(student: UnifiedStudent, status: AttendanceStatus) {
    const code = studentCode(student);
    const next = { ...records, [code]: status };
    setRecords(next);
    persistLocal(next);
    setMessage("تم الحفظ مباشرة");
  }

  function moveDay(amount: number) {
    const date = new Date(`${selectedDate}T12:00:00`);
    date.setDate(date.getDate() + amount);
    setSelectedDate(toDateInput(date));
  }

  async function saveAttendance() {
    if (!selectedClass || !attendancePath) return setMessage("اختر الفصل أولًا");
    persistLocal(records);
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
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      ), 4000);
      setMessage("تم حفظ التحضير ومزامنته بنجاح");
    } catch {
      setMessage("تم حفظ التحضير بنجاح على الجهاز، وستتم المزامنة عند توفر الاتصال");
    } finally {
      setSaving(false);
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
    const bodyRows = rows.map(row => `<tr><td class="index">${row.number}</td><td class="student-name">${escapeHtml(row.name)}</td><td>${escapeHtml(row.className)}</td><td><span class="status ${statusClass(row.status)}">${escapeHtml(row.status)}</span></td><td class="notes"></td></tr>`).join("");
    popup.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>تقرير حضور ${escapeHtml(selectedClass)}</title><style>
@page{size:A4 landscape;margin:5mm}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#e8eef2;color:#102a35;font-family:'Tajawal','Segoe UI',Tahoma,Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.toolbar{position:sticky;top:0;z-index:5;display:flex;justify-content:center;align-items:center;gap:10px;padding:12px;background:linear-gradient(135deg,#082d38,#0d5262);box-shadow:0 8px 25px rgba(5,38,47,.22)}
.toolbar button{border:0;border-radius:12px;padding:11px 22px;font:800 13px inherit;cursor:pointer}.toolbar .print{background:#e7b649;color:#102a35}.toolbar .close{background:#fff;color:#163d49}
.page{width:287mm;min-height:200mm;margin:7mm auto;background:#fff;border-radius:5mm;overflow:hidden;box-shadow:0 18px 50px rgba(16,42,53,.18);position:relative}
.report-top{display:flex;align-items:center;justify-content:space-between;padding:6mm 8mm 4.5mm;background:linear-gradient(135deg,#082d38 0%,#0d5665 74%,#137586 100%);color:#fff;position:relative;overflow:hidden}
.report-top:after{content:'';position:absolute;width:80mm;height:80mm;border:1px solid rgba(255,255,255,.12);border-radius:50%;left:-18mm;top:-38mm}
.brand{display:flex;align-items:center;gap:4mm;position:relative;z-index:1}.brand img{width:17mm;height:17mm;border-radius:4mm;object-fit:cover;border:1.2mm solid rgba(255,255,255,.22);background:#fff}.brand strong{display:block;font-size:15px}.brand small{display:block;margin-top:1mm;font-size:9px;color:#cce8ec}
.title{text-align:left;position:relative;z-index:1}.title span{display:inline-block;padding:1.4mm 3mm;border-radius:99px;background:#e7b649;color:#18333a;font-size:8px;font-weight:900}.title h1{font-size:19px;margin:2.5mm 0 0;line-height:1.1}
.report-body{padding:4mm 7mm 5mm}
.meta{display:grid;grid-template-columns:1.35fr 1fr 1fr 1.05fr 1.45fr;gap:2mm;margin-bottom:3mm}.meta div{border:1px solid #dbe6ea;border-radius:3mm;background:#f8fbfc;padding:2.2mm 3mm;min-height:13mm}.meta small{display:block;color:#67808a;font-size:7.5px;font-weight:700;margin-bottom:.8mm}.meta strong{font-size:9.5px;color:#123946}
.summary{display:grid;grid-template-columns:repeat(6,1fr);gap:2mm;margin-bottom:3.5mm}.summary article{border-radius:3mm;padding:2mm 2.5mm;text-align:center;border:1px solid #e0eaed;background:#fff}.summary strong{display:block;font-size:15px;line-height:1}.summary span{display:block;margin-top:1mm;font-size:7.8px;font-weight:800}.summary .all{background:#eef6f8;color:#164858}.summary .present{background:#e5f7ec;color:#12653b}.summary .absent{background:#fdebed;color:#9e2935}.summary .late{background:#fff4d9;color:#8b5a06}.summary .excused{background:#e8f1ff;color:#2459a8}.summary .escaped{background:#f1eaff;color:#6036a5}
table{width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed;border:1px solid #cad9de;border-radius:3mm;overflow:hidden}thead th{background:#143f4d;color:#fff;font-size:8.2px;padding:2.4mm 2mm;border-left:1px solid rgba(255,255,255,.16)}tbody td{padding:1.65mm 2mm;font-size:8.2px;border-top:1px solid #dce6e9;border-left:1px solid #e5edef;text-align:center;height:8.1mm}tbody tr:nth-child(even){background:#f7fafb}.student-name{text-align:right!important;font-weight:800;color:#173e4a}.index{width:10mm;font-weight:900}.notes{width:38mm}.status{display:inline-flex;align-items:center;justify-content:center;min-width:22mm;padding:1.1mm 2mm;border-radius:99px;font-size:7.6px;font-weight:900}.status.present{background:#dcf6e6;color:#12653b}.status.absent{background:#fde4e7;color:#a12230}.status.late{background:#ffefc4;color:#885802}.status.excused{background:#dfeaff;color:#1f52a0}.status.escaped{background:#ecdefe;color:#5b2e9e}
.signatures{display:grid;grid-template-columns:1fr 1fr;gap:12mm;margin:4mm 3mm 0;padding-top:3mm;border-top:1px dashed #a9bdc4}.signatures div{text-align:center}.signatures small{display:block;color:#617780;font-size:8px}.signatures strong{display:block;margin-top:3mm;font-size:8.5px;color:#173d49}
.report-footer{display:flex;justify-content:space-between;align-items:center;margin-top:3mm;padding:2.5mm 1mm 0;color:#5d737b;font-size:7.5px}.report-footer b{color:#174653}.report-footer .seal{border:1px solid #d5a535;color:#8a6612;border-radius:99px;padding:1mm 3mm;font-weight:900}
@media print{html,body{background:#fff}.toolbar{display:none}.page{width:100%;min-height:auto;margin:0;border-radius:0;box-shadow:none}.report-top{padding-top:5mm}.report-body{padding-bottom:2mm}}
</style></head><body><div class="toolbar"><button class="print" onclick="window.print()">طباعة أو حفظ PDF</button><button class="close" onclick="window.close()">إغلاق المعاينة</button></div><section class="page"><header class="report-top"><div class="brand"><img src="${logoUrl}" alt="شعار البوابة"><div><strong>${PORTAL_NAME}</strong><small>بوابة تحضير الطلاب والمتابعة اليومية</small></div></div><div class="title"><span>سجل إلكتروني معتمد</span><h1>تقرير الحضور اليومي</h1></div></header><main class="report-body"><section class="meta"><div><small>المعلم</small><strong>${escapeHtml(teacherName)}</strong></div><div><small>المادة</small><strong>${escapeHtml(subject)}</strong></div><div><small>الفصل</small><strong>${escapeHtml(selectedClass)}</strong></div><div><small>التاريخ الميلادي</small><strong>${selectedDate}</strong></div><div><small>التاريخ الهجري</small><strong>${escapeHtml(formatHijri(selectedDate))}</strong></div></section><section class="summary"><article class="all"><strong>${rows.length}</strong><span>إجمالي الطلاب</span></article><article class="present"><strong>${counts.present}</strong><span>حاضر</span></article><article class="absent"><strong>${counts.absent}</strong><span>غائب</span></article><article class="late"><strong>${counts.late}</strong><span>متأخر</span></article><article class="excused"><strong>${counts.excused}</strong><span>مستأذن</span></article><article class="escaped"><strong>${counts.escaped}</strong><span>هروب</span></article></section><table><colgroup><col style="width:10mm"><col><col style="width:34mm"><col style="width:30mm"><col style="width:38mm"></colgroup><thead><tr><th>م</th><th>اسم الطالب</th><th>الفصل</th><th>الحالة</th><th>ملاحظات</th></tr></thead><tbody>${bodyRows}</tbody></table><section class="signatures"><div><small>توقيع المعلم</small><strong>____________________________</strong></div><div><small>اعتماد الإدارة</small><strong>____________________________</strong></div></section><footer class="report-footer"><b>${PORTAL_NAME}</b><span class="seal">تحضير يومي موثّق</span><span>${escapeHtml(selectedClass)} — ${selectedDate}</span></footer></main></section></body></html>`);
    popup.document.close();
  }

  async function buildRangeRows(): Promise<{ rows: RangeRow[]; days: string[] }> {
    if (!selectedClass || !attendancePath || !reportFrom || !reportTo) throw new Error("اختر الفصل والفترة");
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
      .filter(item => item.class === selectedClass && !!item.date && item.date! >= reportFrom && item.date! <= reportTo)
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
          <p>سجّل حالة كل طالب بلمسة واحدة. كل تغيير يُحفظ مباشرة على الجهاز ثم يُزامن سحابيًا عند الحفظ.</p>
          <div className="attendance-hero-badges"><span>حفظ فوري</span><span>مرتبط بالجدول</span><span>تقارير جاهزة</span></div>
        </div>
        <div className="hijri-card">
          <small>اليوم الدراسي</small>
          <strong>{formatHijri(selectedDate)}</strong>
          <div className="attendance-day-nav"><button type="button" onClick={() => moveDay(-1)} aria-label="اليوم السابق">السابق</button><button type="button" className="today" onClick={() => setSelectedDate(toDateInput(new Date()))}>اليوم</button><button type="button" onClick={() => moveDay(1)} aria-label="اليوم التالي">التالي</button></div>
        </div>
      </header>

      <section className="attendance-setup-panel">
        <div className="attendance-primary-controls">
          <label><span>الفصل</span><select value={selectedClass} onChange={event => setSelectedClass(event.target.value)}><option value="">اختر الفصل</option>{classes.map(className => <option key={className} value={className}>{className}</option>)}</select></label>
          <label><span>تاريخ التحضير</span><input type="date" value={selectedDate} onChange={event => setSelectedDate(event.target.value)}/></label>
        </div>
        <div className="attendance-main-actions">
          <button className="attendance-save" onClick={() => void saveAttendance()} disabled={!selectedClass || saving}>{saving ? "جارٍ الحفظ..." : "حفظ التحضير"}</button>
          <button type="button" className="attendance-pdf" onClick={printAdminReport} disabled={!selectedClass || !classStudents.length}>معاينة التقرير PDF</button>
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
        <div className="attendance-range-content"><p>يعرض تواريخ الغياب والتأخير والاستئذان والهروب لكل طالب خلال الفترة.</p><div className="attendance-range-controls"><label><span>من تاريخ</span><input type="date" value={reportFrom} onChange={event => setReportFrom(event.target.value)}/></label><label><span>إلى تاريخ</span><input type="date" value={reportTo} onChange={event => setReportTo(event.target.value)}/></label><button type="button" onClick={() => void exportRangeExcel()} disabled={!selectedClass || reporting}>{reporting ? "جارٍ التجهيز..." : "تحميل تقرير الفترة Excel"}</button></div></div>
      </details>

      {message ? <p className="attendance-message" role="status">{message}</p> : null}
    </section>
  </main>;
}
