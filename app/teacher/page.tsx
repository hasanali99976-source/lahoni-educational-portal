"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { setGradePlanCurrentTeacher } from "../../lib/grade-plan-local";

export default function TeacherLoginPage(){
  const [name,setName]=useState("");
  const [password,setPassword]=useState("");
  const [show,setShow]=useState(false);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);
  const router=useRouter();

  async function submit(event:FormEvent){
    event.preventDefault();
    setError("");
    setLoading(true);
    try{
      const response=await fetch("/api/teacher-login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,password})});
      const data=await response.json();
      if(!response.ok){setError(data?.message||"اسم المعلم أو الرقم السري غير صحيح");return;}
      if(data?.firebaseToken)await signInWithCustomToken(auth,data.firebaseToken);
      if(data?.teacherId)setGradePlanCurrentTeacher(data.teacherId);
      router.replace("/teacher/dashboard");
      router.refresh();
    }catch{
      setError("تعذر تسجيل الدخول الآن");
    }finally{
      setLoading(false);
    }
  }

  return <main className="teacher-login-unified" dir="rtl">
    <header className="tlu-top">
      <Link href="/" className="tlu-brand">
        <Image src="/icons/lahooni-identity-320.jpg" alt="هوية بوابة أستاذ لحوني التعليمية" width={58} height={58} priority/>
        <span><strong>بوابة أستاذ لحوني التعليمية</strong><small>مساحة المعلم الذكية</small></span>
      </Link>
      <Link href="/" className="tlu-back">العودة للرئيسية</Link>
    </header>

    <section className="tlu-stage">
      <section className="tlu-intro">
        <div className="tlu-intro-copy">
          <div className="tlu-badge">بوابة المعلم</div>
          <h1>يومك الدراسي<br/>في شاشة واحدة.</h1>
          <p>حضور، تحضير، متابعة، تحصيل، تقارير وانضباط؛ مرتبة لتصل لما تحتاجه بسرعة ووضوح.</p>
        </div>
        <div className="tlu-smart-grid" aria-label="أدوات البوابة">
          <article><span>01</span><b>الحضور والتحضير</b><small>تسجيل سريع ومتابعة مباشرة</small></article>
          <article><span>02</span><b>التحصيل والدرجات</b><small>قراءة أوضح لمستوى الطلاب</small></article>
          <article><span>03</span><b>الانضباط</b><small>مؤشرات مختصرة للحالات المهمة</small></article>
          <article><span>04</span><b>التقارير</b><small>طباعة وملخصات منظمة</small></article>
        </div>
        <div className="tlu-live-strip"><i/><span>بيئة عمل موحدة لجميع مواد المعلم</span><b>جاهزة للاستخدام</b></div>
      </section>

      <section className="tlu-login-card">
        <div className="tlu-login-mark">دخول آمن</div>
        <div className="tlu-login-head"><small>مرحبًا بك</small><h2>دخول المعلم</h2><p>استخدم بياناتك الحالية كما هي للدخول إلى مساحة عملك.</p></div>
        <form className="tlu-form" onSubmit={submit}>
          <label><span>اسم المستخدم</span><input value={name} onChange={event=>{setName(event.target.value);setError("");}} autoComplete="username" autoFocus required placeholder="اكتب اسم المستخدم"/></label>
          <label><span>كلمة المرور</span><div className="tlu-password"><input type={show?"text":"password"} value={password} onChange={event=>{setPassword(event.target.value);setError("");}} autoComplete="current-password" required placeholder="اكتب كلمة المرور"/><button type="button" onClick={()=>setShow(value=>!value)}>{show?"إخفاء":"إظهار"}</button></div></label>
          {error?<p className="tlu-error">{error}</p>:null}
          <button className="tlu-submit" disabled={loading||!name||!password}>{loading?"جارٍ فتح البوابة…":"دخول بوابة المعلم"}</button>
        </form>
        <div className="tlu-trust"><span>نفس بياناتك الحالية</span><span>لا تغيير على حسابك</span></div>
      </section>
    </section>

    <footer className="tlu-footer"><span>بوابة تعليمية للمتابعة والتحصيل والتقارير</span><b>إعداد الأستاذ حسن علي الطويل</b></footer>
  </main>;
}
