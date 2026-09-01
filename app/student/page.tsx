"use client";

import { FormEvent, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ACADEMIC_UNITS, FINAL_MAX, GRADE_DISTRIBUTION, RESEARCH_MAX, UNIT_MAX, calculatePercentage, calculateUnitTotal } from "../../lib/academic-config";
import "./student-diagnostics.css";
import "./student-portal-tabs.css";
import "./attendance-summary.css";
import StudentDiagnostics from "./student-diagnostics";
import StudentKeyboardScroll from "./student-keyboard-scroll";

type UnitRecord = { total?: number; attendance?: number; participation?: number; homework?: number; unitExam?: number; exam1?: number; exam2?: number };
type AttendanceSummary = { present: number; absent: number; late: number; excused: number; escaped: number; total: number; disciplineRate: number; latestDate?: string };
type StudentRecord = { name?: string; class?: string; accessCode?: string; teacherName?: string; research?: number; researchScore?: number; teacherNote?: string; absences?: number; late?: number; attendanceSummary?: AttendanceSummary; units?: Record<string, UnitRecord>; parentCounselorLastNotice?: { title?: string; message?: string } };
type Match = { id: string; teacherId: string; subjectKey: string; subjectLabel: string; teacherName: string; icon: string; accessToken: string; data: StudentRecord };
type StudentTab = "home" | "achievement" | "tests" | "attendance" | "ai";

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
  { key: "ai", icon: "✦", label: "مساعدي", note: "تحليل وخطة" },
];

function subjectKnowledgeProfile(subjectKey: string, subjectLabel: string): SubjectKnowledgeProfile {
  const key = subjectKey.split("--")[0];
  if (["history", "geography", "social-studies", "social-sciences", "citizenship"].includes(key)) {
    return { eyebrow: "بوابة المعرفة والوعي", title: `اكتشف ${subjectLabel} واربط المعرفة بالواقع`, description: "تتبّع فهمك للأحداث والمفاهيم، واربط الأسباب بالنتائج بخطوات واضحة.", prompt: "اسأل نفسك: ما الفكرة الأهم التي أستطيع شرحها اليوم؟" };
  }
  if (key === "critical-thinking") {
    return { eyebrow: "بوابة التحليل والاستدلال", title: "حلّل الأدلة وابنِ حكمك بوعي", description: "تابع مهاراتك في التحليل والاستنتاج واتخاذ القرار، ثم ركّز على المهارة الأقل إتقانًا.", prompt: "اسأل نفسك: ما الدليل؟ وما التفسير الأقوى؟" };
  }
  if (["mathematics", "financial-literacy"].includes(key)) {
    return { eyebrow: "بوابة الحل والتطبيق", title: `تقدّم في ${subjectLabel} خطوة بخطوة`, description: "حوّل كل مهارة إلى تدريب قصير، وراجع موضع الخطأ قبل الانتقال للمسألة التالية.", prompt: "ابدأ بمسألة واحدة، واكتب خطوات الحل بوضوح." };
  }
  if (["science", "physics", "chemistry", "biology", "earth-science", "environmental-science"].includes(key)) {
    return { eyebrow: "بوابة الاستكشاف العلمي", title: `استكشف ${subjectLabel} وافهم كيف يعمل العالم`, description: "اربط المفهوم بالملاحظة والتجربة، واستخدم نتائجك لتحديد ما يحتاج إلى مراجعة.", prompt: "ما الظاهرة التي أستطيع تفسيرها بما تعلمته؟" };
  }
  if (["arabic", "linguistic-competencies"].includes(key)) {
    return { eyebrow: "بوابة اللغة والتعبير", title: "اقرأ بفهم وعبّر بثقة", description: "تابع نموك في القراءة والكتابة والمهارات اللغوية، وابدأ من الجانب الأقل درجة.", prompt: "اكتب فكرة واحدة بأسلوب واضح ومترابط." };
  }
  if (key === "english") {
    return { eyebrow: "Learning & Communication", title: "Read, practise, and communicate with confidence", description: "Track your progress in reading, writing, vocabulary, and assessment tasks.", prompt: "Use one new word in a complete sentence today." };
  }
  if (["digital-technology", "computer-science"].includes(key)) {
    return { eyebrow: "بوابة المهارات الرقمية", title: "تعلّم، طبّق، وابنِ حلًا رقميًا", description: "تابع المهارات والمشروعات والاختبارات، وحوّل المعرفة إلى تطبيق عملي.", prompt: "ما الخطوة الرقمية التي أستطيع تنفيذها بنفسي؟" };
  }
  if (["islamic-studies", "quran", "quran-tafsir", "tafsir", "hadith", "fiqh", "tawhid"].includes(key)) {
    return { eyebrow: "بوابة العلم والقيم", title: `تعلّم ${subjectLabel} وافهم أثره في حياتك`, description: "تابع تحصيلك، واربط المعرفة بالقيم والسلوك والتطبيق اليومي.", prompt: "ما القيمة التي أستطيع تطبيقها اليوم؟" };
  }
  if (["physical-education", "fitness-health", "health-education"].includes(key)) {
    return { eyebrow: "بوابة الصحة والإنجاز", title: "تقدّم بوعي وحافظ على انتظامك", description: "تابع الأداء واللياقة والانضباط، واجعل هدفك اليومي واضحًا وقابلًا للقياس.", prompt: "اختر عادة صحية واحدة وحافظ عليها اليوم." };
  }
  if (["art", "arts"].includes(key)) {
    return { eyebrow: "بوابة الإبداع والتعبير", title: "حوّل فكرتك إلى عمل يعبر عنك", description: "تابع تقدمك في المهارات والمشروعات، واستفد من الملاحظات لتطوير عملك.", prompt: "جرّب فكرة جديدة وعدّلها بعد الملاحظة." };
  }
  return { eyebrow: "بوابة التحصيل العلمي", title: `تعلّم ${subjectLabel} بثقة ووضوح`, description: "كل بياناتك التعليمية في مسار واحد: التحصيل والاختبارات والانضباط والتوجيه الذكي.", prompt: "ابدأ بالمهمة الأقرب لهدفك اليوم." };
}

