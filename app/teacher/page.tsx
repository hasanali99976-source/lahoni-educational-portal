"use client";
import Link from "next/link";
import { FormEvent,useState } from "react";
import { setGradePlanCurrentTeacher } from "../../lib/grade-plan-local";
import "./teacher-entry.css";

const LOGO="/icons/lahooni-identity-320.jpg";

export default function TeacherLoginPage(){
 const[name,setName]=useState(""),[password,setPassword]=useState(""),[show,setShow]=useState(false),[error,setError]=useState(""),[loading,setLoading]=useState(false);
 async function submit(e:FormEvent){
   e.preventDefault();if(loading)return;setError("");setLoading(true);
   try{
     const r=await fetch("/api/teacher-login",{method:"POST",credentials:"include",cache:"no-store",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({name:name.trim(),password})});
     const d=await r.json().catch(()=>null);
     if(!r.ok){setError(d?.message||"اسم المعلم أو الرقم السري غير صحيح");return;}
     if(d?.teacherId)setGradePlanCurrentTeacher(d.teacherId);
     window.location.assign("/teacher/dashboard");
   }catch{setError("تعذر تسجيل الدخول الآن. تحقق من الاتصال ثم حاول مرة أخرى.")}
   finally{setLoading(false)}
 }
 return <main className="portal-entry-page teacher-entry-page" dir="rtl"><div className="portal-entry-shell">
   <header className="portal-entry-top"><Link href="/" className="portal-entry-brand"><img src={LOGO} alt="هوية بوابة أستاذ لحوني التعليمية"/><span><strong>بوابة أستاذ لحوني التعليمية</strong><small>منصة مدرسية ذكية للتعليم والمتابعة والتواصل</small></span></Link><Link href="/" className="portal-entry-home">العودة للرئيسية</Link></header>
   <section className="portal-entry-hero">
    <div className="portal-entry-copy"><span className="portal-entry-kicker">مساحة العمل الأكاديمية</span><h1>بوابة المعلم</h1><p>الحضور، الجدول، التحضير، التحصيل والمتابعة في مساحة واحدة متصلة بهوية البوابة الرئيسية.</p></div>
    <section className="portal-entry-card"><small>دخول المعلم</small><h2>مرحبًا بك</h2><p>استخدم الاسم والرقم السري اللذين أنشأهما مدير البوابة.</p><form onSubmit={submit}><label>اسم المعلم<input value={name} onChange={e=>{setName(e.target.value);setError("")}} autoComplete="username" autoFocus required placeholder="اكتب اسم المعلم"/></label><label>الرقم السري<div className="portal-entry-password"><input type={show?"text":"password"} value={password} onChange={e=>{setPassword(e.target.value);setError("")}} autoComplete="current-password" required/><button type="button" onClick={()=>setShow(!show)}>{show?"إخفاء":"إظهار"}</button></div></label>{error&&<p className="v3-error">{error}</p>}<button className="portal-entry-submit" disabled={loading||!name.trim()||!password}>{loading?"جارٍ التحقق…":"دخول بوابة المعلم"}</button></form><p className="portal-entry-note">المواد وصلاحيات الحساب يحددها مدير البوابة فقط.</p></section>
   </section>
 </div></main>;
}