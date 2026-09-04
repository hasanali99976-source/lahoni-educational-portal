"use client";

import Image from "next/image";
import Link from "next/link";
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
import "./teacher-academy-v10.css";

type TeacherTab = {
  href: string;
  key: string;
  label: string;
  note: string;
  group: "daily" | "learning" | "system";
  badge?: string;
};

const tabs: TeacherTab[] = [
  { href: "/teacher/students", key: "students", label: "إدارة الطلاب", note: "الفصول والقوائم", group: "daily" },
  { href: "/teacher/timetable", key: "timetable", label: "الجدول الدراسي", note: "الحصص والأسبوع", group: "daily" },
  { href: "/teacher/attendance", key: "attendance", label: "سجل المتابعة", note: "الحضور والانضباط", group: "daily" },
  { href: "/teacher/grades", key: "grades", label: "التحصيل العلمي", note: "الرصد والدرجات", group: "daily" },
  { href: "/teacher/follow-up", key: "follow", label: "الإتقان والمهارة", note: "المهارات والتدخل", group: "learning" },
  { href: "/teacher/notes", key: "notes", label: "الملاحظات", note: "رسائل تربوية", group: "learning" },
  { href: "/teacher/diagnostics", key: "diagnostics", label: "الاختبارات التشخيصية", note: "القياس والتشخيص", group: "learning" },
  { href: "/teacher/report", key: "report", label: "ملخص عمل المعلم", note: "التحليل والتقارير", group: "learning" },
  { href: "/teacher/portfolio", key: "portfolio", label: "ملف الإنجاز", note: "الشواهد والإنجاز", group: "learning" },
  { href: "/teacher/ai", key: "ai", label: "المساعد الذكي", note: "تحليل واقتراحات", group: "learning", badge: "AI" },
  { href: "/teacher/grade-plan", key: "gradeplan", label: "الخطة الدراسية", note: "هيكلة الدرجات", group: "system" },
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

function NavIcon({ type }: { type: string }) {
  const common = { width: 19, height: 19, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.85, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (type === "dashboard") return <svg {...common}><path d="M4 13h6V4H4zM14 20h6V11h-6zM4 20h6v-3H4zM14 7h6V4h-6z"/></svg>;
  if (type === "students") return <svg {...common}><circle cx="9" cy="8" r="3"/><path d="M3.5 19v-1.3A4.7 4.7 0 0 1 8.2 13h1.6a4.7 4.7 0 0 1 4.7 4.7V19M16 6.5a2.7 2.7 0 0 1 0 5.1M17 14a4 4 0 0 1 3.5 4"/></svg>;
  if (type === "timetable") return <svg {...common}><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M8 3v4M16 3v4M3.5 9.5h17M8 13h2M14 13h2M8 17h2M14 17h2"/></svg>;
  if (type === "attendance") return <svg {...common}><path d="M5 4h14v16H5zM8 8h8M8 12h5"/><path d="m14 16 1.5 1.5L19 14"/></svg>;
  if (type === "grades") return <svg {...common}><path d="M4 19.5h16M6.5 16V9.5M11.8 16V5M17.1 16v-3.8"/><path d="m5.8 6.8 3-2.3 3 1.8 5.4-3"/></svg>;
  if (type === "follow") return <svg {...common}><path d="M12 3.5 20 7v5.5c0 4.8-3.3 7.6-8 8.8-4.7-1.2-8-4-8-8.8V7z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg>;
  if (type === "notes") return <svg {...common}><path d="M5 4h14v13H9l-4 3z"/><path d="M8 8h8M8 12h6"/></svg>;
  if (type === "diagnostics") return <svg {...common}><path d="M9 3h6l1 2h3v16H5V5h3z"/><path d="m8 11 2 2 4-4M8 17h8"/></svg>;
  if (type === "report") return <svg {...common}><path d="M5 3.5h14v17H5z"/><path d="M8 16v-3M12 16V9M16 16v-6"/></svg>;
  if (type === "portfolio") return <svg {...common}><path d="M8 4h8l1 3h3v13H4V7h3zM9 11h6M9 15h6"/></svg>;
  if (type === "ai") return <svg {...common}><circle cx="12" cy="12" r="4"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/></svg>;
  if (type === "gradeplan") return <svg {...common}><rect x="4" y="3.5" width="16" height="17" rx="2"/><path d="M8 8h8M8 12h5M8 16h3"/></svg>;
  return <svg {...common}><path d="M5 5h14v14H5z"/></svg>;
}

function pageContext(pathname: string) {
  if (pathname.startsWith("/teacher/attendance")) return { title: "سجل المتابعة", note: "أسرع مسار: اختر الفصل ثم عدّل الحالات فقط عند الحاجة.", ai: "أراقب تكرار الغياب والتأخر وأساعدك على اكتشاف من يحتاج متابعة.", href: "/teacher/follow-up", action: "عرض حالات المتابعة" };
  if (pathname.startsWith("/teacher/grades")) return { title: "التحصيل العلمي", note: "رصد أكاديمي واضح مع قراءة مستوى الفصل.", ai: "أقارن الرصد وأبرز الطلاب المتراجعين أو العناصر غير المكتملة بدل البحث اليدوي.", href: "/teacher/report", action: "فتح التحليل" };
  if (pathname.startsWith("/teacher/follow-up")) return { title: "الإتقان والمهارة", note: "من الرصد إلى قرار تعليمي وتدخل مناسب.", ai: "أحوّل مؤشرات الأداء إلى مهارات تحتاج دعمًا، وأقترح الخطوة التالية للمعلم.", href: "/teacher/ai", action: "تحليل أعمق" };
  if (pathname.startsWith("/teacher/notes")) return { title: "الملاحظات", note: "ملاحظة تربوية سريعة وواضحة للطالب وولي الأمر.", ai: "أساعدك في صياغة الملاحظة بحسب الحالة، مع إبقاء القرار والحفظ بيدك.", href: "/teacher/ai", action: "مساعدة في الصياغة" };
  if (pathname.startsWith("/teacher/timetable")) return { title: "الجدول الدراسي", note: "أسبوعك في نظرة واحدة؛ التعديل عند الطلب فقط.", ai: "أقرأ ضغط الحصص وتوزيع الفصول وأقترح تنظيمًا أبسط عند الحاجة.", href: "/teacher/ai", action: "اسأل المساعد" };
  if (pathname.startsWith("/teacher/students")) return { title: "إدارة الطلاب", note: "الفصل أولًا، ثم الطلاب والأدوات التابعة له.", ai: "أجعل الفصل نقطة البداية حتى لا تتنقل بين قوائم وفلاتر كثيرة.", href: "/teacher/report", action: "تحليل الفصول" };
  if (pathname.startsWith("/teacher/diagnostics")) return { title: "الاختبارات التشخيصية", note: "قياس المهارة ثم بناء خطة علاجية أو إثرائية.", ai: "أساعد في تحويل النتيجة إلى مهارة مستهدفة وخطة مناسبة، لا إلى رقم فقط.", href: "/teacher/ai", action: "تحليل النتائج" };
  if (pathname.startsWith("/teacher/report")) return { title: "ملخص عمل المعلم", note: "فصول أو طلاب، ثم مقارنة ورسوم قابلة للتقرير.", ai: "أجمع الحضور والتحصيل والإتقان والملاحظات في قراءة واحدة تساعدك على اتخاذ قرار.", href: "/teacher/ai", action: "تفسير المؤشرات" };
  if (pathname.startsWith("/teacher/grade-plan")) return { title: "الخطة الدراسية", note: "الخطة للعرض أولًا، والتعديل بإذن منك فقط.", ai: "يمكنني اقتراح هيكلة درجات كنقطة بداية، لكن لا أعتمد أي تغيير دون مراجعتك.", href: "/teacher/ai", action: "اقتراح خطة" };
  return { title: "مركز عمل المعلم", note: "ما يحتاج انتباهك اليوم قبل أي شيء آخر.", ai: "أربط يومك بالفصول والتحصيل والمتابعة حتى تعرف الخطوة التالية بدل البحث داخل البوابة.", href: "/teacher/ai", action: "افتح المساعد" };
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
  const [switchingLabel, setSwitchingLabel] = useState("");
  const [todayLabel, setTodayLabel] = useState("");
  const subjectConfig = getSubjectConfig(subjectKey);
  const context = useMemo(() => pageContext(pathname), [pathname]);

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
    setTodayLabel(new Intl.DateTimeFormat("ar-SA", { timeZone: "Asia/Riyadh", weekday: "long", day: "numeric", month: "long" }).format(new Date()));
  }, []);

  useEffect(() => {
    if (isLoginPage) { setReady(false); clearSessionState(); return; }
    setReady(false);
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
      .catch(() => { if (active) window.location.replace("/teacher"); });
    return () => { active = false; };
  }, [isLoginPage]);

  async function changeSubject(nextWorkspaceKey: string) {
    if (nextWorkspaceKey === workspaceKey || switchingSubject) return;
    const selected = subjects.find(subject => subject.workspaceKey === nextWorkspaceKey);
    try {
      setSwitchingSubject(true);
      setSwitchingLabel(selected?.subjectName || "المادة");
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
      window.setTimeout(() => window.location.assign("/teacher/dashboard"), 260);
    } finally {
      window.setTimeout(() => { setSwitchingSubject(false); setSwitchingLabel(""); }, 420);
    }
  }

  if (isLoginPage) return <>{children}</>;
  if (!ready) return <main className="teacher-v10-loading">جارٍ تجهيز مساحة المعلم…</main>;

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

  const renderGroup = (group: TeacherTab["group"], title: string) => <section className="teacher-v10-nav-group">
    <small>{title}</small>
    <nav>{tabs.filter(tab => tab.group === group).map(tab => {
      const active = pathname.startsWith(tab.href);
      const badge = tab.key === "gradeplan" && hasGradePlan ? "معتمدة" : tab.badge;
      return <Link key={tab.href} href={tab.href} className={active ? "active" : ""}>
        <span className="icon"><NavIcon type={tab.key}/></span>
        <span className="copy"><b>{tab.label}</b><em>{tab.note}</em></span>
        {badge ? <i>{badge}</i> : null}
      </Link>;
    })}</nav>
  </section>;

  return <TeacherClientContext.Provider key={teacherId} value={contextValue}>
    <div className={`teacher-v10-shell ${subjectConfig.themeClass} ${menuOpen ? "menu-open" : ""}`} dir="rtl" data-subject={subjectKey}>
      <header className="teacher-v10-header">
        <div className="teacher-v10-brand">
          <Image src="/icons/lahooni-identity-320.jpg" alt="بوابة أستاذ لحوني التعليمية" width={52} height={52} priority />
          <div><small>بوابة أستاذ لحوني التعليمية</small><strong>مساحة المعلم الأكاديمية</strong></div>
        </div>

        <section className="teacher-v10-profile" aria-label="معلومات المعلم والمواد">
          <div className="teacher-v10-profile-copy"><small>المعلم</small><b>{teacherName}</b><span>{activeGradeLabel || "المرحلة الثانوية"}</span></div>
          <div className="teacher-v10-subjects">
            <small>المواد المسندة</small>
            <div>{(subjects.length ? subjects : [{ workspaceKey, subjectId: subjectKey, subjectName, grade: activeGrade || undefined, gradeLabel: activeGradeLabel } as TeacherClientSubject]).map(subject => {
              const active = subject.workspaceKey === workspaceKey;
              return <button type="button" key={subject.workspaceKey} className={active ? "active" : ""} disabled={switchingSubject} onClick={() => void changeSubject(subject.workspaceKey)}>
                <span className="subject-dot" data-subject={subject.subjectId}/><b>{subject.subjectName}</b><em>{subject.gradeLabel || ""}</em>
              </button>;
            })}</div>
          </div>
        </section>

        <div className="teacher-v10-status"><span><i/> متصل</span><small>{todayLabel}</small></div>
        <button className="teacher-v10-menu" type="button" onClick={() => setMenuOpen(true)} aria-label="فتح القائمة">☰</button>
      </header>

      <aside className="teacher-v10-sidebar">
        <Link href="/teacher/dashboard" className={`teacher-v10-home ${pathname.startsWith("/teacher/dashboard") ? "active" : ""}`}><NavIcon type="dashboard"/><span><b>مركز اليوم</b><small>ابدأ من هنا</small></span></Link>
        <div className="teacher-v10-nav-scroll">
          {renderGroup("daily", "عملي اليومي")}
          {renderGroup("learning", "التعليم والمتابعة")}
          {renderGroup("system", "الإعداد")}
        </div>
        <div className="teacher-v10-race"><TeacherCompetitionProgress compact/></div>
        <footer><Link href="/">الرئيسية</Link><button type="button" onClick={() => void logout()}>تسجيل الخروج</button></footer>
      </aside>

      <button type="button" className="teacher-v10-backdrop" aria-label="إغلاق القائمة" onClick={() => setMenuOpen(false)}/>

      <main className="teacher-v10-main">
        <section className="teacher-v10-pagehead">
          <div className="teacher-v10-page-title"><small>{subjectName}{activeGradeLabel ? ` • ${activeGradeLabel}` : ""}</small><h1>{context.title}</h1><p>{context.note}</p></div>
          <div className="teacher-v10-ai-context"><span>AI</span><div><small>مساعدك داخل هذه الصفحة</small><p>{context.ai}</p></div><Link href={context.href}>{context.action}</Link></div>
        </section>
        <div className="teacher-v10-content">{children}</div>
      </main>

      {switchingLabel ? <div className="teacher-v10-switching"><div><small>تغيير المساحة التعليمية</small><strong>{switchingLabel}</strong><span>جارٍ فتح المادة…</span></div></div> : null}
    </div>
  </TeacherClientContext.Provider>;
}
