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
import "./teacher-academy-v11.css";

type TeacherTab = {
  href: string;
  key: string;
  label: string;
  note: string;
  group: "daily" | "learning" | "insight" | "setup";
  badge?: string;
};

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

const tabs: TeacherTab[] = [
  { href: "/teacher/students", key: "students", label: "إدارة الطلاب", note: "فصولك وقوائمك", group: "daily" },
  { href: "/teacher/timetable", key: "timetable", label: "الجدول الدراسي", note: "أسبوعك وحصصك", group: "daily" },
  { href: "/teacher/attendance", key: "attendance", label: "سجل المتابعة", note: "الحضور والانضباط", group: "daily" },
  { href: "/teacher/grades", key: "grades", label: "التحصيل العلمي", note: "الرصد والدرجات", group: "daily" },
  { href: "/teacher/follow-up", key: "follow", label: "الإتقان والمهارة", note: "المهارات والتدخل", group: "learning" },
  { href: "/teacher/notes", key: "notes", label: "الملاحظات", note: "ملاحظات تربوية", group: "learning" },
  { href: "/teacher/diagnostics", key: "diagnostics", label: "الاختبارات التشخيصية", note: "قياس وتشخيص", group: "learning" },
  { href: "/teacher/report", key: "report", label: "ملخص عمل المعلم", note: "مؤشرات ومقارنات", group: "insight" },
  { href: "/teacher/reports", key: "reports", label: "مركز التقارير", note: "PDF وExcel بذكاء", group: "insight", badge: "جديد" },
  { href: "/teacher/portfolio", key: "portfolio", label: "ملف الإنجاز", note: "الشواهد والأعمال", group: "insight" },
  { href: "/teacher/ai", key: "ai", label: "المساعد الذكي", note: "تحليل واقتراح", group: "insight", badge: "AI" },
  { href: "/teacher/grade-plan", key: "gradeplan", label: "الخطة الدراسية", note: "هيكلة الدرجات", group: "setup" },
];

