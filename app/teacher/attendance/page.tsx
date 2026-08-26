"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs, onSnapshot, setDoc } from "firebase/firestore";
import * as XLSX from "xlsx";
import { db } from "../../../lib/firebase";
import { tenantCollection } from "../../../lib/teacher-tenant";
import { useTeacherClient } from "../../../lib/teacher-client";
import "./attendance.css";

type AttendanceStatus = "present" | "absent" | "late" | "excused" | "escaped";
type Student = { id: string; name?: string; class?: string };
type AttendanceDocument = { class?: string; date?: string; records?: Record<string, AttendanceStatus> };
type RangeRow = { number: number; name: string; present: number; absentDates: string[]; lateDates: string[]; excusedDates: string[]; escapedDates: string[]; attendanceRate: number };

const PORTAL_NAME = "بوابة أستاذ لحوني التعليمية";
const STATUS_LABELS: Record<AttendanceStatus, string> = { present: "حاضر", absent: "غائب", late: "متأخر", excused: "مستأذن", escaped: "هروب" };

function toDateInput(date: Date) { const offset = date.getTimezoneOffset(); return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10); }
function formatHijri(value: string) { return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-arab", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${value}T12:00:00`)); }
function formatShortDate(value: string) { const [, month, day] = value.split("-"); return `${day}/${month}`; }
function safeId(value: string) { return encodeURIComponent(value).replace(/%/g, "_"); }
function safeFile(value: string) { return value.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "-"); }
function escapeHtml(value: string) { return value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c] || c)); }
function startOfCurrentWeek() { const d = new Date(); const day = d.getDay(); d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)); return toDateInput(d); }
function datesText(values: string[]) { return values.length ? values.map(formatShortDate).join("، ") : "—"; }

