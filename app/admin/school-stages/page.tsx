"use client";
import Link from "next/link";

export default function SchoolStagesPage(){
 return <main className="stages-page" dir="rtl">
  <section className="stages-shell">
   <header className="stages-head">
    <small>بوابة الإدارة • الطلاب والفصول</small>
    <h1>اختر المرحلة التعليمية</h1>
    <p>اختر المرحلة أولًا، ثم ستظهر لك صفوف وفصول المرحلة المحددة فقط.</p>
   </header>
   <section className="stage-grid">
    <Link href="/admin/middle-school" prefetch={false} className="stage-card middle">
     <span className="stage-icon">م</span><div><small>المرحلة التعليمية</small><h2>المرحلة المتوسطة</h2><p>الأول المتوسط · الثاني المتوسط · الثالث المتوسط</p></div><b>دخول ←</b>
    </Link>
    <Link href="/admin/students" prefetch={false} className="stage-card secondary">
     <span className="stage-icon">ث</span><div><small>المرحلة التعليمية</small><h2>المرحلة الثانوية</h2><p>الأول الثانوي · الثاني الثانوي · الثالث الثانوي</p></div><b>دخول ←</b>
    </Link>
   </section>
   <footer><Link href="/admin" prefetch={false}>← العودة إلى لوحة الإدارة</Link><span>كل مرحلة مستقلة في الفصول والطلاب والمعرّفات</span></footer>
  </section>
  <style jsx>{`
   .stages-page{min-height:100vh;padding:34px 22px;background:radial-gradient(circle at 80% 10%,rgba(12,119,111,.22),transparent 32%),linear-gradient(145deg,#042b39,#063846 55%,#064d4c);font-family:Tahoma,Arial,sans-serif;color:#fff}.stages-shell{width:min(1120px,100%);margin:auto;display:grid;gap:22px}.stages-head{padding:26px 28px;border:1px solid rgba(255,255,255,.13);border-radius:24px;background:rgba(5,39,51,.72);box-shadow:0 24px 70px rgba(0,0,0,.16)}.stages-head small{color:#e4bd61;font-weight:900;font-size:12px}.stages-head h1{margin:7px 0 5px;font-size:32px}.stages-head p{margin:0;color:#bdd2d6;font-size:13px}.stage-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.stage-card{position:relative;min-height:210px;display:grid;grid-template-columns:74px 1fr auto;align-items:center;gap:18px;padding:28px;border:1px solid rgba(255,255,255,.14);border-radius:24px;color:#fff;text-decoration:none;overflow:hidden;transition:.18s ease;box-shadow:0 18px 45px rgba(0,0,0,.12)}.stage-card:before{content:"";position:absolute;right:0;top:22px;bottom:22px;width:5px;border-radius:9px}.stage-card.middle{background:linear-gradient(135deg,rgba(7,111,105,.62),rgba(5,47,59,.92))}.stage-card.secondary{background:linear-gradient(135deg,rgba(21,77,111,.68),rgba(5,47,59,.92))}.stage-card.middle:before{background:#62d2bd}.stage-card.secondary:before{background:#e0b858}.stage-card:hover{transform:translateY(-4px);border-color:rgba(229,190,98,.48);box-shadow:0 25px 60px rgba(0,0,0,.2)}.stage-icon{width:68px;height:68px;display:grid;place-items:center;border-radius:19px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.14);font-size:27px;font-weight:950}.stage-card small{color:#9dc5c8;font-size:10px;font-weight:900}.stage-card h2{margin:6px 0 8px;font-size:24px}.stage-card p{margin:0;color:#c8dcdf;font-size:11px;line-height:1.8}.stage-card>b{align-self:end;padding:8px 11px;border-radius:10px;background:rgba(229,190,98,.12);color:#f0ca70;font-size:10px;white-space:nowrap}.stages-shell footer{display:flex;justify-content:space-between;gap:15px;padding:14px 4px;color:#8da9ae;font-size:10px}.stages-shell footer a{color:#e5bf65;text-decoration:none;font-weight:900}@media(max-width:760px){.stage-grid{grid-template-columns:1fr}.stage-card{min-height:170px;grid-template-columns:58px 1fr}.stage-icon{width:54px;height:54px}.stage-card>b{grid-column:2}.stages-shell footer{flex-direction:column}}
  `}</style>
 </main>
}
