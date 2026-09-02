from pathlib import Path
import re

ATTENDANCE = Path('app/teacher/attendance/page.tsx')
GRADES = Path('app/teacher/grades/page.tsx')
FOLLOW = Path('app/teacher/follow-up/page.tsx')
FOLLOW_CSS = Path('app/teacher/follow-up/follow-up.css')
AI_ROUTE = Path('app/api/teacher/student-insight/route.ts')

attendance = ATTENDANCE.read_text(encoding='utf-8')
new_attendance_pdf = r'''  async function downloadAttendancePdf() {
    const rows = reportRows();
    if (!selectedClass || !rows.length) return setMessage("الفصل ظاهر في الجدول، لكن لا توجد له أسماء طلاب مسجلة بعد.");
    setMessage(`جارٍ تجهيز تحضير ${selectedClass} — ${rows.length} طالبًا...`);

    const columnCount = rows.length <= 24 ? 1 : rows.length <= 60 ? 2 : 3;
    const rowsPerColumn = Math.ceil(rows.length / columnCount);
    const rowHeight = Math.max(16, Math.min(28, Math.floor(590 / Math.max(rowsPerColumn, 1))));
    const rowFontSize = rowHeight <= 18 ? 7.1 : rowHeight <= 21 ? 8 : rowHeight <= 24 ? 8.9 : 9.7;
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
      <table class="attendance-mini-table">
        <colgroup><col style="width:9%"><col style="width:66%"><col style="width:25%"></colgroup>
        <thead><tr><th>م</th><th>اسم الطالب</th><th>الحالة</th></tr></thead>
        <tbody>${columnRows.map(row => `<tr data-student-row="true"><td class="number">${row.number}</td><td class="student-name">${escapeHtml(row.name)}</td><td><span class="status ${statusClass(row.status)}">${escapeHtml(row.status)}</span></td></tr>`).join("")}</tbody>
      </table>`).join("");

    const host = document.createElement("div");
    host.dir = "rtl";
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = "position:fixed;left:0;top:0;width:1123px;height:794px;z-index:-9999;pointer-events:none;background:#fff;";
    host.innerHTML = `
      <style>
        *{box-sizing:border-box}
        .attendance-pdf-page{width:1123px;height:794px;padding:12px 15px;background:#fff;color:#173b49;font-family:'Tajawal','Segoe UI',Tahoma,Arial,sans-serif;display:grid;grid-template-rows:50px 30px 25px minmax(0,1fr) 16px;gap:4px;overflow:hidden}
        .pdf-head{border-radius:10px;padding:7px 13px;display:flex;align-items:center;justify-content:space-between;background:#0d4655;color:#fff}.pdf-head small{display:block;font-size:8px;color:#cae5eb;font-weight:800}.pdf-head strong{display:block;margin-top:1px;font-size:16px}.pdf-head .class{text-align:left}.pdf-head .class strong{font-size:17px}.pdf-head .class span{font-size:7px;color:#ffe29a;font-weight:900}
        .pdf-meta{display:grid;grid-template-columns:1.25fr 1fr .8fr 1fr 1.25fr;gap:4px}.pdf-meta div{border:1px solid #d6e2e7;border-radius:6px;background:#f8fbfc;padding:3px 6px;overflow:hidden}.pdf-meta small{display:block;color:#6d828b;font-size:6px;font-weight:800}.pdf-meta strong{display:block;font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .pdf-summary{display:grid;grid-template-columns:repeat(6,1fr);gap:4px}.pdf-summary article{display:flex;align-items:center;justify-content:center;gap:3px;border:1px solid #dbe6ea;border-radius:6px;background:#f8fbfc;font-size:7px;font-weight:900}.pdf-summary strong{font-size:11px}.pdf-summary .present{background:#e7f7ed}.pdf-summary .absent{background:#fdebed}.pdf-summary .late{background:#fff4da}.pdf-summary .excused{background:#e9f1ff}.pdf-summary .escaped{background:#f2eaff}
        .pdf-tables{min-height:0;display:grid;grid-template-columns:repeat(${columnCount},minmax(0,1fr));gap:7px;align-items:start;overflow:hidden}
        .attendance-mini-table{width:100%;border-collapse:collapse;table-layout:fixed;border:1px solid #bfcfd5}.attendance-mini-table th{height:20px;background:#183f4c;color:#fff;border:1px solid #315966;font-size:7px;padding:2px}.attendance-mini-table td{height:${rowHeight}px;border:1px solid #dbe5e8;padding:1px 4px;text-align:center;font-size:${rowFontSize}px;line-height:1.05;overflow:hidden}.attendance-mini-table tbody tr:nth-child(even){background:#f7fafb}.student-name{text-align:right!important;font-weight:900;white-space:nowrap;letter-spacing:-.15px}.number{font-weight:900}.status{display:inline-block;min-width:42px;padding:2px 4px;border-radius:999px;font-size:${Math.max(6.1, rowFontSize - 1.2)}px;font-weight:900}.status.present{background:#dcf6e6;color:#12653b}.status.absent{background:#fde4e7;color:#a12230}.status.late{background:#ffefc4;color:#885802}.status.excused{background:#dfeaff;color:#1f52a0}.status.escaped{background:#ecdefe;color:#5b2e9e}
        .pdf-footer{display:flex;align-items:center;justify-content:space-between;border-top:1px dashed #b7c7cc;padding-top:2px;color:#607780;font-size:7px}.pdf-footer strong,.pdf-footer .verify{font-weight:900;color:#155247}
      </style>
      <section class="attendance-pdf-page">
        <header class="pdf-head"><div><small>بوابة أستاذ لحوني التعليمية</small><strong>سجل التحضير اليومي</strong></div><div class="class"><small>الفصل</small><strong>${escapeHtml(selectedClass)}</strong><span>صفحة واحدة — الفصل كامل</span></div></header>
        <section class="pdf-meta"><div><small>المعلم</small><strong>${escapeHtml(teacherName)}</strong></div><div><small>المادة</small><strong>${escapeHtml(subject)}</strong></div><div><small>الفصل</small><strong>${escapeHtml(selectedClass)}</strong></div><div><small>الميلادي</small><strong>${selectedDate}</strong></div><div><small>الهجري</small><strong>${escapeHtml(formatHijri(selectedDate))}</strong></div></section>
        <section class="pdf-summary"><article><strong>${rows.length}</strong><span>إجمالي</span></article><article class="present"><strong>${counts.present}</strong><span>حاضر</span></article><article class="absent"><strong>${counts.absent}</strong><span>غائب</span></article><article class="late"><strong>${counts.late}</strong><span>متأخر</span></article><article class="excused"><strong>${counts.excused}</strong><span>مستأذن</span></article><article class="escaped"><strong>${counts.escaped}</strong><span>هروب</span></article></section>
        <section class="pdf-tables">${tablesHtml}</section>
        <footer class="pdf-footer"><strong>بوابة أستاذ لحوني التعليمية</strong><span>${escapeHtml(selectedClass)} — ${selectedDate}</span><span class="verify">تم إدراج ${rows.length} من ${rows.length} طالبًا</span></footer>
      </section>`;

    document.body.appendChild(host);
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const captureTarget = host.querySelector(".attendance-pdf-page") as HTMLElement | null;
      const tablesTarget = host.querySelector(".pdf-tables") as HTMLElement | null;
      if (!captureTarget || !tablesTarget) throw new Error("pdf_target_missing");
      const renderedRows = [...host.querySelectorAll<HTMLElement>("[data-student-row='true']")];
      if (renderedRows.length !== rows.length) throw new Error("pdf_row_count_mismatch");
      const tablesRect = tablesTarget.getBoundingClientRect();
      if (renderedRows.some(node => node.getBoundingClientRect().bottom > tablesRect.bottom + 1)) throw new Error("pdf_rows_overflow");
      const canvas = await html2canvas(captureTarget, {
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
      setMessage(`تم تنزيل التحضير: ${rows.length} طالبًا في صفحة واحدة بدون تقسيم.`);
    } catch (error) {
      console.error("attendance-pdf", error);
      setMessage("تعذر ضبط جميع الأسماء داخل صفحة PDF. حدّث الصفحة وأعد المحاولة؛ لن يتم تنزيل ملف ناقص.");
    } finally {
      host.remove();
    }
  }'''
