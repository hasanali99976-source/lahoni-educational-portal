"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

type Mode = "student" | "teacher";
const studentUrl = "https://tahdheeb-history.netlify.app/student";

export default function HomePage() {
  const [mode, setMode] = useState<Mode>("student");
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  function choose(next: Mode) {
    setMode(next);
    setValue("");
    setError("");
  }

  function submit() {
    setError("");
    if (mode === "teacher") {
      if (value === "1415") window.location.href = "/teacher/dashboard";
      else setError("رمز دخول المعلم غير صحيح");
      return;
    }

    const id = value.replace(/\D/g, "");
    if (!/^\d{10}$/.test(id)) {
      setError("أدخل رقم هوية صحيحًا من 10 أرقام");
      return;
    }
    window.location.href = `/student?nationalId=${id}`;
  }

  return (
    <main dir="rtl" style={{minHeight:"100vh",background:"linear-gradient(135deg,#eef8f8,#f8fbfc 55%,#eaf2f7)",padding:"28px 16px",fontFamily:"Tahoma,Arial,sans-serif",color:"#17324d"}}>
      <div style={{width:"min(1180px,100%)",margin:"0 auto",background:"#fff",borderRadius:28,overflow:"hidden",boxShadow:"0 24px 70px rgba(20,65,86,.16)",display:"grid",gridTemplateColumns:"minmax(0,1.3fr) minmax(340px,.7fr)"}}>
        <section style={{position:"relative",minHeight:680,background:"#eaf4f6"}}>
          <img src="https://shimmering-rolypoly-0ebda2.netlify.app/portal.png" alt="بوابة التهذيب التعليمية" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} />
          <a href="/student" style={{position:"absolute",left:28,bottom:28,background:"#fff",padding:10,borderRadius:18,boxShadow:"0 12px 30px rgba(0,0,0,.18)",display:"flex",flexDirection:"column",alignItems:"center",gap:4,color:"#0e5a78",fontSize:11,fontWeight:700,textDecoration:"none"}}>
            <QRCodeSVG value={studentUrl} size={132} includeMargin />
            دخول الطالب عبر QR
          </a>
        </section>

        <section style={{padding:"42px 34px",display:"flex",flexDirection:"column",justifyContent:"center",background:"linear-gradient(180deg,#fff,#f8fcfd)"}}>
          <span style={{alignSelf:"flex-start",padding:"7px 12px",borderRadius:999,background:"#e8f6f7",color:"#147382",fontSize:12,fontWeight:800}}>الدخول الموحد الجديد</span>
          <h1 style={{fontSize:34,margin:"16px 0 8px",color:"#143f53"}}>مرحبًا بك</h1>
          <p style={{margin:"0 0 24px",color:"#718792"}}>اختر نوع الدخول ثم أدخل بياناتك</p>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
            <button type="button" onClick={()=>choose("student")} style={{border:"1px solid #d5e5eb",borderRadius:16,padding:"15px 10px",fontWeight:800,cursor:"pointer",background:mode==="student"?"linear-gradient(135deg,#0d617d,#1a99a5)":"#fff",color:mode==="student"?"#fff":"#496b79",boxShadow:mode==="student"?"0 12px 26px rgba(13,97,125,.2)":"none"}}>👨‍🎓<br/>طالب / ولي أمر</button>
            <button type="button" onClick={()=>choose("teacher")} style={{border:"1px solid #d5e5eb",borderRadius:16,padding:"15px 10px",fontWeight:800,cursor:"pointer",background:mode==="teacher"?"linear-gradient(135deg,#0d617d,#1a99a5)":"#fff",color:mode==="teacher"?"#fff":"#496b79",boxShadow:mode==="teacher"?"0 12px 26px rgba(13,97,125,.2)":"none"}}>👨‍🏫<br/>معلم</button>
          </div>

          <label style={{fontSize:13,fontWeight:800,color:"#36596b"}}>
            {mode === "teacher" ? "رمز دخول المعلم" : "رقم الهوية الوطنية للطالب"}
            <input type={mode==="teacher"?"password":"text"} inputMode="numeric" value={value} onChange={e=>setValue(e.target.value.replace(/\D/g,"").slice(0,mode==="teacher"?8:10))} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder={mode==="teacher"?"أدخل الرمز":"أدخل 10 أرقام"} style={{width:"100%",height:52,marginTop:8,padding:"0 14px",border:"1px solid #c7dbe3",borderRadius:14,background:"#fbfeff",fontSize:16,outline:"none",boxSizing:"border-box"}} />
          </label>

          {error && <p style={{margin:"10px 0 0",padding:"9px 11px",borderRadius:10,background:"#fff0ef",color:"#b42318",fontSize:13}}>{error}</p>}

          <button type="button" onClick={submit} style={{width:"100%",height:52,marginTop:18,border:0,borderRadius:14,background:"linear-gradient(135deg,#0d617d,#1895a3)",color:"#fff",fontWeight:800,cursor:"pointer",boxShadow:"0 13px 28px rgba(13,97,125,.22)"}}>دخول إلى البوابة</button>

          <div style={{display:"flex",flexWrap:"wrap",justifyContent:"space-between",gap:8,marginTop:17,paddingTop:14,borderTop:"1px solid #e5eff2",color:"#7c919b",fontSize:11}}><span>🔒 بياناتك محمية</span><span>📱 الدخول متاح عبر QR</span></div>
        </section>
      </div>
    </main>
  );
}
