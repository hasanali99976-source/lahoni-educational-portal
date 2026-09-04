"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import StudentDirectQr from "./student-direct-qr";
import "./student-direct-qr.css";

const PORTRAIT = "/icons/lahooni-identity-320.jpg";

const ENTRY_META: Record<string, { label: string; tone: string; note: string }> = {
  "/admin": { label: "إدارة البوابة", tone: "admin", note: "إدارة وتنظيم" },
  "/teacher": { label: "بوابة المعلم", tone: "teacher", note: "تعليم ومتابعة" },
  "/student": { label: "الطالب وولي الأمر", tone: "student", note: "متابعة وتواصل" },
};

export default function PortalEntryOverlay() {
  const pathname = usePathname();
  const meta = ENTRY_META[pathname];
  if (!meta) return null;

  return <>
    <header className={`academy-entry-header ${meta.tone}`} aria-label={`${meta.label} — بوابة أستاذ لحوني التعليمية`}>
      <div className="academy-entry-brand">
        <div className="academy-entry-identity"><img src={PORTRAIT} alt="هوية بوابة أستاذ لحوني التعليمية" /></div>
        <div className="academy-entry-title"><strong>بوابة أستاذ لحوني التعليمية</strong><small>{meta.note}</small></div>
      </div>
      <div className="academy-entry-current"><span>{meta.label}</span></div>
      <Link href="/" className="academy-entry-home">الرئيسية</Link>
    </header>
    {pathname === "/student" && <aside className="academy-student-qr-overlay" aria-label="الدخول السريع لبوابة الطالب وولي الأمر"><StudentDirectQr /></aside>}
  </>;
}
