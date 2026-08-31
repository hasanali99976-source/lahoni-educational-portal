"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { getSubjectConfig, type SubjectKey } from "../../lib/subject-config";
import {
  TeacherClientContext,
  type TeacherClientAssignment,
  type TeacherClientSubject,
} from "../../lib/teacher-client";
import "./print-theme.css";
import "./teacher-v3.css";
import "./teacher-navigation-v4.css";
import "./subject-themes-v5.css";
import "./mobile-card-tables.css";
import "./teacher-mobile-ux-v6.css";

const tabs = [
  { href: "/teacher/dashboard", key: "dashboard", label: "الرئيسية", note: "ملخص الأداء" },
  { href: "/teacher/students", key: "students", label: "إدارة الطلاب", note: "الفصول وبيانات الدخول" },
  { href: "/teacher/attendance", key: "attendance", label: "الحضور والغياب", note: "التحضير اليومي" },
  { href: "/teacher/timetable", key: "timetable", label: "جدولي الدراسي", note: "الأحد إلى الخميس" },
  { href: "/teacher/grades", key: "grades", label: "رصد الدرجات", note: "مرتبط بالمعلم والمادة" },
  { href: "/teacher/diagnostics", key: "diagnostics", label: "الاختبارات التشخيصية", note: "النتائج والخطط العلاجية" },
  { href: "/teacher/follow-up", key: "follow", label: "الإتقان والمتابعة", note: "تحليل طلاب المعلم" },
  { href: "/teacher/portfolio", key: "portfolio", label: "ملف الإنجاز", note: "الشواهد والطباعة" },
  { href: "/teacher/ai", key: "ai", label: "المساعد الذكي", note: "تحليل وخطط مقترحة", badge: "AI" },
];

type TeacherSession = {
  teacherId?: string;
  teacherName?: string;
  subjectKey?: SubjectKey;
  workspaceKey?: string;
  activeGrade?: number | null;
  activeGradeLabel?: string;
  subject?: string;
  subjects?: TeacherClientSubject[];
  assignments?: TeacherClientAssignment[];
};

