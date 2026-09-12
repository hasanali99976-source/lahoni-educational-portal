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
    <div className="tlu-orb tlu-orb-a"/><div className="tlu-orb tlu-orb-b"/>

    <header className="tlu-top">
      <Link href="/" className="tlu-brand">
        <Image src="/icons/lahooni-identity-320.jpg" alt="هوية بوابة أستاذ لحوني التعليمية" width={56} height={56} priority/>
        <span><strong>بوابة أستاذ لحوني التعليمية</strong><small>بيئة تعليمية ذكية للمعلم</small></span>
      </Link>
      <Link href="/" className="tlu-back">الرئيسية</Link>
    </header>

    <section className="tlu-stage">
      <section className="tlu-intro">
        <div className="tlu-badge">بوابة تعليمية ذكية</div>
        <h1>مساحة واحدة لعملك التعليمي اليومي.</h1>
        <p>فصولك، حضور طلابك، التحصيل، المتابعة، التقارير والمساعد الذكي في تجربة واضحة ومتكاملة.</p>
        <div className="tlu-pills"><span>الحضور</span><span>التحصيل</span><span>المتابعة</span><span>التقارير</span><span>الذكاء التعليمي</span></div>
        <div className="tlu-visual"><img src="/saudi-classroom.svg" alt="بيئة تعليمية سعودية"/></div>
      </section>

      <section className="tlu-login-card">
        <div className="tlu-login-head"><small>دخول المعلم</small><h2>مرحبًا بك</h2><p>ادخل إلى مساحة عملك التعليمية المحفوظة.</p></div>
        <form className="tlu-form" onSubmit={submit}>
          <label><span>اسم المستخدم</span><input value={name} onChange={event=>{setName(event.target.value);setError("");}} autoComplete="username" autoFocus required placeholder="اسم المستخدم"/></label>
          <label><span>كلمة المرور</span><div className="tlu-password"><input type={show?"text":"password"} value={password} onChange={event=>{setPassword(event.target.value);setError("");}} autoComplete="current-password" required placeholder="كلمة المرور"/><button type="button" onClick={()=>setShow(value=>!value)}>{show?"إخفاء":"إظهار"}</button></div></label>
          {error?<p className="tlu-error">{error}</p>:null}
          <button className="tlu-submit" disabled={loading||!name||!password}>{loading?"جارٍ فتح البوابة…":"دخول البوابة التعليمية"}</button>
        </form>
        <div className="tlu-trust"><span>حساب واحد لكل موادك</span><span>بياناتك محفوظة</span></div>
      </section>
    </section>

    <footer className="tlu-footer"><span>منصة تعليمية للمتابعة والتحصيل والتقارير</span><b>إعداد الأستاذ حسن علي الطويل</b></footer>
  </main>;
}
