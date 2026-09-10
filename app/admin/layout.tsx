"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import "./admin-privacy.css";
import "./admin-command-v3.css";
import "./admin-command-v4.css";
import "./admin-clarity-v5.css";
import "./admin-dashboard-premium.css";

function AdminIcon({ type }: { type: "home" | "teachers" | "students" | "competition" }) {
  const common = { width: 21, height: 21, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (type === "home") return <svg {...common}><path d="m3 10 9-7 9 7v10h-6v-6H9v6H3z"/></svg>;
  if (type === "teachers") return <svg {...common}><circle cx="8" cy="7" r="3"/><path d="M3 20v-2a5 5 0 0 1 5-5h1a5 5 0 0 1 5 5v2M15 5h6v10h-6M17 9h2"/></svg>;
  if (type === "students") return <svg {...common}><path d="m3 8 9-5 9 5-9 5z"/><path d="M7 11v5c3 2 7 2 10 0v-5M21 8v7"/></svg>;
  return <svg {...common}><path d="M8 4h8v4c0 4-2 7-4 7s-4-3-4-7V4Z"/><path d="M8 6H4c0 4 2 6 5 6M16 6h4c0 4-2 6-5 6M12 15v4M8 21h8"/></svg>;
}

const sections = [
  { href: "/admin", label: "الرئيسية", type: "home" as const },
  { href: "/admin/teachers", label: "إدارة المعلمين", type: "teachers" as const },
  { href: "/admin/students", label: "إدارة الطلاب", type: "students" as const },
  { href: "/admin/competition", label: "التنافس بين المعلمين", type: "competition" as const },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/admin/teachers", { cache: "no-store", credentials: "same-origin" })
      .then(response => { if (live) setAuthenticated(response.ok); })
      .catch(() => { if (live) setAuthenticated(false); });
    return () => { live = false; };
  }, [pathname]);

  if (pathname === "/admin" && authenticated !== true) return <>{children}</>;
  if (authenticated !== true) return <main className="admin-shell-gate" dir="rtl"><Image src="/icons/lahooni-identity-320.jpg" alt="بوابة أستاذ لحوني التعليمية" width={72} height={72}/><strong>بوابة الإدارة</strong><span>جارٍ التحقق من جلسة الدخول…</span></main>;

  const title = pathname.startsWith("/admin/teachers") ? "إدارة المعلمين" : pathname.startsWith("/admin/students") ? "إدارة الطلاب والفصول" : pathname.startsWith("/admin/competition") ? "التنافس بين المعلمين" : "لوحة الإدارة";

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", cache: "no-store" }).catch(() => undefined);
    window.location.assign("/admin");
  }

  return <div className="admin-v4-frame" dir="rtl">
    <aside className="admin-v4-sidebar">
      <div className="admin-v4-sidebrand">
        <Image src="/icons/lahooni-identity-320.jpg" alt="هوية بوابة أستاذ لحوني التعليمية" width={64} height={64} priority />
        <div><small>منصة</small><strong>أستاذ لحوني التعليمية</strong></div>
      </div>
      <nav className="admin-v4-side-nav" aria-label="أقسام الإدارة">
        {sections.map(item => {
          const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
          return <Link key={item.href} href={item.href} className={active ? "active" : ""}><AdminIcon type={item.type}/><span>{item.label}</span></Link>;
        })}
      </nav>
      <div className="admin-v4-sidequote"><span>إدارة واضحة • قرار أسرع</span><i/></div>
      <div className="admin-v4-side-signature">تصميم وتنفيذ<br/><b>الأستاذ حسن علي الطويل</b></div>
    </aside>

    <section className="admin-v4-main">
      <section className="admin-v4-identity" aria-label="هوية مدير المنصة">
        <div className="admin-v4-identity-copy"><small>بوابة الإدارة</small><h1>{title}</h1><p>متابعة مدرسية ذكية مرتبطة مباشرة ببيانات المنصة.</p></div>
        <div className="admin-v4-person">
          <Image src="/icons/lahooni-identity-320.jpg" alt="أ. حسن علي الطويل" width={58} height={58}/>
          <div><strong>أ. حسن علي الطويل</strong><small>مدير المنصة</small></div>
          <button type="button" onClick={logout}>تسجيل الخروج</button>
        </div>
      </section>
      <main className="admin-v4-workspace">{children}</main>
    </section>
  </div>;
}