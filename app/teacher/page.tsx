"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { setGradePlanCurrentTeacher } from "../../lib/grade-plan-local";
import "./teacher-login-v14.css";

export default function TeacherLoginPage(){
  const [name,setName]=useState("");
  const [password,setPassword]=useState("");
  const [show,setShow]=useState(false);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);
  const router=useRouter();

  async function submit(event:FormEvent){
    event.preventDefault();setError("");setLoading(true);
    try{
      const response=await fetch("/api/teacher-login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,password})});
      const data=await response.json();
      if(!response.ok){setError(data?.message||"اسم المعلم أو الرقم السري غير صحيح");return;}
      if(data?.firebaseToken)await signInWithCustomToken(auth,data.firebaseToken);
      if(data?.teacherId)setGradePlanCurrentTeacher(data.teacherId);
      router.replace("/teacher/dashboard");router.refresh();
    }catch{setError("تعذر تسجيل الدخول الآن");}finally{setLoading(false);}
  }

  return <main className="teacher-login-v14" dir="rtl">
    <header className="tl14-top">
      <Link href="/" className="tl14-brand">
        <Image src="/icons/lahooni-identity-320.jpg" alt="هوية بوابة أستاذ لحوني التعليمية" width={64} height={64} priority/>
        <span><small>بوابة أستاذ لحوني التعليمية</small><strong>أكاديمية المعلم</strong></span>
      </Link>
      <Link href="/" className="tl14-back">العودة للبوابة الرئيسية</Link>
    </header>

    <section className="tl14-stage">
      <section className="tl14-access">
        <span className="tl14-access-tag">بوابة دخول المعلم</span>
        <h1>ادخل إلى مساحة عملك</h1>
        <p>حساب واحد يفتح موادك وفصولك وجدولك والتحصيل والمتابعة والتقارير المحفوظة.</p>
        <form className="tl14-form" onSubmit={submit}>
          <label><span>اسم المستخدم</span><input value={name} onChange={event=>{setName(event.target.value);setError("");}} autoComplete="username" autoFocus required placeholder="اكتب اسم المستخدم"/></label>
          <label><span>كلمة المرور</span><div className="tl14-password"><input type={show?"text":"password"} value={password} onChange={event=>{setPassword(event.target.value);setError("");}} autoComplete="current-password" required placeholder="اكتب كلمة المرور"/><button type="button" onClick={()=>setShow(value=>!value)}>{show?"إخفاء":"إظهار"}</button></div></label>
          {error?<p className="tl14-error">{error}</p>:null}
          <button className="tl14-submit" disabled={loading||!name||!password}>{loading?"جارٍ فتح مساحة العمل…":"دخول أكاديمية المعلم"}</button>
        </form>
        <div className="tl14-secure"><span><i/> يحفظ أعمالك السابقة</span><span><i/> موادك في حساب واحد</span><span><i/> وصول آمن ومباشر</span></div>
      </section>

      <section className="tl14-intro">
        <span className="tl14-eyebrow">مساحة عمل تعليمية للمعلم</span>
        <h2>أكاديمية تعرف<br/><strong>ماذا تحتاج أن تنجز اليوم</strong></h2>
        <p>بدل التنقل بين أنظمة منفصلة، تجمع الأكاديمية الفصل والمادة والمتابعة والتحصيل والقياس والتقارير في مسار يومي واحد، ويظهر المساعد الذكي عندما توجد معلومة تستحق انتباهك.</p>
        <div className="tl14-command">
          <article><span>01</span><b>ابدأ من يومك</b><small>الحصة الأقرب، المتابعة غير المكتملة، وأهم حالة تحتاج تدخلًا.</small></article>
          <article><span>02</span><b>اعمل داخل الفصل</b><small>انتقل بين الطلاب والمتابعة والتحصيل والملاحظات بأقل عدد من الخطوات.</small></article>
          <article><span>03</span><b>اقرأ الأثر</b><small>تقارير ومقارنات تساعدك على اتخاذ قرار تعليمي واضح.</small></article>
        </div>
        <div className="tl14-ai"><span>AI</span><div><small>المساعد الأكاديمي</small><b>يقرأ البيانات ويقترح الخطوة التالية — ولا يغيّر شيئًا دونك.</b></div><em>مساعد للقرار</em></div>
      </section>
    </section>

    <footer className="tl14-footer"><span>الدرجات والحضور والاختبارات والملاحظات المحفوظة تبقى كما هي.</span><b>إعداد الأستاذ حسن علي الطويل</b></footer>
  </main>;
}
