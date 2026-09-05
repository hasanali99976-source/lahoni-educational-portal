"use client";

import { FormEvent, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ACADEMIC_UNITS, FINAL_MAX, RESEARCH_MAX, UNIT_MAX, calculatePercentage, calculateUnitTotal } from "../../lib/academic-config";
import { calculateGradePlanResult, normalizeGradePlan, type GradePlan, type GradeValueMap } from "../../lib/grade-plan";
import { downloadStudentProgressPdf } from "../../lib/student-progress-pdf";
import StudentDiagnostics from "./student-diagnostics";
import StudentKeyboardScroll from "./student-keyboard-scroll";
import "./student-diagnostics.css";
import "./student-academy-v4.css";

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
type StudentTab = "home" | "notes" | "progress" | "schedule" | "tests" | "report";
type SubjectTheme = { primary: string; deep: string; accent: string; soft: string; eyebrow: string; title: string };

const CODE_PATTERN = /^TH[123]\d{3}$/;
const STUDENT_CODE_EXAMPLE = "TH1234";
const PORTAL_LOGO = "/icons/lahooni-identity-320.jpg";
const DAY_ORDER = ["sunday", "monday", "tuesday", "wednesday", "thursday"];
const DAY_LABELS: Record<string, string> = { sunday: "الأحد", monday: "الاثنين", tuesday: "الثلاثاء", wednesday: "الأربعاء", thursday: "الخميس" };
const ar = (value: number) => new Intl.NumberFormat("ar-SA-u-nu-arab", { maximumFractionDigits: 1 }).format(Number.isFinite(value) ? value : 0);

const tabs: Array<{ key: StudentTab; label: string }> = [
  { key: "home", label: "الرئيسية" },
  { key: "notes", label: "ملاحظاتي" },
  { key: "progress", label: "تقدمي" },
  { key: "schedule", label: "جدولي" },
  { key: "tests", label: "اختباراتي" },
  { key: "report", label: "تقريري" },
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
  if (["history", "geography", "social-studies", "social-sciences", "citizenship"].includes(key)) return { primary: "#9a6a2b", deep: "#593d24", accent: "#d2a34b", soft: "#f7f0e4", eyebrow: "مسار التاريخ والوعي", title: "افهم الأحداث واربط الأسباب بالنتائج" };
  if (key === "critical-thinking") return { primary: "#7258c7", deep: "#433679", accent: "#2d72d4", soft: "#f0edfb", eyebrow: "مسار التحليل والاستدلال", title: "حلّل الأدلة وابنِ حكمك بوعي" };
  if (["mathematics", "financial-literacy"].includes(key)) return { primary: "#2d72d4", deep: "#174b8c", accent: "#58a6ff", soft: "#edf4ff", eyebrow: "مسار الحل والتطبيق", title: "تقدّم خطوة بخطوة حتى تصل للحل" };
  if (["science", "physics", "chemistry", "biology", "earth-science", "environmental-science"].includes(key)) return { primary: "#138b79", deep: "#0b5a55", accent: "#49b99b", soft: "#eaf7f3", eyebrow: "مسار الاستكشاف العلمي", title: "لاحظ، جرّب، ثم فسّر ما يحدث" };
  if (["arabic", "linguistic-competencies"].includes(key)) return { primary: "#a54e61", deep: "#6d3041", accent: "#d7899a", soft: "#fbf0f3", eyebrow: "مسار اللغة والتعبير", title: "اقرأ بفهم وعبّر بثقة" };
  if (key === "english") return { primary: "#4266b2", deep: "#2a4379", accent: "#7a9be0", soft: "#eef2fb", eyebrow: "Learning & Communication", title: "Read, practise, and communicate with confidence" };
  if (["islamic-studies", "quran", "quran-tafsir", "tafsir", "hadith", "fiqh", "tawhid"].includes(key)) return { primary: "#2c825a", deep: "#1b513b", accent: "#c79b3c", soft: "#edf7f1", eyebrow: "مسار العلم والقيم", title: "افهم المعرفة واربطها بالسلوك" };
  if (["digital-technology", "computer-science"].includes(key)) return { primary: "#278da7", deep: "#185b72", accent: "#42bdd0", soft: "#eaf7fa", eyebrow: "مسار المهارات الرقمية", title: "تعلّم، طبّق، وابنِ حلًا رقميًا" };
  return { primary: "#0b8f88", deep: "#083d54", accent: "#d3a64a", soft: "#eaf7f5", eyebrow: "مسار التحصيل الأكاديمي", title: `تعلّم ${subjectLabel} بثقة ووضوح` };
}

