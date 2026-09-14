"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import * as XLSX from "xlsx";
import { downloadAttendancePdfDocument, type AttendancePdfClass } from "../../../lib/attendance-pdf";
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
const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "حاضر",
  absent: "غائب",
  late: "متأخر",
  excused: "مستأذن",
  escaped: "هروب",
};
const ATTENDANCE_CLASS_COLORS = [
  "#0e4b59", "#2457a1", "#6f3fa0", "#a34f2f",
  "#2f7a55", "#8a5a05", "#8f3555", "#3f5f8f",
];
function toDateInput(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
function attendanceToday() { return toDateInput(new Date()); }
function schoolWeekDates(base: string) {
  const current = new Date(`${base}T12:00:00`);
  const sundayOffset = current.getDay();
  current.setDate(current.getDate() - sundayOffset);
  return Array.from({ length: 5 }, (_, index) => { const day = new Date(current); day.setDate(current.getDate() + index); return toDateInput(day); });
}
function isFutureAttendanceDate(value: string) { return Boolean(value && value > attendanceToday()); }
function clampAttendanceDate(value: string) {
  const today = attendanceToday();
  if (!value) return today;
  if (value < ATTENDANCE_START_DATE) return ATTENDANCE_START_DATE;
  return value > today ? today : value;
}
function formatHijri(value: string) {
  return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-arab", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}
function formatShortDate(value: string) { const [, month, day] = value.split("-"); return `${day}/${month}`; }
function safeId(value: string) { return encodeURIComponent(value).replace(/%/g, "_"); }
function safeFile(value: string) { return value.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "-"); }
function escapeHtml(value: string) { return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character] || character)); }
function startOfCurrentWeek() { const date = new Date(); const day = date.getDay(); date.setDate(date.getDate() - (day === 0 ? 6 : day - 1)); return toDateInput(date); }
function datesText(values: string[]) { return values.length ? values.map(formatShortDate).join("، ") : "—"; }
function attendanceKey(teacherId: string, subjectKey: string, className: string, date: string) { return `lahooni-attendance:${teacherId}:${subjectKey}:${safeId(className)}:${date}`; }
function legacyAttendanceKey(teacherId: string, subjectKey: string, className: string, date: string) { return `lahooni-local-attendance:${teacherId}:${subjectKey}:${className}:${date}`; }
function attendanceIndexKey(teacherId: string, subjectKey: string) { return `lahooni-attendance-index:${teacherId}:${subjectKey}`; }
function attendanceDeletedKey(teacherId: string, subjectKey: string, className: string, date: string) { return `lahooni-attendance-deleted:${teacherId}:${subjectKey}:${safeId(className)}:${date}`; }
function readRecords(key: string) {
  if (typeof window === "undefined" || !key) return null;
  try { const parsed = JSON.parse(localStorage.getItem(key) || "null"); return parsed && typeof parsed === "object" ? parsed as Record<string, AttendanceStatus> : null; } catch { return null; }
}
function readAttendanceIndex(teacherId: string, subjectKey: string) {
  if (typeof window === "undefined" || !teacherId) return {} as Record<string, AttendanceDocument>;
  try { const parsed = JSON.parse(localStorage.getItem(attendanceIndexKey(teacherId, subjectKey)) || "{}"); return parsed && typeof parsed === "object" ? parsed as Record<string, AttendanceDocument> : {}; } catch { return {}; }
}
function withTimeout<T>(promise: Promise<T>, milliseconds: number) { return Promise.race<T>([promise, new Promise<T>((_, reject) => window.setTimeout(() => reject(new Error("timeout")), milliseconds))]); }
function canonicalClassFromParts(gradeValue: unknown, sectionValue: unknown, classValue: unknown) {
  const rawClassName = clean(classValue); const grade = rosterGradeNumber(gradeValue || rawClassName); const section = rosterSectionNumber(sectionValue, rawClassName);
  return grade && section ? canonicalClassName(grade, section) : normalizeClass(rawClassName) || rawClassName;
}
function classNamesFromPayload(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return value.map(item => { if (typeof item === "string") return normalizeClass(item) || clean(item); if (!item || typeof item !== "object") return ""; const row = item as Record<string, unknown>; return canonicalClassFromParts(row.grade,row.section,row.name || row.className || row.class || row.id); }).filter(Boolean);
}
function attendanceClassKey(value: unknown, gradeValue?: unknown, sectionValue?: unknown) { const canonical = canonicalClassFromParts(gradeValue, sectionValue, value); return normalizeClass(canonical) || clean(canonical); }
function attendanceStudentMatchesClass(student: UnifiedStudent, className: string) { const studentClass = attendanceClassKey(student.className || student.class, student.grade, student.section); const targetClass = attendanceClassKey(className); return Boolean(studentClass && targetClass && studentClass === targetClass); }
function uniqueActiveRoster(source: UnifiedStudent[]) {
  const byCode = new Map<string, UnifiedStudent>();
  source.forEach(student => { const code = studentCode(student); const name = clean(student.name); if (!code || !name || student.active === false || student.rosterActive === false) return; byCode.set(code, { ...student, id: code, code, name }); });
  return [...byCode.values()];
}

