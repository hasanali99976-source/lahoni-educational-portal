"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import "./design-lab-smart-assist.css";

type AssistConfig = {
  label: string;
  title: string;
  text: string;
  links: Array<{ href: string; label: string }>;
};

function getConfig(pathname: string): AssistConfig | null {
  if (pathname.startsWith("/admin")) return {
    label: "مساعد الإدارة",
    title: "تشغيل البوابة بوضوح",
    text: "راجع الحسابات والطلاب أولاً، ثم انتقل للصلاحيات والتقارير. حافظنا على وظائف الإدارة الحالية مع واجهة أكثر وضوحاً.",
    links: [
      { href: "/admin", label: "إدارة المعلمين" },
      { href: "/admin/students", label: "الطلاب والفصول" },
    ],
  };
  if (pathname.startsWith("/teacher")) return {
    label: "مساعد المعلم",
    title: "ما الذي يحتاج انتباهك اليوم؟",
    text: "ابدأ بالحضور والرصد، ثم راجع الطلاب المحتاجين دعماً. المساعد الذكي والتحليل يعملان فوق بياناتك الحالية دون تغييرها.",
    links: [
      { href: "/teacher/dashboard", label: "ملخص اليوم" },
      { href: "/teacher/ai", label: "المساعد الذكي" },
      { href: "/teacher/follow-up", label: "الإتقان والمتابعة" },
    ],
  };
  if (pathname.startsWith("/student") || pathname.startsWith("/parent")) return {
    label: "المساعد التعليمي",
    title: "افهم تقدمك بسرعة",
    text: "تابع التحصيل والحضور وملاحظات المعلم من نفس بوابة الطالب وولي الأمر، وحدد أولوية واحدة للتحسين في كل مرة.",
    links: [
      { href: "/student", label: "بوابة الطالب وولي الأمر" },
    ],
  };
  return null;
}

export default function DesignLabSmartAssist() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const config = getConfig(pathname);
  if (!config) return null;

  return <aside className={`dl-smart-assist ${open ? "open" : ""}`} dir="rtl" aria-label={config.label}>
    {open && <section className="dl-smart-assist-panel">
      <header><span>AI</span><div><small>{config.label}</small><strong>{config.title}</strong></div><button type="button" onClick={() => setOpen(false)} aria-label="إغلاق">×</button></header>
      <p>{config.text}</p>
      <nav>{config.links.map(link => <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label}<span>←</span></Link>)}</nav>
    </section>}
    <button type="button" className="dl-smart-assist-trigger" onClick={() => setOpen(value => !value)} aria-expanded={open}>
      <span>AI</span><div><b>{config.label}</b><small>{open ? "إخفاء المساعدة" : "مساعدة ذكية سريعة"}</small></div>
    </button>
  </aside>;
}
