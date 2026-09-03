"use client";

import { FormEvent, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ACADEMIC_UNITS, FINAL_MAX, GRADE_DISTRIBUTION, RESEARCH_MAX, UNIT_MAX, calculatePercentage, calculateUnitTotal } from "../../lib/academic-config";
import { calculateGradePlanResult, normalizeGradePlan, type GradePlan, type GradeValueMap } from "../../lib/grade-plan";
import "./student-diagnostics.css";
import "./student-portal-tabs.css";
import "./attendance-summary.css";
import "./student-report-v105.css";
import StudentDiagnostics from "./student-diagnostics";
import StudentKeyboardScroll from "./student-keyboard-scroll";

type UnitRecord = { total?: number; attendance?: number; participation?: number; homework?: number; unitExam?: number; exam1?: number; exam2?: number };
type AttendanceSummary = { present: number; absent: number; late: number; excused: number; escaped: number; total: number; disciplineRate: number; latestDate?: string };
type TeacherNoteEntry = { id?: string; type?: string; label?: string; message?: string; createdAt?: string; teacherName?: string; subject?: string; visibleToParent?: boolean };
type StudentRecord = { gradePlan?: GradePlan | null; gradeValues?: GradeValueMap; gradePlanValues?: Record<string, GradeValueMap>; name?: string; class?: string; accessCode?: string; teacherName?: string; research?: number; researchScore?: number; teacherNote?: string; teacherNoteCount?: number; teacherNoteCounts?: Record<string, number>; teacherNotes?: TeacherNoteEntry[]; absences?: number; late?: number; attendanceSummary?: AttendanceSummary; units?: Record<string, UnitRecord>; parentCounselorLastNotice?: { title?: string; message?: string } };
type Match = { id: string; teacherId: string; subjectKey: string; subjectLabel: string; teacherName: string; icon: string; accessToken: string; data: StudentRecord };
type StudentTab = "home" | "achievement" | "tests" | "attendance" | "notes" | "report" | "ai";

type SubjectKnowledgeProfile = {
  eyebrow: string;
  title: string;
  description: string;
  prompt: string;
};

const CODE_PATTERN = /^TH[123]\d{3}$/;
const STUDENT_CODE_EXAMPLE = "TH1234";
const ar = (value: number) => new Intl.NumberFormat("ar-SA-u-nu-arab", { maximumFractionDigits: 1 }).format(Number.isFinite(value) ? value : 0);
const encouragements = ["البداية ممكنة، ركّز على خطوة واحدة اليوم.","ابدأ بخطة قصيرة واطلب مساعدة معلمك.","كل مراجعة صغيرة ترفع مستواك.","رتّب وقتك وابدأ بالمهارة الأضعف.","أنت قادر على التحسن، استمر.","تقدمك بدأ يظهر، لا تتوقف.","راجع أخطاءك وحوّلها إلى نقاط قوة.","خطوة جميلة، واصل التدريب.","أداؤك يتحسن بثبات.","أنت قريب من المستوى الجيد.","عمل جيد، ركّز على التفاصيل.","ثباتك يصنع الفرق.","مستواك جيد وقابل للارتفاع سريعًا.","أحسنت، حافظ على انتظامك.","تقدم واضح، استمر على خطتك.","أداء قوي، بقيت لمسات بسيطة.","متميز، راجع بذكاء للمحافظة على مستواك.","قريب جدًا من القمة.","أداء رائع ومطمئن.","مبدع، واصل تميزك.","إنجاز استثنائي، أنت قدوة في الاجتهاد."];
const tabs: { key: StudentTab; icon: string; label: string; note: string }[] = [
  { key: "home", icon: "⌂", label: "ملخصي", note: "وضعي الآن" },
  { key: "achievement", icon: "◫", label: "تحصيلي", note: "درجاتي وتقدمي" },
  { key: "tests", icon: "✓", label: "اختباراتي", note: "المتاح ونتائجي" },
  { key: "attendance", icon: "◉", label: "حضوري", note: "الحضور والانضباط" },
  { key: "notes", icon: "✎", label: "ملاحظات المعلم", note: "الملاحظات والتواصل" },
  { key: "report", icon: "▤", label: "تقرير المادة", note: "تقرير شامل PDF" },
  { key: "ai", icon: "✦", label: "مساعدي", note: "تحليل وخطة" },
];

