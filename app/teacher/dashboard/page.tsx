"use client";

import "./dashboard.css";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type Student = { id: string; class?: string; units?: Record<string, { percentage?: number }> };

const links = [
  { href: "/teacher/dashboard", icon: "⌂", label: "الرئيسية" },
  { href: "/teacher/students", icon: "👥", label: "إدارة الطلاب" },
  { href: "/teacher/grades", icon: "✓", label: "التحضير والرصد" },
  { href: "/teacher/reports", icon: "▥", label: "التقارير" },
];

export default function TeacherDashboardPage() {
  const [students, setStudents] = useState<Student[]>([]);

  useEffect(() => onSnapshot(collection(db, "students"), snapshot => {
    setStudents(snapshot.docs.map(item => ({ id: item.id, ...item.data() })) as Student[]);
  }), []);

  const classes = useMemo(
    () => new Set(students.map(student => student.class).filter(Boolean)).size,
    [students]
  );

  const average = useMemo(() => {
    const values = students.flatMap(student =>
      Object.values(student.units || {}).map(unit => Number(unit.percentage || 0)).filter(value => value > 0)
    );
    return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
  }, [students]);

  return (
    <main className="v2-shell">
      <aside className="v2-sidebar">
        <div className="v2-brand">
          <div className="v2-logo">ت</div>
          <div><strong>بوابة التهذيب</strong><small>نظام المتابعة التعليمية</small></div>
        </div>
        <nav>
          {links.map(link => <Link key={link.href} href={link.href} className={link.href.endsWith("dashboard") ? "active" : ""}><span>{link.icon}</span>{link.label}</Link>)}
        </nav>
        <Link className="v2-logout" href="/">العودة للبوابة</Link>
      </aside>

      <section className="v2-content">
        <header className="v2-topbar">
          <div><h1>مرحبًا أ. حسن علي الطويل</h1><p>لوحة متابعة مادة التاريخ — الصف الثاني الثانوي</p></div>
          <div className="v2-teacher-chip"><span>معلم التاريخ</span><b>ح</b></div>
        </header>

        <section className="v2-hero">
          <div className="v2-hero-copy">
            <span className="v2-pill">مدرسة التهذيب الثانوية</span>
            <h2>إدارة تعليمية أسهل، أسرع، وأكثر وضوحًا</h2>
            <p>تابع طلابك، سجّل التحضير اليومي، وارصد الدرجات في مكان واحد منظم.</p>
            <div className="v2-hero-actions"><Link href="/teacher/grades">ابدأ التحضير والرصد</Link><Link href="/teacher/students">إدارة الفصول</Link></div>
          </div>
          <div className="v2-teacher-photo" aria-label="صورة المعلم الحالية" />
        </section>

        <section className="v2-stats">
          <article><i>👨‍🎓</i><div><span>إجمالي الطلاب</span><strong>{students.length}</strong></div></article>
          <article><i>🏫</i><div><span>عدد الفصول</span><strong>{classes}</strong></div></article>
          <article><i>📈</i><div><span>متوسط الأداء</span><strong>{average}%</strong></div></article>
          <article><i>📚</i><div><span>الوحدات</span><strong>٥</strong></div></article>
        </section>

        <section className="v2-section-title"><div><h2>الوصول السريع</h2><p>اختر المهمة التي تريد تنفيذها الآن</p></div></section>
        <section className="v2-quick-grid">
          <Link href="/teacher/students"><span className="v2-quick-icon blue">👥</span><div><h3>إدارة الطلاب</h3><p>الفصول، الإضافة، التعديل والاستيراد</p></div><b>←</b></Link>
          <Link href="/teacher/grades"><span className="v2-quick-icon green">✓</span><div><h3>التحضير والرصد</h3><p>سجل موحد للحضور والدرجات</p></div><b>←</b></Link>
          <Link href="/teacher/reports"><span className="v2-quick-icon gold">▥</span><div><h3>التقارير</h3><p>ملخصات الطلاب والفصول والطباعة</p></div><b>←</b></Link>
        </section>
      </section>
    </main>
  );
}
