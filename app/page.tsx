"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";

type LoginMode = "teacher" | "student";

const teacherImage = "https://shimmering-rolypoly-0ebda2.netlify.app/portal.png";
const studentUrl = "https://tahdheeb-history.vercel.app/student";

export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState<LoginMode>("student");
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  function switchMode(nextMode: LoginMode) {
    setMode(nextMode);
    setValue("");
    setError("");
  }

  function submit() {
    setError("");

    if (mode === "teacher") {
      if (value === "1415") router.push("/teacher/dashboard");
      else setError("رمز دخول المعلم غير صحيح");
      return;
    }

    const nationalId = value.replace(/\D/g, "");
    if (!/^\d{10}$/.test(nationalId)) {
      setError("أدخل رقم هوية صحيحًا من 10 أرقام");
      return;
    }

    router.push(`/student?nationalId=${nationalId}`);
  }

  return (
    <main className="portal-home" dir="rtl">
      <section className="portal-card">
        <div className="portal-visual">
          <img src={teacherImage} alt="بوابة التهذيب وصورة المعلم" />
          <div className="portal-shade" />
          <div className="portal-copy">
            <span>مدرسة التهذيب الثانوية</span>
            <h2>بوابة التهذيب التعليمية</h2>
            <p>متابعة الحضور والدرجات والتقارير في مكان واحد.</p>
          </div>
          <a className="portal-qr" href="/student" aria-label="الدخول إلى بوابة الطالب">
            <QRCodeSVG value={studentUrl} size={122} includeMargin />
            <strong>الدخول السريع للطالب</strong>
          </a>
        </div>

        <div className="portal-login">
          <div className="portal-brand">
            <div className="portal-logo">ت</div>
            <div>
              <strong>بوابة التهذيب</strong>
              <small>نظام متابعة مادة التاريخ</small>
            </div>
          </div>

          <div className="portal-welcome">
            <span>النسخة الجديدة</span>
            <h1>أهلًا وسهلًا بكم</h1>
            <p>اختر نوع الدخول ثم أدخل بياناتك.</p>
          </div>

          <div className="portal-tabs">
            <button type="button" className={mode === "student" ? "active" : ""} onClick={() => switchMode("student")}>👨‍🎓<br />طالب / ولي أمر</button>
            <button type="button" className={mode === "teacher" ? "active" : ""} onClick={() => switchMode("teacher")}>👨‍🏫<br />معلم</button>
          </div>

          <label className="portal-label">
            {mode === "teacher" ? "رمز دخول المعلم" : "رقم الهوية الوطنية للطالب"}
            <input
              type={mode === "teacher" ? "password" : "text"}
              inputMode="numeric"
              value={value}
              onChange={(event) => {
                const nextValue = event.target.value.replace(/\D/g, "");
                setValue(nextValue.slice(0, mode === "teacher" ? 8 : 10));
                setError("");
              }}
              onKeyDown={(event) => event.key === "Enter" && submit()}
              placeholder={mode === "teacher" ? "أدخل الرمز" : "أدخل 10 أرقام"}
              autoComplete="off"
            />
          </label>

          {error && <p className="portal-error">{error}</p>}
          <button type="button" className="portal-submit" onClick={submit}>دخول إلى البوابة</button>
          <div className="portal-notes"><span>🔒 بيانات آمنة</span><span>📱 مناسب للجوال</span></div>
        </div>
      </section>

      <style jsx global>{`
        .portal-home{min-height:100vh;display:grid;place-items:center;padding:28px;background:radial-gradient(circle at 15% 12%,rgba(51,170,181,.16),transparent 26%),linear-gradient(135deg,#eef7f8,#fbfdfd 55%,#eaf2f6);font-family:Tahoma,Arial,sans-serif;color:#17384a}
        .portal-card{width:min(1180px,100%);min-height:700px;background:#fff;border:1px solid rgba(13,102,116,.09);border-radius:34px;overflow:hidden;display:grid;grid-template-columns:1.18fr .82fr;box-shadow:0 30px 80px rgba(20,69,91,.16)}
        .portal-visual{position:relative;min-height:700px;background:#dceef2;overflow:hidden}.portal-visual>img{width:100%;height:100%;object-fit:cover;object-position:center;display:block}.portal-shade{position:absolute;inset:0;background:linear-gradient(180deg,transparent 34%,rgba(4,50,64,.84))}
        .portal-copy{position:absolute;z-index:2;right:38px;left:38px;bottom:34px;color:#fff;padding-left:170px}.portal-copy span{display:inline-block;padding:7px 12px;border-radius:999px;background:rgba(255,255,255,.18);backdrop-filter:blur(8px);font-size:12px;font-weight:700}.portal-copy h2{font-size:34px;margin:14px 0 8px}.portal-copy p{margin:0;color:rgba(255,255,255,.84);font-size:17px}
        .portal-qr{position:absolute;z-index:3;left:28px;bottom:28px;background:#fff;padding:9px;border-radius:18px;box-shadow:0 12px 30px rgba(0,0,0,.18);display:flex;flex-direction:column;align-items:center;gap:3px;color:#0d6674;font-size:11px;text-decoration:none}
        .portal-login{padding:48px 42px;display:flex;flex-direction:column;justify-content:center;background:linear-gradient(180deg,#fff,#f8fcfd)}.portal-brand{display:flex;align-items:center;gap:13px;margin-bottom:44px}.portal-logo{width:54px;height:54px;border-radius:17px;display:grid;place-items:center;background:linear-gradient(135deg,#0a5260,#25a8b1);color:#fff;font-size:25px;font-weight:900;box-shadow:0 12px 28px rgba(13,102,116,.25)}.portal-brand>div:last-child{display:flex;flex-direction:column;gap:3px}.portal-brand strong{font-size:20px;color:#0a5260}.portal-brand small{color:#718895}
        .portal-welcome>span{display:inline-flex;padding:7px 11px;border-radius:999px;background:#e8f6f7;color:#147382;font-size:12px;font-weight:800}.portal-welcome h1{font-size:34px;margin:15px 0 8px;color:#143f53}.portal-welcome p{margin:0 0 26px;color:#6d8490}
        .portal-tabs{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-bottom:22px}.portal-tabs button{border:1px solid #d8e7ec;background:#fff;border-radius:16px;padding:15px 10px;color:#496b79;font-weight:800;cursor:pointer;transition:.2s}.portal-tabs button.active{background:linear-gradient(135deg,#0a5260,#1a99a5);color:#fff;border-color:transparent;box-shadow:0 12px 26px rgba(13,97,125,.2);transform:translateY(-1px)}
        .portal-label{display:block;font-size:13px;font-weight:800;color:#36596b}.portal-label input{width:100%;height:54px;margin-top:9px;padding:0 15px;border:1px solid #c7dbe3;border-radius:14px;background:#fbfeff;color:#17384a;font-size:17px;outline:0;box-sizing:border-box}.portal-label input:focus{border-color:#47a9b6;box-shadow:0 0 0 4px rgba(71,169,182,.12)}
        .portal-error{margin:11px 0 0;padding:10px 12px;border-radius:11px;background:#fff0ef;color:#b42318;font-size:13px}.portal-submit{width:100%;height:54px;margin-top:19px;border:0;border-radius:14px;background:linear-gradient(135deg,#0a5260,#1895a3);color:#fff;font-weight:800;cursor:pointer;box-shadow:0 13px 28px rgba(13,97,125,.22)}.portal-notes{display:flex;justify-content:space-between;gap:10px;margin-top:18px;padding-top:15px;border-top:1px solid #e5eff2;color:#7c919b;font-size:12px}
        @media(max-width:850px){.portal-card{grid-template-columns:1fr}.portal-visual{min-height:390px}.portal-login{padding:34px 26px}.portal-brand{margin-bottom:28px}.portal-copy{padding-left:150px}}
        @media(max-width:520px){.portal-home{padding:14px}.portal-card{border-radius:24px}.portal-visual{min-height:330px}.portal-copy{right:20px;left:20px;bottom:18px;padding-left:0;padding-bottom:140px}.portal-copy h2{font-size:25px}.portal-copy p{font-size:14px}.portal-qr{left:18px;bottom:18px}.portal-tabs{grid-template-columns:1fr}.portal-welcome h1{font-size:28px}.portal-login{padding:28px 20px}}
      `}</style>
    </main>
  );
}
