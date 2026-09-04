"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import StudentDirectQr from "./student-direct-qr";
import "./student-direct-qr.css";
import "./approved-home.css";
import "./approved-home-effects.css";

const PORTRAIT = "/icons/lahooni-identity-clear.jpg";
const PORTRAIT_FALLBACK = "/icons/ostadh-lahooni-192.jpg";

const portals = [
  { href: "/admin", title: "إدارة البوابة", text: "إدارة المستخدمين، الإعدادات، التقارير والصلاحيات", tone: "admin", icon: "admin" },
  { href: "/teacher", title: "بوابة المعلم", text: "إدارة الاختبارات، الحضور، التقارير والأنشطة والمصادر التعليمية", tone: "teacher", icon: "teacher" },
  { href: "/student", title: "الطالب وولي الأمر", text: "متابعة أداء الطالب، الاختبارات والتواصل المدرسي", tone: "student", icon: "student" },
];

function PortalIcon({ type }: { type: string }) {
  if (type === "admin") return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 5l5 3 6-.5 2 5.5 5 3-2 5.8 2 5.7-5 3-2 5.5-6-.5-5 3-5-3-6 .5-2-5.5-5-3 2-5.7-2-5.8 5-3 2-5.5 6 .5 5-3Z"/><path d="m18.5 24 4 4 8-9"/></svg>;
  if (type === "teacher") return <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="15" cy="14" r="5.5"/><path d="M6 38v-9c0-5 4-9 9-9s9 4 9 9v9"/><rect x="27" y="9" width="15" height="20" rx="2"/><path d="M24 25l9-6m-5 9 7-5"/></svg>;
  return <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="17" cy="15" r="6.5"/><circle cx="32" cy="19" r="5"/><path d="M6 39c1.6-8 6.2-12 11-12s9.5 4 11 12M27 39c1.2-5.4 4.2-8.3 7.5-8.3S40.8 33.6 42 39"/></svg>;
}

function IdentityImage({ alt }: { alt: string }) {
  return <img src={PORTRAIT} alt={alt} loading="eager" decoding="sync" onError={(event) => {
    const image = event.currentTarget;
    if (!image.src.endsWith(PORTRAIT_FALLBACK)) image.src = PORTRAIT_FALLBACK;
  }} />;
}

export default function ApprovedHomeClient() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <main className="lah-approved-home" dir="rtl">
      <div className="lah-subject-picture" aria-hidden="true" />
      <div className="lah-approved-sheen" aria-hidden="true" />
      <div className="lah-twinkles" aria-hidden="true" />

      <header className="lah-approved-topbar">
        <div className="lah-approved-brand">
          <IdentityImage alt="هوية بوابة أستاذ لحوني التعليمية" />
          <strong><span>بوابة</span> أستاذ لحوني التعليمية</strong>
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
              <IdentityImage alt="هوية أستاذ لحوني" />
            </div>
          </div>
        </section>

        <section className="lah-approved-access" aria-label="خيارات الدخول">
          <div className="lah-approved-qr" aria-label="الدخول السريع لبوابة الطالب وولي الأمر">
            <StudentDirectQr />
          </div>

          <div className="lah-entry-panels">
            {portals.map((portal) => (
              <Link key={portal.href} href={portal.href} className={`lah-entry-panel ${portal.tone}`}>
                <span className="lah-entry-halo" aria-hidden="true" />
                <span className="lah-entry-icon"><PortalIcon type={portal.icon}/></span>
                <h2>{portal.title}</h2>
                <p>{portal.text}</p>
                <span className="lah-entry-divider" aria-hidden="true" />
                <span className="lah-entry-button"><b>دخول</b><i>←</i></span>
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
