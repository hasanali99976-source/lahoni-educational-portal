"use client";

import Link from "next/link";
import StudentDirectQr from "./student-direct-qr";
import "./student-direct-qr.css";

const IDENTITY = "/icons/lahooni-identity-320.jpg";
const CLASSROOM = "/saudi-classroom.svg";

const portals = [
  { href: "/admin", key: "admin", title: "الإدارة", text: "إدارة المعلمين والطلاب والفصول والتقارير.", tone: "blue" },
  { href: "/teacher", key: "teacher", title: "المعلم", text: "مساحة أكاديمية للحضور والتحصيل والمتابعة والقياس.", tone: "teal" },
  { href: "/student", key: "student", title: "الطالب وولي الأمر", text: "متابعة التحصيل والحضور والاختبارات والملاحظات.", tone: "gold" },
] as const;

const subjects = ["التاريخ","التفكير الناقد","الرياضيات","العلوم","الكيمياء","الجغرافيا","اللغة العربية","اللغة الإنجليزية","الدراسات الإسلامية"] as const;

function SubjectIcon({ name }: { name: string }) {
  const common = { viewBox:"0 0 24 24", fill:"none", stroke:"currentColor", strokeWidth:1.8, strokeLinecap:"round" as const, strokeLinejoin:"round" as const };
  if(name.includes("تاريخ")) return <svg {...common}><path d="M3 21h18M5 18h14M6 8h12M8 8v10M12 8v10M16 8v10M4 8l8-5 8 5"/></svg>;
  if(name.includes("ناقد")) return <svg {...common}><path d="M9 18h6M10 22h4M8 14.5A6 6 0 1 1 16 14.5c-1 .8-1.5 1.7-1.5 2.5h-5c0-.8-.5-1.7-1.5-2.5Z"/><path d="m9.5 10.5 1.5 1.5 3.5-4"/></svg>;
  if(name.includes("رياض")) return <svg {...common}><path d="M4 5h16M12 3v4M5 12h6M8 9v6M14 10l6 6M20 10l-6 6M4 20h16"/></svg>;
  if(name.includes("علوم")||name.includes("كيمي")) return <svg {...common}><path d="M9 3h6M10 3v5l-5 9a3 3 0 0 0 2.6 4.5h8.8A3 3 0 0 0 19 17l-5-9V3"/><path d="M8 15h8M9.5 12h5"/></svg>;
  if(name.includes("جغراف")) return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>;
  if(name.includes("عربية")) return <svg {...common}><path d="M5 18c4-1 8-4 11-10l3 2c-3 7-7 10-12 11H5v-3ZM14 6l3-3 3 3"/></svg>;
  if(name.includes("إنجليزية")) return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.7 4 5.7 4 9s-1.4 6.3-4 9c-2.6-2.7-4-5.7-4-9s1.4-6.3 4-9Z"/></svg>;
  return <svg {...common}><path d="M4 5.5A4.5 4.5 0 0 1 8.5 4H12v16H8.5A4.5 4.5 0 0 0 4 21.5v-16ZM20 5.5A4.5 4.5 0 0 0 15.5 4H12v16h3.5a4.5 4.5 0 0 1 4.5 1.5v-16Z"/></svg>;
}

function PortalIcon({ kind }: { kind: string }) {
  const common={viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:1.8,strokeLinecap:"round" as const,strokeLinejoin:"round" as const};
  if(kind==="admin") return <svg {...common}><path d="M4 20h16M6 18V9h12v9M8 9V6h8v3M9 13h2M13 13h2M9 16h2M13 16h2"/></svg>;
  if(kind==="teacher") return <svg {...common}><circle cx="8" cy="7" r="3"/><path d="M3 20v-3a5 5 0 0 1 5-5h1a5 5 0 0 1 5 5v3M15 4h6v10h-6M16.5 8h3"/></svg>;
  return <svg {...common}><circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20a5 5 0 0 1 10 0M13 20a4 4 0 0 1 8 0"/></svg>;
}

