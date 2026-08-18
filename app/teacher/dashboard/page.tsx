"use client";

import "./dashboard.css";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { tenantCollection, type SubjectKey } from "../../../lib/teacher-tenant";

type UnitGrade={percentage?:number;total?:number;maximumTotal?:number;updatedAt?:string};
type Student={id:string;name?:string;class?:string;research?:number;units?:Record<string,UnitGrade>};
type Session={authenticated?:boolean;teacherId?:string;teacherName?:string;subject?:string;subjectKey?:SubjectKey};

const unitKeys=["unit1","unit2","unit3","unit4","unit5"];

export default function TeacherDashboardPage(){
 const[session,setSession]=useState<Session|null>(null);const[students,setStudents]=useState<Student[]>([]);const[msg,setMsg]=useState("");
 useEffect(()=>{fetch("/api/teacher-session",{cache:"no-store"}).then(async r=>{if(!r.ok)throw 0;setSession(await r.json())}).catch(()=>setMsg("انتهت الجلسة. سجل الدخول من جديد."))},[]);
 useEffect(()=>{if(!session?.teacherId||!session.subjectKey)return;const path=tenantCollection(session.teacherId,session.subjectKey,"students");return onSnapshot(collection(db,path),snap=>setStudents(snap.docs.map(d=>({id:d.id,...d.data()})) as Student[]),()=>setMsg("تعذر تحميل بيانات المتابعة"))},[session]);
 const classes=useMemo(()=>Array.from(new Set(students.map(s=>(s.class||"").trim()).filter(Boolean))),[students]);
 const studentAverages=useMemo(()=>students.map(student=>{const values=Object.values(student.units||{}).map(u=>Number(u.percentage||0)).filter(v=>v>0);return{...student,average:values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length):0,ratedUnits:values.length}}),[students]);
 const rated=studentAverages.filter(s=>s.ratedUnits>0),low=studentAverages.filter(s=>s.ratedUnits>0&&s.average<60),excellent=studentAverages.filter(s=>s.average>=90),unrated=studentAverages.filter(s=>s.ratedUnits===0);
 const overall=rated.length?Math.round(rated.reduce((sum,s)=>sum+s.average,0)/rated.length):0;
 const incompleteClasses=classes.filter(c=>students.filter(s=>(s.class||"").trim()===c).some(s=>!s.units||unitKeys.every(k=>!Number(s.units?.[k]?.total||0))));
 const subject=session?.subject||"المادة",teacher=session?.teacherName||"المعلم";
 return <main className="smart-dashboard" dir="rtl">
  <section className="smart-head"><div><span>لوحة المتابعة الذكية</span><h1>أهلًا أستاذ {teacher}</h1><p>مؤشرات لحظية من رصد {subject} الحالي، بدون تخزين بيانات إضافية.</p></div><div style={{display:"flex",gap:10,flexWrap:"wrap"}}><Link href="/teacher/portfolio" style={{background:"#f4c95d",color:"#213746"}}>🏆 فتح ملف الإنجاز</Link><Link href="/teacher/grades">فتح سجل الدرجات</Link></div></section>
  {msg&&<p className="smart-message">{msg}</p>}
  <section style={{margin:"16px 0",padding:"18px 20px",borderRadius:20,background:"linear-gradient(135deg,#fff8df,#ffffff)",border:"1px solid #efd98d",display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}><div><strong style={{display:"block",fontSize:20,color:"#6c4b00"}}>ملف الإنجاز المهني جاهز لك</strong><span style={{color:"#786942"}}>أدخل بياناتك، أضف الشواهد، ثم أصدر ملف PDF رسمي للمدرسة.</span></div><Link href="/teacher/portfolio" style={{padding:"12px 18px",borderRadius:13,background:"#0d756f",color:"#fff",fontWeight:900,textDecoration:"none"}}>الدخول الآن</Link></section>
  <section className="smart-stats">
   <article><b>{students.length}</b><span>إجمالي الطلاب</span></article><article><b>{classes.length}</b><span>الفصول</span></article><article><b>{overall}%</b><span>متوسط الأداء</span></article><article className="warn"><b>{low.length}</b><span>يحتاجون متابعة</span></article><article className="good"><b>{excellent.length}</b><span>متميزون</span></article><article><b>{unrated.length}</b><span>لم يبدأ رصدهم</span></article>
  </section>
  <section className="smart-grid">
   <article className="smart-panel"><header><div><h2>طلاب يحتاجون متابعة</h2><p>متوسطهم أقل من ٦٠٪</p></div><Link href="/teacher/follow-up">المتابعة</Link></header><div className="smart-list">{low.slice(0,8).map(s=><div key={s.id}><span><strong>{s.name||"طالب"}</strong><small>{s.class||"بدون فصل"}</small></span><b>{s.average}%</b></div>)}{!low.length&&<p className="empty-smart">لا توجد حالات منخفضة حاليًا 🎉</p>}</div></article>
   <article className="smart-panel"><header><div><h2>الفصول غير المكتملة</h2><p>بها طلاب لم تُرصد لهم وحدات</p></div><Link href="/teacher/grades">الرصد</Link></header><div className="smart-list">{incompleteClasses.map(c=><div key={c}><span><strong>{c}</strong><small>{students.filter(s=>(s.class||"").trim()===c).length} طالبًا</small></span><b>غير مكتمل</b></div>)}{!incompleteClasses.length&&<p className="empty-smart">جميع الفصول مكتملة الرصد.</p>}</div></article>
  </section>
  <section className="smart-actions"><Link href="/teacher/portfolio"><span>🏆</span><b>ملف الإنجاز المهني</b><small>الشواهد والإحصاءات وإصدار PDF</small></Link><Link href="/teacher/timetable"><span>📅</span><b>الجدول الدراسي</b><small>تنظيم الحصص الأسبوعية</small></Link><Link href="/teacher/attendance"><span>🕘</span><b>التحضير اليومي</b><small>تسجيل الحضور والغياب</small></Link><Link href="/teacher/grades"><span>📊</span><b>رصد الدرجات</b><small>الوحدات والحضور والمشاركة</small></Link><Link href="/teacher/research"><span>🔬</span><b>رصد البحث</b><small>درجة البحث الفصلية</small></Link><Link href="/teacher/reports"><span>📄</span><b>تقارير الطلاب</b><small>الطباعة والتصدير</small></Link></section>
 </main>;
}
