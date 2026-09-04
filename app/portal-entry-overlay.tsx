"use client";

import { usePathname } from "next/navigation";
import StudentDirectQr from "./student-direct-qr";
import "./student-direct-qr.css";
import { PORTAL_IDENTITY } from "./portal-identity-data";

const ENTRY_META: Record<string, { label: string; tone: string }> = {
  "/admin": { label: "إدارة البوابة", tone: "admin" },
  "/teacher": { label: "بوابة المعلم", tone: "teacher" },
  "/student": { label: "الطالب وولي الأمر", tone: "student" },
};

export default function PortalEntryOverlay() {
  const pathname = usePathname();
  const meta = ENTRY_META[pathname];
  if (!meta) return null;

  return <>
    <header className={`academy-entry-header ${meta.tone}`} aria-label={`${meta.label} — بوابة أستاذ لحوني التعليمية`}>
      <div className="academy-entry-identity"><img src={PORTAL_IDENTITY} alt="هوية بوابة أستاذ لحوني التعليمية" /></div>
      <h1>بوابة أستاذ لحوني التعليمية</h1>
      <span>{meta.label}</span>
    </header>
    {pathname === "/student" && <aside className="academy-student-qr-overlay" aria-label="الدخول السريع لبوابة الطالب وولي الأمر"><StudentDirectQr /></aside>}
  </>;
}
