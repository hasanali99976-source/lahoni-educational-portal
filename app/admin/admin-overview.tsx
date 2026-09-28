"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Assignment={subjectId?:string;subjectLabel?:string;grade?:string;section?:string};
type Teacher={id:string;name:string;active:boolean;assignments?:Assignment[]};
type Student={id:string;name:string;grade:number;section:string;active:boolean};
type SchoolClass={id:string;grade:number;section:string;name:string;active:boolean};
const ar=(n:number)=>new Intl.NumberFormat("ar-SA-u-nu-arab").format(n||0);

const sections=[
  ["الطلاب والفصول","إدارة الطلاب والفصول", "/admin/students"],
  ["المعلمون والإسناد","المعلمون والمواد والصلاحيات", "/admin/teachers"],
  ["المواد","تنظيم المواد الدراسية", "/admin/subjects"],
  ["الجدول الدراسي","الحصص والجداول", "/admin/timetable"],
  ["التقارير","تقارير المدرسة والمتابعة", "/admin/reports"],
  ["الإعدادات","إعدادات الإدارة والبوابة", "/admin/settings"],
] as const;

export default function AdminOverview(){
 const [teachers,setTeachers]=useState<Teacher[]>([]),[students,setStudents]=useState<Student[]>([]),[classes,setClasses]=useState<SchoolClass[]>([]),[ready,setReady]=useState(false);
 useEffect(()=>{let live=true;Promise.all([fetch("/api/admin/teachers",{cache:"no-store"}).then(r=>r.ok?r.json():null).catch(()=>null),fetch("/api/admin/students",{cache:"no-store"}).then(r=>r.ok?r.json():null).catch(()=>null)]).then(([t,s])=>{if(!live)return;if(Array.isArray(t?.teachers))setTeachers(t.teachers);if(Array.isArray(s?.students))setStudents(s.students);if(Array.isArray(s?.classes))setClasses(s.classes);setReady(true)});return()=>{live=false}},[]);
 const activeTeachers=teachers.filter(t=>t.active!==false),activeStudents=students.filter(s=>s.active!==false),activeClasses=classes.filter(c=>c.active!==false);
 const subjects=useMemo(()=>{const m=new Set<string>();teachers.forEach(t=>(t.assignments||[]).forEach(a=>a.subjectId&&m.add(a.subjectId)));return m.size},[teachers]);
 if(!ready)return <main className="adm-home" dir="rtl"><div className="adm-home-bg"/><div className="adm-home-loading">جارٍ تجهيز الإدارة…</div></main>;
 return <main className="adm-home" dir="rtl"><div className="adm-home-bg"/><section className="adm-home-shell">
   <header className="adm-home-top"><div className="adm-home-brand"><Image src="/icons/lahooni-identity-320.jpg" alt="بوابة أستاذ لحوني التعليمية" width={52} height={52}/><div><strong>بوابة أستاذ لحوني التعليمية</strong><small>الإدارة المدرسية</small></div></div><div className="adm-home-actions"><Link href="/">الرئيسية</Link><button onClick={async()=>{await fetch('/api/auth/logout',{method:'POST'}).catch(()=>null);window.location.replace('/')}}>تسجيل الخروج</button></div></header>
   <section className="adm-home-intro"><div><span>لوحة الإدارة</span><h1>إدارة المدرسة</h1><p>كل أدوات الإدارة الأساسية في واجهة واحدة واضحة.</p></div><div className="adm-home-state"><i/><span>النظام متصل</span></div></section>
   <nav className="adm-home-tabs" aria-label="أقسام الإدارة">{sections.map(([title,detail,href])=><Link href={href} key={title}><b>{title}</b><small>{detail}</small></Link>)}</nav>
   <section className="adm-home-kpis"><article><span>الطلاب</span><strong>{ar(activeStudents.length)}</strong><small>{ar(activeClasses.length)} فصل نشط</small></article><article><span>المعلمون</span><strong>{ar(activeTeachers.length)}</strong><small>حساب مفعّل</small></article><article><span>الفصول</span><strong>{ar(activeClasses.length)}</strong><small>الفصول الحالية</small></article><article><span>المواد</span><strong>{ar(subjects)}</strong><small>مواد مسندة</small></article></section>
   <section className="adm-home-main"><div><span>اختصارات الإدارة</span><h2>اختر المهمة المطلوبة</h2></div><div className="adm-home-shortcuts">{sections.slice(0,4).map(([title,detail,href],i)=><Link href={href} key={title}><em>{ar(i+1)}</em><div><b>{title}</b><small>{detail}</small></div><strong>←</strong></Link>)}</div></section>
   <footer className="adm-home-footer"><span>بوابة أستاذ لحوني التعليمية</span><small>لوحة الإدارة المدرسية</small></footer>
 </section></main>;
}
