"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import "./reports.css";

type UnitRecord = { attendance?: number; participation?: number; homework?: number; unitExam?: number; total?: number };
type Student = { id: string; name?: string; class?: string; nationalId?: string; researchScore?: number; units?: Record<string, UnitRecord> };
type AttendanceDoc = { records?: Record<string, "present" | "absent" | "late" | "excused"> };

const units = [
  ["unit1", "الوحدة الأولى"], ["unit2", "الوحدة الثانية"], ["unit3", "الوحدة الثالثة"],
  ["unit4", "الوحدة الرابعة"], ["unit5", "الوحدة الخامسة"],
] as const;

function hijriToday() {
  return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-arab", {
    day: "numeric", month: "long", year: "numeric",
  }).format(new Date());
}

export default function ReportsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceDocs, setAttendanceDocs] = useState<AttendanceDoc[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");

  useEffect(() => onSnapshot(collection(db, "students"), snapshot => {
    const list = snapshot.docs.map(item => ({ id: item.id, ...item.data() })) as Student[];
    list.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"));
    setStudents(list);
  }), []);

  useEffect(() => onSnapshot(collection(db, "attendance"), snapshot => {
    setAttendanceDocs(snapshot.docs.map(item => item.data() as AttendanceDoc));
  }), []);

  const classes = useMemo(() => Array.from(new Set(students.map(student => (student.class || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ar")), [students]);
  const classStudents = useMemo(() => selectedClass ? students.filter(student => (student.class || "").trim() === selectedClass) : students, [students, selectedClass]);

  useEffect(() => {
    if (!classStudents.some(student => student.id === selectedStudent)) setSelectedStudent(classStudents[0]?.id || "");
  }, [classStudents, selectedStudent]);

  const student = classStudents.find(item => item.id === selectedStudent);
  const unitRows = useMemo(() => units.map(([key, label]) => {
    const record = student?.units?.[key] || {};
    const attendance = Number(record.attendance || 0);
    const participation = Number(record.participation || 0);
    const homework = Number(record.homework || 0);
    const unitExam = Number(record.unitExam || 0);
    const total = Number(record.total ?? attendance + participation + homework + unitExam);
    return { key, label, attendance, participation, homework, unitExam, total };
  }), [student]);

  const research = Number(student?.researchScore || 0);
  const finalTotal = unitRows.reduce((sum, unit) => sum + unit.total, 0) + research;
  const attendanceSummary = useMemo(() => {
    const result = { present: 0, absent: 0, late: 0, excused: 0 };
    if (!student) return result;
    attendanceDocs.forEach(document => {
      const status = document.records?.[student.id];
      if (status) result[status] += 1;
    });
    return result;
  }, [attendanceDocs, student]);

  const recordedDays = Object.values(attendanceSummary).reduce((sum, value) => sum + value, 0);
  const attendanceRate = recordedDays ? Math.round((attendanceSummary.present / recordedDays) * 100) : 0;
  const initial = (student?.name || "ط").trim().charAt(0);

  return (
    <main className="student-report-page" dir="rtl">
      <div className="student-report-wrap">
        <section className="report-selector-card">
          <div><h1>ملخص الطالب</h1><p>عرض شامل لدرجات الوحدات والبحث وسجل الحضور.</p></div>
          <div className="report-selectors">
            <label>الفصل<select value={selectedClass} onChange={event => setSelectedClass(event.target.value)}><option value="">جميع الفصول</option>{classes.map(className => <option key={className}>{className}</option>)}</select></label>
            <label>الطالب<select value={selectedStudent} onChange={event => setSelectedStudent(event.target.value)}><option value="">اختر الطالب</option>{classStudents.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          </div>
        </section>

        {!student ? <section className="report-empty">اختر طالبًا لعرض الملخص.</section> : <>
          <section className="student-hero-card">
            <div className="student-main-info"><div className="student-avatar">{initial}</div><div><small>اسم الطالب</small><h2>{student.name}</h2><p>{student.class || "غير محدد"} • السجل المدني: {student.nationalId || "—"}</p></div></div>
            <div className="final-score-box"><span>المجموع النهائي</span><strong>{finalTotal}</strong><small>من ١٠٠ درجة</small></div>
          </section>

          <section className="unit-score-grid">
            {unitRows.map(unit => <article key={unit.key}><span>{unit.label}</span><strong>{unit.total}</strong><small>من ١٩</small></article>)}
            <article className="research-score-card"><span>البحث</span><strong>{research}</strong><small>من ٥</small></article>
          </section>

          <section className="attendance-summary-grid">
            <article><span>أيام الغياب</span><strong>{attendanceSummary.absent}</strong><small>يوم</small></article>
            <article><span>مرات التأخر</span><strong>{attendanceSummary.late}</strong><small>مرة</small></article>
            <article><span>مرات الاستئذان</span><strong>{attendanceSummary.excused}</strong><small>مرة</small></article>
            <article><span>نسبة الحضور</span><strong>{attendanceRate}%</strong><small>من الأيام المسجلة</small></article>
          </section>

          <section className="unit-details-card print-grade-sheet">
            <header>
              <div><h2>كشف درجات الطالب</h2><p>الوحدات الخمس والبحث والمجموع النهائي.</p><small className="student-name-small">الطالب: {student.name}</small></div>
              <button className="print-sheet-button" type="button" onClick={() => window.print()}>🖨 طباعة كشف الدرجات</button>
            </header>

            <div className="print-sheet-heading">
              <h2>مدرسة التهذيب الثانوية</h2>
              <p>كشف درجات مادة التاريخ</p>
              <div><span><b>اسم الطالب:</b> {student.name}</span><span><b>السجل المدني:</b> {student.nationalId || "—"}</span><span><b>الفصل:</b> {student.class || "—"}</span><span><b>المعلم:</b> الأستاذ حسن علي الطويل</span><span><b>التاريخ:</b> {hijriToday()}</span></div>
            </div>

            <div className="unit-table-scroll">
              <table className="unit-details-table">
                <thead><tr><th>الوحدة</th><th>الحضور<br/><small>من ١</small></th><th>المشاركة<br/><small>من ٢</small></th><th>الواجبات<br/><small>من ٢</small></th><th>اختبار الوحدة<br/><small>من ١٤</small></th><th>مجموع الوحدة<br/><small>من ١٩</small></th></tr></thead>
                <tbody>{unitRows.map(unit => <tr key={unit.key}><td><strong>{unit.label}</strong></td><td>{unit.attendance}</td><td>{unit.participation}</td><td>{unit.homework}</td><td>{unit.unitExam}</td><td><b>{unit.total}</b></td></tr>)}</tbody>
                <tfoot><tr><td colSpan={5}>درجة البحث</td><td>{research} / ٥</td></tr><tr className="final-row"><td colSpan={5}>المجموع النهائي</td><td>{finalTotal} / ١٠٠</td></tr></tfoot>
              </table>
            </div>
            <div className="print-attendance-line">الغياب: {attendanceSummary.absent} يوم • التأخر: {attendanceSummary.late} • الاستئذان: {attendanceSummary.excused} • نسبة الحضور: {attendanceRate}%</div>
          </section>
        </>}
      </div>
    </main>
  );
}
