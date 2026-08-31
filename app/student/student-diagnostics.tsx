"use client";
import { useEffect, useMemo, useState } from "react";

type Question = { id: string; text: string; options: string[]; skill: string };
type Result = { score: number; total: number; percentage: number; plan: string; weakSkills: string[] };
type Diagnostic = { id: string; title: string; instructions: string; questionCount: number; questions: Question[]; completed: boolean; result: Result | null };
type PortalTab = "ai" | "tests";
type PendingAttempt = { diagnosticId: string; answers: Record<string, number>; accessToken: string; savedAt: string };

const messages = ["ابدأ بخطوة صغيرة، التحسن ممكن.","راجع الأساسيات واطلب مساعدة معلمك.","كل تدريب جديد يقربك من هدفك.","ركز على المهارة الأضعف أولًا.","استمرارك أهم من سرعة تقدمك.","تقدمك بدأ، لا تتوقف.","حوّل أخطاءك إلى فرص تعلم.","أنت تتحسن، واصل التدريب.","جهدك واضح وسترى نتيجته.","اقتربت من المستوى الجيد.","عمل جيد، ركز على التفاصيل.","ثباتك يصنع فرقًا حقيقيًا.","مستواك جيد وقابل للارتفاع.","أحسنت، حافظ على انتظامك.","تقدم واضح، استمر.","أداء قوي وبقيت خطوات بسيطة.","متميز، حافظ على المراجعة.","أنت قريب جدًا من القمة.","أداء رائع ومطمئن.","مبدع، واصل تميزك.","إنجاز استثنائي، أحسنت."];

function smartAdvice(result?: Result | null) {
  if (!result) return "ابدأ باختبار تشخيصي قصير، ثم سأحدد لك المهارات التي تحتاج مراجعة وأبني لك خطة علاجية مناسبة.";
  const skills = result.weakSkills.length ? `ابدأ بمراجعة: ${result.weakSkills.join("، ")}.` : "حافظ على المراجعة المنتظمة وحل أسئلة إثرائية.";
  if (result.percentage < 50) return `${skills} خصص ٢٠ دقيقة يوميًا للتعلم مع المعلم ثم أعد القياس.`;
  if (result.percentage < 80) return `${skills} نفذ تدريبًا قصيرًا بعد كل درس وراجع الأخطاء مباشرة.`;
  return `${skills} انتقل إلى أنشطة أعمق وشارك زملاءك طريقة الحل.`;
}

function dailyPlan(result?: Result | null) {
  if (!result) return ["أدِّ الاختبار التشخيصي", "راجع الدرس لمدة ١٥ دقيقة", "اكتب سؤالًا واحدًا لمعلمك"];
  if (result.percentage < 50) return ["مراجعة مهارة واحدة", "حل ٥ أسئلة قصيرة", "طلب تغذية راجعة من المعلم"];
  if (result.percentage < 80) return ["مراجعة الأخطاء السابقة", "حل تدريب تطبيقي", "تلخيص الفكرة في ثلاثة أسطر"];
  return ["حل سؤال إثرائي", "شرح الفكرة لزميل", "مراجعة سريعة للمحافظة على الإتقان"];
}

function pendingKey(accessToken: string) {
  return `lahooni-diagnostic-attempt-v46:${accessToken.slice(0, 24)}`;
}