function subjectKnowledgeProfile(subjectKey: string, subjectLabel: string): SubjectKnowledgeProfile {
  const key = subjectKey.split("--")[0];
  if (["history", "geography", "social-studies", "social-sciences", "citizenship"].includes(key)) return { eyebrow: "بوابة المعرفة والوعي", title: `اكتشف ${subjectLabel} واربط المعرفة بالواقع`, description: "تتبّع فهمك للأحداث والمفاهيم، واربط الأسباب بالنتائج بخطوات واضحة.", prompt: "اسأل نفسك: ما الفكرة الأهم التي أستطيع شرحها اليوم؟" };
  if (key === "critical-thinking") return { eyebrow: "بوابة التحليل والاستدلال", title: "حلّل الأدلة وابنِ حكمك بوعي", description: "تابع مهاراتك في التحليل والاستنتاج واتخاذ القرار، ثم ركّز على المهارة الأقل إتقانًا.", prompt: "اسأل نفسك: ما الدليل؟ وما التفسير الأقوى؟" };
  if (["mathematics", "financial-literacy"].includes(key)) return { eyebrow: "بوابة الحل والتطبيق", title: `تقدّم في ${subjectLabel} خطوة بخطوة`, description: "حوّل كل مهارة إلى تدريب قصير، وراجع موضع الخطأ قبل الانتقال للمسألة التالية.", prompt: "ابدأ بمسألة واحدة، واكتب خطوات الحل بوضوح." };
  if (["science", "physics", "chemistry", "biology", "earth-science", "environmental-science"].includes(key)) return { eyebrow: "بوابة الاستكشاف العلمي", title: `استكشف ${subjectLabel} وافهم كيف يعمل العالم`, description: "اربط المفهوم بالملاحظة والتجربة، واستخدم نتائجك لتحديد ما يحتاج إلى مراجعة.", prompt: "ما الظاهرة التي أستطيع تفسيرها بما تعلمته؟" };
  if (["arabic", "linguistic-competencies"].includes(key)) return { eyebrow: "بوابة اللغة والتعبير", title: "اقرأ بفهم وعبّر بثقة", description: "تابع نموك في القراءة والكتابة والمهارات اللغوية، وابدأ من الجانب الأقل درجة.", prompt: "اكتب فكرة واحدة بأسلوب واضح ومترابط." };
  if (key === "english") return { eyebrow: "Learning & Communication", title: "Read, practise, and communicate with confidence", description: "Track your progress in reading, writing, vocabulary, and assessment tasks.", prompt: "Use one new word in a complete sentence today." };
  if (["digital-technology", "computer-science"].includes(key)) return { eyebrow: "بوابة المهارات الرقمية", title: "تعلّم، طبّق، وابنِ حلًا رقميًا", description: "تابع المهارات والمشروعات والاختبارات، وحوّل المعرفة إلى تطبيق عملي.", prompt: "ما الخطوة الرقمية التي أستطيع تنفيذها بنفسي؟" };
  if (["islamic-studies", "quran", "quran-tafsir", "tafsir", "hadith", "fiqh", "tawhid"].includes(key)) return { eyebrow: "بوابة العلم والقيم", title: `تعلّم ${subjectLabel} وافهم أثره في حياتك`, description: "تابع تحصيلك، واربط المعرفة بالقيم والسلوك والتطبيق اليومي.", prompt: "ما القيمة التي أستطيع تطبيقها اليوم؟" };
  if (["physical-education", "fitness-health", "health-education"].includes(key)) return { eyebrow: "بوابة الصحة والإنجاز", title: "تقدّم بوعي وحافظ على انتظامك", description: "تابع الأداء واللياقة والانضباط، واجعل هدفك اليومي واضحًا وقابلًا للقياس.", prompt: "اختر عادة صحية واحدة وحافظ عليها اليوم." };
  if (["art", "arts"].includes(key)) return { eyebrow: "بوابة الإبداع والتعبير", title: "حوّل فكرتك إلى عمل يعبر عنك", description: "تابع تقدمك في المهارات والمشروعات، واستفد من الملاحظات لتطوير عملك.", prompt: "جرّب فكرة جديدة وعدّلها بعد الملاحظة." };
  return { eyebrow: "بوابة التحصيل العلمي", title: `تعلّم ${subjectLabel} بثقة ووضوح`, description: "كل بياناتك التعليمية في مسار واحد: التحصيل والاختبارات والانضباط والتوجيه الذكي.", prompt: "ابدأ بالمهمة الأقرب لهدفك اليوم." };
}

function normalizeStudentCode(value: string) {
  return value.replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))).replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

function noteDate(value?: string) {
  if (!value) return "التاريخ غير مسجل";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ar-SA-u-ca-gregory", { weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(date);
}

