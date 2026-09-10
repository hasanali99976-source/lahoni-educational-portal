"use client";

import Link from "next/link";

const portals = [
  { href: "/admin", cls: "admin", icon: "⚙", title: "بوابة الإدارة", text: "إدارة شاملة لبيئة تعليمية فعّالة", action: "دخول الإدارة" },
  { href: "/teacher", cls: "teacher", icon: "▤", title: "بوابة المعلم", text: "معًا نصنع الفرق في تعليم أبنائنا", action: "دخول المعلم" },
  { href: "/student", cls: "student", icon: "🎓", title: "بوابة الطالب / ولي الأمر", text: "شراكة حقيقية لرحلة نجاح متميزة", action: "دخول الطالب / ولي الأمر" },
] as const;

const features = [
  ["▥", "متابعة مستمرة", "لنمو الطالب"],
  ["◎", "أدوات ذكية", "لتحقيق الأهداف"],
  ["♟", "تواصل فعّال", "بين جميع الأطراف"],
  ["◇", "بيئة آمنة", "وخصوصية عالية"],
] as const;

const css = `
#lahooni-home{min-height:100dvh;direction:rtl;color:#0c2d49;position:relative;overflow:hidden;background:#d9e0e6;font-family:inherit}
#lahooni-home *{box-sizing:border-box}
.edu-scene{position:absolute;inset:0;background:linear-gradient(90deg,rgba(7,35,55,.30),rgba(239,244,247,.24) 28%,rgba(250,248,243,.62) 50%,rgba(233,241,246,.28) 72%,rgba(6,42,55,.28)),url('/saudi-classroom.svg') center/cover no-repeat;filter:saturate(.82) contrast(1.02)}
.edu-scene:after{content:"";position:absolute;inset:0;background:linear-gradient(to bottom,rgba(255,255,255,.05),rgba(5,31,50,.08) 65%,rgba(5,29,46,.20));backdrop-filter:blur(.35px)}
.home-wrap{position:relative;z-index:2;width:min(1180px,94vw);margin:0 auto;padding:18px 0 0;min-height:100dvh;display:flex;flex-direction:column}
.topbar{height:78px;border-radius:38px;background:linear-gradient(135deg,#082a45,#051f35);display:flex;align-items:center;justify-content:space-between;padding:7px 14px 7px 8px;box-shadow:0 16px 40px rgba(4,24,40,.25);border:1px solid rgba(223,179,87,.18)}
.brand{display:flex;align-items:center;gap:12px;color:#fff;min-width:0}.brand img{width:62px;height:62px;border-radius:50%;object-fit:cover;border:2px solid #d7aa52;box-shadow:0 6px 18px rgba(0,0,0,.28)}.brand-copy strong{display:block;font-size:16px}.brand-copy span{display:block;font-size:12px;opacity:.85;margin-top:2px}
.nav{display:flex;align-items:center;gap:6px}.nav a{color:#f4f7fa;text-decoration:none;padding:11px 14px;border-radius:24px;font-size:12px;white-space:nowrap}.nav a:hover{background:rgba(255,255,255,.08)}.nav .active{color:#f3cf84;font-weight:900;border:1px solid rgba(224,182,93,.44);background:linear-gradient(145deg,rgba(255,255,255,.11),rgba(205,151,49,.10))}
.hero{text-align:center;padding:24px 20px 16px}.hero-logo{width:88px;height:88px;border-radius:50%;object-fit:cover;border:3px solid #d7aa52;box-shadow:0 12px 30px rgba(4,32,52,.30);margin-bottom:8px}.hero-kicker{font-size:22px;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.35);font-weight:700}.hero h1{margin:3px 0 0;font-size:clamp(38px,5vw,61px);line-height:1.1;font-weight:950;color:#f1c875;text-shadow:0 5px 18px rgba(0,31,57,.48);letter-spacing:-1.7px}.hero p{margin:10px 0 0;font-size:17px;color:#fff;text-shadow:0 2px 10px rgba(0,0,0,.38)}.gold-rule{width:110px;height:3px;border-radius:10px;margin:14px auto 0;background:linear-gradient(90deg,transparent,#e2ae49,transparent)}
.main-row{display:grid;grid-template-columns:1fr;align-items:center;flex:1}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;direction:ltr}.portal-card{direction:rtl;min-height:318px;padding:22px 18px 18px;border-radius:25px;text-decoration:none;color:#0c2741;display:flex;flex-direction:column;align-items:center;text-align:center;border:1px solid rgba(255,255,255,.72);backdrop-filter:blur(14px);box-shadow:0 18px 32px rgba(8,34,52,.20),inset 0 1px rgba(255,255,255,.88);transition:transform .25s ease,box-shadow .25s ease}.portal-card:hover{transform:translateY(-7px);box-shadow:0 26px 44px rgba(8,34,52,.28)}.portal-card.admin{background:linear-gradient(150deg,rgba(255,246,226,.94),rgba(240,216,171,.90))}.portal-card.teacher{background:linear-gradient(150deg,rgba(225,244,255,.94),rgba(181,217,246,.90))}.portal-card.student{background:linear-gradient(150deg,rgba(223,255,246,.94),rgba(168,230,211,.90))}
.card-visual{width:122px;height:106px;border-radius:24px;display:grid;place-items:center;font-size:62px;margin:0 0 10px;filter:drop-shadow(0 9px 10px rgba(0,0,0,.13));background:rgba(255,255,255,.14)}.admin .card-visual{color:#9a6c17}.teacher .card-visual{color:#0a5394}.student .card-visual{color:#087458}.portal-card h2{margin:2px 0 6px;font-size:24px;font-weight:950}.portal-card p{margin:0;color:#283b4a;font-size:13px;line-height:1.8}.enter-btn{margin-top:auto;width:100%;height:48px;border-radius:24px;color:#fff;font-weight:900;font-size:14px;display:flex;align-items:center;justify-content:center;position:relative;box-shadow:0 10px 18px rgba(0,0,0,.18)}.admin .enter-btn{background:linear-gradient(90deg,#9c6411,#c28d32)}.teacher .enter-btn{background:linear-gradient(90deg,#064584,#0a63a9)}.student .enter-btn{background:linear-gradient(90deg,#006d50,#0d8f6b)}.enter-btn b{position:absolute;left:4px;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:#fff;color:#0c2d49;font-size:20px}
.features{width:min(760px,90%);margin:18px auto 0;display:grid;grid-template-columns:repeat(4,1fr);background:rgba(252,248,243,.74);border:1px solid rgba(255,255,255,.72);backdrop-filter:blur(15px);border-radius:22px;box-shadow:0 14px 30px rgba(6,31,48,.13);overflow:hidden}.feature{padding:14px 10px;text-align:center;border-left:1px solid rgba(12,45,73,.11);font-size:11px;line-height:1.6}.feature:last-child{border-left:0}.feature b{display:block;font-size:27px;margin-bottom:4px}.feature strong{display:block;font-size:12px}
.info-strip{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px auto 0;width:min(900px,100%)}.info-card{scroll-margin-top:100px;background:rgba(4,29,47,.82);color:#fff;border:1px solid rgba(224,181,91,.20);border-radius:18px;padding:12px 14px;text-align:center;backdrop-filter:blur(12px)}.info-card h3{margin:0 0 3px;font-size:13px;color:#f1c875}.info-card p{margin:0;font-size:10px;opacity:.88;line-height:1.65}
.footer{margin-top:16px;background:linear-gradient(135deg,#082a45,#061e33);color:#fff;border-radius:28px 28px 0 0;padding:13px 18px;display:flex;align-items:center;justify-content:space-between;gap:20px;font-size:11px;border-top:1px solid rgba(223,179,87,.34)}.footer strong{color:#f0c97a}.values{display:flex;gap:16px;flex-wrap:wrap;justify-content:center}.values span{color:#e9edf1}.values b{color:#e6b65e;margin-left:4px}
@media(max-width:900px){.home-wrap{width:min(96vw,820px)}.topbar{height:auto;min-height:68px}.brand-copy{display:none}.nav a{padding:9px 9px;font-size:10px}.hero{padding-top:18px}.hero-logo{width:74px;height:74px}.cards{gap:11px}.portal-card{min-height:290px;padding:18px 12px}.portal-card h2{font-size:19px}.card-visual{width:94px;height:86px;font-size:48px}.footer{flex-direction:column;text-align:center}}
@media(max-width:680px){.topbar{border-radius:22px;padding:7px}.brand img{width:50px;height:50px}.nav{flex:1;justify-content:flex-end}.nav a:nth-child(3),.nav a:nth-child(4){display:none}.hero{padding:16px 8px 12px}.hero h1{font-size:34px;letter-spacing:-1px}.hero-kicker{font-size:17px}.hero p{font-size:12px}.cards{grid-template-columns:1fr;direction:rtl}.portal-card{min-height:178px;display:grid;grid-template-columns:78px 1fr;grid-template-rows:auto auto 48px;text-align:right;column-gap:12px;align-items:center}.card-visual{grid-row:1/3;width:78px;height:78px;font-size:41px;margin:0}.portal-card h2{margin:0;font-size:19px}.portal-card p{font-size:11px}.enter-btn{grid-column:1/3;margin-top:6px}.features{grid-template-columns:repeat(2,1fr);width:100%}.info-strip{grid-template-columns:1fr}.footer{border-radius:20px 20px 0 0}.values{gap:9px}}
`;

