"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import "./admin-privacy.css";
import "./admin-command-v3.css";
import "./admin-command-v4.css";
import "./admin-clarity-v5.css";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const students = pathname.startsWith("/admin/students");

  return <div className="admin-v3-frame admin-v4-frame admin-v5-frame" dir="rtl">
    <header className="admin-v3-topbar admin-v4-topbar">
      <div className="admin-v3-brand admin-v4-brand">
        <Image src="/icons/lahooni-identity-320.jpg" alt="هوية بوابة أستاذ لحوني التعليمية" width={50} height={50} priority />
        <div><small>بوابة أستاذ لحوني التعليمية</small><strong>غرفة القيادة التعليمية</strong></div>
      </div>
      <div className="admin-v3-top-actions admin-v4-top-actions">
        <span className="admin-v3-live admin-v4-live"><i /> النظام متصل</span>
        <span className="admin-v4-control-code">ADMIN • CONTROL</span>
        <Link href="/">الرئيسية</Link>
      </div>
    </header>

    <section className="admin-v4-mission" aria-label="أهمية الإدارة">
      <div className="admin-v4-mission-orbit"><span>◎</span><i /><i /><i /></div>
      <div className="admin-v4-mission-copy">
        <small>مركز القرار والمتابعة</small>
        <h1>الإدارة هنا تقود العمل… لا تراقبه فقط</h1>
        <p>من هنا تُدار الحسابات والفصول، تُقرأ مؤشرات العمل الحقيقي، وتتحول البيانات إلى قرارات أسرع وأوضح.</p>
      </div>
      <div className="admin-v4-mission-tags"><span>القرار</span><span>الجودة</span><span>المتابعة</span><span>التحفيز</span></div>
    </section>

    <nav className="admin-v3-switch admin-v4-switch" aria-label="أقسام الإدارة">
      <Link href="/admin" className={!students ? "active" : ""}>
        <span className="admin-v3-switch-icon">👨‍🏫</span>
        <div><b>المعلمون</b><small>الحسابات • التنافس • النشاط الحقيقي</small></div>
      </Link>
      <Link href="/admin/students" className={students ? "active" : ""}>
        <span className="admin-v3-switch-icon">🎓</span>
        <div><b>الطلاب والفصول</b><small>الصف ← الفصل ← القائمة</small></div>
      </Link>
    </nav>

    <main className={`admin-v3-workspace admin-v4-workspace ${students ? "is-students" : "is-teachers"}`}>{children}</main>
  </div>;
}
