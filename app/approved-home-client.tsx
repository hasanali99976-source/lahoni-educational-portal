"use client";

import Link from "next/link";

const portals = [
  { href: "/admin", cls: "admin", tag: "الإدارة", title: "بوابة الإدارة", text: "إدارة المنصة والتقارير والمتابعة الشاملة", action: "دخول الإدارة", symbol: "◆" },
  { href: "/teacher", cls: "teacher", tag: "المعلم", title: "بوابة المعلم", text: "التحصيل والحضور والخطط ومتابعة الطلاب", action: "دخول المعلم", symbol: "✦" },
  { href: "/student", cls: "student", tag: "الطالب والأسرة", title: "بوابة الطالب / ولي الأمر", text: "التحصيل والملاحظات والحضور والتقدم الدراسي", action: "دخول الطالب / ولي الأمر", symbol: "◈" },
] as const;

const classroomPhoto = "https://images.unsplash.com/photo-1746862932765-c450b9d2f3c5?auto=format&fit=crop&fm=jpg&q=90&w=2600";

const css = `
#lahooni-home{min-height:100dvh;direction:rtl;position:relative;overflow-x:hidden;background:#f3eadb;color:#0d2c40;font-family:inherit}
#lahooni-home *{box-sizing:border-box}
.ref-bg{position:fixed;inset:0;background:url('${classroomPhoto}') center/cover no-repeat;filter:saturate(.95) contrast(.95) brightness(1.14);transform:scale(1.018)}
.ref-bg:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(250,247,239,.48),rgba(246,239,226,.64) 44%,rgba(237,225,205,.82)),radial-gradient(circle at 50% 14%,rgba(255,255,255,.76),transparent 40%)}
.light-orb{position:fixed;border-radius:50%;filter:blur(65px);pointer-events:none;opacity:.36;animation:drift 8s ease-in-out infinite}.o1{width:260px;height:260px;background:#fff2c7;right:-60px;top:18%}.o2{width:300px;height:300px;background:#a8e9df;left:-80px;bottom:8%;animation-delay:-3s}@keyframes drift{50%{transform:translateY(-16px) scale(1.05)}}
.page{position:relative;z-index:2;width:min(1280px,95vw);margin:auto;padding:18px 0 22px;min-height:100dvh;display:flex;flex-direction:column}
.nav{height:72px;padding:8px 14px 8px 10px;border-radius:25px;background:linear-gradient(135deg,rgba(7,35,53,.96),rgba(8,51,69,.92));box-shadow:0 18px 38px rgba(20,41,48,.16),inset 0 1px rgba(255,255,255,.1);display:flex;align-items:center;justify-content:space-between;border:1px solid rgba(255,255,255,.16);backdrop-filter:blur(16px)}
.brand{display:flex;align-items:center;gap:11px;color:#fff}.brand img{width:53px;height:53px;border-radius:17px;object-fit:cover;border:2px solid #e6bb63;box-shadow:0 8px 18px rgba(0,0,0,.24)}.brand strong{display:block;font-size:14px;font-weight:950;letter-spacing:-.2px}.brand span{display:block;font-size:8.5px;color:#cddce3;margin-top:2px}.nav-links{display:flex;align-items:center;gap:8px}.nav-pill{padding:9px 13px;border-radius:14px;color:#dbe8ed;font-size:9px;font-weight:850;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.045)}.nav-pill.gold{background:linear-gradient(135deg,#e9bf69,#c99438);color:#102f42;border:0;box-shadow:0 8px 20px rgba(190,135,36,.25)}
.hero{position:relative;text-align:center;padding:34px 18px 18px}.hero:before{content:"";position:absolute;left:15%;right:15%;top:0;height:1px;background:linear-gradient(90deg,transparent,rgba(10,49,67,.12),transparent)}.mini{display:inline-flex;align-items:center;gap:7px;padding:6px 11px;border-radius:999px;background:rgba(255,255,255,.63);border:1px solid rgba(255,255,255,.88);box-shadow:0 10px 24px rgba(72,66,50,.08);font-size:9px;font-weight:900;color:#2c5968;backdrop-filter:blur(10px)}.mini:before{content:"";width:7px;height:7px;border-radius:50%;background:#d9a43f;box-shadow:0 0 0 4px rgba(217,164,63,.13)}
.hero .over{display:block;margin-top:11px;font-size:16px;font-weight:800;color:#315463}.hero h1{margin:3px 0 0;font-size:clamp(37px,5.2vw,65px);line-height:1.03;font-weight:950;letter-spacing:-1.7px;color:#0c3348;text-shadow:0 2px 0 rgba(255,255,255,.9)}.hero h1 em{font-style:normal;color:#c79334}.hero p{margin:11px auto 0;max-width:680px;font-size:12px;line-height:1.85;color:#526d79;font-weight:700}.gold-rule{width:130px;height:3px;border-radius:999px;background:linear-gradient(90deg,transparent,#d5a345,transparent);margin:13px auto 0}
.portal-wrap{position:relative;margin-top:4px}.portal-caption{text-align:center;font-size:9px;font-weight:900;color:#607681;margin-bottom:10px}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;direction:ltr;perspective:1400px}.portal-card{direction:rtl;text-decoration:none;position:relative;min-height:292px;border-radius:30px;padding:18px 18px 16px;overflow:hidden;display:flex;flex-direction:column;align-items:center;text-align:center;border:1px solid rgba(255,255,255,.87);box-shadow:0 23px 45px rgba(55,67,65,.12),0 2px 0 rgba(255,255,255,.9) inset;backdrop-filter:blur(20px) saturate(1.2);transform-style:preserve-3d;transition:.3s cubic-bezier(.2,.8,.2,1)}.portal-card:hover{transform:translateY(-10px) rotateX(2deg) translateZ(30px);box-shadow:0 34px 58px rgba(42,58,61,.18)}.portal-card:before{content:"";position:absolute;inset:0;background:linear-gradient(130deg,rgba(255,255,255,.64),rgba(255,255,255,.12) 35%,transparent 65%);pointer-events:none}.portal-card:after{content:"";position:absolute;width:160px;height:160px;border-radius:50%;top:-80px;left:-55px;background:rgba(255,255,255,.52);filter:blur(9px)}.admin{background:linear-gradient(150deg,rgba(255,246,226,.91),rgba(229,203,154,.78));color:#4b3516}.teacher{background:linear-gradient(150deg,rgba(231,245,255,.91),rgba(166,211,239,.78));color:#123f5e}.student{background:linear-gradient(150deg,rgba(234,255,248,.92),rgba(163,226,207,.78));color:#135843}
.card-top{position:relative;z-index:2;width:100%;display:flex;align-items:center;justify-content:space-between}.tag{font-size:8.5px;font-weight:950;opacity:.66}.dotset{display:flex;gap:4px}.dotset i{display:block;width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.25}
.art{position:relative;z-index:2;width:128px;height:102px;margin:3px 0 10px;transform-style:preserve-3d}.pod{position:absolute;inset:8px 11px 15px;border-radius:29px;background:linear-gradient(145deg,rgba(255,255,255,.98),rgba(255,255,255,.52));border:1px solid rgba(255,255,255,.9);box-shadow:0 18px 28px rgba(32,48,52,.15),inset 0 1px rgba(255,255,255,.95);transform:rotateX(10deg) rotateY(-8deg) translateZ(18px)}.portal-card:nth-child(2) .pod{transform:rotateX(10deg) rotateY(8deg) translateZ(18px)}.symbol{position:absolute;inset:0;display:grid;place-items:center;font-size:38px;font-weight:950;filter:drop-shadow(0 10px 10px rgba(30,50,55,.15));transform:translateZ(42px)}.shelf{position:absolute;left:18px;right:18px;bottom:5px;height:13px;border-radius:7px;background:linear-gradient(180deg,rgba(74,84,82,.16),rgba(74,84,82,.05));box-shadow:0 7px 12px rgba(26,45,50,.12)}
.portal-card h2{position:relative;z-index:2;margin:0 0 6px;font-size:21px;font-weight:950;letter-spacing:-.35px}.portal-card p{position:relative;z-index:2;margin:0;max-width:270px;font-size:10.5px;line-height:1.72;font-weight:720;opacity:.78}.enter{position:relative;z-index:2;margin-top:auto;width:100%;height:44px;border-radius:22px;display:flex;align-items:center;justify-content:center;gap:8px;font-size:10.5px;font-weight:950;background:rgba(255,255,255,.58);border:1px solid rgba(255,255,255,.82);box-shadow:inset 0 1px rgba(255,255,255,.9),0 9px 18px rgba(44,59,62,.08)}.enter:after{content:"←";font-size:17px}
.feature-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-top:17px;padding:10px;border-radius:23px;background:rgba(255,255,255,.58);border:1px solid rgba(255,255,255,.83);box-shadow:0 18px 38px rgba(65,69,59,.09);backdrop-filter:blur(15px)}.feature{display:flex;align-items:center;justify-content:center;gap:9px;padding:9px 7px;border-radius:15px;color:#365965;font-size:8.6px;font-weight:700}.feature b{display:block;color:#143c4e;font-size:9.8px;margin-bottom:1px}.feature-icon{width:31px;height:31px;border-radius:11px;display:grid;place-items:center;background:linear-gradient(145deg,#fff,#e9e0cf);box-shadow:0 8px 15px rgba(57,70,68,.09);color:#c69337;font-weight:950}
.footer{position:relative;margin-top:14px;min-height:54px;border-radius:22px;background:linear-gradient(135deg,rgba(7,36,54,.97),rgba(8,57,69,.94));box-shadow:0 18px 34px rgba(17,42,50,.13);display:flex;align-items:center;justify-content:center;color:#c8d9df;font-size:8.8px;overflow:hidden}.footer:before{content:"";position:absolute;width:420px;height:90px;border-radius:50%;background:rgba(226,181,93,.09);top:-62px;right:12%}.footer b{color:#edc36f}.footer span{position:relative;z-index:2}
@media(max-width:780px){.page{width:96vw;padding-top:8px}.nav{height:62px;border-radius:20px}.brand img{width:45px;height:45px}.brand strong{font-size:11px}.brand span,.nav-links{display:none}.hero{padding:22px 9px 13px}.hero h1{font-size:31px;letter-spacing:-.8px}.hero .over{font-size:12px}.hero p{font-size:9.8px}.cards{grid-template-columns:1fr;direction:rtl;gap:10px}.portal-card{min-height:158px;display:grid;grid-template-columns:90px 1fr;grid-template-rows:20px auto auto 40px;text-align:right;column-gap:10px;padding:10px 12px}.card-top{grid-column:1/3}.art{grid-row:2/4;width:88px;height:82px;margin:0}.portal-card h2{font-size:16px;margin:0}.portal-card p{font-size:9px}.enter{grid-column:1/3;height:40px}.feature-strip{grid-template-columns:repeat(2,1fr)}.feature{justify-content:flex-start}.footer{min-height:46px}}
`;

