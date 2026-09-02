"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { tenantCollection } from "../../../lib/teacher-tenant";
import { useTeacherClient } from "../../../lib/teacher-client";
import { calculateGradePlanResult, GRADE_PLAN_MODE_LABELS, type GradeStudentLike } from "../../../lib/grade-plan";
import { useGradePlan } from "../../../lib/use-grade-plan";
import "./reports.css";

type Student = GradeStudentLike & { id: string; name?: string; class?: string; className?: string };
type AttendanceDoc = { records?: Record<string, "present" | "absent" | "late" | "excused" | "escaped"> };
function hijriToday(){return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-arab",{day:"numeric",month:"long",year:"numeric"}).format(new Date())}

export default function ReportsPage(){
  const session = useTeacherClient();
  const { activePlan, loading: planLoading } = useGradePlan(true);
  const teacherId = session.teacherId || "";
  const teacherName = session.teacherName || "";
  const subjectKey = session.subjectKey || "history";
  const subject = session.subject || "";
  const ready = !!session.teacherId && !!session.subjectKey;
  const [students,setStudents]=useState<Student[]>([]),[attendanceDocs,setAttendanceDocs]=useState<AttendanceDoc[]>([]),[selectedClass,setSelectedClass]=useState(""),[selectedStudent,setSelectedStudent]=useState("");
  const [message,setMessage]=useState("");
  const studentsPath=useMemo(()=>teacherId?tenantCollection(teacherId,subjectKey as never,"students"):"",[teacherId,subjectKey]);
  const attendancePath=useMemo(()=>teacherId?tenantCollection(teacherId,subjectKey as never,"attendance"):"",[teacherId,subjectKey]);

  useEffect(()=>{if(!ready)return;return onSnapshot(collection(db,studentsPath),snap=>{const list=snap.docs.map(d=>({id:d.id,...d.data()})) as Student[];list.sort((a,b)=>(a.name||"").localeCompare(b.name||"","ar"));setStudents(list)},()=>setMessage("تعذر تحميل طلاب هذا الحساب"))},[ready,studentsPath]);
  useEffect(()=>{if(!ready)return;return onSnapshot(collection(db,attendancePath),snap=>setAttendanceDocs(snap.docs.map(d=>d.data() as AttendanceDoc)),()=>setMessage("تعذر تحميل حضور هذا الحساب"))},[ready,attendancePath]);

  const classes=useMemo(()=>Array.from(new Set(students.map(s=>String(s.className||s.class||"").trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"ar")),[students]);
  const classStudents=useMemo(()=>selectedClass?students.filter(s=>String(s.className||s.class||"").trim()===selectedClass):students,[students,selectedClass]);
  useEffect(()=>{if(!classStudents.some(s=>s.id===selectedStudent))setSelectedStudent(classStudents[0]?.id||"")},[classStudents,selectedStudent]);
  const student=classStudents.find(s=>s.id===selectedStudent);
  const result=useMemo(()=>activePlan&&student?calculateGradePlanResult(activePlan,student):null,[activePlan,student]);
  const attendanceSummary=useMemo(()=>{const value={present:0,absent:0,late:0,excused:0,escaped:0};if(!student)return value;attendanceDocs.forEach(d=>{const status=d.records?.[student.id];if(status)value[status]+=1});return value},[attendanceDocs,student]);
  const recordedDays=Object.values(attendanceSummary).reduce((a,b)=>a+b,0),attendanceRate=recordedDays?Math.round((attendanceSummary.present+attendanceSummary.late*.5+attendanceSummary.excused)/recordedDays*100):0,initial=(student?.name||"ط").trim().charAt(0);

  if(!ready)return <main className="student-report-page" dir="rtl"><section className="report-empty">جارٍ تجهيز تقارير الحساب…</section></main>;
  if(planLoading)return <main className="student-report-page" dir="rtl"><section className="report-empty">جارٍ تحميل خطة توزيع الدرجات…</section></main>;
  if(!activePlan)return <main className="student-report-page" dir="rtl"><section className="report-empty"><h2>لم تُعتمد خطة توزيع الدرجات بعد</h2><p>التقارير ستقرأ الخطة المعتمدة تلقائيًا بعد إعدادها.</p><Link href="/teacher/grade-plan">إعداد توزيع الدرجات</Link></section></main>;

  return <main className="student-report-page" dir="rtl"><div className="student-report-wrap">
    <section className="report-selector-card"><div><span className="active-plan-badge">{GRADE_PLAN_MODE_LABELS[activePlan.mode]} — نسخة {activePlan.version}</span><h1>ملخص الطالب — {subject}</h1><p>المعلم: {teacherName}. الاحتساب مبني على خطة توزيع الدرجات المعتمدة.</p></div><div className="report-selectors"><label>الفصل<select value={selectedClass} onChange={e=>setSelectedClass(e.target.value)}><option value="">جميع الفصول</option>{classes.map(c=><option key={c}>{c}</option>)}</select></label><label>الطالب<select value={selectedStudent} onChange={e=>setSelectedStudent(e.target.value)}><option value="">اختر الطالب</option>{classStudents.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label></div></section>
    {message&&<section className="report-empty">{message}</section>}
    {!student||!result?<section className="report-empty">لا يوجد طالب محدد.</section>:<>
      <section className="student-hero-card"><div className="student-main-info"><div className="student-avatar">{initial}</div><div><small>اسم الطالب</small><h2>{student.name}</h2><p>الفصل: {String(student.className||student.class||"غير محدد")}</p></div></div><div className="final-score-box"><span>{result.complete?"المجموع النهائي":"المجموع الحالي"}</span><strong>{result.earned}</strong><small>من ١٠٠ درجة • اكتمال الرصد {result.completion}%</small></div></section>
      <section className="unit-score-grid">{result.sections.map(section=><article key={section.id}><span>{section.label}</span><strong>{section.earned}</strong><small>من {section.maximum} • {section.percentage}%</small></article>)}</section>
      <section className="attendance-summary-grid"><article><span>أيام الغياب</span><strong>{attendanceSummary.absent}</strong><small>يوم</small></article><article><span>مرات التأخر</span><strong>{attendanceSummary.late}</strong><small>مرة</small></article><article><span>الاستئذان</span><strong>{attendanceSummary.excused}</strong><small>مرة</small></article><article><span>نسبة الانضباط</span><strong>{attendanceRate}%</strong><small>من الأيام المسجلة</small></article></section>
      <section className="unit-details-card print-grade-sheet"><header><div><h2>كشف درجات الطالب</h2><p>يعرض عناصر خطة توزيع الدرجات المعتمدة فقط.</p><small className="student-name-small">الطالب: {student.name}</small></div><button className="print-sheet-button" onClick={()=>window.print()}>🖨 طباعة كشف الدرجات</button></header><div className="print-sheet-heading"><h2>مدرسة التهذيب الثانوية</h2><p>كشف درجات مادة {subject}</p><div><span><b>اسم الطالب:</b> {student.name}</span><span><b>الفصل:</b> {String(student.className||student.class||"—")}</span><span><b>المعلم:</b> {teacherName}</span><span><b>التاريخ:</b> {hijriToday()}</span></div></div>
        {result.sections.map(section=><div className="unit-table-scroll" key={section.id}><table className="unit-details-table"><thead><tr><th colSpan={3}>{section.label} — من {section.maximum}</th></tr><tr><th>عنصر التقييم</th><th>الدرجة المرصودة</th><th>الدرجة القصوى</th></tr></thead><tbody>{section.items.map(entry=><tr key={entry.key}><td><strong>{entry.item.label}</strong></td><td>{entry.recorded?entry.value:"—"}</td><td>{entry.maximum}</td></tr>)}</tbody><tfoot><tr><td>مجموع {section.label}</td><td>{section.earned}</td><td>{section.maximum}</td></tr></tfoot></table></div>)}
        <div className="print-attendance-line">المجموع الحالي: {result.earned} / ١٠٠ • اكتمال الرصد: {result.completion}% • الغياب: {attendanceSummary.absent} • التأخر: {attendanceSummary.late} • الانضباط: {attendanceRate}%</div>
      </section>
    </>}
  </div></main>;
}
