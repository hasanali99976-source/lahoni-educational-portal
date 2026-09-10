"use client";

import Link from "next/link";

const portals = [
  { href: "/admin", cls: "admin", icon: "⚙", title: "بوابة الإدارة", text: "إدارة شاملة لبيئة تعليمية فعّالة", action: "دخول الإدارة" },
  { href: "/teacher", cls: "teacher", icon: "✎", title: "بوابة المعلم", text: "معًا نصنع الفرق في تعليم أبنائنا", action: "دخول المعلم" },
  { href: "/student", cls: "student", icon: "🎓", title: "بوابة الطالب / ولي الأمر", text: "شراكة حقيقية لرحلة نجاح متميزة", action: "دخول الطالب / ولي الأمر" },
] as const;

const features = [
  ["▥", "متابعة مستمرة", "لنمو الطالب"],
  ["◎", "أدوات ذكية", "لتحقيق الأهداف"],
  ["♟", "تواصل فعّال", "بين جميع الأطراف"],
  ["◇", "بيئة آمنة", "وخصوصية عالية"],
] as const;

const css = `
#lahooni-home{min-height:100dvh;direction:rtl;position:relative;overflow:hidden;color:#0b2d4b;background:linear-gradient(180deg,#dfe8ee 0%,#eef2f2 42%,#e5ddd0 100%);font-family:inherit}
#lahooni-home *{box-sizing:border-box}
.education-bg{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.education-bg:before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(6,30,48,.48) 0%,rgba(6,30,48,.16) 20%,rgba(255,255,255,.36) 50%,rgba(7,34,54,.15) 80%,rgba(7,34,54,.44) 100%),linear-gradient(180deg,rgba(255,255,255,.18),rgba(255,255,255,.02) 55%,rgba(4,28,46,.16));}
.edu-board{position:absolute;left:2.5%;top:12%;width:250px;height:335px;border-radius:20px;background:linear-gradient(145deg,#123b43,#0c2f37);box-shadow:0 24px 60px rgba(7,30,43,.24),inset 0 0 0 10px rgba(195,145,61,.32);transform:rotate(-1.4deg);opacity:.92}
.edu-board:before{content:"تعليم\A يلهم..\A مهارات\A تصنع\A المستقبل";white-space:pre;position:absolute;inset:42px 25px;color:rgba(255,255,255,.9);font-size:23px;line-height:1.55;text-align:center;font-weight:600}
.edu-board:after{content:"";position:absolute;left:46px;right:46px;bottom:36px;height:4px;border-radius:8px;background:#d7a449;transform:rotate(5deg)}
.edu-window{position:absolute;right:3%;top:10%;width:270px;height:345px;border-radius:24px;background:linear-gradient(145deg,rgba(210,233,246,.78),rgba(255,255,255,.58));box-shadow:inset 0 0 0 12px rgba(255,255,255,.58),0 24px 55px rgba(25,55,72,.14)}
.edu-window:before,.edu-window:after{content:"";position:absolute;background:rgba(255,255,255,.74)}
.edu-window:before{left:50%;top:12px;bottom:12px;width:9px;transform:translateX(-50%)}.edu-window:after{left:12px;right:12px;top:50%;height:9px;transform:translateY(-50%)}
.edu-people{position:absolute;right:5%;bottom:13%;width:250px;height:220px;background:url('/students-learning.svg') center/contain no-repeat;opacity:.32;filter:saturate(.8)}
.edu-study{position:absolute;left:5%;bottom:14%;width:245px;height:210px;background:url('/student-learning-illustration.svg') center/contain no-repeat;opacity:.28;filter:saturate(.8)}
.edu-subjects{position:absolute;left:50%;bottom:0;width:430px;height:230px;transform:translateX(-50%);background:url('/subject-collage.svg') center bottom/contain no-repeat;opacity:.12}
.edu-floor{position:absolute;left:-10%;right:-10%;bottom:-13%;height:35%;background:linear-gradient(180deg,#a87b4a,#7c512d);transform:perspective(550px) rotateX(66deg);transform-origin:bottom;opacity:.62;box-shadow:inset 0 25px 60px rgba(255,255,255,.13)}
.edu-glow{position:absolute;inset:0;background:radial-gradient(circle at 50% 31%,rgba(255,255,255,.82),rgba(255,255,255,.20) 28%,transparent 55%)}
.home-wrap{position:relative;z-index:2;width:min(1120px,94vw);margin:0 auto;padding:16px 0 0;min-height:100dvh;display:flex;flex-direction:column}
.topbar{min-height:74px;border-radius:38px;background:linear-gradient(135deg,#082a45,#051e33);display:flex;align-items:center;justify-content:center;padding:7px 18px;box-shadow:0 14px 36px rgba(4,24,40,.24);border:1px solid rgba(225,181,89,.28)}
.brand{display:flex;align-items:center;gap:13px;color:#fff}.brand img{width:60px;height:60px;border-radius:50%;object-fit:cover;border:2px solid #d9ad56;box-shadow:0 6px 18px rgba(0,0,0,.26)}.brand-copy strong{display:block;font-size:17px}.brand-copy span{display:block;font-size:12px;opacity:.88;margin-top:2px}
.hero{text-align:center;padding:18px 20px 13px}.hero-logo{width:76px;height:76px;border-radius:50%;object-fit:cover;border:3px solid #d8aa51;box-shadow:0 10px 28px rgba(4,32,52,.28);margin-bottom:7px}.hero-kicker{font-size:20px;color:#0f385b;font-weight:800}.hero h1{margin:2px 0 0;font-size:clamp(34px,4.4vw,55px);line-height:1.1;font-weight:950;color:#c68b2d;text-shadow:0 2px 8px rgba(255,255,255,.9);letter-spacing:-1.2px}.hero p{margin:8px 0 0;font-size:16px;color:#1e3b51;font-weight:600}.gold-rule{width:100px;height:3px;border-radius:10px;margin:12px auto 0;background:linear-gradient(90deg,transparent,#d8a542,transparent)}
.main-row{display:grid;grid-template-columns:1fr;align-items:center;flex:1}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;direction:ltr}.portal-card{direction:rtl;min-height:305px;padding:20px 17px 17px;border-radius:25px;text-decoration:none;color:#0c2741;display:flex;flex-direction:column;align-items:center;text-align:center;border:1px solid rgba(255,255,255,.74);backdrop-filter:blur(14px);box-shadow:0 18px 32px rgba(8,34,52,.20),inset 0 1px rgba(255,255,255,.92);transition:transform .24s ease,box-shadow .24s ease}.portal-card:hover{transform:translateY(-6px);box-shadow:0 25px 42px rgba(8,34,52,.26)}.portal-card.admin{background:linear-gradient(150deg,rgba(255,247,229,.95),rgba(239,214,168,.91))}.portal-card.teacher{background:linear-gradient(150deg,rgba(228,246,255,.95),rgba(181,218,248,.91))}.portal-card.student{background:linear-gradient(150deg,rgba(225,255,247,.95),rgba(171,231,213,.91))}
.card-visual{width:112px;height:96px;border-radius:22px;display:grid;place-items:center;font-size:56px;margin:0 0 9px;filter:drop-shadow(0 8px 10px rgba(0,0,0,.12));background:rgba(255,255,255,.18)}.admin .card-visual{color:#9a6c17}.teacher .card-visual{color:#0a5394}.student .card-visual{color:#087458}.portal-card h2{margin:2px 0 6px;font-size:22px;font-weight:950}.portal-card p{margin:0;color:#283b4a;font-size:13px;line-height:1.7}.enter-btn{margin-top:auto;width:100%;height:46px;border-radius:23px;color:#fff;font-weight:900;font-size:13px;display:flex;align-items:center;justify-content:center;position:relative;box-shadow:0 9px 16px rgba(0,0,0,.17)}.admin .enter-btn{background:linear-gradient(90deg,#9c6411,#c28d32)}.teacher .enter-btn{background:linear-gradient(90deg,#064584,#0a63a9)}.student .enter-btn{background:linear-gradient(90deg,#006d50,#0d8f6b)}.enter-btn b{position:absolute;left:4px;width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:#fff;color:#0c2d49;font-size:19px}
.features{width:min(730px,88%);margin:16px auto 0;display:grid;grid-template-columns:repeat(4,1fr);background:rgba(252,248,243,.78);border:1px solid rgba(255,255,255,.76);backdrop-filter:blur(16px);border-radius:20px;box-shadow:0 13px 28px rgba(6,31,48,.12);overflow:hidden}.feature{padding:13px 9px;text-align:center;border-left:1px solid rgba(12,45,73,.10);font-size:10px;line-height:1.55}.feature:last-child{border-left:0}.feature b{display:block;font-size:25px;margin-bottom:3px}.feature strong{display:block;font-size:11px}
.footer{margin-top:15px;background:linear-gradient(135deg,#082a45,#061e33);color:#fff;border-radius:26px 26px 0 0;padding:12px 17px;display:flex;align-items:center;justify-content:space-between;gap:18px;font-size:11px;border-top:1px solid rgba(223,179,87,.34)}.footer strong{color:#f0c97a}.values{display:flex;gap:14px;flex-wrap:wrap;justify-content:center}.values span{color:#e9edf1}.values b{color:#e6b65e;margin-left:4px}
@media(max-width:900px){.edu-board,.edu-window{opacity:.42}.home-wrap{width:min(96vw,820px)}.topbar{min-height:68px}.brand-copy span{display:none}.hero{padding-top:14px}.hero-logo{width:68px;height:68px}.cards{gap:11px}.portal-card{min-height:276px;padding:17px 12px}.portal-card h2{font-size:19px}.card-visual{width:90px;height:82px;font-size:45px}.footer{flex-direction:column;text-align:center}}
@media(max-width:680px){.edu-board{left:-120px;top:18%;opacity:.22}.edu-window{right:-125px;top:16%;opacity:.25}.edu-people,.edu-study{opacity:.12}.topbar{border-radius:22px;padding:7px}.brand img{width:50px;height:50px}.brand-copy strong{font-size:14px}.hero{padding:14px 8px 10px}.hero h1{font-size:31px;letter-spacing:-.7px}.hero-kicker{font-size:16px}.hero p{font-size:12px}.cards{grid-template-columns:1fr;direction:rtl}.portal-card{min-height:165px;display:grid;grid-template-columns:74px 1fr;grid-template-rows:auto auto 46px;text-align:right;column-gap:12px;align-items:center}.card-visual{grid-row:1/3;width:74px;height:74px;font-size:39px;margin:0}.portal-card h2{margin:0;font-size:18px}.portal-card p{font-size:11px}.enter-btn{grid-column:1/3;margin-top:5px}.features{grid-template-columns:repeat(2,1fr);width:100%}.footer{border-radius:20px 20px 0 0}.values{gap:9px}}
`;

export default function ApprovedHomeClient(){
  return <main id="lahooni-home" dir="rtl">
    <style>{css}</style>
    <div className="education-bg" aria-hidden="true">
      <div className="edu-board" />
      <div className="edu-window" />
      <div className="edu-people" />
      <div className="edu-study" />
      <div className="edu-subjects" />
      <div className="edu-floor" />
      <div className="edu-glow" />
    </div>

    <div className="home-wrap">
      <header className="topbar">
        <div className="brand">
          <img src="/icons/lahooni-identity-320.jpg" alt="شعار منصة أستاذ لحوني التعليمية" />
          <div className="brand-copy"><strong>منصة أستاذ لحوني التعليمية</strong><span>بالعلم نصنع المستقبل</span></div>
        </div>
      </header>

      <section className="hero">
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
          <div className="features" aria-label="مزايا المنصة">
            {features.map(([i,t,s])=><div className="feature" key={t}><b>{i}</b><strong>{t}</strong>{s}</div>)}
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
