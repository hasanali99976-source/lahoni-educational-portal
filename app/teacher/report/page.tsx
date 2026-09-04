"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useTeacherClient } from "../../../lib/teacher-client";
import { tenantCollection } from "../../../lib/teacher-tenant";
import { calculateGradePlanResult, type GradeStudentLike } from "../../../lib/grade-plan";
import { useGradePlan } from "../../../lib/use-grade-plan";
import TeacherCompetitionProgress from "../competition-progress";
import "./report.css";

type Student = GradeStudentLike & { id: string; code: string; name: string; class: string; className: string; teacherNotes?: unknown[] };
type AttendanceStatus = "present" | "absent" | "late" | "excused" | "escaped";
type AttendanceRecord = { class?: string; date?: string; records?: Record<string, AttendanceStatus> };

const ar = (value: number) => new Intl.NumberFormat("ar-SA-u-nu-arab", { maximumFractionDigits: 1 }).format(Number.isFinite(value) ? value : 0);

export default function TeacherReportPage() {
  const session = useTeacherClient();
  const { activePlan } = useGradePlan(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!session?.subjectKey) return;
    const params = new URLSearchParams({ subjectId: session.subjectKey });
    if (session.activeGrade) params.set("grade", String(session.activeGrade));
    fetch(`/api/teacher/students?${params}`, { cache: "no-store" })
      .then(response => response.json().then(data => ({ ok: response.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.message || "تعذر تحميل الطلاب");
        const list = (Array.isArray(data.students) ? data.students : []).map((value: Record<string, unknown>) => {
          const code = String(value.code || value.id || "").trim().toUpperCase();
          const className = String(value.className || value.class || "").trim();
          return { ...(value as unknown as Student), id: code, code, name: String(value.name || "").trim(), class: className, className } as Student;
        }).filter((student: Student) => student.id && student.name && student.class);
        setStudents(list);
      })
      .catch(error => setMessage(error instanceof Error ? error.message : "تعذر تحميل الطلاب"));
  }, [session?.subjectKey, session?.activeGrade]);

  useEffect(() => {
    if (!session?.teacherId || !session?.subjectKey) return;
    const path = tenantCollection(session.teacherId, session.subjectKey as never, "attendance");
    return onSnapshot(collection(db, path), snapshot => setAttendance(snapshot.docs.map(doc => doc.data() as AttendanceRecord)), () => setAttendance([]));
  }, [session?.teacherId, session?.subjectKey]);

  const classes = useMemo(() => [...new Set(students.map(student => student.class).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ar", { numeric: true })), [students]);

  useEffect(() => {
    if (!classes.length) { setSelectedClasses([]); return; }
    setSelectedClasses(current => current.length ? current.filter(item => classes.includes(item)) : classes);
  }, [classes.join("|")]);

  const analyses = useMemo(() => students.map(student => {
    const result = activePlan ? calculateGradePlanResult(activePlan, student) : null;
    const average = result ? Math.round(result.percentage) : 0;
    const statuses = attendance.map(record => record.records?.[student.id]).filter(Boolean);
    const absent = statuses.filter(status => status === "absent" || status === "escaped").length;
    const late = statuses.filter(status => status === "late").length;
    const noteCount = Array.isArray(student.teacherNotes) ? student.teacherNotes.length : 0;
    return { ...student, average, absent, late, noteCount, completion: result?.completion || 0 };
  }), [students, attendance, activePlan]);

  const selected = useMemo(() => analyses.filter(student => selectedClasses.includes(student.class)), [analyses, selectedClasses]);
  const classStats = useMemo(() => selectedClasses.map(name => {
    const rows = analyses.filter(student => student.class === name);
    const graded = rows.filter(student => student.average > 0);
    return {
      name,
      count: rows.length,
      average: graded.length ? Math.round(graded.reduce((sum, student) => sum + student.average, 0) / graded.length) : 0,
      support: rows.filter(student => student.average > 0 && student.average < 60).length,
      excellent: rows.filter(student => student.average >= 90).length,
      absences: rows.reduce((sum, student) => sum + student.absent, 0),
      notes: rows.reduce((sum, student) => sum + student.noteCount, 0),
    };
  }), [analyses, selectedClasses]);

  const gradedSelected = selected.filter(student => student.average > 0);
  const overall = gradedSelected.length ? Math.round(gradedSelected.reduce((sum, student) => sum + student.average, 0) / gradedSelected.length) : 0;
  const support = selected.filter(student => student.average > 0 && student.average < 60).length;
  const excellent = selected.filter(student => student.average >= 90).length;
  const totalNotes = selected.reduce((sum, student) => sum + student.noteCount, 0);

  function toggleClass(name: string) {
    setSelectedClasses(current => current.includes(name) ? current.filter(item => item !== name) : [...current, name]);
  }

  function exportExcel() {
    if (!selected.length) return setMessage("اختر فصلًا واحدًا على الأقل.");
    const workbook = XLSX.utils.book_new();
    selectedClasses.forEach(className => {
      const rows = selected.filter(student => student.class === className).map((student, index) => ({
        م: index + 1,
        "اسم الطالب": student.name,
        "الفصل": student.class,
        "التحصيل %": student.average,
        "الغياب": student.absent,
        "التأخر": student.late,
        "الملاحظات": student.noteCount,
      }));
      const sheet = XLSX.utils.json_to_sheet(rows);
      sheet["!cols"] = [{ wch: 6 }, { wch: 32 }, { wch: 18 }, { wch: 13 }, { wch: 10 }, { wch: 10 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(workbook, sheet, className.slice(0, 31));
    });
    XLSX.writeFile(workbook, `تقرير-${session?.subject || "المادة"}-${session?.activeGradeLabel || "الفصول"}.xlsx`);
  }

  async function exportPdf() {
    const report = document.getElementById("teacher-report-print");
    if (!report || !selectedClasses.length) return setMessage("اختر فصلًا واحدًا على الأقل.");
    setBusy(true); setMessage("");
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(report, { scale: 1.7, backgroundColor: "#ffffff", useCORS: true });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = 210, pageH = 297, margin = 7, usableW = pageW - margin * 2, usableH = pageH - margin * 2;
      const imgW = usableW;
      const imgH = canvas.height * imgW / canvas.width;
      const data = canvas.toDataURL("image/png");
      const pages = Math.max(1, Math.ceil(imgH / usableH));
      for (let page = 0; page < pages; page++) {
        if (page) pdf.addPage();
        pdf.addImage(data, "PNG", margin, margin - page * usableH, imgW, imgH);
      }
      pdf.save(`ملخص-عمل-${session?.teacherName || "المعلم"}.pdf`);
    } catch { setMessage("تعذر إنشاء التقرير PDF الآن."); }
    finally { setBusy(false); }
  }

  return <main className="teacher-report-workspace" dir="rtl">
    <header className="teacher-report-hero"><div><small>ملخص عمل المعلم</small><h1>تقرير تعليمي متكامل</h1><p>اختر فصلًا أو عدة فصول، وشاهد التحصيل والمتابعة والملاحظات في تقرير واحد قابل للطباعة أو Excel.</p></div><TeacherCompetitionProgress/></header>

    {message ? <div className="teacher-report-message">{message}</div> : null}

    <section className="teacher-report-toolbar"><div><b>الفصول داخل التقرير</b><div className="teacher-report-classes">{classes.map(name => <button type="button" key={name} className={selectedClasses.includes(name) ? "active" : ""} onClick={() => toggleClass(name)}>{name}</button>)}</div></div><div className="teacher-report-actions"><button type="button" onClick={exportExcel}>Excel</button><button type="button" className="primary" disabled={busy} onClick={() => void exportPdf()}>{busy ? "جارٍ التجهيز…" : "PDF"}</button></div></section>

    <section id="teacher-report-print" className="teacher-report-print">
      <header className="teacher-report-print-head"><div><small>بوابة أستاذ لحوني التعليمية</small><h2>{session?.subject || "المادة"} — {session?.activeGradeLabel || ""}</h2><p>المعلم: {session?.teacherName || "المعلم"} • الفصول المختارة: {selectedClasses.join("، ") || "—"}</p></div><img src="/icons/lahooni-identity-320.jpg" alt="هوية البوابة"/></header>

      <section className="teacher-report-kpis"><article><small>الطلاب</small><b>{ar(selected.length)}</b></article><article><small>متوسط التحصيل</small><b>{ar(overall)}٪</b></article><article><small>متميزون</small><b>{ar(excellent)}</b></article><article><small>يحتاجون دعمًا</small><b>{ar(support)}</b></article><article><small>الملاحظات</small><b>{ar(totalNotes)}</b></article></section>

      <section className="teacher-report-chart"><header><h3>المقارنة البيانية بين الفصول</h3><small>متوسط التحصيل العلمي</small></header><div>{classStats.map((item, index) => <article key={item.name} className={`class-tone-${index % 5}`}><span><b>{item.name}</b><small>{ar(item.count)} طالب</small></span><i><u style={{ width: `${item.average}%` }}/></i><strong>{ar(item.average)}٪</strong></article>)}</div></section>

      <section className="teacher-report-class-grid">{classStats.map((item, index) => <article key={item.name} className={`teacher-report-class class-tone-${index % 5}`}><header><h3>{item.name}</h3><span>{ar(item.average)}٪</span></header><div><span><b>{ar(item.count)}</b><small>طالب</small></span><span><b>{ar(item.excellent)}</b><small>متميز</small></span><span><b>{ar(item.support)}</b><small>يحتاج دعمًا</small></span><span><b>{ar(item.absences)}</b><small>غياب</small></span><span><b>{ar(item.notes)}</b><small>ملاحظة</small></span></div></article>)}</section>

      <section className="teacher-report-table"><div className="head"><span>م</span><span>اسم الطالب</span><span>الفصل</span><span>التحصيل</span><span>الغياب</span><span>ملاحظات</span></div>{selected.map((student, index) => <div className="row" key={student.id}><span>{ar(index + 1)}</span><strong>{student.name}</strong><span>{student.class}</span><span>{ar(student.average)}٪</span><span>{ar(student.absent)}</span><span>{ar(student.noteCount)}</span></div>)}</section>
    </section>
  </main>;
}