const styles=`
:root{--home-navy:#062f45;--home-navy2:#084b63;--home-teal:#0aa39b;--home-cyan:#3cc7d5;--home-gold:#d4a548;--home-paper:#f3f7fa;--home-ink:#143645;--home-muted:#667f8b}
html:has(.home-v19),body:has(.home-v19){margin:0!important;padding:0!important;background:var(--home-paper)!important;overflow-x:hidden!important}.home-v19{min-height:100dvh;background:#f3f7fa;color:var(--home-ink);padding:16px}.home-v19 *{box-sizing:border-box}.home-shell{width:min(1500px,100%);margin:auto}
.home-top{height:74px;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:9px 13px;border-radius:20px;background:#fff;border:1px solid #dbe6ec;box-shadow:0 10px 28px rgba(11,53,75,.07)}.home-brand{display:flex;align-items:center;gap:11px;text-decoration:none;color:var(--home-ink)}.home-brand img{width:52px;height:52px;object-fit:contain;border-radius:14px;border:1px solid #dce7eb;background:#fff}.home-brand strong{display:block;font-size:18px;font-weight:900}.home-brand small{display:block;margin-top:2px;font-size:11px;color:#6e838d;font-weight:700}.home-state{display:flex;align-items:center;gap:8px;padding:9px 12px;border-radius:999px;background:#eaf7f5;color:#126960;font-size:11px;font-weight:800}.home-state i{width:8px;height:8px;border-radius:50%;background:#21b68e;box-shadow:0 0 0 5px rgba(33,182,142,.1)}
.home-hero{margin-top:12px;display:grid;grid-template-columns:minmax(0,1fr) minmax(470px,.95fr);min-height:410px;border-radius:30px;overflow:hidden;background:linear-gradient(120deg,var(--home-navy),var(--home-navy2));box-shadow:0 22px 54px rgba(6,47,69,.2)}.home-hero-copy{padding:48px clamp(30px,5vw,70px);display:flex;flex-direction:column;justify-content:center}.home-kicker{font-size:13px;font-weight:850;color:#bce8e5}.home-hero h1{margin:10px 0 14px;color:#fff;font-size:clamp(42px,5vw,68px);line-height:1.12;font-weight:900;letter-spacing:-1px}.home-hero p{margin:0;max-width:720px;color:#d5e8ed;font-size:17px;line-height:1.85;font-weight:550}.home-hero-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:20px}.home-hero-actions a{min-height:45px;display:inline-flex;align-items:center;justify-content:center;padding:0 15px;border-radius:12px;text-decoration:none;font-size:13px;font-weight:850}.home-hero-actions .primary{background:var(--home-teal);color:#fff}.home-hero-actions .secondary{background:#fff;color:var(--home-navy)}
.home-scene{position:relative;background:#0b5268;display:grid;place-items:center;padding:22px}.home-scene img{width:100%;height:100%;object-fit:cover;border-radius:24px;background:#fff}.home-scene-badge{position:absolute;right:38px;bottom:34px;padding:11px 14px;border-radius:14px;background:#fff;color:#174756;box-shadow:0 12px 30px rgba(0,0,0,.16);font-size:12px;font-weight:850}.home-scene-badge b{display:block;font-size:16px;color:#0a776e;margin-bottom:2px}
.subject-strip{margin:12px 0;display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;overflow:hidden;border-radius:18px;background:#fff;border:1px solid #dbe6ec;box-shadow:0 9px 24px rgba(11,53,75,.055)}.subject-strip>strong{padding:0 15px;color:#164355;font-size:12px;white-space:nowrap}.subject-window{overflow:hidden}.subject-track{display:flex;width:max-content;gap:8px;padding:8px;animation:subjectMove 28s linear infinite}.subject-window:hover .subject-track{animation-play-state:paused}.subject-pill{min-width:170px;height:54px;display:flex;align-items:center;gap:10px;padding:0 11px;border-radius:13px;background:#f4f8fa;border:1px solid #e0e9ee;color:#214957}.subject-pill svg{width:28px;height:28px;padding:5px;border-radius:9px;background:#e3f5f2;color:#087b72}.subject-pill span{font-size:12px;font-weight:850;white-space:nowrap}@keyframes subjectMove{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.home-access{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:12px}.portal-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.portal-card{position:relative;overflow:hidden;min-height:190px;padding:18px;border-radius:22px;text-decoration:none;color:#fff;display:grid;grid-template-rows:auto 1fr auto;box-shadow:0 13px 30px rgba(10,52,73,.11);transition:.18s}.portal-card:hover{transform:translateY(-4px);box-shadow:0 18px 38px rgba(10,52,73,.17)}.portal-card.blue{background:linear-gradient(140deg,#285fa9,#173f75)}.portal-card.teal{background:linear-gradient(140deg,#0aa39b,#086a75)}.portal-card.gold{background:linear-gradient(140deg,#b98428,#8a6224)}.portal-card .icon{width:50px;height:50px;display:grid;place-items:center;border-radius:14px;background:rgba(255,255,255,.15)}.portal-card .icon svg{width:29px;height:29px}.portal-card h2{margin:14px 0 6px;font-size:22px}.portal-card p{margin:0;color:rgba(255,255,255,.84);font-size:12.5px;line-height:1.65}.portal-card footer{display:flex;align-items:center;justify-content:space-between;margin-top:14px;padding-top:10px;border-top:1px solid rgba(255,255,255,.16);font-size:11px;font-weight:800}.portal-card footer span:last-child{width:32px;height:32px;display:grid;place-items:center;border-radius:10px;background:#fff;color:#174756;font-size:18px}
.home-qr{min-height:190px;padding:16px;border-radius:22px;background:#fff;border:1px solid #dbe6ec;box-shadow:0 12px 30px rgba(11,53,75,.07);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}.home-qr>small{font-size:10px;color:#7b8e96;font-weight:750}.home-qr>strong{margin:3px 0 6px;font-size:16px}.home-qr .v3-student-quick{margin:0!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important}.home-qr .v3-student-quick-copy{display:none!important}.home-qr .v3-student-qr-wrap{padding:5px!important;border:0!important;background:#fff!important;box-shadow:none!important}.home-qr .v3-student-qr-wrap svg{width:105px!important;height:105px!important}.home-qr .v3-student-qr-wrap small{display:none!important}
.home-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 4px;color:#72858e;font-size:10px}.home-footer b{color:#16485a}
@media(max-width:1050px){.home-hero{grid-template-columns:1fr}.home-scene{min-height:330px}.home-access{grid-template-columns:1fr}.portal-grid{grid-template-columns:1fr 1fr 1fr}.home-qr{min-height:160px}}
@media(max-width:760px){.home-v19{padding:9px}.home-top{height:68px}.home-state{display:none}.home-brand strong{font-size:15px}.home-brand img{width:46px;height:46px}.home-hero-copy{padding:31px 22px}.home-hero h1{font-size:39px}.home-hero p{font-size:14px}.home-scene{min-height:260px;padding:12px}.home-scene-badge{right:23px;bottom:22px}.subject-strip{grid-template-columns:1fr}.subject-strip>strong{padding:10px 12px 0}.portal-grid{grid-template-columns:1fr}.home-footer{display:block;text-align:center}.home-footer span{display:block;margin-top:4px}}
@media(prefers-reduced-motion:reduce){.subject-track{animation:none}.portal-card{transition:none}}
`;

