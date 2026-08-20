"use client";

import "./dashboard.css";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { tenantCollection } from "../../../lib/teacher-tenant";
import { useTeacherClient } from "../../../lib/teacher-client";

type UnitGrade = { percentage?: number; total?: number; attendance?: number; participation?: number; homework?: number; unitExam?: number; exam1?: number; exam2?: number };
type Student = { id: string; name?: string; class?: string; research?: number; researchScore?: number; units?: Record<string, UnitGrade> };
type AttendanceRecord = { records?: Record<string, "present" | "absent" | "late" | "excused" | "escaped"> };
type Scope = "all" | "class" | "student";

const dimensions = [
  ["attendance", "الحضور"],
  ["participation", "المشاركة"],
  ["homework", "الواجبات"],
  ["unitExam", "الاختبارات"],
] as const;

function level(score: number) {
  if (score >= 90) return { label: "متميز", className: "excellent", advice: "أداء مرتفع ومستقر. استمر في مهام الإثراء والتحدي." };
  if (score >= 75) return { label: "جيد جدًا", className: "good", advice: "أداء جيد، ويستفيد من تعزيز المهارات الأقل في المقارنة." };
  if (score >= 60) return { label: "مقبول", className: "average", advice: "يحتاج متابعة قصيرة وخطة مراجعة منتظمة." };
  if (score > 0) return { label: "يحتاج دعمًا", className: "low", advice: "يُنصح بخطة علاجية تبدأ بأقل عناصر الأداء." };
  return { label: "لم يبدأ الرصد", className: "unrated", advice: "لا توجد درجات كافية للتحليل حتى الآن." };
}

