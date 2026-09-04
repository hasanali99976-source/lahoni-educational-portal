"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { setGradePlanCurrentTeacher } from "../../lib/grade-plan-local";
import "./teacher-login-v11.css";

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

  return <main className="academy-login-v11" dir="rtl">
    <header className="al11-topbar">
      <Link href="/" className="al11-brand">
        <Image src="/icons/lahooni-identity-320.jpg" alt="هوية بوابة أستاذ لحوني التعليمية" width={72} height={72} priority/>
        <span><small>بوابة أستاذ لحوني التعليمية</small><b>أكاديمية المعلم</b></span>
      </Link>
      <Link href="/" className="al11-back">العودة للبوابة الرئيسية</Link>
    </header>

    <section className="al11-stage">
      <div className="al11-story">
        <span className="al11-kicker">Teacher Academic Workspace</span>
        <h1>مساحتك التعليمية<br/><strong>تفهم يومك قبل أن تبدأه</strong></h1>
        <p>فصولك، جدولك، المتابعة، التحصيل، الإتقان والتقارير في أكاديمية واحدة. المساعد الذكي يظهر عندما تحتاج قرارًا أو قراءة، لا كزر إضافي يشتتك.</p>

        <div className="al11-flow">
          <article><b>01</b><span><strong>ابدأ من الفصل</strong><small>كل أدواتك مرتبطة بسياق الفصل والمادة</small></span></article>
          <article><b>02</b><span><strong>أنجز بسرعة</strong><small>الرصد والمتابعة مصممان لأقل عدد من النقرات</small></span></article>
          <article><b>03</b><span><strong>اتخذ قرارًا</strong><small>مؤشرات واقتراحات مبنية على بياناتك الفعلية</small></span></article>
        </div>

        <div className="al11-intelligence">
          <span>AI</span>
          <div><small>المساعد الأكاديمي</small><b>لا يغيّر بياناتك؛ يساعدك على قراءتها</b><p>ينبه للرصد الناقص، التراجع، الغياب المتكرر، والمهارات التي تحتاج تدخلًا — والقرار النهائي للمعلم.</p></div>
        </div>
      </div>

      <section className="al11-login-panel">
        <div className="al11-login-head">
          <span>دخول المعلم</span>
          <h2>أهلًا بك في أكاديميتك</h2>
          <p>استخدم بيانات الحساب المعتمدة من إدارة البوابة.</p>
        </div>

        <form onSubmit={submit}>
          <label><span>اسم المعلم</span><input value={name} onChange={event=>{setName(event.target.value);setError("");}} autoComplete="username" autoFocus required placeholder="اكتب اسم المستخدم"/></label>
          <label><span>الرقم السري</span><div className="al11-password"><input type={show?"text":"password"} value={password} onChange={event=>{setPassword(event.target.value);setError("");}} autoComplete="current-password" required placeholder="كلمة المرور"/><button type="button" onClick={()=>setShow(value=>!value)}>{show?"إخفاء":"إظهار"}</button></div></label>
          {error?<p className="al11-error">{error}</p>:null}
          <button className="al11-submit" disabled={loading||!name||!password}>{loading?"جارٍ فتح الأكاديمية…":"دخول أكاديمية المعلم"}</button>
        </form>

        <div className="al11-trust"><span><i/> بيانات محفوظة</span><span><i/> وصول آمن</span><span><i/> يعمل على جميع الأجهزة</span></div>
        <div className="al11-login-note">كل ما حفظته سابقًا من درجات، حضور، ملاحظات واختبارات يبقى كما هو.</div>
      </section>
    </section>

    <footer className="al11-footer"><span>منصة تعليمية للمتابعة والتحصيل واتخاذ القرار</span><b>إعداد الأستاذ حسن علي الطويل</b></footer>
  </main>;
}
