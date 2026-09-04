"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import StudentBulkUploader from "./student-bulk-uploader";
import "./admin-privacy.css";

const tabs = [
  { href: "/admin", label: "المعلمون", note: "الحسابات • التحدي • التكليفات", icon: "م" },
  { href: "/admin/students", label: "الطلاب", note: "القوائم • الرفع • الفصول", icon: "ط" },
] as const;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const studentsTab = pathname.startsWith("/admin/students");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  return <>
    <aside className="admin-workspace-sidebar" dir="rtl" aria-label="مركز قيادة الإدارة">
      <div className="admin-sidebar-brand">
        <Image src="/icons/lahooni-identity-320.jpg" alt="هوية بوابة أستاذ لحوني التعليمية" width={54} height={54} priority />
        <div><small>مركز القيادة</small><strong>بوابة الإدارة</strong></div>
      </div>

      <div className="admin-sidebar-status"><i /><div><b>النظام متصل</b><small>تشغيل ومتابعة ذكية</small></div></div>

      <nav className="admin-sidebar-tabs" aria-label="التبويبات الرئيسية">
        {tabs.map(tab => {
          const active = tab.href === "/admin" ? pathname === "/admin" : pathname.startsWith(tab.href);
          return <Link key={tab.href} href={tab.href} className={active ? "active" : ""}>
            <span>{tab.icon}</span><div><b>{tab.label}</b><small>{tab.note}</small></div><em>←</em>
          </Link>;
        })}
      </nav>

      <div className="admin-sidebar-smart-note">
        <span>✦</span><div><b>إدارة أذكى</b><small>المعلم يتصدر بالعمل المحفوظ فعليًا، والطلاب يدارون بقوائم كاملة بدل الإدخال المرهق.</small></div>
      </div>

      <Link className="admin-sidebar-home" href="/">العودة للرئيسية</Link>
    </aside>

    <div className={`${studentsTab ? "admin-students-workspace" : "admin-teachers-workspace"} ${advancedOpen ? "advanced-open" : "advanced-closed"}`}>
      {studentsTab && <>
        <StudentBulkUploader />
        <section className="admin-student-modebar" dir="rtl">
          <div><small>طريقة العمل</small><b>الرفع الجماعي هو الوضع الأساسي</b><span>استخدم الأدوات اليدوية فقط عند الحاجة لتعديل طالب أو فصل منفرد.</span></div>
          <button type="button" onClick={() => setAdvancedOpen(value => !value)}>{advancedOpen ? "إخفاء الأدوات اليدوية" : "إظهار الأدوات اليدوية المتقدمة"}</button>
        </section>
      </>}
      {children}
    </div>
  </>;
}
