"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { getSubjectConfig, type SubjectKey } from "../../lib/subject-config";
import { readLocalGradePlan, setGradePlanCurrentTeacher } from "../../lib/grade-plan-local";
import {
  TeacherClientContext,
  type TeacherClientAssignment,
  type TeacherClientSubject,
} from "../../lib/teacher-client";
import TeacherCompetitionProgress from "./competition-progress";
import "./print-theme.css";
import "./teacher-v3.css";
import "./teacher-navigation-v4.css";
import "./subject-themes-v5.css";
import "./mobile-card-tables.css";
import "./teacher-mobile-ux-v6.css";
import "./teacher-daily-v70.css";
import "./teacher-professional-v71.css";
import "./attendance-professional-v71.css";
import "./teacher-academy-v8.css";

type TeacherTab = {
  href: string;
  key: string;
  label: string;
  note: string;
  badge?: string;
};

const academyTabs: TeacherTab[] = [
  { href: "/teacher/students", key: "students", label: "إدارة الطلاب", note: "الفصول والقوائم وبيانات الدخول" },
  { href: "/teacher/timetable", key: "timetable", label: "الجدول الدراسي", note: "حصص الأسبوع وتنظيم اليوم" },
  { href: "/teacher/grade-plan", key: "gradeplan", label: "الخطة الدراسية", note: "اعتماد هيكلة الدرجات" },
  { href: "/teacher/attendance", key: "attendance", label: "سجل المتابعة", note: "الحضور والتأخر والانضباط" },
  { href: "/teacher/grades", key: "grades", label: "التحصيل العلمي", note: "الرصد وقراءة مستوى الطالب" },
  { href: "/teacher/follow-up", key: "follow", label: "الإتقان والمهارة", note: "المهارات والخطط العلاجية" },
  { href: "/teacher/notes", key: "notes", label: "الملاحظات", note: "ملاحظات الطالب وولي الأمر" },
  { href: "/teacher/diagnostics", key: "diagnostics", label: "الاختبارات التشخيصية", note: "النتائج والمهارات المستهدفة" },
  { href: "/teacher/report", key: "report", label: "ملخص عمل المعلم", note: "تقارير صف أو عدة فصول" },
  { href: "/teacher/portfolio", key: "portfolio", label: "ملف الإنجاز", note: "الشواهد والطباعة" },
  { href: "/teacher/ai", key: "ai", label: "المساعد الذكي", note: "تحليل واقتراحات مساندة", badge: "AI" },
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
  if (type === "gradeplan") return <svg {...common}><circle cx="12" cy="12" r="8.5"/><path d="M8 8h8M8 12h5M8 16h3"/><path d="m15.5 15 1.5 1.5 3-3"/></svg>;
  if (type === "attendance") return <svg {...common}><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.2 2"/></svg>;
  if (type === "timetable") return <svg {...common}><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M8 3v4M16 3v4M3.5 9.5h17M8 13h2M14 13h2M8 17h2M14 17h2"/></svg>;
  if (type === "diagnostics") return <svg {...common}><path d="M9 3h6l1 2h3v16H5V5h3z"/><path d="m8 11 2 2 4-4M8 17h8"/></svg>;
  if (type === "portfolio") return <svg {...common}><path d="M8 4h8l1 3h3v13H4V7h3zM9 11h6M9 15h6"/></svg>;
  if (type === "follow") return <svg {...common}><path d="M12 3.5 20 7v5.5c0 4.8-3.3 7.6-8 8.8-4.7-1.2-8-4-8-8.8V7z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg>;
  if (type === "notes") return <svg {...common}><path d="M5 4h14v13H9l-4 3z"/><path d="M8 8h8M8 12h6"/></svg>;
  if (type === "report") return <svg {...common}><path d="M5 3.5h14v17H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>;
  if (type === "ai") return <svg {...common}><circle cx="12" cy="12" r="4"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/></svg>;
  return <svg {...common}><path d="M16 20v-1.8a4.2 4.2 0 0 0-4.2-4.2H7.2A4.2 4.2 0 0 0 3 18.2V20"/><circle cx="9.5" cy="7" r="3.5"/><path d="M17 10.5a3.3 3.3 0 0 0 0-6.4M20.5 20v-1.8a4.2 4.2 0 0 0-3.1-4"/></svg>;
}

