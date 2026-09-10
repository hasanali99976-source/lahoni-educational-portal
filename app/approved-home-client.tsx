"use client";

import Link from "next/link";

const portals = [
  { href: "/admin", cls: "admin", icon: "⌘", title: "بوابة الإدارة", text: "إدارة المنصة والبيانات والتقارير من مركز واحد", action: "دخول الإدارة" },
  { href: "/teacher", cls: "teacher", icon: "✦", title: "بوابة المعلم", text: "متابعة الطلاب والتحصيل والحضور والخطط التعليمية", action: "دخول المعلم" },
  { href: "/student", cls: "student", icon: "◈", title: "بوابة الطالب وولي الأمر", text: "متابعة التحصيل والملاحظات والحضور والتقدم الدراسي", action: "دخول الطالب / ولي الأمر" },
] as const;

const features = [
  ["01", "متابعة ذكية", "للتحصيل والتقدم"],
  ["02", "تقارير فورية", "مؤشرات واضحة"],
  ["03", "تواصل مترابط", "مدرسة ومعلم وأسرة"],
  ["04", "بيانات آمنة", "وخصوصية عالية"],
] as const;

const classroomPhoto = "https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&fm=jpg&q=92&w=2400";

const css = `
#lahooni-home{min-height:100dvh;direction:rtl;position:relative;overflow-x:hidden;color:#102d43;background:#071c2d;font-family:inherit}
#lahooni-home *{box-sizing:border-box}
.real-bg{position:fixed;inset:0;z-index:0;background-image:linear-gradient(90deg,rgba(5,25,40,.70),rgba(5,25,40,.17) 30%,rgba(5,25,40,.10) 70%,rgba(5,25,40,.64)),linear-gradient(180deg,rgba(4,22,36,.12),rgba(4,22,36,.28)),url('${classroomPhoto}');background-size:cover;background-position:center 48%;filter:saturate(1.05) contrast(1.1) brightness(.94)}
.real-bg:after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 50% 38%,rgba(255,255,255,.12),transparent 38%),linear-gradient(180deg,transparent 60%,rgba(4,22,36,.38));}
.home-shell{position:relative;z-index:2;width:min(1120px,94vw);margin:0 auto;padding:18px 0 0;min-height:100dvh;display:flex;flex-direction:column}
.platform-panel{position:relative;overflow:hidden;border-radius:34px;background:linear-gradient(145deg,rgba(246,250,252,.77),rgba(232,241,246,.62));border:1px solid rgba(255,255,255,.66);backdrop-filter:blur(17px) saturate(1.15);box-shadow:0 30px 70px rgba(2,17,29,.28),inset 0 1px rgba(255,255,255,.9)}
.platform-panel:before{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(115deg,rgba(255,255,255,.34),transparent 25%,transparent 70%,rgba(218,174,84,.08))}
.topbar{position:relative;z-index:2;min-height:72px;padding:8px 15px;display:flex;align-items:center;justify-content:space-between;gap:18px;background:linear-gradient(135deg,rgba(5,39,64,.97),rgba(5,27,45,.95));border-bottom:1px solid rgba(215,173,83,.35)}
.brand{display:flex;align-items:center;gap:11px;color:#fff}.brand img{width:54px;height:54px;border-radius:50%;object-fit:cover;border:2px solid #ddb45f;box-shadow:0 7px 18px rgba(0,0,0,.27)}.brand strong{display:block;font-size:15px;font-weight:950}.brand span{display:block;font-size:10px;color:#cddae2;margin-top:2px}.smart-badge{padding:9px 15px;border-radius:18px;background:rgba(255,255,255,.08);border:1px solid rgba(232,193,111,.28);color:#f0cd84;font-size:10px;font-weight:900;letter-spacing:.1px}
.hero{position:relative;z-index:2;text-align:center;padding:22px 15px 17px}.hero-eyebrow{display:inline-flex;align-items:center;gap:7px;padding:6px 12px;border-radius:16px;background:rgba(9,54,82,.07);border:1px solid rgba(9,54,82,.10);font-size:10px;font-weight:900;color:#28536d}.hero-eyebrow:before{content:"";width:7px;height:7px;border-radius:50%;background:#c99738;box-shadow:0 0 0 4px rgba(201,151,56,.12)}.hero h1{margin:8px 0 0;font-size:clamp(30px,4vw,47px);line-height:1.12;font-weight:950;letter-spacing:-1px;color:#0a3552}.hero h1 em{font-style:normal;color:#b57b20}.hero p{margin:8px auto 0;max-width:620px;color:#405968;font-size:12px;line-height:1.8;font-weight:700}.hero-rule{width:88px;height:3px;margin:11px auto 0;border-radius:8px;background:linear-gradient(90deg,transparent,#c9983e,transparent)}
.cards{position:relative;z-index:2;display:grid;grid-template-columns:repeat(3,1fr);gap:14px;padding:0 20px;direction:ltr}.portal-card{direction:rtl;position:relative;overflow:hidden;min-height:258px;padding:19px 16px 15px;border-radius:25px;text-decoration:none;color:#102d43;display:flex;flex-direction:column;align-items:center;text-align:center;border:1px solid rgba(255,255,255,.72);box-shadow:0 16px 30px rgba(5,35,53,.13),inset 0 1px rgba(255,255,255,.9);transition:.23s ease;transform:translateZ(0)}.portal-card:hover{transform:translateY(-6px);box-shadow:0 24px 38px rgba(5,35,53,.21)}.portal-card:after{content:"";position:absolute;width:160px;height:70px;left:-50px;top:-25px;transform:rotate(-24deg);background:rgba(255,255,255,.28);filter:blur(4px)}.admin{background:linear-gradient(145deg,rgba(255,249,235,.91),rgba(238,216,174,.82))}.teacher{background:linear-gradient(145deg,rgba(232,247,255,.92),rgba(183,220,244,.82))}.student{background:linear-gradient(145deg,rgba(232,255,248,.92),rgba(181,229,212,.82))}
.card-icon{width:78px;height:78px;border-radius:22px;display:grid;place-items:center;margin-bottom:9px;font-size:34px;font-weight:900;background:linear-gradient(145deg,rgba(255,255,255,.82),rgba(255,255,255,.25));border:1px solid rgba(255,255,255,.78);box-shadow:0 13px 24px rgba(5,35,53,.14),inset 0 1px #fff}.admin .card-icon{color:#9d6b16}.teacher .card-icon{color:#12669c}.student .card-icon{color:#08795b}.portal-card h2{margin:1px 0 6px;font-size:19px;font-weight:950}.portal-card p{margin:0;max-width:260px;font-size:10.5px;line-height:1.75;color:#405462;font-weight:700}.enter-btn{margin-top:auto;width:100%;height:41px;border-radius:21px;color:#fff;font-size:11px;font-weight:900;display:flex;align-items:center;justify-content:center;gap:7px;box-shadow:0 8px 16px rgba(0,0,0,.14)}.enter-btn:after{content:"←";font-size:16px}.admin .enter-btn{background:linear-gradient(90deg,#936117,#bc8730)}.teacher .enter-btn{background:linear-gradient(90deg,#075183,#0873ad)}.student .enter-btn{background:linear-gradient(90deg,#006b50,#0a8b69)}
.features{position:relative;z-index:2;width:calc(100% - 40px);margin:14px 20px 20px;display:grid;grid-template-columns:repeat(4,1fr);overflow:hidden;border-radius:20px;background:rgba(255,255,255,.52);border:1px solid rgba(255,255,255,.66);box-shadow:0 12px 25px rgba(5,35,53,.08)}.feature{padding:10px 8px;text-align:center;border-left:1px solid rgba(11,54,81,.09);font-size:9px;color:#557080;line-height:1.5}.feature:last-child{border-left:0}.feature b{display:block;margin:auto auto 4px;width:25px;height:25px;line-height:25px;border-radius:9px;background:#0b3a59;color:#edca83;font-size:8px}.feature strong{display:block;color:#173d56;font-size:10px}
.footer{margin-top:13px;padding:10px 17px;border-radius:22px 22px 0 0;background:linear-gradient(135deg,rgba(5,39,64,.95),rgba(5,27,45,.96));color:#eaf0f3;display:flex;justify-content:space-between;align-items:center;gap:15px;font-size:9px;box-shadow:0 -8px 25px rgba(2,17,29,.13)}.footer strong{color:#efca7c}.values{display:flex;gap:12px;flex-wrap:wrap}.values b{color:#dcb05c;margin-left:3px}
@media(max-width:760px){.home-shell{width:min(96vw,620px);padding-top:8px}.platform-panel{border-radius:25px}.smart-badge{display:none}.topbar{min-height:62px}.brand img{width:46px;height:46px}.brand strong{font-size:13px}.brand span{display:none}.hero{padding:17px 8px 13px}.hero h1{font-size:28px}.hero p{font-size:10px}.cards{grid-template-columns:1fr;padding:0 12px;direction:rtl}.portal-card{min-height:145px;display:grid;grid-template-columns:62px 1fr;grid-template-rows:auto auto 39px;text-align:right;column-gap:10px;padding:12px}.card-icon{grid-row:1/3;width:62px;height:62px;font-size:28px;margin:0}.portal-card h2{font-size:16px;margin:0}.portal-card p{font-size:9px}.enter-btn{grid-column:1/3;height:39px}.features{width:calc(100% - 24px);margin:11px 12px 13px;grid-template-columns:repeat(2,1fr)}.footer{flex-direction:column;text-align:center}.values{justify-content:center}}
`;

