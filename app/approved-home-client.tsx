"use client";

import Link from "next/link";
import StudentDirectQr from "./student-direct-qr";
import "./student-direct-qr.css";

const IDENTITY = "/icons/lahooni-identity-320.jpg";

const portals = [
  {
    href: "/admin",
    kind: "admin",
    eyebrow: "إدارة وتشغيل",
    title: "بوابة الإدارة",
    text: "إدارة المستخدمين والصفوف والصلاحيات والتقارير من مركز واحد.",
    bullets: ["المستخدمون والصلاحيات", "التقارير العامة", "إدارة الصفوف والمواد"],
  },
  {
    href: "/teacher",
    kind: "teacher",
    eyebrow: "تعليم ومتابعة",
    title: "بوابة المعلم",
    text: "مساحة عمل ذكية للحضور والدرجات والمتابعة والتحليل والمهام اليومية.",
    bullets: ["الحضور والدرجات", "تحليل مستوى الطلاب", "المتابعة والخطط"],
  },
  {
    href: "/student",
    kind: "student",
    eyebrow: "تحصيل وتواصل",
    title: "الطالب وولي الأمر",
    text: "متابعة التحصيل والحضور والاختبارات وملاحظات المعلم في بوابة واحدة.",
    bullets: ["التحصيل والاختبارات", "الحضور والانضباط", "الملاحظات والتوجيه"],
  },
] as const;

function PortalGlyph({ kind }: { kind: (typeof portals)[number]["kind"] }) {
  if (kind === "admin") return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 5l5 3 6-.5 2 5.5 5 3-2 5.8 2 5.7-5 3-2 5.5-6-.5-5 3-5-3-6 .5-2-5.5-5-3 2-5.7-2-5.8 5-3 2-5.5 6 .5 5-3Z"/><path d="m18.5 24 4 4 8-9"/></svg>;
  if (kind === "teacher") return <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="15" cy="14" r="5.5"/><path d="M6 38v-9c0-5 4-9 9-9s9 4 9 9v9"/><rect x="27" y="9" width="15" height="20" rx="2"/><path d="M30 15h9M30 20h7M24 26l8-5"/></svg>;
  return <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="17" cy="15" r="6.5"/><circle cx="32" cy="19" r="5"/><path d="M6 39c1.6-8 6.2-12 11-12s9.5 4 11 12M27 39c1.2-5.4 4.2-8.3 7.5-8.3S40.8 33.6 42 39"/></svg>;
}

