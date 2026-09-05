"use client";

import { FormEvent, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ACADEMIC_UNITS, FINAL_MAX, RESEARCH_MAX, UNIT_MAX, calculatePercentage, calculateUnitTotal } from "../../lib/academic-config";
import { calculateGradePlanResult, normalizeGradePlan, type GradePlan, type GradeValueMap } from "../../lib/grade-plan";
import StudentDiagnostics from "./student-diagnostics";
import StudentKeyboardScroll from "./student-keyboard-scroll";
import "./student-diagnostics.css";
import "./student-academy-v3.css";

type UnitRecord = { total?: number; attendance?: number; participation?: number; homework?: number; unitExam?: number; exam1?: number; exam2?: number };
type AttendanceSummary = { present: number; absent: number; late: number; excused: number; escaped: number; total: number; disciplineRate: number; latestDate?: string };
type TeacherNoteEntry = { id?: string; type?: string; label?: string; message?: string; createdAt?: string; teacherName?: string; subject?: string };
type TimetableLesson = { dayKey: string; dayLabel: string; dayIndex: number; period: number; className: string; subject: string; notes: string };
type StudentRecord = {
  gradePlan?: GradePlan | null;
  gradeValues?: GradeValueMap;
  gradePlanValues?: Record<string, GradeValueMap>;
  name?: string;
  class?: string;
  accessCode?: string;
  teacherName?: string;
  research?: number;
  researchScore?: number;
  teacherNote?: string;
  teacherNoteCount?: number;
  teacherNotes?: TeacherNoteEntry[];
  absences?: number;
  late?: number;
  attendanceSummary?: AttendanceSummary;
  timetableLessons?: TimetableLesson[];
  units?: Record<string, UnitRecord>;
  parentCounselorLastNotice?: { title?: string; message?: string };
};
type Match = { id: string; teacherId: string; subjectKey: string; subjectLabel: string; teacherName: string; icon: string; accessToken: string; data: StudentRecord };
type StudentTab = "home" | "notes" | "progress" | "subjects" | "schedule" | "tests" | "attendance" | "report";

type SubjectTheme = { primary: string; deep: string; accent: string; soft: string; label: string; eyebrow: string; title: string; prompt: string };

const CODE_PATTERN = /^TH[123]\d{3}$/;
const STUDENT_CODE_EXAMPLE = "TH1234";
const PORTAL_LOGO = "/icons/lahooni-identity-320.jpg";
const CLASSROOM = "/saudi-classroom.svg";
const DAY_ORDER = ["sunday", "monday", "tuesday", "wednesday", "thursday"];
const DAY_LABELS: Record<string, string> = { sunday: "الأحد", monday: "الاثنين", tuesday: "الثلاثاء", wednesday: "الأربعاء", thursday: "الخميس" };
const ar = (value: number) => new Intl.NumberFormat("ar-SA-u-nu-arab", { maximumFractionDigits: 1 }).format(Number.isFinite(value) ? value : 0);

const tabs: Array<{ key: StudentTab; label: string }> = [
  { key: "home", label: "الرئيسية" },
  { key: "notes", label: "الملاحظات" },
  { key: "progress", label: "تقدمي" },
  { key: "subjects", label: "المواد" },
  { key: "schedule", label: "الجدول" },
  { key: "tests", label: "الاختبارات" },
  { key: "attendance", label: "الحضور" },
  { key: "report", label: "التقرير الشامل" },
];