export default function StudentPage() {
  const [accessCode, setAccessCode] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selected, setSelected] = useState<Match | null>(null);
  const [activeTab, setActiveTab] = useState<StudentTab>("home");
  const [goal, setGoal] = useState(90);
  const automaticLoginStarted = useRef(false);

  async function lookup(codeValue: string) {
    const code = normalizeStudentCode(codeValue);
    setMessage(""); setMatches([]); setSelected(null);
    if (!CODE_PATTERN.test(code)) { setMessage(`أدخل كودًا صحيحًا مثل ${STUDENT_CODE_EXAMPLE}.`); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/student/lookup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accessCode: code }), cache: "no-store" });
      const data = await response.json();
      if (!response.ok) { setMessage(data.message || "كود الدخول غير صحيح، أو لم تُربط لك مادة بعد."); return; }
      const nextMatches = Array.isArray(data.matches) ? data.matches : [];
      setMatches(nextMatches);
      if (nextMatches.length === 1) { setSelected(nextMatches[0]); setActiveTab("home"); }
    } catch { setMessage("تعذر الوصول إلى بيانات الطالب الآن. حاول مرة أخرى."); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const code = normalizeStudentCode(query.get("code") || "");
    if (code) setAccessCode(code);
    if (query.has("code") || query.has("entry") || query.has("v") || query.has("logout")) window.history.replaceState({}, "", "/student");
    if (CODE_PATTERN.test(code) && !automaticLoginStarted.current) { automaticLoginStarted.current = true; void lookup(code); }
  }, []);

  useEffect(() => {
    const token = selected?.accessToken;
    if (!token) return;
    let active = true; let inFlight = false; let lastRefresh = 0;
    const refresh = async (force = false) => {
      if (inFlight || (!force && Date.now() - lastRefresh < 7000)) return;
      inFlight = true;
      try {
        const response = await fetch("/api/student/profile", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        const payload = await response.json();
        if (active && response.ok) { lastRefresh = Date.now(); setSelected(current => current ? { ...current, data: payload.data } : current); }
      } catch {} finally { inFlight = false; }
    };
    const refreshWhenVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    let refreshTimer: number | null = null;
    const scheduleRefresh = () => {
      if (!active) return;
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(async () => { refreshTimer = null; if (document.visibilityState === "visible") await refresh(); scheduleRefresh(); }, 10000);
    };
    void refresh(true); scheduleRefresh();
    window.addEventListener("focus", refreshWhenVisible); document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => { active = false; if (refreshTimer !== null) window.clearTimeout(refreshTimer); window.removeEventListener("focus", refreshWhenVisible); document.removeEventListener("visibilitychange", refreshWhenVisible); };
  }, [selected?.accessToken]);

  function submit(event: FormEvent) { event.preventDefault(); void lookup(accessCode); }
  function showStudentSubjects() { setSelected(null); setActiveTab("home"); window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" })); }
  function exitStudentPortal() {
    setSelected(null); setMatches([]); setAccessCode(""); setMessage(""); setActiveTab("home");
    try { sessionStorage.removeItem("lahooni-student-active"); sessionStorage.removeItem("lahooni-student-session"); localStorage.removeItem("lahooni-student-last-path"); localStorage.removeItem("lahooni-student-active"); } catch {}
    window.location.replace(`/student?logout=${Date.now()}`);
  }

  const approvedPlan = useMemo(() => normalizeGradePlan(selected?.data.gradePlan), [selected?.data.gradePlan]);
  const studentDataForPlan = useMemo(() => {
    const data = selected?.data;
    if (!data || !approvedPlan) return data || {};
    const specificValues = data.gradePlanValues?.[approvedPlan.id];
    return { ...data, gradeValues: specificValues && typeof specificValues === "object" ? specificValues : (data.gradeValues || {}) };
  }, [selected?.data, approvedPlan?.id]);
  const planResult = useMemo(() => approvedPlan ? calculateGradePlanResult(approvedPlan, studentDataForPlan) : null, [approvedPlan, studentDataForPlan]);
  const units = useMemo(() => {
    if (approvedPlan && planResult) return planResult.sections.map(section => {
      const byCategory = Object.fromEntries(planResult.dimensions.map(item => [item.key, item]));
      const itemValue = (category: string) => section.items.filter(entry => entry.item.category === category).reduce((sum, entry) => sum + entry.counted, 0);
      return { key: section.id, label: section.label, examLabel: section.label, attendance: itemValue("attendance"), participation: itemValue("participation"), homework: itemValue("homework"), unitExam: itemValue("unitExam"), total: section.earned, max: section.maximum, items: section.items, byCategory };
    });
    return ACADEMIC_UNITS.map(unit => {
      const row = selected?.data.units?.[unit.key] || {};
      const attendance = Number(row.attendance || 0); const participation = Number(row.participation || 0); const homework = Number(row.homework || 0); const unitExam = Number(row.unitExam ?? row.exam1 ?? row.exam2 ?? 0);
      const total = Math.min(UNIT_MAX, Number(row.total ?? calculateUnitTotal({ attendance, participation, homework, unitExam })));
      return { ...unit, attendance, participation, homework, unitExam, total, max: UNIT_MAX, items: [] as never[] };
    });
  }, [approvedPlan, planResult, selected]);

  const legacyResearch = Math.min(RESEARCH_MAX, Number(selected?.data.researchScore ?? selected?.data.research ?? 0));
  const research = approvedPlan ? (planResult?.dimensions.filter(item => item.key === "research" || item.key === "project").reduce((sum, item) => sum + item.earned, 0) || 0) : legacyResearch;
  const unitsTotal = approvedPlan ? (planResult?.earned || 0) : units.reduce((sum, unit) => sum + unit.total, 0);
  const finalMaximum = 100;
  const finalTotal = approvedPlan ? (planResult?.earned || 0) : Math.min(FINAL_MAX, unitsTotal + research);
  const percentage = approvedPlan ? (planResult?.percentage || 0) : calculatePercentage(finalTotal, FINAL_MAX);
  const completion = approvedPlan ? (planResult?.completion || 0) : percentage;
  const smartMessage = encouragements[Math.min(20, Math.max(0, Math.floor(percentage / 5)))]!;
  const weakestUnit = [...units].sort((a, b) => (a.max ? a.total / a.max : 0) - (b.max ? b.total / b.max : 0))[0];
  const strongestUnit = [...units].sort((a, b) => (b.max ? b.total / b.max : 0) - (a.max ? a.total / a.max : 0))[0];
  const targetScore = Math.min(finalMaximum, Math.max(0, goal / 100 * finalMaximum));
  const remainingForGoal = Math.max(0, targetScore - finalTotal);
  const goalReached = percentage >= goal;
  const classLabel = selected?.data.class?.trim() || "الفصل غير محدد";
  const attendanceSummary = selected?.data.attendanceSummary || { present: 0, absent: Number(selected?.data.absences || 0), late: Number(selected?.data.late || 0), excused: 0, escaped: 0, total: 0, disciplineRate: 100 };
  const disciplineMessage = attendanceSummary.escaped > 0 || attendanceSummary.absent >= 3 ? "يحتاج انتظامك إلى متابعة مباشرة مع المعلم وولي الأمر." : attendanceSummary.late >= 3 ? "حاول الوصول مبكرًا؛ تقليل التأخير سيرفع نسبة انضباطك." : "انضباطك جيد، حافظ على حضورك وانتظامك.";
  const disciplineClass = attendanceSummary.escaped > 0 || attendanceSummary.absent >= 3 ? "danger" : attendanceSummary.late >= 3 ? "warning" : "";
  const dailyPlan = percentage >= 90 ? ["راجع ملخص الدرس لمدة ١٥ دقيقة.", "حل سؤالين إثرائيين.", "اشرح فكرة واحدة لزميلك."] : percentage >= 70 ? [`راجع ${weakestUnit?.label || "القسم الأضعف"} لمدة ٢٠ دقيقة.`, "حل ثلاثة أسئلة من أخطائك السابقة.", "سجّل نقطة واحدة تحتاج سؤال المعلم عنها."] : [`ابدأ بأساسيات ${weakestUnit?.label || "القسم الأضعف"} لمدة ٢٠ دقيقة.`, "حل مثالًا مع الشرح خطوة بخطوة.", "اطلب تغذية راجعة من معلمك قبل الانتقال لمهارة جديدة."];
  const subjectProfile = subjectKnowledgeProfile(selected?.subjectKey || "", selected?.subjectLabel || "المادة");
  const visibleNotes = selected?.data.teacherNotes || [];

  if (!selected) return <main className="portal-login student-login-page" dir="rtl"><section className="portal-login-shell student-login-shell"><div className="portal-login-visual student-login-visual"><div><span className="eyebrow">بوابة الطالب وولي الأمر</span><h1>المتابعة التعليمية تبدأ هنا</h1><p>الدرجات والتقدم والغياب والتنبيهات في مساحة موحدة وآمنة.</p></div><div className="student-login-benefits"><span>📚 مواد الطالب</span><span>📊 الدرجات الفعلية</span><span>🔔 تنبيهات ولي الأمر</span></div></div><div className="portal-login-form student-login-form"><div className="portal-brand"><img src="/icons/ostadh-lahooni-192.jpg" width="54" height="54" alt="هوية بوابة أستاذ لحوني التعليمية"/><div><strong>بوابة أستاذ لحوني التعليمية</strong><small>بوابة الطالب وولي الأمر</small></div></div>{matches.length === 0 ? <><h2>دخول الطالب</h2><p className="student-login-help">اكتب TH ثم رقم الكود المرفق مع الطالب.</p><form onSubmit={submit} autoComplete="on"><label className="portal-field" htmlFor="student-access-code">كود الطالب</label><div className="portal-input"><span>TH</span><input id="student-access-code" dir="ltr" inputMode="text" enterKeyHint="go" autoComplete="username" autoCapitalize="characters" spellCheck={false} value={accessCode} onChange={event => setAccessCode(normalizeStudentCode(event.target.value))} placeholder={`مثال: ${STUDENT_CODE_EXAMPLE}`} maxLength={6} required autoFocus /></div>{message && <p className="portal-error">{message}</p>}<button type="submit" className="portal-submit" disabled={loading}>{loading ? "جارٍ التحقق..." : "دخول الطالب"}</button></form></> : <section className="student-subject-choices"><div className="student-choice-heading"><small>تم تسجيل الدخول بنجاح</small><h2>اختر المادة</h2><p>اختر المادة لعرض لوحة الأداء والدرجات.</p></div><div className="student-choice-grid">{matches.map(match => <button type="button" data-subject={match.subjectKey} key={`${match.id}-${match.subjectKey}`} onClick={() => { setSelected(match); setActiveTab("home"); }}><span className="subject-icon">{match.icon}</span><div><strong>{match.subjectLabel}</strong><small>{match.teacherName}</small></div><b>دخول ←</b></button>)}</div><button type="button" className="student-login-reset" onClick={exitStudentPortal}>تسجيل دخول آخر</button></section>}</div></section></main>;

  return <main className={`student-clean student-portal-v2 student-knowledge-shell student-theme-${selected.subjectKey}`} data-subject={selected.subjectKey} dir="rtl">
    <StudentKeyboardScroll />
    <header className="knowledge-header"><div className="knowledge-topline"><div className="knowledge-brand"><img src="/icons/ostadh-lahooni-192.jpg" width="48" height="48" alt="هوية بوابة أستاذ لحوني التعليمية"/><div><small>بوابة أستاذ لحوني التعليمية</small><strong>بوابة الطالب وولي الأمر</strong></div></div><div className="knowledge-topline-tools"><div className="knowledge-sync" title="تتحدث بياناتك تلقائيًا"><i /><div><b>البيانات محدثة</b><small>تزامن الويب والتطبيق</small></div></div><button type="button" className="knowledge-print-quick" onClick={() => { setActiveTab("report"); window.setTimeout(() => window.print(), 80); }}><span className="action-icon">▤</span><div><b>تقرير المادة PDF</b><small>تقرير شامل قابل للطباعة</small></div></button></div></div><div className="knowledge-hero knowledge-hero-compact"><div className="knowledge-hero-copy"><div className="knowledge-subject-heading"><span className="knowledge-subject-mini">{selected.icon}</span><small>{subjectProfile.eyebrow}</small></div><h1>{selected.data.name || "الطالب"}</h1><h2>{subjectProfile.title}</h2><p>{subjectProfile.description}</p><div className="knowledge-meta"><span>{selected.subjectLabel}</span><span>{classLabel}</span><span>{selected.teacherName}</span></div></div><div className="knowledge-score-pill" style={{ "--score": percentage } as CSSProperties}><small>التحصيل</small><strong>{ar(percentage)}٪</strong><span>{ar(finalTotal)} من {ar(finalMaximum)}</span><i /></div></div><div className="knowledge-actions knowledge-session-actions knowledge-compact-actions"><button type="button" className="knowledge-subjects-action" onClick={showStudentSubjects}><b>موادي</b></button><button type="button" className="knowledge-logout-action" onClick={exitStudentPortal}><b>خروج</b></button></div></header>

    <nav className="student-portal-tabs knowledge-tabs" aria-label="أقسام بوابة الطالب">{tabs.map(tab => <button type="button" key={tab.key} className={activeTab === tab.key ? "active" : ""} aria-current={activeTab === tab.key ? "page" : undefined} onClick={() => { setActiveTab(tab.key); window.scrollTo({ top: 0, behavior: "smooth" }); }}><span>{tab.icon}</span><div><b>{tab.label}</b><small>{tab.note}</small></div></button>)}</nav>

    {activeTab === "home" && <div className="student-tab-panel knowledge-panel"><section className="knowledge-welcome-card"><div className="knowledge-welcome-copy"><small>رحلتك التعليمية اليوم</small><h2>{percentage >= 90 ? "تحصيلك متميز، حافظ على عمق الفهم" : percentage >= 75 ? "تقدمك جيد، والخطوة التالية واضحة" : "ابدأ من نقطة واحدة وارفع مستوى إتقانك"}</h2><p>{smartMessage}</p><blockquote>{subjectProfile.prompt}</blockquote></div><div className="knowledge-today-plan"><small>مهمة اليوم</small><ol>{dailyPlan.map(item => <li key={item}>{item}</li>)}</ol><button type="button" onClick={() => setActiveTab("achievement")}>افتح خطة التحصيل ←</button></div></section><section className="knowledge-metrics"><button type="button" onClick={() => setActiveTab("achievement")}><span>◫</span><div><small>التحصيل</small><strong>{ar(finalTotal)} / {ar(FINAL_MAX)}</strong><em>{ar(percentage)}٪ من الدرجة</em></div></button><button type="button" onClick={() => setActiveTab("attendance")}><span>◉</span><div><small>الانضباط</small><strong>{ar(attendanceSummary.disciplineRate)}٪</strong><em>{ar(attendanceSummary.present)} حضور</em></div></button><button type="button" onClick={() => setActiveTab("notes")}><span>✎</span><div><small>ملاحظات المعلم</small><strong>{ar(visibleNotes.length)}</strong><em>ملاحظة ظاهرة لولي الأمر</em></div></button><button type="button" onClick={() => setActiveTab("report")}><span>▤</span><div><small>التقرير</small><strong>تقرير المادة</strong><em>PDF شامل</em></div></button></section><section className="knowledge-insights"><article className="success"><span>↗</span><div><small>أقوى جانب</small><strong>{strongestUnit?.label || "بانتظار رصد الدرجات"}</strong><p>{strongestUnit ? `${ar(strongestUnit.total)} من ${ar(strongestUnit.max)} — استمر على نفس أسلوب المراجعة.` : "ستظهر هنا أقوى وحدة بعد رصد الدرجات."}</p></div></article><article className="focus"><span>◎</span><div><small>أولوية التركيز</small><strong>{weakestUnit?.label || "ابدأ بالأساسيات"}</strong><p>{weakestUnit ? `${ar(weakestUnit.total)} من ${ar(weakestUnit.max)} — راجع المهارة ثم اختبر نفسك.` : "اختر مهارة واحدة وابدأ بها اليوم."}</p></div></article><article className="notice"><span>!</span><div><small>آخر متابعة</small><strong>{selected.data.parentCounselorLastNotice?.title || visibleNotes[0]?.label || "لا توجد تنبيهات"}</strong><p>{selected.data.parentCounselorLastNotice?.message || visibleNotes[0]?.message || selected.data.teacherNote || "أمورك جيدة، استمر في التعلم المنتظم."}</p></div></article></section></div>}

    {activeTab === "achievement" && <div className="student-tab-panel knowledge-panel"><section className="knowledge-section-head"><div><small>التحصيل العلمي</small><h2>درجاتي وخطة تقدمي</h2><p>تفصيل أداء {selected.subjectLabel} حسب خطة الرصد المعتمدة من المعلم.</p></div><div className="knowledge-total"><strong>{ar(finalTotal)}</strong><span>من {ar(finalMaximum)}</span></div></section><section className="knowledge-achievement-grid"><div className="knowledge-goal-card"><div className="goal-ring" style={{ "--goal": Math.min(100, percentage / Math.max(goal, 1) * 100) } as CSSProperties}><strong>{ar(goal)}٪</strong><span>هدفي</span></div><div className="goal-controls"><label>الدرجة المستهدفة<input type="range" min="50" max="100" step="1" value={goal} onChange={event => setGoal(Number(event.target.value))} /></label><div className="goal-numbers"><span>الحالي <b>{ar(percentage)}٪</b></span><span>المطلوب <b>{ar(targetScore)}</b></span><span>المتبقي <b>{ar(remainingForGoal)}</b></span></div><p className={goalReached ? "goal-success" : ""}>{goalReached ? "أحسنت، وصلت إلى هدفك الحالي." : `ابدأ بمراجعة ${weakestUnit?.label || "المهارة الأضعف"}.`}</p></div></div><div className="knowledge-score-cards"><article><small>{approvedPlan ? "المجموع الحالي" : "مجموع الوحدات"}</small><strong>{ar(unitsTotal)}</strong></article><article><small>{approvedPlan ? "اكتمال الرصد" : "البحث والمشروع"}</small><strong>{approvedPlan ? `${ar(completion)}٪` : ar(research)}</strong></article><article><small>نسبة الإنجاز</small><strong>{ar(percentage)}٪</strong></article></div></section><section className="student-units-table knowledge-table-card"><div className="student-section-title"><h2>تفصيل الدرجات</h2><p>{approvedPlan ? "حسب خطة توزيع الدرجات المعتمدة من المعلم." : "حسب نظام الرصد السابق."}</p></div>{approvedPlan && planResult ? <div className="student-table-scroll dynamic-student-grades">{planResult.sections.map(section => <table key={section.id}><thead><tr><th colSpan={3}>{section.label} — {ar(section.earned)} من {ar(section.maximum)}</th></tr><tr><th>عنصر التقييم</th><th>درجتي</th><th>من</th></tr></thead><tbody>{section.items.map(entry => <tr key={entry.key}><td><b>{entry.item.label}</b></td><td>{entry.recorded ? ar(entry.value) : "—"}</td><td>{ar(entry.maximum)}</td></tr>)}</tbody></table>)}</div> : <div className="student-table-scroll"><table><thead><tr><th>الوحدة</th><th>الحضور</th><th>المشاركة</th><th>الواجبات</th><th>الاختبار</th><th>المجموع</th></tr></thead><tbody>{units.map(unit => <tr key={unit.key}><td><b>{unit.label}</b></td><td>{ar(unit.attendance)}/{ar(GRADE_DISTRIBUTION.attendance)}</td><td>{ar(unit.participation)}/{ar(GRADE_DISTRIBUTION.participation)}</td><td>{ar(unit.homework)}/{ar(GRADE_DISTRIBUTION.homework)}</td><td>{ar(unit.unitExam)}/{ar(GRADE_DISTRIBUTION.unitExam)}</td><td><strong>{ar(unit.total)}/{ar(unit.max)}</strong></td></tr>)}</tbody></table></div>}</section></div>}

    {activeTab === "tests" && <div className="student-tab-panel knowledge-panel"><section className="knowledge-section-head"><div><small>القياس والتقويم</small><h2>اختباراتي</h2><p>الاختبارات المتاحة والنتائج في مكان واحد دون تغيير نظام الاختبارات.</p></div><span className="knowledge-section-icon">✓</span></section><div className="knowledge-tests-shell"><StudentDiagnostics accessToken={selected.accessToken} /></div></div>}

    {activeTab === "attendance" && <div className="student-tab-panel knowledge-panel"><section className="knowledge-section-head"><div><small>الانتظام والمسؤولية</small><h2>حضوري وانضباطي</h2><p>أي تعديل يعتمده المعلم يظهر هنا تلقائيًا.</p></div><div className="knowledge-total"><strong>{ar(attendanceSummary.disciplineRate)}٪</strong><span>نسبة الانضباط</span></div></section><section className="student-attendance-summary knowledge-attendance-card"><header><div><h2>سجل الحضور</h2><p>{attendanceSummary.latestDate ? `آخر تحديث: ${attendanceSummary.latestDate}` : "بانتظار أول يوم دراسي مكتمل"}</p></div><div className="attendance-discipline-rate" style={{ "--rate": attendanceSummary.disciplineRate } as CSSProperties}><strong>{ar(attendanceSummary.disciplineRate)}٪</strong></div></header><div className="attendance-discipline-grid"><article><span>الحضور</span><strong>{ar(attendanceSummary.present)}</strong></article><article className="absent"><span>الغياب</span><strong>{ar(attendanceSummary.absent)}</strong></article><article className="late"><span>التأخير</span><strong>{ar(attendanceSummary.late)}</strong></article><article><span>الاستئذان</span><strong>{ar(attendanceSummary.excused)}</strong></article><article className="escaped"><span>الهروب</span><strong>{ar(attendanceSummary.escaped)}</strong></article></div><p className={`attendance-discipline-message ${disciplineClass}`}>{disciplineMessage}</p></section></div>}

    {activeTab === "notes" && <div className="student-tab-panel knowledge-panel student-notes-v105"><section className="knowledge-section-head"><div><small>التواصل والمتابعة</small><h2>ملاحظات المعلم</h2><p>تظهر هنا فقط الملاحظات التي اختار المعلم إبلاغ الطالب وولي الأمر بها.</p></div><div className="knowledge-total"><strong>{ar(visibleNotes.length)}</strong><span>ملاحظة</span></div></section><div className="student-notes-list">{visibleNotes.length ? visibleNotes.map((entry, index) => <article key={entry.id || `${entry.createdAt || index}`}><div className="student-note-type"><span>{entry.label || "ملاحظة المعلم"}</span><strong>{entry.message || "ملاحظة تعليمية"}</strong></div><div className="student-note-meta"><b>{noteDate(entry.createdAt)}</b><span>{entry.subject || selected.subjectLabel}</span><span>{entry.teacherName || selected.teacherName}</span></div></article>) : selected.data.teacherNote ? <article><div className="student-note-type"><span>ملاحظة المعلم</span><strong>{selected.data.teacherNote}</strong></div><div className="student-note-meta"><span>{selected.subjectLabel}</span><span>{selected.teacherName}</span></div></article> : <div className="student-notes-empty">لا توجد ملاحظات ظاهرة لولي الأمر في هذه المادة حاليًا.</div>}</div></div>}

    {activeTab === "report" && <div className="student-tab-panel knowledge-panel student-report-preview-v105"><section className="knowledge-section-head"><div><small>تقرير المادة</small><h2>تقرير الطالب الشامل</h2><p>مرجع كامل يمكن للطالب وولي الأمر طباعته أو حفظه PDF ومراجعته مع المعلم في أي وقت.</p></div><button className="student-report-print-button" type="button" onClick={() => window.print()}>طباعة / حفظ PDF</button></section><section className="student-report-summary-grid"><article><small>التحصيل</small><strong>{ar(percentage)}٪</strong><span>{ar(finalTotal)} من {ar(finalMaximum)}</span></article><article><small>اكتمال الرصد</small><strong>{ar(completion)}٪</strong><span>{approvedPlan ? "وفق الخطة المعتمدة" : "وفق الرصد الحالي"}</span></article><article><small>الانضباط</small><strong>{ar(attendanceSummary.disciplineRate)}٪</strong><span>{ar(attendanceSummary.escaped)} هروب</span></article><article><small>ملاحظات المعلم</small><strong>{ar(visibleNotes.length)}</strong><span>ملاحظة ظاهرة</span></article></section><section className="student-report-preview-card"><h3>محتويات التقرير</h3><p>بيانات الطالب والمادة والمعلم، خطة الرصد المعتمدة، تفاصيل الدرجات، مؤشرات التحصيل، الحضور والغياب والتأخر والاستئذان والهروب، ملاحظات المعلم باليوم والتاريخ، وأولوية التحسين.</p><div><span>{selected.data.name || "الطالب"}</span><span>{classLabel}</span><span>{selected.subjectLabel}</span><span>{selected.teacherName}</span></div></section></div>}

    {activeTab === "ai" && <div className="student-tab-panel knowledge-panel"><section className="knowledge-ai-panel"><header><span>✦</span><div><small>مساعد تعلم ذكي مبني على بياناتك</small><h2>مساعد {selected.subjectLabel}</h2><p>يحلل درجاتك وحضورك ويقترح نقطة بداية عملية، دون تغيير بياناتك الأصلية.</p></div></header><div className="knowledge-ai-grid"><article><small>تحليل المستوى</small><strong>{percentage >= 90 ? "متقدم" : percentage >= 75 ? "جيد" : percentage >= 50 ? "متوسط" : "يحتاج دعمًا"}</strong><p>{smartMessage}</p></article><article><small>ابدأ من هنا</small><strong>{weakestUnit?.label || "المهارة الأساسية"}</strong><p>{weakestUnit ? `درجتك الحالية ${ar(weakestUnit.total)} من ${ar(weakestUnit.max)}.` : "راجع المفهوم الأساسي ثم اختبر فهمك."}</p></article><article><small>خطة اليوم</small><strong>{dailyPlan[0]}</strong><p>{dailyPlan.slice(1).join(" ثم ")}</p></article><article><small>الانضباط</small><strong>{ar(attendanceSummary.disciplineRate)}٪</strong><p>{disciplineMessage}</p></article></div></section></div>}

    <section className="student-print-report student-print-dashboard" aria-label="تقرير الطالب الشامل القابل للطباعة"><header className="print-dashboard-head"><div className="print-dashboard-brand"><img src="/icons/ostadh-lahooni-192.jpg" width="58" height="58" alt="هوية البوابة"/><div><small>بوابة أستاذ لحوني التعليمية</small><h1>تقرير الطالب في المادة</h1><p>{selected.subjectLabel} • {selected.teacherName}</p></div></div><div className="print-dashboard-status"><small>التقدير الحالي</small><strong>{percentage >= 90 ? "متميز" : percentage >= 80 ? "متقدم" : percentage >= 70 ? "جيد" : percentage >= 50 ? "متوسط" : "يحتاج دعمًا"}</strong><span>{new Intl.DateTimeFormat("ar-SA-u-ca-gregory", { dateStyle: "medium" }).format(new Date())}</span></div></header><section className="print-dashboard-identity"><div><span>الطالب</span><strong>{selected.data.name || "الطالب"}</strong></div><div><span>الفصل</span><strong>{classLabel}</strong></div><div><span>المادة</span><strong>{selected.subjectLabel}</strong></div><div><span>المعلم</span><strong>{selected.teacherName}</strong></div></section><section className="print-analytics-board"><article className="print-gauge-card score"><header><small>مؤشر التحصيل</small><strong>{ar(percentage)}٪</strong></header><svg className="print-gauge-svg" viewBox="0 0 120 120"><circle className="gauge-track" cx="60" cy="60" r="46" pathLength="100"/><circle className="gauge-value" cx="60" cy="60" r="46" pathLength="100" strokeDasharray={`${Math.max(0, Math.min(100, percentage))} 100`}/><text x="60" y="57" textAnchor="middle" className="gauge-number">{ar(percentage)}٪</text><text x="60" y="75" textAnchor="middle" className="gauge-label">التحصيل</text></svg><div className="print-gauge-detail"><b>{ar(finalTotal)} من {ar(finalMaximum)}</b><span>{smartMessage}</span></div></article><article className="print-bars-card"><header><div><small>خطة الرصد المعتمدة</small><h2>{approvedPlan ? "أداء أقسام الخطة" : "أداء الوحدات"}</h2></div><span>{approvedPlan ? `الإصدار ${approvedPlan.version}` : "الرصد الحالي"}</span></header><svg className="print-bars-svg" viewBox={`0 0 540 ${Math.max(170, units.length * 34 + 38)}`}>{units.map((unit, index) => { const y = 24 + index * 34; const barWidth = Math.max(3, Math.min(100, unit.total / Math.max(unit.max, 1) * 100)) * 3.15; return <g key={`svg-unit-${unit.key}`}><text x="520" y={y + 11} textAnchor="end" className="bar-unit-label">{unit.label}</text><rect x="120" y={y} width="315" height="14" rx="7" className="bar-track"/><rect x="120" y={y} width={barWidth} height="14" rx="7" className="bar-value"/><text x="105" y={y + 11} textAnchor="end" className="bar-score-label">{ar(unit.total)}/{ar(unit.max)}</text></g>; })}</svg></article><article className="print-gauge-card discipline"><header><small>مؤشر الانضباط</small><strong>{ar(attendanceSummary.disciplineRate)}٪</strong></header><div className="print-attendance-numbers"><span><b>{ar(attendanceSummary.present)}</b> حاضر</span><span><b>{ar(attendanceSummary.absent)}</b> غائب</span><span><b>{ar(attendanceSummary.late)}</b> متأخر</span><span><b>{ar(attendanceSummary.excused)}</b> مستأذن</span><span><b>{ar(attendanceSummary.escaped)}</b> هروب</span></div></article></section><section className="print-dashboard-guidance"><article className="print-reading-card strength"><small>نقطة القوة</small><strong>{strongestUnit?.label || "بانتظار اكتمال الرصد"}</strong><p>{strongestUnit ? `حقق الطالب ${ar(strongestUnit.total)} من ${ar(strongestUnit.max)}.` : "تظهر نقطة القوة بعد اكتمال الرصد."}</p></article><article className="print-reading-card priority"><small>أولوية التحسين</small><strong>{weakestUnit?.label || "المهارات الأساسية"}</strong><p>{weakestUnit ? `الدرجة الحالية ${ar(weakestUnit.total)} من ${ar(weakestUnit.max)}.` : "ابدأ بمهارة واحدة ثم اختبر فهمك."}</p></article><article className="print-reading-card followup"><small>ملاحظات المعلم</small><strong>{visibleNotes.length ? `${ar(visibleNotes.length)} ملاحظة` : "لا توجد ملاحظات"}</strong><div className="print-note-lines">{visibleNotes.slice(0, 5).map((note, index) => <p key={note.id || index}><b>{noteDate(note.createdAt)}:</b> {note.label ? `${note.label} — ` : ""}{note.message}</p>)}</div></article><article className="print-plan-card"><small>خطة العمل القادمة</small><ol>{dailyPlan.map((item, index) => <li key={`dashboard-plan-${item}`}><span>{index + 1}</span>{item}</li>)}</ol></article></section><footer className="print-dashboard-footer"><span>تقرير تعليمي للمراجعة مع المعلم</span><strong>بوابة أستاذ لحوني التعليمية • إعداد وتنفيذ: الأستاذ حسن علي الطويل</strong></footer></section>
  </main>;
}
