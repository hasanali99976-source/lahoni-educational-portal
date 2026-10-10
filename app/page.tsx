import Link from "next/link";
import { preload } from "react-dom";

const portals = [
  {href:"/admin",id:"01",kind:"admin",label:"إدارة المنصة",title:"الإدارة",description:"الطلاب، الفصول، المعلمون، الإسناد والتقارير.",button:"دخول بوابة الإدارة"},
  {href:"/teacher",id:"02",kind:"teacher",label:"مساحة العمل",title:"المعلم",description:"الجدول، التحضير، الحضور، التحصيل والمتابعة.",button:"دخول بوابة المعلم"},
  {href:"/student",id:"03",kind:"student",label:"الطالب وولي الأمر",title:"الطالب",description:"الحضور، النتائج، الاختبارات والمتابعة الأكاديمية.",button:"دخول بوابة الطالب"},
];
const features = [
  {icon:"▤",title:"التخطيط والتحضير",sub:"خطط علاجية وإثرائية"},
  {icon:"▦",title:"الجدول الدراسي",sub:"منظم ومتكامل"},
  {icon:"✎",title:"التحصيل العلمي",sub:"درجات واختبارات وواجبات"},
  {icon:"☆",title:"الشهادات",sub:"تقارير جاهزة للطباعة"},
  {icon:"♧",title:"الانضباط والمتابعة",sub:"حضور وغياب واستئذان"},
  {icon:"▥",title:"التقارير والإحصاءات",sub:"متابعة ومؤشرات دقيقة"},
];
function RoleIcon({kind}:{kind:string}) {
  const c={viewBox:"0 0 48 48",width:46,height:46,fill:"none",stroke:"currentColor",strokeWidth:2.3,strokeLinecap:"round" as const,strokeLinejoin:"round" as const};
  if(kind==="admin")return <svg {...c} aria-hidden="true"><circle cx="24" cy="24" r="16"/><circle cx="24" cy="24" r="6"/><path d="M24 4v8m0 24v8M4 24h8m24 0h8M10 10l6 6m16 16 6 6M38 10l-6 6M16 32l-6 6"/></svg>;
  if(kind==="teacher")return <svg {...c} aria-hidden="true"><rect x="5" y="7" width="38" height="28" rx="3"/><path d="M16 43h16M24 35v8m-9-21 6 6 12-13"/></svg>;
  return <svg {...c} aria-hidden="true"><path d="m3 18 21-11 21 11-21 11L3 18Zm9 8v10c8 7 16 7 24 0V26M45 18v16"/></svg>;
}
function CardScene({kind}:{kind:string}){
  if(kind==="admin")return <div className="card-scene admin-scene" aria-hidden="true"><span className="scene-halo"/><span className="scene-screen"><i/><i/><i/><b/></span><span className="scene-desk"/><span className="scene-stand"/><span className="scene-orbit">✦</span></div>;
  if(kind==="teacher")return <div className="card-scene teacher-scene" aria-hidden="true"><span className="scene-halo"/><span className="scene-book book-one"/><span className="scene-book book-two"/><span className="scene-pencil"/><span className="scene-orbit">✧</span></div>;
  return <div className="card-scene student-scene" aria-hidden="true"><span className="scene-halo"/><span className="scene-book book-one"/><span className="scene-book book-two"/><span className="scene-cap">◆</span><span className="scene-orbit">✦</span></div>;
}
export default function HomePage(){
 preload("/lahooni_classroom_ready.webp.png",{as:"image",fetchPriority:"high"});
  return <main className="lh-home" dir="rtl"><style>{`
  .lh-home,.lh-home *{box-sizing:border-box}
  .lh-home{position:relative;isolation:isolate;min-height:100dvh;overflow:hidden;background:linear-gradient(180deg,rgba(3,20,32,.64),rgba(3,22,35,.76) 65%,rgba(2,13,23,.90)),url("/lahooni_classroom_ready.webp.png") center center / cover no-repeat fixed;color:#fff;font-family:"Tajawal","Noto Kufi Arabic",Tahoma,Arial,sans-serif}
  .lh-home:before{content:none}
  .lh-home:after{content:"";position:absolute;inset:0;z-index:-2;pointer-events:none;background:radial-gradient(ellipse at 51% 25%,rgba(0,205,225,.17),transparent 40%),radial-gradient(ellipse at 50% 55%,rgba(238,162,56,.12),transparent 44%)}
  .lh-frame{width:min(1640px,100%);margin:auto;padding:0 clamp(18px,4vw,64px)}
  .lh-top{min-height:93px;display:flex;align-items:center;justify-content:space-between;gap:20px}
  .lh-brand{display:flex;align-items:center;gap:13px;padding:9px 15px;background:rgba(3,25,39,.75);border:1px solid rgba(239,193,104,.35);border-radius:24px;backdrop-filter:blur(12px)}
  .lh-brand img{width:57px;height:57px;object-fit:cover;border-radius:15px;border:2px solid #eac16c;box-shadow:0 0 18px rgba(242,195,91,.33)}
  .lh-brand strong{display:block;font-size:22px;font-weight:900}.lh-brand small{display:block;font-size:12px;color:#c7dcdf;margin-top:4px}
  .lh-top-pill{border:1px solid rgba(241,196,107,.65);border-radius:999px;background:rgba(4,29,41,.8);padding:13px 23px;color:#f7d992;font-weight:900;font-size:14px;box-shadow:0 0 20px rgba(236,177,68,.12)}
  .lh-top-pill span{margin-left:9px;font-size:19px}
  .lh-stage{position:relative;text-align:center;padding:17px 0 17px}
  .lh-stage:before{content:"";position:absolute;left:50%;top:13%;width:min(900px,94vw);height:340px;transform:translateX(-50%);z-index:-1;pointer-events:none;border-radius:50%;background:radial-gradient(ellipse,rgba(17,128,145,.33),rgba(217,158,67,.1) 40%,transparent 70%);filter:blur(18px)}
  .lh-book{font-size:48px;color:#f6d38c;line-height:1;filter:drop-shadow(0 0 13px rgba(255,196,82,.7));margin-bottom:3px}
  .lh-smalltitle{display:inline-block;color:#f9e3aa;font-size:20px;font-weight:900;letter-spacing:2px;padding:7px 30px;border:1px solid rgba(241,202,123,.56);border-radius:13px;background:linear-gradient(145deg,rgba(31,67,70,.8),rgba(6,31,44,.88));box-shadow:0 9px 25px rgba(0,0,0,.35)}
  .lh-main-title{position:relative;display:block;width:fit-content;max-width:100%;margin:3px auto 0;font-size:clamp(58px,7.2vw,112px);line-height:1.18;font-weight:1000;letter-spacing:-3px;white-space:nowrap;background:linear-gradient(180deg,#fff6d2 0%,#ffdf92 22%,#db9e39 54%,#a96b1e 75%,#fff1bb 95%);background-clip:text;-webkit-background-clip:text;-webkit-text-fill-color:transparent;filter:drop-shadow(0 7px 0 #422e1c) drop-shadow(0 9px 10px rgba(0,0,0,.70)) drop-shadow(0 0 11px rgba(255,183,65,.40))}
  .lh-main-title:after{content:"";opacity:.3;position:absolute;inset:50% -9% auto;height:2px;z-index:-1;background:linear-gradient(90deg,transparent,#49efff 27%,#ffe5a3 50%,#49efff 73%,transparent);box-shadow:0 0 25px #32ddeb;transform:rotate(-5deg)}
  .lh-subtitle{position:relative;display:table;margin:-2px auto 0;padding:3px 36px 7px;font-size:clamp(31px,4.4vw,61px);font-weight:1000;line-height:1.2;color:#e9ffff;background:linear-gradient(145deg,rgba(3,68,86,.97),rgba(2,34,55,.96));border:2px solid rgba(80,225,239,.65);border-radius:15px;text-shadow:0 4px 2px #06333c,0 0 15px rgba(92,235,255,.5);box-shadow:0 8px 28px rgba(0,0,0,.55),0 0 23px rgba(38,215,232,.27)}
  .lh-motto{font-size:17px;font-weight:900;color:#f7dfac;margin:20px 0 6px;letter-spacing:.2px}
  .lh-intro{max-width:900px;margin:0 auto;font-size:14px;font-weight:700;line-height:1.9;color:#e4f1f0}
  .lh-roles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px;margin-top:12px}
  .lh-card{--accent:#77d5ff;--glow:rgba(48,176,245,.3);position:relative;isolation:isolate;display:flex;flex-direction:column;min-height:292px;padding:20px 23px 19px;overflow:hidden;border:1px solid var(--accent);border-radius:24px;text-decoration:none;color:#fff;background:linear-gradient(145deg,rgba(7,76,109,.68),rgba(2,26,47,.79));box-shadow:0 18px 38px rgba(0,0,0,.42),inset 0 1px rgba(255,255,255,.19);transition:transform .3s,border-color .3s,box-shadow .3s}
  .lh-card.teacher{--accent:#ffda89;--glow:rgba(239,170,66,.32);background:linear-gradient(145deg,rgba(111,66,24,.68),rgba(37,25,22,.79))}
  .lh-card.student{--accent:#6bf6d3;--glow:rgba(32,225,175,.3);background:linear-gradient(145deg,rgba(3,114,97,.68),rgba(1,36,44,.79))}
  .lh-card:before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(circle at 25% 15%,var(--glow),transparent 50%),linear-gradient(125deg,transparent 20%,rgba(255,255,255,.055) 50%,transparent 72%)}
  .lh-card:after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(105deg,transparent 28%,rgba(255,255,255,.16) 49%,transparent 65%);transform:translateX(130%);transition:transform .7s}
  .lh-card:hover,.lh-card:focus-visible{transform:translateY(-8px);box-shadow:0 26px 55px rgba(0,0,0,.55),0 0 36px var(--glow);outline:none}
  .lh-card:hover:after,.lh-card:focus-visible:after{transform:translateX(-130%)}.lh-card .card-scene{transition:transform .35s ease,filter .35s ease}.lh-card:hover .card-scene{transform:translateY(-5px) scale(1.03);filter:brightness(1.14)}
  .lh-card-head{display:flex;align-items:center;justify-content:space-between;gap:15px}
  .lh-card-number{color:var(--accent);font-size:27px;font-weight:950;opacity:.78}
  .lh-card-icon{display:grid;place-items:center;width:64px;height:64px;border-radius:18px;background:rgba(255,255,255,.09);border:1px solid var(--accent);color:var(--accent);box-shadow:0 0 18px var(--glow)}
  .lh-card-copy{position:relative;z-index:1;margin-top:auto;text-align:right}
  .lh-card-copy small{display:block;font-size:13px;color:var(--accent);font-weight:900}
  .lh-card-copy h2{margin:3px 0 4px;font-size:clamp(31px,3vw,44px);font-weight:1000;line-height:1.3;text-shadow:0 3px 12px rgba(0,0,0,.5)}
  .lh-card-copy p{margin:0 0 14px;font-size:12px;line-height:1.7;color:#e4eff0}
  .lh-enter{display:flex;align-items:center;justify-content:space-between;padding:10px 15px;border-radius:12px;border:1px solid var(--accent);background:rgba(2,17,29,.56);font-size:14px;font-weight:900;box-shadow:0 0 15px var(--glow)}
  .lh-enter b{display:grid;place-items:center;background:var(--accent);color:#05212d;width:29px;height:29px;border-radius:8px;font-size:20px;transition:transform .25s}.lh-card:hover .lh-enter b{transform:translateX(-6px)}
  .card-scene{position:absolute;inset:54px 0 96px;z-index:-1;overflow:hidden;opacity:.54}
  .scene-halo{position:absolute;left:10%;top:3%;width:72%;height:125%;border-radius:50%;background:radial-gradient(ellipse,var(--glow),transparent 68%);filter:blur(7px)}
  .scene-screen{position:absolute;left:12%;top:12%;width:47%;height:65%;border:6px solid #162c3c;border-radius:9px;background:linear-gradient(140deg,#174e77,#061d38);box-shadow:9px 12px 0 rgba(0,0,0,.35),0 0 30px var(--glow);transform:perspective(400px) rotateY(-15deg)}
  .scene-screen i{display:block;width:65%;height:8px;margin:12px;background:#46a8dd;border-radius:5px}.scene-screen i:nth-child(2){width:42%;background:#f7ca74}.scene-screen i:nth-child(3){width:78%;background:#70dfdf}.scene-screen b{position:absolute;bottom:12px;right:10px;width:75%;height:25%;border:2px solid rgba(145,218,255,.5);border-radius:3px}
  .scene-desk{position:absolute;left:6%;bottom:7%;width:63%;height:13px;border-radius:4px;background:linear-gradient(90deg,#203e55,#75b4ce,#132b40);transform:skew(-17deg)}
  .scene-stand{position:absolute;left:29%;bottom:18%;width:8px;height:26px;background:#496a80}
  .scene-book{position:absolute;width:43%;height:33px;left:14%;bottom:15%;border-radius:6px 12px 12px 6px;border:3px solid rgba(255,226,163,.65);background:linear-gradient(180deg,#16515c,#092e3d);box-shadow:8px 9px 0 rgba(0,0,0,.32);transform:rotate(-9deg)}
  .scene-book.book-two{left:19%;bottom:37%;width:38%;background:linear-gradient(180deg,#bc8643,#5e391f);transform:rotate(7deg)}
  .scene-pencil{position:absolute;left:55%;bottom:20%;height:96px;width:11px;background:linear-gradient(90deg,#b67d36,#fbe1a3,#9e6027);transform:rotate(22deg);border-radius:3px}
  .scene-cap{position:absolute;left:46%;top:8%;font-size:90px;color:#f1d79c;transform:rotate(-13deg);text-shadow:0 8px 22px rgba(0,0,0,.55)}
  .scene-orbit{position:absolute;top:13%;left:7%;font-size:40px;color:var(--accent);text-shadow:0 0 20px var(--accent)}
  .lh-features{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:0;margin:20px 0 28px;border:1px solid rgba(239,194,107,.36);border-radius:22px;overflow:hidden;background:rgba(3,20,30,.83);backdrop-filter:blur(12px)}
  .lh-feature{text-align:center;padding:17px 9px 15px;border-left:1px solid rgba(236,207,144,.2)}.lh-feature:last-child{border-left:0}
  .lh-feature i{display:block;font-size:29px;line-height:1.2;font-style:normal;color:#f6cf81;text-shadow:0 0 14px rgba(239,187,78,.28)}
  .lh-feature strong{display:block;margin:5px 0 3px;font-size:12px}.lh-feature small{display:block;font-size:10px;color:#a9c3ca}
  .lh-foot{text-align:center;color:#a9bdc1;font-size:11px;padding:0 0 20px}
  @media(max-width:1000px){.lh-main-title{font-size:clamp(52px,8vw,85px)}.lh-roles{gap:12px}.lh-card{padding:17px;min-height:300px}.lh-features{grid-template-columns:repeat(3,1fr)}.lh-feature:nth-child(3){border-left:0}}
  @media(max-width:690px){.lh-frame{padding:0 13px}.lh-top{min-height:75px}.lh-brand{padding:6px 8px;border-radius:14px}.lh-brand img{width:43px;height:43px;border-radius:11px}.lh-brand strong{font-size:15px}.lh-brand small{font-size:9px}.lh-top-pill{padding:10px 11px;font-size:10px}.lh-top-pill span{font-size:12px}.lh-stage{padding:26px 0 18px}.lh-book{font-size:35px}.lh-smalltitle{font-size:14px;padding:6px 20px}.lh-main-title{font-size:clamp(42px,10vw,70px);letter-spacing:-1.3px;line-height:1.3}.lh-subtitle{font-size:clamp(26px,6vw,40px);padding:4px 20px}.lh-motto{font-size:12px;margin-top:17px}.lh-intro{font-size:11px}.lh-roles{grid-template-columns:1fr;gap:14px;margin-top:12px}.lh-card{min-height:260px;padding:18px}.card-scene{inset:45px 0 77px}.lh-card-copy h2{font-size:32px}.lh-card-copy p{font-size:11px}.lh-features{grid-template-columns:repeat(2,1fr);margin-top:16px}.lh-feature{padding:13px 5px}.lh-feature:nth-child(3){border-left:1px solid rgba(236,207,144,.2)}.lh-feature:nth-child(even){border-left:0}.lh-feature strong{font-size:11px}.lh-feature small{font-size:9px}}
  @media(max-width:360px){.lh-main-title{font-size:40px}.lh-top-pill{display:none}}
  .lh-stars{display:flex;align-items:center;justify-content:center;gap:13px;height:58px;margin-bottom:3px;filter:drop-shadow(0 0 13px rgba(255,195,88,.4))}
  .lh-stars .star-main{font-size:43px;line-height:1;color:#ffdc91;text-shadow:0 0 10px rgba(255,196,87,.9),0 0 26px rgba(255,186,58,.5)}
  .lh-stars .star-side{font-size:22px;line-height:1;color:#8ae8df;text-shadow:0 0 12px rgba(66,220,218,.6)}
  @media(prefers-reduced-motion:reduce){.lh-card,.lh-card:after,.lh-enter b{transition:none}}

  /* Unified restrained visual system for the real classroom background */
  .lh-home{background:linear-gradient(180deg,rgba(5,19,29,.69) 0%,rgba(5,24,35,.73) 49%,rgba(4,17,27,.89) 100%),url("/lahooni_classroom_ready.webp.png") center center / cover no-repeat fixed}
  .lh-frame{width:min(1450px,100%)}
  .lh-top{min-height:86px}
  .lh-brand,.lh-top-pill{background:rgba(5,27,38,.66);border-color:rgba(229,196,134,.32);box-shadow:0 8px 24px rgba(0,0,0,.16);backdrop-filter:blur(14px)}
  .lh-stage{padding:6px 0 25px}
  .lh-stars{height:40px;margin-bottom:7px;filter:none}
  .lh-stars .star-main{font-size:31px;text-shadow:0 0 14px rgba(255,196,87,.34)}
  .lh-stars .star-side{font-size:15px}
  .lh-smalltitle{font-size:15px;letter-spacing:0;padding:5px 23px;border-radius:999px;background:rgba(6,36,48,.62);box-shadow:none}
  .lh-main-title{font-size:clamp(52px,6.3vw,96px);line-height:1.28;letter-spacing:-1.5px;filter:drop-shadow(0 5px 6px rgba(0,0,0,.58));margin:4px auto}
  .lh-main-title:after{display:none}
  .lh-subtitle{font-size:clamp(25px,3vw,41px);padding:6px 32px 8px;border-radius:15px;border:1px solid rgba(115,218,222,.45);background:rgba(5,49,64,.78);box-shadow:0 10px 24px rgba(0,0,0,.22);text-shadow:none}
  .lh-motto{margin:15px 0 7px;font-size:16px;color:#f6dca5}
  .lh-intro{font-size:13px;max-width:780px;line-height:1.85;color:#e8eff0;text-shadow:0 2px 8px rgba(0,0,0,.55)}
  .lh-roles{gap:17px;margin-top:18px}
  .lh-card{min-height:285px;padding:20px 22px;border-radius:20px;background:linear-gradient(150deg,rgba(8,53,73,.83),rgba(4,29,43,.91));border:1px solid rgba(112,204,224,.48);box-shadow:0 13px 32px rgba(0,0,0,.27);backdrop-filter:blur(15px);-webkit-backdrop-filter:blur(15px)}
  .lh-card.teacher{background:linear-gradient(150deg,rgba(92,61,35,.83),rgba(43,32,27,.91));border-color:rgba(243,197,119,.53)}
  .lh-card.student{background:linear-gradient(150deg,rgba(8,89,78,.83),rgba(4,44,45,.91));border-color:rgba(115,224,194,.52)}
  .lh-card:before{opacity:.35}
  .lh-card-number{font-size:19px;opacity:.68}
  .lh-card-icon{width:54px;height:54px;border-radius:15px;background:rgba(255,255,255,.055);box-shadow:none}
  .card-scene{opacity:.28;inset:48px 0 100px}
  .lh-card-copy h2{font-size:clamp(28px,2.5vw,36px);margin:4px 0 5px;text-shadow:0 2px 9px rgba(0,0,0,.3)}
  .lh-card-copy small{font-size:12px}
  .lh-card-copy p{font-size:12px;color:#edf2f1}
  .lh-enter{border-color:rgba(255,255,255,.22);background:rgba(2,18,27,.42);box-shadow:none}
  .lh-features{background:rgba(5,27,38,.68);border-color:rgba(224,193,133,.25);margin-top:22px}
  @media(max-width:1000px){.lh-main-title{font-size:clamp(48px,7.3vw,78px)}.lh-card{min-height:275px}}
  @media(max-width:690px){.lh-home{background-attachment:scroll;background-position:center top}.lh-stage{padding:20px 0 17px}.lh-main-title{font-size:clamp(39px,9.3vw,60px);letter-spacing:-1px}.lh-subtitle{font-size:clamp(23px,5.8vw,33px);padding:5px 22px}.lh-motto{font-size:12px}.lh-intro{font-size:11px}.lh-roles{gap:12px;margin-top:14px}.lh-card{min-height:245px;padding:17px}.lh-card-copy h2{font-size:30px}.lh-top{min-height:76px}}


  /* Unified home art direction: watercolor glass, crisp content and natural classroom backdrop. */
  .lh-home{color:#214b65;background:linear-gradient(115deg,rgba(255,247,244,.30),rgba(237,250,255,.31) 55%,rgba(251,242,253,.30)),url("/lahooni_classroom_ready.webp.png") center center / cover no-repeat,#e8f3f8;background-attachment:scroll}
  .lh-home:after{z-index:-1;opacity:.48;background:radial-gradient(ellipse at 14% 14%,rgba(255,197,171,.32),transparent 43%),radial-gradient(ellipse at 85% 26%,rgba(154,222,255,.23),transparent 45%)}
  .lh-frame{width:min(1510px,100%);padding-inline:clamp(15px,3.5vw,52px)}
  .lh-top{min-height:76px}
  .lh-brand,.lh-top-pill{background:rgba(255,255,255,.83);border:1.5px solid rgba(255,255,255,.96);color:#365d7a;box-shadow:0 8px 20px rgba(45,93,125,.17),inset 0 1px 0 #fff;backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}
  .lh-brand{padding:7px 12px;border-radius:20px}.lh-brand img{width:50px;height:50px;border-radius:14px;border:2px solid #fff;box-shadow:0 3px 9px #2c618744}
  .lh-brand strong{font-size:20px;color:#17516f}.lh-brand small{color:#52768c}.lh-top-pill{padding:10px 19px;color:#8045a5;font-weight:900}
  .lh-stage{padding:4px 0 12px}.lh-stage:before{opacity:.35;background:radial-gradient(ellipse,rgba(255,224,233,.56),rgba(181,222,249,.25) 49%,transparent 76%);filter:blur(24px)}
  .lh-stars{height:29px;margin-bottom:2px}.lh-stars .star-main{color:#ffb44e;text-shadow:0 2px 0 #fff,0 5px 15px #a7794c66}.lh-stars .star-side{color:#4c9db8}
  .lh-smalltitle{padding:4px 21px;font-size:16px;color:#7843ad;background:rgba(255,255,255,.93);border:1.5px solid #fff;box-shadow:0 5px 14px #457aa42b}
  .lh-main-title{font-size:clamp(50px,6.4vw,94px);line-height:1.28;letter-spacing:-1.5px;background:linear-gradient(110deg,#ee7776 4%,#ff9e4f 24%,#9c65d7 45%,#338ed1 67%,#1aa993 95%);background-clip:text;-webkit-background-clip:text;-webkit-text-fill-color:transparent;-webkit-text-stroke:1px #ffffffa8;filter:drop-shadow(0 2px 0 #fff) drop-shadow(0 5px 2px #4b72917a)}
  .lh-subtitle{padding:4px 24px;font-size:clamp(24px,2.8vw,38px);font-weight:900;color:#286295;background:rgba(255,255,255,.92);border:1.5px solid #fff;border-radius:20px;box-shadow:0 5px 15px #497ca12e;text-shadow:none}
  .lh-motto{margin:10px 0 4px;font-size:17px;font-weight:900;color:#844d9e;text-shadow:0 1px 2px #fff}
  .lh-intro{font-size:14px;font-weight:850;color:#244e65;text-shadow:0 1px 3px #fff}
  .lh-roles{gap:17px;margin-top:16px}
  .lh-card,.lh-card.teacher,.lh-card.student{min-height:238px;padding:14px 17px;border:2px solid rgba(255,255,255,.97);border-radius:25px;box-shadow:0 15px 30px rgba(48,94,126,.23),inset 0 2px 0 rgba(255,255,255,.86);backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px);color:#244f69;transition:transform .18s ease,box-shadow .18s ease}
  .lh-card{--accent:#438fd1;--glow:#78c6f5;background:linear-gradient(140deg,rgba(151,213,252,.95),rgba(211,239,255,.95))}
  .lh-card.teacher{--accent:#cf7189;--glow:#ffb0bd;background:linear-gradient(140deg,rgba(255,178,178,.95),rgba(255,223,203,.95))}
  .lh-card.student{--accent:#389f87;--glow:#8ce6bd;background:linear-gradient(140deg,rgba(137,225,189,.95),rgba(207,248,221,.95))}
  .lh-card:before{opacity:.78;background:radial-gradient(circle at 13% 10%,rgba(255,255,255,.69),transparent 46%),radial-gradient(circle at 93% 88%,var(--glow),transparent 58%)}
  .lh-card-head{min-height:45px}.lh-card-number{font-size:16px;color:var(--accent);opacity:1}.lh-card-icon{width:45px;height:45px;background:rgba(255,255,255,.86);border:1.5px solid #fff;border-radius:14px;color:var(--accent);box-shadow:0 4px 12px #346a8c24}.lh-card-icon svg{width:31px;height:31px}
  .lh-card-copy h2{font-size:clamp(28px,2.6vw,37px);margin:0 0 2px;color:#194c67;text-shadow:0 1px 0 #fff}
  .lh-card-copy small{font-size:12px;font-weight:900;color:#2b6880}.lh-card-copy p{font-size:12px;font-weight:750;color:#365c70;margin-bottom:10px}
  .lh-enter{padding:7px 10px;font-size:13px;font-weight:900;border:1.5px solid #fff;border-radius:13px;background:rgba(255,255,255,.95);color:#164d6d;box-shadow:0 4px 12px #275b7e2b}
  .lh-enter b{width:27px;height:27px;color:#fff;background:var(--accent)}
  .card-scene{inset:32px 0 60px;opacity:.34;filter:drop-shadow(0 4px 7px #32617d2c)}
  .lh-card:hover,.lh-card:focus-visible{transform:translateY(-4px);box-shadow:0 19px 38px rgba(48,94,126,.27),0 0 19px #ffffff99}
  .lh-features{margin-top:16px;background:rgba(255,255,255,.87);border:1.5px solid #fff;border-radius:22px;box-shadow:0 12px 25px #3165842b;backdrop-filter:blur(7px)}
  .lh-feature{padding-block:15px}.lh-feature i{color:#bb8333;filter:drop-shadow(0 1px 2px #b98a3b44)}
  .lh-feature strong{color:#24536c;font-size:13px}.lh-feature small{color:#4a7287;font-size:12px}.lh-foot{color:#456c80}
  @media(max-width:1000px){.lh-roles{gap:12px}.lh-card,.lh-card.teacher,.lh-card.student{min-height:235px;padding:13px}.lh-card-copy h2{font-size:30px}}
  @media(max-width:690px){.lh-home{background:linear-gradient(115deg,rgba(255,248,245,.34),rgba(239,250,255,.32)),url("/lahooni_classroom_ready.webp.png") center top / auto 100vh no-repeat,#e8f3f8}.lh-top{min-height:70px}.lh-brand strong{font-size:15px}.lh-brand img{width:42px;height:42px}.lh-top-pill{padding:8px 11px}.lh-stage{padding:16px 0 12px}.lh-main-title{font-size:clamp(43px,10vw,65px);letter-spacing:-1px}.lh-motto{font-size:14px}.lh-intro{font-size:12px}.lh-roles{gap:12px;margin-top:15px}.lh-card,.lh-card.teacher,.lh-card.student{min-height:226px;padding:13px;border-radius:21px}.lh-card-copy h2{font-size:29px}.lh-features{margin-top:12px}}

  /* Responsive app / phone presentation with a stable background crop. */
  .lh-home{background-color:#e8f3f8;min-width:0}
  .lh-frame,.lh-stage,.lh-roles,.lh-card{min-width:0}
  @media(max-width:690px){
    .lh-home{background-image:linear-gradient(115deg,rgba(255,248,245,.32),rgba(239,250,255,.3)),url("/lahooni_classroom_ready.webp.png");background-size:cover,cover;background-position:center,center 28%;background-repeat:no-repeat;background-attachment:scroll}
    .lh-frame{width:100%;max-width:100%;padding-inline:12px}
    .lh-top{gap:8px;flex-wrap:wrap}
    .lh-stage{max-width:100%;overflow-wrap:anywhere}
    .lh-main-title{font-size:clamp(35px,10vw,58px);max-width:100%;white-space:normal;text-align:center}
    .lh-subtitle{max-width:100%;text-align:center}
    .lh-roles{grid-template-columns:1fr;gap:12px}
    .lh-card,.lh-card.teacher,.lh-card.student{width:100%;min-height:205px}
    .lh-features{grid-template-columns:repeat(2,minmax(0,1fr))}
  }
  @media(max-width:390px){.lh-top-pill{font-size:9px}.lh-brand strong{font-size:13px}.lh-main-title{font-size:37px}.lh-card-copy h2{font-size:27px}}
`}</style>
  <div className="lh-frame">
    <header className="lh-top"><div className="lh-brand"><img src="/icons/lahooni-identity-320.jpg" alt="شعار أستاذ لحوني"/><div><strong>أستاذ لحوني</strong><small>المنصة التعليمية</small></div></div><span className="lh-top-pill"><span aria-hidden="true">✧</span> بوابتك التعليمية</span></header>
    <section className="lh-stage" aria-label="بوابة أستاذ لحوني التعليمية"><div className="lh-book lh-stars" aria-hidden="true"><span className="star-side">✧</span><span className="star-main">✦</span><span className="star-side">✧</span></div><div className="lh-smalltitle">بوابة</div><h1 className="lh-main-title">أستاذ لحوني</h1><div className="lh-subtitle">التعليمية</div><p className="lh-motto">تعليم أكثر تنظيمًا · متابعة أكثر أثرًا</p><p className="lh-intro">منظومة تعليمية تجمع الإدارة والمعلم والطالب وولي الأمر في تجربة واحدة، لتطوير التعلم ومتابعة الإنجاز.</p></section>
    <nav className="lh-roles" aria-label="بوابات الدخول">{portals.map(p=><Link key={p.href} href={p.href} className={`lh-card ${p.kind}`}><div className="lh-card-head"><span className="lh-card-icon"><RoleIcon kind={p.kind}/></span><span className="lh-card-number">{p.id}</span></div><CardScene kind={p.kind}/><div className="lh-card-copy"><small>{p.label}</small><h2>{p.title}</h2><p>{p.description}</p><span className="lh-enter">{p.button}<b aria-hidden="true">←</b></span></div></Link>)}</nav>
    <section className="lh-features" aria-label="خدمات البوابة">{features.map(f=><div key={f.title} className="lh-feature"><i aria-hidden="true">{f.icon}</i><strong>{f.title}</strong><small>{f.sub}</small></div>)}</section>
    <footer className="lh-foot">بوابة أستاذ لحوني التعليمية · تجربة مدرسية مترابطة</footer>
  </div></main>;
}
