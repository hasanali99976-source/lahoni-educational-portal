"use client";

import Link from "next/link";

const portals = [
  {
    href: "/admin",
    cls: "admin",
    icon: "⚙",
    title: "بوابة الإدارة",
    text: "إدارة شاملة لبيئة تعليمية فعّالة",
    action: "دخول الإدارة",
  },
  {
    href: "/teacher",
    cls: "teacher",
    icon: "✎",
    title: "بوابة المعلم",
    text: "معًا نصنع الفرق في تعليم أبنائنا",
    action: "دخول المعلم",
  },
  {
    href: "/student",
    cls: "student",
    icon: "🎓",
    title: "بوابة الطالب / ولي الأمر",
    text: "شراكة حقيقية لرحلة نجاح متميزة",
    action: "دخول الطالب / ولي الأمر",
  },
] as const;

const features = [
  ["▥", "متابعة مستمرة", "لنمو الطالب"],
  ["◎", "أدوات ذكية", "لتحقيق الأهداف"],
  ["♟", "تواصل فعّال", "بين جميع الأطراف"],
  ["◇", "بيئة آمنة", "وخصوصية عالية"],
] as const;

const classroomPhoto =
  "https://images.unsplash.com/photo-1761532276195-5d975abae829?auto=format&fit=crop&fm=jpg&q=88&w=2400";

