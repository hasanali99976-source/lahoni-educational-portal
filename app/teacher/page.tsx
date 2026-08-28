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

      // A hard navigation remounts the complete teacher portal and prevents any
      // state from the previous teacher from appearing before the new session loads.
      window.location.replace(`/teacher/dashboard?login=${Date.now()}`);
    } catch {
      setError("تعذر تسجيل الدخول الآن");
    } finally {
      setLoading(false);
    }
  }

  return <main className="v3-login v3-teacher-login" dir="rtl">
    <section className="v3-login-card">
      <Link href="/" className="v3-back">← العودة إلى البوابة الرئيسية</Link>
      <span className="v3-login-icon">✦</span>
      <small>هوية المعلم</small>
      <h1>دخول بوابة المعلم</h1>
      <p>استخدم الاسم والرقم السري اللذين أنشأهما مدير البوابة.</p>
      <form onSubmit={submit}>
        <label>اسم المعلم
          <input value={name} onChange={event => { setName(event.target.value); setError(""); }} autoComplete="username" autoFocus required placeholder="اكتب اسم المعلم" />
        </label>
        <label>الرقم السري
          <div className="v3-password">
            <input type={show ? "text" : "password"} value={password} onChange={event => { setPassword(event.target.value); setError(""); }} autoComplete="current-password" required />
            <button type="button" onClick={() => setShow(value => !value)}>{show ? "إخفاء" : "إظهار"}</button>
          </div>
        </label>
        {error && <p className="v3-error">{error}</p>}
        <button type="submit" className="v3-primary" disabled={loading || !name || !password}>{loading ? "جارٍ التحقق…" : "دخول بوابة المعلم"}</button>
      </form>
      <p className="v3-login-note">المواد وصلاحيات الحساب يحددها مدير البوابة فقط.</p>
    </section>
    <aside>
      <b>مساحة عمل المعلم</b>
      <h2>أدواتك التعليمية<br />بوضوح وهدوء</h2>
      <p>إدارة الطلاب والدرجات والحضور وملف الإنجاز والذكاء الاصطناعي في مساحة واحدة.</p>
    </aside>
  </main>;
}
