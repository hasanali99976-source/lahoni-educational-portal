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
    event.preventDefault(); setError(""); setLoading(true);
    try{
      const response=await fetch("/api/teacher-login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,password})});
      const data=await response.json();
      if(!response.ok){setError(data?.message||"اسم المعلم أو الرقم السري غير صحيح");return;}
      if(data?.firebaseToken)await signInWithCustomToken(auth,data.firebaseToken);
      if(data?.teacherId)setGradePlanCurrentTeacher(data.teacherId);
      router.replace("/teacher/dashboard"); router.refresh();
    }catch{setError("تعذر تسجيل الدخول الآن");}finally{setLoading(false);}
  }

  return <main className="teacher-login-v14" dir="rtl">
    <header className="tl14-top">
      <Link href="/" className="tl14-brand"><Image src="/icons/lahooni-identity-320.jpg" alt="هوية بوابة أستاذ لحوني التعليمية" width={64} height={64} priority/><span><strong>بوابة أستاذ لحوني التعليمية</strong><small>أكاديمية المعلم</small></span></Link>
      <Link href="/" className="tl14-back">العودة للرئيسية</Link>
    </header>

    <section className="tl14-stage">
      <section className="tl14-visual">
        <img src="/saudi-classroom.svg" alt="معلم وطلاب في فصل دراسي سعودي"/>
        <div className="tl14-visual-copy"><span>مساحة المعلم الأكاديمية</span><h1>يومك الدراسي، واضح من أول دخول.</h1><p>موادك وفصولك وحضورك وتحصيل طلابك وتقاريرك في مساحة واحدة.</p></div>
        <div className="tl14-visual-tags"><span>حضور ذكي</span><span>تحصيل أكاديمي</span><span>تقارير احترافية</span></div>
      </section>

      <section className="tl14-access">
        <div className="tl14-access-head"><span>دخول المعلم</span><b>أكاديمية المعلم</b></div>
        <h2>مرحبًا بعودتك</h2><p>استخدم حسابك للدخول إلى مساحة عملك المحفوظة.</p>
        <form className="tl14-form" onSubmit={submit}>
          <label><span>اسم المستخدم</span><input value={name} onChange={event=>{setName(event.target.value);setError("");}} autoComplete="username" autoFocus required placeholder="اسم المستخدم"/></label>
          <label><span>كلمة المرور</span><div className="tl14-password"><input type={show?"text":"password"} value={password} onChange={event=>{setPassword(event.target.value);setError("");}} autoComplete="current-password" required placeholder="كلمة المرور"/><button type="button" onClick={()=>setShow(value=>!value)}>{show?"إخفاء":"إظهار"}</button></div></label>
          {error?<p className="tl14-error">{error}</p>:null}
          <button className="tl14-submit" disabled={loading||!name||!password}>{loading?"جارٍ فتح الأكاديمية…":"دخول أكاديمية المعلم"}</button>
        </form>
        <div className="tl14-secure"><span><i/> البيانات محفوظة</span><span><i/> وصول آمن</span><span><i/> جميع المواد في حساب واحد</span></div>
      </section>
    </section>

    <footer className="tl14-footer"><span>الدرجات والحضور والاختبارات والملاحظات المحفوظة تبقى كما هي.</span><b>إعداد الأستاذ حسن علي الطويل</b></footer>
  </main>;
}
