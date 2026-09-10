"use client";

import { useEffect, useMemo, useState } from "react";

type Assignment = { subjectId?: string; subjectLabel?: string; grade?: string; section?: string };
type Teacher = { id: string; name: string; active: boolean; assignments?: Assignment[] };
type Student = { id: string; name: string; grade: number; section: string; active: boolean };
type SchoolClass = { id: string; grade: number; section: string; name: string; active: boolean };

const ar = (value: number) => new Intl.NumberFormat("ar-SA-u-nu-arab").format(value || 0);

export default function AdminOverview(){
  const [teachers,setTeachers]=useState<Teacher[]>([]);
  const [students,setStudents]=useState<Student[]>([]);
  const [classes,setClasses]=useState<SchoolClass[]>([]);
  const [ready,setReady]=useState(false);

  useEffect(()=>{
    let live=true;
    Promise.all([
      fetch("/api/admin/teachers",{cache:"no-store"}).then(r=>r.ok?r.json():null).catch(()=>null),
      fetch("/api/admin/students",{cache:"no-store"}).then(r=>r.ok?r.json():null).catch(()=>null),
    ]).then(([teacherData,studentData])=>{
      if(!live) return;
      if(Array.isArray(teacherData?.teachers)) setTeachers(teacherData.teachers);
      if(Array.isArray(studentData?.students)) setStudents(studentData.students);
      if(Array.isArray(studentData?.classes)) setClasses(studentData.classes);
      setReady(Boolean(teacherData||studentData));
    });
    return()=>{live=false};
  },[]);

  const activeTeachers=teachers.filter(t=>t.active!==false);
  const activeStudents=students.filter(s=>s.active!==false);
  const activeClasses=classes.filter(c=>c.active!==false);
  const assignmentCount=teachers.reduce((n,t)=>n+(t.assignments?.length||0),0);
  const subjectCount=new Set(teachers.flatMap(t=>(t.assignments||[]).map(a=>a.subjectId).filter(Boolean))).size;
  const gradeStats=[1,2,3].map(grade=>({grade,count:activeStudents.filter(s=>s.grade===grade).length}));
  const maxGrade=Math.max(1,...gradeStats.map(g=>g.count));
  const teacherStats=useMemo(()=>[...teachers]
    .map(t=>({name:t.name,count:t.assignments?.length||0,active:t.active!==false}))
    .sort((a,b)=>b.count-a.count)
    .slice(0,5),[teachers]);
  const maxTeacher=Math.max(1,...teacherStats.map(t=>t.count));

  if(!ready) return null;

  return <section className="adm-overview" id="overview" aria-label="لوحة مؤشرات الإدارة">
    <div className="adm-welcome-row">
      <div className="adm-welcome-copy"><span>بوابة الإدارة الذكية</span><h1>مرحبًا أ. حسن علي الطويل</h1><p>صورة شاملة ومباشرة لحركة المعلمين والطلاب والفصول والعمل داخل المنصة.</p></div>
      <div className="adm-live-pill"><i/> البيانات محدثة من النظام</div>
    </div>

    <div className="adm-kpis">
      <article><i>◉</i><div><span>المعلمون</span><strong>{ar(activeTeachers.length)}</strong><small>{ar(teachers.length-activeTeachers.length)} حساب متوقف</small></div></article>
      <article><i>◈</i><div><span>الطلاب</span><strong>{ar(activeStudents.length)}</strong><small>ضمن جميع الفصول</small></div></article>
      <article><i>▦</i><div><span>الفصول</span><strong>{ar(activeClasses.length)}</strong><small>فصل دراسي نشط</small></div></article>
      <article><i>✦</i><div><span>المواد</span><strong>{ar(subjectCount)}</strong><small>{ar(assignmentCount)} تكليف دراسي</small></div></article>
    </div>

    <div className="adm-analytics-grid">
      <article className="adm-chart-card" id="teachers-chart">
        <header><div><span>إدارة المعلمين</span><h2>توزيع التكليفات للمعلمين</h2></div><a href="#teachers-management">إدارة المعلمين</a></header>
        <div className="adm-bar-list">{teacherStats.length?teacherStats.map((t,index)=><div className="adm-bar-row" key={`${t.name}-${index}`}><div className="adm-bar-label"><b>{t.name}</b><small>{t.active?"نشط":"متوقف"}</small></div><div className="adm-bar-track"><i style={{width:`${Math.max(12,(t.count/maxTeacher)*100)}%`}}/></div><strong>{ar(t.count)}</strong></div>):<p className="adm-empty-graph">لا توجد بيانات معلمين بعد.</p>}</div>
      </article>

      <article className="adm-chart-card" id="students-chart">
        <header><div><span>إدارة الطلاب</span><h2>توزيع الطلاب على الصفوف</h2></div><a href="/admin/students">إدارة الطلاب</a></header>
        <div className="adm-columns">{gradeStats.map(g=><div className="adm-column" key={g.grade}><div className="adm-column-value">{ar(g.count)}</div><div className="adm-column-track"><i style={{height:`${Math.max(10,(g.count/maxGrade)*100)}%`}}/></div><b>{g.grade===1?"الأول":g.grade===2?"الثاني":"الثالث"}</b><small>الثانوي</small></div>)}</div>
      </article>
    </div>
  </section>;
}
