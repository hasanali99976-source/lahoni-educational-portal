"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { doc, setDoc } from "firebase/firestore";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import { renderGradesPdfPages } from "../../../lib/class-pdf-pages-v83";
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
    setMessage(`جارٍ إنشاء سجل كامل لـ ${classStudents.length} طالبًا...`);
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
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      const canvases = renderGradesPdfPages({
        portalName: "بوابة أستاذ لحوني التعليمية",
        teacherName: session.teacherName || "",
        subject: session.subject || "المادة",
        stage: session.activeGradeLabel || "",
        className: selectedClass,
        unitLabel: unitInfo.label,
        examLabel: unitInfo.examLabel,
        rows: allRows,
      });
      if (!canvases.length) throw new Error("grades_pdf_no_pages");
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
      canvases.forEach((canvas, index) => {
        if (index > 0) pdf.addPage("a4", "landscape");
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.97), "JPEG", 0, 0, 297, 210, undefined, "FAST");
      });
      pdf.save(`درجات-${selectedClass}-${unitInfo.label}.pdf`);
      setMessage(`تم تنزيل سجل الدرجات كاملًا: ${allRows.length} طالبًا في ${canvases.length} صفحة واضحة.`);
    } catch (error) {
      console.error("grades-paginated-pdf", error);
      setMessage("تعذر إنشاء PDF الآن. حدّث الصفحة ثم أعد المحاولة.");
    }
  }

  return <main className="gradebook-page grades-page" dir="rtl"><div className="gradebook-wrap"><section className="gradebook-card">
    <header className="gradebook-head"><div><h1>سجل رصد الدرجات — {unitInfo.label}</h1><p>{session.subject || "المادة"}{session.activeGradeLabel ? ` — ${session.activeGradeLabel}` : ""}. تظهر الفصول الرقمية المختارة فقط.</p></div><div className="gradebook-actions"><label>الفصل<select value={selectedClass} onChange={event => setSelectedClass(event.target.value)}><option value="">اختر الفصل</option>{classes.map(name => <option key={name}>{name}</option>)}</select></label><label>الوحدة<select value={selectedUnit} onChange={event => setSelectedUnit(event.target.value as typeof selectedUnit)}>{ACADEMIC_UNITS.map(unit => <option key={unit.key} value={unit.key}>{unit.label}</option>)}</select></label><button type="button" className="research-link" onClick={() => void downloadGradesPdf()}>📄 PDF كامل — كل الطلاب</button><button type="button" className="research-link" onClick={exportExcel}>📊 Excel</button><Link href="/teacher/research" className="research-link">🔬 درجة البحث</Link><button type="button" className="save-button" onClick={saveRegister} disabled={!selectedClass || saving}>{saving ? "جارٍ الحفظ..." : "💾 حفظ الدرجات"}</button></div></header>
    <div className="gradebook-scroll"><table className="gradebook-table compact-five-table"><thead><tr><th className="sticky-number">م</th><th className="sticky-name">اسم الطالب</th>{columns.map(([key, label]) => <th key={key}><span>{label}</span><div className="header-score-control"><input value={GRADE_DISTRIBUTION[key]} readOnly/><button type="button" onClick={() => applyFullGrade(key)}>✓ الكل</button></div></th>)}<th>المجموع<small>من {UNIT_MAX}</small></th><th>الملاحظات</th><th>مسح</th></tr></thead><tbody>{classStudents.map((student, index) => { const row = grades[student.id] || emptyGrade; return <tr key={student.id}><td className="sticky-number">{index + 1}</td><td className="sticky-name"><strong>{student.name}</strong></td>{columns.map(([key]) => <td key={key}><div className="mobile-grade-control"><button type="button" className="grade-step minus" onClick={() => setGradeValue(student.id, key, Number(row[key] || 0) - 1)}>−</button><input className="grade-input" type="number" min="0" max={GRADE_DISTRIBUTION[key]} value={row[key]} onChange={event => setGradeValue(student.id, key, Number(event.target.value))}/><button type="button" className="grade-step plus" onClick={() => setGradeValue(student.id, key, Number(row[key] || 0) + 1)}>+</button></div></td>)}<td className="student-total">{calculateUnitTotal(row)}</td><td><input className="notes-input" value={row.notes || ""} onChange={event => setGrades(current => ({ ...current, [student.id]: { ...(current[student.id] || emptyGrade), notes: event.target.value } }))}/></td><td><button className="row-delete-button" type="button" onClick={() => setGrades(current => ({ ...current, [student.id]: { ...emptyGrade } }))}>مسح</button></td></tr>; })}{!classStudents.length && <tr><td colSpan={9} className="empty-row">{loading ? "جارٍ تحميل الطلاب..." : "لا يوجد طلاب في الفصل المختار."}</td></tr>}</tbody></table></div>
    <footer className="gradebook-footer"><span>المادة: {session.subject || "المادة"}</span><span>المرحلة: {session.activeGradeLabel || "جميع المراحل"}</span><span>الفصل: {selectedClass || "—"}</span><span>عدد الطلاب: {classStudents.length}</span></footer>{message && <p className="gradebook-message">{message}</p>}
  </section></div></main>;
}
