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
     const sessionResponse=await fetch("/api/teacher-session",{cache:"no-store",credentials:"same-origin"});
     const session=await sessionResponse.json().catch(()=>null);
     const available=Array.isArray(session?.subjects)?session.subjects:[];
     if(available.length>1){const picked=sessionStorage.getItem("lahooni:teacher-subject-picked");if(!picked){setTeacherName(session?.teacherName||d?.teacherName||name.trim());setSubjects(available);setChoosing(true);return;}}
     sessionStorage.setItem("lahooni:teacher-entry-complete","1");window.location.assign("/teacher/dashboard");
   }catch{setError("تعذر تسجيل الدخول الآن. تحقق من الاتصال ثم حاول مرة أخرى.")}
   finally{setLoading(false)}
 }
 async function chooseSubject(workspaceKey:string){if(loading)return;setLoading(true);setError("");try{const response=await fetch("/api/teacher-session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({workspaceKey}),cache:"no-store",credentials:"same-origin"});if(!response.ok)throw new Error();sessionStorage.setItem("lahooni:teacher-subject-picked","1");sessionStorage.setItem("lahooni:teacher-entry-complete","1");window.location.assign("/teacher/dashboard");}catch{setError("تعذر اختيار المادة الآن. حاول مرة أخرى.")}finally{setLoading(false)}}
 if(choosing)return <main className="portal-entry-page teacher-entry-page" dir="rtl"><div className="portal-entry-shell"><header className="portal-entry-top"><Link href="/" className="portal-entry-brand"><img src={LOGO} alt="هوية بوابة أستاذ لحوني التعليمية"/><span><strong>بوابة أستاذ لحوني التعليمية</strong><small>{teacherName||"المعلم"}</small></span></Link></header><section className="portal-entry-hero"><div className="portal-entry-copy"><span className="portal-entry-kicker">موادك المسندة</span><h1>اختر المادة</h1><p>اختر مساحة العمل التي تريد البدء بها. ويمكنك تغيير المادة لاحقًا من أعلى البوابة دون العودة لهذه الشاشة.</p></div><section className="portal-entry-card"><small>المواد المتاحة</small><h2>بأي مادة تبدأ اليوم؟</h2>{subjects.map(subject=><button key={subject.workspaceKey} type="button" className="portal-entry-submit" disabled={loading} onClick={()=>void chooseSubject(subject.workspaceKey)}>{subject.subjectName||getSubjectConfig(subject.workspaceKey as never).label}{subject.gradeLabel?` — ${subject.gradeLabel}`:""}</button>)}{error&&<p className="v3-error">{error}</p>}</section></section></div></main>;
 return <main className="portal-entry-page teacher-entry-page" dir="rtl"><div className="portal-entry-shell">
   <header className="portal-entry-top"><Link href="/" className="portal-entry-brand"><img src={LOGO} alt="هوية بوابة أستاذ لحوني التعليمية"/><span><strong>بوابة أستاذ لحوني التعليمية</strong><small>منصة مدرسية ذكية للتعليم والمتابعة والتواصل</small><span className="teacher-brand-tabs"><i>يومي</i><i>الفصول</i><i>الحضور</i><i>التحضير</i><i>التحصيل</i><i>التقارير</i><i>الشهادات</i><i>المساعد الذكي</i></span></span></Link><Link href="/" className="portal-entry-home">العودة للرئيسية</Link></header>
   <section className="portal-entry-hero">
    <div className="portal-entry-copy"><div className="teacher-saudi-avatar" aria-label="معلم سعودي"><span className="tsa-head"><i className="tsa-ghutra"/><i className="tsa-face"/><i className="tsa-agal"/></span><span className="tsa-body"/></div><span className="portal-entry-kicker">مساحة العمل الأكاديمية</span><h1>بوابة المعلم</h1><p>الحضور، الجدول، التحصيل والمتابعة في مساحة واحدة متصلة بهوية البوابة الرئيسية.</p><div className="teacher-entry-tabs" aria-label="مزايا بوابة المعلم"><span>الحضور</span><span>الجدول الدراسي</span><span>التحضير</span><span>التحصيل</span></div></div>
    <section className="portal-entry-card"><small>دخول المعلم</small><h2>مرحبًا بك</h2><p>استخدم الاسم والرقم السري اللذين أنشأهما مدير البوابة.</p><form onSubmit={submit}><label>اسم المعلم<input value={name} onChange={e=>{setName(e.target.value);setError("")}} autoComplete="username" autoFocus required placeholder="اكتب اسم المعلم"/></label><label>الرقم السري<div className="portal-entry-password"><input type={show?"text":"password"} value={password} onChange={e=>{setPassword(e.target.value);setError("")}} autoComplete="current-password" required/><button type="button" onClick={()=>setShow(!show)}>{show?"إخفاء":"إظهار"}</button></div></label>{error&&<p className="v3-error">{error}</p>}<button className="portal-entry-submit" disabled={loading||!name.trim()||!password}>{loading?"جارٍ التحقق…":"دخول بوابة المعلم"}</button></form><p className="portal-entry-note">المواد وصلاحيات الحساب يحددها مدير البوابة فقط.</p></section>
   </section>
 </div></main>;
}