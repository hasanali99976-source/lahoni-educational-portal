"use client";

import Link from "next/link";

const portals = [
  { href: "/admin", cls: "admin", icon: "♛", title: "بوابة الإدارة", text: "إدارة واعية • متابعة شاملة • تقارير وقرارات أدق", action: "دخول الإدارة" },
  { href: "/teacher", cls: "teacher", icon: "✦", title: "بوابة المعلم", text: "متابعة التحصيل والحضور والخطط وصناعة أثر تعليمي", action: "دخول المعلم" },
  { href: "/student", cls: "student", icon: "⌁", title: "بوابة الطالب / ولي الأمر", text: "رحلة تعلم مترابطة • تقدم واضح • متابعة مستمرة", action: "دخول الطالب / ولي الأمر" },
] as const;

const classroomPhoto = "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&fm=jpg&q=94&w=2600";

const css = `
#lahooni-home{min-height:100dvh;direction:rtl;position:relative;overflow-x:hidden;background:#071a27;color:#fff;font-family:inherit}
#lahooni-home *{box-sizing:border-box}
.world{position:fixed;inset:0;background:url('${classroomPhoto}') center/cover no-repeat;filter:saturate(1.08) contrast(1.03) brightness(1.02);transform:scale(1.018)}
.world:before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(3,16,28,.10),rgba(3,18,31,.16) 42%,rgba(3,16,27,.40)),radial-gradient(circle at 50% 15%,rgba(255,214,132,.32),transparent 34%)}
.world:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(3,20,34,.44),transparent 18%,transparent 82%,rgba(3,20,34,.32));mix-blend-mode:multiply}
.glow{position:fixed;border-radius:999px;filter:blur(80px);pointer-events:none;opacity:.22;animation:float 9s ease-in-out infinite}.g1{width:360px;height:360px;right:-80px;top:18%;background:#f1ba50}.g2{width:420px;height:420px;left:-100px;bottom:3%;background:#19c7ad;animation-delay:-3s}.g3{width:280px;height:280px;left:42%;top:33%;background:#1a9fe8;animation-delay:-5s}@keyframes float{50%{transform:translateY(-18px) scale(1.05)}}
.shell{position:relative;z-index:2;width:min(1460px,96vw);min-height:100dvh;margin:auto;padding:14px 0 18px;display:flex;flex-direction:column}
.nav{height:76px;border-radius:0 0 26px 26px;padding:8px 20px;background:linear-gradient(135deg,rgba(4,26,43,.97),rgba(5,50,66,.94));border:1px solid rgba(255,255,255,.10);box-shadow:0 18px 46px rgba(0,0,0,.26),inset 0 1px rgba(255,255,255,.08);backdrop-filter:blur(18px);display:flex;align-items:center;justify-content:space-between;gap:18px}
.brand{display:flex;align-items:center;gap:12px}.brand img{width:56px;height:56px;object-fit:cover;border-radius:18px;border:2px solid #e9bd61;box-shadow:0 0 0 4px rgba(233,189,97,.08),0 12px 28px rgba(0,0,0,.32)}.brand strong{display:block;font-size:17px;font-weight:950;letter-spacing:-.4px}.brand span{display:block;margin-top:2px;font-size:9px;color:#d6e4e8}.navlinks{display:flex;align-items:center;gap:10px}.navlinks span{font-size:10px;font-weight:850;color:#d9e6ea;padding:8px 12px;border-radius:14px}.navlinks .home{background:linear-gradient(145deg,#ebc36e,#bd8430);color:#102d3d;box-shadow:0 10px 24px rgba(211,158,66,.28)}.value-badge{display:flex;align-items:center;gap:9px;padding:9px 15px;border-radius:18px;border:1px solid rgba(231,187,94,.48);background:rgba(5,30,44,.58);box-shadow:inset 0 1px rgba(255,255,255,.08),0 12px 24px rgba(0,0,0,.16);font-size:9px;font-weight:900;color:#f3d58f}.value-badge b{font-size:19px;color:#f0bf59;text-shadow:0 0 16px rgba(240,191,89,.6)}
.hero{position:relative;text-align:center;padding:34px 16px 18px}.hero .welcome{display:block;font-size:15px;font-weight:800;color:#e9f0f2}.hero h1{margin:6px 0 0;font-size:clamp(42px,5.5vw,72px);line-height:1;font-weight:950;letter-spacing:-1.8px;background:linear-gradient(180deg,#fff6d8 0%,#f3cf79 43%,#d89e38 100%);-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:0 10px 35px rgba(0,0,0,.24)}.hero p{margin:12px auto 0;max-width:780px;font-size:13px;line-height:1.9;color:#eef5f6;font-weight:700}.hero .rule{width:190px;height:3px;border-radius:999px;margin:14px auto 0;background:linear-gradient(90deg,transparent,#efc15f,transparent);box-shadow:0 0 24px rgba(239,193,95,.6)}
.mainstage{display:grid;grid-template-columns:180px minmax(0,1fr) 210px;align-items:end;gap:18px;margin-top:6px;perspective:1700px}.guide{align-self:center;display:flex;flex-direction:column;align-items:center;gap:10px}.guide-photo{width:116px;height:116px;border-radius:30px;overflow:hidden;border:2px solid rgba(239,194,95,.9);box-shadow:0 18px 35px rgba(0,0,0,.25),0 0 32px rgba(239,194,95,.13);background:rgba(255,255,255,.08);transform:rotateY(8deg) translateZ(25px)}.guide-photo img{width:100%;height:100%;object-fit:cover}.guide-card{width:100%;padding:12px 10px;border-radius:19px;background:rgba(5,27,42,.66);border:1px solid rgba(255,255,255,.11);backdrop-filter:blur(14px);text-align:center;box-shadow:0 18px 35px rgba(0,0,0,.18)}.guide-card b{display:block;color:#f0c66d;font-size:10px;margin-bottom:4px}.guide-card span{font-size:8.7px;line-height:1.65;color:#dce7ea}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;direction:ltr;perspective:1500px}.portal-card{direction:rtl;position:relative;min-height:350px;border-radius:18px 18px 8px 8px;text-decoration:none;color:#fff;padding:18px 18px 16px;overflow:hidden;display:flex;flex-direction:column;align-items:center;text-align:center;border:1px solid rgba(255,255,255,.34);backdrop-filter:blur(16px) saturate(1.3);transform-style:preserve-3d;transition:.32s cubic-bezier(.2,.8,.2,1);box-shadow:0 34px 55px rgba(0,0,0,.28),inset 0 1px rgba(255,255,255,.35),inset 0 -38px 70px rgba(0,0,0,.18)}
.portal-card:hover{transform:translateY(-11px) translateZ(46px) rotateX(1.5deg);box-shadow:0 46px 68px rgba(0,0,0,.34),0 0 35px rgba(255,255,255,.10)}.portal-card:before{content:"";position:absolute;inset:0;background:linear-gradient(122deg,rgba(255,255,255,.34),transparent 22%,transparent 58%,rgba(255,255,255,.09));pointer-events:none}.portal-card:after{content:"";position:absolute;inset:8px;border:1px solid rgba(255,255,255,.25);border-radius:13px 13px 6px 6px;box-shadow:inset 0 0 34px rgba(255,255,255,.06);pointer-events:none}.admin{background:linear-gradient(180deg,rgba(173,112,24,.74),rgba(91,55,14,.72))}.teacher{background:linear-gradient(180deg,rgba(0,123,203,.74),rgba(7,59,104,.74))}.student{background:linear-gradient(180deg,rgba(0,159,120,.74),rgba(4,84,69,.74))}.door-light{position:absolute;left:8%;right:8%;bottom:-8px;height:16px;border-radius:50%;filter:blur(8px);opacity:.95}.admin .door-light{background:#ffbd43}.teacher .door-light{background:#27aefa}.student .door-light{background:#1edbb0}.portal-icon{position:relative;z-index:2;width:92px;height:92px;margin:24px 0 20px;border-radius:28px;display:grid;place-items:center;background:linear-gradient(145deg,rgba(255,255,255,.42),rgba(255,255,255,.09));border:1px solid rgba(255,255,255,.48);box-shadow:0 18px 28px rgba(0,0,0,.22),inset 0 1px rgba(255,255,255,.55),0 0 24px rgba(255,255,255,.08);font-size:40px;font-weight:950;transform:translateZ(38px)}.portal-card h2{position:relative;z-index:2;margin:0 0 8px;font-size:24px;font-weight:950;letter-spacing:-.4px}.portal-card p{position:relative;z-index:2;margin:0;max-width:280px;font-size:11px;line-height:1.85;color:#eef8f7;font-weight:700}.enter{position:relative;z-index:2;margin-top:auto;width:82%;height:48px;border-radius:24px;display:flex;align-items:center;justify-content:center;gap:8px;background:linear-gradient(180deg,rgba(255,255,255,.30),rgba(255,255,255,.14));border:1px solid rgba(255,255,255,.36);box-shadow:inset 0 1px rgba(255,255,255,.4),0 12px 24px rgba(0,0,0,.16);font-size:11px;font-weight:950}.enter:after{content:"←";font-size:18px}
.value-card{align-self:center;padding:18px 16px;border-radius:22px;background:linear-gradient(145deg,rgba(7,34,49,.82),rgba(17,50,60,.62));border:1px solid rgba(235,193,104,.34);backdrop-filter:blur(16px);box-shadow:0 22px 40px rgba(0,0,0,.22),inset 0 1px rgba(255,255,255,.08);text-align:center}.value-card .diamond{width:58px;height:58px;margin:0 auto 10px;border-radius:20px;display:grid;place-items:center;background:linear-gradient(145deg,#f3d486,#c78c30);color:#113242;font-size:26px;box-shadow:0 12px 25px rgba(200,142,48,.25)}.value-card b{display:block;color:#f2cf7d;font-size:14px;line-height:1.5}.value-card p{margin:8px 0 0;font-size:9.5px;line-height:1.7;color:#dce7e9}.value-card .quote{margin-top:14px;padding-top:13px;border-top:1px solid rgba(255,255,255,.10);color:#fff1c7;font-weight:850}
.features{display:grid;grid-template-columns:repeat(5,1fr);gap:1px;margin:24px auto 0;width:min(1140px,92%);padding:10px;border-radius:20px;background:rgba(4,29,44,.73);border:1px solid rgba(255,255,255,.13);box-shadow:0 22px 40px rgba(0,0,0,.24),inset 0 1px rgba(255,255,255,.08);backdrop-filter:blur(16px)}.feature{min-height:58px;padding:7px 12px;display:flex;align-items:center;justify-content:center;gap:10px;border-left:1px solid rgba(255,255,255,.09)}.feature:last-child{border-left:0}.fi{width:36px;height:36px;border-radius:12px;display:grid;place-items:center;background:linear-gradient(145deg,#f0cb78,#bd8130);color:#102f40;font-weight:950;box-shadow:0 8px 16px rgba(194,134,44,.22)}.feature b{display:block;color:#f2d389;font-size:10px;margin-bottom:2px}.feature span:last-child{font-size:8.5px;line-height:1.5;color:#dbe6e9}
.footer{position:relative;margin-top:18px;min-height:64px;border-radius:24px 24px 0 0;background:linear-gradient(135deg,rgba(4,26,43,.98),rgba(6,52,68,.95));border:1px solid rgba(255,255,255,.08);box-shadow:0 -10px 35px rgba(0,0,0,.16);display:flex;align-items:center;justify-content:space-between;padding:0 22px;color:#d0dde1;font-size:9px}.footer b{color:#efc46b}.footer .mini-brand{display:flex;align-items:center;gap:9px}.footer .mini-brand img{width:38px;height:38px;border-radius:13px;border:1px solid #e6bb63}.footer .motto{font-size:10px;font-weight:850}.footer .motto b{font-size:11px}
@media(max-width:1000px){.mainstage{grid-template-columns:1fr}.guide,.value-card{display:none}.cards{max-width:960px;margin:auto}.features{width:100%}}
@media(max-width:780px){.shell{width:96vw;padding-top:6px}.nav{height:64px;padding:6px 10px;border-radius:0 0 19px 19px}.brand img{width:46px;height:46px;border-radius:14px}.brand strong{font-size:12px}.brand span,.navlinks,.value-badge{display:none}.hero{padding:24px 8px 12px}.hero .welcome{font-size:11px}.hero h1{font-size:32px;letter-spacing:-.8px}.hero p{font-size:9.5px}.cards{grid-template-columns:1fr;direction:rtl;gap:11px}.portal-card{min-height:175px;display:grid;grid-template-columns:82px 1fr;grid-template-rows:auto auto 43px;text-align:right;padding:12px}.portal-icon{grid-row:1/3;width:70px;height:70px;margin:0;border-radius:21px;font-size:28px}.portal-card h2{font-size:17px;margin:0}.portal-card p{font-size:9px}.enter{grid-column:1/3;width:100%;height:43px}.features{grid-template-columns:1fr 1fr;padding:7px}.feature{justify-content:flex-start;border:0;border-bottom:1px solid rgba(255,255,255,.08)}.footer{min-height:54px;padding:0 12px}.footer .motto{display:none}}
`;

