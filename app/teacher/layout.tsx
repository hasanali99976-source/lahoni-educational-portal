"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { getSubjectConfig, type SubjectKey } from "../../lib/subject-config";
import { readLocalGradePlan, setGradePlanCurrentTeacher } from "../../lib/grade-plan-local";
import { TeacherClientContext, type TeacherClientAssignment, type TeacherClientSubject } from "../../lib/teacher-client";
import "./print-theme.css";
import "./teacher-v3.css";
import "./subject-themes-v5.css";
import "./mobile-card-tables.css";
import "./teacher-daily-v70.css";
import "./teacher-professional-v71.css";
import "./attendance-professional-v71.css";
import "./teacher-ui-v107.css";

type TeacherTab = { href: string; key: string; label: string; note: string; badge?: string };
type TeacherSession = { teacherId?: string; teacherName?: string; subjectKey?: SubjectKey; workspaceKey?: string; activeGrade?: number | null; activeGradeLabel?: string; subject?: string; subjects?: TeacherClientSubject[]; assignments?: TeacherClientAssignment[]; };

const primaryTabs: TeacherTab[] = [
  { href: "/teacher/dashboard", key: "dashboard", label: "يومي", note: "مركز العمل اليومي" },
  { href: "/teacher/timetable", key: "timetable", label: "الجدول والحصص", note: "حصص الأسبوع" },
  { href: "/teacher/preparation", key: "preparation", label: "التحضير", note: "تحضير الدروس حسب الحصص" },
  { href: "/teacher/attendance", key: "attendance", label: "الحضور", note: "الحضور والمتابعة" },
  { href: "/teacher/grades", key: "grades", label: "الدرجات", note: "الرصد والحفظ" },
  { href: "/teacher/students", key: "students", label: "الطلاب", note: "الفصول وبيانات الدخول" },
];
const moreTabs: TeacherTab[] = [
  { href: "/teacher/diagnostics", key: "diagnostics", label: "الاختبارات التشخيصية", note: "النتائج والخطط العلاجية" },
  { href: "/teacher/follow-up", key: "follow", label: "الإتقان والمتابعة", note: "تحليل طلاب المعلم" },
  { href: "/teacher/discipline", key: "evaluation", label: "الانضباط", note: "التأخر والاستئذان" },
  { href: "/teacher/notes", key: "evaluation", label: "الملاحظات", note: "الملاحظات التربوية" },
  { href: "/teacher/plans", key: "plans", label: "الخطط", note: "العلاجية والإثرائية" },
  { href: "/teacher/reports", key: "reports", label: "مركز التقارير", note: "الحضور والدرجات" },
  { href: "/teacher/portfolio", key: "portfolio", label: "ملف الإنجاز", note: "الإنجاز المهني" },
];

const subjectTitle = (key?: SubjectKey, fallback?: string) => key ? getSubjectConfig(key).title : (fallback || "المادة");

