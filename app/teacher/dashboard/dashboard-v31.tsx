"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTeacherClient } from "../../../lib/teacher-client";

function dateLabel(value:Date){return new Intl.DateTimeFormat("ar-SA",{timeZone:"Asia/Riyadh",weekday:"long",day:"numeric",month:"long"}).format(value);}
function timeLabel(value:Date){return new Intl.DateTimeFormat("ar-SA",{timeZone:"Asia/Riyadh",hour:"numeric",minute:"2-digit"}).format(value);}

export default function TeacherDashboardV31(){
  const session=useTeacherClient();
  const [now,setNow]=useState<Date|null>(null);
  useEffect(()=>{setNow(new Date());const timer=window.setInterval(()=>setNow(new Date()),60000);return()=>window.clearInterval(timer);},[]);

  const teacherDisplayName=String(session.teacherName||"المعلم").replace(/^أ\.?\s*/,"").trim()||"المعلم";
  const hour=now?Number(new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Riyadh",hour:"2-digit",hour12:false}).format(now)):12;
  const greeting=hour<12?"صباح الخير":"مساء الخير";
  const subjectName=session.subject||"المادة الحالية";
  const gradeLabel=session.activeGradeLabel||"المرحلة الثانوية";

  return <main className="teacher-dashboard-v31" dir="rtl">
    <section className="td31-hero">
      <div className="td31-identity"><div className="td31-portrait" aria-hidden="true"/><div className="td31-welcome"><small>{greeting}</small><h1>أ. {teacherDisplayName}</h1><div className="td31-meta"><span>{subjectName}</span><i>•</i><span>{gradeLabel}</span><i>•</i><span>{now?dateLabel(now):"اليوم الدراسي"}</span><i>•</i><span>{now?timeLabel(now):""}</span></div></div></div>
    </section>

    <section className="td31-kpis" aria-label="مراكز العمل">
      <div data-kpi="classes"><span>الطلاب والفصول</span><b>↗</b><small>تُحمّل البيانات عند فتح الصفحة فقط</small></div>
      <div data-kpi="lessons"><span>الجدول الدراسي</span><b>↗</b><small>عرض الحصص عند الطلب</small></div>
      <div data-kpi="attendance"><span>الحضور</span><b>↗</b><small>التسجيل والمتابعة من صفحة الحضور</small></div>
      <div data-kpi="grades"><span>التحصيل والدرجات</span><b>↗</b><small>الرصد والتحليل عند فتح الصفحة</small></div>
    </section>

    <section className="td31-centers" aria-label="اختصارات العمل">
      <Link href="/teacher/timetable" data-center="day"><b>الجدول</b><small>حصص اليوم</small></Link>
      <Link href="/teacher/attendance" data-center="attendance"><b>الحضور</b><small>تسجيل سريع</small></Link>
      <Link href="/teacher/students" data-center="students"><b>الطلاب</b><small>الفصول والسجلات</small></Link>
      <Link href="/teacher/grades" data-center="grades"><b>الدرجات</b><small>الرصد والتحصيل</small></Link>
      <Link href="/teacher/follow-up" data-center="follow"><b>المتابعة</b><small>دعم وإتقان</small></Link>
      <Link href="/teacher/reports" data-center="reports"><b>التقارير</b><small>طباعة وتحليل</small></Link>
    </section>

    <section className="td31-lower">
      <article className="td31-today"><header><div><small>الرئيسية الخفيفة</small><h2>ادخل إلى الصفحة التي تحتاجها فقط</h2></div></header><div><p className="td31-empty">تم إيقاف تحميل الطلاب والدرجات والحضور والجدول تلقائيًا من الرئيسية لتقليل استهلاك Firestore. بياناتك لم تُحذف ولم تتغير.</p></div></article>
      <article className="td31-alerts"><header><small>وصول مباشر</small><h2>أهم الصفحات</h2></header><div className="td31-alert-list"><Link href="/teacher/attendance"><span>الحضور</span><b>↗</b><small>فتح عند الحاجة</small></Link><Link href="/teacher/grades"><span>الدرجات</span><b>↗</b><small>فتح عند الحاجة</small></Link><Link href="/teacher/reports"><span>التقارير</span><b>↗</b><small>فتح عند الحاجة</small></Link></div></article>
    </section>
  </main>;
}
