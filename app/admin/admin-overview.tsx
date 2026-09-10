"use client";

import { useEffect, useMemo, useState } from "react";

type Assignment = { subjectId?: string; subjectLabel?: string; grade?: string; section?: string };
type Teacher = { id: string; name: string; active: boolean; assignments?: Assignment[] };
type Student = { id: string; name: string; grade: number; section: string; active: boolean };
type SchoolClass = { id: string; grade: number; section: string; name: string; active: boolean };
const ar=(value:number)=>new Intl.NumberFormat("ar-SA-u-nu-arab").format(value||0);

export default function AdminOverview(){
  const [teachers,setTeachers]=useState<Teacher[]>([]),[students,setStudents]=useState<Student[]>([]),[classes,setClasses]=useState<SchoolClass[]>([]),[ready,setReady]=useState(false);
  useEffect(()=>{let live=true;Promise.all([fetch("/api/admin/teachers",{cache:"no-store"}).then(r=>r.ok?r.json():null).catch(()=>null),fetch("/api/admin/students",{cache:"no-store"}).then(r=>r.ok?r.json():null).catch(()=>null)]).then(([t,s])=>{if(!live)return;if(Array.isArray(t?.teachers))setTeachers(t.teachers);if(Array.isArray(s?.students))setStudents(s.students);if(Array.isArray(s?.classes))setClasses(s.classes);setReady(Boolean(t||s));});return()=>{live=false};},[]);
  const activeTeachers=teachers.filter(t=>t.active!==false),activeStudents=students.filter(s=>s.active!==false),activeClasses=classes.filter(c=>c.active!==false);
  const subjectMap=useMemo(()=>{const map=new Map<string,{label:string,count:number}>();teachers.forEach(t=>(t.assignments||[]).forEach(a=>{if(!a.subjectId)return;const current=map.get(a.subjectId)||{label:a.subjectLabel||a.subjectId,count:0};current.count+=1;map.set(a.subjectId,current);}));return [...map.values()].sort((a,b)=>b.count-a.count);},[teachers]);
  const assignmentTotal=teachers.reduce((n,t)=>n+(t.assignments?.length||0),0);
  const gradeStats=[1,2,3].map(grade=>({grade,count:activeStudents.filter(s=>s.grade===grade).length}));
  const teacherStats=useMemo(()=>[...teachers].map(t=>({name:t.name,count:t.assignments?.length||0,active:t.active!==false})).sort((a,b)=>b.count-a.count).slice(0,6),[teachers]);
  const maxTeacher=Math.max(1,...teacherStats.map(t=>t.count)),maxGrade=Math.max(1,...gradeStats.map(g=>g.count)),maxSubject=Math.max(1,...subjectMap.slice(0,6).map(s=>s.count));
  const activeRate=teachers.length?Math.round(activeTeachers.length/teachers.length*100):0;
  const avgStudents=activeClasses.length?Math.round(activeStudents.length/activeClasses.length):0;
  if(!ready)return <section className="adm-overview-loading">جارٍ تجهيز لوحة الإدارة…</section>;
  return <section className="adm-overview adm-command-home" id="overview" aria-label="إحصائيات الإدارة">
    <header className="adm-command-hero"><div><small>لوحة القيادة</small><h1>نظرة الإدارة اليوم</h1><p>ملخص مباشر لحالة المعلمين والطلاب والمواد والفصول من بيانات المنصة الحالية.</p></div><div className="adm-command-live"><i/><span>البيانات متصلة</span><b>{ar(activeRate)}٪</b><small>من حسابات المعلمين مفعّلة</small></div></header>
    <div className="adm-kpis adm-kpis-three">
      <article className="adm-kpi-teachers"><i>م</i><div><span>المعلمون</span><strong>{ar(activeTeachers.length)}</strong><small>من أصل {ar(teachers.length)} حساب • {ar(teachers.length-activeTeachers.length)} متوقف</small></div></article>
      <article className="adm-kpi-students"><i>ط</i><div><span>الطلاب</span><strong>{ar(activeStudents.length)}</strong><small>{ar(activeClasses.length)} فصلًا نشطًا • متوسط {ar(avgStudents)} طالبًا للفصل</small></div></article>
      <article className="adm-kpi-subjects"><i>د</i><div><span>المواد</span><strong>{ar(subjectMap.length)}</strong><small>{ar(assignmentTotal)} إسنادًا دراسيًا مسجلًا</small></div></article>
    </div>
    <div className="adm-analytics-grid adm-analytics-three">
      <article className="adm-chart-card adm-chart-wide"><header><div><span>المعلمون</span><h2>حجم الإسناد التدريسي</h2><p>أعلى المعلمين حسب عدد المواد والصفوف والفصول المسندة.</p></div></header><div className="adm-bar-list">{teacherStats.map((t,i)=><div className="adm-bar-row" key={`${t.name}-${i}`}><div className="adm-bar-label"><b>{t.name}</b><small>{t.active?"حساب فعّال":"حساب متوقف"}</small></div><div className="adm-bar-track"><i style={{width:`${Math.max(8,t.count/maxTeacher*100)}%`}}/></div><strong>{ar(t.count)}</strong></div>)}</div></article>
      <article className="adm-chart-card adm-grade-card"><header><div><span>الطلاب</span><h2>توزيع الصفوف</h2><p>عدد الطلاب في كل مستوى ثانوي.</p></div></header><div className="adm-columns">{gradeStats.map(g=><div className="adm-column" key={g.grade}><div className="adm-column-value">{ar(g.count)}</div><div className="adm-column-track"><i style={{height:`${Math.max(8,g.count/maxGrade*100)}%`}}/></div><b>{g.grade===1?"الأول":g.grade===2?"الثاني":"الثالث"}</b><small>الثانوي</small></div>)}</div></article>
      <article className="adm-chart-card"><header><div><span>المواد</span><h2>المواد الأكثر إسنادًا</h2><p>قراءة سريعة لحجم توزيع المواد.</p></div></header><div className="adm-subject-donuts">{subjectMap.slice(0,6).map((s,i)=><div className="adm-subject-row" key={`${s.label}-${i}`}><span>{s.label}</span><div><i style={{width:`${Math.max(10,s.count/maxSubject*100)}%`}}/></div><strong>{ar(s.count)}</strong></div>)}{!subjectMap.length&&<p>لا توجد مواد مسندة بعد.</p>}</div></article>
    </div>
    <section className="adm-summary-table" aria-label="الملخص الإداري"><header><div><b>الملخص الإداري</b><span>أهم الأرقام في جدول واحد</span></div><small>قراءة سريعة</small></header><div className="adm-summary-head"><span>المجال</span><span>الإجمالي</span><span>الحالة الحالية</span></div><div className="adm-summary-row"><b>المعلمون</b><strong>{ar(teachers.length)}</strong><span>{ar(activeTeachers.length)} مفعّل • {ar(teachers.length-activeTeachers.length)} متوقف</span></div><div className="adm-summary-row"><b>الطلاب</b><strong>{ar(activeStudents.length)}</strong><span>{ar(activeClasses.length)} فصلًا نشطًا • متوسط {ar(avgStudents)} طالبًا</span></div><div className="adm-summary-row"><b>المواد</b><strong>{ar(subjectMap.length)}</strong><span>{ar(assignmentTotal)} إسنادًا دراسيًا</span></div></section>
  </section>;
}