import Image from "next/image";
import Link from "next/link";
import StudentDirectQr from "./student-direct-qr";
import "./student-direct-qr.css";
import "./crazy-school-home.css";

const portals = [
  { href: "/admin", icon: "◈", title: "إدارة البوابة", text: "إدارة المعلمين والمواد والصلاحيات من لوحة واضحة ومترابطة.", tone: "admin" },
  { href: "/teacher", icon: "✦", title: "بوابة المعلم", text: "الطلاب والدرجات والحضور والاختبارات والخطط العلاجية في مساحة واحدة.", tone: "teacher" },
  { href: "/student", icon: "◎", title: "الطالب وولي الأمر", text: "متابعة الدرجات والحضور والانضباط والاختبارات والخطة العلاجية بسهولة.", tone: "student" },
];

export default function HomePage() {
  return <main className="crazy-school-home" dir="rtl">
    <nav className="school-topbar">
      <div className="school-brand">
        <Image src="/icons/ostadh-lahooni-192.jpg" width={54} height={54} alt="شعار بوابة أستاذ لحوني التعليمية" priority />
        <div><strong>بوابة أستاذ لحوني التعليمية</strong><span>مدرسة رقمية ذكية ومترابطة</span></div>
      </div>
      <div className="school-status"><i /> النظام يعمل الآن</div>
    </nav>

    <section className="school-hero">
      <div className="school-copy">
        <span className="school-kicker">جيل جديد من التعليم المدرسي</span>
        <h1>مدرستك كلها<br/><em>في بوابة واحدة</em></h1>
        <p>تجربة تعليمية حية تجمع الإدارة والمعلم والطالب وولي الأمر، مع هوية خاصة لكل مادة وحركات تفاعلية تجعل الاستخدام أوضح وأمتع.</p>
        <div className="school-chips"><span>هوية لكل مادة</span><span>ذكاء تعليمي</span><span>ربط مباشر</span><span>متوافق مع الجوال</span></div>
      </div>
      <div className="school-scene" aria-hidden="true">
        <div className="school-board" />
        <span className="school-float one">📚 مواد بهوية خاصة</span>
        <span className="school-float two">📊 متابعة لحظية</span>
        <span className="school-float three">✨ تفاعل ذكي</span>
      </div>
    </section>

    <StudentDirectQr />

    <section className="school-portals" aria-label="بوابات الدخول">
      <div className="school-section-head"><small>اختر بوابتك</small><h2>كل دور له تجربته الخاصة</h2><p>نفس النظام، لكن بواجهة مصممة لكل مستخدم.</p></div>
      <div className="school-grid">
        {portals.map(portal => <Link key={portal.href} href={portal.href} className={`school-card ${portal.tone}`}>
          <span className="school-card-icon">{portal.icon}</span>
          <small>دخول آمن وسريع</small>
          <h3>{portal.title}</h3>
          <p>{portal.text}</p>
          <b>ابدأ الآن ←</b>
        </Link>)}
      </div>
    </section>

    <section className="school-ribbon"><span>حسابات آمنة</span><span>بيانات مترابطة</span><span>واجهات تعليمية</span><span>حركات خفيفة</span></section>
    <footer className="school-signature">بوابة أستاذ لحوني التعليمية • تعليم أوضح، متابعة أذكى</footer>
  </main>;
}
