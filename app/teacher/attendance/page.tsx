"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, getDoc, getDocs, onSnapshot, setDoc } from "firebase/firestore";
import * as XLSX from "xlsx";
import { db } from "../../../lib/firebase";
import { tenantCollection, type SubjectKey } from "../../../lib/teacher-tenant";
import { useTeacherClient, type TeacherClientAssignment } from "../../../lib/teacher-client";
import {
  SHARED_STUDENTS_COLLECTION,
  belongsToTeacher,
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
  return value.replace(/[&<>"']/g, (character) => ({
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

export default function AttendancePage() {
  const session = useTeacherClient();
  const teacherId = session?.teacherId || "";
  const teacherName = session?.teacherName || "";
  const subjectKey = (session?.subjectKey as SubjectKey) || "history";
  const subject = session?.subject || "";
  const ready = !!teacherId && !!session?.subjectKey;

  const [assignments, setAssignments] = useState<TeacherClientAssignment[]>([]);
  const [localStudents, setLocalStudents] = useState<UnifiedStudent[]>([]);
  const [subjectStudents, setSubjectStudents] = useState<UnifiedStudent[]>([]);
  const [sharedStudents, setSharedStudents] = useState<UnifiedStudent[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedDate, setSelectedDate] = useState(toDateInput(new Date()));
  const [reportFrom, setReportFrom] = useState(startOfCurrentWeek());
  const [reportTo, setReportTo] = useState(toDateInput(new Date()));
  const [records, setRecords] = useState<Record<string, AttendanceStatus>>({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [reporting, setReporting] = useState(false);
  const loadSequence = useRef(0);

  const studentsPath = useMemo(
    () => (teacherId ? tenantCollection(teacherId, subjectKey, "students") : ""),
    [teacherId, subjectKey],
  );
  const attendancePath = useMemo(
    () => (teacherId ? tenantCollection(teacherId, subjectKey, "attendance") : ""),
    [teacherId, subjectKey],
  );
  const assignmentScoped = useMemo(
    () => hasDetailedAssignments(assignments, subjectKey),
    [assignments, subjectKey],
  );
  const classAllowed = (className: string) => !assignmentScoped || classMatchesAssignments(className, assignments, subjectKey);

  useEffect(() => {
    if (!teacherId) return;
    let active = true;
    fetch("/api/teacher-session", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => active && setAssignments(Array.isArray(data.assignments) ? data.assignments : []))
      .catch(() => active && setAssignments([]));
    return () => { active = false; };
  }, [teacherId, subjectKey]);

  useEffect(() => {
    if (!teacherId) return;
    const load = () => setLocalStudents(loadLocalRoster(teacherId, subjectKey));
    load();
    window.addEventListener("storage", load);
    window.addEventListener("focus", load);
    window.addEventListener("lahooni-roster-updated", load as EventListener);
    return () => {
      window.removeEventListener("storage", load);
      window.removeEventListener("focus", load);
      window.removeEventListener("lahooni-roster-updated", load as EventListener);
    };
  }, [teacherId, subjectKey]);

  useEffect(() => {
    if (!ready || !studentsPath) return;
    const stopSubject = onSnapshot(
      collection(db, studentsPath),
      (snapshot) => setSubjectStudents(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as UnifiedStudent))),
      () => undefined,
    );
    const stopShared = onSnapshot(
      collection(db, SHARED_STUDENTS_COLLECTION),
      (snapshot) => setSharedStudents(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as UnifiedStudent))),
      () => undefined,
    );
    return () => { stopSubject(); stopShared(); };
  }, [ready, studentsPath]);

  const scopedSubjectStudents = useMemo(
    () => subjectStudents.filter((student) => classAllowed(normalizeClass(student.class))),
    [subjectStudents, assignmentScoped, assignments, subjectKey],
  );

  const sharedForCurrentAssignments = useMemo(
    () => assignmentScoped
      ? sharedStudents.filter((student) => belongsToTeacher(student, teacherId)
        && classMatchesAssignments(normalizeClass(student.class), assignments, subjectKey)
        && student.active !== false
        && student.rosterActive !== false)
      : [],
    [sharedStudents, teacherId, assignmentScoped, assignments, subjectKey],
  );

  const scopedLocalStudents = useMemo(
    () => localStudents.filter((student) => classAllowed(normalizeClass(student.class))),
    [localStudents, assignmentScoped, assignments, subjectKey],
  );

  const students = useMemo(() => {
    const deleted = loadDeletedCodes(teacherId);
    return mergeStudents(scopedSubjectStudents, sharedForCurrentAssignments, scopedLocalStudents).filter((student) => {
      const code = studentCode(student);
      return !deleted.has(code) && student.active !== false && student.rosterActive !== false;
    });
  }, [scopedSubjectStudents, sharedForCurrentAssignments, scopedLocalStudents, teacherId]);

  useEffect(() => {
    if (!teacherId || (!scopedSubjectStudents.length && !sharedForCurrentAssignments.length)) return;
    const deleted = loadDeletedCodes(teacherId);
    const merged = mergeStudents(scopedLocalStudents, scopedSubjectStudents, sharedForCurrentAssignments)
      .filter((student) => !deleted.has(studentCode(student)) && classAllowed(normalizeClass(student.class)));
    if (JSON.stringify(mergeStudents(scopedLocalStudents)) !== JSON.stringify(merged)) {
      setLocalStudents(merged);
      saveLocalRoster(teacherId, merged, subjectKey);
    }
  }, [teacherId, scopedSubjectStudents, sharedForCurrentAssignments, assignmentScoped, assignments, subjectKey]);

  const classes = useMemo(
    () => [...new Set(students.map((student) => normalizeClass(student.class)).filter(Boolean))]
      .filter(classAllowed)
      .sort((a, b) => a.localeCompare(b, "ar", { numeric: true })),
    [students, assignmentScoped, assignments, subjectKey],
  );

  const classStudents = useMemo(
    () => students.filter((student) => normalizeClass(student.class) === selectedClass),
    [students, selectedClass],
  );

  useEffect(() => {
    if (!classes.length) { setSelectedClass(""); return; }
    if (!selectedClass || !classes.includes(selectedClass)) setSelectedClass(classes[0]);
  }, [classes, selectedClass]);

  useEffect(() => {
    const sequence = ++loadSequence.current;
    async function load() {
      if (!selectedClass || !attendancePath) { setRecords({}); return; }
      const key = attendanceKey(teacherId, subjectKey, selectedClass, selectedDate);
      const local = readRecords(key) || readRecords(legacyAttendanceKey(teacherId, subjectKey, selectedClass, selectedDate));
      if (local) {
        if (sequence === loadSequence.current) setRecords(Object.fromEntries(classStudents.map((student) => [studentCode(student), local[studentCode(student)] || "present"])));
        return;
      }
      try {
        const snapshot = await withTimeout(getDoc(doc(db, attendancePath, `${safeId(selectedClass)}_${selectedDate}`)), 3500);
        const saved = (snapshot.data()?.records || {}) as Record<string, AttendanceStatus>;
        if (sequence === loadSequence.current) setRecords(Object.fromEntries(classStudents.map((student) => [studentCode(student), saved[studentCode(student)] || saved[student.id] || "present"])));
      } catch {
        if (sequence === loadSequence.current) setRecords(Object.fromEntries(classStudents.map((student) => [studentCode(student), "present"])));
      }
    }
    void load();
  }, [selectedClass, selectedDate, classStudents, attendancePath, teacherId, subjectKey]);

  const counts = useMemo(() => {
    const values = classStudents.map((student) => records[studentCode(student)] || "present");
    return {
      present: values.filter((value) => value === "present").length,
      absent: values.filter((value) => value === "absent").length,
      late: values.filter((value) => value === "late").length,
      excused: values.filter((value) => value === "excused").length,
      escaped: values.filter((value) => value === "escaped").length,
    };
  }, [classStudents, records]);

  function persistLocal(nextRecords: Record<string, AttendanceStatus>) {
    if (!selectedClass || !teacherId) return;
    const payload: AttendanceDocument = { class: selectedClass, date: selectedDate, records: nextRecords, teacherId, subjectKey, updatedAt: new Date().toISOString() };
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
        { class: selectedClass, date: selectedDate, hijriDate: formatHijri(selectedDate), records, teacherId, teacherName, subjectKey, subject, updatedAt: new Date().toISOString() },
        { merge: true },
      ), 3500);
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
    if (!selectedClass || !rows.length) return setMessage("اختر فصلًا يحتوي على طلاب أولًا");
    const details = rows.map((row) => ({ "م": row.number, "اسم الطالب": row.name, "الفصل": row.className, "حالة الطالب": row.status, "ملاحظات": row.notes }));
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(details);
    sheet["!cols"] = [{ wch: 6 }, { wch: 34 }, { wch: 18 }, { wch: 18 }, { wch: 28 }];
    XLSX.utils.book_append_sheet(workbook, sheet, "الحضور اليومي");
    XLSX.writeFile(workbook, `تقرير-حضور-${safeFile(selectedClass)}-${selectedDate}.xlsx`);
  }

  function printAdminReport() {
    const rows = reportRows();
    if (!selectedClass || !rows.length) return setMessage("اختر فصلًا يحتوي على طلاب أولًا");
    const popup = window.open("", "_blank", "width=1200,height=900");
    if (!popup) return setMessage("اسمح بالنوافذ المنبثقة لفتح التقرير");
    const bodyRows = rows.map((row) => `<tr><td>${row.number}</td><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.className)}</td><td>${escapeHtml(row.status)}</td><td></td></tr>`).join("");
    popup.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير حضور ${escapeHtml(selectedClass)}</title><style>@page{size:A4 landscape;margin:0}*{box-sizing:border-box}body{margin:0;background:#eef2f5;font-family:Arial,Tahoma,sans-serif}.toolbar{display:flex;justify-content:center;gap:10px;padding:10px;background:#173f61}.toolbar button{border:0;border-radius:8px;padding:10px 18px;font-weight:800}.page{position:relative;width:297mm;height:210mm;margin:8mm auto;background:#fff;padding:7mm 9mm 12mm;overflow:hidden}.portal{text-align:center;font-weight:900;color:#173f61;border-bottom:2px solid #173f61;padding-bottom:4px}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:4px 8px;border:1px solid #222;padding:5px;font-size:9px}h1{text-align:center;font-size:16px;margin:5px}.summary{display:flex;justify-content:space-around;border:1px solid #222;border-top:0;padding:4px;font-size:9px;font-weight:800}table{width:100%;border-collapse:collapse;margin-top:5px;table-layout:fixed}th,td{border:1px solid #222;padding:2.5px 4px;font-size:8.3px}th{background:#edf3f7}.signatures{display:flex;justify-content:space-between;margin-top:5px;font-size:9px;font-weight:700}footer{position:absolute;right:9mm;left:9mm;bottom:4mm;display:flex;justify-content:space-between;border-top:1px solid #666;padding-top:3px;font-size:8px}@media print{body{background:#fff}.toolbar{display:none}.page{margin:0;width:297mm;height:210mm}}</style></head><body><div class="toolbar"><button onclick="window.print()">طباعة أو حفظ PDF</button><button onclick="window.close()">إغلاق</button></div><section class="page"><div class="portal">${PORTAL_NAME}</div><h1>تقرير الحضور اليومي للإدارة</h1><div class="meta"><span><b>المعلم:</b> ${escapeHtml(teacherName)}</span><span><b>المادة:</b> ${escapeHtml(subject)}</span><span><b>الفصل:</b> ${escapeHtml(selectedClass)}</span><span><b>التاريخ:</b> ${selectedDate}</span></div><div class="summary"><span>الإجمالي: ${rows.length}</span><span>حاضر: ${counts.present}</span><span>غائب: ${counts.absent}</span><span>متأخر: ${counts.late}</span><span>مستأذن: ${counts.excused}</span><span>هروب: ${counts.escaped}</span></div><table><thead><tr><th>م</th><th>اسم الطالب</th><th>الفصل</th><th>الحالة</th><th>ملاحظات</th></tr></thead><tbody>${bodyRows}</tbody></table><div class="signatures"><span>توقيع المعلم: __________________</span><span>اعتماد الإدارة: __________________</span></div><footer><strong>${PORTAL_NAME}</strong><span>صفحة واحدة</span></footer></section></body></html>`);
    popup.document.close();
  }

  async function buildRangeRows(): Promise<{ rows: RangeRow[]; days: string[] }> {
    if (!selectedClass || !attendancePath || !reportFrom || !reportTo) throw new Error("اختر الفصل والفترة");
    if (reportFrom > reportTo) throw new Error("تاريخ البداية يجب أن يكون قبل تاريخ النهاية");
    const localDocuments = Object.values(readAttendanceIndex(teacherId, subjectKey));
    let serverDocuments: AttendanceDocument[] = [];
    try {
      const snapshot = await withTimeout(getDocs(collection(db, attendancePath)), 5000);
      serverDocuments = snapshot.docs.map((item) => item.data() as AttendanceDocument);
    } catch {
      serverDocuments = [];
    }
    const merged = new Map<string, AttendanceDocument>();
    [...serverDocuments, ...localDocuments].forEach((item) => {
      if (!item.class || !item.date) return;
      merged.set(`${item.class}|${item.date}`, item);
    });
    const documents = [...merged.values()]
      .filter((item) => item.class === selectedClass && !!item.date && item.date! >= reportFrom && item.date! <= reportTo)
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    const days = [...new Set(documents.map((item) => item.date || "").filter(Boolean))];
    const rows = classStudents.map((student, index) => {
      const code = studentCode(student);
      const dates = { absentDates: [] as string[], lateDates: [] as string[], excusedDates: [] as string[], escapedDates: [] as string[] };
      let present = 0;
      documents.forEach((item) => {
        const date = item.date || "";
        const status = item.records?.[code] || "present";
        if (status === "present") present += 1;
        if (status === "absent") dates.absentDates.push(date);
        if (status === "late") dates.lateDates.push(date);
        if (status === "excused") dates.excusedDates.push(date);
        if (status === "escaped") dates.escapedDates.push(date);
      });
      const counted = documents.length;
      const attendanceRate = counted ? Math.round(((present + dates.lateDates.length + dates.excusedDates.length) / counted) * 100) : 0;
      return { number: index + 1, name: clean(student.name) || "طالب بدون اسم", present, ...dates, attendanceRate };
    });
    return { rows, days };
  }

  async function exportRangeExcel() {
    try {
      setReporting(true);
      const { rows, days } = await buildRangeRows();
      if (!days.length) return setMessage("لا توجد سجلات حضور محفوظة في الفترة المحددة");
      const details = rows.map((row) => ({
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

  if (!ready) return <main className="attendance-page" dir="rtl"><section className="attendance-card"><p>{message || "جارٍ تجهيز بيانات الحساب..."}</p></section></main>;
  const statuses = Object.entries(STATUS_LABELS) as [AttendanceStatus, string][];

  return <main className="attendance-page" dir="rtl"><section className="attendance-card">
    <header className="attendance-head"><div><h1>التحضير اليومي — {subject}</h1><p>تظهر فقط الفصول المخصصة للمادة الحالية، وكل تغيير يُحفظ مباشرة.</p></div><div className="hijri-card"><small>التاريخ الهجري</small><strong>{formatHijri(selectedDate)}</strong><div><button onClick={() => moveDay(-1)}>اليوم السابق</button><button onClick={() => setSelectedDate(toDateInput(new Date()))}>اليوم</button><button onClick={() => moveDay(1)}>اليوم التالي</button></div></div></header>
    <div className="attendance-controls"><label>الفصل<select value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)}><option value="">اختر الفصل</option>{classes.map((className) => <option key={className}>{className}</option>)}</select></label><label>التاريخ<input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)}/></label><button onClick={() => void saveAttendance()} disabled={!selectedClass || saving}>{saving ? "جارٍ الحفظ..." : "حفظ التحضير"}</button><button type="button" onClick={printAdminReport} disabled={!selectedClass || !classStudents.length}>تقرير يومي PDF</button><button type="button" onClick={exportExcel} disabled={!selectedClass || !classStudents.length}>تقرير يومي Excel</button></div>
    <section className="attendance-range-report"><h2>تقرير أسبوعي أو فترة محددة</h2><p>يعرض تواريخ الغياب والتأخير والاستئذان والهروب.</p><div className="attendance-controls"><label>من تاريخ<input type="date" value={reportFrom} onChange={(event) => setReportFrom(event.target.value)}/></label><label>إلى تاريخ<input type="date" value={reportTo} onChange={(event) => setReportTo(event.target.value)}/></label><button type="button" onClick={() => void exportRangeExcel()} disabled={!selectedClass || reporting}>{reporting ? "جارٍ التجهيز..." : "تقرير الفترة Excel"}</button></div></section>
    <div className="attendance-stats"><span className="present">حاضر: {counts.present}</span><span className="absent">غائب: {counts.absent}</span><span>متأخر: {counts.late}</span><span>مستأذن: {counts.excused}</span><span className="escaped">هروب: {counts.escaped}</span></div>
    <div className="attendance-list">{classStudents.map((student, index) => <article key={studentCode(student)}><div className="student-info"><b>{index + 1}</b><div><strong>{student.name || "طالب بدون اسم"}</strong><small>{selectedClass} — {studentCode(student)}</small></div></div><div className="status-buttons">{statuses.map(([status, label]) => <button key={status} className={(records[studentCode(student)] || "present") === status ? `active ${status}` : ""} onClick={() => setStudentStatus(student, status)}>{label}</button>)}</div></article>)}{!selectedClass ? <p className="attendance-empty">اختر الفصل لعرض الطلاب.</p> : null}{selectedClass && !classStudents.length ? <p className="attendance-empty">لا يوجد طلاب في هذا الفصل. أضفهم من إدارة الطلاب.</p> : null}</div>
    {message ? <p className="attendance-message">{message}</p> : null}
  </section></main>;
}
