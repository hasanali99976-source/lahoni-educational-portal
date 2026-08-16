"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import "./portal-login.css";

type LastTeacher = { teacherName: string; subject: string };
const LAST_TEACHER_KEY = "lahooni-last-teacher";

export default function TeacherLoginPage() {
  const [username,setUsername]=useState("");
  const [password,setPassword]=useState("");
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);
  const [lastTeacher,setLastTeacher]=useState<LastTeacher|null>(null);
  const router=useRouter();

  useEffect(()=>{
    try{
      const saved=localStorage.getItem(LAST_TEACHER_KEY);
      if(saved){
        const parsed=JSON.parse(saved) as LastTeacher;
        if(parsed?.teacherName)setLastTeacher(parsed);
      }
    }catch{}
  },[]);

  async function submit(event?:FormEvent){
    event?.preventDefault();setError("");setLoading(true);
    try{
      const response=await fetch("/api/teacher-login",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({username,password}),
      });
      const data=await response.json();
      if(!response.ok){setError(data?.message||"اسم المستخدم أو كلمة المرور غير صحيحة");return;}
      const teacherName=String(data?.teacherName||username).trim();
      const subject=String(data?.subject||"").trim();
      const saved={teacherName,subject};
      localStorage.setItem(LAST_TEACHER_KEY,JSON.stringify(saved));
      setLastTeacher(saved);
      router.replace("/teacher/grades");
      router.refresh();
    }catch{setError("تعذر تسجيل الدخول الآن")}
    finally{setLoading(false)}
  }

  const welcomeName=lastTeacher?.teacherName?`مرحبًا أستاذ ${lastTeacher.teacherName}`:"مرحبًا بك في بوابة المعلم";
  const welcomeLead=lastTeacher?.subject
    ?`يمكنك الدخول مجددًا إلى بوابة مادة ${lastTeacher.subject}، أو استخدام حساب المعلم الآخر.`
    :"أدخل بياناتك للوصول إلى لوحة المعلم.";

  return <main className="portal-login" dir="rtl"><section className="portal-login-shell"><div className="portal-login-visual"><div><span className="eyebrow">منصة تعليمية تفاعلية</span><h1>بوابة أستاذ لحوني التعليمية</h1><p>كل أدواتك التعليمية في مكان واحد، بتجربة ذكية وسلسة تساعدك على متابعة الطلاب وصناعة الأثر.</p></div><div className="portal-orbit" aria-hidden="true"><div className="ring"/><div className="ring two"/><div className="book">✦</div></div><div className="portal-feature-row"><span>📊 رصد ذكي</span><span>📚 متابعة تعليمية</span><span>🔔 تنبيهات فورية</span><span>🛡️ دخول آمن</span></div></div><div className="portal-login-form"><Link href="/" className="portal-back">← العودة للبوابة الرئيسية</Link><div className="portal-brand"><div className="portal-brand-mark">ح</div><div><strong>أستاذ لحوني</strong><small>بوابة المعلم</small></div></div><span className="badge">دخول المعلم الآمن</span><h2>{welcomeName}</h2><p className="lead">{welcomeLead}</p><form onSubmit={submit}><label className="portal-field">اسم المستخدم</label><div className="portal-input"><span>👤</span><input value={username} onChange={e=>{setUsername(e.target.value);setError("")}} placeholder="أدخل اسم المستخدم" autoFocus autoComplete="username"/></div><label className="portal-field">كلمة المرور</label><div className="portal-input"><span>🔒</span><input type="password" value={password} onChange={e=>{setPassword(e.target.value);setError("")}} placeholder="أدخل كلمة المرور" autoComplete="current-password"/></div>{error&&<p className="portal-error">{error}</p>}<button className="portal-submit" type="submit" disabled={loading||!username||!password}>{loading?"جارٍ التحقق...":"دخول إلى بوابة المعلم  ←"}</button></form><p className="portal-note">لكل جهاز ومتصفح جلسة مستقلة؛ يمكن للمعلمين استخدام البوابة في الوقت نفسه من أجهزتهم أو متصفحاتهم المنفصلة.</p></div></section></main>;
}