export default function ApprovedHomeClient(){
  return <main id="lahooni-home" dir="rtl">
    <style>{css}</style>
    <div className="ref-bg" aria-hidden="true"/>
    <span className="light-orb o1"/><span className="light-orb o2"/>
    <div className="page">
      <header className="nav">
        <div className="brand"><img src="/icons/lahooni-identity-320.jpg" alt="هوية منصة أستاذ لحوني التعليمية"/><div><strong>منصة أستاذ لحوني التعليمية</strong><span>بيئة تعليمية رقمية ذكية ومترابطة</span></div></div>
        <div className="nav-links"><span className="nav-pill">المرحلة الثانوية</span><span className="nav-pill">متابعة ذكية</span><span className="nav-pill gold">منصة أكاديمية حديثة</span></div>
      </header>

      <section className="hero">
        <span className="mini">منصة تعليمية ذكية</span>
        <span className="over">مرحبًا بكم في</span>
        <h1>أستاذ لحوني <em>التعليمية</em></h1>
        <p>بيئة رقمية متكاملة لمتابعة الطلاب وتحقيق التميز الدراسي، تجمع الإدارة والمعلم والطالب وولي الأمر في تجربة أكاديمية واحدة واضحة وحديثة.</p>
        <div className="gold-rule"/>
      </section>

      <section className="portal-wrap" aria-label="بوابات الدخول">
        <div className="portal-caption">اختر بوابتك للدخول</div>
        <div className="cards">
          {portals.map(p=><Link key={p.href} href={p.href} className={`portal-card ${p.cls}`}>
            <div className="card-top"><span className="tag">{p.tag}</span><span className="dotset"><i/><i/><i/></span></div>
            <div className="art" aria-hidden="true"><div className="pod"/><div className="symbol">{p.symbol}</div><div className="shelf"/></div>
            <h2>{p.title}</h2><p>{p.text}</p><div className="enter">{p.action}</div>
          </Link>)}
        </div>
      </section>

      <section className="feature-strip" aria-label="مزايا المنصة">
        <div className="feature"><span className="feature-icon">01</span><span><b>متابعة ذكية</b>تحصيل وتقدم دراسي</span></div>
        <div className="feature"><span className="feature-icon">02</span><span><b>تقارير فورية</b>مؤشرات واضحة ودقيقة</span></div>
        <div className="feature"><span className="feature-icon">03</span><span><b>تواصل مترابط</b>إدارة ومعلم وأسرة</span></div>
        <div className="feature"><span className="feature-icon">04</span><span><b>بيئة آمنة</b>خصوصية واستقرار</span></div>
      </section>

      <footer className="footer"><span>تصميم وتنفيذ: <b>أ. حسن علي الطويل</b></span></footer>
    </div>
  </main>;
}
