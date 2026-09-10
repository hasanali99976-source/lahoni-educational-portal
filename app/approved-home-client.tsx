"use client";

import Link from "next/link";

const portals = [
  { href: "/admin", cls: "admin", icon: "⚙", title: "بوابة الإدارة", text: "إدارة المنصة والتقارير والمتابعة الشاملة", action: "دخول الإدارة" },
  { href: "/teacher", cls: "teacher", icon: "✦", title: "بوابة المعلم", text: "التحصيل والحضور والخطط ومتابعة الطلاب", action: "دخول المعلم" },
  { href: "/student", cls: "student", icon: "◈", title: "بوابة الطالب / ولي الأمر", text: "التحصيل والملاحظات والحضور والتقدم الدراسي", action: "دخول الطالب / ولي الأمر" },
] as const;

const classroomPhoto = "https://images.unsplash.com/photo-1588072432836-e10032774350?auto=format&fit=crop&fm=jpg&q=96&w=2400";

const css = `
#lahooni-home{min-height:100dvh;direction:rtl;position:relative;overflow:hidden;background:#d7c4a1;font-family:inherit;color:#fff}
#lahooni-home *{box-sizing:border-box}
.classroom{position:fixed;inset:0;background-image:linear-gradient(180deg,rgba(255,248,230,.02),rgba(8,26,37,.10)),url('${classroomPhoto}');background-size:cover;background-position:center 50%;filter:saturate(1.08) contrast(1.08) brightness(1.14)}
.classroom:after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 50% 26%,rgba(255,236,197,.24),transparent 32%),linear-gradient(90deg,rgba(7,25,38,.16),transparent 14%,transparent 86%,rgba(7,25,38,.16)),linear-gradient(180deg,transparent 68%,rgba(6,25,38,.24));pointer-events:none}
.scene{position:relative;z-index:2;min-height:100dvh;width:min(1280px,98vw);margin:auto;padding:18px 0 12px;display:flex;align-items:center;justify-content:center;perspective:1800px}
.board-zone{position:relative;width:min(1130px,96vw);padding:20px 18px 24px;transform-style:preserve-3d}
.board-shadow{position:absolute;left:7%;right:7%;bottom:0;height:56px;border-radius:50%;background:rgba(27,18,11,.28);filter:blur(18px);transform:translateZ(-10px)}
.board{position:relative;width:100%;min-height:660px;padding:24px 32px 22px;border-radius:20px;background:radial-gradient(circle at 50% -8%,rgba(55,131,125,.22),transparent 38%),linear-gradient(145deg,#104f51,#0d4146 48%,#0a3438);border:14px solid #8a623c;box-shadow:0 38px 70px rgba(30,20,11,.33),0 10px 0 #5a3b24,inset 0 0 0 2px rgba(255,255,255,.04),inset 0 0 90px rgba(0,0,0,.20);transform:rotateX(1deg) translateZ(26px);overflow:hidden}
.board:before{content:"";position:absolute;inset:0;background:linear-gradient(118deg,rgba(255,255,255,.055),transparent 19%,transparent 77%,rgba(255,255,255,.03)),radial-gradient(circle at 12% 18%,rgba(255,255,255,.035),transparent 17%),radial-gradient(circle at 88% 82%,rgba(0,0,0,.10),transparent 24%);pointer-events:none}.board:after{content:"";position:absolute;left:5%;right:5%;bottom:-20px;height:24px;border-radius:0 0 16px 16px;background:linear-gradient(#b48655,#765033);box-shadow:0 8px 15px rgba(0,0,0,.25)}
.rail{position:absolute;left:6%;right:6%;bottom:5px;height:9px;border-radius:5px;background:linear-gradient(180deg,#c4925c,#805636);box-shadow:0 5px 10px rgba(0,0,0,.25)}
.identity{position:absolute;top:22px;right:24px;display:flex;align-items:center;gap:10px;z-index:5;padding:7px 10px 7px 12px;border-radius:18px;background:rgba(3,29,35,.38);border:1px solid rgba(245,208,127,.17);backdrop-filter:blur(8px)}.identity img{width:60px;height:60px;border-radius:50%;object-fit:cover;border:2px solid #e6bc64;box-shadow:0 10px 22px rgba(0,0,0,.28),0 0 0 5px rgba(255,255,255,.035)}.identity strong{display:block;font-size:13px;font-weight:950;color:#fff;letter-spacing:-.15px}.identity span{display:block;margin-top:2px;font-size:8.5px;color:#cfe2de;font-weight:700}.stage-tag{position:absolute;top:26px;left:24px;z-index:4;padding:8px 13px;border-radius:15px;background:rgba(255,255,255,.055);border:1px solid rgba(239,199,112,.20);color:#f2cf82;font-size:9px;font-weight:900;backdrop-filter:blur(8px)}
.hero{position:relative;z-index:3;text-align:center;padding-top:84px}.kicker{font-size:11px;color:#d5e5e1;font-weight:850;letter-spacing:.2px}.hero h1{margin:5px 0 0;font-size:clamp(38px,5vw,63px);font-weight:950;line-height:1.02;letter-spacing:-1.5px;color:#f3c96f;text-shadow:0 8px 22px rgba(0,0,0,.34),0 1px 0 rgba(255,255,255,.10)}.hero p{margin:10px auto 0;max-width:690px;color:#f4f8f6;font-size:12px;line-height:1.85;font-weight:700;text-shadow:0 3px 10px rgba(0,0,0,.2)}.hero-rule{width:122px;height:3px;margin:13px auto 0;border-radius:8px;background:linear-gradient(90deg,transparent,#edbf62,transparent);box-shadow:0 0 14px rgba(237,191,98,.22)}
.portals-label{text-align:center;margin-top:16px;color:#d5e5e1;font-size:9px;font-weight:850}.cards{position:relative;z-index:3;display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:10px;direction:ltr}.portal-card{direction:rtl;position:relative;min-height:248px;padding:17px 15px 14px;border-radius:24px;text-decoration:none;color:#fff;display:flex;flex-direction:column;align-items:center;text-align:center;overflow:hidden;border:1px solid rgba(255,255,255,.26);backdrop-filter:blur(11px) saturate(1.22);box-shadow:0 20px 34px rgba(0,0,0,.23),inset 0 1px rgba(255,255,255,.24),inset 0 -22px 40px rgba(0,0,0,.08);transition:transform .24s ease,box-shadow .24s ease;transform-style:preserve-3d}.portal-card:before{content:"";position:absolute;width:165px;height:72px;left:-52px;top:-26px;transform:rotate(-24deg);background:linear-gradient(90deg,transparent,rgba(255,255,255,.26),transparent);filter:blur(1px)}.portal-card:after{content:"";position:absolute;inset:auto 10% 7px;height:8px;border-radius:50%;background:rgba(0,0,0,.15);filter:blur(7px);z-index:-1}.portal-card:hover{transform:translateY(-9px) translateZ(36px) scale(1.018);box-shadow:0 30px 45px rgba(0,0,0,.30),0 0 26px rgba(255,255,255,.05)}.admin{background:linear-gradient(145deg,rgba(190,135,41,.62),rgba(101,68,20,.38))}.teacher{background:linear-gradient(145deg,rgba(24,126,200,.66),rgba(11,70,116,.38))}.student{background:linear-gradient(145deg,rgba(26,164,116,.63),rgba(8,95,69,.38))}.card-icon{width:86px;height:86px;border-radius:25px;display:grid;place-items:center;font-size:38px;margin-bottom:10px;background:linear-gradient(145deg,rgba(255,255,255,.42),rgba(255,255,255,.10));border:1px solid rgba(255,255,255,.35);box-shadow:0 15px 24px rgba(0,0,0,.18),inset 0 1px rgba(255,255,255,.5);transform:translateZ(18px)}.portal-card h2{margin:1px 0 6px;font-size:21px;font-weight:950;letter-spacing:-.2px}.portal-card p{margin:0;max-width:255px;font-size:10.5px;line-height:1.7;color:#f3f7f5;font-weight:700}.enter{margin-top:auto;width:100%;height:43px;border-radius:22px;display:flex;align-items:center;justify-content:center;gap:7px;background:rgba(255,255,255,.17);border:1px solid rgba(255,255,255,.24);font-size:10.5px;font-weight:950;box-shadow:inset 0 1px rgba(255,255,255,.22)}.enter:after{content:"←";font-size:17px}
.features{position:relative;z-index:3;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:13px}.feature{padding:9px 7px;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10);text-align:center;color:#d6e6e2;font-size:8.5px;backdrop-filter:blur(6px)}.feature strong{display:block;color:#f1cb79;font-size:9.5px;margin-bottom:2px}.footer{position:relative;z-index:3;margin-top:10px;text-align:center;color:#cadcd7;font-size:8.5px}.footer b{color:#efc66f}
.glow{position:absolute;pointer-events:none;border-radius:50%;filter:blur(45px);opacity:.18}.g1{width:160px;height:160px;background:#e7bb65;top:22%;left:3%}.g2{width:180px;height:180px;background:#4ec8bb;right:2%;bottom:16%}
@media(max-width:760px){#lahooni-home{overflow:auto}.scene{padding:8px 0;align-items:flex-start}.board-zone{width:100%;padding:4px 6px 15px}.board{border-width:8px;min-height:0;padding:15px 10px 17px}.identity{position:relative;top:auto;right:auto;justify-content:center;width:max-content;max-width:100%;margin:auto}.identity img{width:52px;height:52px}.identity strong{font-size:11px}.stage-tag{display:none}.hero{padding-top:13px}.hero h1{font-size:30px;letter-spacing:-.8px}.hero p{font-size:9.5px}.cards{grid-template-columns:1fr;direction:rtl;gap:9px;margin-top:12px}.portal-card{min-height:132px;display:grid;grid-template-columns:62px 1fr;grid-template-rows:auto auto 38px;text-align:right;column-gap:10px;padding:10px}.card-icon{grid-row:1/3;width:62px;height:62px;font-size:28px;margin:0}.portal-card h2{font-size:16px;margin:0}.portal-card p{font-size:9px}.enter{grid-column:1/3;height:38px}.features{grid-template-columns:repeat(2,1fr)}}
`;