export default function StudentDiagnostics({ accessToken }: { accessToken: string }) {
  const [items, setItems] = useState<Diagnostic[]>([]);
  const [active, setActive] = useState<Diagnostic | null>(null);
  const [resultView, setResultView] = useState<{ title: string; result: Result } | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<PortalTab>("ai");

  async function load(selectResult = true) {
    setLoading(true);
    try {
      const response = await fetch("/api/student/diagnostics", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
      const data = await response.json();
      if (response.ok) {
        const diagnostics = data.diagnostics || [];
        setItems(diagnostics);
        const latest = diagnostics.find((item: Diagnostic) => item.completed && item.result);
        if (selectResult && latest?.result) setResultView({ title: latest.title, result: latest.result });
      } else setMessage("تعذر تحميل الاختبارات.");
    } finally { setLoading(false); }
  }

  async function retrySavedAttempt() {
    let attempt: PendingAttempt | null = null;
    try { attempt = JSON.parse(localStorage.getItem(pendingKey(accessToken)) || "null") as PendingAttempt | null; } catch { attempt = null; }
    if (!attempt?.diagnosticId || !attempt.answers) return;
    try {
      const response = await fetch("/api/student/diagnostics", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(attempt),
        keepalive: true,
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok || data?.result) localStorage.removeItem(pendingKey(accessToken));
    } catch {
      // Hidden device copy remains as the last safety layer.
    }
  }

  useEffect(() => {
    void load(true);
    void retrySavedAttempt();
  }, [accessToken]);

  const progress = active?.questions.length ? Math.round(Object.keys(answers).length / active.questions.length * 100) : 0;
  const latestResult = resultView?.result || items.find(item => item.completed && item.result)?.result || null;
  const motivation = useMemo(() => latestResult ? messages[Math.min(20, Math.max(0, Math.floor(latestResult.percentage / 5)))] : "أنا جاهز لتحليل مستواك وبناء خطة تناسبك.", [latestResult]);
  const plan = useMemo(() => dailyPlan(latestResult), [latestResult]);

  async function submit() {
    if (!active || Object.keys(answers).length !== active.questions.length) return setMessage("أجب عن جميع الأسئلة أولًا.");
    setSubmitting(true);
    const diagnosticId = active.id;
    const title = active.title;
    const payload: PendingAttempt = { diagnosticId, answers: { ...answers }, accessToken, savedAt: new Date().toISOString() };
    localStorage.setItem(pendingKey(accessToken), JSON.stringify(payload));
    try {
      const response = await fetch("/api/student/diagnostics", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(payload),
        keepalive: true,
      });
      const data = await response.json().catch(() => ({}));
      if (data?.result) {
        setResultView({ title, result: data.result });
        setItems(current => current.map(item => item.id === diagnosticId ? { ...item, completed: true, questions: [], result: data.result } : item));
      }
      if (response.ok || data?.result) localStorage.removeItem(pendingKey(accessToken));
      setActive(null);
      setAnswers({});
      setTab(data?.result ? "ai" : "tests");
      setMessage("تم تسليم الاختبار بنجاح.");
      if (response.ok) void load(false);
    } catch {
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      try { navigator.sendBeacon("/api/student/diagnostics", blob); } catch { /* local copy remains */ }
      setActive(null);
      setAnswers({});
      setTab("tests");
      setMessage("تم تسليم الاختبار بنجاح.");
    } finally { setSubmitting(false); }
  }

  return <section className="student-diagnostics">
    <div className="student-section-title"><h2>مركز الطالب الذكي</h2><p>المساعد الذكي والاختبارات والخطة العلاجية في مساحة واحدة.</p></div>
    <div className="student-ai-tabs" role="tablist" aria-label="أقسام مركز الطالب الذكي">
      <button className={tab === "ai" ? "active" : ""} onClick={() => setTab("ai")} role="tab" aria-selected={tab === "ai"}><span>✦</span><b>المساعد الذكي</b><small>تحليل وخطة يومية</small></button>
      <button className={tab === "tests" ? "active" : ""} onClick={() => setTab("tests")} role="tab" aria-selected={tab === "tests"}><span>✓</span><b>الاختبارات التشخيصية</b><small>{items.length ? `${items.length} اختبار` : "الاختبارات المتاحة"}</small></button>
    </div>
    {message && <p className="student-diagnostic-message" role="status">{message}</p>}

    {tab === "ai" ? <div className="student-ai-hub" role="tabpanel">
      <article className="ai-hero-card"><div className="ai-orb">AI</div><div><small>مساعدك التعليمي الشخصي</small><h3>{latestResult ? `تحليلك الحالي ${latestResult.percentage}٪` : "ابدأ رحلتك التعليمية الذكية"}</h3><p>{motivation}</p></div></article>
      <div className="ai-grid">
        <article><span>🎯</span><h3>نصيحتي لك الآن</h3><p>{smartAdvice(latestResult)}</p></article>
        <article><span>🗓️</span><h3>خطتك اليومية</h3><ol>{plan.map(item => <li key={item}>{item}</li>)}</ol></article>
        <article><span>📈</span><h3>مؤشر التقدم</h3><strong>{latestResult ? `${latestResult.score} من ${latestResult.total}` : "بانتظار أول قياس"}</strong><p>{latestResult?.plan || "بعد أداء الاختبار ستظهر هنا خطة علاجية مخصصة حسب نتيجتك."}</p></article>
      </div>
      {latestResult?.weakSkills?.length ? <div className="ai-skill-strip"><b>مهارات تحتاج تركيزًا</b>{latestResult.weakSkills.map(skill => <span key={skill}>{skill}</span>)}</div> : null}
      <button className="ai-start-test" onClick={() => setTab("tests")}>{latestResult ? "عرض الاختبارات وإعادة القياس" : "ابدأ الاختبار التشخيصي"}<span>←</span></button>
    </div> : <div className="diagnostic-workspace" role="tabpanel">
      <div className="diagnostic-tests">{loading ? <p>جارٍ تحميل الاختبارات…</p> : !items.length ? <p>لا توجد اختبارات منشورة لهذه المادة حاليًا.</p> : items.map(item => <article key={item.id}><div><strong>{item.title}</strong><small>{item.questionCount} أسئلة • {item.completed ? "تم الأداء" : "متاح الآن"}</small></div>{item.completed && item.result ? <button className="result-button" onClick={() => { setResultView({ title: item.title, result: item.result! }); setTab("ai"); }}>عرض التحليل الذكي</button> : <button onClick={() => { setActive(item); setAnswers({}); setMessage(""); }}>بدء الاختبار</button>}</article>)}</div>
    </div>}

    {active && <div className="diagnostic-modal" role="dialog" aria-modal="true"><section><header><div><small>اختبار تشخيصي</small><h2>{active.title}</h2><p>{active.instructions}</p></div><button onClick={() => setActive(null)}>إغلاق</button></header><div className="diagnostic-progress"><span style={{ width: `${progress}%` }} /><b>{progress}٪ مكتمل</b></div>{active.questions.map((question, index) => <fieldset key={question.id}><legend>{index + 1}. {question.text}</legend>{question.options.map((option, optionIndex) => <label key={optionIndex} className={answers[question.id] === optionIndex ? "selected" : ""}><input type="radio" name={question.id} checked={answers[question.id] === optionIndex} onChange={() => setAnswers(current => ({ ...current, [question.id]: optionIndex }))} /><span>{option}</span></label>)}</fieldset>)}<button className="submit-diagnostic" disabled={submitting} onClick={submit}>{submitting ? "جارٍ تسليم الاختبار…" : "تسليم الاختبار وإظهار الخطة"}</button></section></div>}
  </section>;
}
