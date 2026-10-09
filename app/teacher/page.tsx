"use client";
import Link from "next/link";
import { FormEvent,useState } from "react";
import { getSubjectConfig } from "../../lib/subject-config";
import { setGradePlanCurrentTeacher } from "../../lib/grade-plan-local";
import "./teacher-entry.css";

const LOGO="/icons/lahooni-identity-320.jpg";

export default function TeacherLoginPage(){
 const[name,setName]=useState(""),[password,setPassword]=useState(""),[show,setShow]=useState(false),[error,setError]=useState(""),[loading,setLoading]=useState(false),[subjects,setSubjects]=useState<Array<{workspaceKey:string;subjectName:string;gradeLabel?:string}>>([]),[teacherName,setTeacherName]=useState(""),[choosing,setChoosing]=useState(false);
 async function submit(e:FormEvent){
   e.preventDefault();if(loading)return;setError("");setLoading(true);
   try{
     const r=await fetch("/api/teacher-login",{method:"POST",credentials:"include",cache:"no-store",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({name:name.trim(),password})});
     const d=await r.json().catch(()=>null);
     if(!r.ok){setError(d?.message||"اسم المعلم أو الرقم السري غير صحيح");return;}
     if(d?.teacherId)setGradePlanCurrentTeacher(d.teacherId);
     sessionStorage.setItem("lahooni:teacher-entry-complete","1");
     window.location.replace("/teacher/dashboard");
   }catch{setError("تعذر تسجيل الدخول الآن. تحقق من الاتصال ثم حاول مرة أخرى.")}
   finally{setLoading(false)}
 }
 async function chooseSubject(workspaceKey:string){if(loading)return;setLoading(true);setError("");try{const response=await fetch("/api/teacher-session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({workspaceKey}),cache:"no-store",credentials:"same-origin"});if(!response.ok)throw new Error();sessionStorage.setItem("lahooni:teacher-subject-picked","1");sessionStorage.setItem("lahooni:teacher-entry-complete","1");window.location.assign("/teacher/dashboard");}catch{setError("تعذر اختيار المادة الآن. حاول مرة أخرى.")}finally{setLoading(false)}}
 if(choosing)return <main className="portal-entry-page teacher-entry-page teacher-choice-page" dir="rtl"><section className="teacher-choice-shell"><header className="teacher-choice-head"><div><span className="teacher-choice-kicker">✦ بوابة أستاذ لحوني التعليمية</span><h1>اختر المادة <em>للبدء</em></h1><p>{teacherName}، اختر المادة التي تريد العمل عليها، وستفتح مساحتها مباشرة.</p></div><span className="teacher-choice-mark">مساحة المعلم الذكية</span></header><div className="teacher-choice-grid">{subjects.map((subject,index)=>{const history=/تاريخ|history/i.test(subject.subjectName+" "+subject.workspaceKey);return <button key={subject.workspaceKey} type="button" className={history?"teacher-choice-card history":"teacher-choice-card thinking"} disabled={loading} onClick={()=>void chooseSubject(subject.workspaceKey)}><span className="teacher-choice-symbol">{history?"▤":"✧"}</span><span className="teacher-choice-info"><strong>{subject.subjectName||getSubjectConfig(subject.workspaceKey as never).label}</strong><small>{subject.gradeLabel||"المادة المسندة"}</small></span><span className="teacher-choice-open">{loading?"جارٍ الفتح…":index===0?"دخول المادة الحالية":"دخول المادة"} ←</span></button>})}</div>{error&&<p className="v3-error">{error}</p>}</section></main>;
 return <main className="portal-entry-page teacher-entry-page" dir="rtl"><div className="portal-entry-shell">
   <header className="portal-entry-top"><Link href="/" className="portal-entry-brand"><img src={LOGO} alt="هوية بوابة أستاذ لحوني التعليمية"/><span><strong>بوابة أستاذ لحوني التعليمية</strong><small>منصة مدرسية ذكية للتعليم والمتابعة والتواصل</small></span></Link><Link href="/" className="portal-entry-home">العودة للرئيسية</Link></header>
   <section className="portal-entry-hero">
    <nav className="teacher-entry-side" aria-label="خدمات بوابة المعلم"><span><b>⌂</b>الرئيسية</span><span><b>▥</b>التحصيل</span><span><b>▦</b>الجدول</span><span><b>✎</b>التحضير</span><span><b>♙</b>الطلاب</span><span><b>▤</b>التقارير</span></nav>
    <div className="portal-entry-copy"><span className="portal-entry-kicker">مساحة العمل الأكاديمية</span><h1>بوابة المعلم</h1><p>معًا لصناعة أثر تعليمي يدوم.</p></div>
    <section className="portal-entry-card"><small>دخول المعلم</small><h2>مرحبًا بك في بوابة المعلم</h2><p>متابعة الطلاب، التحضير، رصد الدرجات والتقارير في مساحة عمل واحدة.</p><form onSubmit={submit}><label>اسم المعلم<input value={name} onChange={e=>{setName(e.target.value);setError("")}} autoComplete="username" autoFocus required placeholder="اكتب اسم المعلم"/></label><label>الرقم السري<div className="portal-entry-password"><input type={show?"text":"password"} value={password} onChange={e=>{setPassword(e.target.value);setError("")}} autoComplete="current-password" required/><button type="button" onClick={()=>setShow(!show)}>{show?"إخفاء":"إظهار"}</button></div></label>{error&&<p className="v3-error">{error}</p>}<button className="portal-entry-submit" disabled={loading||!name.trim()||!password}>{loading?"جارٍ التحقق…":"دخول بوابة المعلم"}</button></form><div className="teacher-quick-icons" aria-label="خدمات المعلم"><span><i>✓</i>المتابعة</span><span><i>▦</i>الجدول</span><span><i>✎</i>التحضير</span><span><i>▤</i>الدرجات</span><span><i>▥</i>التقارير</span></div><p className="portal-entry-note">المواد وصلاحيات الحساب يحددها مدير البوابة فقط.</p></section>
   </section>
 </div></main>;
}