function NavIcon({ type }: { type: string }) {
  const common = { width: 21, height: 21, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (type === "dashboard") return <svg {...common}><path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z"/></svg>;
  if (type === "students") return <svg {...common}><circle cx="8.5" cy="8" r="3"/><path d="M3.5 19v-1.2A4.8 4.8 0 0 1 8.3 13h.4a4.8 4.8 0 0 1 4.8 4.8V19M16 7a2.5 2.5 0 1 1 0 5M16.5 14.5c2.6.4 4 2 4 4.5"/></svg>;
  if (type === "timetable") return <svg {...common}><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M8 3v4M16 3v4M3.5 9.5h17M8 13h2M14 13h2M8 17h2M14 17h2"/></svg>;
  if (type === "attendance") return <svg {...common}><path d="M5 4h14v16H5zM8 8h8M8 12h5"/><path d="m13.5 16 1.7 1.7 3.3-3.7"/></svg>;
  if (type === "grades") return <svg {...common}><path d="M4 20h16M6.5 16V10M12 16V5M17.5 16v-4"/><path d="m5 7 4-3 3 2 6-3"/></svg>;
  if (type === "follow") return <svg {...common}><path d="M12 3.5 20 7v5.5c0 4.8-3.3 7.6-8 8.8-4.7-1.2-8-4-8-8.8V7z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg>;
  if (type === "notes") return <svg {...common}><path d="M5 4h14v13H9l-4 3z"/><path d="M8 8h8M8 12h6"/></svg>;
  if (type === "diagnostics") return <svg {...common}><path d="M9 3h6l1 2h3v16H5V5h3z"/><path d="m8 11 2 2 4-4M8 17h8"/></svg>;
  if (type === "report") return <svg {...common}><path d="M5 3.5h14v17H5z"/><path d="M8 16v-3M12 16V9M16 16v-6"/></svg>;
  if (type === "reports") return <svg {...common}><path d="M7 3.5h10v4H7zM5 8h14v8H5zM8 16h8v4H8z"/><path d="M8 11h8"/></svg>;
  if (type === "portfolio") return <svg {...common}><path d="M8 4h8l1 3h3v13H4V7h3zM9 11h6M9 15h6"/></svg>;
  if (type === "ai") return <svg {...common}><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><circle cx="12" cy="12" r="4"/><path d="m6 6 2 2M16 16l2 2M18 6l-2 2M8 16l-2 2"/></svg>;
  if (type === "gradeplan") return <svg {...common}><rect x="4" y="3.5" width="16" height="17" rx="2"/><path d="M8 8h8M8 12h5M8 16h3"/></svg>;
  return <svg {...common}><path d="M5 5h14v14H5z"/></svg>;
}

function pageContext(pathname: string) {
  if (pathname.startsWith("/teacher/students")) return { eyebrow: "مساحة الفصول", title: "إدارة الطلاب", question: "أي فصل تريد أن تعمل عليه الآن؟", ai: "ابدأ من الفصل، وسأجمع لك قائمته وأدواته في مكان واحد بدل البحث بين القوائم.", href: "/teacher/report", action: "تحليل الفصول" };
  if (pathname.startsWith("/teacher/timetable")) return { eyebrow: "تنظيم الأسبوع", title: "الجدول الدراسي", question: "كيف يبدو أسبوعك التعليمي؟", ai: "أراقب ضغط الحصص وتوزيع الفصول، وأقترح تنظيمًا أبسط عندما تحتاجه فقط.", href: "/teacher/ai", action: "اسأل المساعد" };
  if (pathname.startsWith("/teacher/attendance")) return { eyebrow: "متابعة الفصل", title: "سجل المتابعة", question: "من يحتاج تعديل حالته اليوم؟", ai: "كل الطلاب يبدأون حاضر، وأنت تعدّل الاستثناء فقط. أراقب التكرار وأبرز الحالات التي تستحق متابعة.", href: "/teacher/follow-up", action: "الحالات المتكررة" };
  if (pathname.startsWith("/teacher/grades")) return { eyebrow: "الرصد الأكاديمي", title: "التحصيل العلمي", question: "أي وحدة أو فترة تريد رصدها؟", ai: "أقرأ اكتمال الرصد ومتوسط الفصل وأبرز النقص أو التراجع، بدون التدخل في درجاتك أو تغييرها.", href: "/teacher/report", action: "فتح التحليل" };
  if (pathname.startsWith("/teacher/follow-up")) return { eyebrow: "قرار تعليمي", title: "الإتقان والمهارة", question: "أين يحتاج الطالب تدخلًا؟", ai: "أحوّل الدرجة إلى مؤشر مهارة، وأساعدك على تحديد دعم أو إثراء مناسب مع بقاء القرار لك.", href: "/teacher/ai", action: "تحليل أعمق" };
  if (pathname.startsWith("/teacher/notes")) return { eyebrow: "تواصل تربوي", title: "الملاحظات", question: "ما الرسالة التي يحتاجها الطالب أو ولي الأمر؟", ai: "أقترح صياغة واضحة حسب الحالة، ثم تراجعها أنت قبل الحفظ والإرسال.", href: "/teacher/ai", action: "صياغة ذكية" };
  if (pathname.startsWith("/teacher/diagnostics")) return { eyebrow: "قياس وتشخيص", title: "الاختبارات التشخيصية", question: "ماذا تقول النتيجة عن المهارة؟", ai: "أربط نتيجة الاختبار بالمهارة المستهدفة والخطة العلاجية أو الإثرائية، ولا أغيّر أي اختبار محفوظ.", href: "/teacher/ai", action: "تحليل النتائج" };
  if (pathname.startsWith("/teacher/reports")) return { eyebrow: "مركز التقارير", title: "التقارير الذكية", question: "ما التقرير الذي تحتاجه ولمن؟", ai: "اختر نوع التقرير والفصول والوحدة أو الفترة، وسأجهز الوثيقة الأكاديمية بالمعلومات المناسبة فقط.", href: "/teacher/reports", action: "ابدأ التقرير" };
  if (pathname.startsWith("/teacher/report")) return { eyebrow: "قراءة الأداء", title: "ملخص عمل المعلم", question: "هل تريد مقارنة فصول أم قراءة طلاب؟", ai: "أجمع الحضور والتحصيل والإتقان والملاحظات في قراءة واحدة تساعدك على اتخاذ قرار.", href: "/teacher/ai", action: "تفسير المؤشرات" };
  if (pathname.startsWith("/teacher/portfolio")) return { eyebrow: "التوثيق المهني", title: "ملف الإنجاز", question: "ما الشاهد الذي تريد توثيقه؟", ai: "رتب الشواهد حسب النوع والفترة حتى يصبح ملف الإنجاز جاهزًا للعرض بدل مجرد مخزن ملفات.", href: "/teacher/portfolio", action: "فتح الإنجاز" };
  if (pathname.startsWith("/teacher/grade-plan")) return { eyebrow: "إعداد أكاديمي", title: "الخطة الدراسية", question: "هل تحتاج تعديل هيكلة الدرجات؟", ai: "الخطة للعرض أولًا. أقدّم مقترحًا فقط عندما تطلبه، ولا أعتمد أي تغيير دون موافقتك.", href: "/teacher/ai", action: "اقتراح خطة" };
  return { eyebrow: "أكاديمية المعلم", title: "مركز اليوم", question: "ما الشيء الأهم الذي يحتاج انتباهك الآن؟", ai: "أربط جدولك وفصولك والتحصيل والمتابعة لأقترح الخطوة التالية بدل أن تبحث داخل البوابة.", href: "/teacher/ai", action: "افتح المساعد" };
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
      window.setTimeout(() => window.location.assign("/teacher/dashboard"), 180);
    } finally {
      window.setTimeout(() => { setSwitchingSubject(false); setSwitchingLabel(""); }, 360);
    }
  }

  if (isLoginPage) return <>{children}</>;
  if (!ready) return <main className="teacher-academy-loading">جارٍ فتح أكاديمية المعلم…</main>;

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

  const availableSubjects = subjects.length
    ? subjects
    : [{ workspaceKey, subjectId: subjectKey, subjectName, grade: activeGrade || undefined, gradeLabel: activeGradeLabel } as TeacherClientSubject];

  const renderGroup = (group: TeacherTab["group"], title: string) => <section className="academy-nav-group">
    <small>{title}</small>
    <nav>{tabs.filter(tab => tab.group === group).map(tab => {
      const active = pathname.startsWith(tab.href);
      const badge = tab.key === "gradeplan" && hasGradePlan ? "معتمدة" : tab.badge;
      return <Link key={tab.href} href={tab.href} className={active ? "active" : ""}>
        <span className="academy-nav-icon"><NavIcon type={tab.key}/></span>
        <span className="academy-nav-copy"><b>{tab.label}</b><em>{tab.note}</em></span>
        {badge ? <i>{badge}</i> : null}
      </Link>;
    })}</nav>
  </section>;

  return <TeacherClientContext.Provider key={teacherId} value={contextValue}>
    <div className={`teacher-academy-v11 ${subjectConfig.themeClass} ${menuOpen ? "menu-open" : ""}`} dir="rtl" data-subject={subjectKey}>
      <aside className="academy-rail">
        <div className="academy-brand">
          <Image src="/icons/lahooni-identity-320.jpg" alt="هوية بوابة أستاذ لحوني التعليمية" width={64} height={64} priority />
          <div><small>بوابة أستاذ لحوني التعليمية</small><strong>أكاديمية المعلم</strong></div>
        </div>

        <section className="academy-teacher-card">
          <div className="academy-teacher-avatar">{teacherName.trim().charAt(0) || "م"}</div>
          <div><small>المعلم</small><h2>{teacherName}</h2><p>{activeGradeLabel || "المرحلة الثانوية"}</p></div>
          <span className="academy-online"><i/> متصل</span>
        </section>

        <section className="academy-subject-space" aria-label="المواد المسندة">
          <header><span>مساحاتي التعليمية</span><b>{availableSubjects.length}</b></header>
          <div className="academy-subject-list">{availableSubjects.map(subject => {
            const active = subject.workspaceKey === workspaceKey;
            return <button type="button" key={subject.workspaceKey} className={active ? "active" : ""} disabled={switchingSubject} onClick={() => void changeSubject(subject.workspaceKey)}>
              <span className="subject-ribbon" data-subject={subject.subjectId}/>
              <span><b>{subject.subjectName}</b><em>{subject.gradeLabel || ""}</em></span>
              {active ? <i>المادة الحالية</i> : <i>فتح</i>}
            </button>;
          })}</div>
        </section>

        <Link href="/teacher/dashboard" className={`academy-home ${pathname.startsWith("/teacher/dashboard") ? "active" : ""}`}>
          <NavIcon type="dashboard"/><span><b>مركز اليوم</b><small>ابدأ من أولوياتك</small></span>
        </Link>

        <div className="academy-nav-scroll">
          {renderGroup("daily", "العمل اليومي")}
          {renderGroup("learning", "التعليم والمتابعة")}
          {renderGroup("insight", "التحليل والتقارير")}
          {renderGroup("setup", "الإعداد")}
        </div>

        <div className="academy-race"><TeacherCompetitionProgress compact/></div>
        <footer className="academy-rail-footer"><Link href="/">الرئيسية</Link><button type="button" onClick={() => void logout()}>تسجيل الخروج</button></footer>
      </aside>

      <button type="button" className="academy-backdrop" aria-label="إغلاق القائمة" onClick={() => setMenuOpen(false)}/>

      <section className="academy-stage">
        <header className="academy-topbar">
          <button className="academy-menu" type="button" onClick={() => setMenuOpen(true)} aria-label="فتح القائمة">☰</button>
          <div className="academy-page-identity"><small>{context.eyebrow}</small><h1>{context.title}</h1><p>{subjectName}{activeGradeLabel ? ` • ${activeGradeLabel}` : ""}</p></div>
          <div className="academy-top-actions">
            <span className="academy-date">{todayLabel}</span>
            <Link href="/teacher/reports" className="academy-report-button"><NavIcon type="reports"/><span>مركز التقارير</span></Link>
          </div>
        </header>

        <section className="academy-guide">
          <div className="academy-guide-question"><small>مسارك الآن</small><h2>{context.question}</h2></div>
          <div className="academy-guide-ai"><span className="academy-ai-mark">AI</span><div><small>المساعد الأكاديمي</small><p>{context.ai}</p></div><Link href={context.href}>{context.action}</Link></div>
        </section>

        <main className="academy-canvas">{children}</main>
      </section>

      {switchingLabel ? <div className="academy-switching"><section><small>فتح مساحة تعليمية</small><strong>{switchingLabel}</strong><span>نحافظ على نفس بياناتك ونغيّر سياق المادة فقط.</span></section></div> : null}
    </div>
  </TeacherClientContext.Provider>;
}
