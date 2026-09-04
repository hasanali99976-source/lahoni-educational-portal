"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import StudentDirectQr from "./student-direct-qr";
import "./student-direct-qr.css";
import "./approved-home.css";

const PORTRAIT = "/icons/approved-portrait.jpg";
const PORTRAIT_FALLBACK = "/icons/ostadh-lahooni-192.jpg";

const portals = [
  { href: "/admin", title: "إدارة البوابة", text: "إدارة المستخدمين، الإعدادات، التقارير والصلاحيات.", tone: "admin", icon: "admin" },
  { href: "/teacher", title: "بوابة المعلم", text: "إدارة الاختبارات، الحضور، التقارير والأنشطة والمصادر التعليمية.", tone: "teacher", icon: "teacher" },
  { href: "/student", title: "الطالب وولي الأمر", text: "متابعة أداء الطالب، الاختبارات والتواصل المدرسي.", tone: "student", icon: "student" },
];

function PortalIcon({ type }: { type: string }) {
  if (type === "admin") return <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="17" r="7"/><path d="M10 39c1.8-8 7.2-12 14-12s12.2 4 14 12"/><circle cx="36" cy="14" r="4.5"/><path d="M36 6v3m0 10v3m8-8h-3m-10 0h-3m13.7-5.7-2.1 2.1m-7.2 7.2-2.1 2.1m11.4 0-2.1-2.1m-7.2-7.2-2.1-2.1"/></svg>;
  if (type === "teacher") return <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="16" cy="15" r="6"/><path d="M7 38v-8c0-5 4-9 9-9s9 4 9 9v8"/><rect x="26" y="9" width="16" height="22" rx="2"/><path d="M23 24l8-6m-5 9 6-5"/></svg>;
  return <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="18" cy="16" r="7"/><circle cx="33" cy="19" r="5"/><path d="M6 39c1.8-8 6.7-12 12-12s10.2 4 12 12M27 38c1.3-5.5 4.4-8.2 8-8.2 3.5 0 6.4 2.8 7.6 8.2"/></svg>;
}

function IdentityImage({ className = "", alt }: { className?: string; alt: string }) {
  return <img className={className} src={PORTRAIT} alt={alt} onError={(event) => {
    const image = event.currentTarget;
    if (!image.src.endsWith(PORTRAIT_FALLBACK)) image.src = PORTRAIT_FALLBACK;
  }} />;
}

function SubjectDecor() {
  return <div className="lah-subject-decor" aria-hidden="true">
    <span className="lah-subject-mark mark-book">📖</span>
    <span className="lah-subject-mark mark-science">⚗</span>
    <span className="lah-subject-mark mark-math">∑</span>
    <span className="lah-subject-mark mark-earth">◎</span>
    <span className="lah-subject-mark mark-art">✎</span>
    <span className="lah-subject-mark mark-idea">✦</span>
  </div>;
}

export default function ApprovedHomeClient() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <main className="lah-approved-home" dir="rtl">
      <SubjectDecor />
      <div className="lah-approved-sheen" aria-hidden="true" />

      <header className="lah-approved-topbar">
        <div className="lah-approved-brand">
          <IdentityImage alt="هوية بوابة أستاذ لحوني التعليمية" />
          <strong>بوابة أستاذ لحوني التعليمية</strong>
        </div>
      </header>

      <div className="lah-approved-stage">
        <section className="lah-approved-hero">
          <div className="lah-approved-motto" aria-hidden="true">معاً<br/>نصنع فرقاً<br/>في التعليم</div>

          <div className="lah-approved-copy">
            <span className="lah-approved-welcome">مرحباً بكم في</span>
            <h1>بوابة أستاذ لحوني التعليمية</h1>
            <p>مصادر موثوقة .. تحضير أسهل .. مستقبل أفضل</p>
            <div className="lah-approved-rule" />
          </div>

          <div className="lah-approved-portrait">
            <div className="lah-approved-portrait-frame">
              <IdentityImage alt="أستاذ لحوني" />
            </div>
          </div>
        </section>

        <section className="lah-approved-access" aria-label="خيارات الدخول">
          <div className="lah-approved-qr" aria-label="الدخول السريع لبوابة الطالب وولي الأمر">
            <StudentDirectQr />
          </div>

          <div className="lah-approved-cards">
            {portals.map((portal) => (
              <Link key={portal.href} href={portal.href} className={`lah-approved-card ${portal.tone}`}>
                <span className="lah-approved-icon"><PortalIcon type={portal.icon}/></span>
                <h2>{portal.title}</h2>
                <p>{portal.text}</p>
                <span className="lah-approved-enter">←</span>
              </Link>
            ))}
          </div>
        </section>

        <footer className="lah-approved-credit">إعداد البوابة: <b>الأستاذ حسن علي الطويل</b></footer>
      </div>
    </main>,
    document.body,
  );
}
