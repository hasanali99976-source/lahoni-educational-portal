import Link from "next/link";
import "./admin-privacy.css";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>
    <nav className="admin-quick-nav" dir="rtl" aria-label="روابط إدارة البوابة">
      <Link href="/admin">المعلمون</Link>
      <Link href="/admin/supervisors">المشرفون والمنسقون</Link>
      <Link href="/supervisor">دخول المشرف</Link>
    </nav>
    {children}
  </>;
}
