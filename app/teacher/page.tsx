"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { setGradePlanCurrentTeacher } from "../../lib/grade-plan-local";
import "./teacher-login-v10.css";

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

  return <main className="teacher-login-v10" dir="rtl">
    <header className="tl10-top">
      <Link href="/" className="tl10-brand"><Image src="/icons/lahooni-identity-320.jpg" alt="بوابة أستاذ لحوني التعليمية" width={54} height={54} priority/><span><small>بوابة أستاذ لحوني التعليمية</small><b>مساحة المعلم الأكاديمية</b></span></Link>
      <Link href="/" className="tl10-back">العودة للرئيسية</Link>
    </header>

    <section className="tl10-stage">
      <article className="tl10-intro">
        <small>بوابة تساعد المعلم، لا تزيد عليه العمل</small>
        <h1>يومك التعليمي<br/><span>في مساحة واحدة</span></h1>
        <p>الفصل هو نقطة البداية. بعدها المتابعة، التحصيل، الإتقان والملاحظات، والذكاء الاصطناعي يظهر لك عندما تكون له فائدة فعلية.</p>
        <div className="tl10-pillars"><span><b>01</b><em>فصولك واضحة</em></span><span><b>02</b><em>عملك أسرع</em></span><span><b>03</b><em>القرار مبني على البيانات</em></span></div>
        <div className="tl10-ai-preview"><span>AI</span><div><small>المساعد الأكاديمي</small><b>يربط بياناتك بالخطوة التالية</b><p>غياب متكرر، رصد ناقص، طالب متعثر أو فصل يحتاج متابعة — تظهر لك الأولوية بدل البحث عنها.</p></div></div>
      </article>

      <section className="tl10-login-card">
        <header><span>دخول آمن</span><h2>مرحبًا بك أستاذنا</h2><p>أدخل بيانات الحساب التي أنشأها مدير البوابة.</p></header>
        <form onSubmit={submit}>
          <label><span>اسم المعلم</span><input value={name} onChange={event=>{setName(event.target.value);setError("");}} autoComplete="username" autoFocus required placeholder="اكتب اسم المستخدم"/></label>
          <label><span>الرقم السري</span><div className="tl10-password"><input type={show?"text":"password"} value={password} onChange={event=>{setPassword(event.target.value);setError("");}} autoComplete="current-password" required placeholder="كلمة المرور"/><button type="button" onClick={()=>setShow(value=>!value)}>{show?"إخفاء":"إظهار"}</button></div></label>
          {error?<p className="tl10-error">{error}</p>:null}
          <button className="tl10-submit" disabled={loading||!name||!password}>{loading?"جارٍ فتح مساحتك…":"دخول مساحة المعلم"}</button>
        </form>
        <footer><span><i/> حفظ سحابي</span><span><i/> خصوصية الحساب</span><span><i/> يعمل من الجوال والكمبيوتر</span></footer>
      </section>
    </section>

    <footer className="tl10-credit">إعداد البوابة: <b>الأستاذ حسن علي الطويل</b></footer>
  </main>;
}
