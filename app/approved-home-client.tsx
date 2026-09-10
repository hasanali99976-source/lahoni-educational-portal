"use client";

import Link from "next/link";

const cards = [
  { href: "/admin", cls: "admin", icon: "▥", title: "بوابة الإدارة", text: "إدارة شاملة لبيئة تعليمية فعّالة", action: "دخول الإدارة" },
  { href: "/teacher", cls: "teacher", icon: "♟", title: "بوابة المعلم", text: "معًا نصنع الفرق في تعليم أبنائنا", action: "دخول المعلم" },
  { href: "/student", cls: "student", icon: "♜", title: "بوابة الطالب / ولي الأمر", text: "شراكة حقيقية لرحلة نجاح متميزة", action: "دخول الطالب / ولي الأمر" },
] as const;

const css = `
#lahooni-ref{min-height:100dvh;direction:rtl;color:#102a45;background:#e8e4df;position:relative;overflow:hidden;font-family:inherit}
#lahooni-ref *{box-sizing:border-box}
#lahooni-ref:before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(248,245,240,.18),rgba(250,248,245,.72) 29%,rgba(255,255,255,.88) 50%,rgba(249,246,241,.64) 72%,rgba(231,222,210,.2)),url('/saudi-classroom.svg') center/cover no-repeat;filter:saturate(.7);transform:scale(1.02)}
.ref-shade{position:absolute;inset:0;background:radial-gradient(circle at 50% 38%,rgba(255,255,255,.45),transparent 42%),linear-gradient(to bottom,transparent 72%,rgba(12,37,58,.18));pointer-events:none}
.ref-shell{position:relative;z-index:2;width:min(1280px,94%);margin:auto;padding:18px 0 0;min-height:100dvh;display:flex;flex-direction:column}
.ref-nav{align-self:flex-start;display:flex;align-items:center;gap:5px;background:linear-gradient(135deg,#173a58,#0c2942);padding:8px 12px;border-radius:0 0 22px 22px;box-shadow:0 14px 30px rgba(12,35,55,.24);color:#fff}
.ref-nav span{padding:10px 16px;font-size:13px;white-space:nowrap;opacity:.88}.ref-nav .active{color:#f1d08a;background:linear-gradient(145deg,rgba(255,255,255,.13),rgba(216,175,91,.08));border:1px solid rgba(232,197,126,.28);border-radius:16px;font-weight:800}
.ref-hero{text-align:center;padding:28px 20px 14px}.ref-hero .mini{font-size:25px;margin-bottom:3px}.ref-hero h1{margin:0;color:#0b3157;font-size:clamp(38px,5.2vw,72px);font-weight:950;letter-spacing:-2px;text-shadow:0 5px 14px rgba(255,255,255,.75)}.ref-hero p{margin:6px 0 0;font-size:18px;color:#263a4c}.gold-line{width:110px;height:3px;margin:18px auto 0;border-radius:20px;background:linear-gradient(90deg,transparent,#d6a846,transparent)}
.ref-main{display:grid;grid-template-columns:150px 1fr 150px;gap:24px;align-items:center;flex:1}.side-copy{font-size:23px;line-height:1.75;color:#253849;text-align:center}.side-copy:after{content:"";display:block;width:70px;height:3px;background:#d9a743;margin:13px auto;border-radius:10px}.side-books{align-self:end;padding-bottom:115px}.book{background:linear-gradient(90deg,#0d263c,#172f45);color:#d8b563;border-radius:3px;margin:6px 0;padding:8px 12px;text-align:center;font-weight:800;box-shadow:0 7px 13px rgba(0,0,0,.18);font-size:13px}
.ref-center{min-width:0}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;direction:ltr}.portal{direction:rtl;min-height:365px;border-radius:24px;padding:28px 23px 22px;text-decoration:none;color:#17212c;display:flex;flex-direction:column;align-items:center;text-align:center;border:1px solid rgba(255,255,255,.78);box-shadow:0 18px 32px rgba(31,49,63,.19),inset 0 1px rgba(255,255,255,.9);transition:.25s ease;backdrop-filter:blur(15px)}.portal:hover{transform:translateY(-8px) scale(1.015);box-shadow:0 27px 45px rgba(25,43,58,.25)}.portal.admin{background:linear-gradient(150deg,rgba(255,249,235,.92),rgba(239,223,190,.83))}.portal.teacher{background:linear-gradient(150deg,rgba(230,245,255,.94),rgba(186,220,247,.84))}.portal.student{background:linear-gradient(150deg,rgba(229,255,248,.94),rgba(180,235,219,.85))}
.portal-icon{width:128px;height:112px;margin:2px 0 13px;border-radius:25px;display:grid;place-items:center;font-size:67px;font-weight:900;color:#153f67;text-shadow:0 8px 12px rgba(0,0,0,.18);filter:drop-shadow(0 10px 10px rgba(0,0,0,.12))}.student .portal-icon{color:#08745b}.admin .portal-icon{color:#8b641e}.portal h2{font-size:25px;margin:4px 0 7px;font-weight:950}.portal p{font-size:14px;line-height:1.8;margin:0;color:#33404a}.enter{margin-top:auto;width:100%;min-height:50px;border-radius:28px;display:flex;align-items:center;justify-content:center;position:relative;color:#fff;font-weight:850;font-size:14px;box-shadow:0 11px 18px rgba(0,0,0,.18)}.admin .enter{background:linear-gradient(90deg,#bb8b2d,#d8af5b)}.teacher .enter{background:linear-gradient(90deg,#15538b,#1e72b2)}.student .enter{background:linear-gradient(90deg,#078361,#12a077)}.enter b{position:absolute;left:-3px;width:48px;height:48px;border-radius:50%;display:grid;place-items:center;background:#f7fbfb;color:#183a54;font-size:25px;box-shadow:0 6px 14px rgba(0,0,0,.18)}
.features{margin:27px auto 0;width:min(760px,100%);display:grid;grid-template-columns:repeat(4,1fr);background:rgba(255,255,255,.62);backdrop-filter:blur(16px);border-radius:22px;box-shadow:0 15px 35px rgba(32,49,62,.12);overflow:hidden}.feature{padding:18px 13px;text-align:center;border-left:1px solid rgba(35,58,77,.12);font-size:11px;line-height:1.65;color:#293b4b}.feature:last-child{border-left:0}.feature b{display:block;font-size:31px;color:#2d4b64;margin-bottom:5px}
.ref-footer{margin-top:25px;background:#102d45;color:#e8edf1;text-align:center;padding:15px 20px;font-size:12px;border-radius:70% 70% 0 0/18px 18px 0 0}.ref-footer span{color:#d9b462;margin:0 14px}
@media(max-width:950px){.ref-main{grid-template-columns:1fr}.side-copy,.side-books{display:none}.cards{gap:12px}.portal{min-height:330px;padding:20px 15px}.portal h2{font-size:20px}.portal-icon{width:100px;height:90px;font-size:54px}.ref-nav{align-self:center}.ref-hero{padding-top:20px}}
@media(max-width:700px){.ref-shell{width:96%;padding-top:8px}.ref-nav{width:100%;justify-content:center;border-radius:18px;padding:5px}.ref-nav span{padding:8px 7px;font-size:9px}.ref-hero h1{font-size:36px;letter-spacing:-1px}.ref-hero .mini{font-size:17px}.ref-hero p{font-size:13px}.cards{grid-template-columns:1fr;direction:rtl}.portal{min-height:250px;display:grid;grid-template-columns:82px 1fr;grid-template-rows:auto auto 55px;text-align:right;column-gap:15px;align-items:center}.portal-icon{grid-row:1/3;width:82px;height:82px;font-size:45px;margin:0}.portal h2{margin:0;font-size:20px}.portal p{font-size:12px}.enter{grid-column:1/3;margin-top:8px}.features{grid-template-columns:repeat(2,1fr)}.feature{border-bottom:1px solid rgba(35,58,77,.12)}.ref-footer{border-radius:25px 25px 0 0}}
`;

