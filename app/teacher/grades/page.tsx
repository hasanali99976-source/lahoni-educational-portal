"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { doc, setDoc } from "firebase/firestore";
import * as XLSX from "xlsx";
import { db } from "../../../lib/firebase";
import { useTeacherClient } from "../../../lib/teacher-client";
import { type ClientTenant, tenantStudentsPath } from "../../../lib/firestore-tenant-client";
import {
  GRADE_PLAN_MODE_LABELS,
  calculateGradePlanResult,
  gradeEntryKey,
  readGradeEntry,
  roundGrade,
  type GradePlanItem,
  type GradeStudentLike,
  type GradeValueMap,
} from "../../../lib/grade-plan";
import { useGradePlan } from "../../../lib/use-grade-plan";
import { downloadGradebookPdfDocument, type GradebookPdfClass } from "../../../lib/grades-pdf";
import "./register.css";
import "./dynamic-gradebook.css";

type LegacyUnit = Record<string, unknown>;
type Student = GradeStudentLike & {
  id: string;
  code: string;
  name: string;
  class: string;
  className: string;
  gradeValues?: GradeValueMap;
  gradePlanValues?: Record<string, GradeValueMap>;
  activeGradePlanId?: string;
  gradePlanSnapshot?: Record<string, unknown>;
  units?: Record<string, LegacyUnit>;
  notes?: string;
};

type LocalValues = Record<string, GradeValueMap>;

function clamp(value: number, maximum: number) {
  const number = Number.isFinite(value) ? value : 0;
  return roundGrade(Math.max(0, Math.min(maximum, number)));
}

