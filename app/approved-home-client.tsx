"use client";

import Link from "next/link";

const portals = [
  {
    href: "/admin",
    title: "الإدارة",
    subtitle: "مركز القيادة والمتابعة",
    text: "إدارة المعلمين والطلاب والفصول والتقارير من بوابة واحدة واضحة.",
    icon: "⌘",
    stat: "إدارة ذكية",
  },
  {
    href: "/teacher",
    title: "المعلم",
    subtitle: "مساحة العمل اليومية",
    text: "الحضور والتحصيل والانضباط والملاحظات والاختبارات والتقارير في مسار مترابط.",
    icon: "✦",
    stat: "عمل مترابط",
  },
  {
    href: "/student",
    title: "الطالب وولي الأمر",
    subtitle: "متابعة واضحة ومباشرة",
    text: "رؤية التحصيل والحضور والملاحظات والخطط والتواصل لكل مادة بصورة مستقلة.",
    icon: "◎",
    stat: "متابعة مستمرة",
  },
] as const;

const css = `
#lahooni-home-v2{--navy:#061625;--navy2:#0a2840;--navy3:#0c3954;--gold:#d7b36b;--gold2:#f1d99a;--ink:#eef6f8;min-height:100dvh;position:relative;isolation:isolate;overflow:hidden;color:var(--ink);background:#061625;font-family:inherit}
#lahooni-home-v2 *{box-sizing:border-box}
#lahooni-home-v2:before{content:"";position:absolute;inset:0;z-index:-4;background:linear-gradient(110deg,rgba(3,14,25,.96) 0%,rgba(5,25,42,.91) 43%,rgba(7,42,59,.74) 100%),url('/saudi-classroom.svg') center/cover no-repeat;transform:scale(1.025)}
#lahooni-home-v2:after{content:"";position:absolute;inset:0;z-index:-3;background:radial-gradient(circle at 16% 14%,rgba(229,194,117,.2),transparent 24%),radial-gradient(circle at 85% 58%,rgba(66,176,197,.14),transparent 28%),linear-gradient(rgba(255,255,255,.022) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.018) 1px,transparent 1px);background-size:auto,auto,48px 48px,48px 48px;mask-image:linear-gradient(to bottom,#000 0%,rgba(0,0,0,.7) 70%,transparent 100%)}
.home-orb{position:absolute;border-radius:999px;filter:blur(4px);pointer-events:none;z-index:-2;animation:orbFloat 10s ease-in-out infinite}.home-orb.one{width:310px;height:310px;top:-145px;right:-75px;background:radial-gradient(circle,rgba(240,213,146,.22),rgba(240,213,146,0) 70%)}.home-orb.two{width:420px;height:420px;bottom:-220px;left:-110px;background:radial-gradient(circle,rgba(45,142,168,.22),rgba(45,142,168,0) 70%);animation-delay:-4s}
.home-shell{width:min(1440px,calc(100% - 40px));margin:auto;padding:24px 0 28px;position:relative;z-index:2}
.home-top{height:78px;padding:0 20px;display:flex;align-items:center;justify-content:space-between;gap:20px;border:1px solid rgba(255,255,255,.14);border-radius:24px;background:linear-gradient(115deg,rgba(9,31,49,.72),rgba(7,26,42,.46));backdrop-filter:blur(22px) saturate(1.25);box-shadow:0 18px 55px rgba(0,0,0,.18),inset 0 1px rgba(255,255,255,.08)}
.home-brand{display:flex;align-items:center;gap:13px}.home-mark{width:52px;height:52px;position:relative;display:grid;place-items:center;border-radius:17px;background:linear-gradient(145deg,#f1db9f,#b98e42);color:#082137;font-size:25px;font-weight:950;box-shadow:0 11px 30px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.85);transform:perspective(180px) rotateY(-7deg) rotateX(4deg)}.home-mark:after{content:"";position:absolute;inset:5px;border:1px solid rgba(7,32,51,.2);border-radius:12px}.home-brand strong{display:block;font-size:18px;letter-spacing:-.25px}.home-brand small{display:block;margin-top:4px;color:#9fb7c6;font-size:11px}.home-status{display:flex;align-items:center;gap:10px;padding:10px 13px;border-radius:999px;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.09);font-size:11px;color:#cfe0e7}.home-status i{width:8px;height:8px;border-radius:50%;background:#65d5a1;box-shadow:0 0 0 5px rgba(101,213,161,.1),0 0 18px rgba(101,213,161,.55)}
.home-hero{min-height:500px;margin-top:18px;display:grid;grid-template-columns:minmax(0,1.08fr) minmax(400px,.92fr);gap:18px}
.hero-copy,.hero-visual{border:1px solid rgba(255,255,255,.13);border-radius:34px;box-shadow:0 28px 80px rgba(0,0,0,.27);overflow:hidden;position:relative}
.hero-copy{padding:56px 58px;display:flex;flex-direction:column;justify-content:center;background:linear-gradient(145deg,rgba(7,27,45,.93),rgba(7,47,65,.76));backdrop-filter:blur(18px)}.hero-copy:before{content:"";position:absolute;width:360px;height:360px;border-radius:50%;top:-220px;left:-90px;background:radial-gradient(circle,rgba(230,193,113,.2),transparent 70%)}
.hero-kicker{display:inline-flex;width:max-content;align-items:center;gap:8px;padding:7px 10px;border:1px solid rgba(226,191,113,.25);border-radius:999px;background:rgba(217,180,103,.08);color:#edd291;font-size:11px;font-weight:800}.hero-kicker:before{content:"✦";font-size:10px}
.hero-copy h1{max-width:790px;margin:18px 0 15px;font-size:clamp(43px,5.1vw,75px);line-height:1.12;letter-spacing:-2px;font-weight:950}.hero-copy h1 span{color:#e8c982;text-shadow:0 10px 40px rgba(217,179,107,.18)}.hero-copy p{max-width:720px;margin:0;color:#c4d4dc;font-size:15px;line-height:2}.hero-actions{display:flex;gap:11px;flex-wrap:wrap;margin-top:25px}.hero-actions a{min-height:49px;padding:0 19px;border-radius:15px;display:inline-flex;align-items:center;gap:10px;text-decoration:none;font-size:12px;font-weight:850;transition:transform .22s ease,box-shadow .22s ease,border-color .22s ease}.hero-actions a:hover{transform:translateY(-3px)}.hero-actions .gold{color:#092238;background:linear-gradient(135deg,#f0d89b,#cfa557);box-shadow:0 14px 35px rgba(202,158,80,.22)}.hero-actions .glass{color:#fff;background:rgba(255,255,255,.065);border:1px solid rgba(255,255,255,.14)}
.hero-visual{min-height:500px;background:linear-gradient(160deg,rgba(14,55,73,.68),rgba(4,22,36,.88)),url('/saudi-classroom.svg') center/cover no-repeat;perspective:900px}.hero-visual:before{content:"";position:absolute;inset:0;background:linear-gradient(to top,rgba(3,17,29,.82),transparent 62%)}.visual-grid{position:absolute;inset:0;opacity:.18;background:linear-gradient(rgba(255,255,255,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.08) 1px,transparent 1px);background-size:38px 38px;transform:perspective(500px) rotateX(58deg) scale(1.45);transform-origin:center bottom}.visual-core{position:absolute;left:50%;top:47%;width:180px;height:180px;transform:translate(-50%,-50%) rotateX(58deg) rotateZ(45deg);border-radius:40px;background:linear-gradient(145deg,rgba(241,216,154,.96),rgba(153,113,49,.86));box-shadow:0 38px 70px rgba(0,0,0,.36),inset 0 2px rgba(255,255,255,.7);animation:coreFloat 6s ease-in-out infinite}.visual-core:after{content:"ل";position:absolute;inset:18px;display:grid;place-items:center;border-radius:28px;background:linear-gradient(145deg,#0a334b,#061a2a);color:#ebcf8b;font-size:62px;font-weight:950;transform:translateZ(20px) rotateZ(-45deg);box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}.visual-chip{position:absolute;padding:11px 13px;border-radius:15px;background:rgba(7,25,41,.72);border:1px solid rgba(255,255,255,.13);backdrop-filter:blur(14px);font-size:11px;color:#d5e3e8;box-shadow:0 14px 35px rgba(0,0,0,.2);animation:chipFloat 7s ease-in-out infinite}.visual-chip b{display:block;color:#f0d292;font-size:12px;margin-bottom:3px}.visual-chip.c1{right:25px;top:27%;animation-delay:-1s}.visual-chip.c2{left:24px;top:19%;animation-delay:-3s}.visual-chip.c3{left:31px;bottom:27%;animation-delay:-5s}.visual-caption{position:absolute;z-index:3;right:22px;left:22px;bottom:20px;padding:17px 18px;display:flex;align-items:center;justify-content:space-between;gap:14px;border-radius:20px;background:linear-gradient(120deg,rgba(255,255,255,.13),rgba(255,255,255,.075));border:1px solid rgba(255,255,255,.17);backdrop-filter:blur(22px)}.visual-caption strong{display:block;font-size:14px}.visual-caption small{display:block;color:#a9bfca;margin-top:4px;font-size:10px}.visual-caption span{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;background:rgba(232,202,132,.13);color:#efd697;border:1px solid rgba(232,202,132,.2)}
.portal-head{display:flex;align-items:end;justify-content:space-between;gap:20px;margin:28px 4px 13px}.portal-head h2{margin:0;font-size:23px}.portal-head p{margin:5px 0 0;color:#96aebb;font-size:11px}.portal-head span{font-size:10px;color:#8ea8b7}
.portal-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.portal-card{min-height:245px;padding:23px;border-radius:28px;text-decoration:none;color:#f7fbfc;position:relative;overflow:hidden;border:1px solid rgba(255,255,255,.13);background:linear-gradient(145deg,rgba(255,255,255,.115),rgba(255,255,255,.055));backdrop-filter:blur(19px);box-shadow:0 20px 55px rgba(0,0,0,.2),inset 0 1px rgba(255,255,255,.075);transition:transform .25s ease,border-color .25s ease,box-shadow .25s ease}.portal-card:before{content:"";position:absolute;width:170px;height:170px;border-radius:50%;left:-80px;top:-80px;background:radial-gradient(circle,rgba(225,190,112,.13),transparent 70%)}.portal-card:hover{transform:translateY(-7px);border-color:rgba(231,199,127,.38);box-shadow:0 30px 70px rgba(0,0,0,.29)}.portal-card-top{display:flex;align-items:start;justify-content:space-between;gap:16px}.portal-icon{width:55px;height:55px;border-radius:18px;display:grid;place-items:center;background:linear-gradient(145deg,#e5c77e,#a67a35);color:#071f32;font-size:25px;font-weight:900;box-shadow:0 13px 30px rgba(0,0,0,.23),inset 0 1px rgba(255,255,255,.7);transform:perspective(180px) rotateY(-8deg) rotateX(5deg)}.portal-stat{font-size:9px;padding:7px 9px;border-radius:999px;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.08);color:#9fb5c2}.portal-card h3{margin:20px 0 3px;font-size:22px}.portal-card .sub{display:block;color:#dfc078;font-size:10px;font-weight:700}.portal-card p{margin:9px 0 0;max-width:92%;color:#aebfc8;line-height:1.75;font-size:11px}.portal-open{position:absolute;right:23px;left:23px;bottom:18px;padding-top:12px;border-top:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:space-between;color:#dce7eb;font-size:10px;font-weight:800}.portal-open b{width:32px;height:32px;border-radius:11px;display:grid;place-items:center;background:rgba(255,255,255,.075);font-size:15px;transition:transform .22s ease}.portal-card:hover .portal-open b{transform:translateX(-4px)}
.home-footer{text-align:center;padding:23px 0 2px;color:#7f9aaa;font-size:10px}
@keyframes coreFloat{0%,100%{transform:translate(-50%,-50%) rotateX(58deg) rotateZ(45deg) translateY(0)}50%{transform:translate(-50%,-50%) rotateX(58deg) rotateZ(45deg) translateY(-12px)}}@keyframes chipFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}@keyframes orbFloat{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(16px,14px,0)}}
@media(max-width:1000px){.home-hero{grid-template-columns:1fr}.hero-visual{min-height:390px}.portal-grid{grid-template-columns:1fr}.portal-card{min-height:215px}.hero-copy{padding:48px 42px}}
@media(max-width:640px){.home-shell{width:min(100% - 18px,1440px);padding:9px 0 18px}.home-top{height:68px;padding:0 13px;border-radius:18px}.home-mark{width:45px;height:45px;border-radius:14px}.home-brand strong{font-size:14px}.home-brand small{font-size:9px}.home-status{display:none}.home-hero{margin-top:9px;gap:9px}.hero-copy,.hero-visual{border-radius:23px}.hero-copy{min-height:455px;padding:34px 24px}.hero-copy h1{font-size:42px;letter-spacing:-1.3px}.hero-copy p{font-size:13px}.hero-actions a{width:100%}.hero-visual{min-height:350px}.visual-core{width:140px;height:140px}.visual-core:after{font-size:48px}.visual-chip{font-size:9px}.visual-chip.c2{left:12px;top:16%}.visual-chip.c1{right:12px;top:23%}.visual-chip.c3{left:13px;bottom:28%}.portal-head{align-items:start;flex-direction:column;gap:6px;margin-top:22px}.portal-card{border-radius:22px}.portal-card p{max-width:100%}}
@media(prefers-reduced-motion:reduce){.home-orb,.visual-core,.visual-chip{animation:none}.portal-card,.hero-actions a,.portal-open b{transition:none}}
`;