export default function ApprovedHomeClient(){
  return <main id="lahooni-ref" dir="rtl">
    <style>{css}</style><div className="ref-shade" />
    <div className="ref-shell">
      <nav className="ref-nav" aria-label="التنقل الرئيسي"><span className="active">⌂ الرئيسية</span><span>ⓘ عن المنصة</span><span>◉ مركز المعرفة</span><span>▤ مركز المساعدة</span></nav>
      <header className="ref-hero"><div className="mini">منصة</div><h1>أستاذ لحوني التعليمية</h1><p>بيئة رقمية لمتابعة الطلاب وتحقيق التميز الدراسي</p><div className="gold-line" /></header>
      <section className="ref-main">
        <aside className="side-copy">بالعلم<br/>نصنع<br/>المستقبل</aside>
        <div className="ref-center">
          <div className="cards">{cards.map(c=><Link key={c.href} href={c.href} className={`portal ${c.cls}`}><div className="portal-icon" aria-hidden="true">{c.icon}</div><h2>{c.title}</h2><p>{c.text}</p><div className="enter">{c.action}<b>←</b></div></Link>)}</div>
          <div className="features"><div className="feature"><b>⌁</b>متابعة مستمرة<br/>للنمو الدراسي</div><div className="feature"><b>◎</b>أدوات ذكية<br/>لتحقيق الأهداف</div><div className="feature"><b>♟</b>تواصل فعّال<br/>بين جميع الأطراف</div><div className="feature"><b>♢</b>بيئة آمنة<br/>وخصوصية عالية</div></div>
        </div>
        <aside className="side-books"><div className="book">معرفة</div><div className="book">مهارة</div><div className="book">تطوير</div><div className="book">مستقبل</div></aside>
      </section>
      <footer className="ref-footer"><span>ــــ</span> تصميم وتنفيذ: الأستاذ حسن علي الطويل <span>ــــ</span></footer>
    </div>
  </main>
}
