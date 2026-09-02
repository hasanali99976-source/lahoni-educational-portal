"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { doc, setDoc } from "firebase/firestore";
import * as XLSX from "xlsx";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { db } from "../../../lib/firebase";
import { useTeacherClient } from "../../../lib/teacher-client";
import { type ClientTenant, tenantStudentsPath } from "../../../lib/firestore-tenant-client";
import { ACADEMIC_UNITS, GRADE_DISTRIBUTION, UNIT_MAX, calculatePercentage, calculateUnitTotal, clampGrade, type GradeKey } from "../../../lib/academic-config";
import "./register.css";

type GradeRecord = Record<GradeKey, number> & { notes: string };
type UnitRecord = Partial<GradeRecord> & { exam1?: number; exam2?: number; total?: number; percentage?: number };
type Student = {
  id: string;
  code: string;
  name: string;
  class: string;
  className: string;
  units?: Record<string, UnitRecord>;
};

const emptyGrade: GradeRecord = { attendance: 0, participation: 0, homework: 0, unitExam: 0, notes: "" };

export default function GradesPage() {
  const session = useTeacherClient();
  const tenant = useMemo<ClientTenant | null>(() => session.teacherId && session.subjectKey ? {
    teacherId: session.teacherId,
    teacherName: session.teacherName || "",
    subjectKey: session.subjectKey as never,
  } : null, [session.teacherId, session.teacherName, session.subjectKey]);

  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedUnit, setSelectedUnit] = useState(ACADEMIC_UNITS[0].key);
  const [grades, setGrades] = useState<Record<string, GradeRecord>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!tenant) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ subjectId: tenant.subjectKey });
    if (session.activeGrade) params.set("grade", String(session.activeGrade));
    setLoading(true);
    setMessage("");
    fetch(`/api/teacher/students?${params.toString()}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "تعذر تحميل الطلاب");
        return data;
      })
      .then(data => {
        const list: Student[] = (Array.isArray(data.students) ? data.students : [])
          .map((value: Record<string, unknown>) => {
            const code = String(value.code || value.id || "").trim().toUpperCase();
            const className = String(value.className || value.class || "").trim();
            return {
              ...(value as unknown as Student),
              id: code,
              code,
              name: String(value.name || "").trim(),
              class: className,
              className,
            };
          })
          .filter((student: Student) => Boolean(student.id && student.name && student.class));
        list.sort((a: Student, b: Student) => a.class.localeCompare(b.class, "ar", { numeric: true }) || a.name.localeCompare(b.name, "ar"));
        setStudents(list);
      })
      .catch(error => {
        if ((error as Error)?.name !== "AbortError") setMessage(error instanceof Error ? error.message : "تعذر تحميل طلاب المادة الحالية");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [tenant, session.activeGrade]);

  const classes = useMemo(() => [...new Set(students.map(student => student.class))]
    .sort((a, b) => a.localeCompare(b, "ar", { numeric: true })), [students]);
  const classStudents = useMemo(() => students.filter(student => student.class === selectedClass), [students, selectedClass]);
  const unitInfo = ACADEMIC_UNITS.find(unit => unit.key === selectedUnit) || ACADEMIC_UNITS[0];
  const columns: Array<[GradeKey, string]> = [["attendance", "الحضور"], ["participation", "المشاركة"], ["homework", "الواجبات"], ["unitExam", unitInfo.examLabel]];

  useEffect(() => {
    if (!classes.length) { setSelectedClass(""); return; }
    if (!selectedClass || !classes.includes(selectedClass)) setSelectedClass(classes[0]);
  }, [classes, selectedClass]);

  useEffect(() => {
    const next: Record<string, GradeRecord> = {};
    classStudents.forEach(student => {
      const saved = student.units?.[selectedUnit] || {};
      next[student.id] = { ...emptyGrade, ...saved, unitExam: Number(saved.unitExam ?? saved.exam1 ?? saved.exam2 ?? 0) };
    });
    setGrades(next);
  }, [classStudents, selectedUnit]);

  function setGradeValue(id: string, key: GradeKey, value: number) {
    setGrades(current => ({ ...current, [id]: { ...(current[id] || emptyGrade), [key]: clampGrade(key, value) } }));
  }

  function applyFullGrade(key: GradeKey) {
    setGrades(current => {
      const next = { ...current };
      classStudents.forEach(student => { next[student.id] = { ...(next[student.id] || emptyGrade), [key]: GRADE_DISTRIBUTION[key] }; });
      return next;
    });
  }

  async function saveRegister() {
    if (!tenant || !selectedClass) return setMessage("اختر الفصل أولًا");
    setSaving(true);
    try {
      await Promise.all(classStudents.map(student => {
        const row = grades[student.id] || emptyGrade;
        const total = calculateUnitTotal(row);
        return setDoc(doc(db, tenantStudentsPath(tenant), student.id), {
          name: student.name,
          class: student.class,
          className: student.class,
          code: student.code,
          active: true,
          rosterActive: true,
          units: {
            [selectedUnit]: {
              ...(student.units?.[selectedUnit] || {}),
              ...row,
              total,
              maximumTotal: UNIT_MAX,
              percentage: calculatePercentage(total, UNIT_MAX),
              maxGrades: GRADE_DISTRIBUTION,
              updatedAt: new Date().toISOString(),
            },
          },
          teacherId: tenant.teacherId,
          subjectKey: tenant.subjectKey,
        }, { merge: true });
      }));
      setStudents(current => current.map(student => classStudents.some(item => item.id === student.id)
        ? { ...student, units: { ...(student.units || {}), [selectedUnit]: { ...(student.units?.[selectedUnit] || {}), ...(grades[student.id] || emptyGrade), total: calculateUnitTotal(grades[student.id] || emptyGrade), percentage: calculatePercentage(calculateUnitTotal(grades[student.id] || emptyGrade), UNIT_MAX) } } }
        : student));
      setMessage("تم حفظ الدرجات بنجاح");
    } catch {
      setMessage("تعذر حفظ الدرجات");
    } finally {
      setSaving(false);
    }
  }

  function exportExcel() {
    if (!classStudents.length) return setMessage("اختر فصلًا يحتوي على طلاب أولًا");
    const rows = classStudents.map((student, index) => {
      const row = grades[student.id] || emptyGrade;
      return {
        "م": index + 1,
        "اسم الطالب": student.name,
        "الفصل": student.class,
        "الحضور": row.attendance,
        "المشاركة": row.participation,
        "الواجبات": row.homework,
        [unitInfo.examLabel]: row.unitExam,
        [`المجموع من ${UNIT_MAX}`]: calculateUnitTotal(row),
        "الملاحظات": row.notes,
      };
    });
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet["!cols"] = [{ wch: 6 }, { wch: 30 }, { wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(workbook, sheet, "الدرجات");
    XLSX.writeFile(workbook, `درجات-${selectedClass}-${unitInfo.label}.xlsx`);
  }

  async function downloadGradesPdf() {
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
  }

  return <main className="gradebook-page grades-page" dir="rtl"><div className="gradebook-wrap"><section className="gradebook-card">
    <header className="gradebook-head"><div><h1>سجل رصد الدرجات — {unitInfo.label}</h1><p>{session.subject || "المادة"}{session.activeGradeLabel ? ` — ${session.activeGradeLabel}` : ""}. تظهر الفصول الرقمية المختارة فقط.</p></div><div className="gradebook-actions"><label>الفصل<select value={selectedClass} onChange={event => setSelectedClass(event.target.value)}><option value="">اختر الفصل</option>{classes.map(name => <option key={name}>{name}</option>)}</select></label><label>الوحدة<select value={selectedUnit} onChange={event => setSelectedUnit(event.target.value as typeof selectedUnit)}>{ACADEMIC_UNITS.map(unit => <option key={unit.key} value={unit.key}>{unit.label}</option>)}</select></label><button type="button" className="research-link" onClick={() => void downloadGradesPdf()}>📄 PDF صفحة واحدة — كل الطلاب</button><button type="button" className="research-link" onClick={exportExcel}>📊 Excel</button><Link href="/teacher/research" className="research-link">🔬 درجة البحث</Link><button type="button" className="save-button" onClick={saveRegister} disabled={!selectedClass || saving}>{saving ? "جارٍ الحفظ..." : "💾 حفظ الدرجات"}</button></div></header>
    <div className="gradebook-scroll"><table className="gradebook-table compact-five-table"><thead><tr><th className="sticky-number">م</th><th className="sticky-name">اسم الطالب</th>{columns.map(([key, label]) => <th key={key}><span>{label}</span><div className="header-score-control"><input value={GRADE_DISTRIBUTION[key]} readOnly/><button type="button" onClick={() => applyFullGrade(key)}>✓ الكل</button></div></th>)}<th>المجموع<small>من {UNIT_MAX}</small></th><th>الملاحظات</th><th>مسح</th></tr></thead><tbody>{classStudents.map((student, index) => { const row = grades[student.id] || emptyGrade; return <tr key={student.id}><td className="sticky-number">{index + 1}</td><td className="sticky-name"><strong>{student.name}</strong></td>{columns.map(([key]) => <td key={key}><div className="mobile-grade-control"><button type="button" className="grade-step minus" onClick={() => setGradeValue(student.id, key, Number(row[key] || 0) - 1)}>−</button><input className="grade-input" type="number" min="0" max={GRADE_DISTRIBUTION[key]} value={row[key]} onChange={event => setGradeValue(student.id, key, Number(event.target.value))}/><button type="button" className="grade-step plus" onClick={() => setGradeValue(student.id, key, Number(row[key] || 0) + 1)}>+</button></div></td>)}<td className="student-total">{calculateUnitTotal(row)}</td><td><input className="notes-input" value={row.notes || ""} onChange={event => setGrades(current => ({ ...current, [student.id]: { ...(current[student.id] || emptyGrade), notes: event.target.value } }))}/></td><td><button className="row-delete-button" type="button" onClick={() => setGrades(current => ({ ...current, [student.id]: { ...emptyGrade } }))}>مسح</button></td></tr>; })}{!classStudents.length && <tr><td colSpan={9} className="empty-row">{loading ? "جارٍ تحميل الطلاب..." : "لا يوجد طلاب في الفصل المختار."}</td></tr>}</tbody></table></div>
    <footer className="gradebook-footer"><span>المادة: {session.subject || "المادة"}</span><span>المرحلة: {session.activeGradeLabel || "جميع المراحل"}</span><span>الفصل: {selectedClass || "—"}</span><span>عدد الطلاب: {classStudents.length}</span></footer>{message && <p className="gradebook-message">{message}</p>}
  </section></div></main>;
}
