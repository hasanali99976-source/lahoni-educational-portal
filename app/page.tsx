"use client";

import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";

const studentUrl = "https://tahdheeb-history.vercel.app/student";

export default function HomePage() {
  const router = useRouter();

  function openPortal(path:string){
    try{
      const Ctx=window.AudioContext||(window as typeof window & {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
      if(Ctx){const ctx=new Ctx();const g=ctx.createGain();g.connect(ctx.destination);g.gain.setValueAtTime(.0001,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.12,ctx.currentTime+.02);[523,659,784].forEach((f,i)=>{const o=ctx.createOscillator();o.frequency.value=f;o.connect(g);o.start(ctx.currentTime+i*.07);o.stop(ctx.currentTime+i*.07+.12)});g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.4);setTimeout(()=>ctx.close(),550)}
    }catch{}
    setTimeout(()=>router.push(path),180);
  }

  return <main className="lahooni-v3" dir="rtl">
    <section className="v3-shell">
      <div className="v3-visual">
        <img src="/portal-cover.webp" alt="بوابة أستاذ لحوني التعليمية" />
        <div className="v3-visual-shade"/>
        <div className="v3-badge">منصة تعليمية تفاعلية</div>
      </div>

      <div className="v3-content">
        <header className="v3-title">
          <span>بوابة</span>
          <h1>أستاذ لحوني</h1>
          <h2>التعليمية</h2>
          <p>إدارة سهلة • متابعة دقيقة • تعليم بإتقان</p>
        </header>

        <div className="v3-entries">
          <button className="v3-entry student" onClick={()=>openPortal('/student')}>
            <span className="v3-icon"><svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v2"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14h1a4 4 0 0 1 4 4v2"/></svg></span>
            <div><strong>بوابة الطالب وولي الأمر</strong><small>الدرجات، الحضور، التنبيهات، ومستوى الإتقان</small></div>
            <b>دخول البوابة</b>
          </button>
          <button className="v3-entry teacher" onClick={()=>openPortal('/teacher')}>
            <span className="v3-icon"><svg viewBox="0 0 24 24"><circle cx="9" cy="7" r="3"/><path d="M3 19v-1a6 6 0 0 1 12 0v1"/><path d="M15 5h6v9h-4"/><path d="m17 9 2 2 3-4"/></svg></span>
            <div><strong>بوابة المعلم</strong><small>الرصد، التحضير، التقارير، وإدارة الطلاب</small></div>
            <b>دخول البوابة</b>
          </button>
        </div>

        <a className="v3-qr" href="/student">
          <QRCodeSVG value={studentUrl} size={92} includeMargin/>
          <div><strong>الدخول السريع لولي الأمر</strong><span>امسح الرمز للانتقال مباشرة إلى بوابة الطالب</span></div>
          <i>QR</i>
        </a>

        <div className="v3-features">
          <article><span>🔒</span><b>خصوصية وأمان</b><small>بيانات محفوظة ودخول آمن</small></article>
          <article><span>📊</span><b>متابعة ذكية</b><small>تقارير ودرجات محدثة</small></article>
          <article><span>🎧</span><b>دعم ومساعدة</b><small>تواصل مباشر مع المعلم</small></article>
        </div>
        <footer>جميع الحقوق محفوظة © بوابة أستاذ لحوني التعليمية 2026</footer>
      </div>
    </section>

    <style jsx global>{`
      .lahooni-v3{min-height:100vh;padding:18px;background:radial-gradient(circle at 85% 8%,#e4f5f1 0,transparent 26%),linear-gradient(135deg,#f6faf9,#edf5f4);font-family:inherit;color:#154b57}.v3-shell{width:min(1440px,100%);min-height:820px;margin:auto;display:grid;grid-template-columns:1.08fr .92fr;background:#fff;border-radius:34px;overflow:hidden;box-shadow:0 32px 90px rgba(14,69,80,.17);border:1px solid rgba(205,226,225,.8)}.v3-visual{position:relative;min-height:820px;overflow:hidden;background:#edf5f3}.v3-visual img{width:100%;height:100%;object-fit:cover;object-position:center top;display:block;filter:saturate(1.05) contrast(1.02);transform:scale(1.01)}.v3-visual-shade{position:absolute;inset:0;background:linear-gradient(90deg,transparent 58%,rgba(255,255,255,.86) 100%)}.v3-badge{position:absolute;right:24px;top:24px;padding:9px 15px;border-radius:999px;background:rgba(255,255,255,.9);color:#0b7280;font-size:12px;font-weight:900;box-shadow:0 10px 24px rgba(16,82,91,.12)}.v3-content{padding:42px 42px 24px;display:flex;flex-direction:column;justify-content:center;background:linear-gradient(180deg,#fff,#fbfdfc)}.v3-title{text-align:center}.v3-title>span{font-size:25px}.v3-title h1{margin:3px 0 0;font-size:56px;line-height:1;color:#0a6070;font-weight:900}.v3-title h2{margin:4px 0 13px;font-size:31px;color:#c88b1c}.v3-title p{margin:0;color:#52727a;font-weight:800}.v3-entries{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:31px}.v3-entry{position:relative;border:1px solid #dce9e7;border-radius:23px;padding:22px 18px;background:#fff;text-align:center;cursor:pointer;box-shadow:0 12px 28px rgba(20,75,84,.08);transition:.25s;overflow:hidden}.v3-entry:before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 50% 0,rgba(255,255,255,.9),transparent 58%);opacity:0;transition:.25s}.v3-entry:hover{transform:translateY(-7px);box-shadow:0 20px 40px rgba(20,75,84,.14)}.v3-entry:hover:before{opacity:1}.v3-icon{position:relative;z-index:1;width:70px;height:70px;margin:auto;border-radius:50%;display:grid;place-items:center;color:#fff}.v3-icon svg{width:35px;height:35px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.student .v3-icon{background:linear-gradient(135deg,#1e9a61,#42bd7b)}.teacher .v3-icon{background:linear-gradient(135deg,#c58a1c,#e4ad3b)}.v3-entry div{position:relative;z-index:1}.v3-entry strong{display:block;margin-top:15px;font-size:20px}.student strong{color:#248e59}.teacher strong{color:#b97b0f}.v3-entry small{display:block;margin:9px 0 15px;color:#71868c;line-height:1.8}.v3-entry b{position:relative;z-index:1;display:block;padding:12px;border-radius:11px;color:#fff}.student b{background:#249458}.teacher b{background:#cf901b}.v3-qr{margin-top:18px;padding:13px 17px;border:1px solid #dfe9e8;border-radius:20px;background:#fff;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:16px;text-decoration:none;color:#175965;box-shadow:0 10px 24px rgba(20,75,84,.07);transition:.22s}.v3-qr:hover{transform:translateY(-3px);box-shadow:0 15px 31px rgba(20,75,84,.12)}.v3-qr div{display:flex;flex-direction:column;gap:5px}.v3-qr strong{font-size:18px}.v3-qr span{font-size:12px;color:#71868c}.v3-qr i{width:48px;height:48px;border-radius:15px;background:#eaf6f4;color:#0b7884;display:grid;place-items:center;font-style:normal;font-weight:900}.v3-features{display:grid;grid-template-columns:repeat(3,1fr);margin-top:18px;border:1px solid #e1ebea;border-radius:20px;background:#fff;overflow:hidden}.v3-features article{padding:16px 10px;text-align:center;display:flex;flex-direction:column;gap:5px;border-left:1px solid #e8efee}.v3-features article:last-child{border-left:0}.v3-features article>span{font-size:22px}.v3-features b{font-size:13px}.v3-features small{font-size:10px;color:#74898e}.v3-content footer{text-align:center;margin-top:18px;font-size:11px;color:#7b8e92}@media(max-width:980px){.v3-shell{grid-template-columns:1fr}.v3-visual{min-height:560px}.v3-visual-shade{background:linear-gradient(180deg,transparent 72%,rgba(255,255,255,.92))}.v3-content{padding:34px 24px}.v3-title h1{font-size:45px}}@media(max-width:600px){.lahooni-v3{padding:8px}.v3-shell{border-radius:22px}.v3-visual{min-height:380px}.v3-content{padding:26px 14px 19px}.v3-title h1{font-size:36px}.v3-title h2{font-size:25px}.v3-entries{grid-template-columns:1fr}.v3-features{grid-template-columns:1fr}.v3-features article{border-left:0;border-bottom:1px solid #e8efee}.v3-features article:last-child{border-bottom:0}.v3-qr{grid-template-columns:auto 1fr}.v3-qr i{display:none}}
    `}</style>
  </main>;
}
