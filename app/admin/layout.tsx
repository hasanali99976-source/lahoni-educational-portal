"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import "./admin-privacy.css";

const tabs = [
  { href: "/admin", label: "المعلمون", note: "الحسابات والنشاط", icon: "م" },
  { href: "/admin/students", label: "الطلاب", note: "القوائم والفصول", icon: "ط" },
] as const;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return <>
    <aside className="admin-workspace-sidebar" dir="rtl" aria-label="مركز قيادة الإدارة">
      <div className="admin-sidebar-brand">
        <Image src="/icons/lahooni-identity-320.jpg" alt="هوية بوابة أستاذ لحوني التعليمية" width={54} height={54} priority />
        <div><small>مركز القيادة</small><strong>بوابة الإدارة</strong></div>
      </div>

      <div className="admin-sidebar-status"><i /><div><b>النظام متصل</b><small>متابعة وتشغيل ذكي</small></div></div>

      <nav className="admin-sidebar-tabs" aria-label="التبويبات الرئيسية">
        {tabs.map(tab => {
          const active = tab.href === "/admin" ? pathname === "/admin" : pathname.startsWith(tab.href);
          return <Link key={tab.href} href={tab.href} className={active ? "active" : ""}>
            <span>{tab.icon}</span><div><b>{tab.label}</b><small>{tab.note}</small></div><em>←</em>
          </Link>;
        })}
      </nav>

      <div className="admin-sidebar-smart-note">
        <span>✦</span><div><b>إدارة أذكى</b><small>الترتيب يعتمد على العمل المحفوظ فعليًا، وليس عدد النقرات.</small></div>
      </div>

      <Link className="admin-sidebar-home" href="/">العودة للرئيسية</Link>
    </aside>
    {children}
  </>;
}