export default function AttendancePage() {
  const session = useTeacherClient();
  const teacherId = session?.teacherId || "";
  const subjectKey = session?.subjectKey || "history";
  const teacherName = session?.teacherName || "";
  const subject = session?.subject || "";
  const ready = !!session?.teacherId && !!session?.subjectKey;
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedDate, setSelectedDate] = useState(toDateInput(new Date()));
  const [reportFrom, setReportFrom] = useState(startOfCurrentWeek());
  const [reportTo, setReportTo] = useState(toDateInput(new Date()));
  const [records, setRecords] = useState<Record<string, AttendanceStatus>>({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [reporting, setReporting] = useState(false);
  const studentsPath = useMemo(() => teacherId ? tenantCollection(teacherId, subjectKey as any, "students") : "", [teacherId, subjectKey]);
  const attendancePath = useMemo(() => teacherId ? tenantCollection(teacherId, subjectKey as any, "attendance") : "", [teacherId, subjectKey]);

  useEffect(() => {
    if (!ready) { setMessage("انتهت الجلسة. سجّل الدخول من جديد."); return; }
    return onSnapshot(collection(db, studentsPath), snap => { const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Student[]; list.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar")); setStudents(list); }, () => setMessage("تعذر تحميل طلاب هذا الحساب"));
  }, [ready, studentsPath]);

  const classes = useMemo(() => Array.from(new Set(students.map(s => (s.class || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ar")), [students]);
  const classStudents = useMemo(() => students.filter(s => (s.class || "").trim() === selectedClass), [students, selectedClass]);

  useEffect(() => {
    async function load() { if (!selectedClass || !attendancePath) { setRecords({}); return; } const snap = await getDoc(doc(db, attendancePath, `${safeId(selectedClass)}_${selectedDate}`)); const saved = (snap.data()?.records || {}) as Record<string, AttendanceStatus>; setRecords(Object.fromEntries(classStudents.map(s => [s.id, saved[s.id] || "present"]))); }
    load().catch(() => setMessage("تعذر تحميل التحضير لهذا اليوم"));
  }, [selectedClass, selectedDate, classStudents, attendancePath]);

  const counts = useMemo(() => { const values = classStudents.map(s => records[s.id] || "present"); return { present: values.filter(x => x === "present").length, absent: values.filter(x => x === "absent").length, late: values.filter(x => x === "late").length, excused: values.filter(x => x === "excused").length, escaped: values.filter(x => x === "escaped").length }; }, [classStudents, records]);

  function moveDay(amount: number) { const d = new Date(`${selectedDate}T12:00:00`); d.setDate(d.getDate() + amount); setSelectedDate(toDateInput(d)); }
  async function saveAttendance() { if (!selectedClass || !attendancePath) return setMessage("اختر الفصل أولًا"); try { setSaving(true); await setDoc(doc(db, attendancePath, `${safeId(selectedClass)}_${selectedDate}`), { class: selectedClass, date: selectedDate, hijriDate: formatHijri(selectedDate), records, teacherId, teacherName, subjectKey, subject, updatedAt: new Date().toISOString() }, { merge: true }); setMessage("تم حفظ التحضير بنجاح"); } catch { setMessage("تعذر حفظ التحضير"); } finally { setSaving(false); } }
  function reportRows() { return classStudents.map((student, index) => ({ number: index + 1, name: student.name || "طالب بدون اسم", className: selectedClass, status: STATUS_LABELS[records[student.id] || "present"], notes: "" })); }

  function exportExcel() {
    const rows = reportRows(); if (!selectedClass || !rows.length) return setMessage("اختر فصلًا يحتوي على طلاب أولًا");
    const details = rows.map(row => ({ "م": row.number, "اسم الطالب": row.name, "الفصل": row.className, "حالة الطالب": row.status, "ملاحظات": row.notes }));
    const workbook = XLSX.utils.book_new(); const detailsSheet = XLSX.utils.json_to_sheet(details); detailsSheet["!cols"] = [{ wch: 6 }, { wch: 34 }, { wch: 18 }, { wch: 18 }, { wch: 28 }]; XLSX.utils.book_append_sheet(workbook, detailsSheet, "الحضور اليومي"); XLSX.writeFile(workbook, `تقرير-حضور-${safeFile(selectedClass)}-${selectedDate}.xlsx`);
  }

  function printAdminReport() {
    const rows = reportRows(); if (!selectedClass || !rows.length) return setMessage("اختر فصلًا يحتوي على طلاب أولًا");
    const popup = window.open("", "_blank", "width=1200,height=900"); if (!popup) return setMessage("اسمح بالنوافذ المنبثقة لفتح التقرير");
    const bodyRows = rows.map(row => `<tr><td>${row.number}</td><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.className)}</td><td>${escapeHtml(row.status)}</td><td></td></tr>`).join("");
    popup.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير حضور ${escapeHtml(selectedClass)}</title><style>@page{size:A4 landscape;margin:0}*{box-sizing:border-box}body{margin:0;background:#eef2f5;font-family:Arial,Tahoma,sans-serif}.toolbar{display:flex;justify-content:center;gap:10px;padding:10px;background:#173f61}.toolbar button{border:0;border-radius:8px;padding:10px 18px;font-weight:800}.page{position:relative;width:297mm;height:210mm;margin:8mm auto;background:#fff;padding:7mm 9mm 12mm;overflow:hidden}.portal{text-align:center;font-weight:900;color:#173f61;border-bottom:2px solid #173f61;padding-bottom:4px}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:4px 8px;border:1px solid #222;padding:5px;font-size:9px}h1{text-align:center;font-size:16px;margin:5px}.summary{display:flex;justify-content:space-around;border:1px solid #222;border-top:0;padding:4px;font-size:9px;font-weight:800}table{width:100%;border-collapse:collapse;margin-top:5px;table-layout:fixed}th,td{border:1px solid #222;padding:2.5px 4px;font-size:8.3px}th{background:#edf3f7}.signatures{display:flex;justify-content:space-between;margin-top:5px;font-size:9px;font-weight:700}footer{position:absolute;right:9mm;left:9mm;bottom:4mm;display:flex;justify-content:space-between;border-top:1px solid #666;padding-top:3px;font-size:8px}@media print{body{background:#fff}.toolbar{display:none}.page{margin:0;width:297mm;height:210mm}}</style></head><body><div class="toolbar"><button onclick="window.print()">طباعة أو حفظ PDF</button><button onclick="window.close()">إغلاق</button></div><section class="page"><div class="portal">${PORTAL_NAME}</div><h1>تقرير الحضور اليومي للإدارة</h1><div class="meta"><span><b>المعلم:</b> ${escapeHtml(teacherName)}</span><span><b>المادة:</b> ${escapeHtml(subject)}</span><span><b>الفصل:</b> ${escapeHtml(selectedClass)}</span><span><b>التاريخ:</b> ${selectedDate}</span></div><div class="summary"><span>الإجمالي: ${rows.length}</span><span>حاضر: ${counts.present}</span><span>غائب: ${counts.absent}</span><span>متأخر: ${counts.late}</span><span>مستأذن: ${counts.excused}</span><span>هروب: ${counts.escaped}</span></div><table><thead><tr><th>م</th><th>اسم الطالب</th><th>الفصل</th><th>الحالة</th><th>ملاحظات</th></tr></thead><tbody>${bodyRows}</tbody></table><div class="signatures"><span>توقيع المعلم: __________________</span><span>اعتماد الإدارة: __________________</span></div><footer><strong>${PORTAL_NAME}</strong><span>صفحة واحدة</span></footer></section></body></html>`); popup.document.close();
  }

  async function buildRangeRows(): Promise<{ rows: RangeRow[]; days: string[] }> {
    if (!selectedClass || !attendancePath || !reportFrom || !reportTo) throw new Error("اختر الفصل والفترة"); if (reportFrom > reportTo) throw new Error("تاريخ البداية يجب أن يكون قبل تاريخ النهاية");
    const snap = await getDocs(collection(db, attendancePath));
    const documents = snap.docs.map(d => d.data() as AttendanceDocument).filter(item => item.class === selectedClass && !!item.date && item.date! >= reportFrom && item.date! <= reportTo).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    const days = Array.from(new Set(documents.map(item => item.date || "").filter(Boolean)));
    const rows = classStudents.map((student, index) => {
      const dates = { absentDates: [] as string[], lateDates: [] as string[], excusedDates: [] as string[], escapedDates: [] as string[] }; let present = 0;
      documents.forEach(item => { const date = item.date || ""; const status = item.records?.[student.id] || "present"; if (status === "present") present += 1; if (status === "absent") dates.absentDates.push(date); if (status === "late") dates.lateDates.push(date); if (status === "excused") dates.excusedDates.push(date); if (status === "escaped") dates.escapedDates.push(date); });
      const counted = documents.length; const attendanceRate = counted ? Math.round(((present + dates.lateDates.length + dates.excusedDates.length) / counted) * 100) : 0;
      return { number: index + 1, name: student.name || "طالب بدون اسم", present, ...dates, attendanceRate };
    }); return { rows, days };
  }

  async function printRangeReport() {
    try { setReporting(true); const { rows, days } = await buildRangeRows(); if (!days.length) return setMessage("لا توجد سجلات حضور محفوظة في الفترة المحددة");
      const popup = window.open("", "_blank", "width=1300,height=900"); if (!popup) return setMessage("اسمح بالنوافذ المنبثقة لفتح التقرير");
      const average = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.attendanceRate, 0) / rows.length) : 0;
      const bodyRows = rows.map(row => `<tr><td>${row.number}</td><td class="name">${escapeHtml(row.name)}</td><td>${row.present}</td><td>${escapeHtml(datesText(row.absentDates))}</td><td>${escapeHtml(datesText(row.lateDates))}</td><td>${escapeHtml(datesText(row.excusedDates))}</td><td>${escapeHtml(datesText(row.escapedDates))}</td><td>${row.attendanceRate}%</td></tr>`).join("");
      popup.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير حضور ${escapeHtml(selectedClass)}</title><style>@page{size:A4 landscape;margin:0}*{box-sizing:border-box}body{margin:0;background:#eef2f5;font-family:Arial,Tahoma,sans-serif}.toolbar{display:flex;justify-content:center;gap:10px;padding:10px;background:#173f61}.toolbar button{border:0;border-radius:8px;padding:10px 18px;font-weight:800}.page{position:relative;width:297mm;min-height:210mm;margin:8mm auto;background:#fff;padding:7mm 8mm 12mm}.portal{text-align:center;font-size:13px;font-weight:900;color:#173f61;border-bottom:2px solid #173f61;padding-bottom:4px}h1{text-align:center;font-size:15px;margin:4px}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:4px 8px;border:1px solid #222;padding:5px;font-size:9px}.summary{display:flex;justify-content:space-around;border:1px solid #222;border-top:0;padding:4px;font-size:9px;font-weight:800}table{width:100%;border-collapse:collapse;margin-top:5px;table-layout:fixed}th,td{border:1px solid #222;padding:2.3px;font-size:7.5px;text-align:center;vertical-align:middle;word-break:break-word}th{background:#edf3f7}.name{text-align:right;width:20%}.datecol{width:15%}.signatures{display:flex;justify-content:space-between;margin-top:6px;font-size:9px;font-weight:700}footer{margin-top:6px;display:flex;justify-content:space-between;border-top:1px solid #666;padding-top:3px;font-size:8px}@media print{body{background:#fff}.toolbar{display:none}.page{margin:0;width:297mm;min-height:210mm}}</style></head><body><div class="toolbar"><button onclick="window.print()">طباعة أو حفظ PDF</button><button onclick="window.close()">إغلاق</button></div><section class="page"><div class="portal">${PORTAL_NAME}</div><h1>تقرير الحضور للفترة المحددة</h1><div class="meta"><span><b>المعلم:</b> ${escapeHtml(teacherName)}</span><span><b>المادة:</b> ${escapeHtml(subject)}</span><span><b>الفصل:</b> ${escapeHtml(selectedClass)}</span><span><b>الفترة:</b> ${reportFrom} إلى ${reportTo}</span></div><div class="summary"><span>أيام الرصد: ${days.length}</span><span>عدد الطلاب: ${rows.length}</span><span>متوسط الحضور: ${average}%</span></div><table><thead><tr><th>م</th><th class="name">اسم الطالب</th><th>حاضر</th><th class="datecol">الغياب (التواريخ)</th><th class="datecol">التأخير (التواريخ)</th><th class="datecol">الاستئذان (التواريخ)</th><th class="datecol">الهروب (التواريخ)</th><th>نسبة الحضور</th></tr></thead><tbody>${bodyRows}</tbody></table><div class="signatures"><span>توقيع المعلم: __________________</span><span>اعتماد الإدارة: __________________</span></div><footer><strong>${PORTAL_NAME}</strong><span>من ${reportFrom} إلى ${reportTo}</span></footer></section></body></html>`); popup.document.close(); setMessage(`تم تجهيز التقرير مع تواريخ الحالات من ${reportFrom} إلى ${reportTo}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "تعذر تجهيز التقرير"); } finally { setReporting(false); }
  }

  async function exportRangeExcel() {
    try { setReporting(true); const { rows, days } = await buildRangeRows(); if (!days.length) return setMessage("لا توجد سجلات حضور محفوظة في الفترة المحددة");
      const details = rows.map(row => ({ "م": row.number, "اسم الطالب": row.name, "الحضور": row.present, "تواريخ الغياب": datesText(row.absentDates), "تواريخ التأخير": datesText(row.lateDates), "تواريخ الاستئذان": datesText(row.excusedDates), "تواريخ الهروب": datesText(row.escapedDates), "نسبة الحضور": `${row.attendanceRate}%` }));
      const summary = [{ "البيان": "اسم البوابة", "القيمة": PORTAL_NAME }, { "البيان": "المعلم", "القيمة": teacherName }, { "البيان": "المادة", "القيمة": subject }, { "البيان": "الفصل", "القيمة": selectedClass }, { "البيان": "من تاريخ", "القيمة": reportFrom }, { "البيان": "إلى تاريخ", "القيمة": reportTo }, { "البيان": "عدد أيام الرصد", "القيمة": days.length }];
      const workbook = XLSX.utils.book_new(); const summarySheet = XLSX.utils.json_to_sheet(summary); const detailsSheet = XLSX.utils.json_to_sheet(details); summarySheet["!cols"] = [{ wch: 22 }, { wch: 38 }]; detailsSheet["!cols"] = [{ wch: 6 }, { wch: 30 }, { wch: 10 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 14 }]; XLSX.utils.book_append_sheet(workbook, summarySheet, "ملخص الفترة"); XLSX.utils.book_append_sheet(workbook, detailsSheet, "تواريخ حالات الطلاب"); XLSX.writeFile(workbook, `تقرير-حضور-${safeFile(selectedClass)}-${reportFrom}-إلى-${reportTo}.xlsx`); setMessage("تم تحميل تقرير الفترة مع تواريخ الحالات");
    } catch (error) { setMessage(error instanceof Error ? error.message : "تعذر تصدير التقرير"); } finally { setReporting(false); }
  }

  if (!ready) return <main className="attendance-page" dir="rtl"><section className="attendance-card"><p>{message || "جارٍ تجهيز بيانات الحساب..."}</p></section></main>;
  const statuses: [AttendanceStatus, string][] = Object.entries(STATUS_LABELS) as [AttendanceStatus, string][];
  return <main className="attendance-page" dir="rtl"><section className="attendance-card"><header className="attendance-head"><div><h1>التحضير اليومي — {subject}</h1><p>المعلم: {teacherName}. اختر الفصل ثم احفظ أو اسحب تقريرًا رسميًا للإدارة.</p></div><div className="hijri-card"><small>التاريخ الهجري</small><strong>{formatHijri(selectedDate)}</strong><div><button onClick={() => moveDay(-1)}>اليوم السابق</button><button onClick={() => setSelectedDate(toDateInput(new Date()))}>اليوم</button><button onClick={() => moveDay(1)}>اليوم التالي</button></div></div></header><div className="attendance-controls"><label>الفصل<select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}><option value="">اختر الفصل</option>{classes.map(n => <option key={n}>{n}</option>)}</select></label><label>التاريخ<input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} /></label><button onClick={saveAttendance} disabled={!selectedClass || saving}>{saving ? "جارٍ الحفظ..." : "حفظ التحضير"}</button><button type="button" onClick={printAdminReport} disabled={!selectedClass || !classStudents.length}>تقرير يومي PDF</button><button type="button" onClick={exportExcel} disabled={!selectedClass || !classStudents.length}>تقرير يومي Excel</button></div><section className="attendance-range-report"><h2>تقرير أسبوعي أو فترة محددة</h2><p>يظهر في التقرير تاريخ كل غياب أو تأخير أو استئذان أو هروب لكل طالب.</p><div className="attendance-controls"><label>من تاريخ<input type="date" value={reportFrom} onChange={e => setReportFrom(e.target.value)} /></label><label>إلى تاريخ<input type="date" value={reportTo} onChange={e => setReportTo(e.target.value)} /></label><button type="button" onClick={printRangeReport} disabled={!selectedClass || reporting}>{reporting ? "جارٍ التجهيز..." : "عرض وطباعة التقرير"}</button><button type="button" onClick={exportRangeExcel} disabled={!selectedClass || reporting}>تقرير الفترة Excel</button></div></section><div className="attendance-stats"><span className="present">حاضر: {counts.present}</span><span className="absent">غائب: {counts.absent}</span><span>متأخر: {counts.late}</span><span>مستأذن: {counts.excused}</span><span className="escaped">هروب: {counts.escaped}</span></div><div className="attendance-list">{classStudents.map((student, index) => <article key={student.id}><div className="student-info"><b>{index + 1}</b><div><strong>{student.name || "طالب بدون اسم"}</strong><small>{selectedClass}</small></div></div><div className="status-buttons">{statuses.map(([status, label]) => <button key={status} className={records[student.id] === status ? `active ${status}` : ""} onClick={() => setRecords(c => ({ ...c, [student.id]: status }))}>{label}</button>)}</div></article>)}{!selectedClass && <p className="attendance-empty">اختر الفصل لعرض الطلاب.</p>}</div>{message && <p className="attendance-message">{message}</p>}</section></main>;
}
