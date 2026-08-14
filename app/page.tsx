"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";

const publicStudentUrl = "https://tahdheeb-history.netlify.app/student";
type LoginMode = "teacher" | "student";

export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState<LoginMode>("student");
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  function changeMode(nextMode: LoginMode) {
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
    <main className="shell home-login-page" dir="rtl">
      <section className="hero">
        <div className="container portal-card unified-portal">
          <div className="portal-image-wrap">
            <img
              className="portal-image"
              src="https://shimmering-rolypoly-0ebda2.netlify.app/portal.png"
              alt="بوابة التهذيب التعليمية"
            />
            <a href="/student" className="qr-overlay" aria-label="الدخول إلى بوابة الطالب">
              <QRCodeSVG value={publicStudentUrl} size={138} includeMargin />
              <span>دخول الطالب عبر QR</span>
            </a>
          </div>

          <section className="unified-login-card">
            <div className="login-heading">
              <span>بوابة التهذيب التعليمية</span>
              <h1>مرحبًا بك</h1>
              <p>اختر نوع الدخول ثم أدخل بياناتك</p>
            </div>

            <div className="login-mode-tabs">
              <button className={mode === "student" ? "active" : ""} onClick={() => changeMode("student")}>
                <span>👨‍🎓</span>
                طالب / ولي أمر
              </button>
              <button className={mode === "teacher" ? "active" : ""} onClick={() => changeMode("teacher")}>
                <span>👨‍🏫</span>
                معلم
              </button>
            </div>

            <label className="unified-field-label">
              {mode === "teacher" ? "رمز دخول المعلم" : "رقم الهوية الوطنية للطالب"}
              <input
                className="unified-login-input"
                type={mode === "teacher" ? "password" : "text"}
                inputMode={mode === "teacher" ? "numeric" : "numeric"}
                value={value}
                onChange={(event) => {
                  const next = event.target.value.replace(/\D/g, "");
                  setValue(next.slice(0, mode === "teacher" ? 8 : 10));
                }}
                onKeyDown={(event) => event.key === "Enter" && submit()}
                placeholder={mode === "teacher" ? "أدخل الرمز" : "أدخل 10 أرقام"}
                autoComplete="off"
              />
            </label>

            {error && <p className="login-error">{error}</p>}
            <button className="unified-login-button" onClick={submit}>دخول إلى البوابة</button>

            <div className="login-help">
              <span>🔒 بياناتك محمية</span>
              <span>📱 يمكن للطالب الدخول من رمز QR</span>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