const css = `
#lahooni-home{min-height:100dvh;direction:rtl;position:relative;overflow-x:hidden;color:#0a2943;background:#061d31;font-family:inherit}
#lahooni-home *{box-sizing:border-box}
.real-bg{position:fixed;inset:0;z-index:0;background-image:linear-gradient(90deg,rgba(3,21,36,.74) 0%,rgba(3,21,36,.32) 18%,rgba(255,255,255,.06) 49%,rgba(3,21,36,.30) 82%,rgba(3,21,36,.72) 100%),linear-gradient(180deg,rgba(4,24,40,.26),rgba(4,24,40,.08) 42%,rgba(4,24,40,.44)),url('${classroomPhoto}');background-size:cover;background-position:center;filter:saturate(1.05) contrast(1.08) brightness(.92)}
.real-bg:after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 50% 30%,rgba(255,255,255,.20),transparent 34%),linear-gradient(180deg,transparent 0 72%,rgba(4,24,40,.32));}
.school-frame{position:fixed;inset:14px;z-index:1;border:1px solid rgba(230,188,98,.28);border-radius:32px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.08),0 30px 70px rgba(2,13,23,.30);pointer-events:none}
.school-frame:before,.school-frame:after{content:"";position:absolute;top:50%;width:3px;height:160px;transform:translateY(-50%);border-radius:10px;background:linear-gradient(180deg,transparent,#d7aa53,transparent);opacity:.8}.school-frame:before{left:-1px}.school-frame:after{right:-1px}
.home-shell{position:relative;z-index:2;width:min(1180px,94vw);margin:0 auto;padding:18px 0 0;min-height:100dvh;display:flex;flex-direction:column}
.topbar{display:flex;align-items:center;justify-content:space-between;gap:20px;min-height:76px;padding:8px 12px 8px 18px;border-radius:28px;background:linear-gradient(135deg,rgba(5,35,58,.90),rgba(4,25,43,.84));border:1px solid rgba(222,180,89,.34);backdrop-filter:blur(18px) saturate(1.12);box-shadow:0 18px 42px rgba(2,18,32,.34),inset 0 1px rgba(255,255,255,.11)}
.brand{display:flex;align-items:center;gap:12px;min-width:0;color:#fff}.brand img{width:58px;height:58px;border-radius:50%;object-fit:cover;border:2px solid #d9ad56;box-shadow:0 8px 22px rgba(0,0,0,.32)}.brand strong{display:block;font-size:16px;font-weight:900;letter-spacing:-.2px}.brand span{display:block;margin-top:3px;font-size:11px;color:#d8e3ea}
.top-note{display:flex;align-items:center;gap:8px;padding:9px 14px;border-radius:18px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.09);color:#f2d493;font-size:11px;font-weight:800;white-space:nowrap}
.hero{text-align:center;padding:30px 12px 18px}.hero-logo{width:88px;height:88px;border-radius:50%;object-fit:cover;border:3px solid #d9ad56;box-shadow:0 14px 34px rgba(0,0,0,.30),0 0 0 7px rgba(255,255,255,.08)}.hero-kicker{margin-top:12px;color:#f1f5f7;font-size:17px;font-weight:800;text-shadow:0 3px 12px rgba(0,0,0,.42)}.hero h1{margin:5px 0 0;font-size:clamp(36px,4.6vw,58px);line-height:1.08;font-weight:950;letter-spacing:-1.3px;color:#efc66f;text-shadow:0 7px 22px rgba(0,0,0,.42)}.hero p{margin:10px 0 0;color:#f8fafb;font-size:15px;font-weight:700;text-shadow:0 3px 12px rgba(0,0,0,.4)}.hero-rule{width:120px;height:3px;margin:14px auto 0;border-radius:10px;background:linear-gradient(90deg,transparent,#e4b458,transparent)}
.portal-stage{position:relative;padding:8px 0 0;flex:1}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;direction:ltr;align-items:stretch}.portal-card{position:relative;overflow:hidden;direction:rtl;min-height:320px;padding:22px 18px 18px;border-radius:28px;text-decoration:none;color:#0b2a43;display:flex;flex-direction:column;align-items:center;text-align:center;border:1px solid rgba(255,255,255,.70);backdrop-filter:blur(22px) saturate(1.12);box-shadow:0 24px 45px rgba(3,23,39,.26),inset 0 1px 0 rgba(255,255,255,.80),inset 0 -20px 40px rgba(255,255,255,.08);transform-style:preserve-3d;transition:transform .25s ease,box-shadow .25s ease}.portal-card:before{content:"";position:absolute;inset:-35% auto auto -10%;width:70%;height:55%;transform:rotate(-20deg);background:linear-gradient(90deg,rgba(255,255,255,.00),rgba(255,255,255,.34),rgba(255,255,255,.00));opacity:.48;pointer-events:none}.portal-card:hover{transform:translateY(-8px) perspective(900px) rotateX(1.5deg);box-shadow:0 32px 54px rgba(3,23,39,.34),inset 0 1px 0 rgba(255,255,255,.85)}.portal-card.admin{background:linear-gradient(150deg,rgba(255,247,231,.91),rgba(229,199,145,.80))}.portal-card.teacher{background:linear-gradient(150deg,rgba(224,244,255,.90),rgba(151,201,239,.78))}.portal-card.student{background:linear-gradient(150deg,rgba(222,255,246,.90),rgba(139,218,192,.78))}
.card-icon{width:112px;height:96px;margin-bottom:11px;display:grid;place-items:center;border-radius:24px;font-size:54px;background:linear-gradient(145deg,rgba(255,255,255,.55),rgba(255,255,255,.14));border:1px solid rgba(255,255,255,.48);box-shadow:0 16px 26px rgba(6,29,46,.15),inset 0 1px rgba(255,255,255,.8);transform:translateZ(24px)}.admin .card-icon{color:#9a6c17}.teacher .card-icon{color:#0a5394}.student .card-icon{color:#087458}.portal-card h2{margin:2px 0 7px;font-size:24px;font-weight:950;letter-spacing:-.4px}.portal-card p{margin:0;max-width:250px;color:#2d4354;font-size:12px;line-height:1.8;font-weight:700}.enter-btn{margin-top:auto;width:100%;height:48px;border-radius:24px;color:#fff;font-weight:900;font-size:13px;display:flex;align-items:center;justify-content:center;position:relative;box-shadow:0 11px 22px rgba(0,0,0,.18)}.admin .enter-btn{background:linear-gradient(90deg,#8d5910,#c58f35)}.teacher .enter-btn{background:linear-gradient(90deg,#07457d,#0a67ad)}.student .enter-btn{background:linear-gradient(90deg,#006a4d,#0e8d69)}.enter-btn b{position:absolute;left:5px;width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:#fff;color:#0b2a43;font-size:19px;box-shadow:0 5px 12px rgba(0,0,0,.13)}
.features{width:min(800px,92%);margin:18px auto 0;display:grid;grid-template-columns:repeat(4,1fr);overflow:hidden;border-radius:22px;background:rgba(255,255,255,.64);border:1px solid rgba(255,255,255,.58);backdrop-filter:blur(22px) saturate(1.12);box-shadow:0 16px 34px rgba(3,23,39,.18),inset 0 1px rgba(255,255,255,.72)}.feature{padding:13px 10px;text-align:center;border-left:1px solid rgba(12,45,73,.10);font-size:10px;line-height:1.55}.feature:last-child{border-left:0}.feature b{display:block;font-size:24px;margin-bottom:3px}.feature strong{display:block;font-size:11px;color:#0b2a43}
.footer{margin-top:18px;min-height:64px;padding:11px 18px;border-radius:24px 24px 0 0;background:linear-gradient(135deg,rgba(5,35,58,.92),rgba(4,25,43,.90));border-top:1px solid rgba(224,182,95,.32);backdrop-filter:blur(18px);box-shadow:0 -10px 28px rgba(2,18,32,.18);display:flex;align-items:center;justify-content:space-between;gap:16px;color:#edf3f6;font-size:10px}.footer strong{display:block;color:#f0c97a;font-size:11px;margin-bottom:2px}.values{display:flex;gap:14px;flex-wrap:wrap;justify-content:center}.values span{white-space:nowrap}.values b{color:#e8b95f;margin-left:4px}
@media(max-width:900px){.home-shell{width:min(96vw,820px)}.top-note{display:none}.hero{padding-top:24px}.hero-logo{width:78px;height:78px}.cards{gap:11px}.portal-card{min-height:292px;padding:18px 13px}.portal-card h2{font-size:20px}.card-icon{width:94px;height:84px;font-size:46px}.footer{flex-direction:column;text-align:center}}
@media(max-width:680px){.school-frame{inset:8px;border-radius:22px}.home-shell{padding-top:8px}.topbar{min-height:62px;border-radius:22px;padding:6px 10px}.brand img{width:48px;height:48px}.brand strong{font-size:13px}.brand span{display:none}.hero{padding:18px 7px 11px}.hero-logo{width:66px;height:66px}.hero-kicker{font-size:14px}.hero h1{font-size:30px;letter-spacing:-.7px}.hero p{font-size:11px}.cards{grid-template-columns:1fr;direction:rtl}.portal-card{min-height:165px;display:grid;grid-template-columns:72px 1fr;grid-template-rows:auto auto 44px;text-align:right;column-gap:11px;align-items:center;border-radius:22px}.card-icon{grid-row:1/3;width:72px;height:72px;font-size:36px;margin:0}.portal-card h2{margin:0;font-size:18px}.portal-card p{font-size:10px;line-height:1.6}.enter-btn{grid-column:1/3;margin-top:5px;height:44px}.features{grid-template-columns:repeat(2,1fr);width:100%}.footer{border-radius:18px 18px 0 0}.values{gap:8px}}
`;

