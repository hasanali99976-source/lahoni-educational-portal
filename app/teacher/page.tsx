"use client";
import { FormEvent,useState } from "react";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { setGradePlanCurrentTeacher } from "../../lib/grade-plan-local";

export default function TeacherLoginPage(){
 const[name,setName]=useState(""),[password,setPassword]=useState(""),[show,setShow]=useState(false),[error,setError]=useState(""),[loading,setLoading]=useState(false);
 async function submit(e:FormEvent){
   e.preventDefault();if(loading)return;setError("");setLoading(true);
   try{
     const r=await fetch("/api/teacher-login",{method:"POST",credentials:"include",cache:"no-store",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({name:name.trim(),password})});
     const d=await r.json().catch(()=>null);
     if(!r.ok){setError(d?.message||"اسم المعلم أو الرقم السري غير صحيح");return;}
     if(d?.firebaseToken){try{await signInWithCustomToken(auth,d.firebaseToken)}catch{}}
     if(d?.teacherId)setGradePlanCurrentTeacher(d.teacherId);
     window.location.assign("/teacher/dashboard");
   }catch{setError("تعذر تسجيل الدخول الآن. تحقق من الاتصال ثم حاول مرة أخرى.")}
   finally{setLoading(false)}
 }
 return <main className="v3-login v3-teacher-login" dir="rtl">
   <section className="teacher-entry-intro unified-entry-intro">
     <span>منصة تعليمية مدرسية موحدة</span>
     <h1>مساحة المعلم للتعليم والمتابعة والتحصيل.</h1>
     <p>ادخل إلى الحضور والدرجات والخطط والتقارير من نفس الهوية البصرية للبوابة الرئيسية، بدون طبقات دخول منفصلة.</p>
     <small>بوابة أستاذ لحوني التعليمية</small>
   </section>
   <section className="v3-login-card unified-entry-card"><span className="v3-login-icon" aria-hidden="true"/><small>بوابة أستاذ لحوني التعليمية</small><h1>دخول بوابة المعلم</h1><p>استخدم الاسم والرقم السري اللذين أنشأهما مدير البوابة.</p><form onSubmit={submit}><label>اسم المعلم<input value={name} onChange={e=>{setName(e.target.value);setError("")}} autoComplete="username" autoFocus required placeholder="اكتب اسم المعلم"/></label><label>الرقم السري<div className="v3-password"><input type={show?"text":"password"} value={password} onChange={e=>{setPassword(e.target.value);setError("")}} autoComplete="current-password" required/><button type="button" onClick={()=>setShow(!show)}>{show?"إخفاء":"إظهار"}</button></div></label>{error&&<p className="v3-error">{error}</p>}<button className="v3-primary" disabled={loading||!name.trim()||!password}>{loading?"جارٍ التحقق…":"دخول بوابة المعلم"}</button></form><p className="v3-login-note">المواد وصلاحيات الحساب يحددها مدير البوابة فقط.</p></section>
 </main>;
}
