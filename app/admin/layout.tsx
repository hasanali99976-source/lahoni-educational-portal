"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AdminOverview from "./admin-overview";
import "./admin-privacy.css";
import "./admin-command-v3.css";
import "./admin-command-v4.css";
import "./admin-clarity-v5.css";
import "./admin-dashboard-premium.css";

function AdminIcon({ type }: { type: "home" | "teachers" | "students" | "competition" | "classes" | "reports" | "settings" }) {
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (type === "home") return <svg {...common}><path d="m3 10 9-7 9 7v10h-6v-6H9v6H3z"/></svg>;
  if (type === "teachers") return <svg {...common}><circle cx="8" cy="7" r="3"/><path d="M3 20v-2a5 5 0 0 1 5-5h1a5 5 0 0 1 5 5v2M15 5h6v10h-6M17 9h2"/></svg>;
  if (type === "students") return <svg {...common}><path d="m3 8 9-5 9 5-9 5z"/><path d="M7 11v5c3 2 7 2 10 0v-5M21 8v7"/></svg>;
  if (type === "competition") return <svg {...common}><path d="M8 4h8v4c0 4-2 7-4 7s-4-3-4-7V4Z"/><path d="M8 6H4c0 4 2 6 5 6M16 6h4c0 4-2 6-5 6M12 15v4M8 21h8"/></svg>;
  if (type === "classes") return <svg {...common}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h10M7 16h6"/></svg>;
  if (type === "reports") return <svg {...common}><path d="M5 20V10M10 20V4M15 20v-7M20 20V7"/></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 8.97 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.52-1.03H3v-4h.08A1.7 1.7 0 0 0 4.6 8.97a1.7 1.7 0 0 0-.34-1.88L4.2 7.03 7.03 4.2l.06.06A1.7 1.7 0 0 0 8.97 4.6 1.7 1.7 0 0 0 10 3.08V3h4v.08A1.7 1.7 0 0 0 15.03 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06a1.7 1.7 0 0 0-.34 1.88A1.7 1.7 0 0 0 20.92 10H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z"/></svg>;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const students = pathname.startsWith("/admin/students");

  return <div className="admin-v4-frame" dir="rtl">
    <aside className="admin-v4-sidebar">
      <div className="admin-v4-sidebrand">
        <Image src="/icons/lahooni-identity-320.jpg" alt="هوية بوابة أستاذ لحوني التعليمية" width={64} height={64} priority />
        <div><small>منصة</small><strong>أستاذ لحوني التعليمية</strong></div>
      </div>

      <nav className="admin-v4-side-nav" aria-label="أقسام الإدارة">
        <Link href="/admin#overview" className={!students ? "active" : ""}><AdminIcon type="home"/><span>الرئيسية</span></Link>
        <Link href="/admin#teachers-management"><AdminIcon type="teachers"/><span>إدارة المعلمين</span></Link>
        <Link href="/admin/students"><AdminIcon type="students"/><span>إدارة الطلاب</span></Link>
        <a href="/admin#competition"><AdminIcon type="competition"/><span>المسابقة التنافسية</span></a>
        <Link href="/admin/students#classes"><AdminIcon type="classes"/><span>الفصول الدراسية</span></Link>
        <a href="/admin#reports"><AdminIcon type="reports"/><span>التقارير والإحصائيات</span></a>
        <a href="/admin#settings"><AdminIcon type="settings"/><span>الإعدادات</span></a>
      </nav>

      <div className="admin-v4-sidequote"><span>التعليم يصنع المستقبل</span><i/></div>
      <div className="admin-v4-side-signature">تصميم وتنفيذ<br/><b>الأستاذ حسن علي الطويل</b></div>
    </aside>

    <section className="admin-v4-main">
      <header className="admin-v4-topbar">
        <div className="admin-v4-welcome"><small>{students ? "إدارة الطلاب والفصول" : "مرحبًا بك في بوابة الإدارة"}</small><strong>{students ? "الطلاب والفصول" : "مركز الإدارة الذكي"}</strong><span>متابعة واضحة، بيانات مترابطة، وقرارات أسرع</span></div>
        <div className="admin-v4-profile">
          <div><strong>أ. حسن علي الطويل</strong><small>مدير المنصة</small></div>
          <Image src="/icons/lahooni-identity-320.jpg" alt="مدير المنصة" width={50} height={50}/>
          <Link href="/" className="admin-v4-home-link">الصفحة الرئيسية</Link>
        </div>
      </header>

      {!students && <AdminOverview />}
      <main className={`admin-v4-workspace ${students ? "is-students" : "is-teachers"}`} id={students ? "students-management" : "teachers-management"}>{children}</main>
    </section>
  </div>;
}
