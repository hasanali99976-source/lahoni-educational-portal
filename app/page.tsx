import Image from "next/image";
import Link from "next/link";
import StudentDirectQr from "./student-direct-qr";
import "./ostadh-lahooni-identity.css";
import "./lahooni-home.css";

const portals = [
  {
    href: "/admin",
    icon: "⚙️",
    title: "إدارة البوابة",
    text: "إدارة المستخدمين والإعدادات والتقارير والصلاحيات.",
    tone: "admin",
  },
  {
    href: "/teacher",
    icon: "👨‍🏫",
    title: "بوابة المعلم",
    text: "إدارة الاختبارات والحضور والتقارير والأنشطة والمصادر التعليمية.",
    tone: "teacher",
  },
  {
    href: "/student",
    icon: "👥",
    title: "الطالب وولي الأمر",
    text: "متابعة أداء الطالب والاختبارات والتواصل المدرسي.",
    tone: "student",
  },
];

export default function HomePage() {
  return (
    <main className="lahooni-home" dir="rtl">
      <header className="lahooni-topbar">
        <div className="lahooni-brand">
          <Image
            src="/icons/ostadh-lahooni-192.jpg"
            width={55}
            height={55}
            alt="هوية بوابة أستاذ لحوني التعليمية"
            priority
          />
          <div>
            <strong>بوابة أستاذ لحوني التعليمية</strong>
            <span>بوابة مدرسية موحّدة للمتابعة والتعليم</span>
          </div>
        </div>
        <div className="lahooni-top-mark">هوية تعليمية موحّدة لكل المواد</div>
      </header>

      <div className="lahooni-shell">
        <section className="lahooni-hero" aria-label="التعريف بالبوابة">
          <div className="lahooni-hero-copy">
            <span className="lahooni-eyebrow">مرحباً بكم في</span>
            <h1>
              بوابة تعليمية تجمع
              <span>الجميع في مكان واحد</span>
            </h1>
            <div className="lahooni-divider" />
            <p>متابعة ودعم شامل لرحلتك التعليمية من المدرسة إلى المستقبل.</p>
          </div>

          <div className="lahooni-portrait" aria-hidden="true">
            <div className="lahooni-portrait-frame">
              <Image
                src="/icons/ostadh-lahooni-192.jpg"
                width={250}
                height={250}
                alt=""
                priority
              />
            </div>
          </div>
        </section>

        <section className="lahooni-access-wrap" aria-label="خيارات الدخول">
          <div className="lahooni-qr" aria-label="الباركود القديم للدخول إلى بوابة الطالب">
            <StudentDirectQr />
          </div>

          <div className="lahooni-cards">
            {portals.map((portal) => (
              <Link
                key={portal.href}
                href={portal.href}
                className={`lahooni-card ${portal.tone}`}
              >
                <span className="lahooni-card-icon" aria-hidden="true">{portal.icon}</span>
                <h2>{portal.title}</h2>
                <p>{portal.text}</p>
                <span className="lahooni-enter" aria-hidden="true">←</span>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <footer className="lahooni-footer">
        <div className="lahooni-credit">
          إعداد البوابة:
          <b>الأستاذ حسن علي الطويل</b>
        </div>
      </footer>
    </main>
  );
}
