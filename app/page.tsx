import Image from "next/image";
import Link from "next/link";
import StudentDirectQr from "./student-direct-qr";
import "./student-direct-qr.css";
import "./crazy-school-home.css";

const portals = [
  {
    href: "/admin",
    icon: "🏫",
    title: "إدارة البوابة",
    text: "إدارة المعلمين والمواد والصلاحيات والتقارير من لوحة موحدة وواضحة.",
    tone: "admin",
  },
  {
    href: "/teacher",
    icon: "👨‍🏫",
    title: "بوابة المعلم",
    text: "الطلاب والدرجات والحضور والاختبارات والتحضير والخطط العلاجية في مساحة واحدة.",
    tone: "teacher",
  },
  {
    href: "/student",
    icon: "🎓",
    title: "الطالب وولي الأمر",
    text: "متابعة التحصيل والدرجات والحضور والتنبيهات والخطط بصورة سهلة ومباشرة.",
    tone: "student",
  },
];

export default function HomePage() {
  return (
    <main className="crazy-school-home" dir="rtl">
      <nav className="school-topbar" aria-label="رأس البوابة">
        <div className="school-brand">
          <Image
            src="/icons/ostadh-lahooni-192.jpg"
            width={54}
            height={54}
            alt="شعار بوابة أستاذ لحوني التعليمية"
            priority
          />
          <div>
            <strong>بوابة أستاذ لحوني التعليمية</strong>
            <span>بيئة تعليمية موحدة للمتابعة والتحصيل</span>
          </div>
        </div>
        <div className="school-status"><i /> البوابة متاحة الآن</div>
      </nav>

      <section className="school-hero">
        <div className="school-copy">
          <span className="school-kicker">هوية تعليمية رقمية موحّدة</span>
          <h1>
            كل ما تحتاجه للتعليم
            <br />
            <em>في بوابة واحدة</em>
          </h1>
          <p>
            بوابة تجمع الإدارة والمعلم والطالب وولي الأمر في تجربة تعليمية واضحة،
            مع الحفاظ على الاختبارات والتحضير والدرجات والتقارير وجميع البيانات القائمة.
          </p>
          <div className="school-chips" aria-label="مزايا البوابة">
            <span>✓ متابعة التحصيل</span>
            <span>✓ اختبارات وتحضير</span>
            <span>✓ تقارير مترابطة</span>
            <span>✓ تعمل على الجوال والكمبيوتر</span>
          </div>
        </div>

        <div className="school-scene" aria-hidden="true">
          <div className="portal-orbit">
            <div className="portal-core">
              <Image
                src="/icons/ostadh-lahooni-192.jpg"
                width={86}
                height={86}
                alt=""
              />
              <strong>أستاذ لحوني</strong>
              <small>بوابة تعليمية ذكية</small>
            </div>
            <span className="orbit-node one"><b>الإدارة</b>إشراف وتنظيم</span>
            <span className="orbit-node two"><b>المعلم</b>تعليم ومتابعة</span>
            <span className="orbit-node three"><b>ولي الأمر</b>اطلاع وتواصل</span>
            <span className="orbit-node four"><b>الطالب</b>تحصيل وإنجاز</span>
          </div>
          <span className="scene-badge">هوية واحدة • تجربة متكاملة</span>
        </div>
      </section>

      <section className="school-portals entry-section" aria-label="بوابات الدخول">
        <div className="school-section-head">
          <small>الدخول إلى البوابة</small>
          <h2>اختر المساحة المناسبة لك</h2>
          <p>كل مستخدم يدخل إلى مساحته الحالية نفسها، لكن ضمن هوية أوضح وأكثر اتساقًا.</p>
        </div>

        <div className="school-grid">
          {portals.map((portal) => (
            <Link
              key={portal.href}
              href={portal.href}
              className={`school-card ${portal.tone}`}
            >
              <span className="school-card-icon">{portal.icon}</span>
              <small>دخول مباشر</small>
              <h3>{portal.title}</h3>
              <p>{portal.text}</p>
              <b>الدخول إلى البوابة ←</b>
            </Link>
          ))}
        </div>

        <div className="home-principles" aria-label="أسس الهوية الجديدة">
          <div className="home-principle"><strong>تصميم موحّد</strong><span>نفس الألوان والخطوط والأسلوب في جميع الصفحات القادمة.</span></div>
          <div className="home-principle"><strong>المحتوى محفوظ</strong><span>لا حذف ولا تعديل للاختبارات أو التحضير أو الدرجات أو البيانات.</span></div>
          <div className="home-principle"><strong>متجاوبة بالكامل</strong><span>واجهة مناسبة للجوال والآيباد والكمبيوتر دون تغيير الوظائف.</span></div>
        </div>
      </section>

      <StudentDirectQr />

      <section className="school-ribbon" aria-label="خصائص أساسية">
        <span>حسابات مستقلة</span>
        <span>بيانات مترابطة</span>
        <span>متابعة مستمرة</span>
        <span>هوية تعليمية موحدة</span>
      </section>

      <footer className="school-signature">
        بوابة أستاذ لحوني التعليمية • تعليم أوضح، متابعة أدق، وتجربة واحدة متكاملة
      </footer>
    </main>
  );
}