export default function GradesPage() {
  const session = useTeacherClient();
  const { activePlan, loading: planLoading, error: planError } = useGradePlan(true);
  const tenant = useMemo<ClientTenant | null>(() => session.teacherId && session.subjectKey ? {
    teacherId: session.teacherId,
    teacherName: session.teacherName || "",
    subjectKey: session.subjectKey as never,
  } : null, [session.teacherId, session.teacherName, session.subjectKey]);

  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [localValues, setLocalValues] = useState<LocalValues>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [allPdfBusy, setAllPdfBusy] = useState(false);

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
              gradeValues: value.gradeValues && typeof value.gradeValues === "object" ? value.gradeValues as GradeValueMap : {},
            };
          })
          .filter((student: Student) => Boolean(student.id && student.name && student.class));
        list.sort((a, b) => a.class.localeCompare(b.class, "ar", { numeric: true }) || a.name.localeCompare(b.name, "ar"));
        setStudents(list);
      })
      .catch(error => {
        if ((error as Error)?.name !== "AbortError") setMessage(error instanceof Error ? error.message : "تعذر تحميل طلاب المادة الحالية");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [tenant, session.activeGrade]);

  const classes = useMemo(() => [...new Set(students.map(student => student.class))].sort((a, b) => a.localeCompare(b, "ar", { numeric: true })), [students]);
  const classStudents = useMemo(() => students.filter(student => student.class === selectedClass), [students, selectedClass]);
  const section = useMemo(() => activePlan?.sections.find(item => item.id === selectedSection) || activePlan?.sections[0] || null, [activePlan, selectedSection]);

  useEffect(() => {
    if (!classes.length) { setSelectedClass(""); return; }
    if (!selectedClass || !classes.includes(selectedClass)) setSelectedClass(classes[0]);
  }, [classes, selectedClass]);

  useEffect(() => {
    if (!activePlan?.sections.length) { setSelectedSection(""); return; }
    if (!selectedSection || !activePlan.sections.some(item => item.id === selectedSection)) setSelectedSection(activePlan.sections[0].id);
  }, [activePlan, selectedSection]);

  useEffect(() => {
    if (!tenant || !activePlan || !students.length || typeof window === "undefined") return;
    const needsSync = students.filter(student => {
      const snapshotId = String(student.gradePlanSnapshot?.id || "");
      return student.activeGradePlanId !== activePlan.id || snapshotId !== activePlan.id;
    });
    if (!needsSync.length) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const now = new Date().toISOString();
      try {
        for (let index = 0; index < needsSync.length && !cancelled; index += 40) {
          await Promise.all(needsSync.slice(index, index + 40).map(student => setDoc(
            doc(db, tenantStudentsPath(tenant), student.id),
            {
              name: student.name,
              class: student.class,
              className: student.class,
              code: student.code,
              active: true,
              rosterActive: true,
              activeGradePlanId: activePlan.id,
              activeGradePlanVersion: activePlan.version,
              gradePlanSnapshot: activePlan,
              gradePlanSyncedAt: now,
              teacherId: tenant.teacherId,
              subjectKey: tenant.subjectKey,
            },
            { merge: true },
          )));
        }
      } catch (syncError) {
        console.warn("grade-plan-student-sync-v99", syncError);
      }
    }, 700);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [tenant, activePlan?.id, activePlan?.version, students]);

  useEffect(() => {
    if (!section) { setLocalValues({}); return; }
    const next: LocalValues = {};
    classStudents.forEach(student => {
      const row: GradeValueMap = {};
      section.items.forEach(item => {
        const entry = readGradeEntry(studentForPlan(student), section, item);
        row[entry.key] = clamp(entry.value, item.max);
      });
      next[student.id] = row;
    });
    setLocalValues(next);
  }, [classStudents, section?.id, activePlan?.id]);

  function itemKey(item: GradePlanItem) {
    return section ? gradeEntryKey(section.id, item.id) : "";
  }
  function valuesForPlan(student: Student) {
    if (!activePlan) return student.gradeValues || {};
    return student.gradePlanValues?.[activePlan.id] || student.gradeValues || {};
  }

  function studentForPlan(student: Student) {
    return { ...student, gradeValues: valuesForPlan(student) };
  }


  function setGradeValue(studentId: string, item: GradePlanItem, value: number) {
    const key = itemKey(item);
    setLocalValues(current => ({ ...current, [studentId]: { ...(current[studentId] || {}), [key]: clamp(value, item.max) } }));
  }

  function applyFullGrade(item: GradePlanItem) {
    const key = itemKey(item);
    setLocalValues(current => {
      const next = { ...current };
      classStudents.forEach(student => { next[student.id] = { ...(next[student.id] || {}), [key]: item.max }; });
      return next;
    });
  }

  function clearRow(studentId: string) {
    if (!section) return;
    setLocalValues(current => {
      const row = { ...(current[studentId] || {}) };
      section.items.forEach(item => { row[itemKey(item)] = 0; });
      return { ...current, [studentId]: row };
    });
  }

  function effectiveStudent(student: Student) {
    return { ...student, gradeValues: { ...valuesForPlan(student), ...(localValues[student.id] || {}) } };
  }

  function sectionTotal(student: Student) {
    if (!activePlan || !section) return 0;
    return calculateGradePlanResult(activePlan, effectiveStudent(student)).sections.find(item => item.id === section.id)?.earned || 0;
  }

  async function saveRegister() {
    if (!tenant || !selectedClass || !activePlan || !section) return setMessage("اختر الفصل أولًا");
    setSaving(true);
    try {
      const now = new Date().toISOString();
      await Promise.all(classStudents.map(student => {
        const mergedValues = { ...valuesForPlan(student), ...(localValues[student.id] || {}) };
        return setDoc(doc(db, tenantStudentsPath(tenant), student.id), {
          name: student.name,
          class: student.class,
          className: student.class,
          code: student.code,
          active: true,
          rosterActive: true,
          gradeValues: mergedValues,
          gradePlanValues: { ...(student.gradePlanValues || {}), [activePlan.id]: mergedValues },
          activeGradePlanId: activePlan.id,
          activeGradePlanVersion: activePlan.version,
          gradePlanSnapshot: activePlan,
          gradePlanSyncedAt: now,
          gradePlanUpdatedAt: now,
          teacherId: tenant.teacherId,
          subjectKey: tenant.subjectKey,
        }, { merge: true });
      }));
      setStudents(current => current.map(student => classStudents.some(item => item.id === student.id)
        ? { ...student, gradeValues: { ...valuesForPlan(student), ...(localValues[student.id] || {}) }, gradePlanValues: { ...(student.gradePlanValues || {}), [activePlan.id]: { ...valuesForPlan(student), ...(localValues[student.id] || {}) } }, activeGradePlanId: activePlan.id, gradePlanSnapshot: activePlan as unknown as Record<string, unknown> }
        : student));
      setMessage(`تم حفظ درجات ${section.label} بدون تغيير أو حذف أي بيانات قديمة.`);
    } catch (error) {
      console.error("dynamic-gradebook-save", error);
      setMessage("تعذر حفظ الدرجات الآن.");
    } finally {
      setSaving(false);
    }
  }

  function exportExcel() {
    if (!activePlan || !section || !classStudents.length) return setMessage("اختر فصلًا يحتوي على طلاب أولًا");
    const rows = classStudents.map((student, index) => {
      const source = effectiveStudent(student);
      const sectionResult = calculateGradePlanResult(activePlan, source).sections.find(item => item.id === section.id);
      const row: Record<string, string | number> = { "م": index + 1, "اسم الطالب": student.name, "الفصل": student.class };
      section.items.forEach(item => {
        row[`${item.label} (من ${item.max})`] = readGradeEntry(source, section, item).value;
      });
      row[`المجموع (من ${section.max})`] = sectionResult?.earned || 0;
      row["نسبة الخطة الحالية"] = calculateGradePlanResult(activePlan, source).percentage;
      return row;
    });
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet["!cols"] = Object.keys(rows[0] || {}).map((key, index) => ({ wch: index === 1 ? 30 : Math.max(12, Math.min(24, key.length + 3)) }));
    XLSX.utils.book_append_sheet(workbook, sheet, section.label.slice(0, 28) || "الدرجات");
    XLSX.writeFile(workbook, `درجات-${selectedClass}-${section.label}.xlsx`);
  }


  function buildPdfClass(className: string): GradebookPdfClass | null {
    if (!activePlan) return null;
    const roster = students
      .filter(student => student.class === className)
      .sort((a, b) => a.name.localeCompare(b.name, "ar"));
    if (!roster.length) return null;

    const sections = activePlan.sections.map(planSection => ({
      id: planSection.id,
      label: planSection.label,
      max: planSection.max,
      columns: planSection.items.map(item => ({ id: item.id, label: item.label, max: item.max })),
      rows: roster.map((student, index) => {
        const source = className === selectedClass ? effectiveStudent(student) : studentForPlan(student);
        const result = calculateGradePlanResult(activePlan, source);
        const sectionResult = result.sections.find(item => item.id === planSection.id);
        return {
          number: index + 1,
          name: student.name,
          values: planSection.items.map(item => readGradeEntry(source, planSection, item).value),
          sectionTotal: sectionResult?.earned || 0,
          overallTotal: result.earned,
          percentage: result.percentage,
        };
      }),
    }));

    return { className, sections };
  }

  async function downloadCurrentClassGradesPdf() {
    if (!activePlan || !selectedClass) return setMessage("اختر الفصل أولًا.");
    const report = buildPdfClass(selectedClass);
    if (!report) return setMessage("لا توجد أسماء طلاب في الفصل المحدد.");
    setPdfBusy(true);
    setMessage(`جارٍ تجهيز PDF كامل لدرجات ${selectedClass}...`);
    try {
      const result = await downloadGradebookPdfDocument({
        portalName: "بوابة أستاذ لحوني التعليمية",
        teacherName: session.teacherName || "المعلم",
        subject: session.subject || "المادة",
        gradeLabel: session.activeGradeLabel || "",
        planLabel: GRADE_PLAN_MODE_LABELS[activePlan.mode],
        planVersion: activePlan.version,
        classes: [report],
        fileName: `درجات-${selectedClass.replace(/[\\/:*?"<>|]/g, "-")}-كامل.pdf`,
      });
      setMessage(`تم إنشاء PDF كامل للفصل: ${result.studentCount} طالبًا في ${result.pageCount} صفحة.`);
    } catch (error) {
      console.error("gradebook-class-pdf-v98", error);
      setMessage("تعذر إنشاء PDF درجات الفصل الآن.");
    } finally {
      setPdfBusy(false);
    }
  }

  async function downloadAllClassesGradesPdf() {
    if (!activePlan || !classes.length) return setMessage("لا توجد فصول متاحة للطباعة.");
    setAllPdfBusy(true);
    setMessage("جارٍ جلب جميع الدرجات وتجهيز PDF لكل الفصول...");
    try {
      const reports = classes.map(buildPdfClass).filter((item): item is GradebookPdfClass => !!item);
      if (!reports.length) throw new Error("gradebook_all_pdf_no_students");
      const result = await downloadGradebookPdfDocument({
        portalName: "بوابة أستاذ لحوني التعليمية",
        teacherName: session.teacherName || "المعلم",
        subject: session.subject || "المادة",
        gradeLabel: session.activeGradeLabel || "",
        planLabel: GRADE_PLAN_MODE_LABELS[activePlan.mode],
        planVersion: activePlan.version,
        classes: reports,
        fileName: `جميع-الدرجات-${(session.subject || "المادة").replace(/[\\/:*?"<>|]/g, "-")}.pdf`,
      });
      setMessage(`تم إنشاء PDF جميع الدرجات: ${result.classCount} فصل، ${result.studentCount} طالبًا، ${result.pageCount} صفحة.`);
    } catch (error) {
      console.error("gradebook-all-pdf-v98", error);
      setMessage("تعذر إنشاء PDF جميع الدرجات الآن.");
    } finally {
      setAllPdfBusy(false);
    }
  }

  if (planLoading) return <main className="gradebook-page" dir="rtl"><section className="grade-plan-required">جارٍ تحميل خطة توزيع الدرجات…</section></main>;
  if (!activePlan) return <main className="gradebook-page" dir="rtl"><section className="grade-plan-required"><span>إعداد مطلوب</span><h1>اختر طريقة توزيع الـ100 درجة أولًا</h1><p>صفحة الرصد لا تستخدم توزيعًا ثابتًا بعد الآن. يجب اعتماد خطة توزيع درجات للمعلم قبل بدء الرصد الجديد.</p>{planError && <small>{planError}</small>}<Link href="/teacher/grade-plan">إعداد توزيع الدرجات</Link></section></main>;

  return <main className="gradebook-page grades-page dynamic-gradebook-page" dir="rtl"><div className="gradebook-wrap"><section className="gradebook-card">
    <header className="gradebook-head dynamic-gradebook-head"><div><span className="active-plan-badge">الخطة المعتمدة — نسخة {activePlan.version}</span><h1>سجل رصد الدرجات — {section?.label || ""}</h1><p>{session.subject || "المادة"}{session.activeGradeLabel ? ` — ${session.activeGradeLabel}` : ""} • {GRADE_PLAN_MODE_LABELS[activePlan.mode]}</p></div><div className="gradebook-actions"><label>الفصل<select value={selectedClass} onChange={event => setSelectedClass(event.target.value)}><option value="">اختر الفصل</option>{classes.map(name => <option key={name}>{name}</option>)}</select></label>{activePlan.sections.length > 1 && <label>{activePlan.mode === "units" ? "الوحدة" : "الفترة"}<select value={selectedSection} onChange={event => setSelectedSection(event.target.value)}>{activePlan.sections.map(item => <option key={item.id} value={item.id}>{item.label} — {item.max}</option>)}</select></label>}<button type="button" className="research-link" onClick={exportExcel}>📊 Excel</button><button type="button" className="research-link" onClick={() => void downloadCurrentClassGradesPdf()} disabled={!selectedClass || pdfBusy}>{pdfBusy ? "جارٍ إنشاء PDF..." : "📄 PDF الفصل كامل"}</button><button type="button" className="research-link" onClick={() => void downloadAllClassesGradesPdf()} disabled={allPdfBusy}>{allPdfBusy ? "جارٍ جلب الجميع..." : "📚 جميع الدرجات PDF"}</button><button type="button" className="save-button" onClick={() => void saveRegister()} disabled={!selectedClass || saving}>{saving ? "جارٍ الحفظ..." : "💾 حفظ الدرجات"}</button></div></header>
    <div className="approved-plan-readonly"><b>{section?.label}</b><span>درجة القسم: {section?.max}</span><small>توزيع الخطة هنا للقراءة فقط؛ لا توجد خانات لتعديل الخطة داخل صفحة الرصد.</small></div>
    <div className="gradebook-scroll"><table className="gradebook-table dynamic-grade-table"><thead><tr><th className="sticky-number">م</th><th className="sticky-name">اسم الطالب</th>{section?.items.map(item => <th key={item.id}><span>{item.label}</span><small>من {item.max}</small><div className="header-score-control"><input value={item.max} readOnly/><button type="button" onClick={() => applyFullGrade(item)}>✓ الكل</button></div></th>)}<th>مجموع القسم<small>من {section?.max}</small></th><th>المجموع الحالي<small>من 100</small></th><th>مسح القسم</th></tr></thead><tbody>{classStudents.map((student, index) => {
      const source = effectiveStudent(student);
      const result = calculateGradePlanResult(activePlan, source);
      return <tr key={student.id}><td className="sticky-number">{index + 1}</td><td className="sticky-name"><strong>{student.name}</strong><small>{result.completion}% من الخطة تم رصده</small></td>{section?.items.map(item => { const key = itemKey(item); const value = localValues[student.id]?.[key] ?? readGradeEntry(student, section, item).value; return <td key={item.id}><div className="mobile-grade-control"><button type="button" className="grade-step minus" onClick={() => setGradeValue(student.id, item, Number(value || 0) - 1)}>−</button><input className="grade-input" type="number" min="0" max={item.max} step="0.5" value={value} onChange={event => setGradeValue(student.id, item, Number(event.target.value))}/><button type="button" className="grade-step plus" onClick={() => setGradeValue(student.id, item, Number(value || 0) + 1)}>+</button></div></td>; })}<td className="student-total">{sectionTotal(student)}</td><td className="student-total overall-total">{result.earned}<small>{result.complete ? "مكتمل" : `${result.completion}% رصد`}</small></td><td><button className="row-delete-button" type="button" onClick={() => clearRow(student.id)}>مسح</button></td></tr>;
    })}{!classStudents.length && <tr><td colSpan={(section?.items.length || 0) + 5} className="empty-row">{loading ? "جارٍ تحميل الطلاب..." : "لا يوجد طلاب في الفصل المختار."}</td></tr>}</tbody></table></div>
    <footer className="gradebook-footer"><span>المادة: {session.subject || "المادة"}</span><span>الخطة: {GRADE_PLAN_MODE_LABELS[activePlan.mode]}</span><span>الإصدار: {activePlan.version}</span><span>الفصل: {selectedClass || "—"}</span><span>عدد الطلاب: {classStudents.length}</span></footer>{message && <p className="gradebook-message">{message}</p>}
  </section></div></main>;
}
