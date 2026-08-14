"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowIcon, LockIcon, TeacherIcon } from "../../components/icons";

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
    <main className="auth-page" dir="rtl">
      <section className="auth-card">
        <div className="auth-visual">
          <span className="hero-eyebrow">بوابة التهذيب التعليمية</span>
          <h1 style={{ color: "#fff", fontSize: 30, marginTop: 16 }} className="text-balance">
            التعليم يصنع الأثر
          </h1>
          <p style={{ color: "rgba(255,255,255,.88)", marginTop: 12 }}>
            إدارة التحضير والدرجات والتقارير في مكان واحد منظم.
          </p>
          <div className="auth-photo">
            <img src="/portal.png" alt="الأستاذ حسن علي الطويل معلم مادة التاريخ" />
          </div>
        </div>

        <div className="auth-form-side">
          <Link href="/" className="auth-back">
            <ArrowIcon style={{ width: 16, height: 16 }} />
            العودة للبوابة
          </Link>

          <span className="eyebrow">
            <TeacherIcon style={{ width: 15, height: 15 }} />
            دخول المعلم
          </span>
          <h1>مرحبًا أ. حسن علي الطويل</h1>
          <p className="sub">أدخل رمز المعلم للوصول إلى لوحة التحكم.</p>

          <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
            <div>
              <label className="field-label" htmlFor="teacher-code">
                رمز الدخول
              </label>
              <div className="input-with-icon">
                <LockIcon />
                <input
                  id="teacher-code"
                  className="field"
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/\D/g, ""));
                    setError("");
                  }}
                  placeholder="أدخل رمز المعلم"
                  autoFocus
                />
              </div>
            </div>

            {error && <p className="error">{error}</p>}

            <button type="submit" className="btn primary block">
              دخول إلى لوحة المعلم
              <ArrowIcon style={{ width: 18, height: 18 }} />
            </button>
          </form>

          <p style={{ marginTop: 20, color: "var(--muted)", fontSize: 12.5 }}>
            هذه الصفحة مخصصة للمعلم فقط.
          </p>
        </div>
      </section>
    </main>
  );
}
