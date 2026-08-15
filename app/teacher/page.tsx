"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function TeacherLoginPage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/teacher-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data?.message || "رمز الدخول غير صحيح");
        return;
      }
      router.replace("/teacher/grades");
      router.refresh();
    } catch {
      setError("تعذر تسجيل الدخول الآن");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="teacher-login-page">
      <Link href="/" className="teacher-login-back">العودة للبوابة</Link>
      <section className="teacher-login-card">
        <div className="teacher-login-photo" aria-label="صورة المعلم الحالية"><div className="teacher-login-photo-shade" /><div className="teacher-login-photo-copy"><span>بوابة التهذيب التعليمية</span><h2>التعليم يصنع الأثر</h2><p>إدارة التحضير والدرجات والتقارير في مكان واحد.</p></div></div>
        <div className="teacher-login-form-wrap">
          <div className="teacher-login-brand"><div className="teacher-login-logo">ت</div><div><strong>مدرسة التهذيب الثانوية</strong><small>نظام متابعة مادة التاريخ</small></div></div>
          <div className="teacher-login-heading"><span className="teacher-login-badge">دخول المعلم الآمن</span><h1>مرحبًا أ. حسن علي الطويل</h1><p>أدخل رمز المعلم للوصول إلى لوحة التحكم.</p></div>
          <form onSubmit={submit} className="teacher-login-form">
            <label htmlFor="teacher-code">رمز الدخول</label>
            <div className="teacher-code-box"><span>🔒</span><input id="teacher-code" type="password" inputMode="numeric" maxLength={12} value={code} onChange={(event) => { setCode(event.target.value.replace(/\D/g, "")); setError(""); }} placeholder="أدخل رمز المعلم" autoFocus autoComplete="current-password" /></div>
            {error && <p className="teacher-login-error">{error}</p>}
            <button type="submit" className="teacher-login-submit" disabled={loading || !code}>{loading ? "جارٍ التحقق..." : "دخول إلى لوحة المعلم"}<span>←</span></button>
          </form>
          <p className="teacher-login-note">الجلسة محفوظة في Cookie آمنة ولا يظهر رمز المعلم داخل صفحة الموقع.</p>
        </div>
      </section>
    </main>
  );
}
