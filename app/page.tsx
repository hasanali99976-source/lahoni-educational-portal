import Image from "next/image";
import Link from "next/link";
import StudentDirectQr from "./student-direct-qr";
import "./student-direct-qr.css";
import "./crazy-school-home.css";

const portals = [
  { href: "/admin", icon: "🏫", title: "إدارة البوابة", text: "إدارة المعلمين والمواد والصلاحيات والتقارير من لوحة مدرسية ذكية ومترابطة.", tone: "admin" },
  { href: "/teacher", icon: "👨‍🏫", title: "بوابة المعلم", text: "الطلاب والدرجات والحضور والاختبارات التشخيصية والخطط العلاجية في مساحة واحدة.", tone: "teacher" },
  { href: "/student", icon: "🎒", title: "الطالب وولي الأمر", text: "متابعة الدرجات والحضور والانضباط والاختبارات والخطة العلاجية بسهولة ووضوح.", tone: "student" },
];

const smartFeatures = [
  { icon: "🧠", title: "ذكاء تعليمي", text: "تحليل النتائج واقتراح الخطط العلاجية ومساعدة المعلم في اتخاذ القرار." },
  { icon: "🎨", title: "هوية لكل مادة", text: "ألوان وحركات ورموز تتبدل تلقائيًا حسب المادة دون تغيير طريقة الاستخدام." },
  { icon: "📊", title: "متابعة لحظية", text: "درجات وحضور واختبارات وتقارير مترابطة بين المعلم والطالب والإدارة." },
];

export default function HomePage() {
  return <main className="crazy-school-home" dir="rtl">
    <nav className="school-topbar">
      <div className="school-brand">
        <Image src="/icons/ostadh-lahooni-192.jpg" width={58} height={58} alt="شعار بوابة أستاذ لحوني التعليمية" priority />
        <div><strong>بوابة أستاذ لحوني التعليمية</strong><span>منصة مدرسية ذكية لإدارة التعليم والمتابعة</span></div>
      </div>
      <div className="school-status"><i /> النظام يعمل الآن ✨</div>
    </nav>

    <section className="school-hero">
      <div className="school-copy">
        <span className="school-kicker">🎓 جيل جديد من الإدارة التعليمية</span>
        <h1>التعليم والمتابعة<br/><em>في بوابة واحدة ذكية</em></h1>
        <p>تجربة تعليمية مدرسية حديثة تجمع الإدارة والمعلم والطالب وولي الأمر، وتحافظ على جميع بياناتك ووظائفك مع هوية متحركة ومميزة لكل مادة.</p>
        <div className="school-chips"><span>🧠 ذكاء تعليمي</span><span>🎨 هوية لكل مادة</span><span>🔗 ربط مباشر</span><span>📱 جوال وكمبيوتر</span></div>
      </div>
      <div className="school-scene" aria-hidden="true">
        <div className="school-board" />
        <span className="school-float one">📚 المواد تتحرك بهويتها</span>
        <span className="school-float two">📊 نتائج وتقارير فورية</span>
        <span className="school-float three">🧠 اقتراحات ذكية</span>
      </div>
    </section>

    <section className="school-portals" aria-label="مزايا البوابة الذكية">
      <div className="school-section-head"><small>كيف تساعدك البوابة؟</small><h2>تعليم أوضح وقرار أذكى</h2><p>ستايل تعليمي جديد مع بقاء البوابات والوظائف والبيانات كما هي.</p></div>
      <div className="school-grid">
        {smartFeatures.map(feature => <article key={feature.title} className="school-card teacher">
          <span className="school-card-icon">{feature.icon}</span><small>ميزة ذكية</small><h3>{feature.title}</h3><p>{feature.text}</p>
        </article>)}
      </div>
    </section>

    <StudentDirectQr />

    <section className="school-portals" aria-label="بوابات الدخول">
      <div className="school-section-head"><small>اختر بوابتك</small><h2>كل دور له تجربته الخاصة</h2><p>نفس النظام والبيانات، لكن بواجهة تعليمية مصممة لكل مستخدم.</p></div>
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

    <section className="school-ribbon"><span>🔒 حسابات آمنة</span><span>🔗 بيانات مترابطة</span><span>🎨 هويات تعليمية</span><span>✨ حركات خفيفة</span><span>🧠 ذكاء مساعد</span></section>
    <footer className="school-signature">بوابة أستاذ لحوني التعليمية • تعليم أوضح، متابعة أذكى، وهوية أقرب لكل مادة</footer>
  </main>;
}
