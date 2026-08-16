"use client";

import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";

const teacherImage = "https://shimmering-rolypoly-0ebda2.netlify.app/portal.png";
const studentUrl = "https://tahdheeb-history.vercel.app/student";

export default function HomePage() {
  const router = useRouter();

  return (
    <main className="lahooni-home" dir="rtl">
      <section className="lahooni-shell">
        <div className="lahooni-photo"><img src={teacherImage} alt="صورة الأستاذ حسن علي الطويل" /><div className="photo-wave" /></div>
        <div className="lahooni-content">
          <header><span>بوابة</span><h1>أستاذ لحوني</h1><h2>التعليمية</h2><div className="title-line">🎓</div><p>منصة تعليمية متكاملة لخدمة المعلم والطالب وولي الأمر</p><b>إدارة سهلة • متابعة دقيقة • تعليم بإتقان</b></header>
          <div className="entry-cards">
            <article className="entry-card student-card"><div className="entry-icon">👥</div><h3>بوابة الطالب<br/>وولي الأمر</h3><p>عرض الدرجات والتنبيهات<br/>ومتابعة الأداء الدراسي</p><button onClick={()=>router.push('/student')}>دخول البوابة ‹</button></article>
            <article className="entry-card teacher-card"><div className="entry-icon">👨‍🏫</div><h3>بوابة المعلم</h3><p>إدارة الفصول ورصد الدرجات<br/>والتقارير والإشعارات</p><button onClick={()=>router.push('/teacher')}>دخول البوابة ‹</button></article>
          </div>
          <a className="real-qr" href="/student" aria-label="الدخول السريع لبوابة الطالب وولي الأمر"><QRCodeSVG value={studentUrl} size={104} includeMargin/><div><strong>الدخول السريع لولي الأمر</strong><span>امسح رمز QR للدخول مباشرة</span></div><div className="phone-icon">▣</div></a>
          <div className="portal-help"><article>🛡️<b>خصوصية وأمان</b><span>بياناتك آمنة ومحمية</span></article><article>💳<b>بيانات الدخول</b><span>رقم الهوية وكود الطالب</span></article><article>🎧<b>الدعم والمساعدة</b><span>تواصل مع معلم المادة</span></article></div>
          <footer>جميع الحقوق محفوظة © أستاذ لحوني التعليمية 2026</footer>
        </div>
      </section>
      <style jsx global>{`
        .lahooni-home{min-height:100vh;padding:22px;background:#f4f8f8;font-family:Tahoma,Arial,sans-serif;color:#174b59}.lahooni-shell{width:min(1240px,100%);margin:auto;display:grid;grid-template-columns:44% 56%;background:#fff;border-radius:30px;overflow:hidden;box-shadow:0 24px 70px rgba(27,76,87,.13)}.lahooni-photo{position:relative;min-height:850px;background:linear-gradient(180deg,#edf6f5,#fff);overflow:hidden}.lahooni-photo img{width:100%;height:100%;object-fit:cover;object-position:center top;display:block}.photo-wave{position:absolute;right:-8%;bottom:-6%;width:120%;height:32%;background:linear-gradient(135deg,rgba(58,151,156,.42),rgba(255,255,255,.85));border-radius:50% 50% 0 0/35% 35% 0 0;transform:rotate(-7deg)}.lahooni-content{padding:42px 48px 24px;display:flex;flex-direction:column}.lahooni-content header{text-align:center}.lahooni-content header>span{font-size:25px}.lahooni-content h1{margin:5px 0 0;font-size:54px;line-height:1;color:#0e5d70}.lahooni-content h2{margin:0;color:#c99023;font-size:29px}.title-line{margin:18px auto;color:#0f7180}.lahooni-content header p{font-weight:800;margin:8px 0;color:#174b59}.lahooni-content header b{font-size:15px;color:#2d6975}.entry-cards{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:30px}.entry-card{padding:24px;border:1px solid #dce8e8;border-radius:21px;background:#fff;text-align:center;box-shadow:0 10px 25px rgba(28,80,90,.08)}.entry-icon{width:64px;height:64px;border-radius:50%;display:grid;place-items:center;margin:auto;font-size:29px;color:#fff}.student-card .entry-icon{background:#2da664}.teacher-card .entry-icon{background:#d79a20}.entry-card h3{font-size:23px;margin:16px 0 12px}.student-card h3{color:#299559}.teacher-card h3{color:#c78a17}.entry-card p{font-size:13px;line-height:1.9;color:#687d83;border-top:1px solid #e8eeee;padding-top:12px}.entry-card button{width:100%;height:48px;border:0;border-radius:10px;color:#fff;font-weight:900;font-size:15px;cursor:pointer}.student-card button{background:#269759}.teacher-card button{background:#d49418}.real-qr{margin-top:20px;padding:12px 20px;border:1px solid #e0e9e9;border-radius:18px;background:#fff;display:grid;grid-template-columns:auto 1fr auto;gap:18px;align-items:center;text-decoration:none;color:#18596a;box-shadow:0 10px 24px rgba(23,77,89,.06)}.real-qr>div:nth-child(2){display:flex;flex-direction:column;gap:7px}.real-qr strong{font-size:20px}.real-qr span{font-size:13px;color:#617c83}.phone-icon{font-size:38px;color:#0d7282}.portal-help{display:grid;grid-template-columns:repeat(3,1fr);gap:0;margin-top:20px;border:1px solid #e3ebeb;border-radius:18px;padding:18px;background:#fff}.portal-help article{display:flex;flex-direction:column;align-items:center;text-align:center;gap:7px;padding:8px;border-left:1px solid #e7eded}.portal-help article:last-child{border-left:0}.portal-help b{font-size:14px}.portal-help span{font-size:11px;color:#74888d}.lahooni-content footer{text-align:center;margin-top:18px;font-size:12px;color:#7a8e92}@media(max-width:900px){.lahooni-shell{grid-template-columns:1fr}.lahooni-photo{min-height:520px}.lahooni-content{padding:32px 24px}.lahooni-content h1{font-size:44px}}@media(max-width:560px){.lahooni-home{padding:10px}.lahooni-shell{border-radius:22px}.lahooni-photo{min-height:390px}.lahooni-content{padding:27px 16px 20px}.lahooni-content h1{font-size:37px}.entry-cards{grid-template-columns:1fr}.real-qr{grid-template-columns:auto 1fr}.phone-icon{display:none}.portal-help{grid-template-columns:1fr}.portal-help article{border-left:0;border-bottom:1px solid #e7eded}.portal-help article:last-child{border-bottom:0}}
      `}</style>
    </main>
  );
}
