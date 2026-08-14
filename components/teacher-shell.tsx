"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  HomeIcon,
  UsersIcon,
  CalendarCheckIcon,
  TableIcon,
  ChartIcon,
  LogoutIcon,
  MenuIcon,
} from "./icons";

const links = [
  { href: "/teacher/dashboard", label: "الرئيسية", Icon: HomeIcon },
  { href: "/teacher/students", label: "إدارة الطلاب", Icon: UsersIcon },
  { href: "/teacher/attendance", label: "التحضير اليومي", Icon: CalendarCheckIcon },
  { href: "/teacher/grades", label: "رصد الدرجات", Icon: TableIcon },
  { href: "/teacher/reports", label: "التقارير", Icon: ChartIcon },
];

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  wide?: boolean;
};

export default function TeacherShell({ title, subtitle, children, wide }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className={`t-shell${open ? " open" : ""}`}>
      <button
        type="button"
        className="t-backdrop"
        aria-label="إغلاق القائمة"
        onClick={() => setOpen(false)}
      />

      <aside className="t-sidebar">
        <div className="t-side-brand">
          <div className="brand-logo">ت</div>
          <div>
            <strong>بوابة التهذيب</strong>
            <small>نظام المتابعة التعليمية</small>
          </div>
        </div>

        <nav className="t-nav">
          {links.map(({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link key={href} href={href} className={active ? "active" : ""} onClick={() => setOpen(false)}>
                <Icon />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="t-side-foot">
          <div className="t-side-card">
            <b>الأستاذ حسن علي الطويل</b>
            <span>معلم التاريخ — التهذيب الثانوية</span>
          </div>
          <Link className="t-logout" href="/">
            <LogoutIcon />
            العودة للبوابة
          </Link>
        </div>
      </aside>

      <div className="t-main">
        <header className="t-topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              className="t-menu-btn"
              aria-label="فتح القائمة"
              onClick={() => setOpen((v) => !v)}
            >
              <MenuIcon />
            </button>
            <div className="t-topbar-title">
              <h1>{title}</h1>
              {subtitle && <p>{subtitle}</p>}
            </div>
          </div>

          <div className="t-topbar-user">
            <div className="u-info">
              <b>أ. حسن الطويل</b>
              <span>معلم التاريخ</span>
            </div>
            <div className="avatar-dot">ح</div>
          </div>
        </header>

        <main className={`t-content${wide ? " wide-content" : ""}`}>{children}</main>
      </div>
    </div>
  );
}
