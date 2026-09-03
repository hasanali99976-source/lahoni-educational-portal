import Image from "next/image";
import Link from "next/link";
import "./crazy-school-home.css";

const portals = [
  {
    href: "/teacher",
    title: "بوابة المعلم",
    text: "إدارة التحصيل والمتابعة والرصد والاختبارات في مساحة تعليمية واحدة.",
    mark: "م",
    tone: "teacher",
  },
  {
    href: "/student",
    title: "بوابة الطالب وولي الأمر",
    text: "متابعة التحصيل والدرجات والحضور والملاحظات والتقارير بسهولة ووضوح.",
    mark: "ط",
    tone: "student",
  },
  {
    href: "/admin",
    title: "بوابة الإدارة",
    text: "إدارة المعلمين والطلاب والفصول ومؤشرات التفاعل من لوحة موحدة.",
    mark: "إ",
    tone: "admin",
  },
];

const info = [
  { icon: "✓", title: "منصة تعليمية", text: "تحت إشراف المدرسة" },
  { icon: "↔", title: "واجهة موحدة", text: "تجربة سلسة ومتوافقة" },
  { icon: "⌾", title: "نظام آمن", text: "بيانات محمية وخصوصية مضمونة" },
  { icon: "◷", title: "التاريخ", text: "2026" },
];

export default function HomePage() {
  return <main className="crazy-school-home" dir="rtl">
    <section className="lahoni-home-shell">
      <header className="lahoni-home-head">
        <div className="lahoni-home-brand">
          <Image src="/icons/ostadh-lahooni-192.jpg" width={88} height={88} alt="هوية بوابة أستاذ لحوني التعليمية" priority />
          <div>
            <span>المنصة التعليمية الموحدة</span>
            <h1>بوابة أستاذ لحوني التعليمية</h1>
            <p>منصة تعليمية متكاملة لإدارة التعلم والمتابعة</p>
          </div>
        </div>
        <div className="lahoni-home-year"><b>2026</b><small>النسخة التعليمية</small></div>
      </header>

      <section className="lahoni-home-hero">
        <div className="lahoni-hero-copy">
          <span className="lahoni-eyebrow">هوية تعليمية موحدة</span>
          <h2>تعليم متميز <i>•</i> متابعة ذكية <i>•</i> نتائج موثوقة</h2>
          <p>اختر بوابتك للدخول إلى تجربة تعليمية رسمية، واضحة، ومتزامنة بين الويب والتطبيق.</p>
        </div>
        <div className="lahoni-hero-art" aria-hidden="true">
          <div className="lahoni-book-stack"><span/><span/><span/></div>
          <div className="lahoni-laptop">A+</div>
          <div className="lahoni-globe">◎</div>
        </div>
      </section>

      <nav className="lahoni-portals" aria-label="بوابات الدخول">
        {portals.map(portal => <Link href={portal.href} className={`lahoni-portal-card ${portal.tone}`} key={portal.href}>
          <span className="lahoni-portal-role">{portal.mark}</span>
          <div className="lahoni-portal-copy"><strong>{portal.title}</strong><small>{portal.text}</small></div>
          <span className="lahoni-portal-arrow" aria-hidden="true">←</span>
        </Link>)}
      </nav>

      <section className="lahoni-info-strip" aria-label="معلومات البوابة">
        {info.map(item => <article key={item.title}><span>{item.icon}</span><div><strong>{item.title}</strong><small>{item.text}</small></div></article>)}
      </section>
    </section>

    <footer className="lahoni-home-footer">
      <div className="lahoni-school-line" aria-hidden="true">▱ ▱ ▱ ▱ ▱</div>
      <p>إعداد وتنفيذ: <strong>الأستاذ حسن علي الطويل</strong></p>
      <span>جميع الحقوق محفوظة © 2026</span>
      <b>بوابة أستاذ لحوني التعليمية</b>
    </footer>
  </main>;
}