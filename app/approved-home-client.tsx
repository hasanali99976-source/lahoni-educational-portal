"use client";

import Link from "next/link";
import StudentDirectQr from "./student-direct-qr";
import "./student-direct-qr.css";

const IDENTITY = "/icons/lahooni-identity-320.jpg";

const portals = [
  {
    href: "/admin",
    key: "admin",
    eyebrow: "مركز القرار",
    title: "الإدارة",
    text: "قيادة المعلمين والطلاب والفصول والتقارير من مساحة واحدة واضحة.",
    accent: "إدارة وتشغيل",
  },
  {
    href: "/teacher",
    key: "teacher",
    eyebrow: "مساحة العمل",
    title: "المعلم",
    text: "الحضور والدرجات والمتابعة والتحليل والخطط اليومية بواجهة ذكية.",
    accent: "تعليم ومتابعة",
  },
  {
    href: "/student",
    key: "student",
    eyebrow: "متابعة التحصيل",
    title: "الطالب وولي الأمر",
    text: "التحصيل والاختبارات والحضور وملاحظات المعلم في بوابة واحدة.",
    accent: "تحصيل وتواصل",
  },
] as const;

const subjects = [
  ["📜", "التاريخ"],
  ["🧠", "التفكير الناقد"],
  ["➗", "الرياضيات"],
  ["🔬", "العلوم"],
  ["🧪", "الكيمياء"],
  ["🌍", "الجغرافيا"],
  ["📖", "اللغة العربية"],
  ["🇬🇧", "اللغة الإنجليزية"],
  ["🕌", "الدراسات الإسلامية"],
] as const;

function PortalIcon({ kind }: { kind: (typeof portals)[number]["key"] }) {
  if (kind === "admin") return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 5l5 3 6-.5 2 5.5 5 3-2 5.8 2 5.7-5 3-2 5.5-6-.5-5 3-5-3-6 .5-2-5.5-5-3 2-5.7-2-5.8 5-3 2-5.5 6 .5 5-3Z"/><path d="m18.5 24 4 4 8-9"/></svg>;
  if (kind === "teacher") return <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="15" cy="14" r="5.5"/><path d="M6 39v-9c0-5 4-9 9-9s9 4 9 9v9"/><rect x="27" y="9" width="15" height="21" rx="3"/><path d="M30 15h9M30 20h7M24 27l8-6"/></svg>;
  return <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="17" cy="15" r="6.5"/><circle cx="32" cy="19" r="5"/><path d="M6 39c1.6-8 6.2-12 11-12s9.5 4 11 12M27 39c1.2-5.4 4.2-8.3 7.5-8.3S40.8 33.6 42 39"/></svg>;
}

