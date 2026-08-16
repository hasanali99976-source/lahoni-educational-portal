"use client";

import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";

const studentUrl = "https://tahdheeb-history.vercel.app/student";

function playEntryTone(){
  try{
    const AudioCtx=window.AudioContext||(window as typeof window & {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
    if(!AudioCtx)return;
    const ctx=new AudioCtx(),gain=ctx.createGain();
    gain.connect(ctx.destination);gain.gain.setValueAtTime(.0001,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.08,ctx.currentTime+.02);
    [523.25,659.25,783.99].forEach((f,i)=>{const o=ctx.createOscillator();o.type="sine";o.frequency.value=f;o.connect(gain);const s=ctx.currentTime+i*.065;o.start(s);o.stop(s+.12)});
    gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.42);window.setTimeout(()=>void ctx.close(),600);
  }catch{}
}

function PortalIcon({kind}:{kind:"student"|"teacher"}){
  return kind==="student"?<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m3 9 9-5 9 5-9 5z"/><path d="M7 12v4c2.8 2.1 7.2 2.1 10 0v-4"/><path d="M21 9v6"/></svg>:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="7" r="3"/><path d="M5 21v-3a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v3"/><path d="M9 17h6"/></svg>
}

export default function HomePage(){
  const router=useRouter();
  const enter=(path:string)=>{playEntryTone();window.setTimeout(()=>router.push(path),90)};
  return <main className="edu-home" dir="rtl">
    <section className="edu-hero">
      <div className="edu-copy">
        <div className="edu-badge">منصة تعليمية رقمية</div>
        <h1>بوابة <span>أستاذ لحوني</span> التعليمية</h1>
        <p>مساحة موحدة للدرجات والحضور والإتقان والتقارير والتواصل مع ولي الأمر، بتجربة سهلة للمعلم والطالب.</p>
        <div className="edu-points"><span>متابعة فورية</span><span>تقارير واضحة</span><span>دخول آمن</span></div>
      </div>
      <div className="edu-art"><div className="art-ring ring-one"/><div className="art-ring ring-two"/><img src="/students-learning.svg" alt="طلاب في بيئة تعليمية"/><div className="floating-card fc1">📊 <b>تقدم مستمر</b></div><div className="floating-card fc2">✓ <b>رصد دقيق</b></div></div>
    </section>

    <section className="edu-access">
      <button className="portal-card student" onClick={()=>enter("/student")}>
        <span className="portal-icon"><PortalIcon kind="student"/></span><div><small>للطالب وولي الأمر</small><strong>بوابة المتابعة</strong><p>الدرجات، الحضور، التنبيهات ومستوى الإتقان.</p></div><b className="arrow">←</b>
      </button>
      <button className="portal-card teacher" onClick={()=>enter("/teacher")}>
        <span className="portal-icon"><PortalIcon kind="teacher"/></span><div><small>للمعلم</small><strong>لوحة إدارة المادة</strong><p>الرصد، الطلاب، التقارير، البحث والمتابعة.</p></div><b className="arrow">←</b>
      </button>
      <a className="qr-card" href="/student"><QRCodeSVG value={studentUrl} size={92} includeMargin/><div><small>دخول سريع</small><strong>امسح الرمز لفتح بوابة الطالب</strong><p>ينقلك مباشرة إلى صفحة الهوية وكود الطالب.</p></div></a>
    </section>

    <footer className="edu-footer"><span>بوابة أستاذ لحوني التعليمية</span><small>تعليم أوضح • متابعة أدق • أثر أكبر</small></footer>

    <style jsx global>{`
      :root{--navy:#123f52;--teal:#087b83;--teal2:#13a397;--gold:#d6a23a;--paper:#f5f9f8;--line:#dce9e7;--muted:#698087}
      *{box-sizing:border-box}.edu-home{min-height:100vh;padding:28px;background:radial-gradient(circle at 12% 8%,#dff5ef 0,transparent 30%),linear-gradient(145deg,#f8fbfa,#eef6f5);font-family:Tajawal,Arial,sans-serif;color:var(--navy)}
      .edu-hero,.edu-access,.edu-footer{width:min(1240px,100%);margin:auto}.edu-hero{min-height:560px;display:grid;grid-template-columns:1.08fr .92fr;align-items:center;gap:48px;padding:56px;border:1px solid rgba(210,228,225,.9);border-radius:38px;background:rgba(255,255,255,.9);box-shadow:0 30px 90px rgba(31,82,91,.12);overflow:hidden;position:relative}.edu-hero:after{content:"";position:absolute;width:420px;height:420px;border-radius:50%;background:linear-gradient(135deg,rgba(19,163,151,.11),rgba(214,162,58,.08));left:-180px;bottom:-210px}.edu-badge{display:inline-flex;padding:9px 15px;border-radius:999px;background:#e8f6f3;color:#087469;font-size:12px;font-weight:900}.edu-copy h1{margin:18px 0 14px;font-size:58px;line-height:1.22;letter-spacing:-1px}.edu-copy h1 span{display:block;color:var(--teal)}.edu-copy p{max-width:620px;margin:0;color:var(--muted);font-size:17px;line-height:2}.edu-points{display:flex;gap:10px;flex-wrap:wrap;margin-top:24px}.edu-points span{padding:10px 14px;border-radius:12px;background:#fff;border:1px solid var(--line);font-size:12px;font-weight:800;box-shadow:0 8px 20px rgba(20,78,87,.05)}
      .edu-art{min-height:430px;display:grid;place-items:center;position:relative}.edu-art img{width:min(500px,100%);position:relative;z-index:2;filter:drop-shadow(0 25px 28px rgba(17,77,84,.16));animation:floatArt 5s ease-in-out infinite}.art-ring{position:absolute;border-radius:50%}.ring-one{width:390px;height:390px;background:linear-gradient(145deg,#e8f6f2,#d8eeeb)}.ring-two{width:315px;height:315px;border:2px dashed rgba(8,123,131,.28);animation:spinRing 18s linear infinite}.floating-card{position:absolute;z-index:3;padding:12px 16px;border-radius:16px;background:rgba(255,255,255,.94);border:1px solid var(--line);box-shadow:0 16px 35px rgba(20,78,87,.13);font-size:12px}.fc1{top:65px;right:12px}.fc2{bottom:58px;left:18px;color:#15745d}
      .edu-access{display:grid;grid-template-columns:1fr 1fr .9fr;gap:18px;margin-top:22px}.portal-card,.qr-card{min-height:170px;border:1px solid var(--line);border-radius:26px;background:#fff;padding:24px;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:18px;text-align:right;text-decoration:none;color:inherit;box-shadow:0 14px 36px rgba(25,76,85,.08);transition:.25s}.portal-card{cursor:pointer}.portal-card:hover,.qr-card:hover{transform:translateY(-5px);box-shadow:0 24px 45px rgba(25,76,85,.14)}.portal-icon{width:72px;height:72px;border-radius:22px;display:grid;place-items:center;color:#fff}.portal-icon svg{width:36px}.student .portal-icon{background:linear-gradient(145deg,#0a9180,#24b49a)}.teacher .portal-icon{background:linear-gradient(145deg,#c78b20,#e0b34f)}.portal-card small,.qr-card small{display:block;color:#7a8e93;font-size:11px;font-weight:800}.portal-card strong,.qr-card strong{display:block;margin-top:5px;font-size:21px}.portal-card p,.qr-card p{margin:7px 0 0;color:var(--muted);font-size:12px;line-height:1.7}.arrow{font-size:24px;color:var(--teal)}.qr-card{grid-template-columns:auto 1fr}.qr-card svg{border-radius:14px}.edu-footer{display:flex;justify-content:space-between;gap:15px;padding:22px 8px 0;color:#6f858b}.edu-footer span{font-weight:900;color:var(--navy)}
      @keyframes floatArt{50%{transform:translateY(-10px)}}@keyframes spinRing{to{transform:rotate(360deg)}}
      @media(max-width:980px){.edu-hero{grid-template-columns:1fr;padding:38px}.edu-copy{text-align:center}.edu-copy p{margin:auto}.edu-points{justify-content:center}.edu-art{min-height:350px}.edu-access{grid-template-columns:1fr 1fr}.qr-card{grid-column:1/-1}.edu-copy h1{font-size:46px}}
      @media(max-width:620px){.edu-home{padding:10px}.edu-hero{padding:28px 20px;border-radius:25px;gap:15px}.edu-copy h1{font-size:36px}.edu-copy p{font-size:14px}.edu-art{min-height:270px}.ring-one{width:250px;height:250px}.ring-two{width:210px;height:210px}.floating-card{padding:8px 10px;font-size:10px}.edu-access{grid-template-columns:1fr}.qr-card{grid-column:auto}.portal-card,.qr-card{min-height:145px;padding:18px;border-radius:20px}.portal-icon{width:58px;height:58px}.portal-icon svg{width:29px}.edu-footer{flex-direction:column;text-align:center}}
    `}</style>
  </main>
}
