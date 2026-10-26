"use client";
import { useState } from "react";
import Link from "next/link";
type Row={code:string;name:string;className:string;teacher:string;subject:string;documentId:string;hasGrades:boolean;hasNotes:boolean;issue:string};
type Official={code:string;name:string;className:string;active:boolean;linked:boolean};
type Result={ok:boolean;message?:string;generatedAt:string;officialTotal:number;activeTotal:number;archivedTotal:number;teachersChecked:number;rows:Row[];officialRows:Official[];limited:boolean};
export default function StudentAudit(){
 const [query,setQuery]=useState("TH2001"),[result,setResult]=useState<Result|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 async function inspect(){setBusy(true);setError("");setResult(null);try{const response=await fetch("/api/admin/student-audit?code="+encodeURIComponent(query.trim()),{cache:"no-store"});const data=await response.json() as Result;if(!response.ok||!data.ok)throw Error(data.message||"تعذر الفحص");setResult(data)}catch(e){setError(e instanceof Error?e.message:"تعذر الفحص")}finally{setBusy(false)}}
 const issues=result?.rows.filter(row=>row.issue)||[];
 return <main dir="rtl" style={{minHeight:"100vh",padding:"clamp(18px,4vw,48px)",background:"#f1f7fa",color:"#183a4d",fontFamily:"Tajawal,Arial,sans-serif"}}>
  <div style={{maxWidth:1250,margin:"auto"}}>
   <Link href="/admin/students" style={{color:"#167c92"}}>← إدارة الطلاب</Link>
   <header style={{background:"linear-gradient(115deg,#103f56,#177b91)",color:"white",padding:28,borderRadius:22,margin:"18px 0"}}>
    <small>أداة تشخيص آمنة · قراءة فقط</small><h1 style={{margin:"8px 0"}}>فحص ومطابقة سجلات الطلاب</h1>
    <p>مقارنة الباركود والاسم والفصل في قائمة الإدارة مع سجلات التحصيل لدى المعلمين. لا تُحذف ولا تُعدّل أي بيانات.</p>
   </header>
   <section style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center",marginBottom:20}}>
    <input aria-label="كود أو اسم الطالب" placeholder="كود الطالب أو اسمه، أو اتركه فارغًا لفحص الجميع" value={query} onChange={e=>setQuery(e.target.value)} style={{flex:"1 1 280px",padding:14,borderRadius:12,border:"1px solid #bdd3df",fontSize:17}}/>
    <button onClick={inspect} disabled={busy} style={{padding:"14px 28px",border:0,borderRadius:12,background:"#087c8f",color:"white",fontWeight:800,cursor:"pointer"}}>{busy?"جارٍ فحص Firebase…":"ابدأ المطابقة"}</button>
   </section>
   {error&&<p role="alert" style={{color:"#a32030"}}>{error}</p>}
   {result&&<>
    <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:20}}>{[["طلاب الإدارة النشطون",result.activeTotal],["المؤرشفون",result.archivedTotal],["سجلات المواد المفحوصة",result.teachersChecked],["حالات تحتاج مراجعة",issues.length]].map(([label,value])=><div key={label} style={{flex:"1 1 180px",background:"white",padding:20,borderRadius:14,boxShadow:"0 2px 10px #d6e4eb"}}><small>{label}</small><h2>{value}</h2></div>)}</div>
    {result.limited&&<p style={{color:"#ad6500"}}>وصل الفحص إلى حد العرض؛ استخدم البحث بالكود لتضييق النتائج.</p>}
    <h2>الطلاب في قائمة الإدارة {query&&"(نتيجة البحث)"}</h2>
    <div style={{overflowX:"auto",background:"white",borderRadius:14,marginBottom:25}}><table style={{width:"100%",borderCollapse:"collapse",textAlign:"right"}}><thead><tr>{["الباركود","الاسم الرسمي","الفصل","الحالة","سجل معلم ظاهر بالفحص"].map(v=><th key={v} style={{padding:12,borderBottom:"1px solid #ddd"}}>{v}</th>)}</tr></thead><tbody>{result.officialRows.map(v=><tr key={v.code}>{[v.code,v.name,v.className,v.active?"نشط":"مؤرشف",v.linked?"نعم":"لم يظهر"].map((x,i)=><td key={i} style={{padding:12,borderBottom:"1px solid #eee"}}>{x}</td>)}</tr>)}</tbody></table>{!result.officialRows.length&&<p style={{padding:15}}>لا يوجد طالب مطابق في قائمة الإدارة.</p>}</div>
    <h2>سجلات المعلمين المطابقة {query&&"(نتيجة البحث)"}</h2>
    <div style={{overflowX:"auto",background:"white",borderRadius:14}}><table style={{width:"100%",borderCollapse:"collapse",textAlign:"right"}}><thead><tr>{["الكود","الطالب","المعلم","المادة","معرّف المستند","درجات","ملاحظات","نتيجة الفحص"].map(v=><th key={v} style={{padding:12,borderBottom:"1px solid #ddd"}}>{v}</th>)}</tr></thead><tbody>{result.rows.map((v,i)=><tr key={i}>{[v.code,v.name,v.teacher,v.subject,v.documentId,v.hasGrades?"نعم":"لا",v.hasNotes?"نعم":"لا",v.issue||"مطابق"].map((x,j)=><td key={j} style={{padding:12,borderBottom:"1px solid #eee",color:j===7&&v.issue?"#b45309":undefined}}>{x}</td>)}</tr>)}</tbody></table>{!result.rows.length&&<p style={{padding:15}}>لم يُعثر على سجلات معلمين مطابقة في نطاق الفحص.</p>}</div>
    <p style={{marginTop:18,color:"#617b87"}}>تاريخ الفحص: {new Date(result.generatedAt).toLocaleString("ar-SA")}. هذه أداة تشخيص فقط ولا تُغيّر سجلات الطلاب.</p>
   </>}
  </div>
 </main>;
}