export default function ApprovedHomeClient(){
  const moving=[...subjects,...subjects];
  return <main className="home-v19" dir="rtl"><style>{styles}</style><div className="home-shell">
    <header className="home-top"><Link href="/" className="home-brand"><img src={IDENTITY} alt="هوية بوابة أستاذ لحوني التعليمية"/><span><strong>بوابة أستاذ لحوني التعليمية</strong><small>منصة مدرسية ذكية للتعليم والمتابعة والتواصل</small></span></Link><div className="home-state"><i/> المنصة جاهزة للعمل</div></header>

    <section className="home-hero"><div className="home-hero-copy"><span className="home-kicker">منصة تعليمية مدرسية موحدة</span><h1>التعليم والمتابعة والتحصيل في مساحة واحدة واضحة.</h1><p>تجمع البوابة الإدارة والمعلم والطالب وولي الأمر في تجربة واحدة مترابطة، وتحوّل البيانات اليومية إلى متابعة أكاديمية أسهل وأسرع.</p><div className="home-hero-actions"><Link href="/teacher" className="primary">دخول المعلم</Link><Link href="/student" className="secondary">دخول الطالب وولي الأمر</Link></div></div><div className="home-scene"><img src={CLASSROOM} alt="معلم وطلاب في بيئة تعليمية سعودية"/><div className="home-scene-badge"><b>بيئة تعليمية ذكية</b>تعلم • قياس • متابعة</div></div></section>

    <section className="subject-strip" aria-label="المواد التعليمية"><strong>المواد التعليمية</strong><div className="subject-window"><div className="subject-track">{moving.map((name,index)=><div className="subject-pill" key={`${name}-${index}`}><SubjectIcon name={name}/><span>{name}</span></div>)}</div></div></section>

    <section className="home-access"><div className="portal-grid">{portals.map(portal=><Link key={portal.key} href={portal.href} className={`portal-card ${portal.tone}`}><span className="icon"><PortalIcon kind={portal.key}/></span><div><h2>{portal.title}</h2><p>{portal.text}</p></div><footer><span>فتح البوابة</span><span>←</span></footer></Link>)}</div><aside className="home-qr"><small>دخول مباشر</small><strong>الطالب وولي الأمر</strong><StudentDirectQr/></aside></section>

    <footer className="home-footer"><b>بوابة أستاذ لحوني التعليمية</b><span>إعداد الأستاذ حسن علي الطويل</span></footer>
  </div></main>;
}