export default function TeacherLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/teacher";
  const [ready, setReady] = useState(false);
  const [hasGradePlan, setHasGradePlan] = useState<boolean | null>(null);
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
  const [todayLabel, setTodayLabel] = useState("");
  const subjectConfig = getSubjectConfig(subjectKey);

  function applySession(session: TeacherSession) {
    const nextSubjectKey = session.subjectKey || "history";
    if (session.teacherId) setGradePlanCurrentTeacher(session.teacherId);
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
    setHasGradePlan(null);
    setMenuOpen(false);
  }

  async function logout() {
    setReady(false);
    clearSessionState();
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
    setTodayLabel(new Intl.DateTimeFormat("ar-SA", {
      timeZone: "Asia/Riyadh",
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date()));
  }, []);

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
      .then(async (session: TeacherSession) => {
        if (!active) return;
        if (!session.teacherId) throw new Error("missing_teacher_identity");
        applySession(session);
        const planResponse = await fetch("/api/teacher/grade-plan", { cache: "no-store", credentials: "same-origin" });
        const planData = planResponse.ok ? await planResponse.json().catch(() => ({})) : {};
        if (!active) return;
        setHasGradePlan(Boolean(planData?.activePlan || planData?.hasActivePlan || readLocalGradePlan(session.teacherId)));
        setReady(true);
      })
      .catch(() => {
        if (!active) return;
        clearSessionState();
        window.location.replace("/teacher");
      });
    return () => { active = false; };
  }, [isLoginPage]);

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
    } finally {
      setSwitchingSubject(false);
    }
  }

  if (isLoginPage) return <>{children}</>;
  if (!ready) return <main className="teacher-shell-loading">جارٍ تجهيز أكاديمية المعلم…</main>;

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
    <div className={`teacher-academy-shell ${subjectConfig.themeClass} ${menuOpen ? "menu-open" : ""}`} dir="rtl" data-subject={subjectKey}>
      <aside className="teacher-academy-sidebar" aria-label="تنقل أكاديمية المعلم">
        <div className="teacher-academy-brand">
          <Image src="/icons/ostadh-lahooni-192.jpg" alt="بوابة أستاذ لحوني التعليمية" width={46} height={46} priority/>
          <div><strong>أكاديمية المعلم</strong><small>{teacherName}</small></div>
        </div>

        <section className="teacher-subject-card">
          <div className="teacher-subject-card-head"><span className="teacher-subject-mark">{subjectConfig.shortMark}</span><div className="teacher-subject-card-copy"><small>مساحتك التعليمية</small><strong>{subjectName}{activeGradeLabel ? ` — ${activeGradeLabel}` : ""}</strong></div></div>
          {subjects.length > 1 ? <select aria-label="تغيير المادة أو المرحلة" value={workspaceKey} onChange={event => void changeSubject(event.target.value)} disabled={switchingSubject}>{subjects.map(subject => <option key={subject.workspaceKey} value={subject.workspaceKey}>{subject.subjectName}{subject.gradeLabel ? ` — ${subject.gradeLabel}` : ""}</option>)}</select> : null}
        </section>

        <Link href="/teacher/dashboard" className={`teacher-academy-home-link ${pathname.startsWith("/teacher/dashboard") ? "active" : ""}`}><TabIcon type="dashboard"/><span>الرئيسية الأكاديمية</span></Link>
        <div className="teacher-academy-nav-title"><span>مسار عمل المعلم</span><span>بسيط وواضح</span></div>
        <nav className="teacher-academy-nav">
          {academyTabs.map(tab => {
            const active = pathname.startsWith(tab.href.split("?")[0]);
            const badge = tab.key === "gradeplan" && hasGradePlan ? "معتمدة" : tab.badge;
            return <Link key={tab.href} href={tab.href} className={active ? "active" : ""}>
              <span className="teacher-academy-nav-icon"><TabIcon type={tab.key}/></span>
              <span className="teacher-academy-nav-copy"><b>{tab.label}</b><small>{tab.note}</small></span>
              {badge ? <span className="teacher-academy-badge">{badge}</span> : null}
            </Link>;
          })}
        </nav>

        <div className="teacher-academy-competition"><TeacherCompetitionProgress compact/></div>
        <div className="teacher-academy-footer"><Link href="/">الرئيسية</Link><button type="button" onClick={() => void logout()}>تسجيل الخروج</button></div>
      </aside>

      <button className="teacher-academy-mobile-backdrop" type="button" aria-label="إغلاق القائمة" onClick={() => setMenuOpen(false)}/>

      <main className="teacher-academy-main">
        <header className="teacher-academy-top">
          <div className="teacher-academy-context"><span className="teacher-academy-context-dot"/><div><small>الحفظ السحابي متصل</small><strong>{teacherName} • {subjectName}{activeGradeLabel ? ` • ${activeGradeLabel}` : ""}</strong></div></div>
          <span className="teacher-academy-date">{todayLabel}</span>
          <button className="teacher-academy-menu-button" type="button" onClick={() => setMenuOpen(true)} aria-label="فتح القائمة">☰</button>
        </header>
        <div className="teacher-academy-content">{children}</div>
      </main>
    </div>
  </TeacherClientContext.Provider>;
}
