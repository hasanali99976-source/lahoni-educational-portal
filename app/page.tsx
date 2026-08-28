import Image from "next/image";
import Link from "next/link";
import StudentDirectQr from "./student-direct-qr";
import "./student-direct-qr.css";

const portals = [
  {
    href: "/student",
    number: "01",
    icon: "🎓",
    title: "الطالب وولي الأمر",
    subtitle: "متابعة يومية واضحة",
    text: "المواد والدرجات والحضور والاختبارات والخطة العلاجية في مسار واحد سهل.",
    action: "الدخول والمتابعة",
    tone: "student",
  },
  {
    href: "/teacher",
    number: "02",
    icon: "✎",
    title: "مساحة المعلم",
    subtitle: "إدارة تعليمية متكاملة",
    text: "الطلاب والتحضير والرصد والإتقان والاختبارات والذكاء الاصطناعي دون تشتيت.",
    action: "فتح مساحة العمل",
    tone: "teacher",
  },
  {
    href: "/admin",
    number: "03",
    icon: "⌂",
    title: "إدارة النظام",
    subtitle: "الربط والصلاحيات",
    text: "إدارة المعلمين والطلاب والمواد والفصول الرسمية من مركز تحكم واحد.",
    action: "فتح لوحة الإدارة",
    tone: "admin",
  },
];

const highlights = [
  ["٣", "بوابات مترابطة"],
  ["١٧", "مادة تعليمية"],
  ["٢٤/٧", "متابعة متاحة"],
  ["AI", "تحليل تعليمي"],
];

export default function HomePage() {
  return <main className="neo-home" dir="rtl">
    <header className="neo-home-header">
      <div className="neo-home-brand">
        <Image src="/icons/ostadh-lahooni-192.jpg" width={54} height={54} alt="شعار بوابة أستاذ لحوني التعليمية" priority />
        <div><strong>أستاذ لحوني</strong><span>منظومة تعليمية للمتابعة والإنجاز</span></div>
      </div>
      <div className="neo-home-live"><i /> البوابة متصلة وآمنة</div>
    </header>

    <section className="neo-hero">
      <div className="neo-hero-copy">
        <span className="neo-eyebrow">منصة تعليمية مصممة للمدرسة</span>
        <h1>كل ما يحتاجه التعليم<br/><em>في مسارات واضحة.</em></h1>
        <p>بدل الصفحات المتشابهة والقوائم المزدحمة، تبدأ من دورك مباشرة وتصل إلى أداتك بخطوات قليلة وواضحة.</p>
        <div className="neo-hero-actions">
          <Link href="/student" className="neo-primary-action">دخول الطالب وولي الأمر</Link>
          <Link href="/teacher" className="neo-secondary-action">دخول المعلم</Link>
        </div>
        <div className="neo-highlights">{highlights.map(([value, label]) => <article key={label}><strong>{value}</strong><span>{label}</span></article>)}</div>
      </div>

      <div className="neo-launch-panel" aria-label="بوابات الدخول">
        <header><small>اختر المسار</small><h2>إلى أين تريد الذهاب؟</h2></header>
        <div className="neo-launch-list">{portals.map(portal => <Link key={portal.href} href={portal.href} className={`neo-launch-card ${portal.tone}`}>
          <span className="neo-launch-number">{portal.number}</span>
          <span className="neo-launch-icon">{portal.icon}</span>
          <div><small>{portal.subtitle}</small><h3>{portal.title}</h3><p>{portal.text}</p></div>
          <b>{portal.action} ←</b>
        </Link>)}</div>
      </div>
    </section>

    <section className="neo-home-lower">
      <article className="neo-qr-card">
        <div><span>دخول مباشر</span><h2>باركود الطالب</h2><p>يمسح الطالب أو ولي الأمر الباركود ثم يدخل الكود الخاص به، دون المرور على قوائم إضافية.</p></div>
        <StudentDirectQr />
      </article>
      <article className="neo-system-card">
        <span>طريقة العمل</span>
        <h2>بيانات واحدة، واجهات مختلفة</h2>
        <ol><li><b>الإدارة</b><small>تربط المعلمين والمواد والفصول.</small></li><li><b>المعلم</b><small>يرصد ويحفظ ويتابع مستوى طلابه.</small></li><li><b>الطالب وولي الأمر</b><small>يشاهدان النتائج والمتابعة من نفس البوابة.</small></li></ol>
      </article>
    </section>

    <footer className="neo-home-footer"><span>بوابة أستاذ لحوني التعليمية</span><b>تعليم أوضح • متابعة أسرع • بيانات محفوظة</b></footer>
  </main>;
}
