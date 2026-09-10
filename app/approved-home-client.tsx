"use client";

import Link from "next/link";

const portals = [
  { href: "/admin", cls: "admin", icon: "◆", title: "بوابة الإدارة", text: "إدارة المنصة والتقارير والمتابعة الشاملة", action: "دخول الإدارة" },
  { href: "/teacher", cls: "teacher", icon: "✦", title: "بوابة المعلم", text: "التحصيل والحضور والخطط ومتابعة الطلاب", action: "دخول المعلم" },
  { href: "/student", cls: "student", icon: "◈", title: "بوابة الطالب / ولي الأمر", text: "التحصيل والملاحظات والحضور والتقدم الدراسي", action: "دخول الطالب / ولي الأمر" },
] as const;

const classroomPhoto = "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&fm=jpg&q=94&w=2600";

const css = `
#lahooni-home{min-height:100dvh;direction:rtl;position:relative;overflow-x:hidden;background:#061b2a;color:#fff;font-family:"Noto Kufi Arabic","Tajawal","Segoe UI",Arial,sans-serif}
#lahooni-home *{box-sizing:border-box}
.scene-bg{position:fixed;inset:0;background:url('${classroomPhoto}') center/cover no-repeat;filter:saturate(1.08) contrast(1.05) brightness(.96);transform:scale(1.015)}
.scene-bg:before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(2,15,26,.18),rgba(2,18,30,.08) 42%,rgba(2,16,28,.44)),radial-gradient(circle at 50% 18%,rgba(255,222,157,.25),transparent 35%)}
.scene-bg:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(3,25,40,.34),transparent 20%,transparent 78%,rgba(3,25,40,.24));mix-blend-mode:multiply}
.scene{position:relative;z-index:2;min-height:100dvh;width:min(1460px,96vw);margin:auto;padding:18px 0 20px;display:flex;flex-direction:column;justify-content:center;perspective:1900px}
.scene-card{position:relative;min-height:820px;border-radius:42px;overflow:hidden;background:linear-gradient(180deg,rgba(5,31,47,.26),rgba(5,28,42,.18));border:1px solid rgba(255,255,255,.10);box-shadow:0 45px 90px rgba(0,0,0,.30),inset 0 1px rgba(255,255,255,.08);backdrop-filter:blur(2px);transform-style:preserve-3d}
.scene-card:before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 50% 40%,rgba(255,255,255,.06),transparent 45%),linear-gradient(135deg,rgba(255,255,255,.03),transparent 30%,transparent 70%,rgba(239,193,95,.04));pointer-events:none}
.topline{position:relative;z-index:4;display:flex;align-items:center;justify-content:space-between;padding:20px 28px;background:linear-gradient(180deg,rgba(3,24,39,.66),rgba(3,24,39,.20));border-bottom:1px solid rgba(255,255,255,.08)}
.brand{display:flex;align-items:center;gap:13px}.brand img{width:58px;height:58px;border-radius:19px;object-fit:cover;border:2px solid #edc56f;box-shadow:0 0 0 4px rgba(237,197,111,.08),0 16px 30px rgba(0,0,0,.26)}.brand strong{display:block;font-size:17px;font-weight:900;letter-spacing:-.4px}.brand span{display:block;margin-top:2px;font-size:9px;color:#cfdee3}
.scene-tabs{display:flex;align-items:center;gap:9px}.scene-tab{padding:9px 14px;border-radius:999px;background:rgba(4,31,47,.34);border:1px solid rgba(255,255,255,.10);font-size:9px;font-weight:800;color:#dce8ec;box-shadow:inset 0 1px rgba(255,255,255,.05)}.scene-tab.active{background:linear-gradient(145deg,#f2cf7c,#c78d33);color:#112f3f;box-shadow:0 8px 22px rgba(202,143,49,.28)}
.hero{position:relative;z-index:4;text-align:center;padding:42px 20px 24px}.hero .kicker{font-size:12px;font-weight:800;color:#f0d48e;letter-spacing:.2px}.hero h1{margin:7px 0 0;font-size:clamp(46px,5.8vw,78px);line-height:1.05;font-weight:900;letter-spacing:-2px;background:linear-gradient(180deg,#fff9e9 0%,#f4d88d 45%,#d7a046 100%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 10px 22px rgba(0,0,0,.22))}.hero p{margin:14px auto 0;max-width:820px;font-size:13px;line-height:2;color:#f0f5f6;font-weight:600}.hero .rule{width:210px;height:3px;margin:16px auto 0;border-radius:999px;background:linear-gradient(90deg,transparent,#f0c86b,transparent);box-shadow:0 0 28px rgba(240,200,107,.55)}
.portal-zone{position:relative;z-index:4;width:min(1120px,91%);margin:4px auto 0;transform-style:preserve-3d}.portal-zone:before{content:"";position:absolute;left:4%;right:4%;bottom:-18px;height:42px;border-radius:50%;background:rgba(0,0,0,.28);filter:blur(18px);transform:translateZ(-30px)}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;direction:ltr;perspective:1500px}.portal-card{direction:rtl;position:relative;min-height:330px;padding:20px 18px 17px;border-radius:30px;text-decoration:none;color:#fff;display:flex;flex-direction:column;align-items:center;text-align:center;overflow:hidden;border:1px solid rgba(255,255,255,.28);backdrop-filter:blur(14px) saturate(1.3);transform-style:preserve-3d;transition:.34s cubic-bezier(.2,.8,.2,1);box-shadow:0 28px 55px rgba(0,0,0,.28),inset 0 1px rgba(255,255,255,.35),inset 0 -34px 60px rgba(0,0,0,.14)}
.portal-card:hover{transform:translateY(-12px) translateZ(48px) scale(1.02);box-shadow:0 40px 72px rgba(0,0,0,.34),0 0 42px rgba(255,255,255,.08)}.portal-card:before{content:"";position:absolute;inset:0;background:linear-gradient(128deg,rgba(255,255,255,.40),transparent 22%,transparent 64%,rgba(255,255,255,.06));pointer-events:none}.portal-card:after{content:"";position:absolute;width:180px;height:180px;top:-95px;left:-65px;border-radius:50%;background:rgba(255,255,255,.16);filter:blur(4px)}
.admin{background:linear-gradient(160deg,rgba(192,132,39,.82),rgba(106,62,17,.70))}.teacher{background:linear-gradient(160deg,rgba(24,133,207,.82),rgba(7,70,117,.72))}.student{background:linear-gradient(160deg,rgba(22,170,128,.80),rgba(7,91,71,.72))}
.portal-icon{position:relative;z-index:2;width:100px;height:100px;margin:12px 0 18px;border-radius:32px;display:grid;place-items:center;font-size:42px;font-weight:900;background:linear-gradient(145deg,rgba(255,255,255,.46),rgba(255,255,255,.10));border:1px solid rgba(255,255,255,.45);box-shadow:0 20px 32px rgba(0,0,0,.22),inset 0 1px rgba(255,255,255,.58),0 0 34px rgba(255,255,255,.10);transform:translateZ(42px)}
.portal-card h2{position:relative;z-index:2;margin:0 0 7px;font-size:23px;font-weight:900;letter-spacing:-.5px}.portal-card p{position:relative;z-index:2;margin:0;max-width:290px;font-size:10.5px;line-height:1.9;color:#f0f7f7;font-weight:600}.enter{position:relative;z-index:2;margin-top:auto;width:88%;height:48px;border-radius:24px;display:flex;align-items:center;justify-content:center;gap:8px;background:linear-gradient(180deg,rgba(255,255,255,.28),rgba(255,255,255,.14));border:1px solid rgba(255,255,255,.32);box-shadow:inset 0 1px rgba(255,255,255,.36),0 12px 24px rgba(0,0,0,.14);font-size:10.5px;font-weight:900}.enter:after{content:"←";font-size:18px}
.scene-icons{position:relative;z-index:4;width:min(1120px,91%);margin:24px auto 0;display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.scene-feature{display:flex;align-items:center;justify-content:center;gap:9px;padding:10px 8px;border-radius:18px;background:rgba(4,30,45,.34);border:1px solid rgba(255,255,255,.10);backdrop-filter:blur(9px);box-shadow:inset 0 1px rgba(255,255,255,.05)}.scene-feature i{width:34px;height:34px;border-radius:12px;display:grid;place-items:center;font-style:normal;background:linear-gradient(145deg,#f1cc75,#bf8530);color:#102f40;font-weight:900;box-shadow:0 8px 18px rgba(190,132,45,.24)}.scene-feature b{display:block;font-size:9.5px;color:#f0d28b}.scene-feature span{font-size:8px;color:#d5e2e6;line-height:1.5}
.signature{position:relative;z-index:4;text-align:center;margin-top:18px;padding:14px 0 18px;border-top:1px solid rgba(255,255,255,.08);font-size:8.7px;color:#c9d8dd}.signature b{color:#efc76d}
.spark{position:absolute;border-radius:50%;background:#f7d98b;box-shadow:0 0 18px rgba(247,217,139,.85);opacity:.65;animation:twinkle 3.4s ease-in-out infinite}.s1{width:5px;height:5px;top:28%;left:12%}.s2{width:4px;height:4px;top:20%;right:18%;animation-delay:-1.2s}.s3{width:6px;height:6px;bottom:28%;left:28%;animation-delay:-2.2s}@keyframes twinkle{50%{opacity:.15;transform:scale(.6)}}
@media(max-width:900px){.scene{width:97vw;padding:8px 0 14px}.scene-card{min-height:0;border-radius:26px}.scene-tabs{display:none}.topline{padding:12px 14px}.brand img{width:48px;height:48px}.brand strong{font-size:12px}.brand span{font-size:8px}.hero{padding:26px 10px 16px}.hero h1{font-size:34px;letter-spacing:-1px}.hero p{font-size:9.5px}.portal-zone{width:94%}.cards{grid-template-columns:1fr;direction:rtl;gap:11px}.portal-card{min-height:166px;display:grid;grid-template-columns:82px 1fr;grid-template-rows:auto auto 42px;text-align:right;padding:12px}.portal-icon{grid-row:1/3;width:70px;height:70px;margin:0;border-radius:22px;font-size:28px}.portal-card h2{font-size:16px;margin:0}.portal-card p{font-size:8.8px}.enter{grid-column:1/3;width:100%;height:42px}.scene-icons{width:94%;grid-template-columns:1fr 1fr}.scene-feature{justify-content:flex-start}.signature{padding-bottom:12px}}
`;