export default function ApprovedHomeClient() {
  return (
    <main id="lahooni-home-v2" dir="rtl">
      <style>{css}</style>
      <span className="home-orb one" />
      <span className="home-orb two" />
      <div className="home-shell">
        <header className="home-top">
          <div className="home-brand">
            <div className="home-mark" aria-hidden="true">ل</div>
            <div><strong>بوابة أستاذ لحوني التعليمية</strong><small>بيئة تعليمية ذكية ومترابطة</small></div>
          </div>
          <div className="home-status"><i /> النظام جاهز للعمل</div>
        </header>

        <section className="home-hero">
          <div className="hero-copy">
            <span className="hero-kicker">منصة تعليمية موحّدة</span>
            <h1>كل رحلة تعليمية تبدأ من <span>بوابة أوضح.</span></h1>
            <p>مساحة ذكية تجمع الإدارة والمعلم والطالب وولي الأمر، وتحافظ على ترابط التحصيل والحضور والانضباط والملاحظات والتقارير دون تغيير طريقة عمل النظام.</p>
            <div className="hero-actions">
              <Link className="gold" href="/teacher"><span>دخول بوابة المعلم</span><b>←</b></Link>
              <Link className="glass" href="/student"><span>الطالب وولي الأمر</span><b>←</b></Link>
            </div>
          </div>

          <div className="hero-visual" aria-label="مشهد تعليمي رقمي ثلاثي الأبعاد">
            <div className="visual-grid" />
            <div className="visual-core" />
            <div className="visual-chip c1"><b>التحصيل</b>متابعة مترابطة</div>
            <div className="visual-chip c2"><b>الحضور</b>رؤية يومية واضحة</div>
            <div className="visual-chip c3"><b>التقارير</b>قراءة أسرع للأداء</div>
            <div className="visual-caption"><div><strong>منظومة واحدة · ثلاث بوابات</strong><small>اختيار البوابة المناسبة دون تشتيت أو تداخل</small></div><span>✦</span></div>
          </div>
        </section>

        <div className="portal-head">
          <div><h2>اختر بوابتك</h2><p>كل بوابة مستقلة في مهامها ومتصلة بالنظام نفسه.</p></div>
          <span>الإدارة · المعلم · الطالب وولي الأمر</span>
        </div>

        <section className="portal-grid">
          {portals.map((portal) => (
            <Link key={portal.href} href={portal.href} className="portal-card">
              <div className="portal-card-top"><div className="portal-icon">{portal.icon}</div><span className="portal-stat">{portal.stat}</span></div>
              <h3>{portal.title}</h3>
              <span className="sub">{portal.subtitle}</span>
              <p>{portal.text}</p>
              <div className="portal-open"><span>فتح البوابة</span><b>←</b></div>
            </Link>
          ))}
        </section>
        <footer className="home-footer">بوابة أستاذ لحوني التعليمية</footer>
      </div>
    </main>
  );
}
