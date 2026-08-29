import Link from "next/link";
import "./admin-privacy.css";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>
    <nav className="admin-quick-nav" dir="rtl" aria-label="خيارات إدارة البوابة">
      <Link href="/admin">المعلمون والمواد</Link>
      <Link href="/admin/students">الطلاب والفصول</Link>
      <Link href="/admin/structure">الصفوف والربط</Link>
      <Link href="/admin/supervisors">المنسقون</Link>
    </nav>
    {children}
  </>;
}