export default function ApprovedHomeClient(){
  return <main id="lahooni-home" dir="rtl">
    <style>{css}</style>
    <div className="real-bg" aria-hidden="true" />
    <div className="home-shell">
      <section className="platform-panel">
        <header className="topbar">
          <div className="brand"><img src="/icons/lahooni-identity-320.jpg" alt="شعار منصة أستاذ لحوني التعليمية"/><div><strong>منصة أستاذ لحوني التعليمية</strong><span>منظومة رقمية مترابطة للتعليم والمتابعة</span></div></div>
          <div className="smart-badge">منصة تعليمية ذكية • 1448 هـ</div>
        </header>
        <div className="hero">
          <div className="hero-eyebrow">بيئة مدرسية رقمية متكاملة</div>
          <h1>أستاذ لحوني <em>التعليمية</em></h1>
          <p>بوابة موحدة تربط الإدارة والمعلم والطالب وولي الأمر لمتابعة الأداء والتحصيل والتواصل بوضوح وسهولة.</p>
          <div className="hero-rule"/>
        </div>
        <section className="cards" aria-label="بوابات الدخول">
          {portals.map(p=><Link key={p.href} href={p.href} className={`portal-card ${p.cls}`}><div className="card-icon" aria-hidden="true">{p.icon}</div><h2>{p.title}</h2><p>{p.text}</p><div className="enter-btn">{p.action}</div></Link>)}
        </section>
        <div className="features" aria-label="مزايا المنصة">{features.map(([n,t,s])=><div className="feature" key={t}><b>{n}</b><strong>{t}</strong>{s}</div>)}</div>
      </section>
      <footer className="footer"><div><strong>بوابة أستاذ لحوني التعليمية</strong><span>إعداد وتطوير: أ. حسن علي الطويل</span></div><div className="values"><span><b>◆</b>تعليم</span><span><b>◆</b>متابعة</span><span><b>◆</b>تواصل</span><span><b>◆</b>تميّز</span></div></footer>
    </div>
  </main>;
}
