import Link from "next/link";
import "./mobile-app.css";

const portals = [
  { href: "/student", icon: "🎓", title: "بوابة الطالب وولي الأمر", note: "الدرجات، الحضور، الاختبارات والخطة العلاجية", className: "student" },
  { href: "/teacher", icon: "🧑‍🏫", title: "بوابة المعلم", note: "الطلاب، التحضير، الدرجات والاختبارات التشخيصية", className: "teacher" },
  { href: "/admin", icon: "⚙️", title: "بوابة الإدارة", note: "إدارة المعلمين والمواد والفصول", className: "admin" },
];

export default function MobileAppHome() {
  return <main className="mobile-app-home" dir="rtl">
    <section className="mobile-app-shell">
      <header className="mobile-app-hero">
        <div className="mobile-app-logo">ل</div>
        <div><small>تطبيق أستاذ لحوني</small><h1>كل البوابات في مكان واحد</h1><p>اختر البوابة المطلوبة وابدأ مباشرة من الجوال.</p></div>
      </header>

      <section className="mobile-app-status"><span>● متصل بالبوابة</span><b>نسخة الجوال الموحّدة</b></section>

      <section className="mobile-portal-grid">
        {portals.map(portal => <Link href={portal.href} className={`mobile-portal-card ${portal.className}`} key={portal.href}>
          <span className="mobile-portal-icon">{portal.icon}</span>
          <div><strong>{portal.title}</strong><small>{portal.note}</small></div>
          <b className="mobile-portal-arrow">←</b>
        </Link>)}
      </section>

      <section className="mobile-app-shortcuts">
        <Link href="/student">نتائج الطالب</Link>
        <Link href="/teacher/attendance">التحضير</Link>
        <Link href="/teacher/diagnostics">الاختبارات</Link>
        <Link href="/teacher/grades">الدرجات</Link>
      </section>

      <footer><Link href="/">فتح الموقع الكامل</Link><span>الإصدار ١٫٦</span></footer>
    </section>
  </main>;
}
