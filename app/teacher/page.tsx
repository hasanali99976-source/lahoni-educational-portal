"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "../../lib/firebase";

export default function TeacherLoginPage() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/teacher-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password }),
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data?.message || "اسم المعلم أو الرقم السري غير صحيح");
        return;
      }

      if (data?.firebaseToken) await signInWithCustomToken(auth, data.firebaseToken);
      window.location.replace(`/teacher/dashboard?login=${Date.now()}`);
    } catch {
      setError("تعذر تسجيل الدخول الآن");
    } finally {
      setLoading(false);
    }
  }

  return <main className="portal-login neo-teacher-login" dir="rtl">
    <section className="portal-login-shell">
      <aside className="portal-login-visual neo-teacher-login-visual">
        <div>
          <span className="eyebrow">مساحة المعلم</span>
          <h1>ابدأ يومك من لوحة عمل واحدة.</h1>
          <p>التحضير والدرجات والجدول وإتقان الطلاب والاختبارات والذكاء الاصطناعي، مرتبة حسب سير عملك اليومي.</p>
        </div>
        <div className="neo-login-steps">
          <span><b>١</b> اختر المادة والمرحلة</span>
          <span><b>٢</b> افتح الأداة المطلوبة</span>
          <span><b>٣</b> احفظ وتابع الطلاب</span>
        </div>
      </aside>

      <section className="portal-login-form neo-teacher-login-form">
        <Link href="/" className="portal-back">← العودة إلى الصفحة الرئيسية</Link>
        <div className="portal-brand"><div className="portal-brand-mark">م</div><div><strong>أستاذ لحوني</strong><small>تسجيل دخول المعلم</small></div></div>
        <span className="neo-login-label">دخول آمن</span>
        <h2>مرحبًا بعودتك</h2>
        <p className="student-login-help">استخدم الاسم والرقم السري اللذين اعتمدتهما إدارة البوابة.</p>

        <form onSubmit={submit} className="neo-login-form">
          <label className="portal-field" htmlFor="teacher-name">اسم المعلم</label>
          <div className="portal-input"><span>✎</span><input id="teacher-name" value={name} onChange={event => { setName(event.target.value); setError(""); }} autoComplete="username" autoFocus required placeholder="اكتب اسم المعلم" /></div>

          <label className="portal-field" htmlFor="teacher-password">الرقم السري</label>
          <div className="portal-input neo-password-input"><span>●</span><input id="teacher-password" type={show ? "text" : "password"} value={password} onChange={event => { setPassword(event.target.value); setError(""); }} autoComplete="current-password" required /><button type="button" onClick={() => setShow(value => !value)}>{show ? "إخفاء" : "إظهار"}</button></div>

          {error && <p className="portal-error">{error}</p>}
          <button type="submit" className="portal-submit" disabled={loading || !name || !password}>{loading ? "جارٍ التحقق…" : "فتح مساحة العمل"}</button>
        </form>
        <p className="neo-login-note">يتم تحميل بيانات المعلم والمادة الحالية بعد التحقق من الجلسة، دون عرض بيانات الحساب السابق.</p>
      </section>
    </section>
  </main>;
}