export default function ApprovedHomeClient(){
  return <main id="lahooni-home" dir="rtl">
    <style>{css}</style>
    <div className="scene-bg" aria-hidden="true"/>
    <div className="scene">
      <section className="scene-card" aria-label="الواجهة الرئيسية لمنصة أستاذ لحوني التعليمية">
        <span className="spark s1"/><span className="spark s2"/><span className="spark s3"/>
        <header className="topline">
          <div className="brand"><img src="/icons/lahooni-identity-320.jpg" alt="هوية منصة أستاذ لحوني التعليمية"/><div><strong>أستاذ لحوني التعليمية</strong><span>منصة تعليمية رقمية ذكية ومترابطة</span></div></div>
          <nav className="scene-tabs" aria-label="روابط تعريفية"><span className="scene-tab active">الرئيسية</span><span className="scene-tab">عن المنصة</span><span className="scene-tab">المميزات</span><span className="scene-tab">الدعم</span></nav>
        </header>

        <section className="hero">
          <span className="kicker">تجربة تعليمية بقيمة حقيقية</span>
          <h1>أستاذ لحوني التعليمية</h1>
          <p>منصة ذكية تجمع الإدارة والمعلم والطالب وولي الأمر في تجربة واحدة؛ متابعة أوضح، معلومات مترابطة، وقرارات تعليمية أدق.</p>
          <div className="rule"/>
        </section>

        <section className="portal-zone" aria-label="بوابات الدخول">
          <div className="cards">
            {portals.map(p=><Link key={p.href} href={p.href} className={`portal-card ${p.cls}`}>
              <div className="portal-icon" aria-hidden="true">{p.icon}</div>
              <h2>{p.title}</h2><p>{p.text}</p><div className="enter">{p.action}</div>
            </Link>)}
          </div>
        </section>

        <section className="scene-icons" aria-label="مزايا المنصة">
          <div className="scene-feature"><i>◆</i><span><b>منصة متكاملة</b>قيمة تعليمية حقيقية</span></div>
          <div className="scene-feature"><i>◎</i><span><b>ترابط ذكي</b>الإدارة والمعلم والأسرة</span></div>
          <div className="scene-feature"><i>✦</i><span><b>متابعة مستمرة</b>تحصيل وحضور وتقدم</span></div>
          <div className="scene-feature"><i>▥</i><span><b>تقارير منظمة</b>وضوح وسهولة وصول</span></div>
          <div className="scene-feature"><i>✓</i><span><b>بيئة موثوقة</b>متابعة مستقرة وآمنة</span></div>
        </section>

        <footer className="signature">تصميم وتنفيذ: <b>الأستاذ حسن علي الطويل</b></footer>
      </section>
    </div>
  </main>
}
