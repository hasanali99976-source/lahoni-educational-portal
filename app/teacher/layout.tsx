"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useMemo, useState } from "react";
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
import "./teacher-academy-v9.css";

type TeacherTab = {
  href: string;
  key: string;
  label: string;
  note: string;
  group: "daily" | "growth" | "system";
  badge?: string;
};

const academyTabs: TeacherTab[] = [
  { href: "/teacher/students", key: "students", label: "إدارة الطلاب", note: "فصولك وقوائم طلابك", group: "daily" },
  { href: "/teacher/timetable", key: "timetable", label: "الجدول الدراسي", note: "أسبوعك وحصصك", group: "daily" },
  { href: "/teacher/attendance", key: "attendance", label: "سجل المتابعة", note: "حضور وانضباط ومتابعة", group: "daily" },
  { href: "/teacher/grades", key: "grades", label: "التحصيل العلمي", note: "رصد واضح وسريع", group: "daily" },
  { href: "/teacher/follow-up", key: "follow", label: "الإتقان والمهارة", note: "مهارات ودعم علاجي", group: "growth" },
  { href: "/teacher/notes", key: "notes", label: "الملاحظات", note: "رسائل تعليمية للطالب وولي الأمر", group: "growth" },
  { href: "/teacher/diagnostics", key: "diagnostics", label: "الاختبارات التشخيصية", note: "تشخيص وقياس المهارات", group: "growth" },
  { href: "/teacher/report", key: "report", label: "ملخص عمل المعلم", note: "تقارير ورسوم ومقارنات", group: "growth" },
  { href: "/teacher/portfolio", key: "portfolio", label: "ملف الإنجاز", note: "شواهد وإنجازات", group: "growth" },
  { href: "/teacher/ai", key: "ai", label: "المساعد الذكي", note: "اقتراحات مرتبطة بعملك", group: "growth", badge: "AI" },
  { href: "/teacher/grade-plan", key: "gradeplan", label: "الخطة الدراسية", note: "هيكلة الدرجات والإعداد", group: "system" },
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

type Identity = { icon: string; strap: string; motif: string; prompt: string };

function subjectIdentity(key: string, label: string): Identity {
  const base = key.split("--")[0];
  if (["history", "social-studies", "social-sciences", "citizenship"].includes(base)) return { icon: "🏛️", strap: "الأحداث • الحضارات • المصادر", motif: "1444  •  أثر  •  حضارة", prompt: `مساحة ${label} تربط الحدث بالسبب والنتيجة.` };
  if (base === "critical-thinking") return { icon: "💡", strap: "تحليل • استدلال • قرار", motif: "دليل  →  تحليل  →  حكم", prompt: "مساحة تفكير تساعدك على تتبع المهارة وصناعة قرار تعليمي أوضح." };
  if (["geography", "earth-science"].includes(base)) return { icon: "🌍", strap: "مكان • خريطة • علاقة", motif: "موقع  •  اتجاه  •  بيئة", prompt: `مساحة ${label} تربط المكان بالإنسان والظاهرة.` };
  if (["mathematics", "financial-literacy"].includes(base)) return { icon: "📐", strap: "مسألة • برهان • تطبيق", motif: "x  +  y  =  فهم", prompt: `مساحة ${label} للقياس والتطبيق ومتابعة خطوات الحل.` };
  if (["science", "physics", "chemistry", "biology", "environmental-science"].includes(base)) return { icon: "🔬", strap: "ملاحظة • تجربة • تفسير", motif: "تجربة  •  فرضية  •  نتيجة", prompt: `مساحة ${label} تجعل الرصد مرتبطًا بالاستكشاف والمهارة.` };
  if (["arabic", "linguistic-competencies"].includes(base)) return { icon: "✒️", strap: "قراءة • لغة • تعبير", motif: "فكرة  •  معنى  •  أسلوب", prompt: `مساحة ${label} تبرز الفهم والتعبير والمهارات اللغوية.` };
  if (base === "english") return { icon: "🌐", strap: "Read • Write • Communicate", motif: "learn  •  practise  •  speak", prompt: "A clear learning space for skills, progress, and communication." };
  if (["digital-technology", "computer-science"].includes(base)) return { icon: "💻", strap: "تقنية • منطق • بناء", motif: "code  •  data  •  create", prompt: `مساحة ${label} تربط المعرفة بالتطبيق الرقمي.` };
  if (["islamic-studies", "quran", "quran-tafsir", "tafsir", "hadith", "fiqh", "tawhid"].includes(base)) return { icon: "📖", strap: "علم • فهم • قيمة", motif: "علم  •  تدبر  •  أثر", prompt: `مساحة ${label} تربط المعرفة بالقيمة والتطبيق.` };
  if (["physical-education", "fitness-health", "health-education"].includes(base)) return { icon: "🏃", strap: "أداء • لياقة • صحة", motif: "نشاط  •  صحة  •  إنجاز", prompt: `مساحة ${label} لمتابعة الأداء والانضباط والنمو.` };
  if (["art", "arts"].includes(base)) return { icon: "🎨", strap: "فكرة • مهارة • إبداع", motif: "لون  •  شكل  •  تعبير", prompt: `مساحة ${label} تبرز المهارة والإبداع والمشروع.` };
  return { icon: "📚", strap: "تعلم • متابعة • تقدم", motif: "تعلم  •  ممارسة  •  إتقان", prompt: `مساحة ${label} تجمع عملك التعليمي في مسار واضح.` };
}

function TabIcon({ type }: { type: string }) {
  const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (type === "dashboard") return <svg {...common}><path d="M4 13h6V4H4zM14 20h6V11h-6zM4 20h6v-3H4zM14 7h6V4h-6z"/></svg>;
  if (type === "students") return <svg {...common}><circle cx="9" cy="8" r="3"/><path d="M3.5 19v-1.3A4.7 4.7 0 0 1 8.2 13h1.6a4.7 4.7 0 0 1 4.7 4.7V19M16 6.5a2.7 2.7 0 0 1 0 5.1M17 14a4 4 0 0 1 3.5 4"/></svg>;
  if (type === "grades") return <svg {...common}><path d="M4 19.5h16M6.5 16V9.5M11.8 16V5M17.1 16v-3.8"/><path d="m5.8 6.8 3-2.3 3 1.8 5.4-3"/></svg>;
  if (type === "gradeplan") return <svg {...common}><rect x="4" y="3.5" width="16" height="17" rx="2"/><path d="M8 8h8M8 12h5M8 16h3"/><path d="m15.5 15 1.5 1.5 3-3"/></svg>;
  if (type === "attendance") return <svg {...common}><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.2 2"/></svg>;
  if (type === "timetable") return <svg {...common}><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M8 3v4M16 3v4M3.5 9.5h17M8 13h2M14 13h2M8 17h2M14 17h2"/></svg>;
  if (type === "diagnostics") return <svg {...common}><path d="M9 3h6l1 2h3v16H5V5h3z"/><path d="m8 11 2 2 4-4M8 17h8"/></svg>;
  if (type === "portfolio") return <svg {...common}><path d="M8 4h8l1 3h3v13H4V7h3zM9 11h6M9 15h6"/></svg>;
  if (type === "follow") return <svg {...common}><path d="M12 3.5 20 7v5.5c0 4.8-3.3 7.6-8 8.8-4.7-1.2-8-4-8-8.8V7z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg>;
  if (type === "notes") return <svg {...common}><path d="M5 4h14v13H9l-4 3z"/><path d="M8 8h8M8 12h6"/></svg>;
  if (type === "report") return <svg {...common}><path d="M5 3.5h14v17H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>;
  if (type === "ai") return <svg {...common}><circle cx="12" cy="12" r="4"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/></svg>;
  return <svg {...common}><path d="M5 5h14v14H5zM8 9h8M8 13h5"/></svg>;
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
  const [turningSubject, setTurningSubject] = useState("");
  const [todayLabel, setTodayLabel] = useState("");
  const subjectConfig = getSubjectConfig(subjectKey);
  const identity = subjectIdentity(subjectKey, subjectName);

  const currentTab = useMemo(() => {
    if (pathname.startsWith("/teacher/dashboard")) return { label: "مركز اليوم", note: "أهم ما يحتاجه المعلم الآن" };
    const tab = academyTabs.find(item => pathname.startsWith(item.href));
    return tab || { label: "أكاديمية المعلم", note: "مساحة العمل التعليمية" };
  }, [pathname]);

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
    setTurningSubject("");
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
        if (!active || !session.teacherId) throw new Error("missing_teacher_identity");
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
    const selected = subjects.find(subject => subject.workspaceKey === nextWorkspaceKey);
    try {
      setSwitchingSubject(true);
      setTurningSubject(selected?.subjectName || "المادة");
      await new Promise(resolve => window.setTimeout(resolve, 380));
      const response = await fetch("/api/teacher-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceKey: nextWorkspaceKey }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error();
      if (selected) {
        setWorkspaceKey(selected.workspaceKey);
        setSubjectKey(selected.subjectId as SubjectKey);
        setSubjectName(selected.subjectName || getSubjectConfig(selected.subjectId).label);
        setActiveGrade(selected.grade || null);
        setActiveGradeLabel(selected.gradeLabel || "");
      }
      setMenuOpen(false);
      await new Promise(resolve => window.setTimeout(resolve, 180));
      window.location.assign("/teacher/dashboard");
    } finally {
      setSwitchingSubject(false);
      setTurningSubject("");
    }
  }

  if (isLoginPage) return <>{children}</>;
  if (!ready) return <main className="teacher-shell-loading">جارٍ تجهيز مساحة المعلم التعليمية…</main>;

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

  const renderGroup = (group: TeacherTab["group"], title: string) => {
    const rows = academyTabs.filter(tab => tab.group === group);
    return <section className="teacher-v9-nav-group">
      <div className="teacher-v9-nav-title">{title}</div>
      <nav>{rows.map(tab => {
        const active = pathname.startsWith(tab.href);
        const badge = tab.key === "gradeplan" && hasGradePlan ? "معتمدة" : tab.badge;
        return <Link key={tab.href} href={tab.href} className={active ? "active" : ""}>
          <span className="teacher-v9-nav-icon"><TabIcon type={tab.key}/></span>
          <span className="teacher-v9-nav-copy"><b>{tab.label}</b><small>{tab.note}</small></span>
          {badge ? <span className="teacher-v9-nav-badge">{badge}</span> : null}
        </Link>;
      })}</nav>
    </section>;
  };

  return <TeacherClientContext.Provider key={teacherId} value={contextValue}>
    <div className={`teacher-v9-shell ${subjectConfig.themeClass} ${menuOpen ? "menu-open" : ""}`} dir="rtl" data-subject={subjectKey}>
      <aside className="teacher-v9-sidebar" aria-label="تنقل بوابة المعلم">
        <div className="teacher-v9-brand">
          <Image src="/icons/lahooni-identity-320.jpg" alt="هوية بوابة أستاذ لحوني التعليمية" width={52} height={52} priority/>
          <div><small>بوابة أستاذ لحوني التعليمية</small><strong>مساحة المعلم</strong><span>{teacherName}</span></div>
        </div>

        <div className="teacher-v9-subject-book" data-subject={subjectKey}>
          <div className="teacher-v9-book-cover">
            <span className="teacher-v9-book-icon">{identity.icon}</span>
            <div><small>المادة الحالية</small><strong>{subjectName}</strong><span>{activeGradeLabel || "المساحة التعليمية"}</span></div>
          </div>
          <p>{identity.strap}</p>
          {subjects.length > 1 ? <div className="teacher-v9-book-tabs" aria-label="التنقل بين المواد">
            {subjects.map(subject => {
              const active = subject.workspaceKey === workspaceKey;
              const meta = subjectIdentity(subject.subjectId, subject.subjectName);
              return <button type="button" key={subject.workspaceKey} className={active ? "active" : ""} disabled={switchingSubject} onClick={() => void changeSubject(subject.workspaceKey)}>
                <span>{meta.icon}</span><b>{subject.subjectName}</b><small>{subject.gradeLabel || ""}</small>
              </button>;
            })}
          </div> : null}
        </div>

        <Link href="/teacher/dashboard" className={`teacher-v9-home ${pathname.startsWith("/teacher/dashboard") ? "active" : ""}`}><TabIcon type="dashboard"/><span><b>مركز اليوم</b><small>ابدأ من هنا</small></span></Link>
        <div className="teacher-v9-scrollnav">
          {renderGroup("daily", "عملي اليومي")}
          {renderGroup("growth", "التعليم والمتابعة")}
          {renderGroup("system", "الإعداد")}
        </div>

        <div className="teacher-v9-race"><TeacherCompetitionProgress compact/></div>
        <div className="teacher-v9-footer"><Link href="/">الرئيسية</Link><button type="button" onClick={() => void logout()}>تسجيل الخروج</button></div>
      </aside>

      <button className="teacher-v9-backdrop" type="button" aria-label="إغلاق القائمة" onClick={() => setMenuOpen(false)}/>

      <main className="teacher-v9-main">
        <header className="teacher-v9-topbar">
          <button className="teacher-v9-menu" type="button" onClick={() => setMenuOpen(true)} aria-label="فتح قائمة المعلم">☰</button>
          <div className="teacher-v9-page-title"><small>{currentTab.note}</small><strong>{currentTab.label}</strong></div>
          <div className="teacher-v9-current-subject"><span>{identity.icon}</span><div><b>{subjectName}</b><small>{activeGradeLabel || ""}</small></div></div>
          <div className="teacher-v9-cloud"><i/><span><b>محفوظ سحابيًا</b><small>{todayLabel}</small></span></div>
        </header>
        <section className="teacher-v9-subject-ribbon"><span>{identity.motif}</span><p>{identity.prompt}</p></section>
        <div className="teacher-v9-content">{children}</div>
      </main>

      {turningSubject ? <div className="teacher-v9-page-turn" aria-live="polite"><div className="sheet front"><span>{identity.icon}</span><b>نقلب إلى</b><strong>{turningSubject}</strong></div><div className="sheet back"/></div> : null}
    </div>
  </TeacherClientContext.Provider>;
}
