"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function TeacherLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data?.message || "اسم المستخدم أو كلمة المرور غير صحيحة");
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
      <Link href="/" className="teacher-login-back">العودة للبوابة الرئيسية</Link>
      <section className="teacher-login-card">
        <div className="teacher-login-photo" aria-label="صورة الأستاذ حسن علي الطويل"><div className="teacher-login-photo-shade" /><div className="teacher-login-photo-copy"><span>بوابة أستاذ لحوني التعليمية</span><h2>التعليم يصنع الأثر</h2><p>إدارة التحضير والدرجات والتقارير في مكان واحد.</p></div></div>
        <div className="teacher-login-form-wrap">
          <div className="teacher-login-brand"><div className="teacher-login-logo">ح</div><div><strong>بوابة أستاذ لحوني التعليمية</strong><small>نظام متابعة مادة التاريخ</small></div></div>
          <div className="teacher-login-heading"><span className="teacher-login-badge">دخول المعلم الآمن</span><h1>مرحبًا أ. حسن علي الطويل</h1><p>أدخل اسم المستخدم وكلمة المرور للوصول إلى لوحة التحكم.</p></div>
          <form onSubmit={submit} className="teacher-login-form">
            <label htmlFor="teacher-username">اسم المستخدم</label>
            <div className="teacher-code-box"><span>👤</span><input id="teacher-username" type="text" value={username} onChange={(event) => { setUsername(event.target.value); setError(""); }} placeholder="أدخل اسم المستخدم" autoFocus autoComplete="username" /></div>
            <label htmlFor="teacher-password">كلمة المرور</label>
            <div className="teacher-code-box"><span>🔒</span><input id="teacher-password" type="password" value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} placeholder="أدخل كلمة المرور" autoComplete="current-password" /></div>
            {error && <p className="teacher-login-error">{error}</p>}
            <button type="submit" className="teacher-login-submit" disabled={loading || !username || !password}>{loading ? "جارٍ التحقق..." : "دخول إلى لوحة المعلم"}<span>←</span></button>
          </form>
          <p className="teacher-login-note">الجلسة آمنة وتنتهي تلقائيًا بعد 10 دقائق من عدم النشاط.</p>
        </div>
      </section>
    </main>
  );
}