function normalizeStudentCode(value: string) {
  return value
    .replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
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
    setMessage("");
    setMatches([]);
    setSelected(null);
    if (!CODE_PATTERN.test(code)) {
      setMessage(`أدخل كودًا صحيحًا مثل ${STUDENT_CODE_EXAMPLE}.`);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/student/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessCode: code }),
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.message || "كود الدخول غير صحيح، أو لم تُربط لك مادة بعد.");
        return;
      }
      const nextMatches = Array.isArray(data.matches) ? data.matches : [];
      setMatches(nextMatches);
      if (nextMatches.length === 1) {
        setSelected(nextMatches[0]);
        setActiveTab("home");
      }
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
    if (query.has("code") || query.has("entry") || query.has("v") || query.has("logout")) {
      window.history.replaceState({}, "", "/student");
    }
    if (CODE_PATTERN.test(code) && !automaticLoginStarted.current) {
      automaticLoginStarted.current = true;
      void lookup(code);
    }
  }, []);

  useEffect(() => {
    const token = selected?.accessToken;
    if (!token) return;
    let active = true;
    let inFlight = false;
    let lastRefresh = 0;

    const refresh = async (force = false) => {
      if (inFlight || (!force && Date.now() - lastRefresh < 25_000)) return;
      inFlight = true;
      try {
        const response = await fetch("/api/student/profile", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const payload = await response.json();
        if (active && response.ok) {
          lastRefresh = Date.now();
          setSelected(current => current ? { ...current, data: payload.data } : current);
        }
      } catch {
        // Keep the last visible data when the network or quota is temporarily unavailable.
      } finally {
        inFlight = false;
      }
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };

    let refreshTimer: number | null = null;
    const scheduleRefresh = () => {
      if (!active) return;
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(async () => {
        refreshTimer = null;
        if (document.visibilityState === "visible") await refresh();
        scheduleRefresh();
      }, 30_000);
    };

    void refresh(true);
    scheduleRefresh();
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      active = false;
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [selected?.accessToken]);

  function submit(event: FormEvent) {
    event.preventDefault();
    void lookup(accessCode);
  }

  function showStudentSubjects() {
    setSelected(null);
    setActiveTab("home");
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
  }

  function exitStudentPortal() {
    setSelected(null);
    setMatches([]);
    setAccessCode("");
    setMessage("");
    setActiveTab("home");
    try {
      sessionStorage.removeItem("lahooni-student-active");
      sessionStorage.removeItem("lahooni-student-session");
      localStorage.removeItem("lahooni-student-last-path");
      localStorage.removeItem("lahooni-student-active");
    } catch {}
    window.location.replace(`/student?logout=${Date.now()}`);
  }

  const units = useMemo(() => ACADEMIC_UNITS.map(unit => {
    const row = selected?.data.units?.[unit.key] || {};
    const attendance = Number(row.attendance || 0);
    const participation = Number(row.participation || 0);
    const homework = Number(row.homework || 0);
    const unitExam = Number(row.unitExam ?? row.exam1 ?? row.exam2 ?? 0);
    const total = Math.min(UNIT_MAX, Number(row.total ?? calculateUnitTotal({ attendance, participation, homework, unitExam })));
    return { ...unit, attendance, participation, homework, unitExam, total };
  }), [selected]);

  const research = Math.min(RESEARCH_MAX, Number(selected?.data.researchScore ?? selected?.data.research ?? 0));
  const unitsTotal = units.reduce((sum, unit) => sum + unit.total, 0);
  const finalTotal = Math.min(FINAL_MAX, unitsTotal + research);
  const percentage = calculatePercentage(finalTotal, FINAL_MAX);
  const smartMessage = encouragements[Math.min(20, Math.max(0, Math.floor(percentage / 5)))]!;
  const weakestUnit = [...units].sort((a, b) => a.total - b.total)[0];
  const strongestUnit = [...units].sort((a, b) => b.total - a.total)[0];
  const targetScore = Math.min(FINAL_MAX, Math.max(0, goal / 100 * FINAL_MAX));
  const remainingForGoal = Math.max(0, targetScore - finalTotal);
  const goalReached = percentage >= goal;
  const classLabel = selected?.data.class?.trim() || "الفصل غير محدد";
  const attendanceSummary = selected?.data.attendanceSummary || { present: 0, absent: Number(selected?.data.absences || 0), late: Number(selected?.data.late || 0), excused: 0, escaped: 0, total: 0, disciplineRate: 100 };
  const disciplineMessage = attendanceSummary.escaped > 0 || attendanceSummary.absent >= 3
    ? "يحتاج انتظامك إلى متابعة مباشرة مع المعلم وولي الأمر."
    : attendanceSummary.late >= 3
      ? "حاول الوصول مبكرًا؛ تقليل التأخير سيرفع نسبة انضباطك."
      : "انضباطك جيد، حافظ على حضورك وانتظامك.";
  const disciplineClass = attendanceSummary.escaped > 0 || attendanceSummary.absent >= 3 ? "danger" : attendanceSummary.late >= 3 ? "warning" : "";
  const dailyPlan = percentage >= 90
    ? ["راجع ملخص الدرس لمدة ١٥ دقيقة.", "حل سؤالين إثرائيين.", "اشرح فكرة واحدة لزميلك."]
    : percentage >= 70
      ? [`راجع ${weakestUnit?.label || "الوحدة الأضعف"} لمدة ٢٠ دقيقة.`, "حل ثلاثة أسئلة من أخطائك السابقة.", "سجّل نقطة واحدة تحتاج سؤال المعلم عنها."]
      : [`ابدأ بأساسيات ${weakestUnit?.label || "الوحدة الأضعف"} لمدة ٢٠ دقيقة.`, "حل مثالًا مع الشرح خطوة بخطوة.", "اطلب تغذية راجعة من معلمك قبل الانتقال لمهارة جديدة."];
  const subjectProfile = subjectKnowledgeProfile(selected?.subjectKey || "", selected?.subjectLabel || "المادة");

  if (!selected) {
    return <main className="portal-login student-login-page" dir="rtl">
      <section className="portal-login-shell student-login-shell">
        <div className="portal-login-visual student-login-visual">
          <div><span className="eyebrow">بوابة الطالب وولي الأمر</span><h1>المتابعة التعليمية تبدأ هنا</h1><p>الدرجات والتقدم والغياب والتنبيهات في مساحة موحدة وآمنة.</p></div>
          <div className="student-login-benefits"><span>📚 مواد الطالب</span><span>📊 الدرجات الفعلية</span><span>🔔 تنبيهات ولي الأمر</span></div>
        </div>
        <div className="portal-login-form student-login-form">
          <div className="portal-brand"><div className="portal-brand-mark">ط</div><div><strong>أستاذ لحوني</strong><small>بوابة الطالب وولي الأمر</small></div></div>
          {matches.length === 0 ? <>
            <h2>دخول الطالب</h2>
            <p className="student-login-help">أدخل كود الطالب فقط لعرض جميع المواد المرتبطة به.</p>
            <form onSubmit={submit} autoComplete="on">
              <label className="portal-field" htmlFor="student-access-code">كود الطالب</label>
              <div className="portal-input"><span>🔐</span><input id="student-access-code" dir="ltr" inputMode="text" enterKeyHint="go" autoComplete="username" autoCapitalize="characters" spellCheck={false} value={accessCode} onChange={event => setAccessCode(normalizeStudentCode(event.target.value))} placeholder={`مثال: ${STUDENT_CODE_EXAMPLE}`} maxLength={6} required autoFocus /></div>
              {message && <p className="portal-error">{message}</p>}
              <button type="submit" className="portal-submit" disabled={loading}>{loading ? "جارٍ التحقق..." : "دخول الطالب"}</button>
            </form>
          </> : <section className="student-subject-choices">
            <div className="student-choice-heading"><small>تم تسجيل الدخول بنجاح</small><h2>اختر المادة</h2><p>اختر المادة لعرض لوحة الأداء والدرجات.</p></div>
            <div className="student-choice-grid">{matches.map(match => <button type="button" data-subject={match.subjectKey} key={`${match.id}-${match.subjectKey}`} onClick={() => { setSelected(match); setActiveTab("home"); }}><span className="subject-icon">{match.icon}</span><div><strong>{match.subjectLabel}</strong><small>{match.teacherName}</small></div><b>دخول ←</b></button>)}</div>
            <button type="button" className="student-login-reset" onClick={exitStudentPortal}>تسجيل دخول آخر</button>
          </section>}
        </div>
      </section>
    </main>;
  }

  return <main className={`student-clean student-portal-v2 student-knowledge-shell student-theme-${selected.subjectKey}`} data-subject={selected.subjectKey} dir="rtl">
    <StudentKeyboardScroll />

    <header className="knowledge-header">
      <div className="knowledge-topline">
        <div className="knowledge-brand"><span>{selected.icon}</span><div><small>بوابة أستاذ لحوني التعليمية</small><strong>بوابة الطالب المعرفية</strong></div></div>
        <div className="knowledge-topline-tools">
          <div className="knowledge-sync" title="تتحدث بياناتك تلقائيًا"><i /><div><b>البيانات محدثة</b><small>تحديث تلقائي وآمن</small></div></div>
          <button type="button" className="knowledge-print-quick" data-student-action="print" data-native-print="true" onClick={() => window.print()}><span>▤</span><div><b>تقرير الطالب</b><small>طباعة البيانات والتفاصيل</small></div></button>
        </div>
      </div>

      <div className="knowledge-hero">
        <div className="knowledge-subject-mark" aria-hidden="true"><span>{selected.icon}</span></div>
        <div className="knowledge-hero-copy">
          <small>{subjectProfile.eyebrow}</small>
          <h1>{selected.data.name || "الطالب"}</h1>
          <h2>{subjectProfile.title}</h2>
          <p>{subjectProfile.description}</p>
          <div className="knowledge-meta"><span>{selected.subjectLabel}</span><span>{classLabel}</span><span>{selected.teacherName}</span></div>
        </div>
        <div className="knowledge-overall" style={{ "--score": percentage } as CSSProperties}>
          <div><strong>{ar(percentage)}٪</strong><span>مستوى التحصيل</span></div>
          <small>{ar(finalTotal)} من {ar(FINAL_MAX)}</small>
        </div>
      </div>

      <div className="knowledge-actions" aria-label="إجراءات الطالب">
        <button type="button" data-student-action="subjects" onClick={showStudentSubjects}><span>▦</span><div><b>تغيير المادة</b><small>عرض جميع المواد المرتبطة بك</small></div></button>
        <button type="button" className="danger" data-student-action="logout" onClick={exitStudentPortal}><span>↪</span><div><b>تسجيل الخروج</b><small>إنهاء جلسة الطالب الحالية</small></div></button>
      </div>
    </header>

    <nav className="student-portal-tabs knowledge-tabs" aria-label="أقسام بوابة الطالب">
      {tabs.map(tab => <button type="button" key={tab.key} className={activeTab === tab.key ? "active" : ""} aria-current={activeTab === tab.key ? "page" : undefined} onClick={() => { setActiveTab(tab.key); window.scrollTo({ top: 0, behavior: "smooth" }); }}><span>{tab.icon}</span><div><b>{tab.label}</b><small>{tab.note}</small></div></button>)}
    </nav>

    {activeTab === "home" && <div className="student-tab-panel knowledge-panel">
      <section className="knowledge-welcome-card">
        <div className="knowledge-welcome-copy"><small>رحلتك التعليمية اليوم</small><h2>{percentage >= 90 ? "تحصيلك متميز، حافظ على عمق الفهم" : percentage >= 75 ? "تقدمك جيد، والخطوة التالية واضحة" : "ابدأ من نقطة واحدة وارفع مستوى إتقانك"}</h2><p>{smartMessage}</p><blockquote>{subjectProfile.prompt}</blockquote></div>
        <div className="knowledge-today-plan"><small>مهمة اليوم</small><ol>{dailyPlan.map(item => <li key={item}>{item}</li>)}</ol><button type="button" onClick={() => setActiveTab("achievement")}>افتح خطة التحصيل ←</button></div>
      </section>

      <section className="knowledge-metrics" aria-label="ملخص الطالب">
        <button type="button" onClick={() => setActiveTab("achievement")}><span>◫</span><div><small>التحصيل</small><strong>{ar(finalTotal)} / {ar(FINAL_MAX)}</strong><em>{ar(percentage)}٪ من الدرجة</em></div></button>
        <button type="button" onClick={() => setActiveTab("attendance")}><span>◉</span><div><small>الانضباط</small><strong>{ar(attendanceSummary.disciplineRate)}٪</strong><em>{ar(attendanceSummary.present)} حضور</em></div></button>
        <button type="button" onClick={() => setActiveTab("tests")}><span>✓</span><div><small>الاختبارات</small><strong>مركز الاختبارات</strong><em>المتاح والنتائج</em></div></button>
        <button type="button" onClick={() => setActiveTab("ai")}><span>✦</span><div><small>التوجيه الذكي</small><strong>{weakestUnit?.label || "ابدأ بالمراجعة"}</strong><em>أولوية التحسين</em></div></button>
      </section>

      <section className="knowledge-insights">
        <article className="success"><span>↗</span><div><small>أقوى جانب</small><strong>{strongestUnit?.label || "بانتظار رصد الدرجات"}</strong><p>{strongestUnit ? `${ar(strongestUnit.total)} من ${ar(UNIT_MAX)} — استمر على نفس أسلوب المراجعة.` : "ستظهر هنا أقوى وحدة بعد رصد الدرجات."}</p></div></article>
        <article className="focus"><span>◎</span><div><small>أولوية التركيز</small><strong>{weakestUnit?.label || "ابدأ بالأساسيات"}</strong><p>{weakestUnit ? `${ar(weakestUnit.total)} من ${ar(UNIT_MAX)} — راجع المهارة ثم اختبر نفسك.` : "اختر مهارة واحدة وابدأ بها اليوم."}</p></div></article>
        <article className="notice"><span>!</span><div><small>آخر متابعة</small><strong>{selected.data.parentCounselorLastNotice?.title || "لا توجد تنبيهات"}</strong><p>{selected.data.parentCounselorLastNotice?.message || selected.data.teacherNote || "أمورك جيدة، استمر في التعلم المنتظم."}</p></div></article>
      </section>
    </div>}

    {activeTab === "achievement" && <div className="student-tab-panel knowledge-panel">
      <section className="knowledge-section-head"><div><small>التحصيل العلمي</small><h2>درجاتي وخطة تقدمي</h2><p>تفصيل أداء {selected.subjectLabel} مع هدف واضح للمرحلة القادمة.</p></div><div className="knowledge-total"><strong>{ar(finalTotal)}</strong><span>من {ar(FINAL_MAX)}</span></div></section>

      <section className="knowledge-achievement-grid">
        <div className="knowledge-goal-card">
          <div className="goal-ring" style={{ "--goal": Math.min(100, percentage / Math.max(goal, 1) * 100) } as CSSProperties}><strong>{ar(goal)}٪</strong><span>هدفي</span></div>
          <div className="goal-controls"><label>الدرجة المستهدفة<input type="range" min="50" max="100" step="1" value={goal} onChange={event => setGoal(Number(event.target.value))} /></label><div className="goal-numbers"><span>الحالي <b>{ar(percentage)}٪</b></span><span>المطلوب <b>{ar(targetScore)}</b></span><span>المتبقي <b>{ar(remainingForGoal)}</b></span></div><p className={goalReached ? "goal-success" : ""}>{goalReached ? "أحسنت، وصلت إلى هدفك الحالي. ارفع الهدف عندما تكون جاهزًا." : `ابدأ بمراجعة ${weakestUnit?.label || "المهارة الأضعف"} ثم اختبر نفسك.`}</p></div>
        </div>
        <div className="knowledge-score-cards"><article><small>مجموع الوحدات</small><strong>{ar(unitsTotal)}</strong></article><article><small>البحث والمشروع</small><strong>{ar(research)}</strong></article><article><small>نسبة الإنجاز</small><strong>{ar(percentage)}٪</strong></article></div>
      </section>

      <section className="student-units-table knowledge-table-card"><div className="student-section-title"><h2>تفصيل الدرجات</h2><p>اضغط على المساعد الذكي لمعرفة نقطة البداية المناسبة.</p></div><div className="student-table-scroll"><table><thead><tr><th>الوحدة</th><th>الحضور</th><th>المشاركة</th><th>الواجبات</th><th>الاختبار</th><th>المجموع</th></tr></thead><tbody>{units.map(unit => <tr key={unit.key}><td data-label="الوحدة"><b>{unit.label}</b></td><td data-label="الحضور">{ar(unit.attendance)}/{ar(GRADE_DISTRIBUTION.attendance)}</td><td data-label="المشاركة">{ar(unit.participation)}/{ar(GRADE_DISTRIBUTION.participation)}</td><td data-label="الواجبات">{ar(unit.homework)}/{ar(GRADE_DISTRIBUTION.homework)}</td><td data-label="الاختبار">{ar(unit.unitExam)}/{ar(GRADE_DISTRIBUTION.unitExam)}</td><td data-label="المجموع"><strong>{ar(unit.total)}/{ar(UNIT_MAX)}</strong></td></tr>)}</tbody></table></div></section>
    </div>}

    {activeTab === "tests" && <div className="student-tab-panel knowledge-panel"><section className="knowledge-section-head"><div><small>القياس والتقويم</small><h2>اختباراتي</h2><p>الاختبارات المتاحة والنتائج في مكان واحد دون تغيير نظام الاختبارات.</p></div><span className="knowledge-section-icon">✓</span></section><div className="knowledge-tests-shell"><StudentDiagnostics accessToken={selected.accessToken} /></div></div>}

    {activeTab === "attendance" && <div className="student-tab-panel knowledge-panel">
      <section className="knowledge-section-head"><div><small>الانتظام والمسؤولية</small><h2>حضوري وانضباطي</h2><p>تُحدّث الحالة تلقائيًا، وأي تعديل يعتمده المعلم يظهر في بوابتك.</p></div><div className="knowledge-total"><strong>{ar(attendanceSummary.disciplineRate)}٪</strong><span>نسبة الانضباط</span></div></section>
      <section className="student-attendance-summary knowledge-attendance-card"><header><div><h2>سجل الحضور</h2><p>{attendanceSummary.latestDate ? `آخر تحديث: ${attendanceSummary.latestDate}` : "بانتظار أول يوم دراسي مكتمل"}</p></div><div className="attendance-discipline-rate" style={{ "--rate": attendanceSummary.disciplineRate } as CSSProperties}><strong>{ar(attendanceSummary.disciplineRate)}٪</strong></div></header><div className="attendance-discipline-grid"><article><span>الحضور</span><strong>{ar(attendanceSummary.present)}</strong></article><article className="absent"><span>الغياب</span><strong>{ar(attendanceSummary.absent)}</strong></article><article className="late"><span>التأخير</span><strong>{ar(attendanceSummary.late)}</strong></article><article><span>الاستئذان</span><strong>{ar(attendanceSummary.excused)}</strong></article><article className="escaped"><span>الهروب</span><strong>{ar(attendanceSummary.escaped)}</strong></article></div><p className={`attendance-discipline-message ${disciplineClass}`}>{disciplineMessage}</p></section>
      <section className="knowledge-discipline-guide"><article><span>١</span><div><strong>راجع حالتك</strong><p>تظهر الحالات المعتمدة من المعلم تلقائيًا.</p></div></article><article><span>٢</span><div><strong>انتبه للتأخر</strong><p>الانتظام اليومي يرفع نسبة الانضباط.</p></div></article><article><span>٣</span><div><strong>تواصل عند الحاجة</strong><p>راجع معلم المادة إذا وجدت حالة تحتاج تصحيحًا.</p></div></article></section>
    </div>}

    {activeTab === "ai" && <div className="student-tab-panel knowledge-panel">
      <section className="knowledge-ai-panel"><header><span>✦</span><div><small>مساعد تعلم ذكي مبني على بياناتك</small><h2>مساعد {selected.subjectLabel}</h2><p>يحلل درجاتك وحضورك ويقترح لك نقطة بداية عملية، دون تغيير بياناتك الأصلية.</p></div></header>
        <div className="knowledge-ai-grid">
          <article><small>تحليل المستوى</small><strong>{percentage >= 90 ? "متقدم" : percentage >= 75 ? "جيد" : percentage >= 50 ? "متوسط" : "يحتاج دعمًا"}</strong><p>{smartMessage}</p></article>
          <article><small>ابدأ من هنا</small><strong>{weakestUnit?.label || "المهارة الأساسية"}</strong><p>{weakestUnit ? `درجتك الحالية ${ar(weakestUnit.total)} من ${ar(UNIT_MAX)}. راجع المفهوم، ثم حل ثلاثة أسئلة قصيرة.` : "راجع المفهوم الأساسي ثم اختبر فهمك بسؤال قصير."}</p></article>
          <article><small>خطة اليوم</small><strong>{dailyPlan[0]}</strong><p>{dailyPlan.slice(1).join(" ثم ")}</p></article>
          <article><small>الانضباط</small><strong>{ar(attendanceSummary.disciplineRate)}٪</strong><p>{disciplineMessage}</p></article>
          <article className="wide"><small>سؤال التفكير اليومي</small><strong>{subjectProfile.prompt}</strong><p>اكتب إجابتك في دفترك، ثم قارنها بما تعلمته في الدرس.</p></article>
        </div>
        <div className="knowledge-ai-actions"><button type="button" onClick={() => setActiveTab("achievement")}>راجع درجاتي</button><button type="button" onClick={() => setActiveTab("tests")}>افتح اختباراتي</button><button type="button" onClick={() => setActiveTab("attendance")}>راجع انضباطي</button></div>
      </section>
    </div>}

    <section className="student-print-report knowledge-print-report" aria-label="تقرير الطالب القابل للطباعة">
      <header className="student-print-head knowledge-print-head">
        <div><small>بوابة أستاذ لحوني التعليمية</small><h1>تقرير التحصيل العلمي والمتابعة</h1><p>{selected.subjectLabel} • {selected.teacherName}</p></div>
        <div className="student-print-badge"><span>{selected.icon}</span><strong>{ar(percentage)}٪</strong><small>مستوى التحصيل</small></div>
      </header>

      <section className="student-print-identity knowledge-print-identity">
        <div><span>اسم الطالب</span><strong>{selected.data.name || "الطالب"}</strong></div>
        <div><span>الفصل</span><strong>{classLabel}</strong></div>
        <div><span>المادة</span><strong>{selected.subjectLabel}</strong></div>
        <div><span>المعلم</span><strong>{selected.teacherName}</strong></div>
        <div><span>تاريخ التقرير</span><strong>{new Intl.DateTimeFormat("ar-SA", { dateStyle: "long" }).format(new Date())}</strong></div>
        <div><span>حالة البيانات</span><strong>محدثة من بوابة الطالب</strong></div>
      </section>

      <section className="knowledge-print-summary" aria-label="ملخص الأرقام">
        <article><span>المجموع الكلي</span><strong>{ar(finalTotal)} / {ar(FINAL_MAX)}</strong><small>إجمالي ما رُصد للطالب</small></article>
        <article><span>نسبة التحصيل</span><strong>{ar(percentage)}٪</strong><small>مقارنة بالدرجة الكاملة</small></article>
        <article><span>الحضور</span><strong>{ar(attendanceSummary.present)}</strong><small>أيام أو حصص الحضور المعتمدة</small></article>
        <article><span>الغياب</span><strong>{ar(attendanceSummary.absent)}</strong><small>الحالات المسجلة غيابًا</small></article>
        <article><span>التأخر</span><strong>{ar(attendanceSummary.late)}</strong><small>مرات التأخر المسجلة</small></article>
        <article><span>الانضباط</span><strong>{ar(attendanceSummary.disciplineRate)}٪</strong><small>مؤشر الانتظام في المادة</small></article>
      </section>

      <section className="knowledge-print-reading">
        <article className="strength"><small>نقطة القوة الحالية</small><strong>{strongestUnit?.label || "بانتظار رصد الدرجات"}</strong><p>{strongestUnit ? `حقق الطالب ${ar(strongestUnit.total)} من ${ar(UNIT_MAX)} في هذا الجانب.` : "ستظهر نقطة القوة بعد اكتمال رصد الدرجات."}</p></article>
        <article className="priority"><small>أولوية التحسين</small><strong>{weakestUnit?.label || "المراجعة المنتظمة"}</strong><p>{weakestUnit ? `الدرجة الحالية ${ar(weakestUnit.total)} من ${ar(UNIT_MAX)}؛ ويوصى بمراجعة المهارة ثم التدريب عليها.` : "يوصى بالبدء بمراجعة المهارات الأساسية."}</p></article>
      </section>

      <section className="student-print-section knowledge-print-table"><h2>تفصيل درجات الوحدات</h2><p className="knowledge-print-help">يبين الجدول مكونات درجة كل وحدة، ثم مجموعها من الدرجة المخصصة للوحدة.</p><table><thead><tr><th>الوحدة</th><th>الحضور</th><th>المشاركة</th><th>الواجبات</th><th>الاختبار</th><th>المجموع</th></tr></thead><tbody>{units.map(unit => <tr key={`print-${unit.key}`}><td>{unit.label}</td><td>{ar(unit.attendance)} / {ar(GRADE_DISTRIBUTION.attendance)}</td><td>{ar(unit.participation)} / {ar(GRADE_DISTRIBUTION.participation)}</td><td>{ar(unit.homework)} / {ar(GRADE_DISTRIBUTION.homework)}</td><td>{ar(unit.unitExam)} / {ar(GRADE_DISTRIBUTION.unitExam)}</td><td><strong>{ar(unit.total)} / {ar(UNIT_MAX)}</strong></td></tr>)}</tbody></table></section>

      <section className="knowledge-print-attendance"><h2>تفاصيل الحضور والانضباط</h2><div><article><span>حاضر</span><strong>{ar(attendanceSummary.present)}</strong></article><article><span>غائب</span><strong>{ar(attendanceSummary.absent)}</strong></article><article><span>متأخر</span><strong>{ar(attendanceSummary.late)}</strong></article><article><span>مستأذن</span><strong>{ar(attendanceSummary.excused)}</strong></article><article><span>هروب</span><strong>{ar(attendanceSummary.escaped)}</strong></article></div><p>{disciplineMessage}</p></section>

      <section className="knowledge-print-plan"><div><h2>خطة الطالب المقترحة</h2><p>خطوات قصيرة مبنية على مستوى التحصيل الحالي:</p></div><ol>{dailyPlan.map(item => <li key={`print-plan-${item}`}>{item}</li>)}</ol></section>

      <section className="student-print-note knowledge-print-note"><h2>ملاحظة المتابعة والتوصية</h2><p>{selected.data.parentCounselorLastNotice?.message || selected.data.teacherNote || `${smartMessage} الأولوية الحالية: ${weakestUnit?.label || "المراجعة المنتظمة"}.`}</p></section>
      <footer><span>تقرير تعليمي صادر من بوابة أستاذ لحوني التعليمية</span><span>المعلم: {selected.teacherName}</span></footer>
    </section>
  </main>;
}