export default function ApprovedHomeClient(){
  return <main id="lahooni-home" dir="rtl">
    <style>{css}</style>
    <div className="classroom" aria-hidden="true" />
    <div className="scene">
      <div className="board-zone">
        <div className="board-shadow" aria-hidden="true"/>
        <section className="board" aria-label="الواجهة الرئيسية لمنصة أستاذ لحوني التعليمية">
          <span className="glow g1"/><span className="glow g2"/>
          <div className="identity"><img src="/icons/lahooni-identity-320.jpg" alt="هوية منصة أستاذ لحوني التعليمية"/><div><strong>منصة أستاذ لحوني التعليمية</strong><span>تعليم ذكي • متابعة مترابطة • تجربة حديثة</span></div></div>
          <div className="stage-tag">المرحلة الثانوية • بيئة تعليمية سعودية</div>
          <div className="hero"><div className="kicker">مرحبًا بكم في</div><h1>منصة أستاذ لحوني التعليمية</h1><p>منصة ذكية تجمع الإدارة والمعلم والطالب وولي الأمر في تجربة تعليمية واحدة، واضحة، سريعة ومترابطة.</p><div className="hero-rule"/></div>
          <div className="portals-label">اختر بوابتك للدخول</div>
          <section className="cards" aria-label="بوابات الدخول">{portals.map(p=><Link key={p.href} href={p.href} className={`portal-card ${p.cls}`}><div className="card-icon" aria-hidden="true">{p.icon}</div><h2>{p.title}</h2><p>{p.text}</p><div className="enter">{p.action}</div></Link>)}</section>
          <div className="features"><div className="feature"><strong>متابعة ذكية</strong>تحصيل وتقدم</div><div className="feature"><strong>تقارير فورية</strong>مؤشرات واضحة</div><div className="feature"><strong>تواصل مترابط</strong>إدارة ومعلم وأسرة</div><div className="feature"><strong>بيئة آمنة</strong>خصوصية واستقرار</div></div>
          <div className="footer">تصميم وتنفيذ: <b>أ. حسن علي الطويل</b></div>
          <div className="rail" aria-hidden="true"/>
        </section>
      </div>
    </div>
  </main>;
}
