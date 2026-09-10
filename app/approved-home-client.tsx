"use client";

import Link from "next/link";

const portals = [
  { href: "/admin", cls: "admin", icon: "⚙", title: "بوابة الإدارة", text: "الإدارة والتقارير والمتابعة", action: "دخول الإدارة" },
  { href: "/teacher", cls: "teacher", icon: "✦", title: "بوابة المعلم", text: "التحصيل والحضور والخطط", action: "دخول المعلم" },
  { href: "/student", cls: "student", icon: "◈", title: "بوابة الطالب / ولي الأمر", text: "التحصيل والملاحظات والتقدم", action: "دخول الطالب / ولي الأمر" },
] as const;

const classroomPhoto = "https://images.unsplash.com/photo-1588072432836-e10032774350?auto=format&fit=crop&fm=jpg&q=95&w=2400";

const css = `
#lahooni-home{min-height:100dvh;direction:rtl;position:relative;overflow:hidden;background:#d8c7a7;font-family:inherit;color:#fff}
#lahooni-home *{box-sizing:border-box}
.classroom{position:fixed;inset:0;background-image:linear-gradient(180deg,rgba(255,248,231,.04),rgba(10,29,39,.12)),url('${classroomPhoto}');background-size:cover;background-position:center 52%;filter:saturate(1.06) contrast(1.05) brightness(1.10)}
.classroom:after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 50% 34%,rgba(255,244,214,.18),transparent 34%),linear-gradient(90deg,rgba(4,24,38,.14),transparent 18%,transparent 82%,rgba(4,24,38,.15)),linear-gradient(180deg,transparent 72%,rgba(4,24,38,.25));}
.scene{position:relative;z-index:2;min-height:100dvh;width:min(1180px,96vw);margin:auto;padding:28px 0 18px;display:flex;align-items:center;justify-content:center;perspective:1500px}
.board{position:relative;width:min(1030px,94vw);min-height:640px;padding:28px 34px 24px;border-radius:16px;background:radial-gradient(circle at 50% 0%,rgba(67,124,117,.22),transparent 36%),linear-gradient(145deg,rgba(12,66,69,.96),rgba(10,52,57,.98) 56%,rgba(7,42,47,.99));border:12px solid #8b6541;box-shadow:0 34px 65px rgba(31,22,14,.30),0 8px 0 #5e4028,inset 0 0 0 2px rgba(255,255,255,.04),inset 0 0 80px rgba(0,0,0,.18);transform:rotateX(.7deg) translateZ(20px);overflow:hidden}
.board:before{content:"";position:absolute;inset:0;background:linear-gradient(115deg,rgba(255,255,255,.05),transparent 20%,transparent 80%,rgba(255,255,255,.025));pointer-events:none}.board:after{content:"";position:absolute;left:6%;right:6%;bottom:-19px;height:22px;border-radius:0 0 14px 14px;background:linear-gradient(#ad8050,#7b5434);box-shadow:0 8px 16px rgba(0,0,0,.22)}
.identity{position:absolute;top:24px;right:26px;display:flex;align-items:center;gap:10px;z-index:3}.identity img{width:64px;height:64px;border-radius:50%;object-fit:cover;border:2px solid #e5be69;box-shadow:0 9px 22px rgba(0,0,0,.25),0 0 0 5px rgba(255,255,255,.04)}.identity strong{display:block;color:#fff;font-size:13px;font-weight:950}.identity span{display:block;color:#d6e7e3;font-size:9px;margin-top:3px}.stage-tag{position:absolute;top:29px;left:28px;padding:8px 13px;border-radius:14px;border:1px solid rgba(242,203,121,.25);background:rgba(255,255,255,.05);color:#f2d38e;font-size:9px;font-weight:900;letter-spacing:.1px}
.hero{text-align:center;position:relative;z-index:2;padding-top:76px}.hero .kicker{font-size:12px;color:#d6e5e1;font-weight:800}.hero h1{margin:5px 0 0;font-size:clamp(34px,4.4vw,54px);line-height:1.08;font-weight:950;letter-spacing:-1px;color:#f0c770;text-shadow:0 6px 18px rgba(0,0,0,.30)}.hero p{margin:8px auto 0;max-width:620px;color:#f2f7f5;font-size:12px;line-height:1.8;font-weight:700}.hero-rule{width:94px;height:3px;margin:12px auto 0;border-radius:8px;background:linear-gradient(90deg,transparent,#e9bd61,transparent)}
.portals-label{text-align:center;margin-top:17px;color:#cfe0dc;font-size:9px;font-weight:850;letter-spacing:.3px}.cards{position:relative;z-index:2;display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:9px;direction:ltr}.portal-card{direction:rtl;position:relative;min-height:245px;padding:18px 15px 14px;border-radius:22px;text-decoration:none;color:#fff;display:flex;flex-direction:column;align-items:center;text-align:center;border:1px solid rgba(255,255,255,.22);backdrop-filter:blur(8px) saturate(1.12);box-shadow:0 18px 32px rgba(0,0,0,.24),inset 0 1px rgba(255,255,255,.22),inset 0 -20px 36px rgba(0,0,0,.06);transition:transform .23s ease,box-shadow .23s ease;overflow:hidden}.portal-card:before{content:"";position:absolute;width:150px;height:68px;left:-45px;top:-24px;transform:rotate(-24deg);background:linear-gradient(90deg,transparent,rgba(255,255,255,.20),transparent)}.portal-card:hover{transform:translateY(-7px) translateZ(24px);box-shadow:0 28px 40px rgba(0,0,0,.31)}.admin{background:linear-gradient(145deg,rgba(185,132,42,.55),rgba(95,64,20,.32))}.teacher{background:linear-gradient(145deg,rgba(22,118,190,.58),rgba(11,67,111,.34))}.student{background:linear-gradient(145deg,rgba(24,157,112,.56),rgba(8,89,65,.34))}.card-icon{width:82px;height:82px;border-radius:23px;display:grid;place-items:center;font-size:36px;margin-bottom:10px;background:linear-gradient(145deg,rgba(255,255,255,.34),rgba(255,255,255,.09));border:1px solid rgba(255,255,255,.30);box-shadow:0 13px 22px rgba(0,0,0,.16),inset 0 1px rgba(255,255,255,.38)}.portal-card h2{margin:1px 0 6px;font-size:20px;font-weight:950}.portal-card p{margin:0;font-size:10.5px;line-height:1.7;color:#f0f6f4;font-weight:700}.enter{margin-top:auto;width:100%;height:42px;border-radius:21px;display:flex;align-items:center;justify-content:center;gap:7px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.22);font-size:10px;font-weight:950}.enter:after{content:"←";font-size:16px}
.features{position:relative;z-index:2;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:14px}.feature{padding:9px 6px;border-radius:13px;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.09);text-align:center;color:#d7e7e3;font-size:8.5px}.feature strong{display:block;color:#efcb7b;font-size:9.5px;margin-bottom:2px}.footer{position:relative;z-index:2;margin-top:11px;text-align:center;color:#cadbd7;font-size:8.5px}.footer b{color:#efc66f}
@media(max-width:760px){#lahooni-home{overflow:auto}.scene{padding:10px 0;align-items:flex-start}.board{width:96vw;border-width:8px;min-height:0;padding:18px 12px 18px}.identity{position:relative;top:auto;right:auto;justify-content:center}.identity img{width:54px;height:54px}.identity strong{font-size:12px}.stage-tag{display:none}.hero{padding-top:13px}.hero h1{font-size:29px}.hero p{font-size:10px}.cards{grid-template-columns:1fr;direction:rtl;gap:9px;margin-top:12px}.portal-card{min-height:132px;display:grid;grid-template-columns:62px 1fr;grid-template-rows:auto auto 38px;text-align:right;column-gap:10px;padding:10px}.card-icon{grid-row:1/3;width:62px;height:62px;font-size:28px;margin:0}.portal-card h2{font-size:16px;margin:0}.portal-card p{font-size:9px}.enter{grid-column:1/3;height:38px}.features{grid-template-columns:repeat(2,1fr)}}
`;