export default function ApprovedHomeClient() {
  return (
    <main id="lahooni-home" dir="rtl">
      <style>{css}</style>
      <div className="real-bg" aria-hidden="true" />
      <div className="school-frame" aria-hidden="true" />

      <div className="home-shell">
        <header className="topbar">
          <div className="brand">
            <img src="/icons/lahooni-identity-320.jpg" alt="شعار منصة أستاذ لحوني التعليمية" />
            <div>
              <strong>منصة أستاذ لحوني التعليمية</strong>
              <span>بالعلم نصنع المستقبل</span>
            </div>
          </div>
          <div className="top-note">بيئة مدرسية رقمية حديثة</div>
        </header>

        <section className="hero">
          <img className="hero-logo" src="/icons/lahooni-identity-320.jpg" alt="شعار البوابة" />
          <div className="hero-kicker">مرحبًا بكم في</div>
          <h1>منصة أستاذ لحوني التعليمية</h1>
          <p>بيئة رقمية لمتابعة الطلاب وتحقيق التميز الدراسي</p>
          <div className="hero-rule" />
        </section>

        <section className="portal-stage" aria-label="بوابات الدخول">
          <div className="cards">
            {portals.map((p) => (
              <Link key={p.href} href={p.href} className={`portal-card ${p.cls}`}>
                <div className="card-icon" aria-hidden="true">{p.icon}</div>
                <h2>{p.title}</h2>
                <p>{p.text}</p>
                <div className="enter-btn">{p.action}<b>←</b></div>
              </Link>
            ))}
          </div>

          <div className="features" aria-label="مزايا المنصة">
            {features.map(([icon, title, sub]) => (
              <div className="feature" key={title}>
                <b>{icon}</b>
                <strong>{title}</strong>
                {sub}
              </div>
            ))}
          </div>
        </section>

        <footer className="footer">
          <div>
            <strong>منصة أستاذ لحوني التعليمية</strong>
            تصميم وتنفيذ: أ. حسن علي الطويل
          </div>
          <div className="values">
            <span><b>♟</b>شراكة مجتمعية</span>
            <span><b>▥</b>مخرجات متميزة</span>
            <span><b>✦</b>تعليم مؤثر</span>
            <span><b>🎓</b>قيم أصيلة</span>
          </div>
        </footer>
      </div>
    </main>
  );
}
