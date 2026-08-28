"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { doc, setDoc } from "firebase/firestore";
import * as XLSX from "xlsx";
import { db } from "../../../lib/firebase";
import { useTeacherClient } from "../../../lib/teacher-client";
import { type ClientTenant, tenantStudentsPath } from "../../../lib/firestore-tenant-client";
import { ACADEMIC_UNITS, FINAL_MAX, GRADE_DISTRIBUTION, RESEARCH_MAX, UNIT_MAX, calculatePercentage, calculateUnitTotal, clampGrade, type GradeKey } from "../../../lib/academic-config";
import "./register.css";

type GradeRecord = Record<GradeKey, number> & { notes: string };
type UnitRecord = Partial<GradeRecord> & { exam1?: number; exam2?: number; total?: number; maximumTotal?: number; percentage?: number; maxGrades?: Record<string, number>; updatedAt?: string };
type Student = {
  id: string;
  code?: string;
  name?: string;
  class?: string;
  className?: string;
  research?: number;
  researchScore?: number;
  units?: Record<string, UnitRecord>;
};

const emptyGrade: GradeRecord = { attendance: 0, participation: 0, homework: 0, unitExam: 0, notes: "" };
const PORTAL_NAME = "بوابة أستاذ لحوني التعليمية";
function escapeHtml(value: string) { return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character] || character)); }