function SubjectMark({ subjectKey }: { subjectKey: string }) {
  const key = subjectKey.split("--")[0];
  const common = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (["history", "geography", "social-studies", "social-sciences", "citizenship"].includes(key)) return <svg {...common}><path d="M3 21h18M5 18h14M6 8h12M8 8v10M12 8v10M16 8v10M4 8l8-5 8 5"/></svg>;
  if (key === "critical-thinking") return <svg {...common}><path d="M9 18h6M10 22h4M8 14.5A6 6 0 1 1 16 14.5c-1 .8-1.5 1.7-1.5 2.5h-5c0-.8-.5-1.7-1.5-2.5Z"/><path d="m9.5 10.5 1.5 1.5 3.5-4"/></svg>;
  if (["mathematics", "financial-literacy"].includes(key)) return <svg {...common}><path d="M4 5h16M12 3v4M5 12h6M8 9v6M14 10l6 6M20 10l-6 6M4 20h16"/></svg>;
  if (["science", "physics", "chemistry", "biology", "earth-science", "environmental-science"].includes(key)) return <svg {...common}><path d="M9 3h6M10 3v5l-5 9a3 3 0 0 0 2.6 4.5h8.8A3 3 0 0 0 19 17l-5-9V3"/><path d="M8 15h8M9.5 12h5"/></svg>;
  if (["digital-technology", "computer-science"].includes(key)) return <svg {...common}><rect x="4" y="4" width="16" height="12" rx="2"/><path d="M8 20h8M12 16v4M8 9h3M13 9h3"/></svg>;
  if (["islamic-studies", "quran", "quran-tafsir", "tafsir", "hadith", "fiqh", "tawhid"].includes(key)) return <svg {...common}><path d="M4 6.5A4 4 0 0 1 8 5h4v15H8a4 4 0 0 0-4 1.5v-15ZM20 6.5A4 4 0 0 0 16 5h-4v15h4a4 4 0 0 1 4 1.5v-15Z"/></svg>;
  return <svg {...common}><path d="M4 5.5A4.5 4.5 0 0 1 8.5 4H12v16H8.5A4.5 4.5 0 0 0 4 21.5v-16ZM20 5.5A4.5 4.5 0 0 0 15.5 4H12v16h3.5a4.5 4.5 0 0 1 4.5 1.5v-16Z"/></svg>;
}

function TabIcon({ tab }: { tab: StudentTab }) {
  const common = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (tab === "home") return <svg {...common}><path d="m3 11 9-8 9 8v9H3v-9Z"/><path d="M9 20v-6h6v6"/></svg>;
  if (tab === "notes") return <svg {...common}><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/></svg>;
  if (tab === "progress") return <svg {...common}><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/><path d="m4 8 6-4 6 5 5-4"/></svg>;
  if (tab === "schedule") return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M7 14h3M14 14h3M7 18h3"/></svg>;
  if (tab === "tests") return <svg {...common}><path d="M6 3h12v18H6zM9 8h6M9 12h3M9 16h6"/><path d="m14 12 1 1 2-2"/></svg>;
  return <svg {...common}><path d="M4 20V4h16v16H4Z"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>;
}

function StudentMark() {
  return <svg viewBox="0 0 24 24"><path d="m3 8 9-5 9 5-9 5-9-5Z"/><path d="M7 11v5c2.6 2.2 7.4 2.2 10 0v-5M21 8v6"/><circle cx="12" cy="19" r="2"/></svg>;
}

function metricsFor(match: Match) {
  const plan = normalizeGradePlan(match.data.gradePlan);
  if (plan) {
    const result = calculateGradePlanResult(plan, match.data || {});
    return {
      percentage: result.percentage || 0,
      total: result.earned || 0,
      completion: result.completion || 0,
      sections: result.sections.map(section => ({ label: section.label, earned: section.earned, max: section.maximum, percentage: section.maximum ? Math.round(section.earned / section.maximum * 100) : 0 })),
    };
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

function riyadhDayKey() {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "Asia/Riyadh" }).format(new Date()).toLowerCase();
}

