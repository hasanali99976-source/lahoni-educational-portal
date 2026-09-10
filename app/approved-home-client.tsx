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
#lahooni-home{min-height:100dvh;direction:rtl;position:relative;overflow:hidden;color:#0b2d4b;background:#ebe3d7;font-family:inherit}
#lahooni-home *{box-sizing:border-box}
.school-scene{position:absolute;inset:0;overflow:hidden;pointer-events:none;background:linear-gradient(180deg,#dce9ef 0 11%,#f4eee5 11% 74%,#9c714d 74% 100%)}
.school-scene:after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 50% 30%,rgba(255,255,255,.88),rgba(255,255,255,.18) 33%,transparent 58%),linear-gradient(90deg,rgba(5,35,55,.18),transparent 18%,transparent 82%,rgba(5,35,55,.18));z-index:8}
.wall-line{position:absolute;left:0;right:0;top:10.8%;height:8px;background:#d2a957;box-shadow:0 4px 10px rgba(85,57,28,.18)}
.window{position:absolute;right:3.5%;top:15%;width:250px;height:300px;border:12px solid #f5f1eb;border-radius:10px;background:linear-gradient(180deg,#b9dce9,#dceef4 58%,#a6c58d 59%,#7d9d67);box-shadow:0 16px 35px rgba(42,57,67,.18)}
.window:before{content:"";position:absolute;left:50%;top:0;bottom:0;width:9px;background:#f5f1eb;transform:translateX(-50%)}
.window:after{content:"";position:absolute;left:0;right:0;top:50%;height:9px;background:#f5f1eb;transform:translateY(-50%)}
.board{position:absolute;left:3.5%;top:16%;width:270px;height:250px;border:12px solid #a77a48;border-radius:10px;background:linear-gradient(145deg,#183f3b,#0f312f);box-shadow:0 20px 42px rgba(32,48,46,.28),inset 0 0 0 2px rgba(255,255,255,.08)}
.board:before{content:"العلم  •  المعرفة  •  الإبداع\A\A  أ + ب = نجاح\A  ١٤٤٨ هـ";white-space:pre;position:absolute;inset:35px 24px;color:#f5f0dd;font-size:20px;line-height:1.9;text-align:center;font-weight:700;transform:rotate(-1deg)}
.board:after{content:"";position:absolute;left:38px;right:38px;bottom:28px;height:3px;background:#dfbd74;border-radius:4px;transform:rotate(3deg)}
.school-sign{position:absolute;left:50%;top:14.2%;transform:translateX(-50%);padding:8px 24px;border-radius:8px;background:#f6f0e8;border:2px solid #d4b066;color:#173a52;font-weight:900;font-size:14px;box-shadow:0 8px 20px rgba(54,43,28,.12)}
.poster{position:absolute;right:29%;top:16.5%;width:120px;height:155px;border:8px solid #e0c391;background:#fbfaf7;border-radius:8px;box-shadow:0 12px 24px rgba(58,45,29,.12)}
.poster:before{content:"اقرأ\A فكّر\A أبدع";white-space:pre;position:absolute;inset:22px 10px;text-align:center;color:#0c5b75;font-size:18px;line-height:1.8;font-weight:900}
.shelf{position:absolute;left:2.8%;bottom:12%;width:280px;height:150px;border-radius:8px 8px 0 0;background:linear-gradient(180deg,#9f6840,#794a2d);box-shadow:0 18px 35px rgba(62,38,24,.25)}
.shelf:before{content:"📚  📘  📗  📕";position:absolute;left:18px;right:18px;top:-42px;font-size:42px;letter-spacing:5px;filter:drop-shadow(0 5px 6px rgba(0,0,0,.16))}
.shelf:after{content:"🌍";position:absolute;right:24px;top:-105px;font-size:74px;filter:drop-shadow(0 8px 8px rgba(0,0,0,.2))}
.desk{position:absolute;right:2.4%;bottom:8%;width:300px;height:112px;border-radius:10px;background:linear-gradient(180deg,#a86e42,#7f4f30);box-shadow:0 18px 38px rgba(59,38,26,.28)}
.desk:before{content:"💻";position:absolute;right:72px;top:-98px;font-size:98px;filter:drop-shadow(0 10px 10px rgba(0,0,0,.22))}
.desk:after{content:"✏️  📒";position:absolute;left:18px;top:-55px;font-size:44px;transform:rotate(-4deg)}
.book-stack{position:absolute;left:50%;bottom:8%;transform:translateX(-50%);font-size:54px;letter-spacing:-6px;filter:drop-shadow(0 9px 8px rgba(0,0,0,.18));opacity:.72}
.classroom-floor{position:absolute;left:-7%;right:-7%;bottom:-6%;height:32%;background:repeating-linear-gradient(90deg,rgba(255,255,255,.06) 0 2px,transparent 2px 115px),linear-gradient(180deg,#a97952,#7c5438);transform:perspective(520px) rotateX(64deg);transform-origin:bottom;box-shadow:inset 0 30px 50px rgba(255,255,255,.12)}
.home-wrap{position:relative;z-index:10;width:min(1080px,92vw);margin:0 auto;padding:14px 0 0;min-height:100dvh;display:flex;flex-direction:column}
.topbar{min-height:70px;border-radius:34px;background:linear-gradient(135deg,#082a45,#061d31);display:flex;align-items:center;justify-content:center;padding:6px 16px;box-shadow:0 14px 34px rgba(4,24,40,.24);border:1px solid rgba(225,181,89,.34)}
.brand{display:flex;align-items:center;gap:12px;color:#fff}.brand img{width:56px;height:56px;border-radius:50%;object-fit:cover;border:2px solid #d9ad56;box-shadow:0 6px 16px rgba(0,0,0,.24)}.brand-copy strong{display:block;font-size:16px}.brand-copy span{display:block;font-size:11px;opacity:.86;margin-top:2px}
.hero{text-align:center;padding:15px 18px 11px}.hero-logo{width:70px;height:70px;border-radius:50%;object-fit:cover;border:3px solid #d8aa51;box-shadow:0 10px 25px rgba(4,32,52,.24);margin-bottom:5px}.hero-kicker{font-size:17px;color:#123b58;font-weight:900}.hero h1{margin:1px 0 0;font-size:clamp(31px,4vw,49px);line-height:1.08;font-weight:950;color:#bd8127;text-shadow:0 2px 7px rgba(255,255,255,.95);letter-spacing:-1px}.hero p{margin:7px 0 0;font-size:14px;color:#203c50;font-weight:700}.gold-rule{width:90px;height:3px;border-radius:10px;margin:10px auto 0;background:linear-gradient(90deg,transparent,#d8a542,transparent)}
.main-row{display:grid;grid-template-columns:1fr;align-items:center;flex:1}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:15px;direction:ltr}.portal-card{direction:rtl;min-height:282px;padding:18px 15px 15px;border-radius:23px;text-decoration:none;color:#0c2741;display:flex;flex-direction:column;align-items:center;text-align:center;border:1px solid rgba(255,255,255,.78);backdrop-filter:blur(14px);box-shadow:0 16px 30px rgba(8,34,52,.18),inset 0 1px rgba(255,255,255,.94);transition:transform .24s ease,box-shadow .24s ease}.portal-card:hover{transform:translateY(-6px);box-shadow:0 24px 40px rgba(8,34,52,.25)}.portal-card.admin{background:linear-gradient(150deg,rgba(255,247,229,.94),rgba(239,214,168,.91))}.portal-card.teacher{background:linear-gradient(150deg,rgba(228,246,255,.94),rgba(181,218,248,.91))}.portal-card.student{background:linear-gradient(150deg,rgba(225,255,247,.94),rgba(171,231,213,.91))}
.card-visual{width:98px;height:84px;border-radius:21px;display:grid;place-items:center;font-size:48px;margin:0 0 8px;filter:drop-shadow(0 8px 9px rgba(0,0,0,.11));background:rgba(255,255,255,.18)}.admin .card-visual{color:#9a6c17}.teacher .card-visual{color:#0a5394}.student .card-visual{color:#087458}.portal-card h2{margin:2px 0 5px;font-size:20px;font-weight:950}.portal-card p{margin:0;color:#283b4a;font-size:12px;line-height:1.65}.enter-btn{margin-top:auto;width:100%;height:43px;border-radius:22px;color:#fff;font-weight:900;font-size:12px;display:flex;align-items:center;justify-content:center;position:relative;box-shadow:0 8px 15px rgba(0,0,0,.16)}.admin .enter-btn{background:linear-gradient(90deg,#9c6411,#c28d32)}.teacher .enter-btn{background:linear-gradient(90deg,#064584,#0a63a9)}.student .enter-btn{background:linear-gradient(90deg,#006d50,#0d8f6b)}.enter-btn b{position:absolute;left:4px;width:35px;height:35px;border-radius:50%;display:grid;place-items:center;background:#fff;color:#0c2d49;font-size:18px}
.features{width:min(700px,86%);margin:14px auto 0;display:grid;grid-template-columns:repeat(4,1fr);background:rgba(252,248,243,.82);border:1px solid rgba(255,255,255,.8);backdrop-filter:blur(15px);border-radius:19px;box-shadow:0 12px 26px rgba(6,31,48,.11);overflow:hidden}.feature{padding:11px 8px;text-align:center;border-left:1px solid rgba(12,45,73,.10);font-size:9px;line-height:1.5}.feature:last-child{border-left:0}.feature b{display:block;font-size:22px;margin-bottom:2px}.feature strong{display:block;font-size:10px}
.footer{margin-top:13px;background:linear-gradient(135deg,#082a45,#061e33);color:#fff;border-radius:24px 24px 0 0;padding:11px 16px;display:flex;align-items:center;justify-content:space-between;gap:16px;font-size:10px;border-top:1px solid rgba(223,179,87,.34)}.footer strong{color:#f0c97a}.values{display:flex;gap:12px;flex-wrap:wrap;justify-content:center}.values span{color:#e9edf1}.values b{color:#e6b65e;margin-left:4px}
@media(max-width:900px){.board,.window{opacity:.55}.poster{display:none}.home-wrap{width:min(95vw,800px)}.hero-logo{width:62px;height:62px}.cards{gap:10px}.portal-card{min-height:255px;padding:15px 11px}.portal-card h2{font-size:18px}.card-visual{width:82px;height:74px;font-size:41px}.footer{flex-direction:column;text-align:center}}
@media(max-width:680px){.school-sign{display:none}.board{left:-155px;top:20%;opacity:.28}.window{right:-150px;top:18%;opacity:.3}.shelf,.desk,.book-stack{opacity:.15}.topbar{border-radius:21px;padding:6px}.brand img{width:48px;height:48px}.brand-copy strong{font-size:13px}.brand-copy span{display:none}.hero{padding:12px 7px 9px}.hero h1{font-size:29px}.hero-kicker{font-size:15px}.hero p{font-size:11px}.cards{grid-template-columns:1fr;direction:rtl}.portal-card{min-height:155px;display:grid;grid-template-columns:68px 1fr;grid-template-rows:auto auto 43px;text-align:right;column-gap:10px;align-items:center}.card-visual{grid-row:1/3;width:68px;height:68px;font-size:35px;margin:0}.portal-card h2{margin:0;font-size:17px}.portal-card p{font-size:10px}.enter-btn{grid-column:1/3;margin-top:5px}.features{grid-template-columns:repeat(2,1fr);width:100%}.footer{border-radius:18px 18px 0 0}.values{gap:8px}}
`;

export default function ApprovedHomeClient(){
  return <main id="lahooni-home" dir="rtl">
    <style>{css}</style>
    <div className="school-scene" aria-hidden="true">
      <div className="wall-line" />
      <div className="window" />
      <div className="board" />
      <div className="school-sign">بيئة مدرسية تعليمية</div>
      <div className="poster" />
      <div className="shelf" />
      <div className="desk" />
      <div className="book-stack">📚 📖 📘</div>
      <div className="classroom-floor" />
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
