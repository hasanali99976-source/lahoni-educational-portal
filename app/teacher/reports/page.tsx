"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { tenantCollection, type SubjectKey } from "../../../lib/teacher-tenant";
import { useTeacherClient } from "../../../lib/teacher-client";
import "./reports.css";

type UnitRecord={attendance?:number;participation?:number;homework?:number;unitExam?:number;total?:number};
type Student={id:string;name?:string;class?:string;nationalId?:string;researchScore?:number;units?:Record<string,UnitRecord>};
type AttendanceDoc={records?:Record<string,"present"|"absent"|"late"|"excused">};
type Session={authenticated?:boolean;teacherId?:string;teacherName?:string;subjectKey?:SubjectKey;subject?:string};
const units=[["unit1","الوحدة الأولى"],["unit2","الوحدة الثانية"],["unit3","الوحدة الثالثة"],["unit4","الوحدة الرابعة"],["unit5","الوحدة الخامسة"]] as const;
function hijriToday(){return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-arab",{day:"numeric",month:"long",year:"numeric"}).format(new Date())}

export default function ReportsPage(){
  const session = useTeacherClient();
  const teacherId = session?.teacherId || "";
  const teacherName = session?.teacherName || "";
  const subjectKey = session?.subjectKey || "history";
  const subject = session?.subject || "";
  const ready = !!session?.teacherId && !!session?.subjectKey;

  const [students,setStudents]=useState<Student[]>([]),[attendanceDocs,setAttendanceDocs]=useState<AttendanceDoc[]>([]),[selectedClass,setSelectedClass]=useState(""),[selectedStudent,setSelectedStudent]=useState("");
  const [message,setMessage]=useState("");
  const studentsPath=useMemo(()=>teacherId?tenantCollection(teacherId,subjectKey as any,"students"):"",[teacherId,subjectKey]);
  const attendancePath=useMemo(()=>teacherId?tenantCollection(teacherId,subjectKey as any,"attendance"):"",[teacherId,subjectKey]);

  useEffect(()=>{ if(!ready){ setMessage("انتهت الجلسة. سجّل الدخول من جديد."); return; } return onSnapshot(collection(db,studentsPath),snap=>{const list=snap.docs.map(d=>({id:d.id,...d.data()})) as Student[];list.sort((a,b)=>(a.name||"").localeCompare(b.name||"","ar"));setStudents(list)},()=>setMessage("تعذر تحميل طلاب هذا الحساب")) },[ready,studentsPath]);
  useEffect(()=>{ if(!ready){ setMessage("انتهت الجلسة. سجّل الدخول من جديد."); return; } return onSnapshot(collection(db,attendancePath),snap=>setAttendanceDocs(snap.docs.map(d=>d.data() as AttendanceDoc)),()=>setMessage("تعذر تحميل حضور هذا الحساب")) },[ready,attendancePath]);
 const classes=useMemo(()=>Array.from(new Set(students.map(s=>(s.class||"").trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"ar")),[students]);
 const classStudents=useMemo(()=>selectedClass?students.filter(s=>(s.class||"").trim()===selectedClass):students,[students,selectedClass]);
 useEffect(()=>{if(!classStudents.some(s=>s.id===selectedStudent))setSelectedStudent(classStudents[0]?.id||"")},[classStudents,selectedStudent]);
 const student=classStudents.find(s=>s.id===selectedStudent);
 const unitRows=useMemo(()=>units.map(([key,label])=>{const r=student?.units?.[key]||{};const attendance=Number(r.attendance||0),participation=Number(r.participation||0),homework=Number(r.homework||0),unitExam=Number(r.unitExam||0),total=Number(r.total??attendance+participation+homework+unitExam);return{key,label,attendance,participation,homework,unitExam,total}}),[student]);
 const research=Number(student?.researchScore||0),finalTotal=unitRows.reduce((sum,u)=>sum+u.total,0)+research;
 const attendanceSummary=useMemo(()=>{const result={present:0,absent:0,late:0,excused:0};if(!student)return result;attendanceDocs.forEach(d=>{const status=d.records?.[student.id];if(status)result[status]+=1});return result},[attendanceDocs,student]);
 const recordedDays=Object.values(attendanceSummary).reduce((a,b)=>a+b,0),attendanceRate=recordedDays?Math.round(attendanceSummary.present/recordedDays*100):0,initial=(student?.name||"ط").trim().charAt(0);
 if(!ready)return <main className="student-report-page" dir="rtl"><section className="report-empty">{message||"جارٍ تجهيز تقارير الحساب..."}</section></main>;
 return <main className="student-report-page" dir="rtl"><div className="student-report-wrap"><section className="report-selector-card"><div><h1>ملخص الطالب — {subject}</h1><p>المعلم: {teacherName}. تظهر تقارير طلاب هذا الحساب فقط.</p></div><div className="report-selectors"><label>الفصل<select value={selectedClass} onChange={e=>setSelectedClass(e.target.value)}><option value="">جميع الفصول</option>{classes.map(c=><option key={c}>{c}</option>)}</select></label><label>الطالب<select value={selectedStudent} onChange={e=>setSelectedStudent(e.target.value)}><option value="">اختر الطالب</option>{classStudents.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label></div></section>{message&&<section className="report-empty">{message}</section>}{!student?<section className="report-empty">لا يوجد طلاب في مساحة هذا الحساب.</section>:<><section className="student-hero-card"><div className="student-main-info"><div className="student-avatar">{initial}</div><div><small>اسم الطالب</small><h2>{student.name}</h2><p>{student.class||"غير محدد"} • السجل المدني: {student.nationalId||"—"}</p></div></div><div className="final-score-box"><span>المجموع النهائي</span><strong>{finalTotal}</strong><small>من ١٠٠ درجة</small></div></section><section className="unit-score-grid">{unitRows.map(u=><article key={u.key}><span>{u.label}</span><strong>{u.total}</strong><small>من ١٩</small></article>)}<article className="research-score-card"><span>البحث</span><strong>{research}</strong><small>من ٥</small></article></section><section className="attendance-summary-grid"><article><span>أيام الغياب</span><strong>{attendanceSummary.absent}</strong><small>يوم</small></article><article><span>مرات التأخر</span><strong>{attendanceSummary.late}</strong><small>مرة</small></article><article><span>مرات الاستئذان</span><strong>{attendanceSummary.excused}</strong><small>مرة</small></article><article><span>نسبة الحضور</span><strong>{attendanceRate}%</strong><small>من الأيام المسجلة</small></article></section><section className="unit-details-card print-grade-sheet"><header><div><h2>كشف درجات الطالب</h2><p>الوحدات الخمس والبحث والمجموع النهائي.</p><small className="student-name-small">الطالب: {student.name}</small></div><button className="print-sheet-button" onClick={()=>window.print()}>🖨 طباعة كشف الدرجات</button></header><div className="print-sheet-heading"><h2>مدرسة التهذيب الثانوية</h2><p>كشف درجات مادة {subject}</p><div><span><b>اسم الطالب:</b> {student.name}</span><span><b>السجل المدني:</b> {student.nationalId||"—"}</span><span><b>الفصل:</b> {student.class||"—"}</span><span><b>المعلم:</b> {teacherName}</span><span><b>التاريخ:</b> {hijriToday()}</span></div></div><div className="unit-table-scroll"><table className="unit-details-table"><thead><tr><th>الوحدة</th><th>الحضور<br/><small>من ١</small></th><th>المشاركة<br/><small>من ٢</small></th><th>الواجبات<br/><small>من ٢</small></th><th>اختبار الوحدة<br/><small>من ١٤</small></th><th>مجموع الوحدة<br/><small>من ١٩</small></th></tr></thead><tbody>{unitRows.map(u=><tr key={u.key}><td><strong>{u.label}</strong></td><td>{u.attendance}</td><td>{u.participation}</td><td>{u.homework}</td><td>{u.unitExam}</td><td><b>{u.total}</b></td></tr>)}</tbody><tfoot><tr><td colSpan={5}>درجة البحث</td><td>{research} / ٥</td></tr><tr className="final-row"><td colSpan={5}>المجموع النهائي</td><td>{finalTotal} / ١٠٠</td></tr></tfoot></table></div><div className="print-attendance-line">الغياب: {attendanceSummary.absent} يوم • التأخر: {attendanceSummary.late} • الاستئذان: {attendanceSummary.excused} • نسبة الحضور: {attendanceRate}%</div></section></>}</div></main>;
}
