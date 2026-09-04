import Link from "next/link";
import StudentDirectQr from "./student-direct-qr";
import "./student-direct-qr.css";
import "./lahooni-home-v2.css";

const portals = [
  {
    href: "/admin",
    title: "إدارة البوابة",
    text: "إدارة المستخدمين، الإعدادات، التقارير والصلاحيات.",
    tone: "admin",
    icon: "admin",
  },
  {
    href: "/teacher",
    title: "بوابة المعلم",
    text: "إدارة الاختبارات، الحضور، التقارير والأنشطة والمصادر التعليمية.",
    tone: "teacher",
    icon: "teacher",
  },
  {
    href: "/student",
    title: "الطالب وولي الأمر",
    text: "متابعة أداء الطالب، الاختبارات والتواصل المدرسي.",
    tone: "student",
    icon: "student",
  },
];

function PortalIcon({ type }: { type: string }) {
  if (type === "admin") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="17" r="7" />
        <path d="M10 39c1.8-8 7.2-12 14-12s12.2 4 14 12" />
        <circle cx="36" cy="14" r="4.5" />
        <path d="M36 6v3m0 10v3m8-8h-3m-10 0h-3m13.7-5.7-2.1 2.1m-7.2 7.2-2.1 2.1m11.4 0-2.1-2.1m-7.2-7.2-2.1-2.1" />
      </svg>
    );
  }
  if (type === "teacher") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="16" cy="15" r="6" />
        <path d="M7 38v-8c0-5 4-9 9-9s9 4 9 9v8" />
        <rect x="26" y="9" width="16" height="22" rx="2" />
        <path d="M23 24l8-6m-5 9 6-5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="18" cy="16" r="7" />
      <circle cx="33" cy="19" r="5" />
      <path d="M6 39c1.8-8 6.7-12 12-12s10.2 4 12 12M27 38c1.3-5.5 4.4-8.2 8-8.2 3.5 0 6.4 2.8 7.6 8.2" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <main className="lhv2-home" dir="rtl">
      <header className="lhv2-topbar">
        <div className="lhv2-brand">
          <img src="/icons/ostadh-lahooni-192.jpg?v=4" alt="هوية بوابة أستاذ لحوني التعليمية" />
          <strong>بوابة أستاذ لحوني التعليمية</strong>
        </div>
      </header>

      <div className="lhv2-main">
        <section className="lhv2-hero">
          <div className="lhv2-copy">
            <span className="lhv2-welcome">مرحباً بكم في</span>
            <h1>
              بوابة تعليمية تجمع
              <span>الجميع في مكان واحد</span>
            </h1>
            <div className="lhv2-gold-rule" />
            <p>متابعة ودعم شامل لرحلتك التعليمية من المدرسة إلى المستقبل</p>
          </div>

          <div className="lhv2-portrait">
            <div className="lhv2-portrait-ring">
              <img src="/icons/ostadh-lahooni-192.jpg?v=4" alt="هوية أستاذ لحوني" />
            </div>
          </div>

          <div className="lhv2-motto" aria-hidden="true">
            معاً<br />نصنع فرقاً<br />في التعليم
          </div>
        </section>

        <section className="lhv2-access" aria-label="خيارات الدخول">
          <div className="lhv2-qr" aria-label="الدخول السريع لبوابة الطالب وولي الأمر">
            <StudentDirectQr />
          </div>

          <div className="lhv2-cards">
            {portals.map((portal) => (
              <Link key={portal.href} href={portal.href} className={`lhv2-card ${portal.tone}`}>
                <span className="lhv2-card-icon"><PortalIcon type={portal.icon} /></span>
                <h2>{portal.title}</h2>
                <p>{portal.text}</p>
                <span className="lhv2-enter">←</span>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <footer className="lhv2-credit">
        إعداد البوابة: <b>الأستاذ حسن علي الطويل</b>
      </footer>
    </main>
  );
}
