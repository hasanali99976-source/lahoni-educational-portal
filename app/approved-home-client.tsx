"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import StudentDirectQr from "./student-direct-qr";
import "./student-direct-qr.css";

const PORTRAIT = "/icons/lahooni-identity-320.jpg";

const portals = [
  { href: "/admin", title: "إدارة البوابة", text: "إدارة المستخدمين، الصفوف، الإعدادات والتقارير", tone: "admin", icon: "admin" },
  { href: "/teacher", title: "بوابة المعلم", text: "إدارة الصفوف، الحضور، الدرجات والمتابعة الذكية", tone: "teacher", icon: "teacher" },
  { href: "/student", title: "الطالب وولي الأمر", text: "متابعة التحصيل، الاختبارات، الحضور والملاحظات والتواصل المدرسي", tone: "student", icon: "student" },
];

const features = [
  { icon: "target", title: "تصنع جيلاً", text: "لمستقبل أفضل" },
  { icon: "idea", title: "بيئة تعليمية", text: "ذكية ومحفزة" },
  { icon: "people", title: "شراكة فاعلة", text: "بين المدرسة والأسرة" },
  { icon: "chart", title: "متابعة مستمرة", text: "للتحصيل والأداء" },
];

function PortalIcon({ type }: { type: string }) {
  if (type === "admin") return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 5l5 3 6-.5 2 5.5 5 3-2 5.8 2 5.7-5 3-2 5.5-6-.5-5 3-5-3-6 .5-2-5.5-5-3 2-5.7-2-5.8 5-3 2-5.5 6 .5 5-3Z"/><path d="m18.5 24 4 4 8-9"/></svg>;
  if (type === "teacher") return <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="15" cy="14" r="5.5"/><path d="M6 38v-9c0-5 4-9 9-9s9 4 9 9v9"/><rect x="27" y="9" width="15" height="20" rx="2"/><path d="M24 25l9-6m-5 9 7-5"/></svg>;
  return <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="17" cy="15" r="6.5"/><circle cx="32" cy="19" r="5"/><path d="M6 39c1.6-8 6.2-12 11-12s9.5 4 11 12M27 39c1.2-5.4 4.2-8.3 7.5-8.3S40.8 33.6 42 39"/></svg>;
}

function FeatureIcon({ type }: { type: string }) {
  if (type === "target") return <svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="13"/><circle cx="20" cy="20" r="7"/><path d="M20 20 33 7M27 7h6v6"/></svg>;
  if (type === "idea") return <svg viewBox="0 0 40 40" aria-hidden="true"><path d="M12 17a8 8 0 1 1 16 0c0 4-3 5-4 8h-8c-1-3-4-4-4-8Z"/><path d="M16 29h8M17 33h6"/></svg>;
  if (type === "people") return <svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="14" cy="14" r="5"/><circle cx="27" cy="16" r="4"/><path d="M5 33c1-8 5-12 9-12s8 4 9 12M22 32c1-6 4-9 7-9 4 0 6 3 7 9"/></svg>;
  return <svg viewBox="0 0 40 40" aria-hidden="true"><path d="M7 32V22h6v10M17 32V15h6v17M27 32V9h6v23"/></svg>;
}

export default function ApprovedHomeClient() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <main className="academy-home" dir="rtl">
      <div className="academy-page-frame" aria-hidden="true" />
      <div className="academy-subject-art" aria-hidden="true" />
      <div className="academy-light-sweep" aria-hidden="true" />

      <header className="academy-top-band">
        <div className="academy-brand-mini">
          <img src={PORTRAIT} alt="هوية بوابة أستاذ لحوني التعليمية" />
          <strong>بوابة أستاذ لحوني التعليمية</strong>
        </div>
      </header>

      <section className="academy-hero">
        <aside className="academy-motto" aria-hidden="true">تعليم ذكي<br/>تواصل أفضل<br/>مستقبل واعد</aside>
        <div className="academy-hero-copy">
          <span>مرحباً بكم في</span>
          <h1>بوابة أستاذ لحوني التعليمية</h1>
          <p>منصة مدرسية ذكية تربط الإدارة والمعلم والطالب وولي الأمر</p>
          <i aria-hidden="true" />
        </div>
        <div className="academy-portrait-wrap"><div className="academy-portrait-ring"><img src={PORTRAIT} alt="هوية أستاذ لحوني" /></div></div>
      </section>

      <aside className="academy-side-quote" aria-hidden="true">المعرفة<br/>والتحليل<br/>والتواصل<br/>في مكان واحد</aside>

      <section className="academy-access" aria-label="خيارات الدخول">
        <div className="academy-qr-panel" aria-label="الدخول السريع لبوابة الطالب وولي الأمر"><StudentDirectQr /></div>
        <nav className="academy-portal-grid" aria-label="بوابات الدخول">
          {portals.map(portal => <Link key={portal.href} href={portal.href} className={`academy-portal-card ${portal.tone}`}>
            <span className="academy-card-icon"><PortalIcon type={portal.icon} /></span>
            <h2>{portal.title}</h2><p>{portal.text}</p><span className="academy-card-enter" aria-hidden="true">←</span>
          </Link>)}
        </nav>
      </section>

      <section className="academy-feature-strip" aria-label="مزايا البوابة">
        {features.map(feature => <article key={feature.icon}><span><FeatureIcon type={feature.icon} /></span><div><strong>{feature.title}</strong><small>{feature.text}</small></div></article>)}
      </section>

      <footer className="academy-credit">إعداد البوابة: <b>الأستاذ حسن علي الطويل</b><span aria-hidden="true">✎</span></footer>
      <div className="academy-bottom-band" aria-hidden="true" />
    </main>,
    document.body,
  );
}
