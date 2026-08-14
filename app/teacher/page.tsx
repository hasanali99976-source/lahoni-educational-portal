"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function TeacherLoginPage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (code === "1415") {
      setError("");
      router.push("/teacher/dashboard");
      return;
    }
    setError("رمز الدخول غير صحيح");
  }

  return (
    <main className="teacher-login-page">
      <Link href="/" className="teacher-login-back">العودة للبوابة</Link>

      <section className="teacher-login-card">
        <div className="teacher-login-photo" aria-label="صورة المعلم الحالية">
          <div className="teacher-login-photo-shade" />
          <div className="teacher-login-photo-copy">
            <span>بوابة التهذيب التعليمية</span>
            <h2>التعليم يصنع الأثر</h2>
            <p>إدارة التحضير والدرجات والتقارير في مكان واحد.</p>
          </div>
        </div>

        <div className="teacher-login-form-wrap">
          <div className="teacher-login-brand">
            <div className="teacher-login-logo">ت</div>
            <div>
              <strong>مدرسة التهذيب الثانوية</strong>
              <small>نظام متابعة مادة التاريخ</small>
            </div>
          </div>

          <div className="teacher-login-heading">
            <span className="teacher-login-badge">دخول المعلم</span>
            <h1>مرحبًا أ. حسن علي الطويل</h1>
            <p>أدخل رمز المعلم للوصول إلى لوحة التحكم.</p>
          </div>

          <form onSubmit={submit} className="teacher-login-form">
            <label htmlFor="teacher-code">رمز الدخول</label>
            <div className="teacher-code-box">
              <span>🔒</span>
              <input
                id="teacher-code"
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={code}
                onChange={(event) => {
                  setCode(event.target.value.replace(/\D/g, ""));
                  setError("");
                }}
                placeholder="أدخل رمز المعلم"
                autoFocus
              />
            </div>

            {error && <p className="teacher-login-error">{error}</p>}

            <button type="submit" className="teacher-login-submit">
              دخول إلى لوحة المعلم
              <span>←</span>
            </button>
          </form>

          <p className="teacher-login-note">هذه الصفحة مخصصة للمعلم فقط.</p>
        </div>
      </section>
    </main>
  );
}