export default function ApprovedHomeClient(){
  return <main id="lahooni-home" dir="rtl">
    <style>{css}</style>
    <div className="edu-scene" aria-hidden="true" />
    <div className="home-wrap">
      <header className="topbar">
        <div className="brand">
          <img src="/icons/lahooni-identity-320.jpg" alt="شعار منصة أستاذ لحوني التعليمية" />
          <div className="brand-copy"><strong>منصة أستاذ لحوني التعليمية</strong><span>بالعلم نصنع المستقبل</span></div>
        </div>
        <nav className="nav" aria-label="التنقل الرئيسي">
          <a className="active" href="#top">⌂ الرئيسية</a>
          <a href="#about">ⓘ عن المنصة</a>
          <a href="#knowledge">▭ مركز المعرفة</a>
          <a href="#help">◌ مركز المساعدة</a>
        </nav>
      </header>

      <section id="top" className="hero">
        <img className="hero-logo" src="/icons/lahooni-identity-320.jpg" alt="شعار البوابة" />
        <div className="hero-kicker">مرحبًا بكم في</div>
        <h1>منصة أستاذ لحوني التعليمية</h1>
        <p>بيئة رقمية لمتابعة الطلاب وتحقيق التميز الدراسي</p>
        <div className="gold-rule" />
      </section>

      <section className="main-row" aria-label="بوابات الدخول">
        <div>
          <div className="cards">
            {portals.map((p)=><Link key={p.href} href={p.href} className={`portal-card ${p.cls}`}>
              <div className="card-visual" aria-hidden="true">{p.icon}</div>
              <h2>{p.title}</h2><p>{p.text}</p>
              <div className="enter-btn">{p.action}<b>←</b></div>
            </Link>)}
          </div>
          <div className="features">
            {features.map(([i,t,s])=><div className="feature" key={t}><b>{i}</b><strong>{t}</strong>{s}</div>)}
          </div>
          <div className="info-strip">
            <section id="about" className="info-card"><h3>عن المنصة</h3><p>بوابة موحّدة تربط الإدارة والمعلم والطالب وولي الأمر في تجربة تعليمية واضحة.</p></section>
            <section id="knowledge" className="info-card"><h3>مركز المعرفة</h3><p>الوصول السريع للمتابعة والتحصيل والتقارير والأدوات التعليمية داخل كل بوابة.</p></section>
            <section id="help" className="info-card"><h3>مركز المساعدة</h3><p>ابدأ من البوابة المناسبة لك، وستظهر لك الأدوات والبيانات المرتبطة بحسابك.</p></section>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div><strong>منصة أستاذ لحوني التعليمية</strong><br/>تصميم وتنفيذ: أ. حسن علي الطويل</div>
        <div className="values"><span><b>♟</b>شراكة مجتمعية</span><span><b>▥</b>مخرجات متميزة</span><span><b>✦</b>تعليم مؤثر</span><span><b>🎓</b>قيم أصيلة</span></div>
      </footer>
    </div>
  </main>
}
