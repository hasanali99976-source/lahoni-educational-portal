"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { setGradePlanCurrentTeacher } from "../../lib/grade-plan-local";
import "./teacher-login-current.css";

export default function TeacherLoginPage(){
  const [name,setName]=useState("");
  const [password,setPassword]=useState("");
  const [show,setShow]=useState(false);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);

  async function submit(event:FormEvent){
    event.preventDefault();
    if(loading)return;
    setError("");
    setLoading(true);
    try{
      const response=await fetch("/api/teacher-login",{
        method:"POST",
        credentials:"include",
        cache:"no-store",
        headers:{"Content-Type":"application/json","Accept":"application/json"},
        body:JSON.stringify({name:name.trim(),password})
      });
      let data:any=null;
      try{data=await response.json();}catch{data=null;}
      if(!response.ok){setError(data?.message||"اسم المعلم أو الرقم السري غير صحيح");return;}
      if(data?.firebaseToken){try{await signInWithCustomToken(auth,data.firebaseToken);}catch{} }
      if(data?.teacherId)setGradePlanCurrentTeacher(data.teacherId);
      // Safari/iOS can race client navigation against Set-Cookie persistence.
      // A same-origin hard navigation guarantees the fresh session cookie is read.
      window.location.assign("/teacher/dashboard");
    }catch{
      setError("تعذر تسجيل الدخول الآن. تحقق من الاتصال ثم حاول مرة أخرى.");
    }finally{
      setLoading(false);
    }
  }

  return <main className="teacher-login-current" dir="rtl">
    <div className="tlc-scene"/>
    <section className="tlc-frame">
      <header className="tlc-top">
        <Link href="/" className="tlc-brand">
          <Image src="/icons/lahooni-identity-320.jpg" alt="هوية بوابة أستاذ لحوني التعليمية" width={58} height={58} priority/>
          <span><strong>بوابة أستاذ لحوني التعليمية</strong><small>بوابة المعلم</small></span>
        </Link>
        <Link href="/" className="tlc-back">العودة للرئيسية</Link>
      </header>

      <section className="tlc-hero">
        <div className="tlc-kicker">✦ المساحة التعليمية الذكية للمعلم</div>
        <h1>بوابة المعلم<br/><em>بنفس هوية البوابة الرئيسية</em></h1>
        <p>الحضور، التحصيل، المتابعة، التقارير والانضباط في مساحة واحدة متصلة بهوية أستاذ لحوني التعليمية.</p>
      </section>

      <section className="tlc-zone">
        <section className="tlc-showcase">
          <div className="tlc-teacher-orb"><Image src="/teacher/teacher-avatar.svg" alt="أيقونة المعلم" width={118} height={118} priority/></div>
          <div className="tlc-showcase-copy"><small>بوابة المعلم</small><h2>يومك الدراسي أمامك بوضوح</h2><p>كل أدواتك المهمة تظهر بعد الدخول مباشرة، مع اختيار المادة مرة واحدة فقط عند بداية الجلسة.</p></div>
          <div className="tlc-tools" aria-label="أدوات البوابة">
            <article><span>01</span><b>الحضور والتحضير</b><small>تسجيل ومتابعة مباشرة</small></article>
            <article><span>02</span><b>التحصيل والدرجات</b><small>قراءة مستوى الطلاب</small></article>
            <article><span>03</span><b>المتابعة والإتقان</b><small>دعم وإثراء وإحالات</small></article>
            <article><span>04</span><b>التقارير</b><small>طباعة وتحليل منظم</small></article>
          </div>
        </section>

        <section className="tlc-card">
          <div className="tlc-mark">دخول آمن</div>
          <div className="tlc-head"><small>مرحبًا بك</small><h2>دخول المعلم</h2><p>استخدم بياناتك الحالية كما هي.</p></div>
          <form className="tlc-form" onSubmit={submit}>
            <label><span>اسم المستخدم</span><input value={name} onChange={event=>{setName(event.target.value);setError("");}} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} required placeholder="اكتب اسم المستخدم"/></label>
            <label><span>كلمة المرور</span><div className="tlc-password"><input type={show?"text":"password"} value={password} onChange={event=>{setPassword(event.target.value);setError("");}} autoComplete="current-password" autoCapitalize="none" autoCorrect="off" spellCheck={false} required placeholder="اكتب كلمة المرور"/><button type="button" onClick={()=>setShow(value=>!value)}>{show?"إخفاء":"إظهار"}</button></div></label>
            {error?<p className="tlc-error">{error}</p>:null}
            <button className="tlc-submit" disabled={loading||!name.trim()||!password}>{loading?"جارٍ فتح البوابة…":"دخول بوابة المعلم"}</button>
          </form>
          <div className="tlc-trust"><span>نفس بياناتك الحالية</span><span>اختيار المادة بعد الدخول فقط</span></div>
        </section>
      </section>

      <footer className="tlc-footer"><span>بوابة تعليمية للمتابعة والتحصيل والتقارير</span><b>إعداد الأستاذ حسن علي الطويل</b></footer>
    </section>
  </main>;
}