pattern = r'  async function downloadAttendancePdf\(\) \{.*?\n  \}\n\n  function printAdminReport\(\)'
attendance, count = re.subn(pattern, new_attendance_pdf + '\n\n  function printAdminReport()', attendance, count=1, flags=re.S)
if count != 1:
    raise SystemExit(f'attendance pdf replacement failed: {count}')
ATTENDANCE.write_text(attendance, encoding='utf-8')

grades = GRADES.read_text(encoding='utf-8')
new_grades_pdf = r'''  async function downloadGradesPdf() {
    if (!classStudents.length) return setMessage("اختر فصلًا يحتوي على طلاب أولًا");
    setMessage(`جارٍ تجهيز سجل ${selectedClass} كاملًا في صفحة واحدة...`);

    const escapePdfText = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[character] || character));
    const allRows = classStudents.map((student, index) => {
      const row = grades[student.id] || emptyGrade;
      return {
        number: index + 1,
        name: student.name,
        attendance: row.attendance,
        participation: row.participation,
        homework: row.homework,
        unitExam: row.unitExam,
        total: calculateUnitTotal(row),
        notes: row.notes || "",
      };
    });
    const columnCount = allRows.length <= 24 ? 1 : allRows.length <= 60 ? 2 : 3;
    const rowsPerColumn = Math.ceil(allRows.length / columnCount);
    const rowHeight = Math.max(15, Math.min(27, Math.floor(588 / Math.max(rowsPerColumn, 1))));
    const rowFontSize = rowHeight <= 17 ? 6.2 : rowHeight <= 20 ? 7 : rowHeight <= 23 ? 7.8 : 8.6;
    const columns = Array.from({ length: columnCount }, (_, columnIndex) =>
      allRows.slice(columnIndex * rowsPerColumn, (columnIndex + 1) * rowsPerColumn),
    );
    const tablesHtml = columns.map(columnRows => `
      <table class="grades-mini-table">
        <colgroup><col style="width:6%"><col style="width:31%"><col style="width:9%"><col style="width:9%"><col style="width:9%"><col style="width:10%"><col style="width:9%"><col style="width:17%"></colgroup>
        <thead><tr><th>م</th><th>اسم الطالب</th><th>حضور</th><th>مشاركة</th><th>واجب</th><th>اختبار</th><th>المجموع</th><th>ملاحظات</th></tr></thead>
        <tbody>${columnRows.map(row => `<tr data-grade-row="true"><td>${row.number}</td><td class="student-name">${escapePdfText(row.name)}</td><td>${row.attendance}</td><td>${row.participation}</td><td>${row.homework}</td><td>${row.unitExam}</td><td class="total">${row.total}</td><td class="notes">${escapePdfText(row.notes)}</td></tr>`).join("")}</tbody>
      </table>`).join("");

    const host = document.createElement("div");
    host.dir = "rtl";
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = "position:fixed;left:0;top:0;width:1123px;height:794px;z-index:-9999;pointer-events:none;background:#fff;";
    host.innerHTML = `
      <style>
        *{box-sizing:border-box}
        .grade-pdf-page{width:1123px;height:794px;padding:12px 15px;background:#fff;color:#173b49;font-family:'Tajawal','Segoe UI',Tahoma,Arial,sans-serif;display:grid;grid-template-rows:50px 30px minmax(0,1fr) 16px;gap:4px;overflow:hidden}
        .grade-pdf-head{border-radius:10px;padding:7px 13px;display:flex;align-items:center;justify-content:space-between;background:#0d4655;color:#fff}.grade-pdf-head small{display:block;font-size:8px;color:#cae5eb;font-weight:800}.grade-pdf-head h1{margin:1px 0 0;font-size:16px}.grade-pdf-head .unit{text-align:left}.grade-pdf-head .unit strong{display:block;font-size:15px}.grade-pdf-head .unit span{font-size:7px;color:#ffe29a;font-weight:900}
        .grade-pdf-meta{display:grid;grid-template-columns:1.3fr 1fr 1fr .8fr;gap:4px}.grade-pdf-meta div{border:1px solid #d6e2e7;border-radius:6px;background:#f8fbfc;padding:3px 6px;overflow:hidden}.grade-pdf-meta small{display:block;color:#6d828b;font-size:6px;font-weight:800}.grade-pdf-meta strong{display:block;font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .grade-pdf-tables{min-height:0;display:grid;grid-template-columns:repeat(${columnCount},minmax(0,1fr));gap:7px;align-items:start;overflow:hidden}
        .grades-mini-table{width:100%;border-collapse:collapse;table-layout:fixed;border:1px solid #bfcfd5}.grades-mini-table th{height:20px;background:#183f4c;color:#fff;border:1px solid #315966;font-size:${Math.max(5.5, rowFontSize - 1)}px;padding:2px 1px;white-space:nowrap}.grades-mini-table td{height:${rowHeight}px;border:1px solid #dbe5e8;padding:1px 2px;text-align:center;font-size:${rowFontSize}px;line-height:1.05;overflow:hidden}.grades-mini-table tbody tr:nth-child(even){background:#f7fafb}.student-name{text-align:right!important;font-weight:900;white-space:nowrap;letter-spacing:-.22px}.total{font-weight:900;background:#edf5f7}.notes{text-align:right!important;font-size:${Math.max(5.7, rowFontSize - .5)}px;white-space:nowrap;text-overflow:ellipsis}.grade-pdf-footer{display:flex;align-items:center;justify-content:space-between;border-top:1px dashed #b7c7cc;padding-top:2px;color:#607780;font-size:7px}.grade-pdf-footer strong,.grade-pdf-footer .verify{font-weight:900;color:#155247}
      </style>
      <section class="grade-pdf-page">
        <header class="grade-pdf-head"><div><small>بوابة أستاذ لحوني التعليمية</small><h1>سجل رصد الدرجات</h1></div><div class="unit"><small>الوحدة</small><strong>${escapePdfText(unitInfo.label)}</strong><span>صفحة واحدة — الفصل كامل</span></div></header>
        <section class="grade-pdf-meta"><div><small>المادة</small><strong>${escapePdfText(session.subject || "المادة")}</strong></div><div><small>المرحلة</small><strong>${escapePdfText(session.activeGradeLabel || "")}</strong></div><div><small>الفصل</small><strong>${escapePdfText(selectedClass)}</strong></div><div><small>عدد الطلاب</small><strong>${allRows.length}</strong></div></section>
        <section class="grade-pdf-tables">${tablesHtml}</section>
        <footer class="grade-pdf-footer"><strong>بوابة أستاذ لحوني التعليمية</strong><span>${escapePdfText(selectedClass)} — ${escapePdfText(unitInfo.label)}</span><span class="verify">تم إدراج ${allRows.length} من ${allRows.length} طالبًا</span></footer>
      </section>`;

    document.body.appendChild(host);
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const captureTarget = host.querySelector(".grade-pdf-page") as HTMLElement | null;
      const tablesTarget = host.querySelector(".grade-pdf-tables") as HTMLElement | null;
      if (!captureTarget || !tablesTarget) throw new Error("grade_pdf_target_missing");
      const renderedRows = [...host.querySelectorAll<HTMLElement>("[data-grade-row='true']")];
      if (renderedRows.length !== allRows.length) throw new Error("grade_pdf_row_count_mismatch");
      const tablesRect = tablesTarget.getBoundingClientRect();
      if (renderedRows.some(node => node.getBoundingClientRect().bottom > tablesRect.bottom + 1)) throw new Error("grade_pdf_rows_overflow");
      const canvas = await html2canvas(captureTarget, { scale: 2, backgroundColor: "#ffffff", logging: false, useCORS: true, width: 1123, height: 794, windowWidth: 1123, windowHeight: 794 });
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.96), "JPEG", 0, 0, 297, 210, undefined, "FAST");
      pdf.save(`درجات-${selectedClass}-${unitInfo.label}.pdf`);
      setMessage(`تم تنزيل سجل الدرجات: ${allRows.length} طالبًا في صفحة واحدة بدون تقسيم.`);
    } catch (error) {
      console.error("grades-pdf", error);
      setMessage("تعذر ضبط جميع الطلاب داخل صفحة PDF. لن يتم تنزيل ملف ناقص؛ حدّث الصفحة ثم أعد المحاولة.");
    } finally {
      host.remove();
    }
  }'''