export default function StudentPage() {
  const [accessCode, setAccessCode] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selected, setSelected] = useState<Match | null>(null);
  const [activeTab, setActiveTab] = useState<StudentTab>("home");
  const [printing, setPrinting] = useState(false);
  const [reportMessage, setReportMessage] = useState("");
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
    setReportMessage("");
    setActiveTab("home");
    window.location.replace(`/student?logout=${Date.now()}`);
  }

  const theme = subjectTheme(selected?.subjectKey || "", selected?.subjectLabel || "المادة");
  const style = { "--st-primary": theme.primary, "--st-deep": theme.deep, "--st-accent": theme.accent, "--st-soft": theme.soft } as CSSProperties;
  const selectedMetrics = selected ? metricsFor(selected) : { percentage: 0, total: 0, completion: 0, sections: [] as Array<{ label: string; earned: number; max: number; percentage: number }> };
  const studentName = selected?.data.name?.trim() || "الطالب";
  const classLabel = selected?.data.class?.trim() || "الفصل غير محدد";
  const attendance = selected?.data.attendanceSummary || { present: 0, absent: 0, late: 0, excused: 0, escaped: 0, total: 0, disciplineRate: 100 };
  const subjectScores = useMemo(() => matches.map(match => ({ match, metrics: metricsFor(match), theme: subjectTheme(match.subjectKey, match.subjectLabel) })), [matches]);
  const gradedSubjects = subjectScores.filter(item => item.metrics.completion > 0 || item.metrics.percentage > 0);
  const overallAverage = gradedSubjects.length ? Math.round(gradedSubjects.reduce((sum, item) => sum + item.metrics.percentage, 0) / gradedSubjects.length) : 0;
  const overallDiscipline = subjectScores.length ? Math.round(subjectScores.reduce((sum, item) => sum + (item.match.data.attendanceSummary?.disciplineRate ?? 100), 0) / subjectScores.length) : 100;
  const allNotes = useMemo(() => matches.flatMap(match => {
    const direct = (match.data.teacherNotes || []).map((note, index) => ({ ...note, id: note.id || `${match.subjectKey}-${index}`, subjectLabel: match.subjectLabel, teacher: note.teacherName || match.teacherName, color: subjectTheme(match.subjectKey, match.subjectLabel).primary }));
    if (!direct.length && match.data.teacherNote) direct.push({ id: `${match.subjectKey}-legacy`, label: "ملاحظة المعلم", message: match.data.teacherNote, teacherName: match.teacherName, subject: match.subjectLabel, createdAt: "", subjectLabel: match.subjectLabel, teacher: match.teacherName, color: subjectTheme(match.subjectKey, match.subjectLabel).primary });
    return direct;
  }).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))), [matches]);
  const latestNote = allNotes[0];
  const allLessons = useMemo(() => matches.flatMap(match => (match.data.timetableLessons || []).map(lesson => ({ ...lesson, subjectKey: match.subjectKey, subjectLabel: match.subjectLabel, teacherName: match.teacherName, color: subjectTheme(match.subjectKey, match.subjectLabel).primary }))).sort((a, b) => a.dayIndex - b.dayIndex || a.period - b.period), [matches]);
  const todayKey = riyadhDayKey();
  const todayLessons = allLessons.filter(lesson => lesson.dayKey === todayKey);
  const strongestSubject = [...gradedSubjects].sort((a, b) => b.metrics.percentage - a.metrics.percentage)[0];
  const supportSubject = [...gradedSubjects].sort((a, b) => a.metrics.percentage - b.metrics.percentage)[0];
  const strongestSection = [...selectedMetrics.sections].sort((a, b) => b.percentage - a.percentage)[0];
  const weakestSection = [...selectedMetrics.sections].filter(item => item.max > 0).sort((a, b) => a.percentage - b.percentage)[0];
  const statusLabel = overallAverage >= 90 ? "متميز" : overallAverage >= 80 ? "متقدم" : overallAverage >= 70 ? "جيد" : overallAverage >= 60 ? "مستقر" : overallAverage > 0 ? "يحتاج دعمًا" : "بانتظار الرصد";

  async function downloadReport() {
    if (!selected || printing) return;
    setPrinting(true);
    setReportMessage("");
    try {
      await downloadStudentProgressPdf({
        portalName: "بوابة أستاذ لحوني التعليمية",
        studentName,
        className: classLabel,
        studentCode: selected.id,
        overallAverage,
        overallDiscipline,
        statusLabel,
        subjects: subjectScores.map(item => ({
          subject: item.match.subjectLabel,
          teacher: item.match.teacherName,
          percentage: item.metrics.percentage,
          discipline: item.match.data.attendanceSummary?.disciplineRate ?? 100,
          noteCount: item.match.data.teacherNotes?.length || (item.match.data.teacherNote ? 1 : 0),
          accent: item.theme.primary,
        })),
        notes: allNotes.slice(0, 6).map(note => ({
          subject: note.subjectLabel,
          text: note.message || note.label || "متابعة تعليمية",
          teacher: note.teacher,
          date: noteDate(note.createdAt),
        })),
        fileName: `بيان-تقدم-${studentName.replace(/\s+/g, "-")}.pdf`,
      });
      setReportMessage("تم تجهيز بيان التقدم بصيغة PDF.");
    } catch {
      setReportMessage("تعذر تجهيز التقرير الآن. أعد المحاولة.");
    } finally {
      setPrinting(false);
    }
  }

  if (!selected) {
    return <main className="student-gateway-v4" dir="rtl">
      <section className="stg4-shell">
        <div className="stg4-form">
          <div className="stg4-brand"><img src={PORTAL_LOGO} alt="هوية بوابة أستاذ لحوني التعليمية"/><div><strong>بوابة أستاذ لحوني التعليمية</strong><small>بوابة الطالب</small></div></div>
          <small>مساحتك الدراسية</small>
          <h1>دخول الطالب</h1>
          <p>أدخل كودك لتشاهد موادك، ملاحظات معلميك، تقدمك، جدولك واختباراتك في مكان واحد.</p>
          <form onSubmit={submit}>
            <label htmlFor="student-code-v4">كود الطالب</label>
            <div className="stg4-code"><span>TH</span><input id="student-code-v4" dir="ltr" value={accessCode} onChange={event => setAccessCode(normalizeStudentCode(event.target.value))} placeholder={STUDENT_CODE_EXAMPLE} maxLength={6} autoCapitalize="characters" autoComplete="username" required autoFocus/></div>
            {message ? <p className="stg4-error">{message}</p> : null}
            <button className="stg4-submit" disabled={loading}>{loading ? "جارٍ فتح بوابتك…" : "دخول بوابة الطالب"}</button>
          </form>
          <div className="stg4-help"><span>درجاتي</span><span>ملاحظاتي</span><span>جدولي</span><span>تقريري</span></div>
        </div>
        <div className="stg4-identity">
          <div className="stg4-student-mark"><StudentMark/></div>
          <div className="stg4-identity-copy">
            <small>هويتك التعليمية</small>
            <h2>كل ما يخص دراستك، واضح أمامك.</h2>
            <p>بوابة مخصصة للطالب فقط؛ تربط ما يرصد المعلم بما تحتاج أن تعرفه أنت دون قوائم معقدة أو معلومات زائدة.</p>
            <div className="stg4-identity-card"><span>ملاحظات المعلمين</span><span>تقدم المواد</span><span>الحصص الأسبوعية</span><span>بيان التقدم PDF</span></div>
          </div>
        </div>
      </section>
    </main>;
  }

  return <main className="student-academy-v4" style={style} dir="rtl">
    <StudentKeyboardScroll />
    <div className="sta4-shell">
      <aside className="sta4-side">
        <div className="sta4-brand"><img src={PORTAL_LOGO} alt="هوية البوابة"/><div><strong>أستاذ لحوني</strong><small>بوابة الطالب</small></div></div>
        <nav className="sta4-nav" aria-label="أقسام بوابة الطالب">{tabs.map(tab => <button key={tab.key} type="button" className={activeTab === tab.key ? "active" : ""} onClick={() => { setActiveTab(tab.key); window.scrollTo({ top: 0, behavior: "smooth" }); }}><TabIcon tab={tab.key}/><span>{tab.label}</span></button>)}</nav>
        <section className="sta4-id"><small>هويتي التعليمية</small><strong>{studentName}</strong><span>{classLabel} • {matches.length} مواد</span><code>{selected.id}</code></section>
      </aside>

      <section className="sta4-main">
        <header className="sta4-top">
          <div className="sta4-student"><div className="sta4-avatar">{studentName.charAt(0) || "ط"}</div><div><strong>{studentName}</strong><small>{classLabel} • آخر البيانات من معلميك</small></div></div>
          <div className="sta4-top-actions"><button type="button" className="report" onClick={() => { setActiveTab("report"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>تقريري</button><button type="button" onClick={exitStudentPortal}>خروج</button></div>
        </header>

        <div className="sta4-subjects" aria-label="مواد الطالب">{subjectScores.map(item => <button type="button" key={item.match.subjectKey} className={`sta4-subject ${selected.subjectKey === item.match.subjectKey ? "active" : ""}`} style={{ "--subject": item.theme.primary } as CSSProperties} onClick={() => setSelected(item.match)}><span className="sta4-subject-icon"><SubjectMark subjectKey={item.match.subjectKey}/></span><span><b>{item.match.subjectLabel}</b><small>{item.metrics.percentage > 0 ? `${ar(item.metrics.percentage)}٪` : "بانتظار الرصد"}</small></span></button>)}</div>

        <section className="sta4-subject-head">
          <div className="sta4-subject-copy"><small>{theme.eyebrow}</small><h1>{selected.subjectLabel}</h1><p>{theme.title}. كل ما يظهر هنا مأخوذ من رصد معلم المادة وجدوله وملاحظاته.</p><div className="sta4-subject-meta"><span>{selected.teacherName}</span><span>{classLabel}</span><span>اكتمال الرصد {ar(selectedMetrics.completion)}٪</span></div></div>
          <div className="sta4-score"><small>مستواي الآن</small><strong>{selectedMetrics.percentage > 0 ? `${ar(selectedMetrics.percentage)}٪` : "—"}</strong><span>{selectedMetrics.percentage >= 90 ? "متميز" : selectedMetrics.percentage >= 80 ? "متقدم" : selectedMetrics.percentage >= 70 ? "جيد" : selectedMetrics.percentage > 0 ? "أحتاج تركيزًا أكثر" : "بانتظار الرصد"}</span></div>
        </section>

        {activeTab === "home" && <section className="sta4-panel">
          <div className="sta4-today-grid">
            <article className="sta4-card sta4-now"><small>اليوم</small><h2>{todayLessons.length ? `لديك ${todayLessons.length} ${todayLessons.length === 1 ? "حصة" : "حصص"}` : "لا توجد حصص منشورة لليوم"}</h2><p>{todayLessons.length ? `أول حصة: ${todayLessons[0].subjectLabel} — الحصة ${todayLessons[0].period}.` : "راجع ملاحظاتك أو تقدمك في المادة الحالية."}</p><div className="sta4-now-actions"><button type="button" className="primary" onClick={() => setActiveTab("schedule")}>افتح جدولي</button><button type="button" onClick={() => setActiveTab("progress")}>شاهد تقدمي</button><button type="button" onClick={() => setActiveTab("tests")}>اختباراتي</button></div></article>
            <article className="sta4-card sta4-note-now"><small>آخر ملاحظة</small><strong>{latestNote?.label || "لا توجد ملاحظات جديدة"}</strong><p>{latestNote ? `${latestNote.message || "متابعة تعليمية"} • ${latestNote.subjectLabel}` : "عندما يضيف المعلم ملاحظة ستظهر لك هنا مباشرة."}</p>{latestNote ? <button type="button" onClick={() => setActiveTab("notes")}>كل الملاحظات</button> : null}</article>
          </div>

          <div className="sta4-glance">
            <button type="button" onClick={() => setActiveTab("progress")}><small>متوسط موادي</small><strong>{overallAverage > 0 ? `${ar(overallAverage)}٪` : "—"}</strong><span>{statusLabel}</span></button>
            <article><small>الانضباط</small><strong>{ar(overallDiscipline)}٪</strong><span>من سجلات الحضور</span></article>
            <button type="button" onClick={() => setActiveTab("notes")}><small>ملاحظاتي</small><strong>{ar(allNotes.length)}</strong><span>من جميع المعلمين</span></button>
          </div>

          <section className="sta4-card"><div className="sta4-card-head"><div><small>حصصي اليوم</small><h2>{DAY_LABELS[todayKey] || "اليوم"}</h2></div><button type="button" onClick={() => setActiveTab("schedule")}>الأسبوع كامل</button></div>{todayLessons.length ? <div className="sta4-lessons-today">{todayLessons.map((lesson, index) => <div className="sta4-lesson-line" key={`${lesson.subjectKey}-${lesson.period}-${index}`}><span className="sta4-period">الحصة {lesson.period}</span><div><b>{lesson.subjectLabel}</b><span>{lesson.teacherName}</span></div><small>{lesson.notes || ""}</small></div>)}</div> : <div className="sta4-empty">لا توجد حصص منشورة لهذا اليوم.</div>}</section>
        </section>}

        {activeTab === "notes" && <section className="sta4-panel"><section className="sta4-card"><div className="sta4-card-head"><div><small>من معلميك مباشرة</small><h2>ملاحظاتي</h2></div><span>{allNotes.length} ملاحظة</span></div>{allNotes.length ? <div className="sta4-note-list">{allNotes.map((note, index) => <article className="sta4-note-item" key={note.id || index} style={{ "--note": note.color } as CSSProperties}><i/><div><b>{note.subjectLabel} • {note.label || "ملاحظة المعلم"}</b><p>{note.message || "متابعة تعليمية من المعلم."}</p></div><small>{noteDate(note.createdAt)}{note.teacher ? ` • ${note.teacher}` : ""}</small></article>)}</div> : <div className="sta4-empty">لا توجد ملاحظات مسجلة حاليًا.</div>}</section></section>}

        {activeTab === "progress" && <section className="sta4-panel">
          <div className="sta4-progress-layout">
            <section className="sta4-card"><div className="sta4-card-head"><div><small>تقدمي في المادة</small><h2>{selected.subjectLabel}</h2></div><strong>{selectedMetrics.percentage > 0 ? `${ar(selectedMetrics.percentage)}٪` : "—"}</strong></div><div className="sta4-timeline">{selectedMetrics.sections.length ? selectedMetrics.sections.map(section => <div className="sta4-timeline-row" key={section.label}><b>{section.label}</b><div className="sta4-track"><i style={{ "--p": `${Math.max(0, Math.min(100, section.percentage))}%` } as CSSProperties}/></div><span>{section.percentage > 0 ? `${ar(section.percentage)}٪` : "—"}</span></div>) : <div className="sta4-empty">بانتظار بدء رصد الدرجات.</div>}</div></section>
            <section className="sta4-card sta4-att"><div className="sta4-card-head"><div><small>حضوري في المادة</small><h2>الانضباط</h2></div></div><div className="sta4-att-top"><div className="sta4-att-ring" style={{ "--r": Math.max(0, Math.min(100, attendance.disciplineRate)) } as CSSProperties}><strong>{ar(attendance.disciplineRate)}٪</strong><span>انضباطي</span></div><div className="sta4-att-stats"><span><b>{ar(attendance.present)}</b>حضور</span><span><b>{ar(attendance.absent)}</b>غياب</span><span><b>{ar(attendance.late)}</b>تأخير</span><span><b>{ar(attendance.excused)}</b>استئذان</span></div></div></section>
          </div>

          <section className="sta4-card"><div className="sta4-card-head"><div><small>كل المواد</small><h2>أين أنا الآن؟</h2></div><span>{strongestSubject ? `الأقوى: ${strongestSubject.match.subjectLabel}` : "بانتظار الرصد"}</span></div><div className="sta4-subject-overview">{subjectScores.map(item => <article className="sta4-subject-card" key={item.match.subjectKey} style={{ "--card": item.theme.primary } as CSSProperties}><div className="sta4-subject-card-head"><span className="sta4-subject-icon" style={{ "--subject": item.theme.primary } as CSSProperties}><SubjectMark subjectKey={item.match.subjectKey}/></span><span className="sta4-pct">{item.metrics.percentage > 0 ? `${ar(item.metrics.percentage)}٪` : "—"}</span></div><h3>{item.match.subjectLabel}</h3><p>{item.match.teacherName}</p><footer><span>اكتمال {ar(item.metrics.completion)}٪</span><span>{item.match.data.teacherNotes?.length || (item.match.data.teacherNote ? 1 : 0)} ملاحظات</span></footer></article>)}</div></section>

          <div className="sta4-today-grid"><article className="sta4-card sta4-now"><small>نقطة قوة</small><h2>{strongestSection?.label || "بانتظار الرصد"}</h2><p>{strongestSection ? `مستواك فيها ${ar(strongestSection.percentage)}٪.` : "تظهر بعد اكتمال أول مرحلة من الرصد."}</p></article><article className="sta4-card sta4-now"><small>الخطوة التالية</small><h2>{weakestSection?.label || supportSubject?.match.subjectLabel || "ابدأ من آخر درس"}</h2><p>{weakestSection ? `راجع هذه المرحلة أولًا؛ مستواك الحالي ${ar(weakestSection.percentage)}٪.` : "راجع ملاحظات المعلم ثم اختبر نفسك."}</p></article></div>
        </section>}

        {activeTab === "schedule" && <section className="sta4-panel"><section className="sta4-card"><div className="sta4-card-head"><div><small>من جداول معلميك</small><h2>جدولي الأسبوعي</h2></div><span>{allLessons.length} حصة منشورة</span></div>{allLessons.length ? <div className="sta4-week">{DAY_ORDER.map(day => <article className={`sta4-day ${day === todayKey ? "today" : ""}`} key={day}><header>{DAY_LABELS[day]}</header><div className="sta4-lessons">{allLessons.filter(lesson => lesson.dayKey === day).length ? allLessons.filter(lesson => lesson.dayKey === day).map((lesson, index) => <div className="sta4-lesson" key={`${lesson.subjectKey}-${lesson.period}-${index}`} style={{ "--lesson": lesson.color } as CSSProperties}><b>{lesson.subjectLabel}</b><span>الحصة {lesson.period} • {lesson.teacherName}</span>{lesson.notes ? <small>{lesson.notes}</small> : null}</div>) : <div className="sta4-empty">لا توجد حصة</div>}</div></article>)}</div> : <div className="sta4-empty">لم ينشر المعلمون جدول هذا الفصل بعد.</div>}</section></section>}

        {activeTab === "tests" && <section className="sta4-panel"><section className="sta4-card"><div className="sta4-card-head"><div><small>{selected.subjectLabel}</small><h2>اختباراتي</h2></div><span>{selected.teacherName}</span></div><div className="sta4-tests"><StudentDiagnostics accessToken={selected.accessToken}/></div></section></section>}

        {activeTab === "report" && <section className="sta4-panel">
          <section className="sta4-report-hero"><div><small>تقريري الشامل</small><h2>بيان تقدمي الأكاديمي</h2><p>التحصيل والانضباط وملاحظات المعلمين في PDF واضح يشبه بيان الطالب.</p></div><button type="button" className={printing ? "sta4-printing" : ""} disabled={printing} onClick={() => void downloadReport()}>{printing ? "جارٍ تجهيز PDF…" : "تحميل بيان التقدم PDF"}</button></section>
          {reportMessage ? <div className="sta4-card sta4-now"><p>{reportMessage}</p></div> : null}
          <div className="sta4-report-grid"><article><small>متوسط التحصيل</small><strong>{overallAverage > 0 ? `${ar(overallAverage)}٪` : "—"}</strong></article><article><small>متوسط الانضباط</small><strong>{ar(overallDiscipline)}٪</strong></article><article><small>المستوى العام</small><strong>{statusLabel}</strong></article></div>
          <section className="sta4-card"><div className="sta4-card-head"><div><small>ملخص المواد</small><h2>تقدمي العام</h2></div><span>{matches.length} مواد</span></div><div className="sta4-report-table"><table><thead><tr><th>المادة</th><th>المعلم</th><th>التحصيل</th><th>الانضباط</th><th>الملاحظات</th></tr></thead><tbody>{subjectScores.map(item => <tr key={item.match.subjectKey}><td>{item.match.subjectLabel}</td><td>{item.match.teacherName}</td><td>{item.metrics.percentage > 0 ? `${ar(item.metrics.percentage)}٪` : "—"}</td><td>{ar(item.match.data.attendanceSummary?.disciplineRate ?? 100)}٪</td><td>{item.match.data.teacherNotes?.length || (item.match.data.teacherNote ? 1 : 0)}</td></tr>)}</tbody></table></div></section>
          <div className="sta4-today-grid"><article className="sta4-card sta4-now"><small>أقوى مادة</small><h2>{strongestSubject?.match.subjectLabel || "بانتظار الرصد"}</h2><p>{strongestSubject ? `${ar(strongestSubject.metrics.percentage)}٪ — حافظ على هذا المستوى.` : "ستظهر بعد بدء رصد الدرجات."}</p></article><article className="sta4-card sta4-now"><small>أحتاج تركيزًا هنا</small><h2>{supportSubject?.match.subjectLabel || "لا توجد أولوية محددة"}</h2><p>{supportSubject ? `${ar(supportSubject.metrics.percentage)}٪ — راجع ملاحظات المعلم وتقدم المادة.` : "ابدأ من المادة الحالية."}</p></article></div>
        </section>}
      </section>
    </div>
  </main>;
}