const styles = `
:root{--lh-deep:#032f37;--lh-deep2:#07515a;--lh-teal:#0d7f77;--lh-mint:#20ad92;--lh-gold:#d9aa47;--lh-gold2:#f2d27e;--lh-paper:#f2f8f6;--lh-ink:#123f47;--lh-muted:#6f8385;--lh-line:#d7e6e2}
html:has(.lh-home),body:has(.lh-home){margin:0!important;padding:0!important;background:var(--lh-paper)!important;overflow-x:hidden!important}
body:has(.lh-home) .portal-stage{min-height:100dvh!important;background:transparent!important}
.lh-home{min-height:100dvh;position:relative;overflow:hidden;background:linear-gradient(180deg,#032d35 0,#07525a 49%,#eff7f5 49%,#eff7f5 100%);color:var(--lh-ink);padding:16px 20px 24px}
.lh-home *{box-sizing:border-box}.lh-home:before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 10% 6%,rgba(32,173,146,.2),transparent 26%),radial-gradient(circle at 88% 10%,rgba(217,170,71,.16),transparent 24%);pointer-events:none}
.lh-shell{position:relative;z-index:2;width:min(1480px,100%);margin:auto}
.lh-top{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:68px;padding:8px 12px;border:1px solid rgba(242,210,126,.38);border-radius:22px;background:rgba(2,37,43,.72);backdrop-filter:blur(18px);box-shadow:0 16px 42px rgba(0,0,0,.16)}
.lh-brand{display:flex;align-items:center;gap:11px}.lh-brand img{width:50px;height:50px;border-radius:15px;object-fit:cover;border:2px solid var(--lh-gold2);box-shadow:0 7px 18px rgba(0,0,0,.22)}.lh-brand div{display:grid}.lh-brand strong{color:#fff;font-size:18px;font-weight:950}.lh-brand small{margin-top:2px;color:#ebca72;font-size:10px;font-weight:850}
.lh-top-status{display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.055);color:#d7eae6;font-size:11px;font-weight:850}.lh-top-status i{width:8px;height:8px;border-radius:50%;background:#52d6a9;box-shadow:0 0 14px #52d6a9}
.lh-hero{display:grid;grid-template-columns:minmax(0,1.2fr) 320px;gap:24px;align-items:center;min-height:270px;padding:25px 18px 18px}.lh-copy{padding:8px}.lh-kicker{display:inline-flex;align-items:center;gap:8px;color:var(--lh-gold2);font-size:12px;font-weight:950}.lh-kicker:before{content:"";width:30px;height:2px;background:linear-gradient(90deg,var(--lh-gold2),transparent)}.lh-copy h1{margin:8px 0 10px;color:#fff;font-size:clamp(36px,4vw,58px);line-height:1.08;font-weight:950;letter-spacing:-1.2px}.lh-copy h1 span{color:var(--lh-gold2)}.lh-copy p{margin:0;max-width:810px;color:#cce5e1;font-size:16px;line-height:1.85}.lh-copy p b{color:#fff}.lh-hero-tags{display:flex;flex-wrap:wrap;gap:7px;margin-top:15px}.lh-hero-tags span{padding:7px 11px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.055);color:#e4f2ef;font-size:10px;font-weight:850}
.lh-quick{position:relative;overflow:hidden;display:grid;place-items:center;align-content:center;min-height:215px;padding:14px;border:1px solid rgba(242,210,126,.52);border-radius:26px;background:linear-gradient(155deg,rgba(255,255,255,.98),rgba(240,249,246,.96));box-shadow:0 23px 55px rgba(0,0,0,.2)}.lh-quick:before{content:"الدخول السريع";display:block;margin-bottom:4px;color:#9b6e1d;font-size:11px;font-weight:950}.lh-quick>strong{color:#0a5e61;font-size:16px}.lh-quick>small{margin:3px 0 6px;color:#7b8d8f;font-size:9px}.lh-quick .v3-student-quick{margin:0!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important}.lh-quick .v3-student-quick-copy{display:none!important}.lh-quick .v3-student-qr-wrap{padding:6px!important;border:0!important;background:#fff!important;box-shadow:none!important}.lh-quick .v3-student-qr-wrap svg{width:104px!important;height:104px!important}.lh-quick .v3-student-qr-wrap small{display:none!important}.lh-quick .v3-student-qr-wrap strong{font-size:9px!important;color:#0c6863!important}
.lh-subject-zone{position:relative;margin:0 4px 16px;overflow:hidden;border:1px solid rgba(231,207,143,.28);border-radius:20px;background:rgba(3,45,52,.68);box-shadow:inset 0 1px rgba(255,255,255,.06)}.lh-subject-zone:before,.lh-subject-zone:after{content:"";position:absolute;top:0;bottom:0;width:70px;z-index:3;pointer-events:none}.lh-subject-zone:before{right:0;background:linear-gradient(90deg,transparent,#06444c)}.lh-subject-zone:after{left:0;background:linear-gradient(270deg,transparent,#06444c)}.lh-subject-track{display:flex;width:max-content;gap:9px;padding:9px;animation:lhSubjects 30s linear infinite}.lh-subject-zone:hover .lh-subject-track{animation-play-state:paused}.lh-subject{display:flex;align-items:center;gap:8px;min-width:150px;padding:9px 12px;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.075);color:#fff;box-shadow:0 8px 18px rgba(0,0,0,.08)}.lh-subject b{width:34px;height:34px;display:grid;place-items:center;border-radius:10px;background:linear-gradient(145deg,rgba(32,173,146,.23),rgba(217,170,71,.18));font-size:18px}.lh-subject span{font-size:11px;font-weight:900;white-space:nowrap}.lh-subject small{display:block;color:#a9c9c4;font-size:7px}.lh-subject-copy{display:grid}.lh-subject-label{padding:8px 12px;color:#f0cf78;font-size:9px;font-weight:950;white-space:nowrap;align-self:center}
@keyframes lhSubjects{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.lh-access{position:relative;margin-top:0;padding:18px;border:1px solid rgba(210,229,224,.95);border-radius:30px;background:rgba(247,252,250,.97);box-shadow:0 22px 58px rgba(4,62,68,.13)}.lh-access-head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:12px;padding:0 3px}.lh-access-head div small{color:#aa7822;font-size:9px;font-weight:950}.lh-access-head h2{margin:2px 0 0;color:#0b5359;font-size:22px}.lh-access-head>span{color:#728789;font-size:10px}
.lh-portals{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.lh-portal{position:relative;overflow:hidden;display:grid;grid-template-columns:58px minmax(0,1fr) 40px;align-items:center;gap:13px;min-height:128px;padding:16px;border:1px solid #d8e6e2;border-radius:21px;background:#fff;text-decoration:none;color:var(--lh-ink);box-shadow:0 11px 27px rgba(5,71,76,.065);transition:.2s}.lh-portal:before{content:"";position:absolute;right:0;top:0;bottom:0;width:4px;background:linear-gradient(180deg,var(--lh-mint),var(--lh-gold))}.lh-portal:hover{transform:translateY(-4px);border-color:#bedbd4;box-shadow:0 18px 38px rgba(5,71,76,.12)}.lh-portal-icon{width:56px;height:56px;display:grid;place-items:center;border-radius:17px;background:linear-gradient(145deg,#e7f6f2,#fff);color:#0b716c;border:1px solid #d6e9e4}.lh-portal.student .lh-portal-icon{background:linear-gradient(145deg,#fff6db,#fff);color:#926619}.lh-portal-icon svg{width:33px;height:33px;fill:none;stroke:currentColor;stroke-width:2}.lh-portal-copy small{color:#a87922;font-size:8px;font-weight:950}.lh-portal-copy h3{margin:3px 0 5px;color:#0b5259;font-size:20px}.lh-portal-copy p{margin:0;color:#748689;font-size:10px;line-height:1.65}.lh-portal-arrow{width:38px;height:38px;display:grid;place-items:center;border-radius:12px;background:linear-gradient(135deg,#073e47,#0d8177);color:#fff;font-size:20px;box-shadow:0 8px 18px rgba(5,96,91,.16)}
.lh-bottom{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:13px;padding:10px 14px;color:#728486;font-size:9px}.lh-bottom b{color:#0c6963}.lh-bottom span{color:#9a6c1d;font-weight:850}
@media(max-width:980px){.lh-hero{grid-template-columns:1fr}.lh-quick{min-height:190px}.lh-portals{grid-template-columns:1fr}.lh-access-head>span{display:none}}
@media(max-width:640px){.lh-home{padding:10px}.lh-top{border-radius:18px}.lh-top-status{display:none}.lh-brand strong{font-size:15px}.lh-brand img{width:45px;height:45px}.lh-hero{padding:20px 4px 12px}.lh-copy h1{font-size:35px}.lh-copy p{font-size:14px}.lh-quick{min-height:180px}.lh-subject{min-width:132px}.lh-access{padding:12px;border-radius:23px}.lh-portal{grid-template-columns:50px minmax(0,1fr) 36px;padding:13px}.lh-portal-icon{width:48px;height:48px}.lh-bottom{display:block;text-align:center}.lh-bottom span{display:block;margin-top:4px}}
@media(prefers-reduced-motion:reduce){.lh-subject-track{animation:none}}
`;

