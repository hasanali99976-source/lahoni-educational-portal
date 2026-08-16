"use client";

import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";

const studentUrl = "https://tahdheeb-history.vercel.app/student";

function playEntryTone(){
  try{
    const AudioCtx=window.AudioContext||(window as typeof window & {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
    if(!AudioCtx)return;
    const ctx=new AudioCtx();
    const gain=ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(.0001,ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.1,ctx.currentTime+.02);
    [523.25,659.25,783.99].forEach((frequency,index)=>{const osc=ctx.createOscillator();osc.type="sine";osc.frequency.value=frequency;osc.connect(gain);const start=ctx.currentTime+index*.07;osc.start(start);osc.stop(start+.13);});
    gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.45);
    window.setTimeout(()=>void ctx.close(),650);
  }catch{}
}

export default function HomePage() {
  const router = useRouter();
  const enter=(path:string)=>{playEntryTone();window.setTimeout(()=>router.push(path),100);};

  return (
    <main className="lahooni-home" dir="rtl">
      <section className="lahooni-shell">
        <div className="lahooni-cover" aria-label="غلاف بوابة أستاذ لحوني التعليمية">
          <img src="/portal-cover.webp?v=4" alt="بوابة أستاذ لحوني التعليمية" />
        </div>

        <div className="lahooni-actions">
          <header>
            <span>مرحبًا بكم في</span>
            <h1>بوابة أستاذ لحوني التعليمية</h1>
            <p>منصة تعليمية لمتابعة الدرجات والحضور والإتقان والتواصل مع ولي الأمر.</p>
          </header>

          <div className="entry-cards">
            <button className="entry-card student-card" onClick={() => enter("/student")}>
              <span className="entry-icon">🎓</span>
              <strong>بوابة الطالب وولي الأمر</strong>
              <small>عرض الدرجات والتنبيهات ومتابعة الأداء</small>
              <b>دخول البوابة ←</b>
            </button>

            <button className="entry-card teacher-card" onClick={() => enter("/teacher")}>
              <span className="entry-icon">👨‍🏫</span>
              <strong>بوابة المعلم</strong>
              <small>إدارة الطلاب والرصد والتقارير والمتابعة</small>
              <b>دخول البوابة ←</b>
            </button>
          </div>

          <a className="real-qr" href="/student" aria-label="الدخول السريع لبوابة الطالب وولي الأمر">
            <QRCodeSVG value={studentUrl} size={96} includeMargin />
            <div><strong>الدخول السريع لولي الأمر</strong><span>امسح رمز QR للانتقال مباشرة إلى صفحة الدخول</span></div>
          </a>

          <div className="portal-help">
            <span>🔒 بيانات آمنة</span>
            <span>📱 متوافق مع التطبيق</span>
            <span>📚 متابعة تعليمية</span>
          </div>
        </div>
      </section>

      <style jsx global>{`
        .lahooni-home{min-height:100vh;padding:18px;background:linear-gradient(135deg,#eef7f6,#f8fbfb);font-family:inherit;color:#164b58}.lahooni-shell{width:min(1400px,100%);margin:auto;background:#fff;border-radius:30px;overflow:hidden;box-shadow:0 26px 80px rgba(23,77,89,.15)}.lahooni-cover{position:relative;width:100%;background:#0d848c;overflow:hidden}.lahooni-cover img{width:100%;height:auto;display:block;object-fit:contain}.lahooni-actions{padding:34px;display:grid;grid-template-columns:1.1fr 1fr;gap:28px;align-items:start;background:linear-gradient(180deg,#fff,#f8fcfb)}.lahooni-actions header{grid-column:1/-1;text-align:center}.lahooni-actions header>span{display:inline-block;padding:7px 13px;border-radius:999px;background:#e8f6f4;color:#127568;font-size:12px;font-weight:800}.lahooni-actions h1{margin:14px 0 9px;font-size:36px;line-height:1.35;color:#0d6170}.lahooni-actions header p{margin:0;color:#6e858d;line-height:1.9;font-size:14px}.entry-cards{display:grid;gap:14px}.entry-card{width:100%;border:1px solid #dbe9e8;border-radius:20px;padding:19px;background:#fff;display:grid;grid-template-columns:auto 1fr;align-items:center;column-gap:14px;row-gap:5px;text-align:right;cursor:pointer;box-shadow:0 10px 25px rgba(28,80,90,.07);transition:.22s}.entry-card:hover{transform:translateY(-3px);box-shadow:0 16px 32px rgba(28,80,90,.13)}.entry-icon{grid-row:1/4;width:58px;height:58px;border-radius:18px;display:grid;place-items:center;font-size:27px;color:#fff}.student-card .entry-icon{background:linear-gradient(135deg,#299a61,#43ba78)}.teacher-card .entry-icon{background:linear-gradient(135deg,#cb8e1c,#e3ad3c)}.entry-card strong{font-size:18px}.student-card strong{color:#278a57}.teacher-card strong{color:#b97a0c}.entry-card small{color:#75898f;font-size:12px}.entry-card b{font-size:12px;color:#0d6f7e}.real-qr{padding:12px 15px;border:1px solid #dfeae9;border-radius:18px;background:#fff;display:flex;align-items:center;gap:14px;text-decoration:none;color:#185967;box-shadow:0 9px 22px rgba(23,77,89,.06)}.real-qr div{display:flex;flex-direction:column;gap:5px}.real-qr strong{font-size:16px}.real-qr span{font-size:11px;color:#71868c;line-height:1.6}.portal-help{grid-column:1/-1;display:flex;justify-content:center;gap:12px;padding-top:16px;border-top:1px solid #e5eeed;color:#667e85;font-size:11px}.portal-help span{padding:8px 11px;border-radius:10px;background:#f3f9f8}@media(max-width:950px){.lahooni-actions{grid-template-columns:1fr;padding:30px 24px}.lahooni-actions header,.portal-help{grid-column:1}.lahooni-actions h1{font-size:31px}}@media(max-width:600px){.lahooni-home{padding:8px}.lahooni-shell{border-radius:20px}.lahooni-cover img{min-height:150px;object-fit:cover;object-position:center}.lahooni-actions{padding:24px 16px}.lahooni-actions h1{font-size:27px}.portal-help{flex-direction:column;align-items:stretch}.real-qr{align-items:flex-start}.entry-card{padding:15px}.entry-icon{width:50px;height:50px}}
      `}</style>
    </main>
  );
}
