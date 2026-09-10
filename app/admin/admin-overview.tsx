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
  return <section className="adm15" id="overview" aria-label="إحصائيات الإدارة">
    <header className="adm15-hero">
      <div className="adm15-hero-copy"><span>مركز الإدارة الذكي</span><h1>المشهد الإداري للمدرسة</h1><p>المعلمون والطلاب والمواد والفصول في قراءة واحدة واضحة، بدون تداخل أو ازدحام.</p></div>
      <div className="adm15-status"><i/><div><small>حالة حسابات المعلمين</small><strong>{ar(activeRate)}٪</strong><span>مفعّلة حاليًا</span></div></div>
    </header>

    <section className="adm15-kpis">
      <article><div className="adm15-kpi-icon">م</div><div className="adm15-kpi-copy"><span>المعلمون</span><strong>{ar(activeTeachers.length)}</strong><small>من أصل {ar(teachers.length)} حساب</small></div><em>{ar(teachers.length-activeTeachers.length)} متوقف</em></article>
      <article><div className="adm15-kpi-icon">ط</div><div className="adm15-kpi-copy"><span>الطلاب</span><strong>{ar(activeStudents.length)}</strong><small>{ar(activeClasses.length)} فصلًا نشطًا</small></div><em>متوسط {ar(avgStudents)} طالبًا</em></article>
      <article><div className="adm15-kpi-icon">د</div><div className="adm15-kpi-copy"><span>المواد</span><strong>{ar(subjectMap.length)}</strong><small>{ar(assignmentTotal)} إسنادًا دراسيًا</small></div><em>موزعة على المعلمين</em></article>
    </section>

    <section className="adm15-grid">
      <article className="adm15-panel adm15-panel-wide"><header><div><span>نشاط الإسناد</span><h2>المعلمون الأكثر إسنادًا</h2></div><small>حسب عدد المواد والصفوف والفصول</small></header><div className="adm15-bars">{teacherStats.map((t,i)=><div className="adm15-bar" key={`${t.name}-${i}`}><div className="adm15-bar-name"><b>{t.name}</b><small>{t.active?"نشط":"متوقف"}</small></div><div className="adm15-bar-track"><i style={{width:`${Math.max(8,t.count/maxTeacher*100)}%`}}/></div><strong>{ar(t.count)}</strong></div>)}</div></article>
      <article className="adm15-panel"><header><div><span>الطلاب</span><h2>توزيع الصفوف</h2></div><small>المرحلة الثانوية</small></header><div className="adm15-columns">{gradeStats.map(g=><div key={g.grade}><strong>{ar(g.count)}</strong><div><i style={{height:`${Math.max(8,g.count/maxGrade*100)}%`}}/></div><b>{g.grade===1?"الأول":g.grade===2?"الثاني":"الثالث"}</b><small>الثانوي</small></div>)}</div></article>
      <article className="adm15-panel"><header><div><span>المواد</span><h2>الأكثر إسنادًا</h2></div><small>أعلى ٦ مواد</small></header><div className="adm15-subjects">{subjectMap.slice(0,6).map((s,i)=><div key={`${s.label}-${i}`}><span>{s.label}</span><div><i style={{width:`${Math.max(10,s.count/maxSubject*100)}%`}}/></div><strong>{ar(s.count)}</strong></div>)}{!subjectMap.length&&<p>لا توجد مواد مسندة بعد.</p>}</div></article>
    </section>

    <section className="adm15-summary"><header><div><span>ملخص سريع</span><h2>أرقام الإدارة الأساسية</h2></div><small>مباشر من بيانات المنصة</small></header><div className="adm15-summary-head"><span>المجال</span><span>الإجمالي</span><span>التفاصيل</span></div><div className="adm15-summary-row"><b>المعلمون</b><strong>{ar(teachers.length)}</strong><span>{ar(activeTeachers.length)} مفعّل • {ar(teachers.length-activeTeachers.length)} متوقف</span></div><div className="adm15-summary-row"><b>الطلاب</b><strong>{ar(activeStudents.length)}</strong><span>{ar(activeClasses.length)} فصلًا نشطًا • متوسط {ar(avgStudents)} طالبًا</span></div><div className="adm15-summary-row"><b>المواد</b><strong>{ar(subjectMap.length)}</strong><span>{ar(assignmentTotal)} إسنادًا دراسيًا</span></div></section>
  </section>;
}