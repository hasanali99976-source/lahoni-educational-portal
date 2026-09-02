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
    setMessage("جارٍ تجهيز سجل الدرجات PDF بجميع الطلاب...");

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
    const pageSize = 24;
    const groups = Array.from({ length: Math.ceil(allRows.length / pageSize) }, (_, index) => allRows.slice(index * pageSize, (index + 1) * pageSize));
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });

    try {
      for (let pageIndex = 0; pageIndex < groups.length; pageIndex += 1) {
        const pageRows = groups[pageIndex];
        const bodyRows = pageRows.map(row => `<tr><td>${row.number}</td><td class="student-name">${escapePdfText(row.name)}</td><td>${row.attendance}</td><td>${row.participation}</td><td>${row.homework}</td><td>${row.unitExam}</td><td class="total">${row.total}</td><td class="notes">${escapePdfText(row.notes)}</td></tr>`).join("");
        const sheet = document.createElement("section");
        sheet.dir = "rtl";
        sheet.setAttribute("aria-hidden", "true");
        sheet.style.cssText = "position:fixed;left:-12000px;top:0;width:1123px;height:794px;background:#fff;z-index:-1;overflow:hidden;";
        sheet.innerHTML = `
          <style>
            *{box-sizing:border-box}
            .grade-pdf-sheet{width:1123px;height:794px;padding:22px 26px 18px;background:#fff;color:#123946;font-family:'Tajawal','Segoe UI',Tahoma,Arial,sans-serif;display:grid;grid-template-rows:auto auto 1fr auto;gap:10px;overflow:hidden}
            .grade-pdf-head{min-height:82px;border-radius:17px;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;background:linear-gradient(135deg,#082d38,#0d5665 72%,#137586);color:#fff}.grade-pdf-head small{display:block;font-size:10px;color:#cde8ec;font-weight:800}.grade-pdf-head h1{margin:4px 0 0;font-size:24px}.grade-pdf-head .page{text-align:left}.grade-pdf-head .page strong{display:block;font-size:19px}.grade-pdf-head .page span{display:inline-block;margin-top:5px;padding:4px 10px;border-radius:999px;background:#e7b649;color:#17353e;font-size:10px;font-weight:900}
            .grade-pdf-meta{display:grid;grid-template-columns:1.3fr 1fr 1fr 1fr;gap:7px}.grade-pdf-meta div{border:1px solid #d8e5e9;border-radius:10px;background:#f8fbfc;padding:7px 10px}.grade-pdf-meta small{display:block;color:#6a8089;font-size:8px;font-weight:800}.grade-pdf-meta strong{display:block;margin-top:2px;font-size:11px;color:#153e4b}
            table{width:100%;border-collapse:collapse;table-layout:fixed;border:1px solid #bfd0d5}th{height:31px;background:#143f4d;color:#fff;border:1px solid #315966;font-size:9px;padding:4px}td{height:22px;border:1px solid #dbe5e8;padding:3px 5px;text-align:center;font-size:9px;line-height:1.08;overflow:hidden}tbody tr:nth-child(even){background:#f7fafb}.student-name{text-align:right!important;font-weight:800;font-size:10px;white-space:nowrap}.total{font-weight:900;background:#eef6f8}.notes{text-align:right!important;font-size:8px;white-space:nowrap;text-overflow:ellipsis}.grade-pdf-footer{display:flex;align-items:center;justify-content:space-between;border-top:1px dashed #b7c7cc;padding-top:7px;color:#607780;font-size:9px}.grade-pdf-footer strong{color:#174653}
          </style>
          <div class="grade-pdf-sheet">
            <header class="grade-pdf-head"><div><small>بوابة أستاذ لحوني التعليمية</small><h1>سجل رصد الدرجات</h1></div><div class="page"><strong>${escapePdfText(unitInfo.label)}</strong><span>صفحة ${pageIndex + 1} من ${groups.length}</span></div></header>
            <section class="grade-pdf-meta"><div><small>المادة</small><strong>${escapePdfText(session.subject || "المادة")}</strong></div><div><small>المرحلة</small><strong>${escapePdfText(session.activeGradeLabel || "")}</strong></div><div><small>الفصل</small><strong>${escapePdfText(selectedClass)}</strong></div><div><small>عدد الطلاب</small><strong>${allRows.length}</strong></div></section>
            <table><colgroup><col style="width:38px"><col style="width:250px"><col style="width:74px"><col style="width:74px"><col style="width:74px"><col style="width:86px"><col style="width:72px"><col></colgroup><thead><tr><th>م</th><th>اسم الطالب</th><th>الحضور</th><th>المشاركة</th><th>الواجبات</th><th>${escapePdfText(unitInfo.examLabel)}</th><th>المجموع</th><th>الملاحظات</th></tr></thead><tbody>${bodyRows}</tbody></table>
            <footer class="grade-pdf-footer"><strong>بوابة أستاذ لحوني التعليمية</strong><span>${escapePdfText(selectedClass)} — ${escapePdfText(unitInfo.label)}</span><span>الطلاب ${pageRows[0]?.number || 0}–${pageRows[pageRows.length - 1]?.number || 0} من ${allRows.length}</span></footer>
          </div>`;
        document.body.appendChild(sheet);
        if (document.fonts?.ready) await document.fonts.ready;
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        const canvas = await html2canvas(sheet, { scale: 2, backgroundColor: "#ffffff", logging: false, useCORS: true, width: 1123, height: 794, windowWidth: 1123, windowHeight: 794 });
        if (pageIndex > 0) pdf.addPage("a4", "landscape");
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.96), "JPEG", 0, 0, 297, 210, undefined, "FAST");
        sheet.remove();
      }
      pdf.save(`رصد-الدرجات-${selectedClass}-${unitInfo.label}.pdf`);
      setMessage(`تم تنزيل سجل الدرجات PDF ويحتوي جميع طلاب الفصل (${allRows.length} طالبًا).`);
    } catch {
      document.querySelectorAll('[aria-hidden="true"]').forEach(node => {
        if (node instanceof HTMLElement && node.style.left === "-12000px") node.remove();
      });
      setMessage("تعذر إنشاء PDF الآن. أعد المحاولة بعد تحديث الصفحة.");
    }
  }

  return <main className="gradebook-page grades-page" dir="rtl"><div className="gradebook-wrap"><section className="gradebook-card">
    <header className="gradebook-head"><div><h1>سجل رصد الدرجات — {unitInfo.label}</h1><p>{session.subject || "المادة"}{session.activeGradeLabel ? ` — ${session.activeGradeLabel}` : ""}. تظهر الفصول الرقمية المختارة فقط.</p></div><div className="gradebook-actions"><label>الفصل<select value={selectedClass} onChange={event => setSelectedClass(event.target.value)}><option value="">اختر الفصل</option>{classes.map(name => <option key={name}>{name}</option>)}</select></label><label>الوحدة<select value={selectedUnit} onChange={event => setSelectedUnit(event.target.value as typeof selectedUnit)}>{ACADEMIC_UNITS.map(unit => <option key={unit.key} value={unit.key}>{unit.label}</option>)}</select></label><button type="button" className="research-link" onClick={() => void downloadGradesPdf()}>📄 تحميل PDF</button><button type="button" className="research-link" onClick={exportExcel}>📊 Excel</button><Link href="/teacher/research" className="research-link">🔬 درجة البحث</Link><button type="button" className="save-button" onClick={saveRegister} disabled={!selectedClass || saving}>{saving ? "جارٍ الحفظ..." : "💾 حفظ الدرجات"}</button></div></header>
    <div className="gradebook-scroll"><table className="gradebook-table compact-five-table"><thead><tr><th className="sticky-number">م</th><th className="sticky-name">اسم الطالب</th>{columns.map(([key, label]) => <th key={key}><span>{label}</span><div className="header-score-control"><input value={GRADE_DISTRIBUTION[key]} readOnly/><button type="button" onClick={() => applyFullGrade(key)}>✓ الكل</button></div></th>)}<th>المجموع<small>من {UNIT_MAX}</small></th><th>الملاحظات</th><th>مسح</th></tr></thead><tbody>{classStudents.map((student, index) => { const row = grades[student.id] || emptyGrade; return <tr key={student.id}><td className="sticky-number">{index + 1}</td><td className="sticky-name"><strong>{student.name}</strong></td>{columns.map(([key]) => <td key={key}><div className="mobile-grade-control"><button type="button" className="grade-step minus" onClick={() => setGradeValue(student.id, key, Number(row[key] || 0) - 1)}>−</button><input className="grade-input" type="number" min="0" max={GRADE_DISTRIBUTION[key]} value={row[key]} onChange={event => setGradeValue(student.id, key, Number(event.target.value))}/><button type="button" className="grade-step plus" onClick={() => setGradeValue(student.id, key, Number(row[key] || 0) + 1)}>+</button></div></td>)}<td className="student-total">{calculateUnitTotal(row)}</td><td><input className="notes-input" value={row.notes || ""} onChange={event => setGrades(current => ({ ...current, [student.id]: { ...(current[student.id] || emptyGrade), notes: event.target.value } }))}/></td><td><button className="row-delete-button" type="button" onClick={() => setGrades(current => ({ ...current, [student.id]: { ...emptyGrade } }))}>مسح</button></td></tr>; })}{!classStudents.length && <tr><td colSpan={9} className="empty-row">{loading ? "جارٍ تحميل الطلاب..." : "لا يوجد طلاب في الفصل المختار."}</td></tr>}</tbody></table></div>
    <footer className="gradebook-footer"><span>المادة: {session.subject || "المادة"}</span><span>المرحلة: {session.activeGradeLabel || "جميع المراحل"}</span><span>الفصل: {selectedClass || "—"}</span><span>عدد الطلاب: {classStudents.length}</span></footer>{message && <p className="gradebook-message">{message}</p>}
  </section></div></main>;
}
