"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { readLocalGradePlan, setGradePlanCurrentTeacher } from "../../lib/grade-plan-local";

const teacherFeatures = [
  { key: "reports", title: "التقارير", text: "تقارير شاملة وتحليلات دقيقة لأداء الطلاب" },
  { key: "attendance", title: "الحضور", text: "إدارة حضور الطلاب ومتابعة الغياب" },
  { key: "prep", title: "التحضير", text: "تحضير الدروس والخطط الدراسية باحترافية" },
  { key: "tests", title: "إدارة الاختبارات", text: "إنشاء الاختبارات ومتابعة النتائج بسهولة" },
] as const;

function FeatureIcon({ type }: { type: string }) {
  if (type === "reports") return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M9 39V25h7v14M20 39V17h7v22M31 39V9h8v30"/><path d="M7 39h34"/></svg>;
  if (type === "attendance") return <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="17" cy="16" r="6"/><circle cx="32" cy="19" r="5"/><path d="M6 39c1.4-8 6-12 11-12s9.5 4 11 12M27 39c1-5.5 4-8.5 7.5-8.5S41 33.5 42 39"/></svg>;
  if (type === "prep") return <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="10" y="8" width="28" height="32" rx="4"/><path d="M17 5v7M31 5v7M16 19h16M16 25h11M16 31h14"/></svg>;
  return <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="15"/><path d="M24 9v15h15M16 16l8 8-7 8"/></svg>;
}

export default function TeacherLoginPage() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/teacher-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data?.message || "اسم المعلم أو الرقم السري غير صحيح");
        return;
      }
      if (data?.firebaseToken) await signInWithCustomToken(auth, data.firebaseToken);
      if (data?.teacherId) setGradePlanCurrentTeacher(data.teacherId);

      let destination = "/teacher/dashboard";
      try {
        const planResponse = await fetch("/api/teacher/grade-plan", { cache: "no-store", credentials: "same-origin" });
        const plan = await planResponse.json().catch(() => ({}));
        const hasPlan = Boolean(plan?.activePlan || plan?.hasActivePlan || readLocalGradePlan(data?.teacherId));
        if (planResponse.ok && !hasPlan) destination = "/teacher/grade-plan?setup=1";
      } catch {
        if (!readLocalGradePlan(data?.teacherId)) destination = "/teacher/grade-plan?setup=1";
      }

      router.replace(destination);
      router.refresh();
    } catch {
      setError("تعذر تسجيل الدخول الآن");
    } finally {
      setLoading(false);
    }
  }

  return <main className="v3-login v3-teacher-login" dir="rtl">
    <section className="teacher-entry-intro" aria-label="بوابة المعلم">
      <span>مرحباً بك في</span>
      <h1>بوابة المعلم</h1>
      <p>منصتك الذكية لإدارة الصف بكفاءة وتميّز</p>
      <small>الاختبارات، التحضير، الحضور، التقارير</small>
    </section>

    <section className="v3-login-card">
      <Link href="/" className="v3-back">← العودة إلى البوابة الرئيسية</Link>
      <span className="v3-login-icon" aria-hidden="true" />
      <small>بوابة أستاذ لحوني التعليمية</small>
      <h1>دخول المعلم</h1>
      <p>استخدم الاسم والرقم السري اللذين أنشأهما مدير البوابة.</p>
      <form onSubmit={submit}>
        <label>اسم المعلم
          <input value={name} onChange={event => { setName(event.target.value); setError(""); }} autoComplete="username" autoFocus required placeholder="اسم المستخدم" />
        </label>
        <label>الرقم السري
          <div className="v3-password">
            <input type={show ? "text" : "password"} value={password} onChange={event => { setPassword(event.target.value); setError(""); }} autoComplete="current-password" required placeholder="كلمة المرور" />
            <button type="button" onClick={() => setShow(!show)}>{show ? "إخفاء" : "إظهار"}</button>
          </div>
        </label>
        {error && <p className="v3-error">{error}</p>}
        <button className="v3-primary" disabled={loading || !name || !password}>{loading ? "جارٍ التحقق…" : "دخول المعلم"}</button>
      </form>
      <p className="v3-login-note">المواد وصلاحيات الحساب يحددها مدير البوابة فقط.</p>
    </section>

    <section className="teacher-entry-features" aria-label="خدمات بوابة المعلم">
      {teacherFeatures.map(feature => <article key={feature.key} className={feature.key}>
        <span><FeatureIcon type={feature.key} /></span>
        <h2>{feature.title}</h2>
        <p>{feature.text}</p>
      </article>)}
    </section>

    <footer className="teacher-entry-credit">إعداد البوابة: <b>الأستاذ حسن علي الطويل</b></footer>
  </main>;
}
