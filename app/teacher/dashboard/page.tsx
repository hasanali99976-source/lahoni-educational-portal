"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useTeacherClient } from "../../../lib/teacher-client";
import "./dashboard-v11.css";
import "./dashboard-subject-achievement.css";

function dateLabel(value: Date) {
  return new Intl.DateTimeFormat("ar-SA", {
    timeZone: "Asia/Riyadh",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(value);
}

function timeLabel(value: Date) {
  return new Intl.DateTimeFormat("ar-SA", {
    timeZone: "Asia/Riyadh",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function subjectTagline(subjectId: string) {
  const value = String(subjectId || "").toLowerCase();
  if (value.includes("history")) return "الأحداث • الحضارات • المصادر";
  if (value.includes("critical")) return "تحليل • استدلال • قرار";
  if (value.includes("math")) return "مسائل • أنماط • حلول";
  if (["science", "physics", "chemistry", "biology"].some(key => value.includes(key))) return "استكشاف • تجربة • فهم";
  if (value.includes("geography")) return "مكان • خرائط • عالم";
  if (value.includes("arabic")) return "قراءة • كتابة • بلاغة";
  if (value.includes("english")) return "Reading • Writing • Skills";
  return "تعلم • متابعة • أثر";
}

export default function TeacherDashboardPage() {
  const session = useTeacherClient();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const subjectWorkspaces = useMemo(() => {
    if (session.subjects?.length) return session.subjects;
    return [{
      workspaceKey: session.workspaceKey || session.subjectKey || "subject",
      subjectId: session.subjectKey || "history",
      subjectName: session.subject || "المادة",
      grade: session.activeGrade || undefined,
      gradeLabel: session.activeGradeLabel || undefined,
    }];
  }, [session.activeGrade, session.activeGradeLabel, session.subject, session.subjectKey, session.subjects, session.workspaceKey]);

  const quickTasks = [
    { href: "/teacher/timetable", title: "الجدول الدراسي", meta: "راجع حصصك ومساحاتك التعليمية" },
    { href: "/teacher/attendance", title: "سجل المتابعة", meta: "الحضور والمتابعة اليومية" },
    { href: "/teacher/grades", title: "التحصيل العلمي", meta: "الرصد والدرجات" },
    { href: "/teacher/preparation", title: "تحضير الدروس", meta: "التحضير حسب التاريخ" },
  ];

  return <main className="teacher-dashboard-v16" dir="rtl">
    <section className="td16-hero">
      <div className="td16-hero-copy">
        <small>{now ? dateLabel(now) : "يومك الدراسي"}</small>
        <h1>مرحبًا {session.teacherName || "أستاذنا"}</h1>
        <p>مساحة تعليمية ذكية تجمع موادك وفصولك ومهامك في مكان واحد.</p>
        <div>
          <span>{session.subject || "المادة الحالية"}</span>
          <b>{session.activeGradeLabel || "المرحلة الثانوية"}</b>
          <em>{now ? timeLabel(now) : "—"}</em>
        </div>
      </div>
      <div className="td16-hero-art" data-subject={session.subjectKey || "history"} aria-hidden="true"><span/><i/><b/></div>
      <div className="td16-focus">
        <span>AI</span>
        <div><small>الأولوية الذكية</small><h2>ابدأ من عملك الحالي</h2><p>اختر الجدول أو المتابعة أو التحصيل، ولن نحمل بيانات إضافية قبل أن تفتح القسم بنفسك.</p></div>
        <Link href="/teacher/timetable" prefetch={false}>فتح يومي الدراسي</Link>
      </div>
    </section>

    <section className="td16-kpis">
      <article data-tone="mint"><span>الحضور اليوم</span><b>—</b><small>يظهر عند فتح سجل المتابعة</small><i style={{ width: "0%" }}/></article>
      <article data-tone="blue"><span>متوسط التحصيل</span><b>— / 100</b><small>يظهر عند فتح التحصيل</small><i style={{ width: "0%" }}/></article>
      <article data-tone="gold"><span>اكتمال الرصد</span><b>—</b><small>بدون قراءة تلقائية في الرئيسية</small><i style={{ width: "0%" }}/></article>
      <article data-tone="purple"><span>المتابعة الذكية</span><b>آمنة</b><small>لا توجد قراءة خلفية مستمرة</small><i style={{ width: "100%" }}/></article>
    </section>

    <section className="td16-main-grid">
      <article className="td16-subjects-panel">
        <header><div><small>المواد المسندة لي</small><h2>مساحات المواد</h2></div><span>{subjectWorkspaces.length} مادة</span></header>
        <div className="td16-subject-cards">{subjectWorkspaces.map(subject => {
          const active = subject.workspaceKey === session.workspaceKey;
          return <button type="button" key={subject.workspaceKey} data-subject={subject.subjectId} className={active ? "active" : ""} onClick={() => { if (!active) void session.setSubject?.(subject.workspaceKey); }}>
            <span className="td16-subject-art" data-subject={subject.subjectId}/>
            <div><small>{subject.gradeLabel || "مساحة تعليمية"}</small><h3>{subject.subjectName}</h3><p>{subjectTagline(subject.subjectId)}</p></div>
            <footer><b>{active ? "المادة الحالية" : "فتح المادة"}</b><span>بدون تحميل مسبق</span></footer>
          </button>;
        })}</div>
      </article>

      <article className="td16-tasks-panel">
        <header><div><small>مهامي اليوم</small><h2>اليوم الدراسي</h2></div><Link href="/teacher/timetable" prefetch={false}>عرض الجدول</Link></header>
        <div className="td16-task-list">{quickTasks.map((task, index) => <Link href={task.href} prefetch={false} key={task.href}>
          <span>{String(index + 1).padStart(2, "0")}</span><div><b>{task.title}</b><small>{task.meta}</small></div><i>‹</i>
        </Link>)}</div>
      </article>

      <article className="td16-class-panel">
        <header><div><small>الفصول والطلاب</small><h2>وصول سريع</h2></div><Link href="/teacher/students" prefetch={false}>كل الفصول</Link></header>
        <div>
          <Link href="/teacher/students" prefetch={false}><span className="td16-ring" style={{ background: "conic-gradient(#0ca58c 100%,#e7eef2 0)" }}><i>فتح</i></span><div><b>إدارة الطلاب</b><small>الفصول والقوائم</small></div><em>‹</em></Link>
          <Link href="/teacher/attendance" prefetch={false}><span className="td16-ring" style={{ background: "conic-gradient(#2f7df4 100%,#e7eef2 0)" }}><i>فتح</i></span><div><b>المتابعة اليومية</b><small>الحضور والاستثناءات</small></div><em>‹</em></Link>
          <Link href="/teacher/notes" prefetch={false}><span className="td16-ring" style={{ background: "conic-gradient(#d5a63e 100%,#e7eef2 0)" }}><i>فتح</i></span><div><b>الملاحظات</b><small>التواصل التربوي</small></div><em>‹</em></Link>
        </div>
      </article>
    </section>

    <section className="td16-analytics-grid">
      <article className="td16-rings-panel">
        <header><small>مؤشرات الأداء</small><h2>الصورة الأكاديمية</h2></header>
        <div>
          <span><i style={{ background: "conic-gradient(#0ca58c 0%,#edf2f4 0)" }}><b>—</b></i><strong>الحضور</strong><small>عند الطلب</small></span>
          <span><i style={{ background: "conic-gradient(#2f7df4 0%,#edf2f4 0)" }}><b>—</b></i><strong>التحصيل</strong><small>عند الطلب</small></span>
          <span><i style={{ background: "conic-gradient(#d5a63e 0%,#edf2f4 0)" }}><b>—</b></i><strong>الرصد</strong><small>عند الطلب</small></span>
          <span><i style={{ background: "conic-gradient(#7a56d8 100%,#edf2f4 0)" }}><b>✓</b></i><strong>الرئيسية</strong><small>بدون استنزاف</small></span>
        </div>
      </article>

      <article className="td16-next-panel"><header><small>الحصة الأقرب</small><span>الجدول</span></header><h2>يومك الدراسي</h2><p>افتح الجدول عند الحاجة فقط، بدل تحميله باستمرار في الخلفية.</p><div><Link href="/teacher/timetable" prefetch={false}>فتح الجدول</Link><Link href="/teacher/notes" prefetch={false}>إضافة ملاحظة</Link></div></article>

      <article className="td16-race-panel"><header><small>مساحة المعلم</small><h2>أدواتك الأساسية</h2></header><p>نفس شكل الصفحة القديمة، مع إيقاف المنافسة والقراءات الثقيلة التي كانت تعمل تلقائيًا.</p><div className="td16-task-list"><Link href="/teacher/reports" prefetch={false}><span>01</span><div><b>مركز التقارير</b><small>التقارير والطباعة</small></div><i>‹</i></Link><Link href="/teacher/portfolio" prefetch={false}><span>02</span><div><b>ملف الإنجاز</b><small>الشواهد والأعمال</small></div><i>‹</i></Link></div></article>
    </section>

    <section className="td16-section-head"><div><small>الفصول التعليمية</small><h2>كل فصل مساحة عمل مستقلة</h2><p>تظهر بيانات الفصل عند فتحه فقط، وليس في الخلفية.</p></div><Link href="/teacher/students" prefetch={false}>إدارة الطلاب والفصول</Link></section>
    <section className="td16-classes"><div className="td16-empty"><b>افتح إدارة الطلاب لعرض الفصول</b><span>أوقفنا تحميل جميع الفصول تلقائيًا في الصفحة الرئيسية لتقليل استهلاك Firebase.</span><Link href="/teacher/students" prefetch={false}>إدارة الطلاب</Link></div></section>

    <section className="td16-bottom"><article><header><small>مسار العمل الذكي</small><h2>ثلاث خطوات تكفي لمعظم يومك</h2></header><div><Link href="/teacher/attendance" prefetch={false}><b>01</b><span><strong>متابعة الفصل</strong><small>الحضور والانضباط</small></span></Link><Link href="/teacher/grades" prefetch={false}><b>02</b><span><strong>رصد التحصيل</strong><small>الوحدة أو الفترة الحالية</small></span></Link><Link href="/teacher/follow-up" prefetch={false}><b>03</b><span><strong>قرار تعليمي</strong><small>إتقان، دعم أو إثراء</small></span></Link></div></article><article className="td16-recommend"><header><small>ملاحظة النظام</small><h2>الشكل القديم بدون القراءات القديمة</h2></header><p>الرئيسية الآن لا تشغل مستمعات Firestore ولا تجمع بيانات الطلاب والحضور تلقائيًا.</p><Link href="/teacher/preparation" prefetch={false}>تحضير الدروس</Link></article></section>
  </main>;
}