export default function AttendancePage() {
  const session = useTeacherClient();
  const teacherId = session?.teacherId || ""; const teacherName = session?.teacherName || ""; const subjectKey = (session?.subjectKey as SubjectKey) || "history"; const subject = session?.subject || ""; const ready = !!teacherId && !!session?.subjectKey; const assignments = session?.assignments || [];
  const [localStudents,setLocalStudents]=useState<UnifiedStudent[]>([]); const [officialStudents,setOfficialStudents]=useState<UnifiedStudent[]>([]); const [officialClasses,setOfficialClasses]=useState<string[]>([]); const [timetableClasses,setTimetableClasses]=useState<string[]>([]); const [timetableLessons,setTimetableLessons]=useState<Record<string,TimetableLesson>>({}); const [selectedClass,setSelectedClass]=useState(""); const [selectedDate,setSelectedDate]=useState(clampAttendanceDate(toDateInput(new Date()))); const [reportFrom,setReportFrom]=useState(clampAttendanceDate(startOfCurrentWeek())); const [reportTo,setReportTo]=useState(clampAttendanceDate(toDateInput(new Date()))); const [records,setRecords]=useState<Record<string,AttendanceStatus>>({}); const [message,setMessage]=useState(""); const [saving,setSaving]=useState(false); const [deleting,setDeleting]=useState(false); const [hasSavedRecord,setHasSavedRecord]=useState(false); const [reporting,setReporting]=useState(false); const [allPdfBusy,setAllPdfBusy]=useState(false); const cloudSyncTimerRef=useRef<number|null>(null);
  const attendancePath = useMemo(() => (teacherId ? tenantCollection(teacherId, subjectKey, "attendance") : ""), [teacherId, subjectKey]);
  useEffect(() => () => { if (cloudSyncTimerRef.current !== null) window.clearTimeout(cloudSyncTimerRef.current); }, []);
  const assignmentScoped = useMemo(() => hasDetailedAssignments(assignments, subjectKey), [assignments, subjectKey]);
  const assignedClasses = useMemo(() => assignmentClassNames(assignments, subjectKey), [assignments, subjectKey]);
  const classAllowed = (className: string) => !assignmentScoped || classMatchesAssignments(className, assignments, subjectKey);

  useEffect(() => { if (!teacherId) return; const load = () => setLocalStudents(loadLocalRoster(teacherId, subjectKey)); load(); window.addEventListener("storage", load); window.addEventListener("lahooni-roster-updated", load as EventListener); return () => { window.removeEventListener("storage", load); window.removeEventListener("lahooni-roster-updated", load as EventListener); }; }, [teacherId, subjectKey]);

  useEffect(() => {
    if (!ready) return;
    let active = true; const controller = new AbortController(); const timer = window.setTimeout(() => controller.abort(), 8000); const params = new URLSearchParams({ subjectId: subjectKey }); if (session?.activeGrade) params.set("grade", String(session.activeGrade));
    fetch(`/api/teacher/students?${params.toString()}`, { cache: "no-store", credentials: "same-origin", signal: controller.signal })
      .then(response => response.ok ? response.json() : Promise.reject(new Error("roster_load_failed")))
      .then(data => { if (!active) return; const list: UnifiedStudent[] = (Array.isArray(data.students) ? data.students : []).map((student: Record<string, unknown>) => { const code = String(student.code || student.id || student.accessCode || student.studentCode || "").trim().toUpperCase(); const className = String(student.className || student.class || "").trim(); return { ...student, id: code, code, accessCode: code, studentCode: code, name: String(student.name || "").trim(), class: className, className, active: student.active !== false, rosterActive: student.active !== false } as UnifiedStudent; }).filter((student: UnifiedStudent) => !!student.id && !!student.name && !!student.class); list.sort((a,b)=>clean(a.class).localeCompare(clean(b.class),"ar",{numeric:true})||clean(a.name).localeCompare(clean(b.name),"ar")); const receivedClasses=[...classNamesFromPayload(data.classes),...classNamesFromPayload(data.availableClasses)]; setOfficialClasses([...new Set(receivedClasses)]); setOfficialStudents(list); const cached=loadLocalRoster(teacherId,subjectKey); const merged=mergeStudents(cached,list); setLocalStudents(merged); if(JSON.stringify(cached)!==JSON.stringify(merged)) saveLocalRoster(teacherId,merged,subjectKey); })
      .catch(() => { if (active) setMessage(current => current || "تعذر تحديث القائمة الرسمية، وتم عرض النسخة المحفوظة على الجهاز."); })
      .finally(() => window.clearTimeout(timer));
    return () => { active=false; controller.abort(); window.clearTimeout(timer); };
  }, [ready, teacherId, subjectKey, session?.activeGrade]);

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    fetch(`/api/teacher/timetable?subjectId=${encodeURIComponent(subjectKey)}`, { cache: "no-store", credentials: "same-origin", signal: controller.signal })
      .then(response => response.ok ? response.json() : Promise.reject(new Error("timetable_load_failed")))
      .then(data => { const lessonMap = data.lessons && typeof data.lessons === "object" ? data.lessons as Record<string, TimetableLesson> : {}; const lessons = Object.values(lessonMap); setTimetableLessons(lessonMap); setTimetableClasses([...new Set(lessons.map(lesson => normalizeClass(lesson.className)).filter(Boolean))]); })
      .catch(() => { setTimetableLessons({}); setTimetableClasses([]); });
    return () => controller.abort();
  }, [ready, subjectKey]);

  const scopedOfficialStudents = useMemo(() => officialStudents, [officialStudents]);
  const scopedLocalStudents = useMemo(() => localStudents.filter(student => classAllowed(normalizeClass(student.class) || clean(student.class))), [localStudents, assignmentScoped, assignments, subjectKey]);
  const students = useMemo(() => { if (scopedOfficialStudents.length) return uniqueActiveRoster(scopedOfficialStudents); const deleted = loadDeletedCodes(teacherId); return uniqueActiveRoster(mergeStudents(scopedLocalStudents, scopedOfficialStudents)).filter(student => !deleted.has(studentCode(student))); }, [scopedOfficialStudents, scopedLocalStudents, teacherId]);
  const officialStudentClasses = useMemo(() => officialStudents.map(student => normalizeClass(student.class) || clean(student.class)).filter(Boolean), [officialStudents]);
  const classes = useMemo(() => { const officialSource=[...officialClasses,...officialStudentClasses].filter(Boolean); const fallbackSource=[...assignedClasses,...timetableClasses,...students.map(student=>normalizeClass(student.class)||clean(student.class))].filter(Boolean).filter(classAllowed); const source=officialSource.length?officialSource:fallbackSource; return [...new Set(source)].sort((a,b)=>a.localeCompare(b,"ar",{numeric:true})); }, [officialClasses,officialStudentClasses,assignedClasses,timetableClasses,students,assignmentScoped,assignments,subjectKey]);

  const classStudents=useMemo(()=>students.filter(student=>attendanceStudentMatchesClass(student,selectedClass)),[students,selectedClass]);
  useEffect(()=>{if(!classes.length){setSelectedClass("");return;} if(!selectedClass||!classes.includes(selectedClass))setSelectedClass(classes[0]);},[classes,selectedClass]);

  useEffect(() => {
    if (!selectedClass || !attendancePath) { setRecords({}); setHasSavedRecord(false); return; }
    const defaults = Object.fromEntries(classStudents.map(student => [studentCode(student), "present" as AttendanceStatus]));
    if (selectedDate < ATTENDANCE_START_DATE) { setRecords(defaults); setHasSavedRecord(false); return; }
    const key = attendanceKey(teacherId, subjectKey, selectedClass, selectedDate); const documentId = `${safeId(selectedClass)}_${selectedDate}`;
    const applyLocalFallback = () => { const local = readRecords(key) || readRecords(legacyAttendanceKey(teacherId, subjectKey, selectedClass, selectedDate)); if (local && !localStorage.getItem(attendanceDeletedKey(teacherId, subjectKey, selectedClass, selectedDate))) { setRecords(Object.fromEntries(classStudents.map(student => [studentCode(student), local[studentCode(student)] || "present"]))); setHasSavedRecord(true); } else { setRecords(defaults); setHasSavedRecord(false); } };
    applyLocalFallback(); let active=true;
    withTimeout(getDoc(doc(db, attendancePath, documentId)), 3500).then(snapshot => { if(!active||!snapshot.exists()) return; const data=snapshot.data() as AttendanceDocument; const saved=data.records||{}; const next=Object.fromEntries(classStudents.map(student=>[studentCode(student),saved[studentCode(student)]||saved[student.id]||"present"])) as Record<string,AttendanceStatus>; setRecords(next); setHasSavedRecord(true); localStorage.setItem(key,JSON.stringify(next)); localStorage.setItem(`${key}:details`,JSON.stringify(data)); const index=readAttendanceIndex(teacherId,subjectKey); index[documentId]=data; localStorage.setItem(attendanceIndexKey(teacherId,subjectKey),JSON.stringify(index)); localStorage.removeItem(attendanceDeletedKey(teacherId,subjectKey,selectedClass,selectedDate)); }).catch(()=>undefined);
    return()=>{active=false;};
  }, [selectedClass, selectedDate, classStudents, attendancePath, teacherId, subjectKey]);

  const counts=useMemo(()=>{const values=classStudents.map(student=>records[studentCode(student)]||"present"); return{present:values.filter(v=>v==="present").length,absent:values.filter(v=>v==="absent").length,late:values.filter(v=>v==="late").length,excused:values.filter(v=>v==="excused").length,escaped:values.filter(v=>v==="escaped").length};},[classStudents,records]);
  function persistLocal(nextRecords:Record<string,AttendanceStatus>){if(!selectedClass||!teacherId||selectedDate<ATTENDANCE_START_DATE||isFutureAttendanceDate(selectedDate))return; const payload:AttendanceDocument={class:selectedClass,date:selectedDate,records:nextRecords,teacherId,subjectKey,updatedAt:new Date().toISOString()}; const key=attendanceKey(teacherId,subjectKey,selectedClass,selectedDate); localStorage.setItem(key,JSON.stringify(nextRecords)); localStorage.setItem(`${key}:details`,JSON.stringify(payload)); const index=readAttendanceIndex(teacherId,subjectKey); index[`${safeId(selectedClass)}_${selectedDate}`]=payload; localStorage.setItem(attendanceIndexKey(teacherId,subjectKey),JSON.stringify(index)); localStorage.removeItem(attendanceDeletedKey(teacherId,subjectKey,selectedClass,selectedDate)); setHasSavedRecord(true); window.dispatchEvent(new CustomEvent("lahooni:attendance-updated",{detail:payload}));}
  function queueCloudAttendanceSync(nextRecords:Record<string,AttendanceStatus>){const className=selectedClass; const date=selectedDate; const path=attendancePath; if(!className||!path||date<ATTENDANCE_START_DATE||isFutureAttendanceDate(date))return; if(cloudSyncTimerRef.current!==null)window.clearTimeout(cloudSyncTimerRef.current); cloudSyncTimerRef.current=window.setTimeout(async()=>{cloudSyncTimerRef.current=null; try{await withTimeout(setDoc(doc(db,path,`${safeId(className)}_${date}`),{class:className,date,hijriDate:formatHijri(date),records:nextRecords,teacherId,teacherName,subjectKey,subject,autoSaved:false,autoSavedReason:null,manualEdited:true,manualEditedAt:new Date().toISOString(),updatedAt:new Date().toISOString()},{merge:true}),5000); setMessage("تمت مزامنة التعديل فورًا في التطبيق والويب وبوابة الطالب");}catch{setMessage("تم حفظ التعديل على الجهاز، وستتم مزامنته عند الضغط على حفظ التحضير أو عودة الاتصال");}},450);}
  function clearLocalAttendance(){if(!selectedClass||!teacherId)return; const key=attendanceKey(teacherId,subjectKey,selectedClass,selectedDate); localStorage.removeItem(key); localStorage.removeItem(`${key}:details`); localStorage.removeItem(legacyAttendanceKey(teacherId,subjectKey,selectedClass,selectedDate)); const index=readAttendanceIndex(teacherId,subjectKey); delete index[`${safeId(selectedClass)}_${selectedDate}`]; localStorage.setItem(attendanceIndexKey(teacherId,subjectKey),JSON.stringify(index)); localStorage.setItem(attendanceDeletedKey(teacherId,subjectKey,selectedClass,selectedDate),"1");}
  function setStudentStatus(student:UnifiedStudent,status:AttendanceStatus){if(selectedDate<ATTENDANCE_START_DATE){setMessage(`يبدأ التحضير من ${ATTENDANCE_START_LABEL} ولا يمكن التسجيل قبل هذا التاريخ.`);return;} if(isFutureAttendanceDate(selectedDate)){setMessage("لا يفتح تحضير اليوم إلا عند الساعة 12:00 منتصف الليل مع بداية اليوم نفسه.");return;} const code=studentCode(student); const next={...records,[code]:status}; setRecords(next); persistLocal(next); queueCloudAttendanceSync(next); setMessage("تم الحفظ مباشرة وجارٍ توحيد التعديل في التطبيق والويب وبوابة الطالب");}
  function moveDay(amount:number){const date=new Date(`${selectedDate}T12:00:00`); date.setDate(date.getDate()+amount); setSelectedDate(clampAttendanceDate(toDateInput(date)));}
  async function saveAttendance(){if(!selectedClass||!attendancePath)return setMessage("اختر الفصل أولًا"); if(selectedDate<ATTENDANCE_START_DATE)return setMessage(`يبدأ التحضير من ${ATTENDANCE_START_LABEL} ولا يمكن الحفظ قبل هذا التاريخ.`); if(isFutureAttendanceDate(selectedDate))return setMessage("لا يفتح تحضير اليوم إلا عند الساعة 12:00 منتصف الليل مع بداية اليوم نفسه."); persistLocal(records); if(cloudSyncTimerRef.current!==null){window.clearTimeout(cloudSyncTimerRef.current);cloudSyncTimerRef.current=null;} setSaving(true); try{await withTimeout(setDoc(doc(db,attendancePath,`${safeId(selectedClass)}_${selectedDate}`),{class:selectedClass,date:selectedDate,hijriDate:formatHijri(selectedDate),records,teacherId,teacherName,subjectKey,subject,autoSaved:false,autoSavedReason:null,manualEdited:true,manualEditedAt:new Date().toISOString(),updatedAt:new Date().toISOString()},{merge:true}),4000);setMessage("تم حفظ التحضير ومزامنته في التطبيق والويب وبوابة الطالب");}catch{setMessage("تم حفظ التحضير بنجاح على الجهاز، وستتم المزامنة عند توفر الاتصال");}finally{setSaving(false);}}
  async function deleteAttendance(){if(!selectedClass||!attendancePath)return setMessage("اختر الفصل أولًا"); if(selectedDate<ATTENDANCE_START_DATE)return setMessage(`لا توجد تحاضير معتمدة قبل ${ATTENDANCE_START_LABEL}.`); if(!hasSavedRecord)return setMessage("لا يوجد تحضير محفوظ لهذا الفصل في التاريخ المحدد"); if(!window.confirm(`هل تريد حذف تحضير ${selectedClass} بتاريخ ${selectedDate} نهائيًا؟`))return; setDeleting(true); try{await withTimeout(deleteDoc(doc(db,attendancePath,`${safeId(selectedClass)}_${selectedDate}`)),5000);clearLocalAttendance();setRecords(Object.fromEntries(classStudents.map(student=>[studentCode(student),"present"])));setHasSavedRecord(false);setMessage("تم حذف التحضير من الجهاز والسحابة بنجاح");}catch{setMessage("تعذر حذف التحضير من السحابة؛ تحقق من الاتصال ثم أعد المحاولة حتى لا يعود السجل لاحقًا");}finally{setDeleting(false);}}
  function reportRows(){const pdfRoster=uniqueActiveRoster(officialStudents.length?officialStudents:students).filter(student=>attendanceStudentMatchesClass(student,selectedClass)).sort((a,b)=>clean(a.name).localeCompare(clean(b.name),"ar")); return pdfRoster.map((student,index)=>({number:index+1,name:clean(student.name)||"طالب بدون اسم",className:selectedClass,status:STATUS_LABELS[records[studentCode(student)]||"present"],notes:""}));}
  function exportExcel(){const rows=reportRows(); if(!selectedClass||!rows.length)return setMessage("الفصل ظاهر في الجدول، لكن لا توجد له أسماء طلاب مسجلة بعد."); const details=rows.map(row=>({"م":row.number,"اسم الطالب":row.name,"الفصل":row.className,"حالة الطالب":row.status,"ملاحظات":row.notes})); const workbook=XLSX.utils.book_new(); const sheet=XLSX.utils.json_to_sheet(details); sheet["!cols"]=[{wch:6},{wch:34},{wch:22},{wch:18},{wch:28}]; XLSX.utils.book_append_sheet(workbook,sheet,"الحضور اليومي"); XLSX.writeFile(workbook,`تقرير-حضور-${safeFile(selectedClass)}-${selectedDate}.xlsx`);}
  async function downloadAttendancePdf(){const rows=reportRows(); if(!selectedClass||!rows.length)return setMessage("الفصل ظاهر في الجدول، لكن لا توجد له أسماء طلاب مسجلة بعد."); try{const result=await downloadAttendancePdfDocument({portalName:PORTAL_NAME,teacherName,subject,date:selectedDate,hijriDate:formatHijri(selectedDate),fileName:`تحضير-${safeFile(selectedClass)}-${selectedDate}.pdf`,classes:[{className:selectedClass,rows:rows.map(row=>({number:row.number,name:row.name,status:row.status})),counts}]});setMessage(`تم تنزيل PDF كامل: ${result.studentCount} طالبًا في ${result.pageCount} صفحة.`);}catch{setMessage("تعذر إنشاء PDF الآن. حدّث الصفحة ثم أعد المحاولة.");}}
  async function downloadAllAttendancePdf(){if(!attendancePath||!classes.length)return setMessage("لا توجد فصول متاحة للطباعة."); setAllPdfBusy(true); try{const pdfRosterSource=uniqueActiveRoster(officialStudents.length?officialStudents:students); const reports=await Promise.all(classes.map(async className=>{const roster=pdfRosterSource.filter(student=>attendanceStudentMatchesClass(student,className)).sort((a,b)=>clean(a.name).localeCompare(clean(b.name),"ar")); if(!roster.length)return null; let savedRecords=readRecords(attendanceKey(teacherId,subjectKey,className,selectedDate))||readRecords(legacyAttendanceKey(teacherId,subjectKey,className,selectedDate))||{}; try{const snapshot=await withTimeout(getDoc(doc(db,attendancePath,`${safeId(className)}_${selectedDate}`)),3500); if(snapshot.exists()){const data=snapshot.data() as AttendanceDocument; if(data.records&&typeof data.records==="object")savedRecords=data.records;}}catch{} const values=roster.map(student=>savedRecords[studentCode(student)]||"present"); return{className,rows:roster.map((student,index)=>({number:index+1,name:clean(student.name)||"طالب بدون اسم",status:STATUS_LABELS[savedRecords[studentCode(student)]||"present"]})),counts:{present:values.filter(v=>v==="present").length,absent:values.filter(v=>v==="absent").length,late:values.filter(v=>v==="late").length,excused:values.filter(v=>v==="excused").length,escaped:values.filter(v=>v==="escaped").length}} satisfies AttendancePdfClass;})); const printable=reports.filter((item):item is AttendancePdfClass=>!!item); if(!printable.length)throw new Error(); const result=await downloadAttendancePdfDocument({portalName:PORTAL_NAME,teacherName,subject,date:selectedDate,hijriDate:formatHijri(selectedDate),fileName:`تحضير-جميع-الفصول-${selectedDate}.pdf`,classes:printable}); setMessage(`تم تنزيل جميع الفصول: ${result.classCount} فصل، ${result.studentCount} طالبًا، ${result.pageCount} صفحة.`);}catch{setMessage("تعذر إنشاء PDF جميع الفصول الآن. أعد المحاولة بعد تحديث الصفحة.");}finally{setAllPdfBusy(false);}}

  async function buildRangeRows():Promise<{rows:RangeRow[];days:string[]}>{if(!selectedClass||!attendancePath||!reportFrom||!reportTo)throw new Error("اختر الفصل والفترة"); if(reportFrom<ATTENDANCE_START_DATE)throw new Error(`تبدأ التقارير من ${ATTENDANCE_START_LABEL}`); if(reportFrom>reportTo)throw new Error("تاريخ البداية يجب أن يكون قبل تاريخ النهاية"); const localDocuments=Object.values(readAttendanceIndex(teacherId,subjectKey)); let serverDocuments:AttendanceDocument[]=[]; try{const snapshot=await withTimeout(getDocs(collection(db,attendancePath)),5500); serverDocuments=snapshot.docs.map(item=>item.data() as AttendanceDocument);}catch{} const merged=new Map<string,AttendanceDocument>(); [...serverDocuments,...localDocuments].forEach(item=>{if(!item.class||!item.date)return; merged.set(`${item.class}|${item.date}`,item);}); const documents=[...merged.values()].filter(item=>item.class===selectedClass&&!!item.date&&item.date!>=ATTENDANCE_START_DATE&&item.date!>=reportFrom&&item.date!<=reportTo).sort((a,b)=>(a.date||"").localeCompare(b.date||"")); const days=[...new Set(documents.map(item=>item.date||"").filter(Boolean))]; const rows=classStudents.map((student,index)=>{const code=studentCode(student); const dates={absentDates:[] as string[],lateDates:[] as string[],excusedDates:[] as string[],escapedDates:[] as string[]}; let present=0; documents.forEach(item=>{const date=item.date||""; const status=item.records?.[code]||"present"; if(status==="present")present+=1; if(status==="absent")dates.absentDates.push(date); if(status==="late")dates.lateDates.push(date); if(status==="excused")dates.excusedDates.push(date); if(status==="escaped")dates.escapedDates.push(date);}); const counted=documents.length; const attendanceRate=counted?Math.round(((present+dates.lateDates.length+dates.excusedDates.length)/counted)*100):0; return{number:index+1,name:clean(student.name)||"طالب بدون اسم",present,...dates,attendanceRate};}); return{rows,days};}
  async function exportRangeExcel(){try{setReporting(true); const{rows,days}=await buildRangeRows(); if(!classStudents.length)return setMessage("الفصل ظاهر في الجدول، لكن لا توجد له أسماء طلاب مسجلة بعد."); if(!days.length)return setMessage("لا توجد سجلات حضور محفوظة في الفترة المحددة"); const details=rows.map(row=>({"م":row.number,"اسم الطالب":row.name,"الحضور":row.present,"تواريخ الغياب":datesText(row.absentDates),"تواريخ التأخير":datesText(row.lateDates),"تواريخ الاستئذان":datesText(row.excusedDates),"تواريخ الهروب":datesText(row.escapedDates),"نسبة الحضور":`${row.attendanceRate}%`})); const workbook=XLSX.utils.book_new(); const sheet=XLSX.utils.json_to_sheet(details); sheet["!cols"]=[{wch:6},{wch:30},{wch:10},{wch:30},{wch:30},{wch:30},{wch:30},{wch:14}]; XLSX.utils.book_append_sheet(workbook,sheet,"تواريخ حالات الطلاب"); XLSX.writeFile(workbook,`تقرير-حضور-${safeFile(selectedClass)}-${reportFrom}-إلى-${reportTo}.xlsx`); setMessage("تم تحميل تقرير الفترة");}catch(error){setMessage(error instanceof Error?error.message:"تعذر تصدير التقرير");}finally{setReporting(false);}}
  async function printRangePdf(){setMessage("استخدم تقرير Excel للفترة مؤقتًا لتقليل القراءات، وسيبقى PDF اليومي متاحًا.");}
  async function printWeeklyAllClassesPdf(){setMessage("تم تعطيل التقرير الأسبوعي الشامل مؤقتًا لتقليل قراءات Firestore. التقارير اليومية وExcel ما زالت تعمل.");}

  if(!ready)return <main className="attendance-page attendance-command-center" dir="rtl"><section className="attendance-card attendance-loading"><p>{message||"جارٍ تجهيز بيانات الحساب..."}</p></section></main>;
  const statuses=Object.entries(STATUS_LABELS) as [AttendanceStatus,string][]; const totalStudents=classStudents.length; const dailyRate=totalStudents?Math.round(((counts.present+counts.late+counts.excused)/totalStudents)*100):0;
  return <main className="attendance-page attendance-command-center" dir="rtl"><section className="attendance-card"><header className="attendance-head attendance-hero"><div className="attendance-head-copy"><span className="attendance-eyebrow">بوابة تحضير الطلاب</span><h1>التحضير اليومي — {subject}</h1><p>سجّل حالة كل طالب بلمسة واحدة. يبدأ احتساب التحضير رسميًا من {ATTENDANCE_START_LABEL}.</p><div className="attendance-hero-badges"><span>مزامنة بين التطبيق والويب</span><span>مرتبط بالجدول</span><span>تقارير يومية</span></div></div><div className="hijri-card"><small>اليوم الدراسي</small><strong>{formatHijri(selectedDate)}</strong><div className="attendance-day-nav"><button type="button" onClick={()=>moveDay(-1)}>السابق</button><button type="button" className="today" onClick={()=>setSelectedDate(attendanceToday())}>اليوم</button><button type="button" onClick={()=>moveDay(1)}>التالي</button></div></div></header><section className="attendance-setup-panel"><div className="attendance-primary-controls"><label><span>الفصل</span><select value={selectedClass} onChange={event=>setSelectedClass(event.target.value)}><option value="">اختر الفصل</option>{classes.map(className=><option key={className} value={className}>{className}</option>)}</select></label><label><span>تاريخ التحضير</span><input type="date" min={ATTENDANCE_START_DATE} max={attendanceToday()} value={selectedDate} onChange={event=>setSelectedDate(clampAttendanceDate(event.target.value))}/></label></div><div className="attendance-main-actions"><button className="attendance-save" onClick={()=>void saveAttendance()} disabled={!selectedClass||saving||deleting}>{saving?"جارٍ الحفظ...":"حفظ التحضير"}</button><button type="button" className="attendance-delete" onClick={()=>void deleteAttendance()} disabled={!selectedClass||!hasSavedRecord||deleting||saving}>{deleting?"جارٍ الحذف...":"حذف التحضير"}</button><button type="button" className="attendance-pdf" onClick={()=>void downloadAttendancePdf()} disabled={!selectedClass||!classStudents.length}>PDF الفصل</button><button type="button" className="attendance-pdf attendance-all-pdf" onClick={()=>void downloadAllAttendancePdf()} disabled={!classes.length||allPdfBusy}>{allPdfBusy?"جارٍ التجهيز...":"PDF جميع الفصول"}</button><button type="button" className="attendance-excel" onClick={exportExcel} disabled={!selectedClass||!classStudents.length}>Excel</button></div></section><section className="attendance-overview"><article className="total"><span>طلاب الفصل</span><strong>{totalStudents}</strong></article><article className="present"><span>الحضور</span><strong>{counts.present}</strong></article><article className="absent"><span>الغياب</span><strong>{counts.absent}</strong></article><article className="rate"><span>نسبة الالتزام</span><strong>{dailyRate}%</strong></article></section><section className="attendance-workspace"><header className="attendance-list-head"><div><span>قائمة الطلاب</span><h2>{selectedClass?`تحضير ${selectedClass}`:"اختر الفصل لبدء التحضير"}</h2></div><div className="attendance-date-chip"><small>التاريخ</small><strong>{selectedDate}</strong></div></header><div className="attendance-stats"><span className="present">حاضر: {counts.present}</span><span className="absent">غائب: {counts.absent}</span><span className="late">متأخر: {counts.late}</span><span className="excused">مستأذن: {counts.excused}</span><span className="escaped">هروب: {counts.escaped}</span></div><div className="attendance-list">{classStudents.map((student,index)=>{const currentStatus=records[studentCode(student)]||"present"; return <article className={`attendance-student-card status-${currentStatus}`} key={studentCode(student)}><div className="student-info"><b>{index+1}</b><div><strong>{student.name||"طالب بدون اسم"}</strong><small>{selectedClass} • {studentCode(student)}</small></div><em>{STATUS_LABELS[currentStatus]}</em></div><div className="status-buttons">{statuses.map(([status,label])=><button type="button" key={status} className={currentStatus===status?`active ${status}`:status} onClick={()=>setStudentStatus(student,status)}>{label}</button>)}</div></article>;})}</div></section><details className="attendance-range-report"><summary><div><span>التقارير</span><strong>فترة محددة</strong></div></summary><div className="attendance-range-content"><div className="attendance-range-controls"><label><span>من</span><input type="date" min={ATTENDANCE_START_DATE} value={reportFrom} onChange={event=>setReportFrom(clampAttendanceDate(event.target.value))}/></label><label><span>إلى</span><input type="date" min={ATTENDANCE_START_DATE} value={reportTo} onChange={event=>setReportTo(clampAttendanceDate(event.target.value))}/></label><button type="button" onClick={()=>void exportRangeExcel()} disabled={!selectedClass||reporting}>تقرير Excel</button><button type="button" onClick={()=>void printRangePdf()}>PDF الفترة</button><button type="button" onClick={()=>void printWeeklyAllClassesPdf()}>PDF أسبوعي</button></div></div></details>{message?<p className="attendance-message" role="status">{message}</p>:null}</section></main>;
}
