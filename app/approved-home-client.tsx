"use client";

import Link from "next/link";

const portals = [
  { href: "/admin", cls: "admin", icon: "◆", title: "بوابة الإدارة", text: "إدارة المنصة والتقارير والمتابعة الشاملة", action: "دخول الإدارة" },
  { href: "/teacher", cls: "teacher", icon: "✦", title: "بوابة المعلم", text: "التحصيل والحضور والخطط ومتابعة الطلاب", action: "دخول المعلم" },
  { href: "/student", cls: "student", icon: "◈", title: "بوابة الطالب / ولي الأمر", text: "التحصيل والملاحظات والحضور والتقدم الدراسي", action: "دخول الطالب / ولي الأمر" },
] as const;

const classroomPhoto = "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&fm=jpg&q=94&w=2600";

const css = `
#lahooni-home{min-height:100dvh;direction:rtl;position:relative;overflow-x:hidden;background:#071b29;color:#fff;font-family:"IBM Plex Sans Arabic","DIN Next Arabic","Tajawal","Segoe UI",Arial,sans-serif}
#lahooni-home *{box-sizing:border-box}#lahooni-home a{font-family:inherit}
.scene-bg{position:fixed;inset:0;background:url('${classroomPhoto}') center/cover no-repeat;filter:saturate(1.12) contrast(1.06) brightness(.98);transform:scale(1.018)}
.scene-bg:before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(3,18,29,.30),rgba(4,26,39,.10) 34%,rgba(3,20,31,.18) 68%,rgba(3,16,27,.54)),radial-gradient(circle at 50% 22%,rgba(255,221,151,.27),transparent 37%)}
.scene-bg:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(3,26,41,.38),transparent 20%,transparent 80%,rgba(3,26,41,.30))}
.stage{position:relative;z-index:2;width:min(1480px,97vw);min-height:100dvh;margin:auto;padding:12px 0 14px;display:grid;grid-template-rows:auto auto 1fr auto;align-items:center;perspective:1900px}
.stage:before{content:"";position:absolute;inset:7px;border-radius:38px;border:1px solid rgba(255,255,255,.10);background:linear-gradient(145deg,rgba(5,31,47,.18),rgba(5,28,42,.08));box-shadow:0 40px 90px rgba(0,0,0,.28),inset 0 1px rgba(255,255,255,.08);backdrop-filter:blur(1.5px);pointer-events:none}
.topline{position:relative;z-index:5;margin:0 16px;padding:11px 14px;border-radius:27px;display:flex;align-items:center;justify-content:space-between;gap:16px;background:linear-gradient(135deg,rgba(3,25,41,.82),rgba(5,48,61,.64));border:1px solid rgba(255,255,255,.13);box-shadow:0 16px 38px rgba(0,0,0,.22),inset 0 1px rgba(255,255,255,.12);backdrop-filter:blur(16px)}
.brand{display:flex;align-items:center;gap:12px}.brand img{width:54px;height:54px;border-radius:18px;object-fit:cover;border:2px solid #edc56f;box-shadow:0 0 0 4px rgba(237,197,111,.08),0 12px 26px rgba(0,0,0,.26)}.brand strong{display:block;font-size:16px;font-weight:800;letter-spacing:-.25px}.brand span{display:block;margin-top:2px;font-size:9px;color:#d2e0e4;font-weight:500}
.scene-tabs{display:flex;align-items:center;gap:8px;padding:5px;border-radius:22px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.08);box-shadow:inset 0 1px rgba(255,255,255,.06)}
.scene-tab{position:relative;overflow:hidden;text-decoration:none;padding:10px 15px;border-radius:17px;color:#dce8ec;font-size:10px;font-weight:700;letter-spacing:-.1px;border:1px solid transparent;transition:.3s cubic-bezier(.2,.8,.2,1);transform-style:preserve-3d}.scene-tab:before{content:"";position:absolute;inset:-1px auto -1px -70%;width:52%;background:linear-gradient(110deg,transparent,rgba(255,255,255,.45),transparent);transform:skewX(-16deg);transition:.45s}.scene-tab:hover{transform:translateY(-3px) translateZ(18px);color:#fff;background:rgba(255,255,255,.09);border-color:rgba(255,255,255,.14);box-shadow:0 12px 24px rgba(0,0,0,.18)}.scene-tab:hover:before{left:125%}.scene-tab.active{background:linear-gradient(145deg,#f5d584,#c98e33);color:#112f3f;box-shadow:0 10px 25px rgba(202,143,49,.30),inset 0 1px rgba(255,255,255,.65)}.scene-tab.active:after{content:"";position:absolute;left:18%;right:18%;bottom:4px;height:2px;border-radius:999px;background:rgba(16,47,64,.45);animation:pulseLine 2s ease-in-out infinite}@keyframes pulseLine{50%{opacity:.35;transform:scaleX(.7)}}
.hero{position:relative;z-index:4;text-align:center;padding:23px 18px 13px}.hero .kicker{display:inline-flex;align-items:center;gap:7px;padding:7px 13px;border-radius:999px;background:rgba(4,31,47,.42);border:1px solid rgba(240,202,111,.26);color:#f0d48e;font-size:10px;font-weight:700;backdrop-filter:blur(10px);box-shadow:0 10px 24px rgba(0,0,0,.12)}.hero .kicker:before{content:"";width:7px;height:7px;border-radius:50%;background:#f2c964;box-shadow:0 0 0 5px rgba(242,201,100,.12),0 0 16px rgba(242,201,100,.8);animation:beacon 2.2s ease-in-out infinite}@keyframes beacon{50%{box-shadow:0 0 0 8px rgba(242,201,100,0),0 0 22px rgba(242,201,100,.95)}}
.hero h1{margin:7px 0 0;font-size:clamp(42px,5.3vw,70px);line-height:1.05;font-weight:800;letter-spacing:-1.7px;background:linear-gradient(180deg,#fff9e9 0%,#f4d88d 44%,#d8a144 100%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 12px 26px rgba(0,0,0,.23))}.hero p{margin:10px auto 0;max-width:790px;font-size:12px;line-height:1.9;color:#eef5f6;font-weight:500}.hero .rule{width:180px;height:3px;margin:12px auto 0;border-radius:999px;background:linear-gradient(90deg,transparent,#f0c86b,transparent);box-shadow:0 0 28px rgba(240,200,107,.52)}
.portal-zone{position:relative;z-index:4;width:min(1120px,91%);margin:0 auto;align-self:center;transform-style:preserve-3d}.portal-zone:before{content:"";position:absolute;left:6%;right:6%;bottom:-17px;height:38px;border-radius:50%;background:rgba(0,0,0,.30);filter:blur(18px);transform:translateZ(-30px)}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;direction:ltr;perspective:1500px}.portal-card{direction:rtl;position:relative;min-height:300px;padding:17px 17px 15px;border-radius:34px;text-decoration:none;color:#fff;display:flex;flex-direction:column;align-items:center;text-align:center;overflow:hidden;border:1px solid rgba(255,255,255,.29);backdrop-filter:blur(16px) saturate(1.35);transform-style:preserve-3d;transition:.34s cubic-bezier(.2,.8,.2,1);box-shadow:0 28px 55px rgba(0,0,0,.29),inset 0 1px rgba(255,255,255,.38),inset 0 -34px 60px rgba(0,0,0,.14)}
.portal-card:hover{transform:translateY(-12px) translateZ(50px) rotateX(1deg) scale(1.02);box-shadow:0 42px 72px rgba(0,0,0,.35),0 0 42px rgba(255,255,255,.09)}.portal-card:before{content:"";position:absolute;inset:-20% -60%;background:linear-gradient(118deg,transparent 38%,rgba(255,255,255,.38) 48%,transparent 58%);transform:translateX(-48%);transition:.7s}.portal-card:hover:before{transform:translateX(48%)}.portal-card:after{content:"";position:absolute;inset:8px;border:1px solid rgba(255,255,255,.22);border-radius:27px;box-shadow:inset 0 0 34px rgba(255,255,255,.05);pointer-events:none}
.admin{background:linear-gradient(160deg,rgba(194,134,40,.84),rgba(105,62,18,.69))}.teacher{background:linear-gradient(160deg,rgba(27,137,211,.84),rgba(7,69,118,.70))}.student{background:linear-gradient(160deg,rgba(24,174,132,.82),rgba(7,91,72,.70))}
.portal-icon{position:relative;z-index:2;width:92px;height:92px;margin:8px 0 15px;border-radius:30px;display:grid;place-items:center;font-size:39px;font-weight:800;background:linear-gradient(145deg,rgba(255,255,255,.50),rgba(255,255,255,.10));border:1px solid rgba(255,255,255,.48);box-shadow:0 20px 32px rgba(0,0,0,.22),inset 0 1px rgba(255,255,255,.62),0 0 34px rgba(255,255,255,.10);transform:translateZ(44px);animation:iconFloat 4.8s ease-in-out infinite}.portal-card:nth-child(2) .portal-icon{animation-delay:-1.4s}.portal-card:nth-child(3) .portal-icon{animation-delay:-2.5s}@keyframes iconFloat{50%{transform:translateY(-6px) translateZ(52px) rotateY(4deg)}}
.portal-card h2{position:relative;z-index:2;margin:0 0 6px;font-size:22px;font-weight:800;letter-spacing:-.35px}.portal-card p{position:relative;z-index:2;margin:0;max-width:290px;font-size:10.5px;line-height:1.85;color:#f1f7f7;font-weight:500}.enter{position:relative;z-index:2;margin-top:auto;width:90%;height:46px;border-radius:23px;display:flex;align-items:center;justify-content:center;gap:8px;background:linear-gradient(180deg,rgba(255,255,255,.31),rgba(255,255,255,.14));border:1px solid rgba(255,255,255,.34);box-shadow:inset 0 1px rgba(255,255,255,.40),0 12px 24px rgba(0,0,0,.14);font-size:10.5px;font-weight:800;transition:.25s}.portal-card:hover .enter{background:rgba(255,255,255,.27);transform:translateZ(28px)}.enter:after{content:"←";font-size:18px}
.scene-icons{position:relative;z-index:4;width:min(1120px,91%);margin:14px auto 0;display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.scene-feature{position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;gap:8px;padding:8px 7px;border-radius:17px;background:rgba(4,30,45,.32);border:1px solid rgba(255,255,255,.10);backdrop-filter:blur(10px);box-shadow:inset 0 1px rgba(255,255,255,.06);transition:.28s}.scene-feature:hover{transform:translateY(-4px);background:rgba(5,39,55,.50);box-shadow:0 12px 24px rgba(0,0,0,.16)}.scene-feature i{width:32px;height:32px;border-radius:11px;display:grid;place-items:center;font-style:normal;background:linear-gradient(145deg,#f1cc75,#bf8530);color:#102f40;font-weight:800;box-shadow:0 8px 18px rgba(190,132,45,.24)}.scene-feature b{display:block;font-size:9px;color:#f0d28b;font-weight:800}.scene-feature span{font-size:7.8px;color:#d5e2e6;line-height:1.45}
.signature{position:relative;z-index:4;text-align:center;margin:10px 16px 0;padding:10px 0 4px;border-top:1px solid rgba(255,255,255,.08);font-size:8.5px;color:#c9d8dd}.signature b{color:#efc76d;font-weight:800}
.spark{position:absolute;border-radius:50%;background:#f7d98b;box-shadow:0 0 18px rgba(247,217,139,.85);opacity:.66;animation:twinkle 3.4s ease-in-out infinite}.s1{width:5px;height:5px;top:30%;left:11%}.s2{width:4px;height:4px;top:18%;right:20%;animation-delay:-1.2s}.s3{width:6px;height:6px;bottom:25%;left:27%;animation-delay:-2.2s}@keyframes twinkle{50%{opacity:.16;transform:scale(.55)}}
@media(max-width:900px){.stage{width:98vw;padding:7px 0 10px;display:block}.stage:before{inset:4px;border-radius:26px}.topline{margin:0 7px;padding:9px 10px;border-radius:21px}.scene-tabs{display:none}.brand img{width:46px;height:46px;border-radius:15px}.brand strong{font-size:12px}.brand span{font-size:8px}.hero{padding:22px 9px 13px}.hero h1{font-size:33px;letter-spacing:-.8px}.hero p{font-size:9.4px}.portal-zone{width:94%}.cards{grid-template-columns:1fr;direction:rtl;gap:10px}.portal-card{min-height:158px;display:grid;grid-template-columns:76px 1fr;grid-template-rows:auto auto 40px;text-align:right;padding:11px}.portal-icon{grid-row:1/3;width:65px;height:65px;margin:0;border-radius:20px;font-size:27px}.portal-card h2{font-size:16px;margin:0}.portal-card p{font-size:8.7px}.enter{grid-column:1/3;width:100%;height:40px}.scene-icons{width:94%;grid-template-columns:1fr 1fr}.scene-feature{justify-content:flex-start}.signature{margin-top:9px;padding-bottom:9px}}
`;

