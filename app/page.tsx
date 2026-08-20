import Image from "next/image";
import Link from "next/link";
import StudentDirectQr from "./student-direct-qr";

const portals = [
  { href: "/admin", icon: "◈", title: "إدارة البوابة", text: "إدارة المعلمين والمواد والصلاحيات", tone: "admin" },
  { href: "/teacher", icon: "✦", title: "بوابة المعلم", text: "الطلاب والدرجات والمتابعة والملفات", tone: "teacher" },
  { href: "/student", icon: "◎", title: "بوابة الطالب وولي الأمر", text: "دخول موحد بهوية الطالب وكوده لعرض النتائج والمتابعة", tone: "student" },
];

export default function HomePage() {
  return <main className="v3-home" dir="rtl">
    <nav className="v3-topbar">
      <div className="v3-brand"><Image src="/icons/ostadh-lahooni-192.jpg" width={52} height={52} alt="شعار بوابة أستاذ لحوني التعليمية" priority/><div><strong>بوابة أستاذ لحوني التعليمية</strong><span>تعليم ذكي • متابعة أوضح</span></div></div>
      <span className="v3-live"><i/> منصة تعليمية متكاملة</span>
    </nav>
    <section className="v3-hero">
      <div className="v3-hero-copy"><span className="v3-kicker">بوابتك التعليمية الجديدة</span><h1>كل رحلة تعليمية<br/><em>تبدأ من هنا</em></h1><p>تجربة هادئة وواضحة تجمع الإدارة والمعلم والطالب وولي الأمر في نظام واحد ذكي وآمن.</p><div className="v3-values"><span>عزل كامل للمواد</span><span>بيانات آمنة</span><span>ذكاء تعليمي</span></div></div>
      <div className="v3-visual" aria-hidden="true"><div className="v3-orbit orbit-one"/><div className="v3-orbit orbit-two"/><div className="v3-core"><b>AI</b><span>تعليم أذكى</span></div><i className="v3-dot d1"/><i className="v3-dot d2"/><i className="v3-dot d3"/></div>
    </section>
    <StudentDirectQr />
    <section className="v3-portals" aria-label="بوابات الدخول">
      {portals.map(portal=><Link key={portal.href} href={portal.href} className={`v3-portal-card ${portal.tone}`}><span className="v3-portal-icon">{portal.icon}</span><div><small>دخول آمن</small><h2>{portal.title}</h2><p>{portal.text}</p></div><b className="v3-arrow">←</b></Link>)}
    </section>
    <footer className="v3-footer"><span>بوابة أستاذ لحوني التعليمية</span><span>واضحة • ناعمة • ذكية</span></footer>
  </main>;
}