export default function TeacherLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [session, setSession] = useState<TeacherSession>({});
  const [ready, setReady] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("teacherSession");
      if (raw) setSession(JSON.parse(raw));
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => { setMoreOpen(false); }, [pathname]);

  const assignments = Array.isArray(session.assignments) ? session.assignments : [];
  const subjects = Array.isArray(session.subjects) ? session.subjects : [];
  const subjectKey = session.subjectKey;
  const activeGrade = Number(session.activeGrade || 0) || null;
  const currentSubject = subjects.find((s) => s.key === subjectKey);
  const subject = subjectTitle(subjectKey, session.subject || currentSubject?.title);
  const gradeLabel = session.activeGradeLabel || (activeGrade ? `الصف ${activeGrade}` : "");

  const switchSubject = (nextKey: SubjectKey) => {
    const next = subjects.find((s) => s.key === nextKey);
    const nextAssignments = assignments.filter((a) => a.subjectKey === nextKey);
    const grades = [...new Set(nextAssignments.map((a) => Number(a.grade)).filter(Boolean))].sort();
    const nextGrade = grades.includes(Number(activeGrade)) ? Number(activeGrade) : (grades[0] || null);
    const nextSession = { ...session, subjectKey: nextKey, subject: next?.title || subjectTitle(nextKey), activeGrade: nextGrade, activeGradeLabel: nextGrade ? `الصف ${nextGrade}` : "" };
    setSession(nextSession);
    try { localStorage.setItem("teacherSession", JSON.stringify(nextSession)); setGradePlanCurrentTeacher(String(nextSession.teacherId || ""), nextKey, nextGrade); } catch {}
    window.location.href = pathname || "/teacher/dashboard";
  };

  const switchGrade = (grade: number) => {
    const nextSession = { ...session, activeGrade: grade, activeGradeLabel: `الصف ${grade}` };
    setSession(nextSession);
    try { localStorage.setItem("teacherSession", JSON.stringify(nextSession)); if (subjectKey) setGradePlanCurrentTeacher(String(nextSession.teacherId || ""), subjectKey, grade); } catch {}
    window.location.href = pathname || "/teacher/dashboard";
  };

  const logout = async () => {
    try { await signOut(auth); } catch {}
    try { localStorage.removeItem("teacherSession"); } catch {}
    window.location.href = "/teacher";
  };

  if (!ready) return <div className="teacher-pro-loading">جاري تجهيز بوابة المعلم...</div>;

  const availableGrades = [...new Set(assignments.filter((a) => !subjectKey || a.subjectKey === subjectKey).map((a) => Number(a.grade)).filter(Boolean))].sort();
  const isMoreActive = moreTabs.some((t) => pathname?.startsWith(t.href));

  return (
    <TeacherClientContext.Provider value={{ teacherId: String(session.teacherId || ""), teacherName: String(session.teacherName || ""), subjectKey, subject, activeGrade, gradeLabel, assignments, subjects }}>
      <div className="teacher-pro-shell" dir="rtl">
        <header className="teacher-pro-header">
          <Link href="/teacher/dashboard" className="teacher-pro-brand" aria-label="الرئيسية">
            <Image src="/brand/logo.png" width={38} height={38} alt="شعار البوابة" priority />
            <span className="teacher-pro-brand-copy"><strong>أستاذ لحوني</strong><small>بوابة المعلم</small></span>
          </Link>

          <div className="teacher-pro-context">
            {subjects.length > 1 ? <select value={subjectKey || ""} onChange={(e) => switchSubject(e.target.value as SubjectKey)} aria-label="اختيار المادة">{subjects.map((s) => <option key={s.key} value={s.key}>{s.title}</option>)}</select> : <strong>{subject}</strong>}
            {availableGrades.length > 1 ? <select value={activeGrade || ""} onChange={(e) => switchGrade(Number(e.target.value))} aria-label="اختيار الصف">{availableGrades.map((g) => <option key={g} value={g}>{`الصف ${g}`}</option>)}</select> : gradeLabel ? <small>{gradeLabel}</small> : null}
          </div>

          <nav className="teacher-pro-tabs" aria-label="أقسام بوابة المعلم">
            {primaryTabs.map((tab) => <Link key={tab.href} href={tab.href} className={pathname?.startsWith(tab.href) ? "active" : ""}><span>{tab.label}</span></Link>)}
            <div className="teacher-pro-more-wrap">
              <button type="button" className={`teacher-pro-more ${isMoreActive ? "active" : ""}`} onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen}><span>المزيد</span></button>
              {moreOpen && <div className="teacher-pro-more-menu">{moreTabs.map((tab) => <Link key={tab.href} href={tab.href} className={pathname?.startsWith(tab.href) ? "active" : ""}><strong>{tab.label}</strong><small>{tab.note}</small></Link>)}</div>}
            </div>
          </nav>

          <div className="teacher-pro-tools">
            <Link href="/teacher/dashboard" className="teacher-pro-home">الرئيسية</Link>
            <button type="button" onClick={logout} className="teacher-pro-logout">خروج</button>
          </div>
        </header>
        <main className="teacher-pro-main">{children}</main>
      </div>
    </TeacherClientContext.Provider>
  );
}
