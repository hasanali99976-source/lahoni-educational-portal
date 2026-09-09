"use client";

import { FormEvent, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ACADEMIC_UNITS, FINAL_MAX, RESEARCH_MAX, UNIT_MAX, calculatePercentage, calculateUnitTotal } from "../../lib/academic-config";
import { calculateGradePlanResult, normalizeGradePlan, type GradePlan, type GradeValueMap } from "../../lib/grade-plan";
import { downloadStudentProgressPdf } from "../../lib/student-progress-pdf";
import StudentDiagnostics from "./student-diagnostics";
import "./student-diagnostics.css";
import "./student-portal-v1000.css";

type UnitRecord = { total?: number; attendance?: number; participation?: number; homework?: number; unitExam?: number; exam1?: number; exam2?: number };
type AttendanceSummary = { present: number; absent: number; late: number; excused: number; escaped: number; total: number; disciplineRate: number; latestDate?: string };
type TeacherNoteEntry = { id?: string; type?: string; label?: string; message?: string; createdAt?: string; teacherName?: string; subject?: string };
type TimetableLesson = { dayKey: string; dayLabel: string; dayIndex: number; period: number; className: string; subject: string; notes: string };
type GradeDeduction = { id?: string; planId?: string; scope?: "plan" | "section" | "item"; sectionId?: string; itemId?: string; amount?: number; reversedAt?: string };
type StudentRecord = {
  gradePlan?: GradePlan | null;
  gradeValues?: GradeValueMap;
  gradePlanValues?: Record<string, GradeValueMap>;
  gradeDeductions?: GradeDeduction[];
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
type StudentTab = "home" | "progress" | "notes" | "schedule" | "tests" | "report";
type SubjectTheme = { primary: string; deep: string; soft: string; eyebrow: string; title: string };
type AlertView = { id: string; tone: "urgent" | "info" | "note"; icon: string; title: string; text: string; meta: string };

const CODE_PATTERN = /^TH[123]\d{3}$/;
const STUDENT_CODE_EXAMPLE = "TH1234";
const PORTAL_LOGO = "/icons/lahooni-identity-320.jpg";
const LEARNING_ART = "/student/learning-scene.svg";
const DAY_ORDER = ["sunday", "monday", "tuesday", "wednesday", "thursday"];
const DAY_LABELS: Record<string, string> = { sunday: "الأحد", monday: "الاثنين", tuesday: "الثلاثاء", wednesday: "الأربعاء", thursday: "الخميس" };
const ar = (value: number) => new Intl.NumberFormat("ar-SA-u-nu-arab", { maximumFractionDigits: 1 }).format(Number.isFinite(value) ? value : 0);

const tabs: Array<{ key: StudentTab; label: string }> = [
  { key: "home", label: "مساحتي" },
  { key: "progress", label: "تقدمي" },
  { key: "notes", label: "المتابعات" },
  { key: "schedule", label: "الجدول" },
  { key: "tests", label: "الاختبارات" },
  { key: "report", label: "التقرير" },
];

function normalizeStudentCode(value: string) {
  return value
    .replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

function subjectTheme(subjectKey: string, subjectLabel: string): SubjectTheme {
  const key = subjectKey.split("--")[0];
  if (["history", "geography", "social-studies", "social-sciences", "citizenship"].includes(key)) return { primary: "#9a6a2b", deep: "#593d24", soft: "#f7f0e4", eyebrow: "التاريخ والوعي", title: "اربط الحدث بسببه ونتيجته، وابنِ فهمك خطوة بخطوة" };
  if (key === "critical-thinking") return { primary: "#7158c6", deep: "#433679", soft: "#f0edfb", eyebrow: "التحليل والاستدلال", title: "حلّل الأدلة، اختبر الفكرة، ثم ابنِ حكمك بوعي" };
  if (["mathematics", "financial-literacy"].includes(key)) return { primary: "#2d72d4", deep: "#174b8c", soft: "#edf4ff", eyebrow: "الحل والتطبيق", title: "قسّم المسألة إلى خطوات صغيرة وواضحة حتى تصل للحل" };
  if (["science", "physics", "chemistry", "biology", "earth-science", "environmental-science"].includes(key)) return { primary: "#138b79", deep: "#0b5a55", soft: "#eaf7f3", eyebrow: "الاستكشاف العلمي", title: "لاحظ، جرّب، قارن ثم فسّر ما يحدث حولك" };
  if (["arabic", "linguistic-competencies"].includes(key)) return { primary: "#a54e61", deep: "#6d3041", soft: "#fbf0f3", eyebrow: "اللغة والتعبير", title: "اقرأ بفهم، استخرج المعنى، وعبّر بثقة" };
  if (key === "english") return { primary: "#4266b2", deep: "#2a4379", soft: "#eef2fb", eyebrow: "Learning & Communication", title: "Read, practise, and communicate with confidence" };
  if (["islamic-studies", "quran", "quran-tafsir", "tafsir", "hadith", "fiqh", "tawhid"].includes(key)) return { primary: "#2c825a", deep: "#1b513b", soft: "#edf7f1", eyebrow: "العلم والقيم", title: "افهم المعرفة واربطها بالسلوك اليومي" };
  if (["digital-technology", "computer-science"].includes(key)) return { primary: "#278da7", deep: "#185b72", soft: "#eaf7fa", eyebrow: "المهارات الرقمية", title: "تعلّم، طبّق، وابنِ حلًا رقميًا عمليًا" };
  return { primary: "#0b7f78", deep: "#153d50", soft: "#eaf6f4", eyebrow: "مسار التحصيل", title: `تعلّم ${subjectLabel} بطريقة واضحة ومرتبة` };
}

function SubjectMark({ subjectKey }: { subjectKey: string }) {
  const key = subjectKey.split("--")[0];
  const common = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (["history", "geography", "social-studies", "social-sciences", "citizenship"].includes(key)) return <svg {...common}><path d="M3 21h18M5 18h14M6 8h12M8 8v10M12 8v10M16 8v10M4 8l8-5 8 5"/></svg>;
  if (key === "critical-thinking") return <svg {...common}><path d="M9 18h6M10 22h4M8 14.5A6 6 0 1 1 16 14.5c-1 .8-1.5 1.7-1.5 2.5h-5c0-.8-.5-1.7-1.5-2.5Z"/><path d="m9.5 10.5 1.5 1.5 3.5-4"/></svg>;
  if (["mathematics", "financial-literacy"].includes(key)) return <svg {...common}><path d="M4 5h16M12 3v4M5 12h6M8 9v6M14 10l6 6M20 10l-6 6M4 20h16"/></svg>;
  if (["science", "physics", "chemistry", "biology", "earth-science", "environmental-science"].includes(key)) return <svg {...common}><path d="M9 3h6M10 3v5l-5 9a3 3 0 0 0 2.6 4.5h8.8A3 3 0 0 0 19 17l-5-9V3"/><path d="M8 15h8M9.5 12h5"/></svg>;
  if (["digital-technology", "computer-science"].includes(key)) return <svg {...common}><rect x="4" y="4" width="16" height="12" rx="2"/><path d="M8 20h8M12 16v4M8 9h3M13 9h3"/></svg>;
  return <svg {...common}><path d="M4 5.5A4.5 4.5 0 0 1 8.5 4H12v16H8.5A4.5 4.5 0 0 0 4 21.5v-16ZM20 5.5A4.5 4.5 0 0 0 15.5 4H12v16h3.5a4.5 4.5 0 0 1 4.5 1.5v-16Z"/></svg>;
}

function TabIcon({ tab }: { tab: StudentTab }) {
  const common = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (tab === "home") return <svg {...common}><path d="m3 11 9-8 9 8v9H3v-9Z"/><path d="M9 20v-6h6v6"/></svg>;
  if (tab === "progress") return <svg {...common}><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/><path d="m4 8 6-4 6 5 5-4"/></svg>;
  if (tab === "notes") return <svg {...common}><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/></svg>;
  if (tab === "schedule") return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></svg>;
  if (tab === "tests") return <svg {...common}><path d="M6 3h12v18H6zM9 8h6M9 12h3M9 16h6"/><path d="m14 12 1 1 2-2"/></svg>;
  return <svg {...common}><path d="M4 20V4h16v16H4Z"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>;
}

function activeDeductions(match: Match, plan: GradePlan) {
  return (Array.isArray(match.data.gradeDeductions) ? match.data.gradeDeductions : []).filter(item => !item.reversedAt && (!item.planId || item.planId === plan.id));
}
function deductionTotal(items: GradeDeduction[]) { return Number(items.reduce((sum, item) => sum + Math.max(0, Number(item.amount || 0)), 0).toFixed(2)); }

function metricsFor(match: Match) {
  const plan = normalizeGradePlan(match.data.gradePlan);
  if (plan) {
    const result = calculateGradePlanResult(plan, match.data || {});
    const deductions = activeDeductions(match, plan);
    const deducted = deductionTotal(deductions);
    const total = Math.max(0, Number((result.earned - deducted).toFixed(2)));
    return {
      percentage: result.maximum ? Math.round((total / result.maximum) * 100) : 0,
      total,
      completion: result.completion || 0,
      deducted,
      sections: result.sections.map(section => {
        const sectionDeducted = deductionTotal(deductions.filter(item => item.sectionId === section.id));
        const earned = Math.max(0, Number((section.earned - sectionDeducted).toFixed(2)));
        return { label: section.label, earned, max: section.maximum, percentage: section.maximum ? Math.round(earned / section.maximum * 100) : 0 };
      }),
    };
  }
  const sections = ACADEMIC_UNITS.map(unit => {
    const row = match.data.units?.[unit.key] || {};
    const attendance = Number(row.attendance || 0), participation = Number(row.participation || 0), homework = Number(row.homework || 0), unitExam = Number(row.unitExam ?? row.exam1 ?? row.exam2 ?? 0);
    const earned = Math.min(UNIT_MAX, Number(row.total ?? calculateUnitTotal({ attendance, participation, homework, unitExam })));
    return { label: unit.label, earned, max: UNIT_MAX, percentage: Math.round(earned / Math.max(UNIT_MAX, 1) * 100) };
  });
  const research = Math.min(RESEARCH_MAX, Number(match.data.researchScore ?? match.data.research ?? 0));
  const total = Math.min(FINAL_MAX, sections.reduce((sum, item) => sum + item.earned, 0) + research);
  return { percentage: calculatePercentage(total, FINAL_MAX), total, completion: calculatePercentage(total, FINAL_MAX), deducted: 0, sections };
}
function noteDate(value?: string) { if (!value) return ""; const d = new Date(value); return Number.isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat("ar-SA", { day: "numeric", month: "short" }).format(d); }
function riyadhDayKey() { return new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "Asia/Riyadh" }).format(new Date()).toLowerCase(); }

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
    } catch { return match; }
  }
  async function lookup(codeValue: string) {
    const code = normalizeStudentCode(codeValue); setMessage(""); setMatches([]); setSelected(null);
    if (!CODE_PATTERN.test(code)) return setMessage(`أدخل كودًا صحيحًا مثل ${STUDENT_CODE_EXAMPLE}.`);
    setLoading(true);
    try {
      const response = await fetch("/api/student/lookup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accessCode: code }), cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return setMessage(payload.message || "كود الدخول غير صحيح، أو لم تُربط لك مادة بعد.");
      const raw = Array.isArray(payload.matches) ? payload.matches as Match[] : [];
      if (!raw.length) return setMessage("لم تُربط مواد الطالب بالمعلمين بعد.");
      const enriched = await Promise.all(raw.map(hydrateMatch));
      setMatches(enriched); setSelected(null); setActiveTab("home");
    } catch { setMessage("تعذر الوصول إلى بيانات الطالب الآن. حاول مرة أخرى."); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    const query = new URLSearchParams(window.location.search); const code = normalizeStudentCode(query.get("code") || "");
    if (code) setAccessCode(code); if (query.size) window.history.replaceState({}, "", "/student");
    if (CODE_PATTERN.test(code) && !automaticLoginStarted.current) { automaticLoginStarted.current = true; void lookup(code); }
  }, []);
  useEffect(() => {
    if (!selected?.accessToken) return; let active = true; let refreshing = false;
    const refresh = async () => { if (!active || refreshing || document.visibilityState !== "visible") return; refreshing = true; try { const updated = await hydrateMatch(selected); if (!active) return; setSelected(current => current?.subjectKey === updated.subjectKey ? updated : current); setMatches(current => current.map(item => item.subjectKey === updated.subjectKey ? updated : item)); } finally { refreshing = false; } };
    const onFocus = () => void refresh(); const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", onFocus); document.addEventListener("visibilitychange", onVisible);
    return () => { active = false; window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onVisible); };
  }, [selected?.accessToken]);

  const subjectScores = useMemo(() => matches.map(match => ({ match, metrics: metricsFor(match), theme: subjectTheme(match.subjectKey, match.subjectLabel) })), [matches]);
  const graded = subjectScores.filter(item => item.metrics.completion > 0 || item.metrics.percentage > 0);
  const overallAverage = graded.length ? Math.round(graded.reduce((sum, item) => sum + item.metrics.percentage, 0) / graded.length) : 0;
  const overallDiscipline = subjectScores.length ? Math.round(subjectScores.reduce((sum, item) => sum + (item.match.data.attendanceSummary?.disciplineRate ?? 100), 0) / subjectScores.length) : 100;
  const allNotes = useMemo(() => matches.flatMap(match => {
    const direct = (match.data.teacherNotes || []).map((note, index) => ({ ...note, id: note.id || `${match.subjectKey}-${index}`, subjectLabel: match.subjectLabel, teacher: note.teacherName || match.teacherName }));
    if (!direct.length && match.data.teacherNote) direct.push({ id: `${match.subjectKey}-legacy`, label: "ملاحظة المعلم", message: match.data.teacherNote, createdAt: "", subjectLabel: match.subjectLabel, teacher: match.teacherName });
    return direct;
  }).sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||""))), [matches]);
  const allLessons = useMemo(() => matches.flatMap(match => (match.data.timetableLessons || []).map(lesson => ({ ...lesson, subjectKey: match.subjectKey, subjectLabel: match.subjectLabel, teacherName: match.teacherName }))).sort((a,b)=>a.dayIndex-b.dayIndex||a.period-b.period), [matches]);

  function submit(event: FormEvent) { event.preventDefault(); void lookup(accessCode); }
  function exitStudentPortal() { setSelected(null); setMatches([]); setAccessCode(""); setMessage(""); setActiveTab("home"); window.location.replace(`/student?logout=${Date.now()}`); }

  if (!selected && matches.length) {
    const name = matches[0]?.data.name?.trim() || "الطالب", className = matches[0]?.data.class?.trim() || "الفصل غير محدد";
    return <main className="student-v1000 sv10-chooser" dir="rtl"><div className="sv10-chooser-shell">
      <header className="sv10-chooser-head"><div><small>مساحتك التعليمية</small><h1>مرحبًا {name}</h1><p>{className} — اختر المادة لتفتح مساحة مستقلة خاصة بها.</p></div><button onClick={exitStudentPortal}>تسجيل الخروج</button></header>
      <div className="sv10-chooser-grid">{subjectScores.map(item => <button key={item.match.subjectKey} className="sv10-chooser-card" style={{"--sub":item.theme.primary} as CSSProperties} onClick={()=>{setSelected(item.match);setActiveTab("home");window.scrollTo({top:0})}}><span className="ico"><SubjectMark subjectKey={item.match.subjectKey}/></span><h2>{item.match.subjectLabel}</h2><p>{item.match.teacherName}</p><footer><span>{item.metrics.percentage>0?`التحصيل ${ar(item.metrics.percentage)}٪`:"بانتظار الرصد"}</span><span>{item.match.data.teacherNotes?.length || (item.match.data.teacherNote?1:0)} متابعة</span></footer></button>)}</div>
    </div></main>;
  }

  if (!selected) return <main className="student-v1000 sv10-gateway" dir="rtl"><section className="sv10-gate-shell"><div className="sv10-gate-form"><div className="sv10-brand"><img src={PORTAL_LOGO} alt="هوية البوابة"/><div><b>بوابة أستاذ لحوني التعليمية</b><small>مساحة الطالب وولي الأمر</small></div></div><small style={{color:"#0b7f78",fontWeight:900,fontSize:10}}>تعلم • متابعة • تقدم</small><h1>ادخل لمساحتك التعليمية</h1><p>كل مادة لها مساحة مستقلة تعرض معلمك، تقدمك، متابعاتك، حضورك واختباراتك بوضوح.</p><form onSubmit={submit}><label>كود الطالب</label><div className="sv10-input"><span>TH</span><input dir="ltr" value={accessCode} onChange={e=>setAccessCode(normalizeStudentCode(e.target.value))} placeholder={STUDENT_CODE_EXAMPLE} maxLength={6} autoFocus/></div>{message?<p className="sv10-error">{message}</p>:null}<button className="sv10-submit" disabled={loading}>{loading?"جارٍ فتح المساحة…":"دخول البوابة"}</button></form></div><div className="sv10-gate-art"><img src={LEARNING_ART} alt="مشهد تعليمي"/></div></section></main>;

  const theme = subjectTheme(selected.subjectKey, selected.subjectLabel), metrics = metricsFor(selected), studentName = selected.data.name?.trim() || "الطالب", classLabel = selected.data.class?.trim() || "الفصل غير محدد", attendance = selected.data.attendanceSummary || {present:0,absent:0,late:0,excused:0,escaped:0,total:0,disciplineRate:100};
  const currentNotes = (selected.data.teacherNotes || []).map((note,index)=>({...note,id:note.id||String(index)})); if (!currentNotes.length && selected.data.teacherNote) currentNotes.push({id:"legacy",label:"ملاحظة المعلم",message:selected.data.teacherNote,createdAt:""});
  const counselor = selected.data.parentCounselorLastNotice;
  const plan = normalizeGradePlan(selected.data.gradePlan); const deductions = plan ? activeDeductions(selected, plan) : []; const deduction = deductionTotal(deductions);
  const alerts: AlertView[] = [];
  if (counselor?.title || counselor?.message) alerts.push({id:"counselor",tone:"urgent",icon:"!",title:counselor.title||"متابعة من المرشد الطلابي",text:counselor.message||"لديك متابعة مسجلة لدى المرشد الطلابي.",meta:"متابعة مهمة"});
  if (deduction>0) alerts.push({id:"deduction",tone:"urgent",icon:"−",title:`يوجد خصم ${ar(deduction)} درجة`,text:"راجع تبويب تقدمي لمعرفة أثر الخصم على درجتك الحالية.",meta:selected.subjectLabel});
  if (currentNotes[0]) alerts.push({id:"note",tone:"note",icon:"✦",title:currentNotes[0].label||"آخر ملاحظة من المعلم",text:currentNotes[0].message||"لديك متابعة جديدة من معلم المادة.",meta:noteDate(currentNotes[0].createdAt)});
  if (!alerts.length) alerts.push({id:"clear",tone:"info",icon:"✓",title:"لا توجد متابعات تحتاج إجراء الآن",text:"استمر في متابعة تقدمك وجدولك واختباراتك من هذه المساحة.",meta:"حالتك محدثة"});
  const todayKey = riyadhDayKey(), todayLessons = allLessons.filter(l=>l.dayKey===todayKey);
  const style = {"--brand":theme.primary,"--deep":theme.deep,"--soft":theme.soft} as CSSProperties;
  const statusLabel = overallAverage>=90?"متميز":overallAverage>=80?"متقدم":overallAverage>=70?"جيد":overallAverage>0?"يحتاج تركيزًا":"بانتظار الرصد";

  async function downloadReport() {
    if (printing) return; setPrinting(true); setReportMessage("");
    try { await downloadStudentProgressPdf({ portalName:"بوابة أستاذ لحوني التعليمية", studentName, className:classLabel, studentCode:selected.id, overallAverage, overallDiscipline, statusLabel, subjects:subjectScores.map(i=>({subject:i.match.subjectLabel,teacher:i.match.teacherName,percentage:i.metrics.percentage,discipline:i.match.data.attendanceSummary?.disciplineRate??100,noteCount:i.match.data.teacherNotes?.length||(i.match.data.teacherNote?1:0),accent:i.theme.primary})), notes:allNotes.slice(0,6).map(n=>({subject:n.subjectLabel,text:n.message||n.label||"متابعة تعليمية",teacher:n.teacher,date:noteDate(n.createdAt)})), fileName:`بيان-تقدم-${studentName.replace(/\s+/g,"-")}.pdf` }); setReportMessage("تم تجهيز التقرير بنجاح."); }
    catch { setReportMessage("تعذر تجهيز التقرير الآن."); } finally { setPrinting(false); }
  }

  return <main className="student-v1000" style={style} dir="rtl"><div className="sv10-wrap">
    <header className="sv10-topbar"><div className="sv10-brand"><img src={PORTAL_LOGO} alt="هوية البوابة"/><div><b>أستاذ لحوني</b><small>بوابة الطالب التعليمية</small></div></div><nav className="sv10-nav">{tabs.map(tab=><button key={tab.key} className={activeTab===tab.key?"active":""} onClick={()=>{setActiveTab(tab.key);window.scrollTo({top:0,behavior:"smooth"})}}><TabIcon tab={tab.key}/><span>{tab.label}</span></button>)}</nav><div className="sv10-actions"><button onClick={()=>{setSelected(null);setActiveTab("home")}}>المواد</button><button className="primary" onClick={()=>setActiveTab("report")}>تقريري</button><button onClick={exitStudentPortal}>خروج</button></div></header>
    <div className="sv10-studentbar"><div className="sv10-student"><span className="sv10-avatar">{studentName.charAt(0)}</span><div><b>{studentName}</b><small>{classLabel} • بيانات مباشرة من معلميك</small></div></div><code className="sv10-code">{selected.id}</code></div>
    <div className="sv10-subjectrail">{subjectScores.map(item=><button key={item.match.subjectKey} className={selected.subjectKey===item.match.subjectKey?"active":""} style={{"--sub":item.theme.primary} as CSSProperties} onClick={()=>{setSelected(item.match);setActiveTab("home")}}><span className="ico"><SubjectMark subjectKey={item.match.subjectKey}/></span><span><b>{item.match.subjectLabel}</b><small>{item.metrics.percentage>0?`${ar(item.metrics.percentage)}٪`:`${item.match.teacherName}`}</small></span></button>)}</div>
    <section className="sv10-hero" style={{"--sub":theme.primary} as CSSProperties}><div className="sv10-hero-copy"><span className="sv10-eyebrow">{theme.eyebrow}</span><h1>{selected.subjectLabel}</h1><p>{theme.title}. هذه الصفحة تعرض فقط بيانات هذه المادة لتبقى تجربتك واضحة بدون تكرار أو تشتيت.</p><div className="sv10-meta"><span>{selected.teacherName}</span><span>{classLabel}</span><span>اكتمال الرصد {ar(metrics.completion)}٪</span>{deduction>0?<span>خصم {ar(deduction)}</span>:null}</div></div><div className="sv10-hero-visual"><img src={LEARNING_ART} alt="مشهد تعليمي"/><div className="sv10-score"><div><strong>{metrics.percentage>0?`${ar(metrics.percentage)}٪`:"—"}</strong><span>مستواي الآن</span></div></div></div></section>

    {activeTab==="home"&&<div className="sv10-grid"><section className="sv10-sections"><div className="sv10-today"><article className="sv10-dayhero"><small>لوحة اليوم</small><h2>{todayLessons.length?`لديك ${todayLessons.length} ${todayLessons.length===1?"حصة":"حصص"} اليوم`:"ابدأ من أهم ما لديك"}</h2><p>{todayLessons.length?`أول حصة منشورة اليوم: ${todayLessons[0].subjectLabel} — الحصة ${todayLessons[0].period}.`:"راجع التنبيهات ثم انتقل لتقدمك أو اختباراتك."}</p><div className="sv10-quick"><button onClick={()=>setActiveTab("schedule")}>جدولي اليوم</button><button onClick={()=>setActiveTab("progress")}>تقدمي</button><button onClick={()=>setActiveTab("tests")}>اختباراتي</button></div></article><div className="sv10-glance"><button className="sv10-metric click" onClick={()=>setActiveTab("progress")}><small>تحصيلي</small><strong>{metrics.percentage>0?`${ar(metrics.percentage)}٪`:"—"}</strong><span>{metrics.percentage>=90?"متميز":metrics.percentage>=80?"متقدم":metrics.percentage>0?"واصل التحسن":"بانتظار الرصد"}</span></button><div className="sv10-metric"><small>انضباطي</small><strong>{ar(attendance.disciplineRate)}٪</strong><span>في هذه المادة</span></div><button className="sv10-metric click" onClick={()=>setActiveTab("notes")}><small>المتابعات</small><strong>{ar(currentNotes.length+(counselor?1:0))}</strong><span>ملاحظات وإرشاد</span></button><button className="sv10-metric click" onClick={()=>setActiveTab("tests")}><small>الاختبارات</small><strong>فتح</strong><span>تدريب وتشخيص</span></button></div></div><section className="sv10-card"><header className="sv10-card-head"><div><small>حصص اليوم</small><h2>{DAY_LABELS[todayKey]||"اليوم"}</h2></div><span>{todayLessons.length} منشورة</span></header><div className="sv10-card-body sv10-lessons">{todayLessons.length?todayLessons.map((lesson,index)=><div className="sv10-lesson" key={`${lesson.subjectKey}-${lesson.period}-${index}`}><span className="sv10-period">الحصة {lesson.period}</span><div><b>{lesson.subjectLabel}</b><span>{lesson.teacherName}</span></div><small>{lesson.notes||""}</small></div>):<div className="sv10-empty">لا توجد حصص منشورة لهذا اليوم.</div>}</div></section></section><aside className="sv10-card"><header className="sv10-card-head"><div><small>مركز المتابعة</small><h2>تنبيهاتك الآن</h2></div><span>{alerts.length}</span></header><div className="sv10-card-body sv10-alerts">{alerts.map(alert=><article key={alert.id} className={`sv10-alert ${alert.tone}`}><span className="sv10-alert-icon">{alert.icon}</span><div><b>{alert.title}</b><p>{alert.text}</p></div><small>{alert.meta}</small></article>)}</div></aside></div>}

    {activeTab==="progress"&&<div className="sv10-grid"><section className="sv10-card"><header className="sv10-card-head"><div><small>رحلة التحصيل</small><h2>تقدمي في {selected.subjectLabel}</h2></div><span>{metrics.percentage>0?`${ar(metrics.percentage)}٪`:"بانتظار الرصد"}</span></header><div className="sv10-card-body sv10-progress">{metrics.sections.length?metrics.sections.map(section=><div className="sv10-progress-row" key={section.label}><b>{section.label}</b><div className="sv10-track"><i style={{"--p":`${Math.max(0,Math.min(100,section.percentage))}%`} as CSSProperties}/></div><span>{section.percentage>0?`${ar(section.percentage)}٪`:"—"}</span></div>):<div className="sv10-empty">لم يبدأ رصد الدرجات بعد.</div>}</div></section><section className="sv10-card"><header className="sv10-card-head"><div><small>الحضور والانضباط</small><h2>انضباطي</h2></div></header><div className="sv10-card-body sv10-att"><div className="sv10-ring" style={{"--r":Math.max(0,Math.min(100,attendance.disciplineRate))} as CSSProperties}><div><strong>{ar(attendance.disciplineRate)}٪</strong><span>الانضباط</span></div></div><div className="sv10-attstats"><span><b>{ar(attendance.present)}</b>حضور</span><span><b>{ar(attendance.absent)}</b>غياب</span><span><b>{ar(attendance.late)}</b>تأخير</span><span><b>{ar(attendance.excused)}</b>استئذان</span></div></div></section></div>}

    {activeTab==="notes"&&<section className="sv10-card" style={{marginTop:12}}><header className="sv10-card-head"><div><small>من المعلم والمرشد</small><h2>المتابعات الخاصة بالمادة</h2></div><span>{currentNotes.length+(counselor?1:0)}</span></header><div className="sv10-card-body sv10-notelist">{counselor?<article className="sv10-note"><header><b>{counselor.title||"متابعة المرشد الطلابي"}</b><small>المرشد الطلابي</small></header><p>{counselor.message||"متابعة إرشادية مسجلة."}</p></article>:null}{currentNotes.length?currentNotes.map((note,index)=><article className="sv10-note" key={note.id||index}><header><b>{note.label||"ملاحظة المعلم"}</b><small>{noteDate(note.createdAt)}</small></header><p>{note.message||"متابعة تعليمية من معلم المادة."}</p></article>):!counselor?<div className="sv10-empty">لا توجد متابعات مسجلة حاليًا.</div>:null}</div></section>}

    {activeTab==="schedule"&&<section className="sv10-card" style={{marginTop:12}}><header className="sv10-card-head"><div><small>الأسبوع الدراسي</small><h2>جدولي</h2></div><span>{allLessons.length} حصة منشورة</span></header><div className="sv10-card-body"><div className="sv10-week">{DAY_ORDER.map(day=><article className={`sv10-day ${day===todayKey?"today":""}`} key={day}><header>{DAY_LABELS[day]}</header><div className="sv10-daylist">{allLessons.filter(l=>l.dayKey===day).length?allLessons.filter(l=>l.dayKey===day).map((lesson,index)=><div className="sv10-daylesson" key={`${lesson.subjectKey}-${lesson.period}-${index}`}><b>{lesson.subjectLabel}</b><span>الحصة {lesson.period} • {lesson.teacherName}</span></div>):<div className="sv10-empty">لا توجد حصة</div>}</div></article>)}</div></div></section>}

    {activeTab==="tests"&&<section className="sv10-card" style={{marginTop:12}}><header className="sv10-card-head"><div><small>{selected.subjectLabel}</small><h2>اختباراتي وتدريباتي</h2></div><span>{selected.teacherName}</span></header><div className="sv10-card-body"><StudentDiagnostics accessToken={selected.accessToken}/></div></section>}

    {activeTab==="report"&&<div className="sv10-sections" style={{marginTop:12}}><section className="sv10-report-action"><div><h2>تقريري الأكاديمي</h2><p>ملخص التحصيل والانضباط والمتابعات من جميع المواد في ملف PDF واحد.</p></div><button disabled={printing} onClick={()=>void downloadReport()}>{printing?"جارٍ التجهيز…":"تحميل التقرير PDF"}</button></section>{reportMessage?<div className="sv10-card"><div className="sv10-card-body">{reportMessage}</div></div>:null}<div className="sv10-report-grid"><article className="sv10-report-metric"><small>متوسط التحصيل</small><strong>{overallAverage>0?`${ar(overallAverage)}٪`:"—"}</strong></article><article className="sv10-report-metric"><small>متوسط الانضباط</small><strong>{ar(overallDiscipline)}٪</strong></article><article className="sv10-report-metric"><small>المستوى العام</small><strong>{statusLabel}</strong></article></div></div>}
  </div></main>;
}