function normalizeStudentCode(value: string) {
  return value
    .replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

function subjectTheme(subjectKey: string, subjectLabel: string): SubjectTheme {
  const key = subjectKey.split("--")[0];
  if (["history", "geography", "social-studies", "social-sciences", "citizenship"].includes(key)) return { primary: "#9a6a2b", deep: "#593d24", accent: "#d2a34b", soft: "#f7f0e4", label: subjectLabel, eyebrow: "مسار التاريخ والوعي", title: "افهم الأحداث واربط الأسباب بالنتائج", prompt: "ما الفكرة التاريخية التي تستطيع تفسيرها اليوم؟" };
  if (key === "critical-thinking") return { primary: "#7258c7", deep: "#433679", accent: "#2d72d4", soft: "#f0edfb", label: subjectLabel, eyebrow: "مسار التحليل والاستدلال", title: "حلّل الأدلة وابنِ حكمك بوعي", prompt: "ما الدليل؟ وما التفسير الأقوى؟" };
  if (["mathematics", "financial-literacy"].includes(key)) return { primary: "#2d72d4", deep: "#174b8c", accent: "#58a6ff", soft: "#edf4ff", label: subjectLabel, eyebrow: "مسار الحل والتطبيق", title: "تقدّم خطوة بخطوة حتى تصل للحل", prompt: "اكتب خطوات الحل قبل النتيجة." };
  if (["science", "physics", "chemistry", "biology", "earth-science", "environmental-science"].includes(key)) return { primary: "#138b79", deep: "#0b5a55", accent: "#49b99b", soft: "#eaf7f3", label: subjectLabel, eyebrow: "مسار الاستكشاف العلمي", title: "لاحظ، جرّب، ثم فسّر ما يحدث", prompt: "ما الظاهرة التي تستطيع تفسيرها بما تعلمت؟" };
  if (["arabic", "linguistic-competencies"].includes(key)) return { primary: "#a54e61", deep: "#6d3041", accent: "#d7899a", soft: "#fbf0f3", label: subjectLabel, eyebrow: "مسار اللغة والتعبير", title: "اقرأ بفهم وعبّر بثقة", prompt: "اكتب فكرة واحدة بأسلوب واضح ومترابط." };
  if (key === "english") return { primary: "#4266b2", deep: "#2a4379", accent: "#7a9be0", soft: "#eef2fb", label: subjectLabel, eyebrow: "Learning & Communication", title: "Read, practise, and communicate with confidence", prompt: "Use one new word in a complete sentence." };
  if (["islamic-studies", "quran", "quran-tafsir", "tafsir", "hadith", "fiqh", "tawhid"].includes(key)) return { primary: "#2c825a", deep: "#1b513b", accent: "#c79b3c", soft: "#edf7f1", label: subjectLabel, eyebrow: "مسار العلم والقيم", title: "افهم المعرفة واربطها بالسلوك", prompt: "ما القيمة التي تستطيع تطبيقها اليوم؟" };
  if (["digital-technology", "computer-science"].includes(key)) return { primary: "#278da7", deep: "#185b72", accent: "#42bdd0", soft: "#eaf7fa", label: subjectLabel, eyebrow: "مسار المهارات الرقمية", title: "تعلّم، طبّق، وابنِ حلًا رقميًا", prompt: "ما الخطوة الرقمية التي تستطيع تنفيذها بنفسك؟" };
  return { primary: "#0b8f88", deep: "#083d54", accent: "#d3a64a", soft: "#eaf7f5", label: subjectLabel, eyebrow: "مسار التحصيل الأكاديمي", title: `تعلّم ${subjectLabel} بثقة ووضوح`, prompt: "ابدأ بالمهمة الأقرب لهدفك اليوم." };
}

function SubjectMark({ subjectKey }: { subjectKey: string }) {
  const key = subjectKey.split("--")[0];
  const common = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (["history", "geography", "social-studies", "social-sciences", "citizenship"].includes(key)) return <svg {...common}><path d="M3 21h18M5 18h14M6 8h12M8 8v10M12 8v10M16 8v10M4 8l8-5 8 5"/></svg>;
  if (key === "critical-thinking") return <svg {...common}><path d="M9 18h6M10 22h4M8 14.5A6 6 0 1 1 16 14.5c-1 .8-1.5 1.7-1.5 2.5h-5c0-.8-.5-1.7-1.5-2.5Z"/><path d="m9.5 10.5 1.5 1.5 3.5-4"/></svg>;
  if (["mathematics", "financial-literacy"].includes(key)) return <svg {...common}><path d="M4 5h16M12 3v4M5 12h6M8 9v6M14 10l6 6M20 10l-6 6M4 20h16"/></svg>;
  if (["science", "physics", "chemistry", "biology", "earth-science", "environmental-science"].includes(key)) return <svg {...common}><path d="M9 3h6M10 3v5l-5 9a3 3 0 0 0 2.6 4.5h8.8A3 3 0 0 0 19 17l-5-9V3"/><path d="M8 15h8M9.5 12h5"/></svg>;
  if (["digital-technology", "computer-science"].includes(key)) return <svg {...common}><rect x="4" y="4" width="16" height="12" rx="2"/><path d="M8 20h8M12 16v4M8 9h3M13 9h3"/></svg>;
  if (["islamic-studies", "quran", "quran-tafsir", "tafsir", "hadith", "fiqh", "tawhid"].includes(key)) return <svg {...common}><path d="M4 6.5A4 4 0 0 1 8 5h4v15H8a4 4 0 0 0-4 1.5v-15ZM20 6.5A4 4 0 0 0 16 5h-4v15h4a4 4 0 0 1 4 1.5v-15Z"/><path d="M8 9h2M14 9h2"/></svg>;
  return <svg {...common}><path d="M4 5.5A4.5 4.5 0 0 1 8.5 4H12v16H8.5A4.5 4.5 0 0 0 4 21.5v-16ZM20 5.5A4.5 4.5 0 0 0 15.5 4H12v16h3.5a4.5 4.5 0 0 1 4.5 1.5v-16Z"/></svg>;
}

function TabIcon({ tab }: { tab: StudentTab }) {
  const common = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (tab === "home") return <svg {...common}><path d="m3 11 9-8 9 8v9H3v-9Z"/><path d="M9 20v-6h6v6"/></svg>;
  if (tab === "notes") return <svg {...common}><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/></svg>;
  if (tab === "progress") return <svg {...common}><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/><path d="m4 8 6-4 6 5 5-4"/></svg>;
  if (tab === "subjects") return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>;
  if (tab === "schedule") return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M7 14h3M14 14h3M7 18h3"/></svg>;
  if (tab === "tests") return <svg {...common}><path d="M6 3h12v18H6zM9 8h6M9 12h3M9 16h6"/><path d="m14 12 1 1 2-2"/></svg>;
  if (tab === "attendance") return <svg {...common}><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0M16 11l2 2 4-5"/></svg>;
  return <svg {...common}><path d="M4 20V4h16v16H4Z"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>;
}

function metricsFor(match: Match) {
  const plan = normalizeGradePlan(match.data.gradePlan);
  if (plan) {
    const result = calculateGradePlanResult(plan, match.data || {});
    return { percentage: result.percentage || 0, total: result.earned || 0, completion: result.completion || 0, sections: result.sections.map(section => ({ label: section.label, earned: section.earned, max: section.maximum, percentage: section.maximum ? Math.round(section.earned / section.maximum * 100) : 0 })) };
  }
  const sections = ACADEMIC_UNITS.map(unit => {
    const row = match.data.units?.[unit.key] || {};
    const attendance = Number(row.attendance || 0);
    const participation = Number(row.participation || 0);
    const homework = Number(row.homework || 0);
    const unitExam = Number(row.unitExam ?? row.exam1 ?? row.exam2 ?? 0);
    const earned = Math.min(UNIT_MAX, Number(row.total ?? calculateUnitTotal({ attendance, participation, homework, unitExam })));
    return { label: unit.label, earned, max: UNIT_MAX, percentage: Math.round(earned / Math.max(UNIT_MAX, 1) * 100) };
  });
  const research = Math.min(RESEARCH_MAX, Number(match.data.researchScore ?? match.data.research ?? 0));
  const total = Math.min(FINAL_MAX, sections.reduce((sum, item) => sum + item.earned, 0) + research);
  return { percentage: calculatePercentage(total, FINAL_MAX), total, completion: calculatePercentage(total, FINAL_MAX), sections };
}

function noteDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("ar-SA", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export default function StudentPage() {
  const [accessCode, setAccessCode] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selected, setSelected] = useState<Match | null>(null);
  const [activeTab, setActiveTab] = useState<StudentTab>("home");
  const automaticLoginStarted = useRef(false);

  async function hydrateMatch(match: Match) {
    try {
      const response = await fetch("/api/student/profile", { headers: { Authorization: `Bearer ${match.accessToken}` }, cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      return response.ok && payload.data ? { ...match, data: payload.data as StudentRecord } : match;
    } catch {
      return match;
    }
  }

  async function lookup(codeValue: string) {
    const code = normalizeStudentCode(codeValue);
    setMessage("");
    setMatches([]);
    setSelected(null);
    if (!CODE_PATTERN.test(code)) return setMessage(`أدخل كودًا صحيحًا مثل ${STUDENT_CODE_EXAMPLE}.`);
    setLoading(true);
    try {
      const response = await fetch("/api/student/lookup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accessCode: code }), cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return setMessage(payload.message || "كود الدخول غير صحيح، أو لم تُربط لك مادة بعد.");
      const raw = Array.isArray(payload.matches) ? payload.matches as Match[] : [];
      if (!raw.length) return setMessage("لم تُربط مواد الطالب بالمعلمين بعد.");
      const enriched = await Promise.all(raw.map(hydrateMatch));
      setMatches(enriched);
      setSelected(enriched[0]);
      setActiveTab("home");
    } catch {
      setMessage("تعذر الوصول إلى بيانات الطالب الآن. حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const code = normalizeStudentCode(query.get("code") || "");
    if (code) setAccessCode(code);
    if (query.has("code") || query.has("entry") || query.has("v") || query.has("logout")) window.history.replaceState({}, "", "/student");
    if (CODE_PATTERN.test(code) && !automaticLoginStarted.current) {
      automaticLoginStarted.current = true;
      void lookup(code);
    }
  }, []);

  useEffect(() => {
    if (!selected?.accessToken) return;
    let active = true;
    let timer = 0;
    const refresh = async () => {
      const updated = await hydrateMatch(selected);
      if (!active) return;
      setSelected(current => current?.subjectKey === updated.subjectKey ? updated : current);
      setMatches(current => current.map(item => item.subjectKey === updated.subjectKey ? updated : item));
      timer = window.setTimeout(refresh, 15000);
    };
    timer = window.setTimeout(refresh, 15000);
    return () => { active = false; window.clearTimeout(timer); };
  }, [selected?.accessToken]);

  function submit(event: FormEvent) {
    event.preventDefault();
    void lookup(accessCode);
  }

  function exitStudentPortal() {
    setSelected(null);
    setMatches([]);
    setAccessCode("");
    setMessage("");
    setActiveTab("home");
    window.location.replace(`/student?logout=${Date.now()}`);
  }

  const theme = subjectTheme(selected?.subjectKey || "", selected?.subjectLabel || "المادة");
  const style = { "--sa-primary": theme.primary, "--sa-deep": theme.deep, "--sa-accent": theme.accent, "--sa-soft": theme.soft } as CSSProperties;
  const selectedMetrics = selected ? metricsFor(selected) : { percentage: 0, total: 0, completion: 0, sections: [] };
  const studentName = selected?.data.name?.trim() || "الطالب";
  const classLabel = selected?.data.class?.trim() || "الفصل غير محدد";
  const attendance = selected?.data.attendanceSummary || { present: 0, absent: 0, late: 0, excused: 0, escaped: 0, total: 0, disciplineRate: 100 };
  const subjectScores = useMemo(() => matches.map(match => ({ match, metrics: metricsFor(match), theme: subjectTheme(match.subjectKey, match.subjectLabel) })), [matches]);
  const overallAverage = subjectScores.length ? Math.round(subjectScores.reduce((sum, item) => sum + item.metrics.percentage, 0) / subjectScores.length) : 0;
  const overallDiscipline = subjectScores.length ? Math.round(subjectScores.reduce((sum, item) => sum + (item.match.data.attendanceSummary?.disciplineRate ?? 100), 0) / subjectScores.length) : 100;
  const allNotes = useMemo(() => matches.flatMap(match => {
    const direct = (match.data.teacherNotes || []).map((note, index) => ({ ...note, id: note.id || `${match.subjectKey}-${index}`, subjectLabel: match.subjectLabel, teacher: note.teacherName || match.teacherName, color: subjectTheme(match.subjectKey, match.subjectLabel).primary }));
    if (!direct.length && match.data.teacherNote) direct.push({ id: `${match.subjectKey}-legacy`, label: "ملاحظة المعلم", message: match.data.teacherNote, teacherName: match.teacherName, subject: match.subjectLabel, createdAt: "", subjectLabel: match.subjectLabel, teacher: match.teacherName, color: subjectTheme(match.subjectKey, match.subjectLabel).primary });
    return direct;
  }).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))), [matches]);
  const latestNote = allNotes[0];
  const allLessons = useMemo(() => matches.flatMap(match => (match.data.timetableLessons || []).map(lesson => ({ ...lesson, subjectKey: match.subjectKey, subjectLabel: match.subjectLabel, teacherName: match.teacherName, color: subjectTheme(match.subjectKey, match.subjectLabel).primary }))).sort((a, b) => a.dayIndex - b.dayIndex || a.period - b.period), [matches]);
  const strongestSubject = [...subjectScores].sort((a, b) => b.metrics.percentage - a.metrics.percentage)[0];
  const supportSubject = [...subjectScores].filter(item => item.metrics.percentage > 0).sort((a, b) => a.metrics.percentage - b.metrics.percentage)[0];
  const strongestSection = [...selectedMetrics.sections].sort((a, b) => b.percentage - a.percentage)[0];
  const weakestSection = [...selectedMetrics.sections].filter(item => item.max > 0).sort((a, b) => a.percentage - b.percentage)[0];
  const statusLabel = overallAverage >= 90 ? "متميز" : overallAverage >= 80 ? "متقدم" : overallAverage >= 70 ? "جيد" : overallAverage >= 60 ? "مستقر" : "يحتاج دعمًا";

  if (!selected) {
    return <main className="student-gateway-v3" dir="rtl">
      <section className="sg3-shell">
        <div className="sg3-visual">
          <img src={CLASSROOM} alt="بيئة تعليمية مدرسية سعودية"/>
          <div className="sg3-visual-copy"><small>بوابة الطالب وولي الأمر</small><h1>هويتك التعليمية تبدأ من هنا.</h1><p>شاهد ملاحظات معلميك، تقدمك بين المواد، جدولك الدراسي، اختباراتك وتقاريرك في أكاديمية واحدة مرتبطة مباشرة ببوابة المعلم.</p><div className="sg3-tags"><span>ملاحظات المعلمين</span><span>رحلة التقدم</span><span>الجدول الدراسي</span><span>تقرير أكاديمي للطباعة</span></div></div>
        </div>
        <div className="sg3-form">
          <div className="sg3-brand"><img src={PORTAL_LOGO} alt="هوية بوابة أستاذ لحوني التعليمية"/><div><strong>بوابة أستاذ لحوني التعليمية</strong><small>أكاديمية الطالب</small></div></div>
          <small>دخول الطالب</small><h2>مرحبًا بك</h2><p>أدخل كود الطالب للوصول إلى هويتك التعليمية وجميع المواد المرتبطة بك.</p>
          <form onSubmit={submit}>
            <label className="sg3-label" htmlFor="student-code-v3">كود الطالب</label>
            <div className="sg3-input"><span>TH</span><input id="student-code-v3" dir="ltr" value={accessCode} onChange={event => setAccessCode(normalizeStudentCode(event.target.value))} placeholder={STUDENT_CODE_EXAMPLE} maxLength={6} autoCapitalize="characters" autoComplete="username" required autoFocus/></div>
            {message ? <p className="sg3-error">{message}</p> : null}
            <button className="sg3-submit" disabled={loading}>{loading ? "جارٍ تجهيز أكاديميتك…" : "دخول أكاديمية الطالب"}</button>
          </form>
          <div className="sg3-mini-id"><small>بعد الدخول</small><strong>تظهر لك هوية تعليمية موحدة تربط موادك ومعلميك وتقاريرك.</strong></div>
        </div>
      </section>
    </main>;
  }

  return <main className="student-academy-v3" style={style} dir="rtl">
    <StudentKeyboardScroll />
    <div className="sa3-shell">
      <aside className="sa3-side">
        <div className="sa3-brand"><img src={PORTAL_LOGO} alt="هوية البوابة"/><div><strong>أستاذ لحوني</strong><small>أكاديمية الطالب</small></div></div>
        <nav className="sa3-nav" aria-label="أقسام أكاديمية الطالب">{tabs.map(tab => <button key={tab.key} type="button" className={activeTab === tab.key ? "active" : ""} onClick={() => { setActiveTab(tab.key); window.scrollTo({ top: 0, behavior: "smooth" }); }}><TabIcon tab={tab.key}/><span>{tab.label}</span></button>)}</nav>
        <section className="sa3-id"><small>الهوية التعليمية</small><strong>{studentName}</strong><span>{classLabel} • {matches.length} مواد</span><code>{selected.id}</code></section>
      </aside>

      <section className="sa3-main">
        <header className="sa3-top">
          <div className="sa3-student"><div className="sa3-avatar">{studentName.trim().charAt(0) || "ط"}</div><div><strong>{studentName}</strong><small>{classLabel} • البيانات مرتبطة مباشرة ببوابة المعلم</small></div></div>
          <div className="sa3-top-actions"><button type="button" className="print" onClick={() => { setActiveTab("report"); setTimeout(() => window.print(), 120); }}>طباعة التقرير</button><button type="button" onClick={exitStudentPortal}>تسجيل الخروج</button></div>
        </header>

        <div className="sa3-subject-strip" aria-label="مواد الطالب">{subjectScores.map(item => <button type="button" key={item.match.subjectKey} className={`sa3-subject-chip ${selected.subjectKey === item.match.subjectKey ? "active" : ""}`} style={{ "--chip": item.theme.primary } as CSSProperties} onClick={() => setSelected(item.match)}><span className="sa3-subject-mark"><SubjectMark subjectKey={item.match.subjectKey}/></span><span><b>{item.match.subjectLabel}</b><small>{ar(item.metrics.percentage)}٪ • {item.match.teacherName}</small></span></button>)}</div>

        <section className="sa3-hero">
          <div className="sa3-hero-copy"><small>{theme.eyebrow}</small><h1>{selected.subjectLabel}</h1><h2>{theme.title}</h2><p>{theme.prompt} بيانات هذه الصفحة تأتي من رصد المعلم وحضوره وجدوله واختباراته.</p><div className="sa3-hero-meta"><span>{selected.teacherName}</span><span>{classLabel}</span><span>اكتمال الرصد {ar(selectedMetrics.completion)}٪</span></div></div>
          <div className="sa3-score"><small>تحصيلي الحالي</small><strong>{ar(selectedMetrics.percentage)}٪</strong><span>{selectedMetrics.percentage >= 90 ? "متميز" : selectedMetrics.percentage >= 80 ? "متقدم" : selectedMetrics.percentage >= 70 ? "جيد" : selectedMetrics.percentage >= 60 ? "مستقر" : "يحتاج دعمًا"}</span></div>
        </section>

        {activeTab === "home" && <section className="sa3-panel">
          {latestNote ? <article className="sa3-note-highlight"><span>!</span><div><small>أحدث ملاحظة من المعلم</small><strong>{latestNote.label || "متابعة تعليمية"}</strong><p>{latestNote.message || "لديك ملاحظة جديدة من المعلم."} • {latestNote.subjectLabel}</p></div><button type="button" onClick={() => setActiveTab("notes")}>عرض الملاحظات</button></article> : null}
          <div className="sa3-kpis"><article><small>متوسط المواد</small><strong>{ar(overallAverage)}٪</strong><span>{statusLabel}</span></article><article><small>انضباطي</small><strong>{ar(overallDiscipline)}٪</strong><span>من سجلات المعلمين</span></article><article><small>الملاحظات</small><strong>{ar(allNotes.length)}</strong><span>في جميع المواد</span></article><article><small>حصصي الأسبوعية</small><strong>{ar(allLessons.length)}</strong><span>حسب جداول المعلمين</span></article></div>
          <div className="sa3-dashboard-grid">
            <article className="sa3-card sa3-journey"><div className="sa3-journey-top"><div><small>رحلتي في {selected.subjectLabel}</small><strong>{ar(selectedMetrics.percentage)}٪</strong></div><span>{selectedMetrics.sections.length} مراحل مرصودة</span></div><div className="sa3-progressbar"><i style={{ "--p": `${Math.max(0, Math.min(100, selectedMetrics.percentage))}%` } as CSSProperties}/></div><p>أقوى جانب: <b>{strongestSection?.label || "بانتظار اكتمال الرصد"}</b> • الأولوية القادمة: <b>{weakestSection?.label || "المهارات الأساسية"}</b>.</p></article>
            <article className="sa3-card sa3-priority"><small>ماذا أفعل الآن؟</small><strong>{weakestSection?.label ? `ابدأ بـ ${weakestSection.label}` : "راجع آخر درس"}</strong><p>{selectedMetrics.percentage >= 85 ? "حافظ على التقدم بحل أسئلة إثرائية ومراجعة الأخطاء." : "راجع المفهوم، حل ثلاثة أسئلة، ثم قارن إجاباتك بملاحظات المعلم."}</p></article>
          </div>
          <section className="sa3-card"><div className="sa3-card-head"><div><small>موادي</small><h2>نظرة سريعة على جميع المواد</h2></div><button type="button" onClick={() => setActiveTab("subjects")}>عرض الكل</button></div><div className="sa3-subject-grid">{subjectScores.slice(0, 6).map(item => <button key={item.match.subjectKey} type="button" className="sa3-subject-card" style={{ "--card": item.theme.primary } as CSSProperties} onClick={() => { setSelected(item.match); setActiveTab("progress"); }}><div className="sa3-subject-card-head"><span className="sa3-subject-mark" style={{ "--chip": item.theme.primary } as CSSProperties}><SubjectMark subjectKey={item.match.subjectKey}/></span><span className="pct">{ar(item.metrics.percentage)}٪</span></div><h3>{item.match.subjectLabel}</h3><p>{item.match.teacherName}</p><footer><span>اكتمال {ar(item.metrics.completion)}٪</span><span>{item.match.data.teacherNotes?.length || (item.match.data.teacherNote ? 1 : 0)} ملاحظات</span></footer></button>)}</div></section>
        </section>}

        {activeTab === "notes" && <section className="sa3-panel"><section className="sa3-card"><div className="sa3-card-head"><div><small>صلة مباشرة مع المعلمين</small><h2>ملاحظاتي التعليمية</h2></div><span>{allNotes.length} ملاحظة</span></div>{allNotes.length ? <div className="sa3-note-list">{allNotes.map((note, index) => <article className="sa3-note-item" key={note.id || index} style={{ "--note": note.color } as CSSProperties}><i/><div><b>{note.label || "ملاحظة المعلم"} • {note.subjectLabel}</b><p>{note.message || "متابعة تعليمية من المعلم."}</p></div><small>{noteDate(note.createdAt)}{note.teacher ? ` • ${note.teacher}` : ""}</small></article>)}</div> : <div className="sa3-empty">لا توجد ملاحظات مسجلة حاليًا. أي ملاحظة يعتمدها المعلم ستظهر هنا مباشرة.</div>}</section></section>}

        {activeTab === "progress" && <section className="sa3-panel"><section className="sa3-card"><div className="sa3-card-head"><div><small>رحلة التقدم</small><h2>كيف أتقدم في {selected.subjectLabel}؟</h2></div><strong>{ar(selectedMetrics.percentage)}٪</strong></div><div className="sa3-timeline">{selectedMetrics.sections.length ? selectedMetrics.sections.map(section => <div className="sa3-timeline-row" key={section.label}><b>{section.label}</b><div className="sa3-timeline-track"><i style={{ "--p": `${Math.max(0, Math.min(100, section.percentage))}%` } as CSSProperties}/></div><span>{ar(section.percentage)}٪</span></div>) : <div className="sa3-empty">بانتظار رصد درجات الخطة من المعلم.</div>}</div></section><div className="sa3-dashboard-grid"><article className="sa3-card sa3-priority"><small>أقوى مرحلة</small><strong>{strongestSection?.label || "بانتظار البيانات"}</strong><p>{strongestSection ? `وصلت إلى ${ar(strongestSection.percentage)}٪ في هذه المرحلة.` : "ستظهر بعد بدء الرصد."}</p></article><article className="sa3-card sa3-priority"><small>الخطوة التالية</small><strong>{weakestSection?.label || "المهارات الأساسية"}</strong><p>{weakestSection ? `ابدأ بمراجعة هذه المرحلة؛ مستواك الحالي ${ar(weakestSection.percentage)}٪.` : "اختر مهارة واحدة وابدأ بها."}</p></article></div></section>}

        {activeTab === "subjects" && <section className="sa3-panel"><section className="sa3-card"><div className="sa3-card-head"><div><small>مساحات المواد</small><h2>كل مادة بهويتها وبيانات معلمها</h2></div><span>{matches.length} مواد</span></div><div className="sa3-subject-grid">{subjectScores.map(item => <button key={item.match.subjectKey} type="button" className="sa3-subject-card" style={{ "--card": item.theme.primary } as CSSProperties} onClick={() => { setSelected(item.match); setActiveTab("home"); }}><div className="sa3-subject-card-head"><span className="sa3-subject-mark" style={{ "--chip": item.theme.primary } as CSSProperties}><SubjectMark subjectKey={item.match.subjectKey}/></span><span className="pct">{ar(item.metrics.percentage)}٪</span></div><h3>{item.match.subjectLabel}</h3><p>{item.theme.eyebrow}</p><footer><span>{item.match.teacherName}</span><span>فتح المادة ←</span></footer></button>)}</div></section></section>}

        {activeTab === "schedule" && <section className="sa3-panel"><section className="sa3-card"><div className="sa3-card-head"><div><small>مرتبط بجداول المعلمين</small><h2>جدولي الدراسي الأسبوعي</h2></div><span>{allLessons.length} حصة</span></div>{allLessons.length ? <div className="sa3-week">{DAY_ORDER.map(day => <article className="sa3-day" key={day}><header>{DAY_LABELS[day]}</header><div className="sa3-lessons">{allLessons.filter(lesson => lesson.dayKey === day).length ? allLessons.filter(lesson => lesson.dayKey === day).map((lesson, index) => <div className="sa3-lesson" key={`${lesson.subjectKey}-${lesson.period}-${index}`} style={{ "--lesson": lesson.color } as CSSProperties}><b>{lesson.subjectLabel}</b><span>الحصة {lesson.period} • {lesson.teacherName}</span>{lesson.notes ? <small>{lesson.notes}</small> : null}</div>) : <div className="sa3-empty">لا توجد حصة</div>}</div></article>)}</div> : <div className="sa3-empty">لم يُنشر جدول لهذا الفصل بعد. عندما يحفظ المعلم حصصه ستظهر هنا تلقائيًا.</div>}</section></section>}

        {activeTab === "tests" && <section className="sa3-panel"><section className="sa3-card"><div className="sa3-card-head"><div><small>اختبارات {selected.subjectLabel}</small><h2>الاختبارات التشخيصية والنتائج</h2></div><span>{selected.teacherName}</span></div><div className="sa3-tests"><StudentDiagnostics accessToken={selected.accessToken}/></div></section></section>}

        {activeTab === "attendance" && <section className="sa3-panel"><section className="sa3-card"><div className="sa3-card-head"><div><small>سجل {selected.subjectLabel}</small><h2>حضوري وانضباطي</h2></div><strong>{ar(attendance.disciplineRate)}٪</strong></div><div className="sa3-attendance"><div className="sa3-att-ring" style={{ "--r": Math.max(0, Math.min(100, attendance.disciplineRate)) } as CSSProperties}><strong>{ar(attendance.disciplineRate)}٪</strong><span>نسبة الانضباط</span></div><div className="sa3-att-stats"><article><strong>{ar(attendance.present)}</strong><span>حضور</span></article><article><strong>{ar(attendance.absent)}</strong><span>غياب</span></article><article><strong>{ar(attendance.late)}</strong><span>تأخير</span></article><article><strong>{ar(attendance.excused)}</strong><span>استئذان</span></article></div></div></section></section>}

        {activeTab === "report" && <section className="sa3-panel"><section className="sa3-report-hero"><div><small>التقرير الشامل للطالب</small><h2>بيان تقدم أكاديمي لجميع المواد</h2><p>يجمع التحصيل والانضباط والملاحظات في صفحة واحدة قابلة للطباعة بشكل قريب من الشهادة.</p></div><button type="button" onClick={() => window.print()}>طباعة بيان التقدم</button></section><div className="sa3-report-grid"><article><small>متوسط التحصيل</small><strong>{ar(overallAverage)}٪</strong></article><article><small>متوسط الانضباط</small><strong>{ar(overallDiscipline)}٪</strong></article><article><small>الملاحظات المسجلة</small><strong>{ar(allNotes.length)}</strong></article></div><section className="sa3-card"><div className="sa3-card-head"><div><small>ملخص المواد</small><h2>مستواي العام</h2></div><span>{statusLabel}</span></div><div className="sa3-report-table"><table><thead><tr><th>المادة</th><th>المعلم</th><th>التحصيل</th><th>الانضباط</th><th>الملاحظات</th></tr></thead><tbody>{subjectScores.map(item => <tr key={item.match.subjectKey}><td>{item.match.subjectLabel}</td><td>{item.match.teacherName}</td><td>{ar(item.metrics.percentage)}٪</td><td>{ar(item.match.data.attendanceSummary?.disciplineRate ?? 100)}٪</td><td>{item.match.data.teacherNotes?.length || (item.match.data.teacherNote ? 1 : 0)}</td></tr>)}</tbody></table></div></section><div className="sa3-dashboard-grid"><article className="sa3-card sa3-priority"><small>أقوى مادة</small><strong>{strongestSubject?.match.subjectLabel || "بانتظار الرصد"}</strong><p>{strongestSubject ? `${ar(strongestSubject.metrics.percentage)}٪ — حافظ على هذا المستوى.` : "ستظهر بعد اكتمال الرصد."}</p></article><article className="sa3-card sa3-priority"><small>أولوية التحسين</small><strong>{supportSubject?.match.subjectLabel || "المهارات الأساسية"}</strong><p>{supportSubject ? `${ar(supportSubject.metrics.percentage)}٪ — راجع ملاحظات المعلم وخطة المادة.` : "لا توجد مادة تحتاج دعمًا محددًا حاليًا."}</p></article></div></section>}
      </section>
    </div>

    <section className="student-certificate-v3" aria-label="بيان تقدم الطالب القابل للطباعة">
      <header className="sc3-head"><img src={PORTAL_LOGO} alt="هوية البوابة"/><div><h1>بيان تقدم الطالب الأكاديمي</h1><p>بوابة أستاذ لحوني التعليمية • تقرير شامل مرتبط بسجلات المعلمين</p></div><div className="sc3-badge"><small>المستوى العام</small><strong>{statusLabel}</strong></div></header>
      <section className="sc3-student"><div><span>اسم الطالب</span><strong>{studentName}</strong></div><div><span>الصف / الفصل</span><strong>{classLabel}</strong></div><div><span>كود الطالب</span><strong>{selected.id}</strong></div></section>
      <section className="sc3-summary"><article><small>متوسط التحصيل</small><strong>{ar(overallAverage)}٪</strong></article><article><small>متوسط الانضباط</small><strong>{ar(overallDiscipline)}٪</strong></article><article><small>عدد المواد</small><strong>{ar(matches.length)}</strong></article></section>
      <table className="sc3-table"><thead><tr><th>المادة</th><th>المعلم</th><th>التحصيل</th><th>الانضباط</th><th>الملاحظات</th></tr></thead><tbody>{subjectScores.map(item => <tr key={`print-${item.match.subjectKey}`}><td>{item.match.subjectLabel}</td><td>{item.match.teacherName}</td><td>{ar(item.metrics.percentage)}٪</td><td>{ar(item.match.data.attendanceSummary?.disciplineRate ?? 100)}٪</td><td>{item.match.data.teacherNotes?.length || (item.match.data.teacherNote ? 1 : 0)}</td></tr>)}</tbody></table>
      <section className="sc3-notes"><h2>أبرز الملاحظات التعليمية</h2>{allNotes.slice(0, 4).length ? allNotes.slice(0, 4).map((note, index) => <p key={`print-note-${note.id || index}`}><b>{note.subjectLabel}:</b> {note.message || note.label || "متابعة تعليمية"}</p>) : <p>لا توجد ملاحظات مسجلة حاليًا.</p>}</section>
      <footer className="sc3-foot"><span>تاريخ التقرير: {new Intl.DateTimeFormat("ar-SA", { dateStyle: "long" }).format(new Date())}</span><strong>بوابة أستاذ لحوني التعليمية</strong><span>متابعة ولي الأمر: __________________</span></footer>
    </section>
  </main>;
}
