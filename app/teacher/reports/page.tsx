"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { tenantCollection } from "../../../lib/teacher-tenant";
import { useTeacherClient } from "../../../lib/teacher-client";
import {
  calculateGradePlanResult,
  readGradeEntry,
  GRADE_PLAN_MODE_LABELS,
  type GradeStudentLike,
  type GradeValueMap,
} from "../../../lib/grade-plan";
import { useGradePlan } from "../../../lib/use-grade-plan";
import { downloadAttendancePdfDocument, type AttendancePdfClass } from "../../../lib/attendance-pdf";
import { downloadAttendanceRangePdfDocument, type AttendanceRangePdfClass } from "../../../lib/attendance-range-pdf";
import { downloadGradebookPdfDocument, type GradebookPdfClass } from "../../../lib/grades-pdf";
import "./reports-v11.css";

type AttendanceStatus = "present" | "absent" | "late" | "excused" | "escaped";
type Student = GradeStudentLike & {
  id: string; code?: string; name?: string; class?: string; className?: string;
  gradeValues?: GradeValueMap; gradePlanValues?: Record<string, GradeValueMap>;
};
type AttendanceDoc = { class?: string; date?: string; records?: Record<string, AttendanceStatus> };
type ReportType = "grades" | "attendance" | "summary";
type AttendanceMode = "daily" | "range";
type RangeRow = {
  number: number; name: string; present: number; absentDates: string[]; lateDates: string[];
  excusedDates: string[]; escapedDates: string[]; attendanceRate: number;
};

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "حاضر", absent: "غائب", late: "متأخر", excused: "مستأذن", escaped: "هروب",
};
const REPORT_ACCENTS = ["#0c756f", "#315f9d", "#74519b", "#a2643e", "#3f7b60", "#946f25", "#8c4b62", "#4b698b"];
const DAY_MS = 86_400_000;

function riyadhDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function hijri(value: string) {
  try { return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${value}T12:00:00+03:00`)); }
  catch { return value; }
}
function safe(value: string) { return value.replace(/[\\/:*?"<>|]/g, "-"); }
function escapeHtml(value: string) { return value.replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[ch] || ch)); }
function shortDate(value: string) { const parts = value.split("-"); return parts.length === 3 ? `${parts[2]}/${parts[1]}` : value; }
function datesText(values: string[]) { return values.length ? values.map(shortDate).join("، ") : "—"; }
function utcDay(value: string) { const [y, m, d] = value.split("-").map(Number); return Date.UTC(y, (m || 1) - 1, d || 1); }
function inclusiveDays(from: string, to: string) { return from && to ? Math.floor((utcDay(to) - utcDay(from)) / DAY_MS) + 1 : 0; }
function addDays(value: string, days: number) {
  const date = new Date(utcDay(value) + days * DAY_MS);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}
function sheetName(value: string, index: number) { return `${index + 1}-${value}`.replace(/[\\/*?:\[\]]/g, "-").slice(0, 31); }

export default function ReportsPage() {
  const session = useTeacherClient();
  const { activePlan, loading: planLoading } = useGradePlan(true);
  const teacherId = session.teacherId || "";
  const subjectKey = session.subjectKey || "history";
  const today = riyadhDate();

  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceDocs, setAttendanceDocs] = useState<AttendanceDoc[]>([]);
  const [reportType, setReportType] = useState<ReportType>("attendance");
  const [attendanceMode, setAttendanceMode] = useState<AttendanceMode>("range");
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedSection, setSelectedSection] = useState("all");
  const [selectedDate, setSelectedDate] = useState(today);
  const [reportFrom, setReportFrom] = useState(addDays(today, -6));
  const [reportTo, setReportTo] = useState(today);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!teacherId || !subjectKey) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ subjectId: subjectKey });
    if (session.activeGrade) params.set("grade", String(session.activeGrade));
    fetch(`/api/teacher/students?${params.toString()}`, { cache: "no-store", signal: controller.signal })
      .then(async response => { const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message || "تعذر تحميل الطلاب"); return data; })
      .then(data => {
        const list: Student[] = (Array.isArray(data.students) ? data.students : []).map((raw: Record<string, unknown>) => {
          const code = String(raw.code || raw.id || "").trim().toUpperCase();
          const className = String(raw.className || raw.class || "").trim();
          return { ...(raw as unknown as Student), id: code, code, name: String(raw.name || "").trim(), class: className, className };
        }).filter((student: Student) => student.id && student.name && student.className);
        list.sort((a, b) => String(a.className).localeCompare(String(b.className), "ar", { numeric: true }) || String(a.name).localeCompare(String(b.name), "ar"));
        setStudents(list); setMessage("");
      })
      .catch(error => { if ((error as Error)?.name !== "AbortError") setMessage(error instanceof Error ? error.message : "تعذر تحميل الطلاب"); });
    return () => controller.abort();
  }, [teacherId, subjectKey, session.activeGrade]);

  useEffect(() => {
    if (!teacherId || !subjectKey) return;
    return onSnapshot(
      collection(db, tenantCollection(teacherId, subjectKey as never, "attendance")),
      snapshot => setAttendanceDocs(snapshot.docs.map(item => item.data() as AttendanceDoc)),
      () => setAttendanceDocs([]),
    );
  }, [teacherId, subjectKey]);

  const classes = useMemo(() => [...new Set(students.map(student => String(student.className || student.class || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ar", { numeric: true })), [students]);
  useEffect(() => {
    if (!classes.length) { setSelectedClasses([]); return; }
    setSelectedClasses(current => {
      const valid = current.filter(name => classes.includes(name));
      return valid.length ? valid : [classes[0]];
    });
  }, [classes]);
  useEffect(() => {
    if (reportType !== "grades") return;
    if (selectedSection !== "all" && !activePlan?.sections.some(section => section.id === selectedSection)) setSelectedSection("all");
  }, [activePlan, reportType, selectedSection]);

  const selectedStudents = useMemo(() => students.filter(student => selectedClasses.includes(String(student.className || student.class || ""))), [students, selectedClasses]);
  const rangeLength = inclusiveDays(reportFrom, reportTo);
  const rangeValid = rangeLength > 0 && rangeLength <= 31 && reportFrom <= reportTo && reportTo <= today;
  const attendanceReadyClasses = useMemo(() => new Set(selectedClasses.filter(className => attendanceDocs.some(item => item.class === className && item.date && (attendanceMode === "daily" ? item.date === selectedDate : item.date >= reportFrom && item.date <= reportTo)))), [attendanceDocs, attendanceMode, reportFrom, reportTo, selectedDate, selectedClasses]);
  const unsavedClasses = selectedClasses.filter(name => !attendanceReadyClasses.has(name));
  const selectedSectionLabel = selectedSection === "all" ? "جميع الوحدات / الفترات" : activePlan?.sections.find(item => item.id === selectedSection)?.label || "—";

  function toggleClass(name: string) { setSelectedClasses(current => current.includes(name) ? current.filter(item => item !== name) : [...current, name]); }
  function chooseAll() { setSelectedClasses(classes); }
  function clearAll() { setSelectedClasses([]); }
  function setFrom(value: string) {
    setReportFrom(value);
    if (!value) return;
    const maxTo = addDays(value, 30) < today ? addDays(value, 30) : today;
    if (!reportTo || reportTo < value || reportTo > maxTo) setReportTo(maxTo);
  }
  function setTo(value: string) { setReportTo(value); }

  function studentForPlan(student: Student) {
    if (!activePlan) return student;
    const planValues = student.gradePlanValues?.[activePlan.id];
    return planValues ? { ...student, gradeValues: planValues } : student;
  }

  function gradeClass(className: string): GradebookPdfClass | null {
    if (!activePlan) return null;
    const roster = students.filter(student => String(student.className || student.class || "") === className);
    if (!roster.length) return null;
    const planSections = activePlan.sections.filter(section => selectedSection === "all" || section.id === selectedSection);
    return {
      className,
      sections: planSections.map(section => ({
        id: section.id, label: section.label, max: section.max,
        columns: section.items.map(item => ({ id: item.id, label: item.label, max: item.max })),
        rows: roster.map((student, index) => {
          const source = studentForPlan(student);
          const result = calculateGradePlanResult(activePlan, source);
          const sectionResult = result.sections.find(item => item.id === section.id);
          return { number: index + 1, name: String(student.name || ""), values: section.items.map(item => readGradeEntry(source, section, item).value), sectionTotal: sectionResult?.earned || 0, overallTotal: result.earned, percentage: result.percentage };
        }),
      })),
    };
  }

  function attendanceClass(className: string): AttendancePdfClass | null {
    const roster = students.filter(student => String(student.className || student.class || "") === className);
    const record = attendanceDocs.find(item => item.class === className && item.date === selectedDate);
    if (!roster.length || !record) return null;
    const statuses = roster.map(student => (record.records?.[student.id] || record.records?.[String(student.code || "")] || "present") as AttendanceStatus);
    return {
      className,
      counts: {
        present: statuses.filter(item => item === "present").length,
        absent: statuses.filter(item => item === "absent").length,
        late: statuses.filter(item => item === "late").length,
        excused: statuses.filter(item => item === "excused").length,
        escaped: statuses.filter(item => item === "escaped").length,
      },
      rows: roster.map((student, index) => ({ number: index + 1, name: String(student.name || ""), status: STATUS_LABELS[statuses[index]] })),
    };
  }

  function rangeClass(className: string) {
    const roster = students.filter(student => String(student.className || student.class || "") === className);
    const documents = attendanceDocs.filter(item => item.class === className && item.date && item.date >= reportFrom && item.date <= reportTo).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const days = [...new Set(documents.map(item => String(item.date || "")).filter(Boolean))];
    const rows: RangeRow[] = roster.map((student, index) => {
      const absentDates: string[] = [], lateDates: string[] = [], excusedDates: string[] = [], escapedDates: string[] = [];
      let present = 0;
      documents.forEach(item => {
        const status = (item.records?.[student.id] || item.records?.[String(student.code || "")] || "present") as AttendanceStatus;
        const date = String(item.date || "");
        if (status === "present") present += 1;
        else if (status === "absent") absentDates.push(date);
        else if (status === "late") lateDates.push(date);
        else if (status === "excused") excusedDates.push(date);
        else if (status === "escaped") escapedDates.push(date);
      });
      const counted = documents.length;
      const attendanceRate = counted ? Math.round(((present + lateDates.length + excusedDates.length) / counted) * 100) : 0;
      return { number: index + 1, name: String(student.name || ""), present, absentDates, lateDates, excusedDates, escapedDates, attendanceRate };
    });
    return { className, rows, days };
  }

  function validateSelection() {
    if (!selectedClasses.length) throw new Error("اختر فصلًا واحدًا على الأقل أو اختر جميع الفصول.");
    if (reportType === "attendance" && attendanceMode === "range" && !rangeValid) throw new Error("فترة تقرير الحضور يجب ألا تتجاوز 31 يومًا، وتاريخ النهاية لا يتجاوز اليوم.");
  }

  function printRangePdf() {
    validateSelection();
    const reports = selectedClasses.map(rangeClass).filter(item => item.rows.length && item.days.length);
    if (!reports.length) throw new Error("لا توجد سجلات حضور محفوظة للفصول المختارة في هذه الفترة.");
    const popup = window.open("", "_blank", "width=1440,height=940");
    if (!popup) throw new Error("اسمح بالنوافذ المنبثقة لفتح معاينة التقرير.");
    const logo = `${window.location.origin}/icons/lahooni-identity-320.jpg`;
    const pages = reports.map((report, index) => {
      const accent = REPORT_ACCENTS[index % REPORT_ACCENTS.length];
      const totalAbsences = report.rows.reduce((sum, row) => sum + row.absentDates.length, 0);
      const totalLate = report.rows.reduce((sum, row) => sum + row.lateDates.length, 0);
      const totalExcused = report.rows.reduce((sum, row) => sum + row.excusedDates.length, 0);
      const average = report.rows.length ? Math.round(report.rows.reduce((sum, row) => sum + row.attendanceRate, 0) / report.rows.length) : 0;
      const body = report.rows.map(row => `<tr><td>${row.number}</td><td class="name">${escapeHtml(row.name)}</td><td>${row.present}</td><td>${escapeHtml(datesText(row.absentDates))}</td><td>${escapeHtml(datesText(row.lateDates))}</td><td>${escapeHtml(datesText(row.excusedDates))}</td><td>${escapeHtml(datesText(row.escapedDates))}</td><td><b>${row.attendanceRate}%</b></td></tr>`).join("");
      return `<section class="page" style="--accent:${accent}"><header class="top"><div class="brand"><img src="${logo}"/><div><small>بوابة أستاذ لحوني التعليمية</small><strong>سجل المتابعة الأكاديمي</strong></div></div><div class="title"><span>تقرير فترة</span><h1>${escapeHtml(report.className)}</h1></div></header><section class="meta"><div><small>المعلم</small><b>${escapeHtml(session.teacherName || "المعلم")}</b></div><div><small>المادة</small><b>${escapeHtml(session.subject || "المادة")}</b></div><div><small>الفترة</small><b>${reportFrom} — ${reportTo}</b></div><div><small>أيام التحضير</small><b>${report.days.length}</b></div></section><section class="kpis"><article><small>الطلاب</small><b>${report.rows.length}</b></article><article class="good"><small>متوسط الحضور</small><b>${average}%</b></article><article class="bad"><small>الغياب</small><b>${totalAbsences}</b></article><article class="warn"><small>التأخير</small><b>${totalLate}</b></article><article><small>الاستئذان</small><b>${totalExcused}</b></article></section><table><thead><tr><th>م</th><th class="student">اسم الطالب</th><th>حضور</th><th>تواريخ الغياب</th><th>تواريخ التأخير</th><th>تواريخ الاستئذان</th><th>تواريخ الهروب</th><th>النسبة</th></tr></thead><tbody>${body}</tbody></table><footer><span>اعتماد المعلم: ____________________</span><b>${escapeHtml(report.className)}</b><span>اعتماد الإدارة: ____________________</span></footer></section>`;
    }).join("");
    popup.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>تقرير الحضور ${reportFrom} إلى ${reportTo}</title><style>
@page{size:A4 landscape;margin:0}*{box-sizing:border-box}html,body{margin:0;background:#eef3f3;color:#17343b;font-family:${getComputedStyle(document.body).fontFamily},Tahoma,Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}.toolbar{position:sticky;top:0;z-index:20;display:flex;align-items:center;justify-content:center;gap:10px;padding:11px;background:#102f39}.toolbar button{border:0;border-radius:12px;padding:11px 20px;font:900 14px inherit;cursor:pointer}.toolbar .print{background:#d6b15e;color:#17343b}.toolbar .close{background:#fff;color:#17343b}.page{width:297mm;height:210mm;margin:7mm auto;padding:8mm;background:#fff;page-break-after:always;break-after:page;overflow:hidden;box-shadow:0 18px 50px #102f3922;border-top:4mm solid var(--accent)}.page:last-child{page-break-after:auto}.top{height:27mm;display:flex;align-items:center;justify-content:space-between;padding:4mm 5mm;border-radius:4mm;background:linear-gradient(120deg,#fff 0 62%,var(--accent) 62%);border:1px solid #dce7e5}.brand{display:flex;align-items:center;gap:4mm}.brand img{width:19mm;height:19mm;object-fit:cover;border-radius:4mm;border:1px solid #d7e3e0}.brand small,.brand strong{display:block}.brand small{font-size:8pt;color:#6d8286;font-weight:800}.brand strong{margin-top:1mm;font-size:16pt;color:#173b43}.title{text-align:left;color:#fff}.title span{font-size:7.5pt;font-weight:900;opacity:.84}.title h1{margin:1mm 0 0;font-size:18pt}.meta{display:grid;grid-template-columns:1.1fr 1fr 1.3fr .7fr;gap:2mm;margin:3mm 0}.meta div,.kpis article{border:1px solid #dce7e5;border-radius:2.5mm;background:#f8fbfa;padding:2mm 2.5mm}.meta small,.meta b{display:block}.meta small{font-size:7pt;color:#7c9094}.meta b{margin-top:.7mm;font-size:9pt}.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:2mm;margin-bottom:3mm}.kpis article{text-align:center}.kpis small,.kpis b{display:block}.kpis small{font-size:7pt;color:#70868a}.kpis b{margin-top:.5mm;font-size:13pt}.kpis .good{background:#e8f6ee;color:#236f4d}.kpis .bad{background:#fdebed;color:#9e3744}.kpis .warn{background:#fff4dc;color:#88601c}table{width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed;border:1px solid #cbdad7;border-radius:3mm;overflow:hidden}th{height:9mm;padding:1mm;background:var(--accent);color:#fff;font-size:7.3pt;border-left:1px solid #ffffff2c}th.student{width:46mm;text-align:right;padding-right:3mm}td{height:6.2mm;padding:.6mm 1mm;border-top:1px solid #e0e8e6;border-left:1px solid #e7eeec;text-align:center;font-size:7pt;line-height:1.15;overflow:hidden;text-overflow:ellipsis}td.name{text-align:right;font-weight:900;font-size:7.5pt}tbody tr:nth-child(even) td{background:#f9fbfa}footer{height:10mm;display:flex;align-items:end;justify-content:space-between;border-top:1px dashed #afbfbc;margin-top:3mm;padding-top:2mm;color:#657b80;font-size:7.3pt}footer b{color:var(--accent);font-size:9pt}@media print{html,body{background:#fff}.toolbar{display:none}.page{margin:0;box-shadow:none}}
</style></head><body><div class="toolbar"><button class="print" onclick="window.print()">طباعة / حفظ PDF</button><button class="close" onclick="window.close()">إغلاق المعاينة</button></div>${pages}</body></html>`);
    popup.document.close();
  }

  async function generatePdf() {
    if (reportType === "summary") { window.location.assign("/teacher/report"); return; }
    setBusy(true); setMessage("");
    try {
      validateSelection();
      if (reportType === "grades") {
        if (!activePlan) throw new Error("اعتمد الخطة الدراسية أولًا لإنشاء تقرير التحصيل.");
        const reports = selectedClasses.map(gradeClass).filter((item): item is GradebookPdfClass => !!item);
        const result = await downloadGradebookPdfDocument({ portalName: "بوابة أستاذ لحوني التعليمية", teacherName: session.teacherName || "المعلم", subject: session.subject || "المادة", gradeLabel: session.activeGradeLabel || "", planLabel: GRADE_PLAN_MODE_LABELS[activePlan.mode], planVersion: activePlan.version, classes: reports, fileName: `تقرير-التحصيل-${safe(session.subject || "المادة")}-${safe(selectedSectionLabel)}.pdf` });
        setMessage(`تم إنشاء تقرير ${selectedSectionLabel}: ${result.classCount} فصل و${result.studentCount} طالب.`);
      } else if (attendanceMode === "daily") {
        const reports = selectedClasses.map(attendanceClass).filter((item): item is AttendancePdfClass => !!item);
        if (!reports.length) throw new Error("لا يوجد سجل متابعة محفوظ للفصول المختارة في هذا التاريخ.");
        const result = await downloadAttendancePdfDocument({ portalName: "بوابة أستاذ لحوني التعليمية", teacherName: session.teacherName || "المعلم", subject: session.subject || "المادة", date: selectedDate, hijriDate: hijri(selectedDate), classes: reports, fileName: `سجل-المتابعة-${selectedDate}.pdf` });
        setMessage(`تم إنشاء سجل المتابعة: ${result.classCount} فصل و${result.studentCount} طالب.`);
      } else {
        const reports = selectedClasses.map(rangeClass).filter((item): item is AttendanceRangePdfClass => item.rows.length > 0 && item.days.length > 0);
        if (!reports.length) throw new Error("لا توجد سجلات حضور محفوظة للفصول المختارة في هذه الفترة.");
        const result = await downloadAttendanceRangePdfDocument({ portalName: "بوابة أستاذ لحوني التعليمية", teacherName: session.teacherName || "المعلم", subject: session.subject || "المادة", from: reportFrom, to: reportTo, classes: reports, fileName: `سجل-المتابعة-${reportFrom}-إلى-${reportTo}.pdf` });
        setMessage(`تم إنشاء تقرير الفترة كاملًا: ${result.classCount} فصل و${result.studentCount} طالب في ${result.pageCount} صفحة.`);
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "تعذر إنشاء التقرير الآن."); }
    finally { setBusy(false); }
  }

  function exportExcel() {
    if (reportType === "summary") { window.location.assign("/teacher/report"); return; }
    try {
      validateSelection();
      const workbook = XLSX.utils.book_new();
      if (reportType === "attendance") {
        selectedClasses.forEach((className, classIndex) => {
          const rows: Record<string, string | number>[] = [];
          if (attendanceMode === "daily") {
            const record = attendanceDocs.find(item => item.class === className && item.date === selectedDate);
            students.filter(student => String(student.className || student.class || "") === className).forEach((student, index) => {
              const status = (record?.records?.[student.id] || record?.records?.[String(student.code || "")] || "present") as AttendanceStatus;
              rows.push({ "م": index + 1, "اسم الطالب": String(student.name || ""), "الفصل": className, "التاريخ": selectedDate, "الحالة": record ? STATUS_LABELS[status] : "غير محفوظ" });
            });
          } else {
            const range = rangeClass(className);
            range.rows.forEach(row => rows.push({ "م": row.number, "اسم الطالب": row.name, "الفصل": className, "أيام التحضير": range.days.length, "الحضور": row.present, "تواريخ الغياب": datesText(row.absentDates), "تواريخ التأخير": datesText(row.lateDates), "تواريخ الاستئذان": datesText(row.excusedDates), "تواريخ الهروب": datesText(row.escapedDates), "نسبة الحضور": `${row.attendanceRate}%` }));
          }
          if (!rows.length) return;
          const sheet = XLSX.utils.json_to_sheet(rows);
          sheet["!cols"] = Object.keys(rows[0]).map((key, index) => ({ wch: index === 1 ? 32 : Math.max(12, Math.min(30, key.length + 6)) }));
          XLSX.utils.book_append_sheet(workbook, sheet, sheetName(className, classIndex));
        });
      } else if (activePlan) {
        const sections = activePlan.sections.filter(section => selectedSection === "all" || section.id === selectedSection);
        selectedClasses.forEach((className, classIndex) => {
          const rows: Record<string, string | number>[] = [];
          students.filter(student => String(student.className || student.class || "") === className).forEach((student, index) => {
            const source = studentForPlan(student); const result = calculateGradePlanResult(activePlan, source);
            const row: Record<string, string | number> = { "م": index + 1, "اسم الطالب": String(student.name || ""), "الفصل": className };
            sections.forEach(section => { section.items.forEach(item => { row[`${section.label} - ${item.label}`] = readGradeEntry(source, section, item).value; }); row[`مجموع ${section.label}`] = result.sections.find(item => item.id === section.id)?.earned || 0; });
            row["المجموع الحالي"] = result.earned; row["النسبة"] = result.percentage; rows.push(row);
          });
          if (!rows.length) return;
          const sheet = XLSX.utils.json_to_sheet(rows);
          sheet["!cols"] = Object.keys(rows[0]).map((key, index) => ({ wch: index === 1 ? 32 : Math.max(12, Math.min(24, key.length + 4)) }));
          XLSX.utils.book_append_sheet(workbook, sheet, sheetName(className, classIndex));
        });
      }
      if (!workbook.SheetNames.length) throw new Error("لا توجد بيانات جاهزة للتصدير.");
      const suffix = reportType === "attendance" ? (attendanceMode === "daily" ? selectedDate : `${reportFrom}-إلى-${reportTo}`) : safe(selectedSectionLabel);
      XLSX.writeFile(workbook, `${reportType === "attendance" ? "سجل-المتابعة" : "التحصيل"}-${safe(session.subject || "المادة")}-${suffix}.xlsx`);
      setMessage(`تم تجهيز Excel: ${workbook.SheetNames.length} ورقة، كل فصل في ورقة مستقلة.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "تعذر تصدير التقرير."); }
  }

  const previewTitle = reportType === "grades" ? "تقرير التحصيل العلمي" : reportType === "attendance" ? "سجل المتابعة الأكاديمي" : "ملخص عمل المعلم";
  const previewPeriod = reportType === "grades" ? selectedSectionLabel : attendanceMode === "daily" ? `${selectedDate} • ${hijri(selectedDate)}` : `${reportFrom} ← ${reportTo} • ${rangeLength || 0} يوم`;
  const readyCount = reportType === "attendance" ? attendanceReadyClasses.size : selectedClasses.length;

  return <main className="smart-reports-v12" dir="rtl">
    <section className="sr12-head">
      <div><small>مركز التقارير الذكي</small><h2>التقرير يبدأ من اختيارك، وليس من زر طباعة</h2><p>حدد نوع التقرير والفصول والفترة. المعاينة تبين لك ما سيدخل في الوثيقة قبل إنشائها، بدون أي تعديل على البيانات المحفوظة.</p></div>
      <div className="sr12-trust"><b>قراءة فقط</b><span>PDF + Excel</span><span>حتى 31 يوم للحضور</span></div>
    </section>

    {message ? <p className="sr12-message">{message}</p> : null}

    <section className="sr12-typebar">
      <button className={reportType === "attendance" ? "active" : ""} onClick={() => setReportType("attendance")}><b>سجل المتابعة</b><small>يومي أو فترة حتى شهر</small></button>
      <button className={reportType === "grades" ? "active" : ""} onClick={() => setReportType("grades")}><b>التحصيل العلمي</b><small>حسب الوحدة أو الفترة</small></button>
      <button className={reportType === "summary" ? "active" : ""} onClick={() => setReportType("summary")}><b>ملخص عمل المعلم</b><small>رسوم ومقارنات الأداء</small></button>
    </section>

    <section className="sr12-builder">
      <div className="sr12-panel sr12-classes">
        <header><div><small>1 • نطاق التقرير</small><h3>الفصول</h3></div><div><button type="button" onClick={chooseAll} className={selectedClasses.length === classes.length && classes.length ? "active" : ""}>جميع الفصول</button><button type="button" onClick={clearAll}>إلغاء</button></div></header>
        <div className="sr12-class-grid">{classes.map(name => {
          const count = students.filter(student => String(student.className || student.class || "") === name).length;
          const selected = selectedClasses.includes(name);
          const ready = attendanceReadyClasses.has(name);
          return <button type="button" key={name} className={selected ? "selected" : ""} onClick={() => toggleClass(name)}><span className="check">{selected ? "✓" : ""}</span><span><b>{name}</b><small>{count} طالب</small></span>{reportType === "attendance" ? <i className={ready ? "ready" : "missing"}>{ready ? "لديه سجل" : "لا يوجد سجل"}</i> : null}</button>;
        })}</div>
      </div>

      <div className="sr12-panel sr12-details">
        <header><div><small>2 • تفاصيل التقرير</small><h3>{reportType === "attendance" ? "الفترة" : reportType === "grades" ? "الوحدة / الفترة" : "التحليل"}</h3></div></header>
        {reportType === "attendance" ? <>
          <div className="sr12-mode"><button type="button" className={attendanceMode === "range" ? "active" : ""} onClick={() => setAttendanceMode("range")}><b>فترة زمنية</b><small>حتى 31 يومًا</small></button><button type="button" className={attendanceMode === "daily" ? "active" : ""} onClick={() => setAttendanceMode("daily")}><b>يوم واحد</b><small>سجل يومي</small></button></div>
          {attendanceMode === "range" ? <div className="sr12-range"><label><span>من تاريخ</span><input type="date" max={today} value={reportFrom} onChange={event => setFrom(event.target.value)} /></label><label><span>إلى تاريخ</span><input type="date" min={reportFrom} max={reportFrom ? (addDays(reportFrom, 30) < today ? addDays(reportFrom, 30) : today) : today} value={reportTo} onChange={event => setTo(event.target.value)} /></label><div className={rangeValid ? "range-status good" : "range-status bad"}><b>{rangeLength > 0 ? `${rangeLength} يوم` : "—"}</b><small>{rangeValid ? "الفترة صالحة للطباعة" : "الحد الأقصى 31 يومًا"}</small></div></div> : <label className="sr12-single-date"><span>تاريخ المتابعة</span><input type="date" max={today} value={selectedDate} onChange={event => setSelectedDate(event.target.value)} /><small>{hijri(selectedDate)}</small></label>}
          {unsavedClasses.length ? <p className="sr12-warning">{unsavedClasses.length} من الفصول المختارة لا تحتوي سجلات محفوظة في النطاق الحالي، ولن تدخل في PDF حتى يوجد لها سجل.</p> : <p className="sr12-ok">كل الفصول المختارة لديها بيانات في النطاق الحالي.</p>}
        </> : reportType === "grades" ? <>
          {planLoading ? <p>جارٍ تحميل الخطة…</p> : !activePlan ? <div className="sr12-warning-box"><b>لا توجد خطة درجات معتمدة</b><span>اعتمد الخطة أولًا ولن تتأثر أي درجات محفوظة.</span><Link href="/teacher/grade-plan">فتح الخطة الدراسية</Link></div> : <div className="sr12-section-grid"><button type="button" className={selectedSection === "all" ? "active" : ""} onClick={() => setSelectedSection("all")}><b>التقرير الكامل</b><small>جميع الوحدات / الفترات</small></button>{activePlan.sections.map(section => <button type="button" key={section.id} className={selectedSection === section.id ? "active" : ""} onClick={() => setSelectedSection(section.id)}><b>{section.label}</b><small>{section.max} درجة • {section.items.length} عناصر</small></button>)}</div>}
        </> : <div className="sr12-summary"><b>ملخص عمل المعلم له لوحة تحليل مستقلة</b><p>المقارنة بين الفصول والطلاب والتحصيل والحضور والإتقان والملاحظات تظهر هناك برسوم ومؤشرات.</p><Link href="/teacher/report">فتح ملخص العمل</Link></div>}
      </div>
    </section>

    <section className="sr12-preview">
      <div className="sr12-paper">
        <header><div><img src="/icons/lahooni-identity-320.jpg" alt="هوية البوابة"/><span><small>بوابة أستاذ لحوني التعليمية</small><h3>{previewTitle}</h3></span></div><b>معاينة</b></header>
        <div className="sr12-meta"><span><small>المعلم</small><b>{session.teacherName || "المعلم"}</b></span><span><small>المادة</small><b>{session.subject || "المادة"}</b></span><span><small>الفصول</small><b>{selectedClasses.length}</b></span><span><small>الطلاب</small><b>{selectedStudents.length}</b></span></div>
        <div className="sr12-preview-lines"><i/><i/><i/><i/></div>
        <footer><span>{previewPeriod}</span><b>{readyCount} فصل جاهز</b></footer>
      </div>
      <aside className="sr12-actions"><small>3 • إنشاء الوثيقة</small><h3>جاهز للطباعة؟</h3><p>{reportType === "attendance" && attendanceMode === "range" ? "كل فصل يخرج في صفحات مكتملة بدون فقد أي طالب، ولكل فصل لون تعريفي مختلف. Excel يضع كل فصل في ورقة مستقلة." : reportType === "grades" ? "الطباعة تلتزم بالوحدة أو الفترة التي اخترتها، ويمكن اختيار جميع الفصول دفعة واحدة." : "انتقل إلى لوحة التحليل لإنشاء ملخص العمل."}</p><div><button className="primary" type="button" onClick={() => void generatePdf()} disabled={busy || !selectedClasses.length || (reportType === "attendance" && attendanceMode === "range" && !rangeValid)}>{busy ? "جارٍ الإنشاء…" : reportType === "summary" ? "فتح لوحة التحليل" : "إنشاء PDF"}</button>{reportType !== "summary" ? <button type="button" onClick={exportExcel} disabled={busy || !selectedClasses.length || (reportType === "attendance" && attendanceMode === "range" && !rangeValid)}>تصدير Excel</button> : null}</div></aside>
    </section>
  </main>;
}