const styles = `
:root{--dlx-950:#042e36;--dlx-900:#073b45;--dlx-800:#0a5861;--dlx-emerald:#159a84;--dlx-gold:#d9a43e;--dlx-gold2:#f1cf78;--dlx-bg:#eef7f4;--dlx-card:#ffffff;--dlx-ink:#103f47;--dlx-muted:#6b8083;--dlx-line:#d8e7e3}
html:has(.dlx-home),body:has(.dlx-home){margin:0!important;overflow:auto!important;background:var(--dlx-bg)!important}
body:has(.dlx-home) .portal-stage{min-height:100dvh!important;background:transparent!important}
.dlx-home{position:relative;min-height:100dvh;overflow:hidden;background:linear-gradient(180deg,#042d35 0,#06424a 39%,#edf7f4 39%,#edf7f4 100%);color:var(--dlx-ink);padding:18px 22px 30px}
.dlx-home *{box-sizing:border-box}.dlx-home:before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 10% 8%,rgba(37,185,159,.2),transparent 25%),radial-gradient(circle at 88% 9%,rgba(217,164,62,.16),transparent 23%);pointer-events:none}
.dlx-home:after{content:"∑   DNA   E=mc²   ⚛   ١٢٣   ✎   ◌   📚";position:absolute;top:138px;left:3%;right:3%;font-size:27px;letter-spacing:20px;color:rgba(255,255,255,.08);white-space:nowrap;text-align:center;pointer-events:none}
.dlx-frame{position:relative;z-index:2;max-width:1500px;margin:auto}
.dlx-topbar{display:flex;align-items:center;justify-content:space-between;gap:18px;min-height:74px;padding:11px 14px 11px 18px;border:1px solid rgba(240,203,116,.45);border-radius:24px;background:rgba(3,36,42,.72);backdrop-filter:blur(18px);box-shadow:0 16px 45px rgba(0,0,0,.16)}
.dlx-brand{display:flex;align-items:center;gap:12px}.dlx-brand img{width:52px;height:52px;border-radius:15px;object-fit:cover;border:2px solid var(--dlx-gold2);box-shadow:0 7px 20px rgba(0,0,0,.24)}.dlx-brand-copy{display:grid}.dlx-brand-copy strong{color:#fff;font-size:19px;font-weight:900}.dlx-brand-copy small{color:#e7c86f;font-weight:800;margin-top:2px}
.dlx-top-tools{display:flex;align-items:center;gap:9px}.dlx-pill{border:1px solid rgba(255,255,255,.13);border-radius:999px;padding:9px 13px;background:rgba(255,255,255,.06);color:#cce6e1;font-size:12px;font-weight:800}.dlx-ai-pill{color:#fff;background:linear-gradient(110deg,rgba(21,154,132,.82),rgba(11,103,105,.82));border-color:rgba(255,255,255,.16)}
.dlx-hero{display:grid;grid-template-columns:minmax(0,1.18fr) minmax(390px,.82fr);gap:28px;align-items:center;min-height:330px;padding:32px 22px 36px}.dlx-hero-copy{padding:8px 8px}.dlx-kicker{display:inline-flex;align-items:center;gap:8px;color:var(--dlx-gold2);font-size:14px;font-weight:900}.dlx-kicker:before{content:"";width:28px;height:2px;background:linear-gradient(90deg,var(--dlx-gold2),transparent)}.dlx-hero h1{margin:9px 0 12px;color:#fff;font-size:clamp(38px,4vw,61px);line-height:1.12;letter-spacing:-1.4px;font-weight:950;max-width:850px}.dlx-hero h1 span{color:#f0ce79}.dlx-hero p{margin:0;max-width:820px;color:#cbe5e0;font-size:17px;line-height:1.9}.dlx-hero-tags{display:flex;flex-wrap:wrap;gap:8px;margin-top:19px}.dlx-hero-tags span{padding:8px 12px;border:1px solid rgba(255,255,255,.13);background:rgba(255,255,255,.055);border-radius:999px;color:#e5f3f0;font-size:12px;font-weight:800}
.dlx-smart-preview{position:relative;overflow:hidden;border:1px solid rgba(240,203,116,.42);border-radius:30px;background:linear-gradient(145deg,rgba(255,255,255,.96),rgba(235,248,244,.94));box-shadow:0 25px 70px rgba(0,0,0,.24);padding:22px}.dlx-smart-preview:after{content:"AI";position:absolute;left:-8px;bottom:-42px;font-size:150px;font-weight:950;color:rgba(9,112,105,.055)}.dlx-preview-head{display:flex;justify-content:space-between;align-items:center;gap:10px}.dlx-preview-head span{font-size:12px;color:#9a6c19;font-weight:900}.dlx-preview-head b{font-size:13px;color:#0b6f6c;background:#e0f4ef;padding:7px 10px;border-radius:999px}.dlx-smart-preview h2{margin:10px 0 5px;color:#073b45;font-size:24px}.dlx-smart-preview>p{margin:0;color:#6a7f82;line-height:1.7;font-size:13px}.dlx-preview-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:17px}.dlx-mini{min-height:92px;border:1px solid #dceae7;border-radius:18px;background:#fff;padding:13px;display:grid;align-content:space-between;box-shadow:0 8px 22px rgba(5,71,77,.06)}.dlx-mini i{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;background:linear-gradient(145deg,#e4f6f1,#fff4d8);font-style:normal}.dlx-mini strong{display:block;color:#164b51;font-size:14px}.dlx-mini small{color:#7b8e90;font-size:11px}.dlx-preview-note{position:relative;z-index:2;margin-top:12px;padding:12px 13px;border-radius:16px;background:linear-gradient(110deg,#073b45,#0b756f);color:#fff;font-size:12px;line-height:1.7}.dlx-preview-note b{color:#f3d27f}
.dlx-entry-wrap{margin-top:-4px;padding:0 8px}.dlx-section-title{display:flex;align-items:end;justify-content:space-between;gap:18px;margin-bottom:13px}.dlx-section-title div small{color:#b57d20;font-weight:900}.dlx-section-title h2{margin:4px 0 0;color:#fff;font-size:25px}.dlx-section-title>span{color:#cbe1de;font-size:12px}
.dlx-portal-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.dlx-card{position:relative;overflow:hidden;min-height:278px;padding:22px;border:1px solid var(--dlx-line);border-radius:28px;background:rgba(255,255,255,.98);box-shadow:0 19px 50px rgba(3,55,62,.13);text-decoration:none;color:var(--dlx-ink);transition:.22s ease}.dlx-card:before{content:"";position:absolute;top:0;right:0;left:0;height:5px;background:linear-gradient(90deg,#149a84,#d9a43e)}.dlx-card:after{content:"";position:absolute;width:150px;height:150px;border-radius:50%;left:-65px;bottom:-80px;background:radial-gradient(circle,rgba(21,154,132,.13),transparent 68%)}.dlx-card:hover{transform:translateY(-6px);box-shadow:0 25px 60px rgba(3,55,62,.18)}.dlx-card-top{display:flex;align-items:center;justify-content:space-between;gap:12px}.dlx-icon{width:68px;height:68px;border-radius:21px;display:grid;place-items:center;background:linear-gradient(145deg,#e8f7f3,#fff);border:1px solid #d6e9e4;color:#0b716c;box-shadow:0 9px 22px rgba(6,93,89,.11)}.dlx-card.student .dlx-icon{background:linear-gradient(145deg,#fff7df,#fff);color:#9b6b18}.dlx-icon svg{width:39px;height:39px;fill:none;stroke:currentColor;stroke-width:2}.dlx-card-eyebrow{padding:7px 10px;border-radius:999px;background:#f1f7f6;color:#607778;font-size:11px;font-weight:900}.dlx-card h3{margin:15px 0 7px;font-size:25px;color:#0a4f57}.dlx-card.student h3{color:#856018}.dlx-card>p{margin:0;color:#6b7e80;font-size:13px;line-height:1.75;min-height:46px}.dlx-card ul{list-style:none;padding:0;margin:14px 0 0;display:grid;gap:7px}.dlx-card li{display:flex;align-items:center;gap:8px;color:#557174;font-size:12px;font-weight:700}.dlx-card li:before{content:"✓";width:20px;height:20px;border-radius:50%;display:grid;place-items:center;background:#e2f5ef;color:#0b806f;font-size:11px;font-weight:900}.dlx-enter{position:absolute;left:18px;bottom:17px;width:43px;height:43px;border-radius:14px;display:grid;place-items:center;background:linear-gradient(135deg,#073b45,#159a84);color:#fff;font-size:22px;box-shadow:0 9px 21px rgba(6,89,86,.18)}
.dlx-lower{display:grid;grid-template-columns:minmax(0,1fr) 250px;gap:16px;margin-top:16px}.dlx-feature-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.dlx-feature{min-height:92px;padding:15px;border:1px solid #d9e7e4;border-radius:20px;background:rgba(255,255,255,.88);box-shadow:0 10px 26px rgba(5,67,73,.07)}.dlx-feature span{display:block;color:#0b776f;font-weight:900;font-size:13px}.dlx-feature small{display:block;margin-top:5px;color:#75888a;font-size:11px;line-height:1.6}.dlx-qr{position:relative;overflow:hidden;border:1px solid #d8e6e3;border-radius:22px;background:#fff;padding:10px;display:grid;place-items:center;box-shadow:0 10px 26px rgba(5,67,73,.07)}.dlx-qr:before{content:"دخول سريع للطالب وولي الأمر";display:block;color:#0b665f;font-size:11px;font-weight:900;margin-bottom:4px}.dlx-qr .v3-student-quick{margin:0!important;padding:0!important;border:0!important;box-shadow:none!important;background:transparent!important;display:block!important}.dlx-qr .v3-student-quick-copy{display:none!important}.dlx-qr .v3-student-qr-wrap{width:auto!important;padding:8px!important;border:0!important;box-shadow:none!important}.dlx-qr .v3-student-qr-wrap svg{width:118px!important;height:118px!important}.dlx-qr .v3-student-qr-wrap small{display:none!important}.dlx-qr .v3-student-qr-wrap strong{font-size:11px!important}
.dlx-footer{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:18px;padding:12px 16px;border-top:1px solid #d8e5e2;color:#6e8284;font-size:11px}.dlx-footer b{color:#0a655f}.dlx-footer span{color:#9a6a18;font-weight:800}
@media(max-width:1050px){.dlx-hero{grid-template-columns:1fr;min-height:auto;padding-bottom:26px}.dlx-smart-preview{max-width:720px}.dlx-portal-grid{grid-template-columns:1fr 1fr}.dlx-card.student{grid-column:1/-1}.dlx-lower{grid-template-columns:1fr}.dlx-qr{display:none}.dlx-feature-strip{grid-template-columns:repeat(2,1fr)}}
@media(max-width:700px){.dlx-home{padding:10px;background:linear-gradient(180deg,#042d35 0,#06424a 46%,#edf7f4 46%)}.dlx-topbar{align-items:flex-start}.dlx-top-tools{display:none}.dlx-brand-copy strong{font-size:15px}.dlx-brand-copy small{font-size:10px}.dlx-hero{padding:24px 6px}.dlx-hero h1{font-size:34px}.dlx-hero p{font-size:14px}.dlx-smart-preview{border-radius:23px;padding:17px}.dlx-preview-grid{grid-template-columns:1fr 1fr}.dlx-entry-wrap{padding:0}.dlx-section-title>span{display:none}.dlx-section-title h2{color:#0a4650;font-size:22px}.dlx-section-title div small{color:#a87520}.dlx-portal-grid{grid-template-columns:1fr}.dlx-card.student{grid-column:auto}.dlx-card{min-height:250px;border-radius:22px}.dlx-feature-strip{grid-template-columns:1fr 1fr}.dlx-feature{min-height:80px}.dlx-footer{flex-direction:column;text-align:center}}
`;