export default function ApprovedHomeClient(){
  return <main id="lahooni-home" dir="rtl">
    <style>{css}</style>
    <div className="world" aria-hidden="true"/>
    <span className="glow g1"/><span className="glow g2"/><span className="glow g3"/>

    <div className="shell">
      <header className="nav">
        <div className="brand"><img src="/icons/lahooni-identity-320.jpg" alt="هوية منصة أستاذ لحوني التعليمية"/><div><strong>أستاذ لحوني التعليمية</strong><span>منصة تعليمية رقمية ذكية ومترابطة</span></div></div>
        <div className="navlinks"><span className="home">الرئيسية</span><span>عن المنصة</span><span>مميزاتها</span><span>تواصل معنا</span></div>
        <div className="value-badge"><b>☆</b><span>معًا نصنع أثرًا تعليميًا يبقى</span></div>
      </header>

      <section className="hero">
        <span className="welcome">مرحبًا بكم في بوابة</span>
        <h1>أستاذ لحوني التعليمية</h1>
        <p>بيئة تعليمية ذكية تجمع الإدارة والمعلم والطالب وولي الأمر في منظومة واحدة؛ متابعة أوضح، قرارات أدق، وتجربة رقمية ترفع قيمة التعلم.</p>
        <div className="rule"/>
      </section>

      <section className="mainstage" aria-label="بوابات الدخول">
        <aside className="guide" aria-label="هوية المنصة">
          <div className="guide-photo"><img src="/icons/lahooni-identity-320.jpg" alt="هوية أستاذ لحوني"/></div>
          <div className="guide-card"><b>منصة تصنع الأثر</b><span>تعليم منظم، متابعة مترابطة، وتجربة تضع الطالب في قلب العملية التعليمية.</span></div>
        </aside>

        <div className="cards">
          {portals.map(p=><Link key={p.href} href={p.href} className={`portal-card ${p.cls}`}>
            <div className="portal-icon" aria-hidden="true">{p.icon}</div>
            <h2>{p.title}</h2>
            <p>{p.text}</p>
            <div className="enter">{p.action}</div>
            <span className="door-light" aria-hidden="true"/>
          </Link>)}
        </div>

        <aside className="value-card" aria-label="قيمة المنصة">
          <div className="diamond">◆</div>
          <b>منصة متكاملة<br/>بقيمة تعليمية حقيقية</b>
          <p>تربط البيانات بالمتابعة، والمتابعة بالتحسين، والتحسين بنتائج يمكن قياسها.</p>
          <p className="quote">كل معلومة أوضح<br/>تعني قرارًا أفضل</p>
        </aside>
      </section>

      <section className="features" aria-label="مزايا المنصة">
        <div className="feature"><span className="fi">◆</span><span><b>منصة متكاملة</b>قيمة تعليمية حقيقية</span></div>
        <div className="feature"><span className="fi">◎</span><span><b>ترابط ذكي</b>الإدارة والمعلم والأسرة</span></div>
        <div className="feature"><span className="fi">✦</span><span><b>تعلم تفاعلي</b>يحفز المتابعة والتقدم</span></div>
        <div className="feature"><span className="fi">▥</span><span><b>محتوى منظم</b>وضوح وسهولة وصول</span></div>
        <div className="feature"><span className="fi">✓</span><span><b>بيئة موثوقة</b>متابعة آمنة ومستقرة</span></div>
      </section>

      <footer className="footer">
        <div className="mini-brand"><img src="/icons/lahooni-identity-320.jpg" alt="شعار أستاذ لحوني"/><span><b>أستاذ لحوني التعليمية</b><br/>منصة تصنع قيمة تعليمية</span></div>
        <div className="motto">معًا نحو <b>تعليم أوضح وأثر أكبر</b></div>
        <span>تصميم وتنفيذ: الأستاذ حسن علي الطويل</span>
      </footer>
    </div>
  </main>
}
