"use client";

import Image from "next/image";
import Link from "next/link";
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

const tabs = [
  { href: "/teacher/dashboard", key: "dashboard", label: "نظرة عامة", note: "مؤشرات اليوم" },
  { href: "/teacher/students", key: "students", label: "الطلاب", note: "القوائم والأكواد" },
  { href: "/teacher/attendance", key: "attendance", label: "التحضير", note: "الحضور والغياب" },
  { href: "/teacher/timetable", key: "timetable", label: "الجدول", note: "الحصص الأسبوعية" },
  { href: "/teacher/grades", key: "grades", label: "الدرجات", note: "الرصد والنتائج" },
  { href: "/teacher/diagnostics", key: "diagnostics", label: "الاختبارات", note: "التشخيص والخطط" },
  { href: "/teacher/follow-up", key: "follow", label: "الإتقان", note: "المتابعة والتدخل" },
  { href: "/teacher/portfolio", key: "portfolio", label: "الإنجاز", note: "الشواهد والطباعة" },
  { href: "/teacher/ai", key: "ai", label: "المساعد الذكي", note: "تحليل واقتراحات", badge: "AI" },
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
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
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
  const [ready, setReady] = useState(isLoginPage);
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

  async function logout() {
    try {
      await Promise.all([
        fetch("/api/teacher-logout", { method: "POST", cache: "no-store" }),
        signOut(auth),
      ]);
    } finally {
      window.location.replace("/teacher");
    }
  }

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  useEffect(() => {
    if (isLoginPage) { setReady(true); return; }
    let active = true;
    setReady(false);
    fetch("/api/teacher-session", { cache: "no-store" })
      .then(response => response.ok ? response.json() : Promise.reject(new Error("session_failed")))
      .then((session: TeacherSession) => {
        if (!active) return;
        applySession(session);
        setReady(true);
      })
      .catch(() => active && router.replace("/teacher"));
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
      setMenuOpen(false);
      window.location.assign("/teacher/dashboard");
    } finally {
      setSwitchingSubject(false);
    }
  }

  if (isLoginPage) return <>{children}</>;
  if (!ready) return <main className="teacher-shell-loading">جارٍ تجهيز مساحة المعلم…</main>;

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
      if (response.ok) applySession(await response.json());
    },
  };

  const activeTab = tabs.find(tab => pathname.startsWith(tab.href)) || tabs[0];

  return <TeacherClientContext.Provider value={contextValue}>
    <div className={`teacher-app-shell neo-teacher-shell ${subjectConfig.themeClass} ${menuOpen ? "menu-open" : ""}`} dir="rtl" data-subject={subjectKey}>
      <header className="neo-teacher-topbar">
        <div className="neo-teacher-brand">
          <Image src="/icons/ostadh-lahooni-192.jpg" alt="شعار بوابة أستاذ لحوني التعليمية" width={48} height={48} priority />
          <div><small>مساحة العمل التعليمية</small><strong>أستاذ لحوني</strong></div>
        </div>
        <div className="neo-teacher-current"><span>{subjectConfig.shortMark}</span><div><small>المادة والمرحلة</small><b>{subjectName}{activeGradeLabel ? ` — ${activeGradeLabel}` : ""}</b></div></div>
        <div className="neo-teacher-top-actions">
          <Link href="/teacher/ai" className="neo-ai-button">AI <span>المساعد</span></Link>
          <button type="button" className="neo-menu-trigger" onClick={() => setMenuOpen(value => !value)} aria-expanded={menuOpen}>الأدوات</button>
          <button type="button" className="neo-logout-button" onClick={() => void logout()}>خروج</button>
        </div>
      </header>

      <div className="neo-teacher-body">
        {menuOpen && <button type="button" className="neo-teacher-backdrop" aria-label="إغلاق القائمة" onClick={() => setMenuOpen(false)} />}
        <aside className="teacher-sidebar neo-teacher-rail">
          <div className="neo-rail-profile"><span>{teacherName.trim().charAt(0) || "م"}</span><div><small>مرحبًا</small><strong>{teacherName}</strong></div><button type="button" onClick={() => setMenuOpen(false)} aria-label="إغلاق">×</button></div>

          {subjects.length > 1 ? <label className="neo-subject-picker"><span>تغيير المادة أو المرحلة</span><select value={workspaceKey} onChange={event => void changeSubject(event.target.value)} disabled={switchingSubject}>{subjects.map(item => <option key={item.workspaceKey} value={item.workspaceKey}>{item.subjectName}{item.gradeLabel ? ` — ${item.gradeLabel}` : ""}</option>)}</select></label> : <div className="neo-single-subject"><small>المساحة الحالية</small><strong>{subjectName}</strong><span>{activeGradeLabel}</span></div>}

          <nav className="teacher-tabs neo-teacher-nav" aria-label="أقسام بوابة المعلم">{tabs.map(tab => {
            const active = pathname.startsWith(tab.href);
            return <Link key={tab.href} href={tab.href} className={active ? "active" : ""} onClick={() => setMenuOpen(false)}>
              <span className="neo-nav-icon"><TabIcon type={tab.key}/></span>
              <span><b>{tab.label}</b><small>{tab.note}</small></span>
              {tab.badge ? <em>{tab.badge}</em> : null}
            </Link>;
          })}</nav>

          <div className="neo-rail-footer"><Link href="/">العودة للصفحة الرئيسية</Link><small>البيانات محفوظة لكل معلم ومادة</small></div>
        </aside>

        <main className="teacher-main neo-teacher-main">
          <header className="neo-page-context">
            <div><span>{activeTab?.key === "ai" ? "AI" : subjectConfig.shortMark}</span><div><small>{subjectName}{activeGradeLabel ? ` — ${activeGradeLabel}` : ""}</small><h1>{activeTab?.label}</h1><p>{activeTab?.note}</p></div></div>
            <button type="button" onClick={() => setMenuOpen(true)}>عرض جميع الأدوات</button>
          </header>
          <div className="teacher-page-content neo-teacher-content">{children}</div>
        </main>
      </div>
    </div>
  </TeacherClientContext.Provider>;
}