export default function ApprovedHomeClient() {
  return <main className="dlx-home" dir="rtl">
    <style>{styles}</style>
    <div className="dlx-frame">
      <header className="dlx-topbar">
        <div className="dlx-brand">
          <img src={IDENTITY} alt="هوية بوابة أستاذ لحوني التعليمية" />
          <div className="dlx-brand-copy"><strong>بوابة أستاذ لحوني التعليمية</strong><small>بيئة مدرسية ذكية للمتابعة والتحصيل</small></div>
        </div>
        <div className="dlx-top-tools"><span className="dlx-pill">مدرسة • أسرة • طالب</span><span className="dlx-pill dlx-ai-pill">✦ مدعومة بالمساعدة الذكية</span></div>
      </header>

      <section className="dlx-hero">
        <div className="dlx-hero-copy">
          <span className="dlx-kicker">منصة تعليمية مدرسية متكاملة</span>
          <h1>تعليم أوضح، متابعة أذكى، <span>وتواصل أقرب.</span></h1>
          <p>بوابة واحدة تجمع الإدارة والمعلم والطالب وولي الأمر، وتحول الدرجات والحضور والملاحظات والمتابعة إلى تجربة تعليمية واضحة تساعد على اتخاذ القرار وتحسين التحصيل.</p>
          <div className="dlx-hero-tags"><span>متابعة التحصيل</span><span>تحليل الأداء</span><span>الحضور والانضباط</span><span>التواصل المدرسي</span><span>مساعدة ذكية</span></div>
        </div>

        <aside className="dlx-smart-preview" aria-label="مزايا الذكاء في البوابة">
          <div className="dlx-preview-head"><span>المركز الذكي</span><b>● متصل بالبوابة</b></div>
          <h2>المعلومة المهمة تظهر أولاً</h2>
          <p>واجهة تساعد كل مستخدم على الوصول لما يحتاجه بسرعة، بدل البحث بين الصفحات والبيانات.</p>
          <div className="dlx-preview-grid">
            <article className="dlx-mini"><i>◎</i><div><strong>تحليل الأداء</strong><small>قراءة أوضح للتحصيل</small></div></article>
            <article className="dlx-mini"><i>✓</i><div><strong>متابعة الحضور</strong><small>حالة الطالب مباشرة</small></div></article>
            <article className="dlx-mini"><i>✦</i><div><strong>مساعد ذكي</strong><small>اقتراح الخطوة التالية</small></div></article>
            <article className="dlx-mini"><i>↗</i><div><strong>تقارير مختصرة</strong><small>قرارات أسرع وأوضح</small></div></article>
          </div>
          <div className="dlx-preview-note"><b>هوية البوابة:</b> تعليم مدرسي حديث، إنساني وذكي — يخدم المعلم والطالب والأسرة.</div>
        </aside>
      </section>

      <section className="dlx-entry-wrap" aria-label="بوابات الدخول">
        <div className="dlx-section-title"><div><small>اختر مساحة العمل</small><h2>ثلاث بوابات، تجربة واحدة متكاملة</h2></div><span>نفس الهوية • أدوات مختلفة حسب المستخدم</span></div>
        <nav className="dlx-portal-grid">
          {portals.map(portal => <Link className={`dlx-card ${portal.kind}`} href={portal.href} key={portal.href}>
            <div className="dlx-card-top"><span className="dlx-icon"><PortalGlyph kind={portal.kind} /></span><span className="dlx-card-eyebrow">{portal.eyebrow}</span></div>
            <h3>{portal.title}</h3><p>{portal.text}</p>
            <ul>{portal.bullets.map(item => <li key={item}>{item}</li>)}</ul>
            <span className="dlx-enter" aria-hidden="true">←</span>
          </Link>)}
        </nav>
      </section>

      <section className="dlx-lower">
        <div className="dlx-feature-strip">
          <article className="dlx-feature"><span>✦ مساعدة ذكية</span><small>توجيه مناسب حسب دور المستخدم والبيانات المتاحة.</small></article>
          <article className="dlx-feature"><span>◉ متابعة مستمرة</span><small>التحصيل والحضور والملاحظات في مسار واحد.</small></article>
          <article className="dlx-feature"><span>↗ قرارات أوضح</span><small>مؤشرات مختصرة تساعد الإدارة والمعلم والأسرة.</small></article>
          <article className="dlx-feature"><span>⌁ هوية مدرسية</span><small>تصميم حي يعكس التعليم والمواد والمعرفة.</small></article>
        </div>
        <aside className="dlx-qr"><StudentDirectQr /></aside>
      </section>

      <footer className="dlx-footer"><span>منصة تعليمية مدرسية ذكية</span><div>إعداد البوابة: <b>الأستاذ حسن علي الطويل</b></div></footer>
    </div>
  </main>;
}
