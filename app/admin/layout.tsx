"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import "./admin-privacy.css";
import "./admin-command-v3.css";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const students = pathname.startsWith("/admin/students");

  return <div className="admin-v3-frame" dir="rtl">
    <header className="admin-v3-topbar">
      <div className="admin-v3-brand">
        <Image src="/icons/lahooni-identity-320.jpg" alt="هوية بوابة أستاذ لحوني التعليمية" width={48} height={48} priority />
        <div><small>بوابة أستاذ لحوني التعليمية</small><strong>مركز الإدارة</strong></div>
      </div>
      <div className="admin-v3-top-actions">
        <span className="admin-v3-live"><i /> النظام متصل</span>
        <Link href="/">الرئيسية</Link>
      </div>
    </header>

    <nav className="admin-v3-switch" aria-label="أقسام الإدارة">
      <Link href="/admin" className={!students ? "active" : ""}>
        <span className="admin-v3-switch-icon">👨‍🏫</span>
        <div><b>المعلمون</b><small>الحسابات والتنافس والنشاط</small></div>
      </Link>
      <Link href="/admin/students" className={students ? "active" : ""}>
        <span className="admin-v3-switch-icon">🎓</span>
        <div><b>الطلاب والفصول</b><small>الصف ← الفصل ← القائمة</small></div>
      </Link>
    </nav>

    <main className={`admin-v3-workspace ${students ? "is-students" : "is-teachers"}`}>{children}</main>
  </div>;
}