export default function ApprovedHomeClient() {
  return <main className="lh-home" dir="rtl">
    <style>{styles}</style>
    <div className="lh-shell">
      <header className="lh-top">
        <div className="lh-brand">
          <img src={IDENTITY} alt="هوية بوابة أستاذ لحوني التعليمية" />
          <div><strong>بوابة أستاذ لحوني التعليمية</strong><small>تعليم • متابعة • تواصل</small></div>
        </div>
        <div className="lh-top-status"><i /> منصة تعليمية متصلة</div>
      </header>

      <section className="lh-hero">
        <div className="lh-copy">
          <span className="lh-kicker">منصة مدرسية ذكية</span>
          <h1>كل العملية التعليمية<br/><span>في بوابة واحدة.</span></h1>
          <p>تجمع <b>الإدارة والمعلم والطالب وولي الأمر</b> في تجربة واضحة، وتحوّل الدرجات والحضور والملاحظات والمتابعة إلى صورة تعليمية أسهل وأقرب.</p>
          <div className="lh-hero-tags"><span>متابعة التحصيل</span><span>الحضور والانضباط</span><span>تقارير تعليمية</span><span>تواصل أقرب</span></div>
        </div>
        <aside className="lh-quick">
          <strong>الطالب وولي الأمر</strong>
          <small>امسح الباركود للدخول مباشرة</small>
          <StudentDirectQr />
        </aside>
      </section>

      <section className="lh-subject-zone" aria-label="المواد الدراسية">
        <div className="lh-subject-track">
          {[...subjects, ...subjects].map(([icon, name], index) => <div className="lh-subject" key={`${name}-${index}`}>
            <b>{icon}</b><div className="lh-subject-copy"><span>{name}</span><small>مادة دراسية</small></div>
          </div>)}
        </div>
      </section>

      <section className="lh-access">
        <header className="lh-access-head"><div><small>اختر مساحتك</small><h2>الدخول إلى البوابة</h2></div><span>ثلاثة مسارات واضحة بدون تبويبات زائدة</span></header>
        <div className="lh-portals">
          {portals.map(portal => <Link className={`lh-portal ${portal.key}`} href={portal.href} key={portal.href}>
            <span className="lh-portal-icon"><PortalIcon kind={portal.key} /></span>
            <div className="lh-portal-copy"><small>{portal.eyebrow}</small><h3>{portal.title}</h3><p>{portal.text}</p></div>
            <span className="lh-portal-arrow">←</span>
          </Link>)}
        </div>
      </section>

      <footer className="lh-bottom"><b>بوابة أستاذ لحوني التعليمية</b><span>إعداد البوابة: الأستاذ حسن علي الطويل</span></footer>
    </div>
  </main>;
}
