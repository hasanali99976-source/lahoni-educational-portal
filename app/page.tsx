import Link from "next/link";

const portals = [
  { href: "/admin", number: "01", icon: "admin", tone: "admin", title: "بوابة الإدارة", eyebrow: "القيادة والتنظيم", desc: "إدارة الطلاب والفصول والمعلمين والإسناد والتقارير المدرسية.", action: "الدخول إلى الإدارة" },
  { href: "/teacher", number: "02", icon: "teacher", tone: "teacher", title: "بوابة المعلم", eyebrow: "التعليم والمتابعة", desc: "الجدول والتحضير والحضور والتحصيل وسجلات المتابعة في مساحة واحدة.", action: "الدخول إلى المعلم" },
  { href: "/student", number: "03", icon: "student", tone: "student", title: "بوابة الطالب", eyebrow: "الإنجاز والتقدم", desc: "متابعة الحضور والنتائج والاختبارات والتقدم الأكاديمي للطالب وولي الأمر.", action: "الدخول إلى الطالب" },
];

function PortalIcon({ type }: { type: string }) {
  const common = { width: 34, height: 34, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.55, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (type === "admin") return <svg {...common} aria-hidden="true"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 9h.01M15 9h.01M9 12h.01M15 12h.01" /></svg>;
  if (type === "teacher") return <svg {...common} aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4M7 10l3 3 6-6" /></svg>;
  return <svg {...common} aria-hidden="true"><path d="m2 9 10-5 10 5-10 5L2 9ZM6 12v5c3.5 3 8.5 3 12 0v-5M22 9v7" /></svg>;
}

export default function HomePage() {
  return <main className="lah-home" dir="rtl">
    <style>{`
      .lah-home,.lah-home *{box-sizing:border-box}
      .lah-home{--gold:#f3d18b;--muted:#b9cbd1;position:relative;isolation:isolate;min-height:100dvh;overflow:hidden;background:#071b28;color:#fff;font-family:"Tajawal","Noto Kufi Arabic",Tahoma,Arial,sans-serif;padding:24px}
      .lah-home:before{content:"";position:absolute;inset:0;z-index:-2;background:radial-gradient(ellipse at 50% 7%,rgba(36,145,151,.26),transparent 45%),radial-gradient(ellipse at 8% 75%,rgba(211,158,75,.13),transparent 36%),linear-gradient(145deg,#071725 5%,#092b35 52%,#071723 100%)}
      .lah-home:after{content:"";position:absolute;inset:0;z-index:-1;opacity:.28;background-image:linear-gradient(rgba(157,221,222,.11) 1px,transparent 1px),linear-gradient(90deg,rgba(157,221,222,.11) 1px,transparent 1px);background-size:60px 60px;mask-image:linear-gradient(to bottom,transparent,#000 55%,transparent)}
      .lah-shell{width:min(1330px,100%);min-height:calc(100dvh - 48px);margin:auto;border:1px solid rgba(186,221,223,.22);border-radius:30px;overflow:hidden;background:linear-gradient(155deg,rgba(12,48,59,.66),rgba(5,25,37,.82));box-shadow:0 32px 90px rgba(0,0,0,.32);display:flex;flex-direction:column}
      .lah-header{display:flex;justify-content:space-between;align-items:center;gap:18px;padding:22px clamp(20px,4vw,54px);border-bottom:1px solid rgba(255,255,255,.1)}
      .lah-brand{display:flex;align-items:center;gap:14px}.lah-logo{width:60px;height:60px;object-fit:cover;border-radius:18px;border:1px solid rgba(243,209,139,.65);box-shadow:0 0 0 5px rgba(243,209,139,.055)}.lah-brand strong{display:block;font-size:20px;font-weight:900}.lah-brand small{display:block;color:var(--muted);font-size:12px;margin-top:3px}
      .lah-header-note{display:flex;align-items:center;gap:9px;font-size:12px;color:#e9d5a8;letter-spacing:.1px}.lah-header-note i{width:7px;height:7px;background:#e7bf72;border-radius:50%;box-shadow:0 0 12px #e7bf72}
      .lah-main{flex:1;display:flex;flex-direction:column;justify-content:center;padding:clamp(42px,6vw,84px) clamp(18px,5vw,72px) 65px}
      .lah-intro{text-align:center;position:relative}.lah-eyebrow{display:inline-flex;align-items:center;gap:10px;padding:10px 20px;border:1px solid rgba(243,209,139,.3);border-radius:999px;background:rgba(243,209,139,.075);color:#f5dba6;font-size:12px;font-weight:800}.lah-eyebrow:before,.lah-eyebrow:after{content:"✦";font-size:10px}
      .lah-title{margin:25px 0 10px;font-size:clamp(38px,5.5vw,78px);font-weight:950;line-height:1.5;letter-spacing:-1.6px;text-shadow:0 10px 30px rgba(0,0,0,.26)}.lah-title span{display:inline-block;color:var(--gold);background:linear-gradient(180deg,#fff6d9 0%,#f5d48f 42%,#cb9850 100%);background-clip:text;-webkit-background-clip:text;-webkit-text-fill-color:transparent}
      .lah-rule{width:min(350px,72%);height:1px;margin:10px auto 21px;background:linear-gradient(90deg,transparent,#dcb877,transparent)}
      .lah-lead{max-width:730px;margin:0 auto;color:#c5d6d9;font-size:clamp(14px,1.35vw,17px);line-height:2}
      .lah-section-heading{display:flex;align-items:center;justify-content:space-between;gap:20px;margin:62px 0 19px}.lah-section-heading h2{font-size:20px;margin:0;font-weight:900}.lah-section-heading span{font-size:12px;color:#b5c7ca}
      .lah-portals{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}
      .lah-card{position:relative;isolation:isolate;display:flex;flex-direction:column;min-height:295px;padding:28px;border-radius:22px;border:1px solid rgba(152,200,209,.23);color:#fff;text-decoration:none;background:linear-gradient(155deg,rgba(29,70,90,.72),rgba(9,39,57,.92));overflow:hidden;transition:transform .25s,border-color .25s,box-shadow .25s}
      .lah-card.teacher{background:linear-gradient(155deg,rgba(88,68,41,.7),rgba(42,41,37,.92));border-color:rgba(238,192,111,.3)}.lah-card.student{background:linear-gradient(155deg,rgba(19,96,87,.68),rgba(8,50,55,.93));border-color:rgba(115,213,189,.27)}
      .lah-card:before{content:"";position:absolute;z-index:-1;top:-105px;left:-90px;width:260px;height:260px;border-radius:50%;background:radial-gradient(circle,rgba(158,223,225,.12),transparent 70%)}.lah-card:hover,.lah-card:focus-visible{transform:translateY(-6px);border-color:var(--gold);box-shadow:0 20px 45px rgba(0,0,0,.24);outline:none}
      .lah-card-top{display:flex;justify-content:space-between;align-items:flex-start}.lah-icon{display:grid;place-items:center;width:65px;height:65px;border-radius:18px;color:#f5d18c;background:rgba(243,209,139,.1);border:1px solid rgba(243,209,139,.25)}.lah-num{color:rgba(255,255,255,.29);font-size:22px;font-weight:900;direction:ltr}
      .lah-card-label{display:block;margin-top:25px;color:#f4d598;font-size:12px;font-weight:800}.lah-card h3{font-size:27px;margin:7px 0 8px;font-weight:900}.lah-card p{color:#c5d4d7;font-size:13px;line-height:1.85;margin:0 0 24px}
      .lah-card-action{margin-top:auto;display:flex;align-items:center;justify-content:space-between;gap:10px;padding-top:18px;border-top:1px solid rgba(255,255,255,.12);font-size:13px;font-weight:900;color:#f5d99c}.lah-card-action b{display:grid;place-items:center;width:31px;height:31px;border-radius:50%;background:rgba(255,255,255,.09);font-size:18px}
      .lah-footer{padding:20px clamp(20px,4vw,54px);border-top:1px solid rgba(255,255,255,.1);display:flex;align-items:center;justify-content:space-between;gap:15px;color:#9bb5bc;font-size:12px}.lah-footer strong{color:#e5d2a8}
      @media(max-width:850px){.lah-home{padding:9px}.lah-shell{min-height:calc(100dvh - 18px);border-radius:22px}.lah-header{padding:17px}.lah-logo{width:46px;height:46px;border-radius:13px}.lah-brand strong{font-size:16px}.lah-brand small{font-size:10px}.lah-header-note{display:none}.lah-main{padding:40px 18px 38px}.lah-title{font-size:clamp(31px,7.5vw,53px);line-height:1.65;letter-spacing:-.4px}.lah-lead{font-size:13px}.lah-section-heading{margin:40px 0 15px}.lah-section-heading h2{font-size:17px}.lah-section-heading span{font-size:10px}.lah-portals{grid-template-columns:1fr;gap:12px}.lah-card{min-height:0;padding:19px 20px}.lah-card-top{align-items:center}.lah-icon{width:49px;height:49px;border-radius:14px}.lah-icon svg{width:27px;height:27px}.lah-card-label{margin-top:12px}.lah-card h3{font-size:23px;margin:4px 0}.lah-card p{font-size:12px;margin-bottom:14px}.lah-card-action{padding-top:11px}.lah-footer{padding:17px;text-align:center;justify-content:center;flex-wrap:wrap;font-size:10px}}
      @media(max-width:390px){.lah-main{padding-inline:12px}.lah-title{font-size:clamp(27px,7.3vw,34px)}.lah-card{padding:16px}.lah-section-heading span{display:none}}
      @media(prefers-reduced-motion:reduce){.lah-card{transition:none}}
    `}</style>
    <div className="lah-shell">
      <header className="lah-header"><div className="lah-brand"><img className="lah-logo" src="/icons/lahooni-identity-320.jpg" alt="شعار بوابة أستاذ لحوني" /><div><strong>أستاذ لحوني</strong><small>المنصة التعليمية المتكاملة</small></div></div><span className="lah-header-note"><i /> نحو تجربة تعليمية أكثر أثرًا</span></header>
      <div className="lah-main"><section className="lah-intro"><span className="lah-eyebrow">منظومة تعليمية ذكية ومتكاملة</span><h1 className="lah-title">بوابة <span>أستاذ لحوني</span> التعليمية</h1><div className="lah-rule" /><p className="lah-lead">مساحة تعليمية واحدة تجمع الإدارة والمعلم والطالب وولي الأمر؛ لتنظيم العمل المدرسي، ومتابعة الإنجاز، وصناعة أثر تعليمي مستمر.</p></section>
      <div className="lah-section-heading"><h2>اختر بوابتك للمتابعة</h2><span>ثلاث مساحات مترابطة · تجربة واحدة متكاملة</span></div>
      <nav className="lah-portals" aria-label="بوابات الدخول">{portals.map(portal=><Link href={portal.href} className={`lah-card ${portal.tone}`} key={portal.href}><div className="lah-card-top"><span className="lah-icon"><PortalIcon type={portal.icon}/></span><span className="lah-num">{portal.number}</span></div><span className="lah-card-label">{portal.eyebrow}</span><h3>{portal.title}</h3><p>{portal.desc}</p><span className="lah-card-action"><span>{portal.action}</span><b aria-hidden="true">←</b></span></Link>)}</nav></div>
      <footer className="lah-footer"><strong>بوابة أستاذ لحوني التعليمية</strong><span>تعليم منظم · متابعة دقيقة · أثر مستدام</span></footer>
    </div>
  </main>;
}
