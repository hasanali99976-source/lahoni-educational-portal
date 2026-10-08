import Link from "next/link";

const portals=[
 {href:"/admin",icon:"admin",tone:"admin",title:"الإدارة",sub:"إدارة المنصة",desc:"الطلاب، الفصول، المعلمون، الإسناد والتقارير."},
 {href:"/teacher",icon:"teacher",tone:"teacher",title:"المعلم",sub:"مساحة العمل",desc:"الجدول، التحضير، الحضور، التحصيل والمتابعة."},
 {href:"/student",icon:"student",tone:"student",title:"الطالب",sub:"الطالب وولي الأمر",desc:"الحضور، النتائج، الاختبارات والمتابعة الأكاديمية."}
];
function PortalIcon({type}:{type:string}){const c={width:30,height:30,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:1.8,strokeLinecap:"round" as const,strokeLinejoin:"round" as const};if(type==="admin")return <svg {...c}><path d="M4 20V7l8-4 8 4v13M8 20v-5h8v5M8 9h.01M12 9h.01M16 9h.01"/></svg>;if(type==="teacher")return <svg {...c}><path d="M3 5h18v11H3zM7 20h10M12 16v4"/><path d="m8 11 2.2 2L16 8"/></svg>;return <svg {...c}><path d="m3 9 9-5 9 5-9 5zM7 12.2V17c2.8 2.2 7.2 2.2 10 0v-4.8M21 9v6"/></svg>}
export default function HomePage(){return <main className="new-home" dir="rtl"><style>{`
*{box-sizing:border-box}.new-home{min-height:100dvh;background:#061923;color:#fff;font-family:"Tajawal","Segoe UI",Tahoma,Arial,sans-serif;padding:14px;position:relative;overflow:hidden}.new-home:before{content:"";position:fixed;inset:0;background:linear-gradient(180deg,rgba(3,18,29,.48),rgba(4,26,39,.60)),url('https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&fm=jpg&q=90&w=2400') center/cover no-repeat;pointer-events:none}.shell{width:min(1320px,100%);min-height:calc(100dvh - 28px);margin:auto;position:relative;display:flex;flex-direction:column;border:1px solid rgba(255,255,255,.10);border-radius:28px;background:rgba(3,25,37,.28);box-shadow:none;backdrop-filter:blur(3px);overflow:hidden}.top{height:76px;padding:0 28px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.08)}.brand{display:flex;align-items:center;gap:11px}.brand img{width:46px;height:46px;border-radius:14px;object-fit:cover;border:1px solid rgba(239,199,105,.65)}.brand b{font-size:16px;font-weight:800;letter-spacing:-.25px}.brand small{display:block;color:#a9bdc3;margin-top:2px;font-size:9px}.live{font-size:9px;color:#f0d07b;border:1px solid rgba(239,199,105,.20);background:rgba(239,199,105,.07);padding:8px 12px;border-radius:999px}.hero{flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:clamp(34px,5vw,68px);text-align:center}.intro{padding:0;max-width:820px;border:0}.kicker{display:inline-flex;padding:7px 13px;border-radius:999px;border:1px solid rgba(239,199,105,.18);background:rgba(239,199,105,.07);color:#f1d58e;font-size:10px;font-weight:800}.intro h1{font-size:clamp(40px,5.4vw,68px);line-height:1.12;margin:16px 0 14px;letter-spacing:-1.2px;font-weight:900}.intro h1 span{display:inline;color:inherit;font-weight:inherit;margin-right:0}.intro p{max-width:720px;color:#c0d1d5;line-height:1.9;font-size:13px;margin:auto}.signature{margin-top:16px;color:#819ba3;font-size:9px}.spaces{width:min(1000px,100%);display:grid;grid-template-columns:repeat(3,minmax(0,1fr));padding:34px 0 0;gap:12px}.space{color:#fff;text-decoration:none;min-height:150px;padding:20px 18px;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;text-align:right;gap:8px;border:1px solid rgba(255,255,255,.12);border-radius:18px;background:linear-gradient(145deg,rgba(8,76,82,.72),rgba(12,112,99,.58));transition:.22s;position:relative;overflow:hidden}.space.admin{background:linear-gradient(145deg,rgba(28,70,112,.76),rgba(20,54,82,.70));border-color:rgba(111,176,232,.24)}.space.teacher{background:linear-gradient(145deg,rgba(112,77,26,.74),rgba(77,55,25,.70));border-color:rgba(239,199,105,.25)}.space.student{background:linear-gradient(145deg,rgba(17,105,87,.76),rgba(13,71,68,.70));border-color:rgba(104,218,184,.24)}.space:hover{transform:translateY(-3px);border-color:rgba(239,199,105,.30);background:linear-gradient(145deg,rgba(5,46,59,.82),rgba(11,91,85,.48))}.portal-icon{width:44px;height:44px;border-radius:13px;display:grid;place-items:center;color:#f0d17b;background:rgba(239,199,105,.09);border:1px solid rgba(239,199,105,.16)}.portal-icon svg{width:23px;height:23px}.space h2{font-size:23px;margin:1px 0;font-weight:900;letter-spacing:-.4px}.space strong{font-size:8px;color:#e2bf6e}.space p{margin:1px 0 0;color:#afc3c8;font-size:9px;line-height:1.65}.arrow{position:absolute;left:16px;top:16px;width:32px;height:32px;border-radius:10px;border:1px solid rgba(255,255,255,.11);display:grid;place-items:center;font-size:15px;color:#d9e5e7}.space:hover .arrow{background:#c78d31;border-color:#e2b75e;color:#17353e}.foot{height:52px;padding:0 28px;border-top:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:space-between;color:#718b94;font-size:9px}.foot b{color:#9fb5ba}@media(max-width:850px){.new-home{padding:7px}.shell{min-height:calc(100dvh - 14px);border-radius:22px}.top{height:68px;padding:0 16px}.brand img{width:40px;height:40px}.live{display:none}.hero{padding:30px 16px}.intro h1{font-size:42px}.intro h1 span{display:block;margin:5px 0 0}.spaces{grid-template-columns:1fr;padding-top:24px;gap:9px}.space{min-height:105px;padding:14px 15px;display:grid;grid-template-columns:40px 1fr 30px;align-items:center;gap:10px}.portal-icon{width:40px;height:40px}.space h2{font-size:20px}.space p{font-size:8px}.arrow{position:static;width:30px;height:30px}.foot{padding:13px 16px;height:auto;display:block;text-align:center}.foot span{display:block;margin-top:3px}}
/* Homepage visual system: luminous academic identity */
.new-home{background:#03151e;padding:10px}
.new-home:before{background:linear-gradient(110deg,rgba(2,16,28,.89),rgba(2,27,37,.63) 48%,rgba(2,15,27,.85)),url('https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&fm=jpg&q=90&w=2400') center/cover no-repeat;filter:saturate(.88)}
.new-home:after{content:"";position:fixed;inset:-25%;pointer-events:none;background:radial-gradient(ellipse at 53% 34%,rgba(47,198,188,.18),transparent 33%),radial-gradient(ellipse at 76% 68%,rgba(226,169,66,.13),transparent 28%);animation:homeAura 13s ease-in-out infinite alternate}
.shell{width:min(1450px,100%);min-height:calc(100dvh - 20px);border:1px solid rgba(166,227,219,.21);background:linear-gradient(160deg,rgba(2,27,39,.42),rgba(3,26,38,.64));box-shadow:0 24px 85px rgba(0,0,0,.38),inset 0 1px rgba(255,255,255,.09);backdrop-filter:blur(9px)}
.top{height:76px;border-bottom-color:rgba(155,225,216,.18);background:rgba(3,28,39,.48)}
.brand img{width:51px;height:51px;border-radius:15px;border:2px solid rgba(240,200,109,.7);box-shadow:0 0 20px rgba(239,193,82,.19)}
.brand b{font-size:19px;font-weight:900;color:#fff}.brand small{font-size:11px;color:#b7d9da}
.live{display:inline-flex;align-items:center;gap:8px;color:#f7db92;font-size:11px;border-color:rgba(243,200,102,.38);background:rgba(242,197,91,.10)}
.live-dot{width:8px;height:8px;background:#e8c76a;border-radius:50%;box-shadow:0 0 13px #f3ce6b;animation:homePulse 2.5s ease-in-out infinite}
.hero{position:relative;z-index:1;padding:clamp(32px,5vw,70px) 24px 42px}
.intro{max-width:1100px}
.kicker{font-size:12px;letter-spacing:.2px;padding:9px 19px;background:rgba(223,175,77,.13);border-color:rgba(246,206,124,.38);box-shadow:0 0 22px rgba(226,179,76,.09)}
.intro h1{margin:18px 0 10px;font-size:clamp(43px,5.7vw,82px);line-height:1.23;letter-spacing:-1.6px;font-weight:950;text-wrap:balance;text-shadow:0 5px 22px rgba(0,0,0,.36)}
.intro h1 .hero-title-top,.intro h1 .hero-title-bottom{display:block}
.intro h1 .hero-title-top{color:#fff}
.intro h1 .hero-title-bottom{font-size:.83em;color:#f3d184;text-shadow:0 0 28px rgba(242,191,80,.23),0 4px 22px rgba(0,0,0,.4)}
.hero-divider{display:flex;align-items:center;justify-content:center;gap:14px;margin:13px auto 12px;color:#d7eced;font-size:12px;font-weight:800}
.hero-divider i{height:1px;width:clamp(25px,7vw,100px);background:linear-gradient(90deg,transparent,#e6c474,transparent)}
.intro p{font-size:14px;line-height:1.9;color:#d0e4e5;max-width:740px}
.spaces{width:min(1110px,100%);gap:16px;padding-top:34px}
.space,.space.admin,.space.teacher,.space.student{min-height:185px;padding:22px 22px 20px;background:linear-gradient(145deg,rgba(9,55,72,.95),rgba(5,36,53,.87));border:1px solid rgba(136,207,217,.31);box-shadow:0 12px 35px rgba(0,0,0,.24),inset 0 1px rgba(255,255,255,.09);transition:transform .25s ease,border-color .25s ease,box-shadow .25s ease}
.space.teacher{background:linear-gradient(145deg,rgba(81,63,35,.95),rgba(49,41,32,.88));border-color:rgba(235,192,111,.43)}
.space.student{background:linear-gradient(145deg,rgba(7,80,76,.96),rgba(4,50,53,.90));border-color:rgba(95,221,187,.4)}
.space:before{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 15%,rgba(255,255,255,.09) 48%,transparent 80%);transform:translateX(130%);transition:transform .65s ease;pointer-events:none}
.space:hover:before{transform:translateX(-130%)}
.space:hover{transform:translateY(-6px);border-color:#f1cd78;box-shadow:0 17px 42px rgba(0,0,0,.32),0 0 24px rgba(102,219,203,.13)}
.portal-icon{width:51px;height:51px;border-radius:15px;background:rgba(238,196,105,.13);border-color:rgba(239,203,127,.34);box-shadow:0 0 22px rgba(241,196,93,.08)}
.portal-icon svg{width:28px;height:28px}
.space h2{font-size:28px;line-height:1.2;color:#fff}.space strong{font-size:12px;color:#f6d581}.space p{font-size:12px;line-height:1.8;color:#d3e1e3}
.arrow{border-color:rgba(205,233,230,.3);color:#f3d080}
.foot{height:56px;background:rgba(2,22,33,.48);color:#b7ced0;font-size:11px}.foot b{color:#e8cf8e}
@keyframes homePulse{50%{opacity:.45;box-shadow:0 0 4px #f3ce6b}}
@keyframes homeAura{to{transform:translate(4%,2%) scale(1.05)}}
@media(prefers-reduced-motion:reduce){.new-home:after,.live-dot{animation:none}.space,.space:before{transition:none}}
@media(max-width:850px){.top{height:70px;padding:0 16px}.brand img{width:43px;height:43px}.brand b{font-size:16px}.brand small{font-size:9px}.live{display:none}.hero{padding:34px 16px}.intro h1{font-size:clamp(37px,8vw,57px)}.intro p{font-size:12px}.spaces{grid-template-columns:1fr;padding-top:25px;gap:10px}.space,.space.admin,.space.teacher,.space.student{min-height:110px;padding:15px;display:grid;grid-template-columns:46px 1fr 32px;gap:12px}.portal-icon{width:43px;height:43px}.space h2{font-size:22px}.space strong{font-size:10px}.space p{font-size:10px}.foot{height:auto}}

/* Signature illuminated Arabic portal title */
.hero-title-frame{position:relative;isolation:isolate;padding:18px 42px 23px;margin:8px auto 4px;width:fit-content;max-width:100%;border-radius:35px}
.hero-title-frame:before{content:"";position:absolute;inset:2% -7%;z-index:-2;border-radius:50%;background:radial-gradient(ellipse,rgba(35,203,209,.21),rgba(238,186,76,.10) 45%,transparent 73%);filter:blur(24px);animation:titleBreath 5s ease-in-out infinite alternate}
.hero-title-frame:after{content:"";position:absolute;inset:auto 8% 0;height:2px;background:linear-gradient(90deg,transparent,#f3c967 28%,#fff4bf 50%,#f3c967 72%,transparent);box-shadow:0 0 17px #e7bd5c,0 0 30px rgba(86,229,224,.6)}
.intro .hero-title-frame h1{position:relative;margin:0;font-family:"Tajawal","Cairo","Noto Kufi Arabic",Tahoma,sans-serif;font-weight:1000;font-size:clamp(45px,6.1vw,91px);line-height:1.42;letter-spacing:-2.4px;filter:drop-shadow(0 8px 14px rgba(0,0,0,.46))}
.intro .hero-title-frame h1 .hero-title-top{display:block;color:#f7ffff;text-shadow:0 0 7px rgba(255,255,255,.46),0 0 30px rgba(64,227,223,.31),0 5px 3px #042c39}
.intro .hero-title-frame h1 .hero-title-top em{font-style:normal;display:inline-block;background:linear-gradient(170deg,#fffef0 4%,#f7d878 30%,#fff5c2 48%,#d39c3b 75%,#fff1ac 96%);background-clip:text;-webkit-background-clip:text;color:transparent;-webkit-text-fill-color:transparent;filter:drop-shadow(0 0 12px rgba(239,191,81,.42))}
.intro .hero-title-frame h1 .hero-title-bottom{display:block;font-size:.77em;letter-spacing:2px;color:#eaffff;text-shadow:0 0 8px rgba(255,255,255,.4),0 0 23px rgba(47,214,221,.6),0 5px 3px #073844}
.title-orbit{position:absolute;inset:15% -5%;border:1px solid rgba(121,227,227,.25);border-radius:50%;transform:rotate(-8deg);pointer-events:none;z-index:-1;box-shadow:0 0 19px rgba(46,201,213,.08)}
.title-orbit-two{inset:22% -9%;border-color:rgba(240,195,101,.21);transform:rotate(9deg)}
.title-star{position:absolute;color:#ffe5a0;text-shadow:0 0 12px #ffe08b,0 0 25px #f4c45e;animation:starTwinkle 3s ease-in-out infinite}
.title-star-one{top:10%;left:0;font-size:27px}.title-star-two{right:0;bottom:12%;font-size:23px;animation-delay:1s}
@keyframes titleBreath{to{opacity:.6;transform:scale(1.09)}}@keyframes starTwinkle{50%{opacity:.35;transform:scale(.8)}}
@media(max-width:850px){.hero-title-frame{padding:12px 12px 19px}.intro .hero-title-frame h1{font-size:clamp(36px,8vw,62px);line-height:1.5;letter-spacing:-1.2px}.intro .hero-title-frame h1 .hero-title-bottom{letter-spacing:0}.title-orbit{inset:18% -2%}.title-orbit-two{inset:24% -4%}.title-star-one{font-size:16px}.title-star-two{font-size:14px}}
@media(prefers-reduced-motion:reduce){.hero-title-frame:before,.title-star{animation:none}}

/* Mobile and installed-app viewport safety: no clipped portal content */
.new-home{width:100%;max-width:100%;overflow-x:clip;overflow-y:visible}
.new-home .shell{height:auto;min-height:calc(100dvh - 20px);overflow:visible}
.new-home .hero,.new-home .intro,.new-home .spaces,.new-home .space{min-width:0}
@media(max-width:850px){
.new-home{padding:6px;min-height:100dvh;overflow-x:hidden;overflow-y:auto}
.new-home .shell{min-height:calc(100dvh - 12px);height:auto;border-radius:17px;overflow:visible}
.new-home .top{flex:0 0 auto;min-height:62px;height:auto;padding:10px 13px}
.new-home .hero{flex:1 0 auto;justify-content:flex-start;padding:24px 12px 26px;gap:0}
.new-home .intro{width:100%;max-width:100%;padding:0 2px}
.new-home .kicker{font-size:10px;padding:7px 12px}
.new-home .hero-title-frame{width:100%;max-width:100%;padding:14px 4px 16px;margin:7px auto}
.new-home .intro .hero-title-frame h1{font-size:clamp(27px,7.3vw,52px);line-height:1.4;letter-spacing:-.6px;overflow-wrap:anywhere}
.new-home .intro .hero-title-frame h1 .hero-title-top,.new-home .intro .hero-title-frame h1 .hero-title-bottom{display:block;max-width:100%}
.new-home .title-orbit{inset:19% 0}.new-home .title-orbit-two{inset:24% 1%}
.new-home .title-star-one{left:3%}.new-home .title-star-two{right:3%}
.new-home .hero-divider{gap:7px;margin:10px auto;font-size:10px}
.new-home .hero-divider i{width:22px;flex:0 0 22px}
.new-home .intro p{font-size:11px;line-height:1.75;padding:0 5px}
.new-home .spaces{width:100%;display:grid;grid-template-columns:minmax(0,1fr);gap:9px;padding:21px 0 0}
.new-home .space,.new-home .space.admin,.new-home .space.teacher,.new-home .space.student{width:100%;max-width:100%;min-height:102px;display:grid;grid-template-columns:42px minmax(0,1fr) 28px;align-items:center;gap:10px;padding:12px;border-radius:14px}
.new-home .space>div{min-width:0}
.new-home .space h2{font-size:20px;margin:2px 0}
.new-home .space p{font-size:10px;line-height:1.55;overflow-wrap:anywhere}
.new-home .portal-icon{width:40px;height:40px}
.new-home .arrow{width:28px;height:28px}
.new-home .foot{flex:0 0 auto;min-height:54px;padding:12px;text-align:center}
}
@media(max-width:380px){
.new-home .hero{padding:18px 9px 20px}
.new-home .intro .hero-title-frame h1{font-size:clamp(25px,7vw,31px)}
.new-home .space,.new-home .space.admin,.new-home .space.teacher,.new-home .space.student{grid-template-columns:36px minmax(0,1fr) 24px;gap:8px;padding:10px}
.new-home .portal-icon{width:36px;height:36px}
.new-home .space h2{font-size:18px}
.new-home .space p{font-size:9px}
}
@media(display-mode:standalone){.new-home{min-height:100dvh;padding-bottom:env(safe-area-inset-bottom,0px)}.new-home .shell{min-height:calc(100dvh - 12px)}}

/* Complete-name masthead, restrained luminous typography, responsive without clipping */
.new-home .hero-title-frame{width:min(100%,1080px);padding:20px 12px 22px;border-radius:18px;background:linear-gradient(100deg,rgba(4,45,56,.38),rgba(9,61,68,.19),rgba(4,45,56,.38));border:1px solid rgba(207,230,221,.18)}
.new-home .hero-title-frame:before{inset:0;background:radial-gradient(ellipse at center,rgba(22,171,174,.2),transparent 72%);filter:blur(14px)}
.new-home .intro .hero-title-frame h1{font-family:"Tajawal","Noto Kufi Arabic",Tahoma,sans-serif;font-size:clamp(32px,5.4vw,74px);line-height:1.5;letter-spacing:-.5px;filter:none}
.new-home .intro .hero-title-frame h1 .hero-title-top,.new-home .intro .hero-title-frame h1 .hero-title-bottom{color:#fff;font-size:1em;letter-spacing:0;text-shadow:0 0 19px rgba(89,226,216,.35),0 5px 16px rgba(0,0,0,.45)}
.new-home .intro .hero-title-frame h1 .hero-title-top em{background:linear-gradient(180deg,#fff7d9,#eec46c 68%,#fff2c4);background-clip:text;-webkit-background-clip:text;-webkit-text-fill-color:transparent;filter:drop-shadow(0 0 9px rgba(243,201,109,.22))}
.new-home .intro .hero-title-frame h1 .hero-title-bottom{color:#e5faf8;font-size:.72em}
@media(max-width:850px){
.new-home .shell{overflow:visible!important}
.new-home .hero-title-frame{padding:12px 6px 16px!important;margin:9px auto!important}
.new-home .intro .hero-title-frame h1{font-size:clamp(25px,6.5vw,46px)!important;line-height:1.5!important;letter-spacing:0!important;overflow-wrap:normal!important;word-break:normal!important}
.new-home .intro .hero-title-frame h1 .hero-title-top{white-space:normal}
.new-home .intro .hero-title-frame h1 .hero-title-bottom{font-size:.8em!important}
.new-home .spaces{max-width:100%;min-width:0}
}
@media(max-width:380px){.new-home .intro .hero-title-frame h1{font-size:clamp(23px,6.2vw,27px)!important}}
`}</style><div className="shell"><header className="top"><div className="brand"><img src="/icons/lahooni-identity-320.jpg" alt="شعار البوابة"/><div><b>أستاذ لحوني</b><small>المنصة التعليمية</small></div></div><span className="live"><i className="live-dot"/> بوابتك التعليمية</span></header><section className="hero"><div className="intro"><span className="kicker">منصة مدرسية متكاملة</span><div className="hero-title-frame"><h1><span className="hero-title-top">بوابة <em>أستاذ لحوني</em></span><span className="hero-title-bottom">التعليمية</span></h1></div><div className="hero-divider"><i/><span>تعليم أكثر تنظيمًا · متابعة أكثر أثرًا</span><i/></div><p>مساحات واضحة ومتكاملة للإدارة والمعلم والطالب، بهوية موحدة وتجربة مصممة للعمل اليومي على الجوال والويب.</p></div><div className="spaces">{portals.map(p=><Link href={p.href} className={`space ${p.tone}`} key={p.href}><span className="portal-icon"><PortalIcon type={p.icon}/></span><div><strong>{p.sub}</strong><h2>{p.title}</h2><p>{p.desc}</p></div><span className="arrow">←</span></Link>)}</div></section><footer className="foot"><b>بوابة أستاذ لحوني التعليمية</b><span>إدارة · معلم · طالب وولي أمر</span></footer></div></main>}