export default function GradesPage() {
  const session = useTeacherClient();
  const tenant = useMemo<ClientTenant | null>(() => session?.teacherId && session?.subjectKey ? {
    teacherId: session.teacherId,
    teacherName: session.teacherName || "",
    subjectKey: session.subjectKey as never,
  } : null, [session?.teacherId, session?.teacherName, session?.subjectKey]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedUnit, setSelectedUnit] = useState(ACADEMIC_UNITS[0].key);
  const [grades, setGrades] = useState<Record<string, GradeRecord>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tenant) {
      setMessage("انتهت جلسة المعلم. سجّل الدخول من جديد.");
      return;
    }
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
        const list = (Array.isArray(data.students) ? data.students : []).map((value: Record<string, unknown>) => {
          const id = String(value.code || value.id || "").trim().toUpperCase();
          const className = String(value.className || value.class || "").trim();
          return { ...value, id, code: id, class: className, className } as Student;
        }).filter((student: Student) => !!student.id && !!student.name && !!student.class);
        list.sort((a, b) => String(a.class).localeCompare(String(b.class), "ar", { numeric: true }) || String(a.name).localeCompare(String(b.name), "ar"));
        setStudents(list);
      })
      .catch(error => {
        if (error?.name !== "AbortError") setMessage(error instanceof Error ? error.message : "تعذر تحميل طلاب المادة الحالية");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [tenant, session.activeGrade]);

  const classes = useMemo(() => Array.from(new Set(students.map(student => String(student.class || "").trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, "ar", { numeric: true })), [students]);
  const classStudents = useMemo(() => students.filter(student => String(student.class || "").trim() === selectedClass), [students, selectedClass]);

  useEffect(() => {
    if (!classes.length) { setSelectedClass(""); return; }
    if (!selectedClass || !classes.includes(selectedClass)) setSelectedClass(classes[0]);
  }, [classes, selectedClass]);

  const unitInfo = ACADEMIC_UNITS.find(unit => unit.key === selectedUnit) || ACADEMIC_UNITS[0];
  const columns: Array<[GradeKey, string]> = [["attendance", "الحضور"], ["participation", "المشاركة"], ["homework", "الواجبات"], ["unitExam", unitInfo.examLabel]];

  useEffect(() => {
    const next: Record<string, GradeRecord> = {};
    classStudents.forEach(student => {
      const saved = student.units?.[selectedUnit] || {};
      next[student.id] = { ...emptyGrade, ...saved, unitExam: Number(saved.unitExam ?? saved.exam1 ?? saved.exam2 ?? 0) };
    });
    setGrades(next);
  }, [classStudents, selectedUnit]);

  function setGradeValue(id: string, key: GradeKey, value: number) { setGrades(current => ({ ...current, [id]: { ...(current[id] || emptyGrade), [key]: clampGrade(key, value) } })); }
  function updateGrade(id: string, key: GradeKey, raw: string) { setGradeValue(id, key, Number(raw)); }
  function adjustGrade(id: string, key: GradeKey, amount: number) { setGrades(current => { const row = current[id] || emptyGrade; return { ...current, [id]: { ...row, [key]: clampGrade(key, Number(row[key] || 0) + amount) } }; }); }
  function applyGradeToAll(key: GradeKey) { setGrades(current => { const next = { ...current }; classStudents.forEach(student => { next[student.id] = { ...(next[student.id] || emptyGrade), [key]: GRADE_DISTRIBUTION[key] }; }); return next; }); }
  function clearStudent(id: string) { setGrades(current => ({ ...current, [id]: { ...emptyGrade } })); }
  function studentRef(id: string) { if (!tenant) throw new Error("missing tenant"); return doc(db, tenantStudentsPath(tenant), id); }

  async function saveRegister() {
    if (!selectedClass || !tenant) return setMessage("اختر الفصل أولًا");
    try {
      setSaving(true);
      await Promise.all(classStudents.map(student => {
        const grade = grades[student.id] || emptyGrade;
        const total = calculateUnitTotal(grade);
        const previous = student.units?.[selectedUnit] || {};
        return setDoc(studentRef(student.id), {
          name: student.name || "",
          class: student.class || "",
          className: student.class || "",
          code: student.code || student.id,
          active: true,
          rosterActive: true,
          [`units.${selectedUnit}`]: { ...previous, ...grade, total, maximumTotal: UNIT_MAX, percentage: calculatePercentage(total, UNIT_MAX), maxGrades: GRADE_DISTRIBUTION, updatedAt: new Date().toISOString() },
          teacherId: tenant.teacherId,
          subjectKey: tenant.subjectKey,
        }, { merge: true });
      }));
      setMessage(`تم حفظ درجات ${unitInfo.label} بنجاح — مجموع الوحدة ${UNIT_MAX} درجة`);
    } catch { setMessage("تعذر الحفظ"); }
    finally { setSaving(false); }
  }

  async function clearAllGrades() {
    if (!selectedClass || !tenant) return setMessage("اختر الفصل أولًا");
    if (!confirm(`هل تريد حذف جميع درجات ${unitInfo.label} لطلاب الفصل ${selectedClass}؟`)) return;
    try {
      setSaving(true);
      setGrades(Object.fromEntries(classStudents.map(student => [student.id, { ...emptyGrade }])));
      await Promise.all(classStudents.map(student => setDoc(studentRef(student.id), {
        [`units.${selectedUnit}`]: { ...(student.units?.[selectedUnit] || {}), ...emptyGrade, total: 0, maximumTotal: UNIT_MAX, percentage: 0, maxGrades: GRADE_DISTRIBUTION, updatedAt: new Date().toISOString() },
      }, { merge: true })));
      setMessage(`تم حذف جميع درجات ${unitInfo.label}`);
    } catch { setMessage("تعذر حذف الدرجات"); }
    finally { setSaving(false); }
  }

  function exportGrades(mode: "selected" | "all") {
    if (!students.length) return setMessage("لا توجد بيانات للتصدير");
    const targetUnits = mode === "all" ? ACADEMIC_UNITS : [unitInfo];
    const rows = students.map((student, index) => {
      const row: Record<string, string | number> = { "م": index + 1, "اسم الطالب": student.name || "", "الفصل": student.class || "" };
      let grand = 0;
      targetUnits.forEach(unit => {
        const saved = student.units?.[unit.key] || {};
        const attendance = Number(saved.attendance || 0), participation = Number(saved.participation || 0), homework = Number(saved.homework || 0), exam = Number(saved.unitExam ?? saved.exam1 ?? saved.exam2 ?? 0);
        const total = Number(saved.total ?? calculateUnitTotal({ attendance, participation, homework, unitExam: exam }));
        row[`${unit.label} - الحضور`] = attendance; row[`${unit.label} - المشاركة`] = participation; row[`${unit.label} - الواجبات`] = homework; row[`${unit.label} - الاختبار`] = exam; row[`${unit.label} - المجموع`] = total; row[`${unit.label} - النسبة`] = Number(saved.percentage ?? calculatePercentage(total, UNIT_MAX)); row[`${unit.label} - ملاحظات`] = saved.notes || ""; grand += total;
      });
      if (mode === "all") { const research = Math.min(RESEARCH_MAX, Number(student.researchScore ?? student.research ?? 0)); row["درجة البحث"] = research; row[`المجموع الكلي من ${FINAL_MAX}`] = grand + research; }
      return row;
    });
    const sheet = XLSX.utils.json_to_sheet(rows); sheet["!cols"] = [{ wch: 6 }, { wch: 28 }, { wch: 18 }, ...Array(mode === "all" ? 38 : 8).fill({ wch: 16 })];
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, mode === "all" ? "جميع الوحدات" : unitInfo.label);
    XLSX.writeFile(workbook, `درجات-${session.subject || tenant?.subjectKey || "المادة"}-${mode === "all" ? "جميع-الوحدات" : unitInfo.label}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    setMessage(`تم تصدير ${mode === "all" ? "جميع الوحدات" : unitInfo.label} لعدد ${students.length} طالبًا`);
  }

  function printGrades() {
    if (!selectedClass || !classStudents.length) return setMessage("اختر فصلًا يحتوي على طلاب أولًا");
    const rows = classStudents.map((student, index) => { const grade = grades[student.id] || emptyGrade; return { number: index + 1, name: student.name || "طالب بدون اسم", attendance: grade.attendance, participation: grade.participation, homework: grade.homework, exam: grade.unitExam, total: calculateUnitTotal(grade), notes: grade.notes || "" }; });
    const popup = window.open("", "_blank", "width=1100,height=850"); if (!popup) return setMessage("اسمح بالنوافذ المنبثقة لفتح سجل الدرجات");
    popup.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>سجل درجات ${escapeHtml(selectedClass)}</title><style>@page{size:A4 landscape;margin:10mm}body{font-family:Arial,Tahoma,sans-serif;color:#111}h1,p{text-align:center}table{width:100%;border-collapse:collapse}th,td{border:1px solid #222;padding:7px;text-align:center}th{background:#edf3f7}td:nth-child(2){text-align:right}</style></head><body><p><b>${PORTAL_NAME}</b></p><h1>سجل رصد الدرجات — ${escapeHtml(unitInfo.label)}</h1><p>${escapeHtml(session.subject || "المادة")} — ${escapeHtml(session.activeGradeLabel || "")} — ${escapeHtml(selectedClass)}</p><table><thead><tr><th>م</th><th>اسم الطالب</th><th>الحضور</th><th>المشاركة</th><th>الواجبات</th><th>${escapeHtml(unitInfo.examLabel)}</th><th>المجموع من ${UNIT_MAX}</th><th>الملاحظات</th></tr></thead><tbody>${rows.map(row => `<tr><td>${row.number}</td><td>${escapeHtml(row.name)}</td><td>${row.attendance}</td><td>${row.participation}</td><td>${row.homework}</td><td>${row.exam}</td><td><b>${row.total}</b></td><td>${escapeHtml(row.notes)}</td></tr>`).join("")}</tbody></table><script>window.print()</script></body></html>`);
    popup.document.close();
  }

  const currentSubjectLabel = session.subject || "المادة";
  return <main className="gradebook-page grades-page" dir="rtl"><div className="gradebook-wrap"><section className="gradebook-card"><header className="gradebook-head"><div><h1>سجل رصد الدرجات — {unitInfo.label}</h1><p>{currentSubjectLabel}{session.activeGradeLabel ? ` — ${session.activeGradeLabel}` : ""} — {tenant?.teacherName || "المعلم"}. لا تظهر إلا الفصول الرقمية التي اختارها المعلم.</p></div><div className="gradebook-actions"><label>الفصل<select value={selectedClass} onChange={event => setSelectedClass(event.target.value)}><option value="">اختر الفصل</option>{classes.map(name => <option key={name}>{name}</option>)}</select></label><label>الوحدة<select value={selectedUnit} onChange={event => setSelectedUnit(event.target.value as typeof selectedUnit)}>{ACADEMIC_UNITS.map(unit => <option key={unit.key} value={unit.key}>{unit.label}</option>)}</select></label><button type="button" className="research-link" onClick={printGrades}>🖨️ طباعة سجل الدرجات</button><button type="button" className="research-link" onClick={() => exportGrades("selected")}>📄 تصدير {unitInfo.label}</button><button type="button" className="research-link" onClick={() => exportGrades("all")}>📊 جميع الوحدات Excel</button><Link href="/teacher/research" className="research-link">🔬 رصد درجة البحث</Link><button type="button" className="save-button" onClick={saveRegister} disabled={!selectedClass || saving}>{saving ? "جارٍ الحفظ..." : "💾 حفظ الدرجات"}</button><button type="button" className="delete-all-button" onClick={clearAllGrades} disabled={!selectedClass || saving}>🗑 مسح درجات الوحدة</button></div></header><div className="gradebook-scroll"><table className="gradebook-table compact-five-table"><thead><tr><th className="sticky-number">م</th><th className="sticky-name">اسم الطالب</th>{columns.map(([key, label]) => <th key={key} className={key === "unitExam" ? "exam-head" : ""}><span>{label}</span><div className="header-score-control"><input type="number" value={GRADE_DISTRIBUTION[key]} readOnly/><button type="button" onClick={() => applyGradeToAll(key)}>✓ الكل</button></div></th>)}<th>المجموع<small>من {UNIT_MAX}</small></th><th className="notes-head">الملاحظات</th><th className="delete-head">مسح</th></tr></thead><tbody>{classStudents.map((student, index) => { const grade = grades[student.id] || emptyGrade, total = calculateUnitTotal(grade); return <tr key={student.id}><td className="sticky-number">{index + 1}</td><td className="sticky-name"><strong>{student.name}</strong></td>{columns.map(([key]) => <td key={key} className={key === "unitExam" ? "exam-cell" : ""}><div className="mobile-grade-control"><button type="button" className="grade-step minus" onClick={() => adjustGrade(student.id, key, -1)}>−</button><input className="grade-input" type="number" inputMode="decimal" min="0" max={GRADE_DISTRIBUTION[key]} step="1" value={grade[key]} onFocus={event => event.currentTarget.select()} onChange={event => updateGrade(student.id, key, event.target.value)}/><button type="button" className="grade-step plus" onClick={() => adjustGrade(student.id, key, 1)}>+</button><button type="button" className="grade-max" onClick={() => setGradeValue(student.id, key, GRADE_DISTRIBUTION[key])}>كامل</button></div></td>)}<td className="student-total">{total}</td><td><input className="notes-input" value={grade.notes || ""} onChange={event => setGrades(current => ({ ...current, [student.id]: { ...(current[student.id] || emptyGrade), notes: event.target.value } }))} placeholder="ملاحظة"/></td><td><button className="row-delete-button" type="button" onClick={() => clearStudent(student.id)}>مسح</button></td></tr>; })}{!classStudents.length && <tr><td colSpan={9} className="empty-row">{loading ? "جارٍ تحميل الطلاب..." : "لا يوجد طلاب في الفصل المختار."}</td></tr>}</tbody></table></div><footer className="gradebook-footer"><span>المادة: {currentSubjectLabel}</span><span>المرحلة: {session.activeGradeLabel || "جميع المراحل"}</span><span>الوحدة: {unitInfo.label}</span><span>درجة الوحدة: {UNIT_MAX}</span><span>عدد الطلاب: {classStudents.length}</span></footer>{message && <p className="gradebook-message">{message}</p>}</section></div></main>;
}