pattern = r'  async function downloadGradesPdf\(\) \{.*?\n  \}\n\n  return <main'
grades, count = re.subn(pattern, new_grades_pdf + '\n\n  return <main', grades, count=1, flags=re.S)
if count != 1:
    raise SystemExit(f'grades pdf replacement failed: {count}')
GRADES.write_text(grades, encoding='utf-8')

follow = r'''"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, increment, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { tenantCollection } from "../../../lib/teacher-tenant";
import { useTeacherClient } from "../../../lib/teacher-client";
import "./follow-up.css";

type UnitRecord = { attendance?: number; participation?: number; homework?: number; unitExam?: number; total?: number };
type TeacherNoteEntry = { id: string; type: string; label: string; message?: string; createdAt: string; teacherName?: string; subject?: string };
type Student = { id: string; storageId?: string; name?: string; class?: string; className?: string; code?: string; accessCode?: string; studentCode?: string; researchScore?: number; teacherNote?: string; teacherNoteCount?: number; teacherNoteCounts?: Record<string, number>; teacherNotes?: TeacherNoteEntry[]; units?: Record<string, UnitRecord> };
type SchoolClass = { id: string; name: string; grade?: number; section?: string };
type AiInsight = { analysis: string; recommendedAction: string; suggestedNote: string };
type EvaluatedStudent = Student & { points: number; completion: number; performance: number; finalScore: number | null; missing: number };

const unitKeys = ["unit1", "unit2", "unit3", "unit4", "unit5"];
const counselorPhone = "966598353651";
const componentMax = { attendance: 3, participation: 4, homework: 2, unitExam: 10 } as const;
const researchMax = 5;
const noteOptions = [
  { type: "participation", group: "إيجابية", label: "الطالب شارك بفاعلية وتميز في الحصة.", description: "تعزيز واضح للمشاركة الإيجابية." },
  { type: "improved", group: "إيجابية", label: "الطالب أظهر تحسنًا ملحوظًا في مستواه.", description: "لتوثيق التحسن مقارنة بمستواه السابق." },
  { type: "needs_review", group: "تحصيل", label: "الطالب يحتاج إلى مراجعة المهارة أو المفهوم.", description: "عندما تشير الدرجات إلى حاجة لمراجعة محددة." },
  { type: "homework_missing", group: "تحصيل", label: "الطالب لم ينجز الواجب المطلوب.", description: "ملاحظة مباشرة خاصة بالواجب." },
  { type: "no_interaction", group: "تفاعل", label: "الطالب يحتاج إلى زيادة التفاعل والمشاركة أثناء الحصة.", description: "عند ضعف الاستجابة والمشاركة الصفية." },
  { type: "disruptive", group: "سلوك", label: "الطالب يكثر الحديث أثناء الحصة مما يؤثر في التركيز.", description: "تستخدم عند تكرر الحديث أو التشتيت داخل الحصة." },
  { type: "other", group: "مخصصة", label: "كتابة ملاحظة مخصصة للطالب.", description: "اكتب النص الذي تريد ظهوره للطالب وولي الأمر." },
];

function aliases(student: Student) {
  return [...new Set([student.id, student.code, student.accessCode, student.studentCode].map(value => String(value || "").trim()).filter(Boolean))];
}

function evaluateStudent(student: Student): EvaluatedStudent {
  let points = 0;
  let recordedMax = 0;
  let missing = 0;
  unitKeys.forEach(unitKey => {
    const unit = student.units?.[unitKey];
    (Object.keys(componentMax) as Array<keyof typeof componentMax>).forEach(key => {
      const raw = unit?.[key];
      const value = Number(raw);
      if (raw === undefined || raw === null || !Number.isFinite(value)) {
        missing += 1;
        return;
      }
      const maximum = componentMax[key];
      points += Math.max(0, Math.min(maximum, value));
      recordedMax += maximum;
    });
  });
  const research = Number(student.researchScore);
  if (student.researchScore === undefined || student.researchScore === null || !Number.isFinite(research)) {
    missing += 1;
  } else {
    points += Math.max(0, Math.min(researchMax, research));
    recordedMax += researchMax;
  }
  const completion = Math.round(recordedMax);
  const performance = recordedMax ? Math.round((points / recordedMax) * 100) : 0;
  return { ...student, points: Math.round(points * 10) / 10, completion, performance, finalScore: recordedMax === 100 ? Math.round(points) : null, missing };
}

function dimensionScore(student: Student, key: keyof typeof componentMax) {
  const values = unitKeys.flatMap(unitKey => {
    const raw = student.units?.[unitKey]?.[key];
    const value = Number(raw);
    return raw === undefined || raw === null || !Number.isFinite(value) ? [] : [Math.max(0, Math.min(componentMax[key], value))];
  });
  if (!values.length) return { value: 0, recorded: 0 };
  return { value: Math.round(values.reduce((sum, value) => sum + value, 0) / (values.length * componentMax[key]) * 100), recorded: values.length };
}

function insightProfile(student: Student) {
  const labels: Record<keyof typeof componentMax, string> = {
    attendance: "الحضور والانضباط",
    participation: "المشاركة الصفية",
    homework: "الواجبات",
    unitExam: "اختبارات الوحدات",
  };
  const dimensions = (Object.keys(componentMax) as Array<keyof typeof componentMax>)
    .map(key => ({ key, label: labels[key], ...dimensionScore(student, key) }))
    .filter(item => item.recorded > 0);
  const weakest = [...dimensions].sort((a, b) => a.value - b.value)[0] || { key: "unitExam" as const, label: "لا يوجد رصد كافٍ", value: 0, recorded: 0 };
  const strongest = [...dimensions].sort((a, b) => b.value - a.value)[0] || { key: "participation" as const, label: "لا يوجد رصد كافٍ", value: 0, recorded: 0 };
  return { weakest, strongest };
}

function statusFor(student: EvaluatedStudent, threshold: number) {
  if (student.completion < 100) return { label: "الرصد غير مكتمل", className: "incomplete" };
  if ((student.finalScore || 0) >= threshold) return { label: "متقن", className: "mastered" };
  return { label: "يحتاج دعمًا", className: "support" };
}

export default function FollowUpPage() {
  const session = useTeacherClient();
  const teacherId = session.teacherId || "";
  const teacherName = session.teacherName || "المعلم";
  const subjectKey = session.subjectKey || "history";
  const subject = session.subject || "المادة";
  const activeGrade = session.activeGrade || null;
  const [storedStudents, setStoredStudents] = useState<Student[]>([]);
  const [scopeStudents, setScopeStudents] = useState<Student[]>([]);
  const [scopeClasses, setScopeClasses] = useState<SchoolClass[]>([]);
  const [scopeLoading, setScopeLoading] = useState(false);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [threshold, setThreshold] = useState(80);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [referralOpen, setReferralOpen] = useState(false);
  const [notifyParents, setNotifyParents] = useState(false);
  const [reason, setReason] = useState("انخفاض مستوى التحصيل الدراسي");
  const [noteStudent, setNoteStudent] = useState<Student | null>(null);
  const [selectedNoteType, setSelectedNoteType] = useState("");
  const [note, setNote] = useState("");
  const [analysisStudent, setAnalysisStudent] = useState<Student | null>(null);
  const [aiInsight, setAiInsight] = useState<AiInsight | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [message, setMessage] = useState("");
  const studentsPath = useMemo(() => teacherId ? tenantCollection(teacherId, subjectKey as never, "students") : "", [teacherId, subjectKey]);
  const referralsPath = useMemo(() => teacherId ? tenantCollection(teacherId, subjectKey as never, "counselorReferrals") : "", [teacherId, subjectKey]);

  useEffect(() => {
    if (!studentsPath) return;
    return onSnapshot(collection(db, studentsPath), snapshot => {
      setStoredStudents(snapshot.docs.map(item => ({ id: item.id, ...item.data() })) as Student[]);
    }, () => setMessage("تعذر تحميل بيانات الطلاب."));
  }, [studentsPath]);

  useEffect(() => {
    if (!teacherId || !subjectKey || !activeGrade) { setScopeStudents([]); setScopeClasses([]); return; }
    const controller = new AbortController();
    const params = new URLSearchParams({ subjectId: subjectKey, grade: String(activeGrade) });
    setScopeLoading(true);
    fetch(`/api/teacher/students?${params.toString()}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "تعذر تحميل الفصول المحددة.");
        setScopeStudents(Array.isArray(data.students) ? data.students : []);
        setScopeClasses(Array.isArray(data.classes) ? data.classes : []);
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setMessage(error instanceof Error ? error.message : "تعذر تحميل الفصول المحددة.");
      })
      .finally(() => setScopeLoading(false));
    return () => controller.abort();
  }, [teacherId, subjectKey, activeGrade]);

  const students = useMemo(() => {
    const liveByAlias = new Map<string, Student>();
    storedStudents.forEach(student => aliases(student).forEach(alias => liveByAlias.set(alias, student)));
    return scopeStudents.map(rosterStudent => {
      const live = aliases(rosterStudent).map(alias => liveByAlias.get(alias)).find(Boolean);
      const officialClass = String(rosterStudent.className || rosterStudent.class || "").trim();
      return { ...rosterStudent, ...(live || {}), id: rosterStudent.id, storageId: live?.id || rosterStudent.id, code: rosterStudent.code || live?.code, class: officialClass, className: officialClass };
    }).sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"));
  }, [scopeStudents, storedStudents]);
  const classes = useMemo(() => scopeClasses.map(item => item.name), [scopeClasses]);
  useEffect(() => { if (selectedClass && !classes.includes(selectedClass)) { setSelectedClass(""); setSelectedStudent(""); } }, [classes, selectedClass]);
  const classStudents = useMemo(() => students.filter(student => !selectedClass || (student.class || "").trim() === selectedClass), [students, selectedClass]);
  const visible = useMemo(() => classStudents.filter(student => !selectedStudent || student.id === selectedStudent), [classStudents, selectedStudent]);
  const evaluated = useMemo(() => visible.map(evaluateStudent), [visible]);
  const completed = useMemo(() => evaluated.filter(student => student.completion === 100), [evaluated]);
  const mastered = useMemo(() => completed.filter(student => (student.finalScore || 0) >= threshold), [completed, threshold]);
  const support = useMemo(() => completed.filter(student => (student.finalScore || 0) < threshold), [completed, threshold]);
  const incomplete = useMemo(() => evaluated.filter(student => student.completion < 100), [evaluated]);
  const referralCandidates = support;
  const selectedStudents = referralCandidates.filter(student => selectedIds.includes(student.id));

  function openReferral() {
    if (!support.length) return setMessage("لا يوجد طلاب مكتملو الرصد تحت معيار الإتقان حاليًا.");
    setSelectedIds(support.map(student => student.id));
    setNotifyParents(false);
    setReferralOpen(true);
  }

  async function sendReferral() {
    if (!selectedStudents.length) return setMessage("حدد طالبًا واحدًا على الأقل للإحالة.");
    const now = new Date().toISOString();
    await Promise.all(selectedStudents.map(async student => {
      const percentage = student.finalScore || 0;
      await setDoc(doc(db, referralsPath, crypto.randomUUID()), { studentId: student.id, studentName: student.name || "", className: student.class || "", percentage, reason, status: "جديدة", teacherName, subject, createdAt: now });
      if (notifyParents) await setDoc(doc(db, studentsPath, student.storageId || student.id), { parentCounselorNoticeCount: increment(1), parentCounselorLastNotice: { title: `إحالة للمرشد من معلم ${subject}`, message: `تمت إحالة الطالب للمتابعة بسبب: ${reason}. مستوى الإتقان بعد اكتمال الرصد ${percentage}%.`, percentage, createdAt: now } }, { merge: true });
    }));
    const text = `السلام عليكم،\nإحالة طلاب للمرشد في مادة ${subject}\nالسبب: ${reason}\n\n${selectedStudents.map((student, index) => `${index + 1}. ${student.name || "—"} — ${student.class || "—"} — ${student.finalScore || 0}%`).join("\n")}\n\nالمعلم: ${teacherName}`;
    window.open(`https://wa.me/${counselorPhone}?text=${encodeURIComponent(text)}`, "_blank");
    setMessage(`تم تسجيل إحالة ${selectedStudents.length} طالب للمرشد.`);
    setReferralOpen(false);
  }

  async function requestAiInsight() {
    if (!analysisStudent || aiLoading) return;
    const evaluation = evaluateStudent(analysisStudent);
    const profile = insightProfile(analysisStudent);
    const repeatedNotes = Object.entries(analysisStudent.teacherNoteCounts || {}).filter(([, count]) => Number(count) > 0).map(([type, count]) => ({ label: noteOptions.find(option => option.type === type)?.label || type, count: Number(count) }));
    setAiLoading(true);
    setAiInsight(null);
    try {
      const response = await fetch("/api/teacher/student-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, performance: evaluation.performance, completion: evaluation.completion, missing: evaluation.missing, weakest: { label: profile.weakest.label, value: profile.weakest.value }, strongest: { label: profile.strongest.label, value: profile.strongest.value }, repeatedNotes }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.message || "تعذر تحليل البيانات بالذكاء الاصطناعي.");
      setAiInsight({ analysis: String(data.analysis || ""), recommendedAction: String(data.recommendedAction || ""), suggestedNote: String(data.suggestedNote || "") });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر الاتصال بالذكاء الاصطناعي الآن.");
    } finally {
      setAiLoading(false);
    }
  }

  async function saveNote() {
    if (!noteStudent) return;
    if (!selectedNoteType) return setMessage("اختر نوع الملاحظة أولًا.");
    if (selectedNoteType === "other" && !note.trim()) return setMessage("اكتب نص الملاحظة المخصصة أولًا.");
    const option = noteOptions.find(item => item.type === selectedNoteType);
    if (!option) return;
    const now = new Date().toISOString();
    const previous = Array.isArray(noteStudent.teacherNotes) ? noteStudent.teacherNotes : [];
    const counts = { ...(noteStudent.teacherNoteCounts || {}) };
    counts[selectedNoteType] = Number(counts[selectedNoteType] || 0) + 1;
    const entry: TeacherNoteEntry = { id: crypto.randomUUID(), type: selectedNoteType, label: option.label, message: selectedNoteType === "other" ? note.trim() : "", createdAt: now, teacherName, subject };
    const notes = [entry, ...previous].slice(0, 100);
    const latestText = selectedNoteType === "other" ? note.trim() : option.label;
    await setDoc(doc(db, studentsPath, noteStudent.storageId || noteStudent.id), { teacherNote: latestText, teacherNoteCount: Number(noteStudent.teacherNoteCount || previous.length || 0) + 1, teacherNoteCounts: counts, teacherNotes: notes, teacherLastNoteAt: now }, { merge: true });
    setMessage("تم حفظ الملاحظة وإضافتها إلى سجل الطالب.");
    setNoteStudent(null);
    setSelectedNoteType("");
    setNote("");
  }

  async function copySupportList() {
    if (!support.length) return setMessage("لا توجد قائمة دعم مكتملة الرصد لنسخها.");
    await navigator.clipboard.writeText(support.map((student, index) => `${index + 1}. ${student.name} — ${student.class} — ${student.finalScore}%`).join("\n"));
    setMessage("تم نسخ قائمة الطلاب الذين يحتاجون دعمًا.");
  }

  if (!teacherId) return <main className="follow-page" dir="rtl"><p>جارٍ تجهيز صفحة المتابعة…</p></main>;

  return <main className="follow-page" dir="rtl">
    <section className="follow-head">
      <div><span>متابعة التحصيل — {subject}</span><h1>متابعة الإتقان</h1><p>صفحة مختصرة: تفرّق بين الإتقان الحقيقي والرصد غير المكتمل، وتترك التحليل الذكي كإجراء اختياري لكل طالب.</p></div>
      <div className="follow-filters">
        <label>الفصل<select value={selectedClass} onChange={event => { setSelectedClass(event.target.value); setSelectedStudent(""); }}><option value="">جميع الفصول</option>{classes.map(name => <option key={name}>{name}</option>)}</select></label>
        <label>الطالب<select value={selectedStudent} onChange={event => setSelectedStudent(event.target.value)}><option value="">جميع الطلاب</option>{classStudents.map(student => <option key={student.id} value={student.id}>{student.name}</option>)}</select></label>
        <label>معيار الإتقان<select value={threshold} onChange={event => setThreshold(Number(event.target.value))}><option value={80}>٨٠٪</option><option value={75}>٧٥٪</option><option value={70}>٧٠٪</option></select></label>
      </div>
    </section>

    {scopeLoading ? <p className="follow-inline-message">جارٍ تحميل الفصول…</p> : !classes.length ? <p className="follow-inline-message">لا توجد فصول محددة لهذه المادة.</p> : null}

    <section className="follow-overview">
      <article><span>الطلاب</span><strong>{evaluated.length}</strong><small>في النطاق الحالي</small></article>
      <article><span>مكتملو الرصد</span><strong>{completed.length}</strong><small>يمكن الحكم على الإتقان</small></article>
      <article className="mastered"><span>متقنون</span><strong>{mastered.length}</strong><small>حسب معيار {threshold}٪</small></article>
      <article className="support"><span>يحتاجون دعمًا</span><strong>{support.length}</strong><small>بعد اكتمال الرصد</small></article>
      <article className="incomplete"><span>الرصد غير مكتمل</span><strong>{incomplete.length}</strong><small>لا يصدر عليهم حكم نهائي</small></article>
    </section>

    <section className="follow-card students-follow-card">
      <header><div><h2>الطلاب</h2><p>درجة نهائية فقط عند اكتمال الرصد ١٠٠٪. قبل ذلك يظهر الأداء الحالي بوصفه مبدئيًا.</p></div><div className="follow-actions"><button onClick={() => void copySupportList()}>نسخ قائمة الدعم</button><button className="counselor-button" onClick={openReferral}>إحالة للمرشد</button></div></header>
      <div className="follow-table-wrap"><table><thead><tr><th>تحديد</th><th>الطالب</th><th>الفصل</th><th>الأداء</th><th>اكتمال الرصد</th><th>الحالة</th><th>الإجراءات</th></tr></thead><tbody>
        {evaluated.map(student => { const status = statusFor(student, threshold); return <tr key={student.id}>
          <td><input type="checkbox" disabled={status.className !== "support"} checked={selectedIds.includes(student.id)} onChange={event => setSelectedIds(current => event.target.checked ? [...new Set([...current, student.id])] : current.filter(id => id !== student.id))} /></td>
          <td className="student-name-cell"><b>{student.name || "—"}</b></td><td>{student.class || "—"}</td>
          <td><strong>{student.finalScore !== null ? `${student.finalScore}%` : `${student.performance}% مبدئي`}</strong></td>
          <td><div className="completion"><span><i style={{ width: `${student.completion}%` }} /></span><b>{student.completion}%</b></div></td>
          <td><span className={`level ${status.className}`}>{status.label}</span></td>
          <td><div className="row-actions"><button type="button" className="analysis-btn" onClick={() => { setAnalysisStudent(student); setAiInsight(null); }}>تحليل الطالب</button><button type="button" className="note-btn" onClick={() => { setNoteStudent(student); setSelectedNoteType(""); setNote(""); }}>ملاحظة <small>{Number(student.teacherNoteCount || student.teacherNotes?.length || 0)}</small></button></div></td>
        </tr>; })}
      </tbody></table>{!evaluated.length && <p className="empty">لا توجد بيانات طلاب في النطاق المختار.</p>}</div>
    </section>

    {analysisStudent && (() => { const evaluation = evaluateStudent(analysisStudent); const profile = insightProfile(analysisStudent); return <div className="follow-modal" onClick={() => setAnalysisStudent(null)}><section className="analysis-modal" onClick={event => event.stopPropagation()}>
      <header><div><small>تحليل اختياري</small><h3>تحليل الطالب بالذكاء الاصطناعي</h3><p>{analysisStudent.name}</p></div><button className="close" onClick={() => setAnalysisStudent(null)}>×</button></header>
      <div className="analysis-facts"><article><span>الأداء الحالي</span><strong>{evaluation.performance}%</strong></article><article><span>اكتمال الرصد</span><strong>{evaluation.completion}%</strong></article><article><span>أضعف محور مرصود</span><strong>{profile.weakest.label} — {profile.weakest.value}%</strong></article></div>
      <p className="ai-note">الذكاء الاصطناعي يحلل المؤشرات المرصودة فقط، ولا يحفظ أو يرسل ملاحظة تلقائيًا. إذا كان الرصد ناقصًا فالتحليل مبدئي.</p>
      <button className="generate-ai" onClick={() => void requestAiInsight()} disabled={aiLoading}>{aiLoading ? "جارٍ التحليل..." : "تحليل البيانات الآن"}</button>
      {aiInsight && <div className="ai-result"><article><span>ملخص التحليل</span><p>{aiInsight.analysis}</p></article><article><span>الخطوة المقترحة للمعلم</span><p>{aiInsight.recommendedAction}</p></article><article><span>صياغة ملاحظة مقترحة</span><p>{aiInsight.suggestedNote}</p><button type="button" onClick={() => { setNoteStudent(analysisStudent); setSelectedNoteType("other"); setNote(aiInsight.suggestedNote); setAnalysisStudent(null); setAiInsight(null); }}>استخدامها كملاحظة مخصصة</button></article></div>}
    </section></div>; })()}

    {noteStudent && <div className="follow-modal" onClick={() => setNoteStudent(null)}><section className="note-modal-card" onClick={event => event.stopPropagation()}>
      <header><div><small>سجل الطالب</small><h3>إضافة ملاحظة</h3><p>{noteStudent.name}</p></div><button className="close" onClick={() => setNoteStudent(null)}>×</button></header>
      <p className="note-visibility">الملاحظة التي تحفظها هنا تظهر في بوابة الطالب وولي الأمر، لذلك كل خيار مكتوب بصياغته النهائية.</p>
      <div className="note-options">{noteOptions.map(option => <label key={option.type} className={selectedNoteType === option.type ? "selected" : ""}><input type="radio" name="student-note" checked={selectedNoteType === option.type} onChange={() => setSelectedNoteType(option.type)} /><div><small>{option.group}</small><b>{option.label}</b><span>{option.description}</span></div><em>{Number(noteStudent.teacherNoteCounts?.[option.type] || 0)} مرة</em></label>)}</div>
      {selectedNoteType === "other" && <label className="custom-note"><span>نص الملاحظة المخصصة</span><textarea value={note} onChange={event => setNote(event.target.value)} placeholder="اكتب الملاحظة كما تريد أن يقرأها الطالب وولي الأمر." /></label>}
      <details className="note-history"><summary>عرض سجل الملاحظات السابقة ({noteStudent.teacherNotes?.length || 0})</summary><div>{(noteStudent.teacherNotes || []).slice(0, 10).map(entry => <article key={entry.id}><b>{entry.type === "other" ? (entry.message || entry.label) : entry.label}</b><small>{new Date(entry.createdAt).toLocaleDateString("ar-SA-u-ca-gregory")} • {entry.subject || subject}</small></article>)}{!(noteStudent.teacherNotes || []).length && <p>لا توجد ملاحظات سابقة.</p>}</div></details>
      <div className="modal-actions"><button onClick={() => setNoteStudent(null)}>إلغاء</button><button className="primary" onClick={() => void saveNote()}>حفظ الملاحظة</button></div>
    </section></div>}

    {referralOpen && <div className="follow-modal" onClick={() => setReferralOpen(false)}><section className="referral-modal" onClick={event => event.stopPropagation()}><header><div><h3>إحالة للمرشد الطلابي</h3><p>تعرض هنا فقط الحالات مكتملة الرصد وتحت معيار الإتقان.</p></div><button className="close" onClick={() => setReferralOpen(false)}>×</button></header><div className="referral-students">{referralCandidates.map(student => <label key={student.id}><input type="checkbox" checked={selectedIds.includes(student.id)} onChange={event => setSelectedIds(current => event.target.checked ? [...new Set([...current, student.id])] : current.filter(id => id !== student.id))} /><span><b>{student.name}</b><small>{student.class} • {student.finalScore}%</small></span></label>)}</div><label className="reason-field">سبب الإحالة<textarea value={reason} onChange={event => setReason(event.target.value)} /></label><label className="parent-notify"><input type="checkbox" checked={notifyParents} onChange={event => setNotifyParents(event.target.checked)} /><span>إبلاغ ولي الأمر في البوابة</span></label><div className="modal-actions"><button onClick={() => setReferralOpen(false)}>إلغاء</button><button className="primary" onClick={() => void sendReferral()}>تسجيل الإحالة وإرسالها</button></div></section></div>}

    {message && <div className="follow-toast" role="status">{message}</div>}
  </main>;
}
'''
FOLLOW.write_text(follow, encoding='utf-8')

