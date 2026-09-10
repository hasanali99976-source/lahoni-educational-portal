"use client";

import Link from "next/link";
import { useState } from "react";

const portals = [
  { href: "/admin", cls: "admin", icon: "◆", title: "بوابة الإدارة", text: "إدارة المنصة والتقارير والمتابعة الشاملة", action: "دخول الإدارة" },
  { href: "/teacher", cls: "teacher", icon: "✦", title: "بوابة المعلم", text: "التحصيل والحضور والخطط ومتابعة الطلاب", action: "دخول المعلم" },
  { href: "/student", cls: "student", icon: "◈", title: "بوابة الطالب / ولي الأمر", text: "التحصيل والملاحظات والحضور والتقدم الدراسي", action: "دخول الطالب / ولي الأمر" },
] as const;

const classroomPhoto = "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&fm=jpg&q=94&w=2600";

const css = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Kufi+Arabic:wght@500;600;700;800;900&family=Noto+Sans+Arabic:wght@400;500;600;700;800;900&display=swap');
#lahooni-home{min-height:100dvh;direction:rtl;position:relative;overflow-x:hidden;background:#071b29;color:#fff;font-family:"Noto Sans Arabic","Segoe UI",Arial,sans-serif}
#lahooni-home *{box-sizing:border-box}#lahooni-home a,#lahooni-home button{font-family:inherit}
.scene-bg{position:fixed;inset:0;background:url('${classroomPhoto}') center/cover no-repeat;filter:saturate(1.12) contrast(1.07) brightness(.98);transform:scale(1.018)}
.scene-bg:before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(3,18,29,.28),rgba(4,26,39,.08) 34%,rgba(3,20,31,.16) 68%,rgba(3,16,27,.52)),radial-gradient(circle at 50% 19%,rgba(255,221,151,.30),transparent 38%)}
.scene-bg:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(3,26,41,.34),transparent 20%,transparent 80%,rgba(3,26,41,.28))}
.stage{position:relative;z-index:2;width:min(1480px,97vw);min-height:100dvh;margin:auto;padding:12px 0 14px;display:grid;grid-template-rows:auto auto 1fr auto;align-items:center;perspective:1900px}
.stage:before{content:"";position:absolute;inset:7px;border-radius:38px;border:1px solid rgba(255,255,255,.10);background:linear-gradient(145deg,rgba(5,31,47,.16),rgba(5,28,42,.07));box-shadow:0 40px 90px rgba(0,0,0,.28),inset 0 1px rgba(255,255,255,.08);backdrop-filter:blur(1.4px);pointer-events:none}
.topline{position:relative;z-index:8;margin:0 16px;padding:10px 12px;border-radius:30px;display:flex;align-items:center;justify-content:space-between;gap:16px;background:linear-gradient(135deg,rgba(3,24,40,.88),rgba(8,57,70,.70));border:1px solid rgba(255,255,255,.15);box-shadow:0 18px 44px rgba(0,0,0,.25),inset 0 1px rgba(255,255,255,.16),0 0 0 1px rgba(239,199,109,.05);backdrop-filter:blur(18px) saturate(1.2)}
.topline:after{content:"";position:absolute;left:9%;right:9%;bottom:-1px;height:1px;background:linear-gradient(90deg,transparent,rgba(242,204,116,.65),transparent)}
.brand{display:flex;align-items:center;gap:12px;min-width:260px}.brand img{width:56px;height:56px;border-radius:19px;object-fit:cover;border:2px solid #edc56f;box-shadow:0 0 0 4px rgba(237,197,111,.08),0 12px 28px rgba(0,0,0,.28)}.brand strong{display:block;font-family:"Noto Kufi Arabic","Noto Sans Arabic",sans-serif;font-size:15px;line-height:1.6;font-weight:800;letter-spacing:-.55px;color:#fffaf0;text-shadow:0 2px 12px rgba(0,0,0,.30)}.brand span{display:block;margin-top:-1px;font-size:9px;color:#d5e4e8;font-weight:500;letter-spacing:.05px}
.scene-tabs{display:flex;align-items:center;gap:7px;padding:5px;border-radius:24px;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.09);box-shadow:inset 0 1px rgba(255,255,255,.07),0 8px 20px rgba(0,0,0,.10)}
.scene-tab{position:relative;overflow:hidden;text-decoration:none;border:0;cursor:pointer;padding:10px 16px;border-radius:19px;color:#e7f0f2;background:transparent;font-size:10.5px;font-weight:700;line-height:1;letter-spacing:-.18px;transition:.32s cubic-bezier(.2,.8,.2,1);transform-style:preserve-3d}.scene-tab:before{content:"";position:absolute;inset:-2px auto -2px -75%;width:48%;background:linear-gradient(110deg,transparent,rgba(255,255,255,.48),transparent);transform:skewX(-17deg);transition:.5s}.scene-tab:hover{transform:translateY(-3px) translateZ(20px);color:#fff;background:linear-gradient(145deg,rgba(255,255,255,.15),rgba(255,255,255,.07));box-shadow:0 12px 24px rgba(0,0,0,.18),inset 0 1px rgba(255,255,255,.14)}.scene-tab:hover:before{left:130%}.scene-tab.active{background:linear-gradient(145deg,#f7dc94,#c98e33);color:#0d3041;box-shadow:0 10px 25px rgba(202,143,49,.32),inset 0 1px rgba(255,255,255,.75)}.scene-tab.support{display:inline-flex;align-items:center;gap:7px}.scene-tab.support:after{content:"?";width:17px;height:17px;border-radius:50%;display:grid;place-items:center;background:rgba(240,202,111,.16);border:1px solid rgba(240,202,111,.38);color:#f6d989;font-size:10px;font-weight:900}.scene-tab.support:hover:after{background:#f1c96b;color:#0f3040}
.hero{position:relative;z-index:4;text-align:center;padding:24px 18px 13px}.hero .kicker{display:inline-flex;align-items:center;gap:7px;padding:7px 14px;border-radius:999px;background:rgba(4,31,47,.40);border:1px solid rgba(240,202,111,.26);color:#f0d48e;font-size:10px;font-weight:700;backdrop-filter:blur(10px);box-shadow:0 10px 24px rgba(0,0,0,.12)}.hero .kicker:before{content:"";width:7px;height:7px;border-radius:50%;background:#f2c964;box-shadow:0 0 0 5px rgba(242,201,100,.12),0 0 16px rgba(242,201,100,.8);animation:beacon 2.2s ease-in-out infinite}@keyframes beacon{50%{box-shadow:0 0 0 8px rgba(242,201,100,0),0 0 22px rgba(242,201,100,.95)}}
.hero h1{margin:8px 0 0;font-family:"Noto Kufi Arabic","Noto Sans Arabic",sans-serif;font-size:clamp(41px,5vw,69px);line-height:1.42;font-weight:900;letter-spacing:-2.4px;background:linear-gradient(180deg,#fffefa 0%,#ffeab2 30%,#f2c869 62%,#c8872c 100%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 3px 0 rgba(92,53,12,.33)) drop-shadow(0 15px 30px rgba(0,0,0,.34));text-wrap:balance}.hero h1:after{content:"";display:block;width:150px;height:3px;margin:7px auto 0;border-radius:999px;background:linear-gradient(90deg,transparent,#f3cb70,transparent);box-shadow:0 0 24px rgba(243,203,112,.44)}.hero p{margin:6px auto 0;max-width:800px;font-size:12px;line-height:2;color:#f4f8f9;font-weight:500;text-shadow:0 2px 10px rgba(0,0,0,.2)}
.portal-zone{position:relative;z-index:4;width:min(1120px,91%);margin:0 auto;align-self:center;transform-style:preserve-3d}.portal-zone:before{content:"";position:absolute;left:6%;right:6%;bottom:-17px;height:38px;border-radius:50%;background:rgba(0,0,0,.30);filter:blur(18px);transform:translateZ(-30px)}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;direction:ltr;perspective:1500px}.portal-card{direction:rtl;position:relative;min-height:300px;padding:17px 17px 15px;border-radius:34px;text-decoration:none;color:#fff;display:flex;flex-direction:column;align-items:center;text-align:center;overflow:hidden;border:1px solid rgba(255,255,255,.30);backdrop-filter:blur(16px) saturate(1.38);transform-style:preserve-3d;transition:.38s cubic-bezier(.2,.8,.2,1);box-shadow:0 30px 58px rgba(0,0,0,.30),inset 0 1px rgba(255,255,255,.40),inset 0 -34px 60px rgba(0,0,0,.14)}
.portal-card:hover{transform:translateY(-13px) translateZ(54px) rotateX(1.5deg) scale(1.022);box-shadow:0 44px 76px rgba(0,0,0,.37),0 0 48px rgba(255,255,255,.10)}.portal-card:before{content:"";position:absolute;inset:-20% -60%;background:linear-gradient(118deg,transparent 38%,rgba(255,255,255,.40) 48%,transparent 58%);transform:translateX(-48%);transition:.72s}.portal-card:hover:before{transform:translateX(48%)}.portal-card:after{content:"";position:absolute;inset:8px;border:1px solid rgba(255,255,255,.23);border-radius:27px;box-shadow:inset 0 0 34px rgba(255,255,255,.055);pointer-events:none}
.admin{background:linear-gradient(160deg,rgba(202,143,49,.86),rgba(102,59,16,.70))}.teacher{background:linear-gradient(160deg,rgba(30,145,220,.86),rgba(6,68,116,.72))}.student{background:linear-gradient(160deg,rgba(25,180,137,.84),rgba(7,90,71,.72))}
.portal-icon{position:relative;z-index:2;width:92px;height:92px;margin:8px 0 15px;border-radius:30px;display:grid;place-items:center;font-size:39px;font-weight:800;background:linear-gradient(145deg,rgba(255,255,255,.52),rgba(255,255,255,.10));border:1px solid rgba(255,255,255,.50);box-shadow:0 20px 32px rgba(0,0,0,.22),inset 0 1px rgba(255,255,255,.65),0 0 34px rgba(255,255,255,.10);transform:translateZ(44px);animation:iconFloat 4.8s ease-in-out infinite}.portal-card:nth-child(2) .portal-icon{animation-delay:-1.4s}.portal-card:nth-child(3) .portal-icon{animation-delay:-2.5s}@keyframes iconFloat{50%{transform:translateY(-6px) translateZ(52px) rotateY(4deg)}}
.portal-card h2{position:relative;z-index:2;margin:0 0 6px;font-family:"Noto Kufi Arabic","Noto Sans Arabic",sans-serif;font-size:20px;font-weight:800;line-height:1.7;letter-spacing:-.7px;text-shadow:0 3px 12px rgba(0,0,0,.20)}.portal-card p{position:relative;z-index:2;margin:0;max-width:290px;font-size:10.5px;line-height:1.95;color:#f3f8f8;font-weight:500}.enter{position:relative;z-index:2;margin-top:auto;width:90%;height:46px;border-radius:23px;display:flex;align-items:center;justify-content:center;gap:8px;background:linear-gradient(180deg,rgba(255,255,255,.33),rgba(255,255,255,.15));border:1px solid rgba(255,255,255,.36);box-shadow:inset 0 1px rgba(255,255,255,.42),0 12px 24px rgba(0,0,0,.14);font-size:10.5px;font-weight:800;transition:.25s}.portal-card:hover .enter{background:rgba(255,255,255,.29);transform:translateZ(28px)}.enter:after{content:"←";font-size:18px}
.scene-icons{position:relative;z-index:4;width:min(1120px,91%);margin:14px auto 0;display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.scene-feature{position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;gap:8px;padding:8px 7px;border-radius:17px;background:rgba(4,30,45,.32);border:1px solid rgba(255,255,255,.10);backdrop-filter:blur(10px);box-shadow:inset 0 1px rgba(255,255,255,.06);transition:.28s}.scene-feature:hover{transform:translateY(-4px);background:rgba(5,39,55,.50);box-shadow:0 12px 24px rgba(0,0,0,.16)}.scene-feature i{width:32px;height:32px;border-radius:11px;display:grid;place-items:center;font-style:normal;background:linear-gradient(145deg,#f1cc75,#bf8530);color:#102f40;font-weight:900;box-shadow:0 8px 18px rgba(190,132,45,.24)}.scene-feature b{display:block;font-size:9px;color:#f0d28b;font-weight:800}.scene-feature span{font-size:7.8px;color:#d5e2e6;line-height:1.5}
.signature{position:relative;z-index:4;text-align:center;margin:10px 16px 0;padding:10px 0 4px;border-top:1px solid rgba(255,255,255,.08);font-size:8.5px;color:#c9d8dd}.signature b{color:#efc76d;font-weight:800}
.support-overlay{position:fixed;inset:0;z-index:50;display:grid;place-items:center;padding:20px;background:rgba(1,12,20,.58);backdrop-filter:blur(10px);animation:fadeIn .22s ease}.support-dialog{position:relative;width:min(430px,92vw);padding:30px 28px 26px;border-radius:30px;text-align:center;background:linear-gradient(155deg,rgba(8,48,63,.97),rgba(3,28,43,.98));border:1px solid rgba(255,255,255,.18);box-shadow:0 34px 90px rgba(0,0,0,.46),inset 0 1px rgba(255,255,255,.16);overflow:hidden;animation:popIn .28s cubic-bezier(.2,.85,.25,1.15)}.support-dialog:before{content:"";position:absolute;width:180px;height:180px;border-radius:50%;top:-100px;left:-70px;background:rgba(241,201,105,.14);filter:blur(4px)}.support-icon{width:72px;height:72px;margin:0 auto 14px;border-radius:24px;display:grid;place-items:center;font-size:30px;background:linear-gradient(145deg,#f7dc93,#c88b31);color:#103244;box-shadow:0 16px 34px rgba(197,137,45,.30),inset 0 1px rgba(255,255,255,.7)}.support-dialog h3{margin:0;font-family:"Noto Kufi Arabic","Noto Sans Arabic",sans-serif;font-size:21px;line-height:1.7;color:#fff7e7}.support-dialog p{margin:5px 0 15px;font-size:11px;line-height:1.9;color:#d9e6ea}.support-phone{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;height:54px;border-radius:18px;text-decoration:none;direction:ltr;background:linear-gradient(145deg,#f7d77f,#c88b31);color:#113244;font-size:18px;font-weight:900;box-shadow:0 14px 30px rgba(196,137,47,.28),inset 0 1px rgba(255,255,255,.66)}.support-close{position:absolute;top:12px;right:12px;width:34px;height:34px;border-radius:12px;border:1px solid rgba(255,255,255,.13);background:rgba(255,255,255,.07);color:#fff;cursor:pointer;font-size:20px;line-height:1;transition:.2s}.support-close:hover{background:rgba(255,255,255,.14);transform:rotate(5deg)}@keyframes fadeIn{from{opacity:0}}@keyframes popIn{from{opacity:0;transform:translateY(14px) scale(.96)}}
.spark{position:absolute;border-radius:50%;background:#f7d98b;box-shadow:0 0 18px rgba(247,217,139,.85);opacity:.66;animation:twinkle 3.4s ease-in-out infinite}.s1{width:5px;height:5px;top:30%;left:11%}.s2{width:4px;height:4px;top:18%;right:20%;animation-delay:-1.2s}.s3{width:6px;height:6px;bottom:25%;left:27%;animation-delay:-2.2s}@keyframes twinkle{50%{opacity:.16;transform:scale(.55)}}
@media(max-width:900px){.stage{width:98vw;padding:7px 0 10px;display:block}.stage:before{inset:4px;border-radius:26px}.topline{margin:0 7px;padding:9px 10px;border-radius:23px}.scene-tabs{display:flex;gap:4px;padding:4px;overflow-x:auto;max-width:58vw}.scene-tab{padding:9px 10px;font-size:8.5px;white-space:nowrap}.brand{min-width:0}.brand img{width:45px;height:45px;border-radius:15px}.brand strong{font-size:10.5px;letter-spacing:-.35px}.brand span{display:none}.hero{padding:21px 9px 12px}.hero h1{font-size:30px;letter-spacing:-1.2px;line-height:1.5}.hero h1:after{width:110px}.hero p{font-size:9.4px}.portal-zone{width:94%}.cards{grid-template-columns:1fr;direction:rtl;gap:10px}.portal-card{min-height:158px;display:grid;grid-template-columns:76px 1fr;grid-template-rows:auto auto 40px;text-align:right;padding:11px}.portal-icon{grid-row:1/3;width:65px;height:65px;margin:0;border-radius:20px;font-size:27px}.portal-card h2{font-size:15px;margin:0}.portal-card p{font-size:8.7px}.enter{grid-column:1/3;width:100%;height:40px}.scene-icons{width:94%;grid-template-columns:1fr 1fr}.scene-feature{justify-content:flex-start}.signature{margin-top:9px;padding-bottom:9px}}
`;

export default function ApprovedHomeClient(){
  const [supportOpen,setSupportOpen]=useState(false);
  return <main id="lahooni-home" dir="rtl">
    <style>{css}</style>
    <div className="scene-bg" aria-hidden="true"/>
    <div className="stage" id="home">
      <span className="spark s1"/><span className="spark s2"/><span className="spark s3"/>
      <header className="topline">
        <div className="brand"><img src="/icons/lahooni-identity-320.jpg" alt="هوية منصة أستاذ لحوني التعليمية"/><div><strong>أستاذ لحوني التعليمية</strong><span>منصة تعليمية رقمية ذكية ومترابطة</span></div></div>
        <nav className="scene-tabs" aria-label="روابط تعريفية">
          <a href="#home" className="scene-tab active">الرئيسية</a>
          <a href="#portals" className="scene-tab">البوابات</a>
          <a href="#features" className="scene-tab">المميزات</a>
          <button type="button" className="scene-tab support" onClick={()=>setSupportOpen(true)}>الدعم</button>
        </nav>
      </header>

      <section className="hero">
        <span className="kicker">تجربة تعليمية بقيمة حقيقية</span>
        <h1>أستاذ لحوني التعليمية</h1>
        <p>منصة ذكية تجمع الإدارة والمعلم والطالب وولي الأمر في تجربة واحدة؛ متابعة أوضح، معلومات مترابطة، وقرارات تعليمية أدق.</p>
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
          <div className="scene-feature"><i>✓</i><span><b>بيئة موثوقة</b>متابعة مستقرة وآمنة</span></div>
        </section>
        <footer className="signature">تصميم وتنفيذ: <b>الأستاذ حسن علي الطويل</b></footer>
      </div>
    </div>

    {supportOpen&&<div className="support-overlay" role="dialog" aria-modal="true" aria-label="الدعم الفني" onClick={()=>setSupportOpen(false)}>
      <div className="support-dialog" onClick={e=>e.stopPropagation()}>
        <button type="button" className="support-close" onClick={()=>setSupportOpen(false)} aria-label="إغلاق">×</button>
        <div className="support-icon">☎</div>
        <h3>الدعم الفني للمنصة</h3>
        <p>للمساعدة أو الاستفسار يمكنك التواصل مباشرة عبر الرقم التالي.</p>
        <a className="support-phone" href="tel:0590701007">0590701007</a>
      </div>
    </div>}
  </main>
}
