"use client";

import { usePathname } from "next/navigation";
import StudentDirectQr from "./student-direct-qr";
import "./student-direct-qr.css";

export default function PortalEntryOverlay() {
  const pathname = usePathname();
  if (pathname !== "/student") return null;
  return <aside className="academy-student-qr-overlay" aria-label="الدخول السريع لبوابة الطالب وولي الأمر"><StudentDirectQr /></aside>;
}