export default function ApprovedHomeClient(){
  return <main id="lahooni-home" dir="rtl">
    <style>{css}</style>
    <div className="classroom" aria-hidden="true" />
    <div className="scene">
      <section className="board" aria-label="الواجهة الرئيسية لمنصة أستاذ لحوني التعليمية">
        <div className="identity"><img src="/icons/lahooni-identity-320.jpg" alt="هوية منصة أستاذ لحوني التعليمية"/><div><strong>منصة أستاذ لحوني التعليمية</strong><span>تعليم ذكي • متابعة مترابطة</span></div></div>
        <div className="stage-tag">المرحلة الثانوية • بيئة تعليمية سعودية</div>
        <div className="hero"><div className="kicker">مرحبًا بكم في</div><h1>منصة أستاذ لحوني التعليمية</h1><p>بيئة رقمية حديثة تجمع الإدارة والمعلم والطالب وولي الأمر في تجربة مدرسية واحدة واضحة ومترابطة.</p><div className="hero-rule"/></div>
        <div className="portals-label">اختر بوابتك للدخول</div>
        <section className="cards" aria-label="بوابات الدخول">{portals.map(p=><Link key={p.href} href={p.href} className={`portal-card ${p.cls}`}><div className="card-icon" aria-hidden="true">{p.icon}</div><h2>{p.title}</h2><p>{p.text}</p><div className="enter">{p.action}</div></Link>)}</section>
        <div className="features"><div className="feature"><strong>متابعة ذكية</strong>تحصيل وتقدم</div><div className="feature"><strong>تقارير فورية</strong>مؤشرات واضحة</div><div className="feature"><strong>تواصل مترابط</strong>مدرسة ومعلم وأسرة</div><div className="feature"><strong>بيئة آمنة</strong>خصوصية واستقرار</div></div>
        <div className="footer">تصميم وتنفيذ: <b>أ. حسن علي الطويل</b></div>
      </section>
    </div>
  </main>;
}