export default function ApprovedHomeClient(){
  return <main id="lahooni-home" dir="rtl">
    <style>{css}</style>
    <div className="scene-bg" aria-hidden="true"/>
    <div className="stage" id="home">
      <span className="spark s1"/><span className="spark s2"/><span className="spark s3"/>
      <header className="topline">
        <div className="brand"><img src="/icons/lahooni-identity-320.jpg" alt="هوية منصة أستاذ لحوني التعليمية"/><div><strong>أستاذ لحوني التعليمية</strong><span>منصة تعليمية رقمية ذكية ومترابطة</span></div></div>
        <nav className="scene-tabs" aria-label="روابط تعريفية">
          <a href="#home" className="scene-tab active">الرئيسية</a><a href="#portals" className="scene-tab">البوابات</a><a href="#features" className="scene-tab">المميزات</a><a href="#support" className="scene-tab">الدعم</a>
        </nav>
      </header>

      <section className="hero">
        <span className="kicker">تجربة تعليمية بقيمة حقيقية</span>
        <h1>أستاذ لحوني التعليمية</h1>
        <p>منصة ذكية تجمع الإدارة والمعلم والطالب وولي الأمر في تجربة واحدة؛ متابعة أوضح، معلومات مترابطة، وقرارات تعليمية أدق.</p>
        <div className="rule"/>
      </section>

      <section className="portal-zone" id="portals" aria-label="بوابات الدخول">
        <div className="cards">
          {portals.map(p=><Link key={p.href} href={p.href} className={`portal-card ${p.cls}`}>
            <div className="portal-icon" aria-hidden="true">{p.icon}</div><h2>{p.title}</h2><p>{p.text}</p><div className="enter">{p.action}</div>
          </Link>)}
        </div>
      </section>

      <div>
        <section className="scene-icons" id="features" aria-label="مزايا المنصة">
          <div className="scene-feature"><i>◆</i><span><b>منصة متكاملة</b>قيمة تعليمية حقيقية</span></div>
          <div className="scene-feature"><i>◎</i><span><b>ترابط ذكي</b>الإدارة والمعلم والأسرة</span></div>
          <div className="scene-feature"><i>✦</i><span><b>متابعة مستمرة</b>تحصيل وحضور وتقدم</span></div>
          <div className="scene-feature"><i>▥</i><span><b>تقارير منظمة</b>وضوح وسهولة وصول</span></div>
          <div className="scene-feature" id="support"><i>✓</i><span><b>بيئة موثوقة</b>متابعة مستقرة وآمنة</span></div>
        </section>
        <footer className="signature">تصميم وتنفيذ: <b>الأستاذ حسن علي الطويل</b></footer>
      </div>
    </div>
  </main>
}
