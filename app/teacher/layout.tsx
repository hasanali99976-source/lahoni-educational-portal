"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import "./teacher-shell.css";
import "./tab-fix.css";

const tabs = [
  { href: "/teacher/grades", icon: "✎", label: "رصد الدرجات", note: "الوحدات والاختبارات" },
  { href: "/teacher/research", icon: "⌕", label: "رصد البحث", note: "درجة البحث الفصلية" },
  { href: "/teacher/attendance", icon: "◷", label: "التحضير اليومي", note: "الحضور والغياب" },
  { href: "/teacher/reports", icon: "▥", label: "ملخص الطالب", note: "التقارير والطباعة" },
  { href: "/teacher/follow-up", icon: "!", label: "المتابعة والإتقان", note: "غير المتقنين والتنبيهات" },
  { href: "/teacher/students", icon: "♟", label: "إدارة الطلاب", note: "الفصول والبيانات" },
];

export default function TeacherLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/teacher";
  const [ready, setReady] = useState(isLoginPage);

  useEffect(() => {
    if (isLoginPage) { setReady(true); return; }
    let active = true;
    fetch("/api/teacher-session", { cache: "no-store" })
      .then(response => {
        if (!response.ok) throw new Error("unauthorized");
        if (active) setReady(true);
      })
      .catch(() => {
        if (active) router.replace("/teacher");
      });
    return () => { active = false; };
  }, [isLoginPage, pathname, router]);

  async function logout() {
    await fetch("/api/teacher-logout", { method: "POST" });
    router.replace("/teacher");
    router.refresh();
  }

  if (isLoginPage) return <>{children}</>;
  if (!ready) return <main className="teacher-shell-loading">جارٍ التحقق من الدخول الآمن...</main>;

  return <div className="teacher-app-shell" dir="rtl">
    <header className="teacher-fixed-header">
      <div className="teacher-shell-brand"><div className="teacher-shell-logo">ت</div><div><strong>سجل متابعة الطلاب</strong><small>الأستاذ حسن علي الطويل — مادة التاريخ</small></div></div>
      <nav className="teacher-tabs" aria-label="أقسام بوابة المعلم">
        {tabs.map(tab=>{const active=pathname.startsWith(tab.href);return <Link key={tab.href} href={tab.href} className={active?"active":""}><span className="teacher-tab-icon" aria-hidden="true">{tab.icon}</span><span className="teacher-tab-copy"><b>{tab.label}</b><small>{tab.note}</small></span></Link>})}
      </nav>
      <button type="button" className="teacher-logout" onClick={logout}>تسجيل خروج</button>
    </header>
    <section className="teacher-welcome-strip" aria-label="لوحة ترحيبية">
      <div className="teacher-welcome-copy"><span className="teacher-welcome-badge">بوابة التهذيب التعليمية</span><h2>كل تفاصيل طلابك في مكان واحد</h2><p>رصد أسهل، متابعة أوضح، وتقارير جاهزة للطالب وولي الأمر.</p><div className="teacher-welcome-points"><span>✓ واجهة سريعة</span><span>✓ بيانات منظمة</span><span>✓ تقارير فورية</span></div></div>
      <img src="/students-learning.svg" alt="طلاب يتعلمون داخل بيئة مدرسية" />
      <small className="teacher-prepared-by">إعداد / الأستاذ حسن علي الطويل</small>
    </section>
    <div className="teacher-page-content">{children}</div>
  </div>;
}
