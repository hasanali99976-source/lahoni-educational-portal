"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ACADEMIC_UNITS, FINAL_MAX, GRADE_DISTRIBUTION, RESEARCH_MAX, UNIT_MAX, calculatePercentage, calculateUnitTotal } from "../../lib/academic-config";
import "./student-diagnostics.css";
import "./student-portal-tabs.css";
import "./attendance-summary.css";
import StudentDiagnostics from "./student-diagnostics";

type UnitRecord = { total?: number; attendance?: number; participation?: number; homework?: number; unitExam?: number; exam1?: number; exam2?: number };
type AttendanceSummary = { present: number; absent: number; late: number; excused: number; escaped: number; total: number; disciplineRate: number; latestDate?: string };
type StudentRecord = { name?: string; class?: string; accessCode?: string; teacherName?: string; research?: number; researchScore?: number; teacherNote?: string; absences?: number; late?: number; attendanceSummary?: AttendanceSummary; units?: Record<string, UnitRecord>; parentCounselorLastNotice?: { title?: string; message?: string } };
type Match = { id: string; teacherId: string; subjectKey: string; subjectLabel: string; teacherName: string; icon: string; accessToken: string; data: StudentRecord };
type StudentTab = "home" | "grades" | "tests" | "plan" | "ai";

const CODE_PATTERN = /^TH[123]\d{3}$/;
const STUDENT_CODE_EXAMPLE = "TH1234";
const ar = (value: number) => new Intl.NumberFormat("ar-SA-u-nu-arab", { maximumFractionDigits: 1 }).format(Number.isFinite(value) ? value : 0);
const encouragements = ["البداية ممكنة، ركّز على خطوة واحدة اليوم.","ابدأ بخطة قصيرة واطلب مساعدة معلمك.","كل مراجعة صغيرة ترفع مستواك.","رتّب وقتك وابدأ بالمهارة الأضعف.","أنت قادر على التحسن، استمر.","تقدمك بدأ يظهر، لا تتوقف.","راجع أخطاءك وحوّلها إلى نقاط قوة.","خطوة جميلة، واصل التدريب.","أداؤك يتحسن بثبات.","أنت قريب من المستوى الجيد.","عمل جيد، ركّز على التفاصيل.","ثباتك يصنع الفرق.","مستواك جيد وقابل للارتفاع سريعًا.","أحسنت، حافظ على انتظامك.","تقدم واضح، استمر على خطتك.","أداء قوي، بقيت لمسات بسيطة.","متميز، راجع بذكاء للمحافظة على مستواك.","قريب جدًا من القمة.","أداء رائع ومطمئن.","مبدع، واصل تميزك.","إنجاز استثنائي، أنت قدوة في الاجتهاد."];
const tabs: { key: StudentTab; icon: string; label: string; note: string }[] = [
  { key: "home", icon: "⌂", label: "الرئيسية", note: "ملخص اليوم" },
  { key: "grades", icon: "▥", label: "درجاتي", note: "الأداء والتقدم" },
  { key: "tests", icon: "✓", label: "اختباراتي", note: "الاختبارات والنتائج" },
  { key: "plan", icon: "◎", label: "خطتي", note: "هدفي ومهامي" },
  { key: "ai", icon: "✦", label: "المساعد الذكي", note: "نصيحة وشرح" },
];

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

  if (!selected) {
    return <main className="portal-login student-login-page" dir="rtl">
      <section className="portal-login-shell student-login-shell">
        <div className="portal-login-visual student-login-visual">
          <div><span className="eyebrow">بوابة الطالب وولي الأمر</span><h1>المتابعة التعليمية تبدأ هنا</h1><p>الدرجات والتقدم والغياب والتنبيهات في مساحة موحدة وآمنة.</p></div>
          <div className="student-login-benefits"><span>📚 مواد الطالب</span><span>📊 الدرجات الفعلية</span><span>🔔 تنبيهات ولي الأمر</span></div>
        </div>
        <div className="portal-login-form student-login-form">
          <Link href="/" className="portal-back">← العودة للرئيسية</Link>
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

  return <main className={`student-clean student-theme-${selected.subjectKey} student-portal-v2`} data-subject={selected.subjectKey} dir="rtl">
    <header className="student-clean-head student-identity-head">
      <div><span>{selected.icon} {selected.subjectLabel}</span><h1>{selected.data.name || "الطالب"}</h1><p><b>{classLabel}</b> • {selected.teacherName}</p></div>
      <div className="student-head-actions">
        <button type="button" data-student-action="print" onClick={() => window.print()}>طباعة / PDF</button>
        <button type="button" data-student-action="subjects" className="ghost" onClick={showStudentSubjects}>المواد</button>
        <button type="button" data-student-action="logout" className="ghost" onClick={exitStudentPortal}>تسجيل الخروج</button>
      </div>
    </header>

    <nav className="student-portal-tabs" aria-label="أقسام بوابة الطالب">{tabs.map(tab => <button type="button" key={tab.key} className={activeTab === tab.key ? "active" : ""} onClick={() => setActiveTab(tab.key)}><span>{tab.icon}</span><div><b>{tab.label}</b><small>{tab.note}</small></div></button>)}</nav>

    {activeTab === "home" && <div className="student-tab-panel">
      <section className="student-main-summary"><div className="student-score-ring" style={{ "--score": percentage } as CSSProperties}><strong>{ar(finalTotal)}</strong><span>من {ar(FINAL_MAX)}</span></div><div><small>✦ ملخصك اليوم</small><h2>{percentage >= 90 ? "أداء متميز" : percentage >= 75 ? "تقدم جيد" : "تحتاج إلى خطة تحسين"}</h2><p>{smartMessage}</p><button type="button" className="student-smart-action" onClick={() => setActiveTab("plan")}>ابدأ مهمتي اليوم ←</button></div></section>
      <section className="student-mini-stats"><article><span>الفصل</span><strong>{classLabel}</strong></article><article><span>نسبة الإنجاز</span><strong>{ar(percentage)}٪</strong></article><article><span>الغياب</span><strong>{ar(attendanceSummary.absent)}</strong></article><article><span>التأخر</span><strong>{ar(attendanceSummary.late)}</strong></article></section>
      <section className="student-attendance-summary"><header><div><h2>الحضور والانضباط</h2><p>{attendanceSummary.latestDate ? `آخر تحديث: ${attendanceSummary.latestDate}` : "بانتظار أول تحضير مسجل"}</p></div><div className="attendance-discipline-rate" style={{ "--rate": attendanceSummary.disciplineRate } as CSSProperties}><strong>{ar(attendanceSummary.disciplineRate)}٪</strong></div></header><div className="attendance-discipline-grid"><article><span>الحضور</span><strong>{ar(attendanceSummary.present)}</strong></article><article className="absent"><span>الغياب</span><strong>{ar(attendanceSummary.absent)}</strong></article><article className="late"><span>التأخير</span><strong>{ar(attendanceSummary.late)}</strong></article><article><span>الاستئذان</span><strong>{ar(attendanceSummary.excused)}</strong></article><article className="escaped"><span>الهروب</span><strong>{ar(attendanceSummary.escaped)}</strong></article></div><p className={`attendance-discipline-message ${disciplineClass}`}>{disciplineMessage}</p></section>
      <section className="student-home-grid"><article><small>أقوى أداء</small><strong>{strongestUnit?.label || "لم تُرصد درجات"}</strong><span>{strongestUnit ? `${ar(strongestUnit.total)} من ${ar(UNIT_MAX)}` : "بانتظار الرصد"}</span></article><article><small>يحتاج تركيزًا</small><strong>{weakestUnit?.label || "لم تُرصد درجات"}</strong><span>{weakestUnit ? `${ar(weakestUnit.total)} من ${ar(UNIT_MAX)}` : "بانتظار الرصد"}</span></article><article><small>آخر تنبيه</small><strong>{selected.data.parentCounselorLastNotice?.title || "لا توجد تنبيهات"}</strong><span>{selected.data.parentCounselorLastNotice?.message || selected.data.teacherNote || "أمورك جيدة، استمر."}</span></article></section>
    </div>}

    {activeTab === "grades" && <section className="student-units-table student-tab-panel"><div className="student-section-title"><h2>درجاتي</h2><p>درجات {selected.subjectLabel} للطالب في {classLabel}.</p></div><div className="student-table-scroll"><table><thead><tr><th>الوحدة</th><th>الحضور</th><th>المشاركة</th><th>الواجبات</th><th>الاختبار</th><th>المجموع</th></tr></thead><tbody>{units.map(unit => <tr key={unit.key}><td data-label="الوحدة"><b>{unit.label}</b></td><td data-label="الحضور">{ar(unit.attendance)}/{ar(GRADE_DISTRIBUTION.attendance)}</td><td data-label="المشاركة">{ar(unit.participation)}/{ar(GRADE_DISTRIBUTION.participation)}</td><td data-label="الواجبات">{ar(unit.homework)}/{ar(GRADE_DISTRIBUTION.homework)}</td><td data-label="الاختبار">{ar(unit.unitExam)}/{ar(GRADE_DISTRIBUTION.unitExam)}</td><td data-label="المجموع"><strong>{ar(unit.total)}/{ar(UNIT_MAX)}</strong></td></tr>)}</tbody></table></div></section>}

    {activeTab === "tests" && <div className="student-tab-panel"><StudentDiagnostics accessToken={selected.accessToken} /></div>}

    {activeTab === "plan" && <section className="student-goal-panel student-tab-panel"><div className="student-section-title"><h2>خطتي</h2><p>مهمتك اليوم وهدفك القادم في {selected.subjectLabel}.</p></div><div className="student-plan-layout"><div className="student-goal-card"><div className="goal-ring" style={{ "--goal": Math.min(100, percentage / Math.max(goal, 1) * 100) } as CSSProperties}><strong>{ar(goal)}٪</strong><span>الهدف</span></div><div className="goal-controls"><label>الدرجة المستهدفة<input type="range" min="50" max="100" step="1" value={goal} onChange={event => setGoal(Number(event.target.value))} /></label><div className="goal-numbers"><span>درجتك الحالية <b>{ar(percentage)}٪</b></span><span>الدرجة المطلوبة <b>{ar(targetScore)}</b></span><span>المتبقي <b>{ar(remainingForGoal)}</b></span></div><p className={goalReached ? "goal-success" : ""}>{goalReached ? "أحسنت، وصلت إلى هدفك الحالي." : "ابدأ بالمهمة الأولى ثم انتقل لما بعدها."}</p></div></div><article className="student-today-task"><small>مهمة اليوم</small><ol>{dailyPlan.map(item => <li key={item}>{item}</li>)}</ol></article></div></section>}

    {activeTab === "ai" && <section className="student-ai-hub student-tab-panel"><header><span>✦ AI</span><div><small>المساعد التعليمي الذكي</small><h2>مساعد {selected.subjectLabel}</h2><p>يعتمد على درجاتك الحالية والفصل {classLabel}.</p></div></header><div className="student-ai-grid"><article><small>تحليل المستوى</small><strong>{percentage >= 90 ? "متقدم" : percentage >= 75 ? "جيد" : percentage >= 50 ? "متوسط" : "يحتاج دعمًا"}</strong><p>{smartMessage}</p></article><article><small>الأولوية الآن</small><strong>{weakestUnit?.label || "ابدأ بالمراجعة"}</strong><p>ابدأ بالمهارة الأقل درجة، ثم اختبر نفسك بعد المراجعة مباشرة.</p></article><article><small>الانضباط</small><strong>{ar(attendanceSummary.disciplineRate)}٪</strong><p>{disciplineMessage}</p></article><article><small>رسالة تحفيزية</small><strong>{percentage >= 80 ? "أنت قريب من التميز" : "كل خطوة تصنع فرقًا"}</strong><p>أنهِ مهمة واحدة اليوم وسجّل ما تعلمته قبل الانتقال للمهمة التالية.</p></article></div></section>}
  </main>;
}
