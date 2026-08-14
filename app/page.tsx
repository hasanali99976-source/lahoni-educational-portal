"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";

const studentUrl = "https://tahdheeb-history.netlify.app/student";
type LoginMode = "teacher" | "student";

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
      if (value === "1415") {
        router.push("/teacher/dashboard");
      } else {
        setError("رمز دخول المعلم غير صحيح");
      }
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
    <main className="v2-home" dir="rtl" data-version="tahdheeb-v2-final">
      <section className="v2-entry-card">
        <div className="v2-entry-visual">
          <img src="/portal.png" alt="بوابة التهذيب وصورة المعلم" />
          <div className="v2-entry-shade" />
          <div className="v2-entry-copy">
            <span>مدرسة التهذيب الثانوية</span>
            <h2>بوابة التهذيب التعليمية</h2>
            <p>متابعة الحضور والدرجات والتقارير في مكان واحد.</p>
          </div>

          <a href="/student" className="v2-entry-qr" aria-label="الدخول إلى بوابة الطالب">
            <QRCodeSVG value={studentUrl} size={122} includeMargin />
            <strong>الدخول السريع للطالب</strong>
          </a>
        </div>

        <div className="v2-entry-login">
          <div className="v2-entry-brand">
            <div className="v2-entry-logo">ت</div>
            <div>
              <strong>بوابة التهذيب</strong>
              <small>نظام متابعة مادة التاريخ</small>
            </div>
          </div>

          <div className="v2-entry-welcome">
            <span>النسخة الجديدة</span>
            <h1>أهلًا وسهلًا بكم</h1>
            <p>اختر نوع الدخول ثم أدخل بياناتك.</p>
          </div>

          <div className="v2-entry-tabs">
            <button
              type="button"
              className={mode === "student" ? "active" : ""}
              onClick={() => switchMode("student")}
            >
              <b>👨‍🎓</b>
              طالب / ولي أمر
            </button>
            <button
              type="button"
              className={mode === "teacher" ? "active" : ""}
              onClick={() => switchMode("teacher")}
            >
              <b>👨‍🏫</b>
              معلم
            </button>
          </div>

          <label className="v2-entry-label">
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

          {error && <p className="v2-entry-error">{error}</p>}

          <button type="button" className="v2-entry-submit" onClick={submit}>
            دخول إلى البوابة
          </button>

          <div className="v2-entry-notes">
            <span>🔒 بيانات آمنة</span>
            <span>📱 مناسب للجوال</span>
          </div>
        </div>
      </section>
    </main>
  );
}