follow_css = r'''.follow-page{display:grid;gap:16px;color:#17384a}.follow-head,.follow-card{background:#fff;border:1px solid #d8e5ed;border-radius:18px;padding:20px;box-shadow:0 8px 24px #17384a0b}.follow-head{display:flex;align-items:end;justify-content:space-between;gap:18px}.follow-head>div:first-child{max-width:720px}.follow-head span{color:var(--teacher-accent,#1768c5);font-weight:900}.follow-head h1{margin:4px 0;font-size:30px}.follow-head p{margin:0;color:#62798a;line-height:1.7}.follow-filters{display:flex;flex-wrap:wrap;gap:8px}.follow-filters label{display:grid;gap:5px;min-width:145px;font-size:12px;font-weight:900}.follow-filters select{height:42px;border:1px solid #cbdbe6;border-radius:10px;background:#fff;padding:6px 10px;font:inherit}.follow-inline-message{margin:0;padding:11px 14px;border-radius:11px;background:#eef6fb;color:#315a73;font-weight:800}.follow-overview{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.follow-overview article{padding:14px;border:1px solid #dbe7ee;border-radius:14px;background:#fff}.follow-overview span{display:block;color:#657d8d;font-size:11px;font-weight:900}.follow-overview strong{display:block;margin-top:4px;font-size:25px}.follow-overview small{display:block;margin-top:2px;color:#8293a0;font-size:9px;font-weight:800}.follow-overview .mastered{background:#effaf6;border-color:#c8e8dc}.follow-overview .mastered strong{color:#08745a}.follow-overview .support{background:#fff4ed;border-color:#f0d3bf}.follow-overview .support strong{color:#a04d24}.follow-overview .incomplete{background:#f2f5f8;border-color:#d7e0e7}.students-follow-card>header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.students-follow-card h2{margin:0 0 4px}.students-follow-card header p{margin:0;color:#687f8f}.follow-actions,.row-actions{display:flex;gap:7px;flex-wrap:wrap}.follow-actions button,.row-actions button,.modal-actions button,.generate-ai,.ai-result button{border:1px solid #ccdae4;border-radius:9px;padding:8px 11px;background:#fff;color:#294b63;font:inherit;font-size:11px;font-weight:900;cursor:pointer}.follow-actions .counselor-button,.modal-actions .primary{background:var(--teacher-accent,#1768c5);border-color:transparent;color:#fff}.follow-table-wrap{overflow:auto;border:1px solid #dbe7ee;border-radius:13px}.follow-table-wrap table{width:100%;border-collapse:collapse;min-width:840px}.follow-table-wrap th,.follow-table-wrap td{padding:10px 8px;border-bottom:1px solid #e5edf2;text-align:center;white-space:nowrap}.follow-table-wrap th{background:#eef5f9;font-size:11px}.student-name-cell{text-align:right!important}.completion{display:flex;align-items:center;justify-content:center;gap:7px}.completion>span{width:68px;height:6px;border-radius:99px;background:#e2e9ed;overflow:hidden}.completion i{display:block;height:100%;background:#2c8d77}.completion b{font-size:10px}.level{display:inline-flex;padding:6px 9px;border-radius:999px;font-size:10px;font-weight:900}.level.mastered{background:#ddf5ec;color:#08745a}.level.support{background:#ffe8dc;color:#9b3e1d}.level.incomplete{background:#e9eef2;color:#536b7a}.row-actions{justify-content:center}.analysis-btn{background:#eef5ff!important;color:#285c9e!important}.note-btn small{display:inline-flex;min-width:18px;height:18px;align-items:center;justify-content:center;border-radius:99px;background:#edf2f5;margin-right:3px}.empty{padding:22px;text-align:center;color:#708493}.follow-modal{position:fixed;inset:0;z-index:600;background:#102a43b8;display:grid;place-items:center;padding:14px}.follow-modal>section{width:min(720px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:18px;padding:20px;box-shadow:0 22px 55px #071d2d44}.follow-modal header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}.follow-modal header small{color:var(--teacher-accent,#1768c5);font-weight:900}.follow-modal h3{margin:2px 0;font-size:22px}.follow-modal header p{margin:0;color:#637b8b;font-weight:800}.close{border:0;width:36px;height:36px;border-radius:9px;background:#eef3f6;font-size:21px;cursor:pointer}.analysis-facts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.analysis-facts article{padding:12px;border:1px solid #dce7ed;border-radius:12px;background:#f8fbfc}.analysis-facts span{display:block;color:#6b8190;font-size:10px;font-weight:900}.analysis-facts strong{display:block;margin-top:4px;font-size:16px}.ai-note,.note-visibility{padding:10px 12px;border-radius:11px;background:#fff8e7;color:#6b571d;font-size:11px;line-height:1.7}.generate-ai{width:100%;margin-top:10px;background:#263f91;color:#fff;border-color:transparent;font-size:12px}.generate-ai:disabled{opacity:.65;cursor:wait}.ai-result{display:grid;gap:8px;margin-top:11px}.ai-result article{padding:12px;border:1px solid #dbe5ed;border-radius:12px;background:#f8fafc}.ai-result span{display:block;color:#425f91;font-size:10px;font-weight:900}.ai-result p{margin:5px 0 0;line-height:1.7;color:#354d5d}.ai-result button{margin-top:8px;background:#eaf8f3;color:#08745a;border-color:#c8e6db}.note-options{display:grid;gap:7px}.note-options label{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:start;gap:9px;padding:11px;border:1px solid #dbe6ed;border-radius:12px;background:#f9fbfc;cursor:pointer}.note-options label.selected{border-color:var(--teacher-accent,#1768c5);background:#edf5ff}.note-options input{width:18px;height:18px;accent-color:var(--teacher-accent,#1768c5)}.note-options div{display:grid;gap:2px}.note-options div small{color:#56758a;font-size:9px;font-weight:900}.note-options div b{font-size:12px;line-height:1.5}.note-options div span{color:#758996;font-size:10px;line-height:1.45}.note-options em{font-style:normal;font-size:9px;color:#657c8c;background:#fff;border-radius:99px;padding:4px 6px}.custom-note{display:grid;gap:5px;margin-top:10px;font-size:11px;font-weight:900}.custom-note textarea,.reason-field textarea{width:100%;min-height:86px;border:1px solid #cbdbe6;border-radius:10px;padding:9px;font:inherit;box-sizing:border-box}.note-history{margin-top:12px;border-top:1px solid #e3ebf0;padding-top:10px}.note-history summary{cursor:pointer;font-weight:900;color:#38586c}.note-history>div{display:grid;gap:6px;margin-top:8px}.note-history article{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 10px;border-radius:9px;background:#f6f9fb}.note-history article b{font-size:11px}.note-history article small{font-size:9px;color:#758996}.modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}.referral-students{display:grid;gap:6px;max-height:280px;overflow:auto}.referral-students label{display:flex;align-items:center;gap:9px;padding:10px;border-radius:10px;background:#f6f9fb}.referral-students span{display:grid}.referral-students small{color:#718696}.reason-field{display:grid;gap:5px;margin-top:12px;font-size:11px;font-weight:900}.parent-notify{display:flex;gap:8px;align-items:center;margin-top:10px;padding:10px;border-radius:10px;background:#eef7ff;font-weight:900}.follow-toast{position:fixed;left:18px;bottom:18px;z-index:700;background:#153d5c;color:#fff;padding:11px 15px;border-radius:11px;box-shadow:0 10px 25px #102a4338}
@media(max-width:900px){.follow-head{align-items:stretch;flex-direction:column}.follow-overview{grid-template-columns:repeat(3,1fr)}.analysis-facts{grid-template-columns:1fr}.students-follow-card>header{align-items:stretch;flex-direction:column}}
@media(max-width:620px){.follow-page{gap:12px}.follow-head,.follow-card{padding:14px;border-radius:14px}.follow-head h1{font-size:25px}.follow-filters{display:grid;grid-template-columns:1fr 1fr}.follow-filters label:last-child{grid-column:1/-1}.follow-overview{grid-template-columns:1fr 1fr}.follow-overview article:first-child{grid-column:1/-1}.follow-modal>section{padding:14px}.note-options label{grid-template-columns:auto 1fr}.note-options em{grid-column:2}.modal-actions{display:grid;grid-template-columns:1fr 1fr}.follow-toast{right:12px;left:12px;bottom:12px}}
'''
FOLLOW_CSS.write_text(follow_css, encoding='utf-8')

