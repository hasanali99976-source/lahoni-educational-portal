"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import "./admin-shell.css";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const overviewTab = pathname === "/admin" || pathname === "/admin/";
  const studentsTab = pathname.startsWith("/admin/students");
  const teachersTab = pathname.startsWith("/admin/teachers");

  return <div className={`admin-smart-shell ${studentsTab ? "students-active" : teachersTab ? "teachers-active" : "overview-active"}`} dir="rtl">
    <aside className="admin-smart-sidebar">
      <div className="admin-smart-brand"><span>ل</span><div><b>إدارة البوابة</b><small>مركز الإدارة</small></div></div>
      <nav>
        <Link className={overviewTab ? "active" : ""} href="/admin" prefetch><span>⌂</span><div><b>النظرة العامة</b><small>المؤشرات والاختصارات</small></div></Link>
        <Link className={studentsTab ? "active" : ""} href="/admin/students" prefetch><span>🎓</span><div><b>الطلاب والفصول</b><small>القوائم والفصول والطباعة</small></div></Link>
        <Link className={teachersTab ? "active" : ""} href="/admin/teachers" prefetch><span>👨‍🏫</span><div><b>المعلمون والإسناد</b><small>الحسابات والمواد والصلاحيات</small></div></Link>
      </nav>
      <div className="admin-smart-tip"><b>إدارة مباشرة</b><p>تنقل خفيف بين صفحات الإدارة دون طلبات تحقق أو واجهات مكررة داخل القائمة.</p></div>
      <Link className="admin-smart-home" href="/">العودة للرئيسية</Link>
    </aside>
    <section className="admin-smart-content">{children}</section>
  </div>;
}
