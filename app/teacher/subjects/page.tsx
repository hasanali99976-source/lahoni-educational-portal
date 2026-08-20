"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSubjectConfig } from "../../../lib/subject-config";
import { useTeacherClient } from "../../../lib/teacher-client";
import "./subjects.css";

type Subject = { subjectId: string; subjectName: string };

export default function TeacherSubjectsPage() {
  const session = useTeacherClient();
  const router = useRouter();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/teacher-session", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const data = await response.json();
        setSubjects(Array.isArray(data.subjects) ? data.subjects : []);
      })
      .catch(() => setMessage("تعذر تحميل المواد المخصصة للحساب."))
      .finally(() => setLoading(false));
  }, []);

  async function open(subjectId: string) {
    setMessage("");
    const response = await fetch("/api/teacher-session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subjectId }) });
    if (!response.ok) return setMessage("هذه المادة غير مرتبطة بحسابك.");
    await session?.refresh?.();
    router.push("/teacher/dashboard");
    router.refresh();
  }

  return <main className="subjects-page" dir="rtl">
    <section className="subjects-hero"><div><span>مساحة المواد</span><h1>المواد المخصصة لك</h1><p>يحدد مدير البوابة مواد كل معلم. بيانات كل مادة وطلابها ودرجاتها معزولة بالكامل عن المواد الأخرى.</p></div><div className="subjects-summary"><b>{subjects.length}</b><small>مادة مفعلة</small></div></section>
    {message && <p className="subject-message">{message}</p>}
    {loading ? <section className="empty-subjects"><h3>جارٍ تحميل المواد…</h3></section> : !subjects.length ? <section className="empty-subjects"><span>📚</span><h3>لا توجد مواد مرتبطة بحسابك</h3><p>اطلب من مدير البوابة إضافة المادة إلى حسابك.</p></section> : <section className="subjects-list"><header><div><h2>اختر المادة</h2><p>تتغير جميع صفحات البوابة إلى مساحة المادة المختارة.</p></div></header><div className="subjects-grid">{subjects.map((subject) => { const config = getSubjectConfig(subject.subjectId); return <article key={subject.subjectId} className={session?.subjectKey === subject.subjectId ? "current-subject" : ""}><div className="subject-cover"><div className="subject-art" aria-hidden="true"><span style={{fontSize:72}}>{config.icon || "📘"}</span></div><span className="subject-state">{session?.subjectKey === subject.subjectId ? "مفتوحة الآن" : "مفعلة"}</span></div><div className="subject-info"><h3>{subject.subjectName}</h3><p>مساحة مستقلة للطلاب والدرجات والحضور والتقارير</p></div><div className="subject-actions"><button onClick={() => open(subject.subjectId)}>فتح المادة</button></div></article>})}</div></section>}
  </main>;
}