ai_route = r'''import { generateText } from "ai";
import { NextResponse } from "next/server";
import { requireSession } from "../../../../lib/server/portal-auth";

type Dimension = { label?: unknown; value?: unknown };
type RepeatedNote = { label?: unknown; count?: unknown };
type InsightBody = {
  subject?: unknown;
  performance?: unknown;
  completion?: unknown;
  missing?: unknown;
  weakest?: Dimension;
  strongest?: Dimension;
  repeatedNotes?: RepeatedNote[];
};

function boundedNumber(value: unknown, min = 0, max = 100) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function shortText(value: unknown, max = 80) {
  return String(value || "").replace(/[\r\n\t]+/g, " ").trim().slice(0, max);
}

function parseJsonText(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    throw new Error("invalid_ai_json");
  }
}

export async function POST(request: Request) {
  const session = await requireSession("teacher");
  if (!session) return NextResponse.json({ ok: false, message: "غير مصرح" }, { status: 401 });

  try {
    const body = await request.json() as InsightBody;
    const subject = shortText(body.subject || "المادة", 50);
    const performance = boundedNumber(body.performance);
    const completion = boundedNumber(body.completion);
    const missing = Math.round(boundedNumber(body.missing, 0, 30));
    const weakest = { label: shortText(body.weakest?.label || "غير محدد", 60), value: boundedNumber(body.weakest?.value) };
    const strongest = { label: shortText(body.strongest?.label || "غير محدد", 60), value: boundedNumber(body.strongest?.value) };
    const repeatedNotes = (Array.isArray(body.repeatedNotes) ? body.repeatedNotes : [])
      .slice(0, 5)
      .map(item => ({ label: shortText(item.label, 90), count: Math.round(boundedNumber(item.count, 0, 50)) }))
      .filter(item => item.label && item.count > 0);

    const prompt = `أنت مساعد تربوي سعودي يساعد المعلم على قراءة مؤشرات طالب في المرحلة الثانوية. اسم الطالب غير مُرسل إليك.\n\nالمادة: ${subject}\nالأداء في العناصر التي تم رصدها فقط: ${performance}%\nنسبة اكتمال الرصد: ${completion}%\nعدد العناصر غير المرصودة: ${missing}\nأضعف محور مرصود: ${weakest.label} (${weakest.value}%)\nأقوى محور مرصود: ${strongest.label} (${strongest.value}%)\nالملاحظات المتكررة: ${repeatedNotes.length ? repeatedNotes.map(item => `${item.label} (${item.count} مرات)`).join("، ") : "لا توجد"}\n\nأخرج JSON فقط بهذه المفاتيح:\n{\n  "analysis": "قراءة تربوية قصيرة تفرق بوضوح بين ضعف الأداء وبين نقص الرصد",\n  "recommendedAction": "إجراء واحد محدد للمعلم في الحصة القادمة",\n  "suggestedNote": "ملاحظة مدرسية محترمة وواضحة تبدأ بكلمة الطالب، وتصلح للطالب وولي الأمر"\n}\n\nقواعد:\n- إذا كان اكتمال الرصد أقل من 100% فلا تصف الطالب بأنه ضعيف أو متعثر بشكل نهائي، بل قل إن القراءة مبدئية.\n- لا تخترع سببًا نفسيًا أو صحيًا أو عائليًا.\n- لا تذكر اسم طالب أو معلومات شخصية.\n- لا تتجاوز الملاحظة المقترحة 30 كلمة.\n- استخدم العربية المهنية المباشرة.`;

    const result = await generateText({
      model: "openai/gpt-5.4",
      system: "أجب بالعربية فقط، وأعد JSON صالحًا دون Markdown أو شرح إضافي.",
      prompt,
    });
    const parsed = parseJsonText(result.text);
    const analysis = shortText(parsed.analysis, 420);
    const recommendedAction = shortText(parsed.recommendedAction, 320);
    const suggestedNote = shortText(parsed.suggestedNote, 260);
    if (!analysis || !recommendedAction || !suggestedNote) throw new Error("incomplete_ai_response");
    return NextResponse.json({ ok: true, analysis, recommendedAction, suggestedNote });
  } catch (error) {
    console.error("student-insight-ai", error);
    return NextResponse.json({ ok: false, message: "تعذر تشغيل التحليل بالذكاء الاصطناعي الآن. جرّب مرة أخرى بعد قليل." }, { status: 503 });
  }
}
'''
AI_ROUTE.write_text(ai_route, encoding='utf-8')

print('v81 patch applied')
