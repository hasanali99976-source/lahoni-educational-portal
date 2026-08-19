"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import "./portal-login.css";

type LastTeacher = { teacherName: string; subject: string };
const LAST_TEACHER_KEY = "lahooni-last-teacher";
type Subject = { subjectId: string; subjectName: string };

const TEACHERS = ["حسن الطويل", "عبد الله الرويشد"] as const;

export default function TeacherLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastTeacher, setLastTeacher] = useState<LastTeacher | null>(null);
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const router = useRouter();

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LAST_TEACHER_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as LastTeacher;
        if (parsed?.teacherName) setLastTeacher(parsed);
      }
    } catch {}
  }, []);

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
        setError(data?.message || "اسم المعلم أو كلمة المرور غير صحيحة");
        return;
      }
      const teacherName = String(data?.teacherName || username).trim();
      const subject = String(data?.subject || "").trim();
      const saved = { teacherName, subject };
      localStorage.setItem(LAST_TEACHER_KEY, JSON.stringify(saved));
      setLastTeacher(saved);

      try {
        const sres = await fetch("/api/teacher-session", { cache: "no-store" });
        if (sres.ok) {
          const sdata = await sres.json();
          const list = Array.isArray(sdata?.subjects) ? (sdata.subjects as Subject[]) : [];
          if (list.length === 0) {
            router.replace("/teacher/subjects");
            router.refresh();
            return;
          }
          if (list.length > 1) {
            setSubjects(list);
            return;
          }
        }
      } catch {}

      router.replace("/teacher/grades");
      router.refresh();
    } catch {
      setError("تعذر تسجيل الدخول الآن");
    } finally {
      setLoading(false);
    }
  }

  async function select(subjectId: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/teacher-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId }),
      });
      if (!res.ok) throw new Error("لم يكن بالإمكان اختيار المادة");
      router.replace("/teacher/grades");
      router.refresh();
    } catch (err) {
      setError(String((err as Error)?.message || err));
    } finally {
      setLoading(false);
    }
  }

  const welcomeName = lastTeacher?.teacherName ? `مرحبًا أستاذ ${lastTeacher.teacherName}` : "مرحبًا بك في بوابة المعلم";
  const welcomeLead = "اختر اسم المعلم ثم أدخل كلمة المرور للوصول إلى اللوحة.";

  if (subjects && subjects.length > 0) {
    return (
      <main className="portal-login" dir="rtl">
        <section className="portal-login-shell">
          <div className="portal-login-visual"><h1>اختر المادة</h1><p>اختر المادة التي تريد العمل عليها في هذه الجلسة.</p></div>
          <div className="portal-login-form">
            <h2>اختيار المادة</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
              {subjects.map((item) => (
                <button key={item.subjectId} onClick={() => select(item.subjectId)} className="portal-subject-card" style={{ padding: 16, borderRadius: 8, border: "1px solid #eee", background: "#fff", textAlign: "center" }}>
                  <div style={{ fontSize: 36 }}>📘</div>
                  <div style={{ fontWeight: 700, marginTop: 8 }}>{item.subjectName}</div>
                </button>
              ))}
            </div>
            <Link href="/teacher/subjects" style={{ display: "inline-block", marginTop: 16, fontWeight: 800 }}>إدارة موادي</Link>
            {error && <p className="portal-error" style={{ marginTop: 12 }}>{error}</p>}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="portal-login" dir="rtl">
      <section className="portal-login-shell">
        <div className="portal-login-visual"><div><span className="eyebrow">منصة تعليمية تفاعلية</span><h1>بوابة أستاذ لحوني التعليمية</h1><p>كل أدواتك التعليمية في مكان واحد، بتجربة ذكية وسلسة تساعدك على متابعة الطلاب وصناعة الأثر.</p></div><div className="portal-orbit" aria-hidden="true"><div className="ring"/><div className="ring two"/><div className="book">✦</div></div><div className="portal-feature-row"><span>📊 رصد ذكي</span><span>📚 متابعة تعليمية</span><span>🔔 تنبيهات فورية</span><span>🛡️ دخول آمن</span></div></div>
        <div className="portal-login-form"><Link href="/" className="portal-back">← العودة للبوابة الرئيسية</Link><div className="portal-brand"><div className="portal-brand-mark">ح</div><div><strong>أستاذ لحوني</strong><small>بوابة المعلم</small></div></div><span className="badge">دخول المعلم الآمن</span><h2>{welcomeName}</h2><p className="lead">{welcomeLead}</p>
          <form onSubmit={submit}>
            <label className="portal-field">اسم المعلم</label>
            <div className="portal-input"><span>👤</span><select value={username} onChange={e=>{setUsername(e.target.value);setError("")}} autoFocus required style={{width:"100%",border:0,outline:0,background:"transparent",font:"inherit",color:"#17384a"}}><option value="">اختر اسم المعلم</option>{TEACHERS.map((teacher)=><option key={teacher} value={teacher}>{teacher}</option>)}</select></div>
            <label className="portal-field">كلمة المرور</label><div className="portal-input"><span>🔒</span><input type="password" value={password} onChange={e=>{setPassword(e.target.value);setError("")}} placeholder="أدخل كلمة المرور" autoComplete="current-password"/></div>{error&&<p className="portal-error">{error}</p>}<button className="portal-submit" type="submit" disabled={loading||!username||!password}>{loading?"جارٍ التحقق...":"دخول إلى بوابة المعلم  ←"}</button>
          </form>
          <p className="portal-note">اختر اسمك فقط، ثم أدخل كلمة المرور.</p></div>
      </section>
    </main>
  );
}
