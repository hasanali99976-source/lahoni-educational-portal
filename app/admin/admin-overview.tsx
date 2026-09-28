"use client";

import Link from "next/link";
import {useEffect,useMemo,useState} from "react";

type Assignment={subjectId?:string};
type Teacher={id:string;active:boolean;assignments?:Assignment[]};
type Student={id:string;active:boolean};
type SchoolClass={id:string;active:boolean};
const ar=(n:number)=>new Intl.NumberFormat("ar-SA-u-nu-arab").format(n||0);
const tasks=[
 ["الطلاب والفصول","إضافة الطلاب ونقلهم وإدارة الفصول","/admin/students"],
 ["المعلمون والإسناد","الحسابات والمواد والصلاحيات","/admin/teachers"],
 ["ساحة التنافس","المسابقات والنتائج","/admin/competition"],
] as const;

export default function AdminOverview(){
 const[teachers,setTeachers]=useState<Teacher[]>([]),[students,setStudents]=useState<Student[]>([]),[classes,setClasses]=useState<SchoolClass[]>([]),[ready,setReady]=useState(false);
 useEffect(()=>{let live=true;Promise.all([fetch("/api/admin/teachers",{cache:"no-store"}).then(r=>r.ok?r.json():null).catch(()=>null),fetch("/api/admin/students",{cache:"no-store"}).then(r=>r.ok?r.json():null).catch(()=>null)]).then(([t,s])=>{if(!live)return;if(Array.isArray(t?.teachers))setTeachers(t.teachers);if(Array.isArray(s?.students))setStudents(s.students);if(Array.isArray(s?.classes))setClasses(s.classes);setReady(true)});return()=>{live=false}},[]);
 const activeTeachers=teachers.filter(x=>x.active!==false),activeStudents=students.filter(x=>x.active!==false),activeClasses=classes.filter(x=>x.active!==false);
 const subjects=useMemo(()=>{const ids=new Set<string>();teachers.forEach(t=>(t.assignments||[]).forEach(a=>a.subjectId&&ids.add(a.subjectId)));return ids.size},[teachers]);
 if(!ready)return <section className="admin-overview-inline" dir="rtl"><div className="aov-loading">جارٍ تحميل مؤشرات الإدارة…</div><style>{styles}</style></section>;
 return <section className="admin-overview-inline" dir="rtl"><style>{styles}</style>
   <section className="aov-kpis"><article><span>الطلاب</span><strong>{ar(activeStudents.length)}</strong><small>{ar(activeClasses.length)} فصل نشط</small></article><article><span>المعلمون</span><strong>{ar(activeTeachers.length)}</strong><small>حساب مفعّل</small></article><article><span>الفصول</span><strong>{ar(activeClasses.length)}</strong><small>الفصول الحالية</small></article><article><span>المواد</span><strong>{ar(subjects)}</strong><small>مواد مسندة</small></article></section>
   <section className="aov-section"><header><div><small>المهام الرئيسية</small><h2>إدارة المدرسة</h2></div><span>اختصارات مباشرة</span></header><div className="aov-tasks">{tasks.map(([title,note,href],i)=><Link href={href} prefetch={false} key={title}><em>{ar(i+1)}</em><div><b>{title}</b><small>{note}</small></div><strong>←</strong></Link>)}</div></section>
   <section className="aov-status"><div><span>حالة الإدارة</span><b>البيانات جاهزة للاستخدام</b></div><small>لا توجد مراقبة لحظية أو تحديثات دورية في هذه الصفحة.</small></section>
 </section>;
}
const styles=`
.admin-overview-inline{display:grid;gap:13px;color:#fff}.aov-loading{min-height:210px;display:grid;place-items:center;border:1px solid rgba(229,189,98,.16);border-radius:15px;background:rgba(6,38,53,.48);color:#e4c36d;font-weight:900}.aov-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;border:1px solid rgba(255,255,255,.09);border-radius:15px;overflow:hidden;background:rgba(255,255,255,.08)}.aov-kpis article{padding:17px 18px;background:rgba(6,38,53,.66)}.aov-kpis span{display:block;color:#aebfc4;font-size:8px}.aov-kpis strong{display:block;margin:4px 0;color:#fff;font-size:26px}.aov-kpis small{color:#d9b75e;font-size:7.5px}.aov-section{padding:17px;border:1px solid rgba(229,189,98,.15);border-radius:15px;background:rgba(5,33,46,.54)}.aov-section>header{display:flex;align-items:end;justify-content:space-between;gap:15px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,.07)}.aov-section>header small{color:#dcb657;font-size:8px;font-weight:900}.aov-section h2{margin:3px 0 0;font-size:17px}.aov-section>header>span{color:#839ba2;font-size:8px}.aov-tasks{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}.aov-tasks a{display:grid;grid-template-columns:30px 1fr auto;align-items:center;gap:9px;min-height:66px;padding:11px;border:1px solid rgba(229,189,98,.16);border-radius:11px;background:rgba(255,255,255,.035);color:#fff;text-decoration:none}.aov-tasks a:hover{border-color:rgba(229,189,98,.38);background:rgba(229,189,98,.06)}.aov-tasks em{width:29px;height:29px;display:grid;place-items:center;border-radius:8px;background:rgba(185,135,53,.16);color:#efca6e;font-style:normal;font-size:9px;font-weight:900}.aov-tasks b{display:block;font-size:10px}.aov-tasks small{display:block;margin-top:3px;color:#91a6ac;font-size:7px}.aov-tasks strong{color:#dcb75e}.aov-status{display:flex;align-items:center;justify-content:space-between;gap:15px;padding:13px 15px;border-top:1px solid rgba(229,189,98,.13);color:#9eb2b8}.aov-status span{display:block;color:#d6b35b;font-size:8px}.aov-status b{display:block;margin-top:3px;color:#dce6e8;font-size:9px}.aov-status>small{font-size:7.5px}@media(max-width:850px){.aov-kpis{grid-template-columns:1fr 1fr}.aov-tasks{grid-template-columns:1fr}.aov-status{align-items:flex-start;flex-direction:column}}
`;
