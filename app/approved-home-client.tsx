"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import StudentDirectQr from "./student-direct-qr";
import "./student-direct-qr.css";

const PORTRAIT = "/icons/ostadh-lahooni-192.jpg";

const portals = [
  { href: "/admin", title: "إدارة البوابة", note: "الدخول إلى إدارة النظام", tone: "admin", icon: "admin" },
  { href: "/teacher", title: "بوابة المعلم", note: "الدخول إلى مساحة عمل المعلم", tone: "teacher", icon: "teacher" },
  { href: "/student", title: "الطالب وولي الأمر", note: "الدخول والمتابعة التعليمية", tone: "student", icon: "student" },
];

function PortalIcon({ type }: { type: string }) {
  if (type === "admin") return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 5l5 3 6-.5 2 5.5 5 3-2 5.8 2 5.7-5 3-2 5.5-6-.5-5 3-5-3-6 .5-2-5.5-5-3 2-5.7-2-5.8 5-3 2-5.5 6 .5 5-3Z"/><path d="m18.5 24 4 4 8-9"/></svg>;
  if (type === "teacher") return <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="15" cy="14" r="5.5"/><path d="M6 38v-9c0-5 4-9 9-9s9 4 9 9v9"/><rect x="27" y="9" width="15" height="20" rx="2"/><path d="M24 25l9-6m-5 9 7-5"/></svg>;
  return <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="17" cy="15" r="6.5"/><circle cx="32" cy="19" r="5"/><path d="M6 39c1.6-8 6.2-12 11-12s9.5 4 11 12M27 39c1.2-5.4 4.2-8.3 7.5-8.3S40.8 33.6 42 39"/></svg>;
}

export default function ApprovedHomeClient() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <main className="lah-gate-home" dir="rtl">
      <section className="lah-gate-shell" aria-label="بوابة أستاذ لحوني التعليمية">
        <div className="lah-gate-identity">
          <img src={PORTRAIT} alt="هوية بوابة أستاذ لحوني التعليمية" loading="eager" decoding="sync" />
        </div>
        <span className="lah-gate-kicker">مرحباً بكم في</span>
        <h1>بوابة أستاذ لحوني التعليمية</h1>
        <p className="lah-gate-subtitle">بوابة موحدة للدخول إلى الإدارة والمعلم والطالب وولي الأمر</p>
        <div className="lah-gate-rule" aria-hidden="true" />

        <nav className="lah-gate-tabs" aria-label="خيارات الدخول">
          {portals.map(portal => (
            <Link key={portal.href} href={portal.href} className={`lah-gate-tab ${portal.tone}`}>
              <span className="lah-gate-tab-icon"><PortalIcon type={portal.icon} /></span>
              <span className="lah-gate-tab-copy"><strong>{portal.title}</strong><small>{portal.note}</small></span>
              <span className="lah-gate-tab-enter" aria-hidden="true">←</span>
            </Link>
          ))}
        </nav>

        <div className="lah-gate-lower">
          <div className="lah-gate-qr" aria-label="الدخول السريع للطالب وولي الأمر"><StudentDirectQr /></div>
          <footer className="lah-gate-credit">إعداد البوابة: <b>الأستاذ حسن علي الطويل</b></footer>
        </div>
      </section>
    </main>,
    document.body,
  );
}