export default function TeacherDashboardPage() {
  const session = useTeacherClient();
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [scope, setScope] = useState<Scope>("all");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!session?.teacherId || !session?.subjectKey) { setMessage("انتهت الجلسة. سجّل الدخول من جديد."); return; }
    const studentsPath = tenantCollection(session.teacherId, session.subjectKey as any, "students");
    const attendancePath = tenantCollection(session.teacherId, session.subjectKey as any, "attendance");
    const stopStudents = onSnapshot(collection(db, studentsPath), snap => setStudents(snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as Omit<Student, "id">) }))), () => setMessage("تعذر تحميل بيانات الطلاب"));
    const stopAttendance = onSnapshot(collection(db, attendancePath), snap => setAttendance(snap.docs.map(doc => doc.data() as AttendanceRecord)), () => setAttendance([]));
    return () => { stopStudents(); stopAttendance(); };
  }, [session?.teacherId, session?.subjectKey]);

  const classes = useMemo(() => [...new Set(students.map(student => (student.class || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ar")), [students]);
  const availableStudents = useMemo(() => students.filter(student => !selectedClass || (student.class || "").trim() === selectedClass).sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar")), [students, selectedClass]);

  const analyses = useMemo(() => students.map(student => {
    const units = Object.values(student.units || {});
    const percentages = units.map(unit => Number(unit.percentage || 0)).filter(value => value > 0);
    const dimensionScores = Object.fromEntries(dimensions.map(([key]) => {
      const maximum = key === "attendance" ? 3 : key === "participation" ? 4 : key === "homework" ? 2 : 10;
      const values = units.map(unit => Number(key === "unitExam" ? unit.unitExam ?? unit.exam1 ?? unit.exam2 ?? 0 : unit[key] || 0));
      return [key, values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / (values.length * maximum) * 100) : 0];
    }));
    const statuses = attendance.map(day => day.records?.[student.id]).filter(Boolean);
    const absence = statuses.filter(status => status === "absent" || status === "escaped").length;
    const late = statuses.filter(status => status === "late").length;
    const present = statuses.filter(status => status === "present").length;
    const average = percentages.length ? Math.round(percentages.reduce((sum, value) => sum + value, 0) / percentages.length) : 0;
    return { ...student, average, ratedUnits: percentages.length, dimensionScores, absence, late, present, level: level(average) };
  }), [students, attendance]);

  const filtered = useMemo(() => analyses.filter(student => {
    if (scope === "class") return !!selectedClass && (student.class || "").trim() === selectedClass;
    if (scope === "student") return student.id === selectedStudent;
    return true;
  }), [analyses, scope, selectedClass, selectedStudent]);

  const rated = filtered.filter(student => student.ratedUnits > 0);
  const overall = rated.length ? Math.round(rated.reduce((sum, student) => sum + student.average, 0) / rated.length) : 0;
  const excellent = filtered.filter(student => student.average >= 90).length;
  const needsSupport = filtered.filter(student => student.ratedUnits > 0 && student.average < 60).length;
  const absences = filtered.reduce((sum, student) => sum + student.absence, 0);
  const lates = filtered.reduce((sum, student) => sum + student.late, 0);
  const dimensionAverages = dimensions.map(([key, label]) => ({ key, label, value: rated.length ? Math.round(rated.reduce((sum, student) => sum + Number(student.dimensionScores[key] || 0), 0) / rated.length) : 0 }));
  const strongest = [...dimensionAverages].sort((a, b) => b.value - a.value)[0];
  const weakest = [...dimensionAverages].sort((a, b) => a.value - b.value)[0];
  const selectedAnalysis = scope === "student" ? filtered[0] : undefined;
  const classAnalyses = useMemo(() => classes.map(className => {
    const classStudents = analyses.filter(student => (student.class || "").trim() === className);
    const classRated = classStudents.filter(student => student.ratedUnits > 0);
    const average = classRated.length ? Math.round(classRated.reduce((sum, student) => sum + student.average, 0) / classRated.length) : 0;
    const dimensionScores = Object.fromEntries(dimensions.map(([key]) => [key, classRated.length ? Math.round(classRated.reduce((sum, student) => sum + Number(student.dimensionScores[key] || 0), 0) / classRated.length) : 0]));
    return { name: className, count: classStudents.length, average, dimensionScores, absence: classStudents.reduce((sum, student) => sum + student.absence, 0), late: classStudents.reduce((sum, student) => sum + student.late, 0), excellent: classStudents.filter(student => student.average >= 90).length, needsSupport: classStudents.filter(student => student.ratedUnits > 0 && student.average < 60).length, level: level(average) };
  }).sort((a, b) => b.average - a.average), [classes, analyses]);
  const subject = session?.subject || "المادة";

  function changeScope(next: Scope) {
    setScope(next);
    if (next === "all") { setSelectedClass(""); setSelectedStudent(""); }
    if (next === "class") setSelectedStudent("");
  }

  return <main className="analytics-dashboard" dir="rtl">
    <section className="analytics-heading"><div><span>التحليل الذكي لأداء الطلاب</span><h1>لوحة تحليل {subject}</h1><p>قارن جميع الفصول، أو حلّل فصلًا معينًا، أو اعرض أداء طالب معين.</p></div><div className="analysis-scope" role="group" aria-label="نطاق التحليل"><button className={scope === "all" ? "active" : ""} onClick={() => changeScope("all")}>جميع الفصول</button><button className={scope === "class" ? "active" : ""} onClick={() => changeScope("class")}>فصل معين</button><button className={scope === "student" ? "active" : ""} onClick={() => changeScope("student")}>طالب معين</button></div></section>
    <section className="analytics-filters">
      {scope !== "all" ? <label><span>اختيار الفصل</span><select value={selectedClass} onChange={event => { setSelectedClass(event.target.value); setSelectedStudent(""); }}><option value="">اختر الفصل</option>{classes.map(name => <option key={name}>{name}</option>)}</select></label> : null}
      {scope === "student" ? <label><span>اختيار الطالب</span><select value={selectedStudent} onChange={event => setSelectedStudent(event.target.value)}><option value="">اختر الطالب</option>{availableStudents.map(student => <option key={student.id} value={student.id}>{student.name} — {student.class || "بدون فصل"}</option>)}</select></label> : null}
      <div className="analysis-current"><small>التحليل الحالي</small><strong>{scope === "all" ? `مقارنة جميع الفصول (${classes.length})` : scope === "class" ? selectedClass || "اختر فصلًا" : selectedAnalysis?.name || "اختر طالبًا"}</strong></div>
    </section>
    {message ? <p className="smart-message">{message}</p> : null}
    <section className="analytics-stats"><article><small>الطلاب المشمولون</small><b>{filtered.length}</b><span>{rated.length} لديهم درجات مرصودة</span></article><article><small>متوسط الأداء</small><b>{overall}%</b><span>{level(overall).label}</span></article><article className="positive"><small>الطلاب المتميزون</small><b>{excellent}</b><span>متوسط ٩٠٪ فأعلى</span></article><article className="warning"><small>يحتاجون دعمًا</small><b>{needsSupport}</b><span>أقل من ٦٠٪</span></article><article><small>الغياب المسجل</small><b>{absences}</b><span>غياب أو هروب</span></article><article><small>التأخر المسجل</small><b>{lates}</b><span>حالات التأخر</span></article></section>
    <section className="analytics-grid"><article className="analysis-card dimensions-card"><header><div><h2>مقارنة عناصر الأداء</h2><p>الفروقات بين الحضور والمشاركة والواجبات والاختبارات</p></div></header><div className="dimension-bars">{dimensionAverages.map(item => <div key={item.key}><span><b>{item.label}</b><em>{item.value}%</em></span><i><u style={{ width: `${item.value}%` }}/></i></div>)}</div><footer><span>نقطة القوة: <b>{strongest?.label || "—"}</b></span><span>الأولوية للتحسين: <b>{weakest?.label || "—"}</b></span></footer></article><article className="analysis-card insight-card"><span className="ai-label">AI تحليل ذكي</span><h2>{selectedAnalysis ? `تحليل ${selectedAnalysis.name}` : "قراءة المجموعة الحالية"}</h2><strong className={level(selectedAnalysis?.average ?? overall).className}>{level(selectedAnalysis?.average ?? overall).label}</strong><p>{level(selectedAnalysis?.average ?? overall).advice}</p><dl><div><dt>المتوسط</dt><dd>{selectedAnalysis?.average ?? overall}%</dd></div><div><dt>الوحدات المرصودة</dt><dd>{selectedAnalysis?.ratedUnits ?? rated.reduce((sum, student) => sum + student.ratedUnits, 0)}</dd></div><div><dt>الغياب</dt><dd>{selectedAnalysis?.absence ?? absences}</dd></div><div><dt>التأخر</dt><dd>{selectedAnalysis?.late ?? lates}</dd></div></dl></article></section>
    <section className="analysis-card comparison-table"><header><div><h2>{scope === "all" ? "مقارنة الفصول والفوارق" : "تفاصيل الطلاب والفوارق"}</h2><p>{scope === "all" ? "ترتيب الفصول تنازليًا حسب متوسط الأداء" : "ترتيب الطلاب تنازليًا حسب متوسط الأداء"}</p></div></header><div className="analytics-table-wrap"><table>{scope === "all" ? <><thead><tr><th>الفصل</th><th>عدد الطلاب</th><th>المتوسط</th>{dimensions.map(([, label]) => <th key={label}>{label}</th>)}<th>المتميزون</th><th>يحتاجون دعمًا</th><th>الغياب</th><th>التأخر</th><th>التصنيف</th></tr></thead><tbody>{classAnalyses.map(item => <tr key={item.name}><td><strong>{item.name}</strong></td><td>{item.count}</td><td><b>{item.average}%</b></td>{dimensions.map(([key]) => <td key={key}>{item.dimensionScores[key]}%</td>)}<td>{item.excellent}</td><td>{item.needsSupport}</td><td>{item.absence}</td><td>{item.late}</td><td><span className={`level-badge ${item.level.className}`}>{item.level.label}</span></td></tr>)}{!classAnalyses.length ? <tr><td colSpan={11} className="analysis-empty">لا توجد فصول للمقارنة.</td></tr> : null}</tbody></> : <><thead><tr><th>الطالب</th><th>الفصل</th><th>المتوسط</th>{dimensions.map(([, label]) => <th key={label}>{label}</th>)}<th>الغياب</th><th>التأخر</th><th>التصنيف</th></tr></thead><tbody>{[...filtered].sort((a, b) => b.average - a.average).map(student => <tr key={student.id}><td><strong>{student.name || "طالب"}</strong></td><td>{student.class || "—"}</td><td><b>{student.average}%</b></td>{dimensions.map(([key]) => <td key={key}>{student.dimensionScores[key]}%</td>)}<td>{student.absence}</td><td>{student.late}</td><td><span className={`level-badge ${student.level.className}`}>{student.level.label}</span></td></tr>)}{!filtered.length ? <tr><td colSpan={10} className="analysis-empty">اختر نطاق التحليل لعرض البيانات.</td></tr> : null}</tbody></>}</table></div></section>
  </main>;
}
