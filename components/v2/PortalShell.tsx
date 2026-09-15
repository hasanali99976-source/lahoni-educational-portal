import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./portal-v2.module.css";

type NavItem = { href: string; label: string };
export function PortalShell({ title, subtitle, nav = [], children }: { title: string; subtitle?: string; nav?: NavItem[]; children: ReactNode }) {
  return <div className={styles.root} dir="rtl"><header className={styles.header}><div><strong className={styles.brand}>بوابة أستاذ لحوني التعليمية</strong><span className={styles.school}>مدرسة التهذيب الأهلية</span></div><div className={styles.identity}><b>{title}</b>{subtitle && <small>{subtitle}</small>}</div></header>{nav.length > 0 && <nav className={styles.nav}>{nav.map(item => <Link key={`${item.href}-${item.label}`} href={item.href}>{item.label}</Link>)}</nav>}<main className={styles.main}>{children}</main></div>;
}
export function V2PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) { return <section className={styles.pageHeader}><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div>{action}</div>}</section>; }
export function V2Card({ title, children }: { title?: string; children: ReactNode }) { return <section className={styles.card}>{title && <h2>{title}</h2>}{children}</section>; }
export function V2Stat({ label, value, note }: { label: string; value: ReactNode; note?: string }) { return <div className={styles.stat}><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</div>; }
