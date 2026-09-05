"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import "./admin-privacy.css";
import "./admin-command-v3.css";
import "./admin-command-v4.css";
import "./admin-clarity-v5.css";

function AdminIcon({ type }: { type: "teachers" | "students" }) {
  const common = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (type === "teachers") return <svg {...common}><circle cx="8" cy="7" r="3"/><path d="M3 20v-2a5 5 0 0 1 5-5h1a5 5 0 0 1 5 5v2M15 5h6v10h-6M17 9h2"/></svg>;
  return <svg {...common}><path d="m3 8 9-5 9 5-9 5z"/><path d="M7 11v5c3 2 7 2 10 0v-5M21 8v7"/></svg>;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const students = pathname.startsWith("/admin/students");

  return <div className="admin-v3-frame admin-v4-frame admin-v5-frame" dir="rtl">
    <header className="admin-v3-topbar admin-v4-topbar">
      <div className="admin-v3-brand admin-v4-brand">
        <Image src="/icons/lahooni-identity-320.jpg" alt="هوية بوابة أستاذ لحوني التعليمية" width={50} height={50} priority />
        <div><small>بوابة أستاذ لحوني التعليمية</small><strong>مركز الإدارة</strong></div>
      </div>
      <div className="admin-v3-top-actions admin-v4-top-actions">
        <span className="admin-v3-live admin-v4-live"><i /> النظام متصل</span>
        <span className="admin-v4-control-code">لوحة القيادة</span>
        <Link href="/">الرئيسية</Link>
      </div>
    </header>

    <section className="admin-v4-mission" aria-label="مركز الإدارة">
      <div className="admin-v4-mission-orbit"><span>◎</span><i /><i /><i /></div>
      <div className="admin-v4-mission-copy">
        <small>القيادة التعليمية</small>
        <h1>كل ما تحتاجه الإدارة في مساحة واحدة واضحة</h1>
        <p>الحسابات، الفصول، الطلاب، المنافسة ومؤشرات العمل الحقيقي مرتبة لتصل للمعلومة والإجراء بسرعة.</p>
      </div>
      <div className="admin-v4-mission-tags"><span>المعلمون</span><span>الطلاب</span><span>المؤشرات</span><span>المتابعة</span></div>
    </section>

    <nav className="admin-v3-switch admin-v4-switch" aria-label="أقسام الإدارة">
      <Link href="/admin" className={!students ? "active" : ""}>
        <span className="admin-v3-switch-icon"><AdminIcon type="teachers" /></span>
        <div><b>المعلمون</b><small>الحسابات • التكليفات • المنافسة</small></div>
      </Link>
      <Link href="/admin/students" className={students ? "active" : ""}>
        <span className="admin-v3-switch-icon"><AdminIcon type="students" /></span>
        <div><b>الطلاب والفصول</b><small>القوائم • الفصول • الرفع والتعديل</small></div>
      </Link>
    </nav>

    <main className={`admin-v3-workspace admin-v4-workspace ${students ? "is-students" : "is-teachers"}`}>{children}</main>
  </div>;
}