function TabIcon({ type }: { type: string }) {
  const common = { width: 23, height: 23, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (type === "dashboard") return <svg {...common}><path d="M4 13h6V4H4zM14 20h6V11h-6zM4 20h6v-3H4zM14 7h6V4h-6z"/></svg>;
  if (type === "grades") return <svg {...common}><path d="M4 19.5h16M6.5 16V9.5M11.8 16V5M17.1 16v-3.8"/><path d="m5.8 6.8 3-2.3 3 1.8 5.4-3"/></svg>;
  if (type === "attendance") return <svg {...common}><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.2 2"/></svg>;
  if (type === "timetable") return <svg {...common}><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M8 3v4M16 3v4M3.5 9.5h17M8 13h2M14 13h2M8 17h2M14 17h2"/></svg>;
  if (type === "diagnostics") return <svg {...common}><path d="M9 3h6l1 2h3v16H5V5h3z"/><path d="m8 11 2 2 4-4M8 17h8"/></svg>;
  if (type === "portfolio") return <svg {...common}><path d="M8 4h8l1 3h3v13H4V7h3zM9 11h6M9 15h6"/></svg>;
  if (type === "follow") return <svg {...common}><path d="M12 3.5 20 7v5.5c0 4.8-3.3 7.6-8 8.8-4.7-1.2-8-4-8-8.8V7z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg>;
  if (type === "ai") return <svg {...common}><circle cx="12" cy="12" r="4"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/></svg>;
  return <svg {...common}><path d="M16 20v-1.8a4.2 4.2 0 0 0-4.2-4.2H7.2A4.2 4.2 0 0 0 3 18.2V20"/><circle cx="9.5" cy="7" r="3.5"/><path d="M17 10.5a3.3 3.3 0 0 0 0-6.4M20.5 20v-1.8a4.2 4.2 0 0 0-3.1-4"/></svg>;
}

export default function TeacherLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/teacher";
  const [ready, setReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [teacherId, setTeacherId] = useState<string>();
  const [teacherName, setTeacherName] = useState("المعلم");
  const [subjectKey, setSubjectKey] = useState<SubjectKey>("history");
  const [workspaceKey, setWorkspaceKey] = useState("history");
  const [activeGrade, setActiveGrade] = useState<number | null>(null);
  const [activeGradeLabel, setActiveGradeLabel] = useState("");
  const [subjectName, setSubjectName] = useState("التاريخ");
  const [subjects, setSubjects] = useState<TeacherClientSubject[]>([]);
  const [assignments, setAssignments] = useState<TeacherClientAssignment[]>([]);
  const [switchingSubject, setSwitchingSubject] = useState(false);
  const subjectConfig = getSubjectConfig(subjectKey);

  function applySession(session: TeacherSession) {
    const nextSubjectKey = session.subjectKey || "history";
    setTeacherId(session.teacherId);
    setTeacherName(session.teacherName || "المعلم");
    setSubjectKey(nextSubjectKey);
    setWorkspaceKey(session.workspaceKey || nextSubjectKey);
    setActiveGrade(session.activeGrade || null);
    setActiveGradeLabel(session.activeGradeLabel || "");
    setSubjectName(session.subject || getSubjectConfig(nextSubjectKey).label);
    setSubjects(Array.isArray(session.subjects) ? session.subjects : []);
    setAssignments(Array.isArray(session.assignments) ? session.assignments : []);
  }

  function clearSessionState() {
    setTeacherId(undefined);
    setTeacherName("المعلم");
    setSubjectKey("history");
    setWorkspaceKey("history");
    setActiveGrade(null);
    setActiveGradeLabel("");
    setSubjectName("التاريخ");
    setSubjects([]);
    setAssignments([]);
    setMenuOpen(false);
  }

  async function logout() {
    setReady(false);
    clearSessionState();
    try { await Promise.all([fetch("/api/teacher-logout", { method: "POST", cache: "no-store" }), signOut(auth)]); }
    finally { window.location.replace("/teacher"); }
  }

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  useEffect(() => {
    if (isLoginPage) {
      setReady(false);
      clearSessionState();
      return;
    }
    setReady(false);
    clearSessionState();
    let active = true;
    fetch("/api/teacher-session", { cache: "no-store", credentials: "same-origin" })
      .then(response => response.ok ? response.json() : Promise.reject(new Error("session_failed")))
      .then((session: TeacherSession) => {
        if (!active) return;
        if (!session.teacherId) throw new Error("missing_teacher_identity");
        applySession(session);
        setReady(true);
      })
      .catch(() => {
        if (!active) return;
        clearSessionState();
        window.location.replace("/teacher");
      });
    return () => { active = false; };
  }, [isLoginPage, router]);

  async function changeSubject(nextWorkspaceKey: string) {
    if (nextWorkspaceKey === workspaceKey || switchingSubject) return;
    try {
      setSwitchingSubject(true);
      const response = await fetch("/api/teacher-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceKey: nextWorkspaceKey }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error();
      const selected = subjects.find(subject => subject.workspaceKey === nextWorkspaceKey);
      if (selected) {
        setWorkspaceKey(selected.workspaceKey);
        setSubjectKey(selected.subjectId as SubjectKey);
        setSubjectName(selected.subjectName || getSubjectConfig(selected.subjectId).label);
        setActiveGrade(selected.grade || null);
        setActiveGradeLabel(selected.gradeLabel || "");
      }
      setMenuOpen(false);
      window.location.assign("/teacher/dashboard");
    } finally { setSwitchingSubject(false); }
  }

  if (isLoginPage) return <>{children}</>;
  if (!ready) return <main className="teacher-shell-loading">جارٍ تجهيز بوابة المعلم…</main>;

  const contextValue = {
    authenticated: true,
    teacherId,
    teacherName,
    subjectKey,
    workspaceKey,
    activeGrade,
    activeGradeLabel,
    subject: subjectName,
    subjects,
    assignments,
    setSubject: changeSubject,
    refresh: async () => {
      const response = await fetch("/api/teacher-session", { cache: "no-store" });
      if (!response.ok) return;
      applySession(await response.json());
    },
  };

  return <TeacherClientContext.Provider key={teacherId} value={contextValue}>
    <div className={`teacher-app-shell ${subjectConfig.themeClass} ${menuOpen ? "menu-open" : ""}`} dir="rtl" data-subject={subjectKey}>
      <button className="teacher-menu-button" type="button" aria-label="فتح أقسام بوابة المعلم" aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)}><span/><span/><span/><b>كل الأوامر</b></button>
      {menuOpen ? <button className="teacher-menu-backdrop" type="button" aria-label="إغلاق القائمة" onClick={() => setMenuOpen(false)}/> : null}
      <aside className="teacher-sidebar">
        <div className="teacher-shell-brand"><Image className="teacher-portal-logo" src="/icons/ostadh-lahooni-192.jpg" alt="شعار بوابة أستاذ لحوني التعليمية" width={52} height={52} priority/><div><strong>بوابة أستاذ لحوني التعليمية</strong><small>{teacherName}</small></div><button className="teacher-menu-close" type="button" onClick={() => setMenuOpen(false)} aria-label="إغلاق القائمة">×</button></div>
        {subjects.length > 1 ? <section className="teacher-subject-switcher" aria-label="تغيير المادة أو المرحلة"><div className="subject-switcher-icon">{subjectConfig.shortMark}</div><label><span>المادة والمرحلة الحالية</span><select value={workspaceKey} onChange={event => void changeSubject(event.target.value)} disabled={switchingSubject}>{subjects.map(subject => <option key={subject.workspaceKey} value={subject.workspaceKey}>{subject.subjectName}{subject.gradeLabel ? ` — ${subject.gradeLabel}` : ""}</option>)}</select></label></section> : <section className="teacher-single-subject"><div className="subject-switcher-icon">{subjectConfig.shortMark}</div><div><small>المادة والمرحلة</small><strong>{subjectName}</strong><span>{activeGradeLabel}</span></div></section>}
        <div className="teacher-nav-title">أقسام بوابة المعلم</div>
        <nav className="teacher-tabs" aria-label="أقسام بوابة المعلم">{tabs.map(tab => { const active = pathname.startsWith(tab.href); return <Link key={tab.href} href={tab.href} className={active ? "active" : ""}><span className="teacher-tab-icon"><TabIcon type={tab.key}/></span><span className="teacher-tab-copy"><b>{tab.label}</b><small>{tab.note}</small></span>{tab.badge ? <em>{tab.badge}</em> : null}</Link>; })}</nav>
        <div className="teacher-header-actions"><Link href="/" className="teacher-home-link">الصفحة الرئيسية</Link><button className="teacher-logout" onClick={() => void logout()}>تسجيل الخروج</button></div>
      </aside>
      <main className="teacher-main">
        <header className="teacher-mobile-header"><div><small>بوابة المعلم</small><strong>{teacherName}</strong></div><span>{subjectConfig.label}{activeGradeLabel ? ` — ${activeGradeLabel}` : ""}</span></header>
        <section className="teacher-welcome-strip"><div className="teacher-welcome-copy"><span className="teacher-welcome-badge">مساحة {subjectConfig.label}{activeGradeLabel ? ` — ${activeGradeLabel}` : ""}</span><h2>أهلًا أستاذ {teacherName}</h2><p>أدواتك التعليمية مرتبة في قائمة واحدة واضحة.</p></div><Link className="teacher-ai-quick" href="/teacher/ai"><span>AI</span><div><b>المساعد التعليمي الذكي</b><small>تحليل النتائج والخطط العلاجية</small></div></Link></section>
        <div className="teacher-page-content">{children}</div>
      </main>
  </div>
</TeacherClientContext.Provider>;
}
