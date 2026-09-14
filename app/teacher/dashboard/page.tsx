"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useTeacherClient } from "../../../lib/teacher-client";
import "./dashboard-v11.css";

function dateLabel(value: Date) {
  return new Intl.DateTimeFormat("ar-SA", { timeZone: "Asia/Riyadh", weekday: "long", day: "numeric", month: "long" }).format(value);
}
function timeLabel(value: Date) {
  return new Intl.DateTimeFormat("ar-SA", { timeZone: "Asia/Riyadh", hour: "numeric", minute: "2-digit" }).format(value);
}

export default function TeacherDashboardPage() {
  const session = useTeacherClient();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const classLabels = useMemo(() => {
    const rows = Array.isArray(session.assignments) ? session.assignments : [];
    return [...new Set(rows.map(item => String(item.grade || "").trim()).filter(Boolean))].slice(0, 6);
  }, [session.assignments]);

  return <main className="teacher-dashboard-v11" dir="rtl">
    <section className="td11-hero">
      <div className="td11-greeting"><small>مرحبًا {session.teacherName || "أستاذنا"}</small><h2>{now ? dateLabel(now) : "يومك الدراسي"}</h2><p>{session.subject || "المادة"}{session.activeGradeLabel ? ` • ${session.activeGradeLabel}` : ""}</p><span>{now ? timeLabel(now) : "—"}</span></div>
      <div className="td11-ai"><span>AI</span><div><small>الأولوية الآن</small><h2>ابدأ من عملك الحالي</h2><p>اختر القسم الذي تحتاجه، وتُحمّل بياناته عند فتحه فقط للحفاظ على سرعة البوابة وتقليل استهلاك Firebase.</p></div><Link href="/teacher/timetable" prefetch={false}>فتح يومي الدراسي</Link></div>
    </section>

    <section className="td11-day-grid">
      <article className="td11-next"><header><small>الحصة الأقرب</small><span>الجدول الدراسي</span></header><div><b>يومك الدراسي</b><p>افتح الجدول لعرض حصص اليوم عند الحاجة.</p></div><footer><Link href="/teacher/timetable" prefetch={false}>فتح الجدول</Link></footer></article>
      <article className="td11-progress"><header><small>إنجاز اليوم</small><b>—</b></header><div className="td11-progress-line"><i><span style={{width:"0%"}}/></i><p>تظهر المتابعة عند فتح سجل المتابعة فقط.</p></div><footer><Link href="/teacher/attendance" prefetch={false}>سجل المتابعة</Link><Link href="/teacher/grades" prefetch={false}>التحصيل العلمي</Link></footer></article>
      <article className="td11-academic"><header><small>الصورة الأكاديمية</small><b>—</b></header><div><span><b>—</b><small>طالب</small></span><span><b>—</b><small>يحتاج دعمًا</small></span><span><b>—</b><small>فصل متميز</small></span></div><Link href="/teacher/report" prefetch={false}>فتح التحليل الكامل</Link></article>
    </section>

    <section className="td11-section-head"><div><small>فصولي التعليمية</small><h2>كل فصل مساحة عمل مستقلة</h2><p>المتابعة والتحصيل والملاحظات تبدأ من الفصل نفسه.</p></div><Link href="/teacher/students" prefetch={false}>إدارة الطلاب والفصول</Link></section>
    <section className="td11-classes">{classLabels.length ? classLabels.map(name => <article key={name}><header><div><small>فصل مسند</small><h3>{name}</h3></div><span>مساحة تعليمية</span></header><div className="td11-class-bars"><div><span>التحصيل</span><b>—</b></div><i><u style={{width:"0%"}}/></i></div><div className="td11-class-meta"><span><b>—</b><small>متابعة اليوم</small></span><span><b>—</b><small>يحتاج دعمًا</small></span><span><b>—</b><small>اكتمال الرصد</small></span></div><footer><Link href="/teacher/attendance" prefetch={false}>متابعة</Link><Link href="/teacher/grades" prefetch={false}>تحصيل</Link><Link href="/teacher/notes" prefetch={false}>ملاحظة</Link></footer></article>) : <div className="td11-empty"><b>فصولك محفوظة داخل إدارة الطلاب</b><span>افتح القسم لعرض القوائم والبيانات الفعلية.</span><Link href="/teacher/students" prefetch={false}>إدارة الطلاب</Link></div>}</section>

    <section className="td11-bottom"><article className="td11-workflow"><header><small>مسار يوم المعلم</small><h2>ثلاث خطوات تكفي لمعظم عملك</h2></header><div><Link href="/teacher/attendance" prefetch={false}><b>01</b><span><strong>متابعة الفصل</strong><small>الحضور والانضباط</small></span></Link><Link href="/teacher/grades" prefetch={false}><b>02</b><span><strong>رصد التحصيل</strong><small>الوحدة أو الفترة الحالية</small></span></Link><Link href="/teacher/follow-up" prefetch={false}><b>03</b><span><strong>قرار تعليمي</strong><small>إتقان، دعم أو إثراء</small></span></Link></div></article><article className="td11-race"><header><small>مساحة المعلم</small><h2>أدواتك الأساسية</h2><p>نفس التصميم القديم، مع إبقاء إصلاحات الأداء الحالية ومنع القراءات الخلفية الثقيلة.</p></header><div className="td11-progress"><footer><Link href="/teacher/reports" prefetch={false}>مركز التقارير</Link><Link href="/teacher/portfolio" prefetch={false}>ملف الإنجاز</Link></footer></div></article></section>
  </main>;
}
