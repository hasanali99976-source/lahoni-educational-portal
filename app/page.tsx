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

/* One integrated full-name wordmark; no detached plaque or animation */
.new-home .intro{max-width:1120px;width:100%}
.new-home .portal-wordmark{position:relative;isolation:isolate;display:block;width:100%;max-width:1100px;margin:14px auto 12px;padding:10px 0 18px;border:0;background:none;font-family:"Tajawal","Noto Kufi Arabic",Tahoma,sans-serif;font-size:clamp(34px,5.5vw,79px);font-weight:950;line-height:1.55;letter-spacing:-1px;color:#fff;text-wrap:balance;text-shadow:0 3px 3px rgba(0,0,0,.6),0 0 25px rgba(62,221,213,.27)}
.new-home .portal-wordmark:before{content:"";position:absolute;z-index:-1;inset:8% 4%;border-radius:50%;background:radial-gradient(ellipse,rgba(19,163,161,.25),rgba(217,169,66,.08) 46%,transparent 74%);filter:blur(23px);pointer-events:none}
.new-home .portal-wordmark span{color:#ffe1a0;text-shadow:0 3px 3px rgba(0,0,0,.5),0 0 16px rgba(245,194,87,.55),0 0 40px rgba(245,194,87,.25)}
.new-home .hero-divider{margin-top:2px}
@media(max-width:850px){.new-home .portal-wordmark{font-size:clamp(28px,6.4vw,52px);line-height:1.55;letter-spacing:0;padding:7px 0 12px;margin:12px auto}.new-home .hero{padding-top:18px}}
@media(max-width:390px){.new-home .portal-wordmark{font-size:clamp(25px,6.5vw,29px)}}
@media(prefers-reduced-motion:reduce){.new-home .portal-wordmark:before{animation:none}}

/* Academic prestige refinement: keep the original photographic backdrop */
.new-home:before{background:linear-gradient(110deg,rgba(2,15,26,.69),rgba(3,32,44,.34) 48%,rgba(2,17,29,.75)),url('https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&fm=jpg&q=90&w=2400') center/cover no-repeat;filter:saturate(1.06) contrast(1.08)}
.new-home .shell{border-color:rgba(243,207,130,.36);box-shadow:0 25px 95px rgba(0,0,0,.44),0 0 65px rgba(33,178,177,.12),inset 0 1px rgba(255,255,255,.15)}
.new-home .top{background:linear-gradient(90deg,rgba(5,39,52,.85),rgba(8,34,46,.5));border-bottom:1px solid rgba(240,203,119,.23)}
.new-home .brand img{box-shadow:0 0 0 4px rgba(238,195,105,.1),0 0 28px rgba(236,193,99,.3)}
.new-home .kicker{font-size:13px;border-color:rgba(244,208,135,.6);box-shadow:0 0 28px rgba(245,199,94,.14);letter-spacing:.3px}
.new-home .portal-wordmark{font-weight:1000;filter:drop-shadow(0 6px 12px rgba(0,0,0,.45))}
.new-home .portal-wordmark span{background:linear-gradient(180deg,#fff7d3,#f3ce75 44%,#d19c42 85%,#fff0b7);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;filter:drop-shadow(0 0 14px rgba(244,201,104,.4))}
.new-home .intro p{font-size:clamp(13px,1.25vw,16px);font-weight:600;color:#e0f0f0;text-shadow:0 2px 9px rgba(0,0,0,.55)}
.new-home .spaces{gap:18px}
.new-home .space,.new-home .space.admin,.new-home .space.teacher,.new-home .space.student{border-radius:22px;box-shadow:0 14px 36px rgba(0,0,0,.38),inset 0 1px rgba(255,255,255,.13);border-width:1px}
.new-home .space.admin{background:linear-gradient(135deg,rgba(13,76,108,.93),rgba(8,34,57,.91));border-color:rgba(123,204,241,.55)}
.new-home .space.teacher{background:linear-gradient(135deg,rgba(119,81,32,.92),rgba(56,43,28,.92));border-color:rgba(255,211,125,.57)}
.new-home .space.student{background:linear-gradient(135deg,rgba(12,117,97,.91),rgba(6,56,57,.94));border-color:rgba(106,236,195,.53)}
.new-home .portal-icon{width:58px;height:58px;border-radius:17px;background:linear-gradient(145deg,rgba(255,232,167,.24),rgba(226,166,68,.07));border:1px solid rgba(255,222,149,.55);box-shadow:0 7px 20px rgba(0,0,0,.17),inset 0 1px rgba(255,255,255,.2)}
.new-home .portal-icon svg{width:32px;height:32px;stroke-width:1.9}
.new-home .space h2{font-size:clamp(24px,2.5vw,31px);font-weight:950}
.new-home .space strong{font-size:13px;letter-spacing:.1px}
.new-home .space p{font-size:13px;line-height:1.8;color:#e2eff0}
.new-home .arrow{background:rgba(255,255,255,.08);border-color:rgba(243,210,144,.35);font-size:20px}
.new-home .space:hover{transform:translateY(-7px) scale(1.012);box-shadow:0 22px 45px rgba(0,0,0,.45),0 0 32px rgba(246,205,116,.17);border-color:#ffe1a2}
.new-home .hero:before{content:"✦  ✧  ✦";position:absolute;top:12%;left:5%;color:rgba(248,215,142,.34);font-size:24px;letter-spacing:24px;pointer-events:none}
.new-home .hero:after{content:"";position:absolute;right:4%;bottom:14%;width:125px;height:125px;border:1px solid rgba(143,222,216,.18);border-radius:50%;box-shadow:0 0 0 23px rgba(143,222,216,.025),0 0 0 47px rgba(143,222,216,.025);pointer-events:none}
@media(max-width:850px){.new-home .space,.new-home .space.admin,.new-home .space.teacher,.new-home .space.student{border-radius:16px}.new-home .portal-icon{width:43px;height:43px;border-radius:12px}.new-home .portal-icon svg{width:25px;height:25px}.new-home .space h2{font-size:22px}.new-home .space p{font-size:11px}.new-home .hero:before,.new-home .hero:after{display:none}}

/* Homepage 2026: editorial academic design, no changes to portal routes */
.new-home{padding:0!important;background:#051b26!important}
.new-home:before{background:linear-gradient(105deg,rgba(3,19,29,.82),rgba(3,35,43,.66) 54%,rgba(2,17,29,.84)),url('https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&fm=jpg&q=90&w=2400') center/cover no-repeat!important;filter:contrast(1.12) saturate(.95)!important}
.new-home:after{opacity:.65!important;animation:none!important}
.new-home .shell{width:100%!important;min-height:100dvh!important;border-radius:0!important;border:0!important;background:linear-gradient(90deg,rgba(4,24,36,.32),rgba(4,24,36,.1))!important;box-shadow:none!important;backdrop-filter:none!important;overflow:visible!important}
.new-home .top{height:91px!important;padding:0 clamp(20px,5.5vw,110px)!important;background:rgba(2,24,36,.84)!important;backdrop-filter:blur(14px);border-bottom:1px solid rgba(230,202,143,.24)!important}
.new-home .brand{gap:15px!important}.new-home .brand img{width:60px!important;height:60px!important;border-radius:18px!important}.new-home .brand b{font-size:23px!important;letter-spacing:0!important}.new-home .brand small{font-size:13px!important}
.new-home .live{font-size:13px!important;padding:11px 18px!important}
.new-home .hero{width:min(1360px,100%)!important;margin:0 auto!important;align-items:stretch!important;justify-content:center!important;padding:clamp(36px,5vh,68px) clamp(20px,5vw,75px) 55px!important;gap:0!important}
.new-home .intro{max-width:100%!important;text-align:right!important;padding:0!important}
.new-home .kicker{font-size:13px!important;padding:9px 18px!important;letter-spacing:.3px!important}
.new-home .portal-wordmark{width:100%!important;max-width:100%!important;text-align:right!important;font-size:clamp(44px,5.2vw,80px)!important;line-height:1.36!important;letter-spacing:-1.3px!important;margin:20px 0 8px!important;padding:0!important;text-wrap:balance!important;filter:none!important;text-shadow:0 8px 22px rgba(0,0,0,.6)!important}
.new-home .portal-wordmark:before{inset:-20% -8%!important;opacity:.65!important}
.new-home .portal-wordmark span{color:#f4d48b!important}
.new-home .hero-divider{justify-content:flex-start!important;margin:14px 0!important;font-size:16px!important;color:#f6e0b2!important}
.new-home .hero-divider i{width:58px!important}
.new-home .intro p{margin:0!important;max-width:790px!important;font-size:16px!important;line-height:2!important;color:#e1eff0!important}
.new-home .academic-rail{display:flex;flex-wrap:wrap;gap:10px;margin:26px 0 0}
.new-home .academic-rail span{display:inline-flex;align-items:center;gap:8px;padding:10px 15px;border-radius:10px;background:rgba(5,38,50,.75);border:1px solid rgba(199,229,224,.23);color:#e8f3f1;font-size:12px;font-weight:800;backdrop-filter:blur(8px)}
.new-home .academic-rail b{color:#f1cf87;font-size:17px}
.new-home .portal-section-title{display:flex;align-items:center;justify-content:space-between;gap:20px;margin:47px 0 16px;color:#fff}
.new-home .portal-section-title strong{font-size:22px;font-weight:950}.new-home .portal-section-title small{font-size:12px;color:#bdd3d5}
.new-home .spaces{width:100%!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:18px!important;padding:0!important}
.new-home .space,.new-home .space.admin,.new-home .space.teacher,.new-home .space.student{min-height:260px!important;padding:26px!important;border-radius:18px!important;display:flex!important;flex-direction:column!important;align-items:stretch!important;justify-content:flex-start!important;gap:0!important;backdrop-filter:blur(16px);transition:transform .3s ease,border-color .3s ease,box-shadow .3s ease!important}
.new-home .space.admin{background:linear-gradient(155deg,rgba(12,69,98,.94),rgba(5,30,49,.95))!important}
.new-home .space.teacher{background:linear-gradient(155deg,rgba(92,65,33,.94),rgba(38,34,29,.96))!important}
.new-home .space.student{background:linear-gradient(155deg,rgba(11,98,82,.93),rgba(4,43,48,.96))!important}
.new-home .space:before{display:none!important}
.new-home .space-topline{display:flex;align-items:center;justify-content:space-between;width:100%;margin-bottom:20px}
.new-home .portal-icon{width:67px!important;height:67px!important;border-radius:17px!important}
.new-home .portal-icon svg{width:37px!important;height:37px!important;stroke-width:1.8!important}
.new-home .space-index{font-size:22px;font-weight:900;letter-spacing:1px;color:rgba(255,235,185,.45);direction:ltr}
.new-home .space>div{width:100%}
.new-home .space strong{font-size:12px!important;color:#f5d694!important}
.new-home .space h2{font-size:clamp(27px,2.5vw,34px)!important;margin:5px 0 9px!important;line-height:1.3!important}
.new-home .space p{font-size:13px!important;line-height:1.85!important;color:#e0eaeb!important}
.new-home .space-action{display:flex;align-items:center;justify-content:space-between;width:100%;margin-top:auto;padding-top:18px;border-top:1px solid rgba(255,255,255,.16);font-size:13px;font-weight:900;color:#f8dfab}
.new-home .space-action b{font-size:23px}
.new-home .space:hover{transform:translateY(-7px)!important;box-shadow:0 23px 55px rgba(0,0,0,.46),0 0 27px rgba(239,197,104,.15)!important}
.new-home .foot{height:auto!important;min-height:64px!important;padding:18px clamp(20px,5.5vw,110px)!important;background:rgba(2,19,31,.85)!important;border-top:1px solid rgba(255,255,255,.14)!important;font-size:12px!important}
@media(max-width:850px){.new-home .top{height:75px!important;padding:0 16px!important}.new-home .brand img{width:46px!important;height:46px!important}.new-home .brand b{font-size:18px!important}.new-home .brand small{font-size:10px!important}.new-home .hero{padding:40px 17px!important}.new-home .portal-wordmark{font-size:clamp(34px,7.5vw,53px)!important;line-height:1.5!important;letter-spacing:0!important}.new-home .intro p{font-size:13px!important}.new-home .hero-divider{font-size:12px!important}.new-home .hero-divider i{width:22px!important}.new-home .academic-rail{margin-top:20px}.new-home .academic-rail span{font-size:11px!important;padding:9px 11px}.new-home .portal-section-title{margin-top:32px}.new-home .portal-section-title strong{font-size:18px}.new-home .portal-section-title small{display:none}.new-home .spaces{grid-template-columns:1fr!important;gap:12px!important}.new-home .space,.new-home .space.admin,.new-home .space.teacher,.new-home .space.student{min-height:225px!important;padding:21px!important;display:flex!important;grid-template-columns:none!important}.new-home .space-topline{margin-bottom:12px}.new-home .portal-icon{width:54px!important;height:54px!important}.new-home .portal-icon svg{width:30px!important;height:30px!important}.new-home .space h2{font-size:26px!important}.new-home .space p{font-size:12px!important}.new-home .foot{padding:18px!important}}
@media(prefers-reduced-motion:reduce){.new-home .space{transition:none!important}}

/* Premium title composition and living role entrances */
.new-home .intro{max-width:100%!important}
.new-home .portal-wordmark{display:flex!important;flex-wrap:wrap!important;align-items:baseline!important;justify-content:flex-start!important;column-gap:17px!important;row-gap:0!important;max-width:100%!important;margin:13px 0 12px!important;line-height:1.25!important;letter-spacing:0!important;font-size:clamp(43px,5vw,73px)!important}
.new-home .portal-wordmark .wordmark-prelude{display:block!important;flex-basis:100%!important;color:#c9e9e9!important;font-size:clamp(14px,1.5vw,20px)!important;letter-spacing:2px!important;font-weight:700!important;margin-bottom:10px!important;text-shadow:0 2px 9px rgba(0,0,0,.45)!important}
.new-home .portal-wordmark .wordmark-name{display:inline-block!important;font-size:1.22em!important;line-height:1.32!important;letter-spacing:-1px!important;white-space:nowrap!important;background:linear-gradient(180deg,#fff9de 2%,#f4d88c 35%,#d6a651 75%,#fff0bc)!important;background-clip:text!important;-webkit-background-clip:text!important;-webkit-text-fill-color:transparent!important;filter:drop-shadow(0 5px 10px rgba(0,0,0,.52)) drop-shadow(0 0 13px rgba(238,194,101,.3))!important}
.new-home .portal-wordmark .wordmark-tail{display:inline-block!important;font-size:.62em!important;line-height:1.4!important;color:#f4ffff!important;background:none!important;-webkit-text-fill-color:#f4ffff!important;text-shadow:0 3px 18px rgba(0,0,0,.55),0 0 16px rgba(89,225,214,.3)!important;filter:none!important;white-space:nowrap!important}
.new-home .portal-wordmark:before{inset:-10% -4%!important}
.new-home .spaces{perspective:1200px}
.new-home .space,.new-home .space.admin,.new-home .space.teacher,.new-home .space.student{min-height:305px!important;isolation:isolate;position:relative;overflow:hidden!important;border-radius:22px!important;border-width:1px!important;transition:transform .35s cubic-bezier(.2,.8,.2,1),box-shadow .35s,border-color .35s!important}
.new-home .space.admin{--card-glow:rgba(95,199,255,.4);--card-ink:#91dfff;background:linear-gradient(140deg,rgba(13,89,122,.96),rgba(5,30,49,.97))!important}
.new-home .space.teacher{--card-glow:rgba(255,201,100,.4);--card-ink:#ffe2a2;background:linear-gradient(140deg,rgba(113,76,35,.96),rgba(45,33,28,.98))!important}
.new-home .space.student{--card-glow:rgba(101,241,192,.4);--card-ink:#91f1ce;background:linear-gradient(140deg,rgba(9,121,101,.96),rgba(4,44,49,.98))!important}
.new-home .space:before{display:block!important;content:""!important;position:absolute!important;z-index:-1!important;inset:-60% -60% auto auto!important;width:100%!important;height:130%!important;transform:none!important;opacity:.65!important;pointer-events:none!important;background:radial-gradient(circle,var(--card-glow),transparent 67%)!important;transition:opacity .35s,transform .45s!important}
.new-home .space:after{content:"";position:absolute;z-index:-1;inset:0;pointer-events:none;background:linear-gradient(120deg,transparent 10%,rgba(255,255,255,.065) 40%,transparent 60%);transform:translateX(110%);transition:transform .6s}
.new-home .space:hover:after,.new-home .space:focus-visible:after{transform:translateX(-110%)}
.new-home .space:hover,.new-home .space:focus-visible{transform:translateY(-10px) rotateX(2deg)!important;border-color:var(--card-ink)!important;box-shadow:0 27px 55px rgba(0,0,0,.48),0 0 36px var(--card-glow)!important;outline:none}
.new-home .space:hover:before{transform:scale(1.2)!important;opacity:1!important}
.new-home .space-topline{margin-bottom:24px!important}
.new-home .portal-icon{width:76px!important;height:76px!important;border-radius:20px!important;color:var(--card-ink)!important;border-color:var(--card-ink)!important;background:linear-gradient(150deg,rgba(255,255,255,.17),rgba(255,255,255,.035))!important;box-shadow:inset 0 1px rgba(255,255,255,.24),0 0 22px var(--card-glow)!important;transition:transform .35s!important}
.new-home .portal-icon svg{width:42px!important;height:42px!important;stroke-width:1.75!important}
.new-home .space:hover .portal-icon{transform:scale(1.09) rotate(-4deg)}
.new-home .space-index{font-size:29px!important;color:var(--card-ink)!important;opacity:.55}
.new-home .space h2{font-size:clamp(30px,2.8vw,39px)!important;letter-spacing:-.3px!important;text-shadow:0 4px 12px rgba(0,0,0,.35)}
.new-home .space strong{font-size:14px!important;color:var(--card-ink)!important}
.new-home .space p{font-size:14px!important;max-width:340px}
.new-home .space-action{color:#fff!important;font-size:15px!important;padding-top:16px!important;border-top:1px solid rgba(255,255,255,.23)!important}
.new-home .space-action b{display:grid;place-items:center;width:36px;height:36px;border-radius:11px;background:var(--card-ink);color:#092332;box-shadow:0 4px 16px var(--card-glow);transition:transform .3s}
.new-home .space:hover .space-action b{transform:translateX(-5px)}
@media(max-width:850px){.new-home .portal-wordmark{font-size:clamp(35px,8vw,55px)!important;column-gap:10px!important}.new-home .portal-wordmark .wordmark-prelude{font-size:12px!important;letter-spacing:1px!important}.new-home .portal-wordmark .wordmark-name{font-size:1.1em!important}.new-home .portal-wordmark .wordmark-tail{font-size:.64em!important}.new-home .space,.new-home .space.admin,.new-home .space.teacher,.new-home .space.student{min-height:270px!important}.new-home .portal-icon{width:61px!important;height:61px!important}.new-home .portal-icon svg{width:34px!important;height:34px!important}.new-home .space h2{font-size:29px!important}.new-home .space p{font-size:13px!important}}
@media(max-width:420px){.new-home .portal-wordmark{font-size:clamp(30px,8vw,37px)!important}.new-home .portal-wordmark .wordmark-tail{font-size:.58em!important}}
@media(prefers-reduced-motion:reduce){.new-home .space,.new-home .space:after,.new-home .space:before,.new-home .portal-icon,.new-home .space-action b{transition:none!important}}
`}</style><div className="shell"><header className="top"><div className="brand"><img src="/icons/lahooni-identity-320.jpg" alt="شعار البوابة"/><div><b>أستاذ لحوني</b><small>المنصة التعليمية</small></div></div><span className="live"><i className="live-dot"/> بوابتك التعليمية</span></header><section className="hero"><div className="intro"><span className="kicker">منصة مدرسية متكاملة</span><h1 className="portal-wordmark"><small className="wordmark-prelude">بوابة التعليم والمتابعة</small><span className="wordmark-name">أستاذ لحوني</span><span className="wordmark-tail">التعليمية</span></h1><div className="hero-divider"><i/><span>تعليم أكثر تنظيمًا · متابعة أكثر أثرًا</span><i/></div><p>مساحات واضحة ومتكاملة للإدارة والمعلم والطالب، بهوية موحدة وتجربة مصممة للعمل اليومي على الجوال والويب.</p><div className="academic-rail"><span><b>✦</b> التحصيل العلمي</span><span><b>✦</b> الانضباط والمتابعة</span><span><b>✦</b> التقارير والشهادات</span></div></div><div className="portal-section-title"><strong>بوابات المنظومة التعليمية</strong><small>اختر مساحتك للبدء</small></div><div className="spaces">{portals.map(p=><Link href={p.href} className={`space ${p.tone}`} key={p.href}><span className="space-topline"><span className="portal-icon"><PortalIcon type={p.icon}/></span><span className="space-index">{p.tone==="admin"?"01":p.tone==="teacher"?"02":"03"}</span></span><div><strong>{p.sub}</strong><h2>{p.title}</h2><p>{p.desc}</p></div><span className="space-action"><span>استكشف البوابة</span><b>←</b></span></Link>)}</div></section><footer className="foot"><b>بوابة أستاذ لحوني التعليمية</b><span>إدارة · معلم · طالب وولي أمر</span></footer></div></main>}
