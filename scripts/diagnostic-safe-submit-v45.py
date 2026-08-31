from pathlib import Path

root = Path('.')

portal_auth = root / 'lib/server/portal-auth.ts'
text = portal_auth.read_text(encoding='utf-8')
needle = '''export function readStudentAccessToken(value?: string): StudentAccess | null {
  if (!value) return null;
  try {
    const [payload, signature] = value.split(".");
    if (!payload || !signature) return null;
    const expected = Buffer.from(sign(payload));
    const received = Buffer.from(signature);
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
    const access = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as StudentAccess;
    return access.expiresAt > Date.now() && access.studentId && access.teacherId && access.subjectId ? access : null;
  } catch {
    return null;
  }
}
'''
addition = needle + '''
export type DiagnosticRecoveryResult = {
  diagnosticId: string;
  studentId: string;
  teacherId: string;
  subjectId: string;
  score: number;
  total: number;
  percentage: number;
  plan: string;
  weakSkills: string[];
  submittedAt: string;
};

type DiagnosticRecoveryPayload = {
  version: 1;
  result: DiagnosticRecoveryResult;
  expiresAt: number;
};

export function createDiagnosticRecoveryCode(result: DiagnosticRecoveryResult) {
  const recovery: DiagnosticRecoveryPayload = {
    version: 1,
    result,
    expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 45,
  };
  const payload = Buffer.from(JSON.stringify(recovery)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readDiagnosticRecoveryCode(value?: string): DiagnosticRecoveryResult | null {
  if (!value) return null;
  try {
    const [payload, signature] = value.split(".");
    if (!payload || !signature) return null;
    const expected = Buffer.from(sign(payload));
    const received = Buffer.from(signature);
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
    const recovery = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as DiagnosticRecoveryPayload;
    const result = recovery.result;
    if (recovery.version !== 1 || recovery.expiresAt <= Date.now() || !result) return null;
    if (!result.diagnosticId || !result.studentId || !result.teacherId || !result.subjectId) return null;
    if (!Number.isFinite(result.score) || !Number.isFinite(result.total) || !Number.isFinite(result.percentage)) return null;
    return {
      ...result,
      plan: String(result.plan || "راجع المهارات التي لم تتقنها مع المعلم."),
      weakSkills: Array.isArray(result.weakSkills) ? result.weakSkills.map(String) : [],
      submittedAt: String(result.submittedAt || new Date().toISOString()),
    };
  } catch {
    return null;
  }
}
'''
if 'createDiagnosticRecoveryCode' not in text:
    if needle not in text:
        raise SystemExit('portal auth anchor not found')
    text = text.replace(needle, addition)
    portal_auth.write_text(text, encoding='utf-8')

api_route = root / 'app/api/student/diagnostics/route.ts'
api_route.write_text('''import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import {
  createDiagnosticRecoveryCode,
  readStudentAccessToken,
  type DiagnosticRecoveryResult,
} from "../../../../lib/server/portal-auth";

const WRITE_TIMEOUT_MS = 5500;

function accessFrom(request: Request) {
  const header = request.headers.get("authorization") || "";
  return readStudentAccessToken(header.startsWith("Bearer ") ? header.slice(7) : "");
}

function withTimeout<T>(promise: Promise<T>, milliseconds = WRITE_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("diagnostic_write_timeout")), milliseconds)),
  ]);
}

export async function GET(request: Request) {
  const access = accessFrom(request);
  if (!access) return NextResponse.json({ ok: false }, { status: 401 });
  const root = `portalV2Data/${access.teacherId}/subjects/${access.subjectId}`;
  const [tests, results] = await Promise.all([
    adminDb().collection(`${root}/diagnostics`).where("published", "==", true).get(),
    adminDb().collection(`${root}/diagnosticResults`).where("studentId", "==", access.studentId).get(),
  ]);
  const completed = new Map(results.docs.map((item) => [item.data().diagnosticId, item.data()]));
  const diagnostics = tests.docs.map((item) => {
    const data = item.data();
    const result = completed.get(item.id);
    return {
      id: item.id,
      title: data.title,
      instructions: data.instructions || "",
      questionCount: Array.isArray(data.questions) ? data.questions.length : 0,
      questions: result ? [] : (data.questions || []).map((question: Record<string, unknown>) => ({ id: question.id, text: question.text, options: question.options, skill: question.skill || "" })),
      completed: !!result,
      result: result ? { score: result.score, total: result.total, percentage: result.percentage, plan: result.teacherPlan || result.plan, weakSkills: result.weakSkills || [] } : null,
    };
  });
  return NextResponse.json({ ok: true, diagnostics });
}

export async function POST(request: Request) {
  const access = accessFrom(request);
  if (!access) return NextResponse.json({ ok: false, message: "انتهت جلسة الطالب. أعد الدخول وسيستمر الإرسال تلقائيًا." }, { status: 401 });
  const body = await request.json();
  const diagnosticId = String(body?.diagnosticId || "");
  const answers = body?.answers && typeof body.answers === "object" ? body.answers as Record<string, number> : {};
  if (!diagnosticId) return NextResponse.json({ ok: false, message: "بيانات الاختبار غير مكتملة." }, { status: 400 });

  const root = `portalV2Data/${access.teacherId}/subjects/${access.subjectId}`;
  const resultId = `${diagnosticId}__${access.studentId}`;
  const resultRef = adminDb().collection(`${root}/diagnosticResults`).doc(resultId);
  const existing = await resultRef.get();
  if (existing.exists) {
    const stored = existing.data() || {};
    return NextResponse.json({
      ok: true,
      alreadySubmitted: true,
      result: {
        score: stored.score,
        total: stored.total,
        percentage: stored.percentage,
        plan: stored.teacherPlan || stored.plan,
        weakSkills: stored.weakSkills || [],
      },
    });
  }

  const test = await adminDb().collection(`${root}/diagnostics`).doc(diagnosticId).get();
  if (!test.exists || test.data()?.published !== true) return NextResponse.json({ ok: false, message: "الاختبار غير متاح حاليًا." }, { status: 404 });
  const data = test.data()!;
  const questions = Array.isArray(data.questions) ? data.questions : [];
  if (!questions.length) return NextResponse.json({ ok: false, message: "لا توجد أسئلة في الاختبار." }, { status: 400 });

  let score = 0;
  const weakSkills = new Set<string>();
  for (const question of questions) {
    const correct = Number(answers[String(question.id)]) === Number(question.correctIndex);
    if (correct) score += 1;
    else if (question.skill) weakSkills.add(String(question.skill));
  }
  const total = questions.length;
  const percentage = total ? Math.round((score / total) * 100) : 0;
  const plans = data.plans || {};
  const plan = percentage >= 80 ? plans.high : percentage >= 50 ? plans.medium : plans.low;
  const result: DiagnosticRecoveryResult = {
    diagnosticId,
    studentId: access.studentId,
    teacherId: access.teacherId,
    subjectId: access.subjectId,
    score,
    total,
    percentage,
    plan: plan || "راجع المهارات التي لم تتقنها مع المعلم.",
    weakSkills: [...weakSkills],
    submittedAt: new Date().toISOString(),
  };
  const recoveryCode = createDiagnosticRecoveryCode(result);

  try {
    await withTimeout(resultRef.set(result));
    return NextResponse.json({ ok: true, pending: false, result, recoveryCode });
  } catch {
    return NextResponse.json({
      ok: true,
      pending: true,
      result,
      recoveryCode,
      message: "تم تصحيح الاختبار وحفظ النتيجة بأمان على جهازك، وسيعاد إرسالها تلقائيًا إلى المعلم.",
    }, { status: 202 });
  }
}
''', encoding='utf-8')

recover_route = root / 'app/api/student/diagnostics/recover/route.ts'
recover_route.parent.mkdir(parents=True, exist_ok=True)
recover_route.write_text('''import { NextResponse } from "next/server";
import { adminDb } from "../../../../../lib/server/firebase-admin";
import { readDiagnosticRecoveryCode } from "../../../../../lib/server/portal-auth";

const WRITE_TIMEOUT_MS = 5500;

function withTimeout<T>(promise: Promise<T>, milliseconds = WRITE_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("diagnostic_recovery_timeout")), milliseconds)),
  ]);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const result = readDiagnosticRecoveryCode(String(body?.recoveryCode || ""));
  if (!result) return NextResponse.json({ ok: false, message: "إيصال النتيجة غير صالح أو انتهت مدته." }, { status: 400 });

  const root = `portalV2Data/${result.teacherId}/subjects/${result.subjectId}`;
  const resultId = `${result.diagnosticId}__${result.studentId}`;
  const resultRef = adminDb().collection(`${root}/diagnosticResults`).doc(resultId);
  try {
    const existing = await withTimeout(resultRef.get());
    if (existing.exists) return NextResponse.json({ ok: true, synced: true, alreadySubmitted: true });
    await withTimeout(resultRef.set(result));
    return NextResponse.json({ ok: true, synced: true });
  } catch {
    return NextResponse.json({ ok: false, synced: false, message: "المزامنة السحابية غير متاحة مؤقتًا." }, { status: 503 });
  }
}
''', encoding='utf-8')

student_component = root / 'app/student/student-diagnostics.tsx'
student_component.write_text('''"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Question = { id: string; text: string; options: string[]; skill: string };
type Result = { score: number; total: number; percentage: number; plan: string; weakSkills: string[] };
type Diagnostic = { id: string; title: string; instructions: string; questionCount: number; questions: Question[]; completed: boolean; result: Result | null };
type PortalTab = "ai" | "tests";
type PendingSubmission = {
  id: string;
  diagnosticId: string;
  title: string;
  answers?: Record<string, number>;
  result?: Result;
  recoveryCode?: string;
  savedAt: string;
};

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

function accessIdentity(accessToken: string) {
  try {
    const payload = accessToken.split(".")[0];
    const decoded = JSON.parse(decodeURIComponent(escape(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))))) as { studentId?: string; teacherId?: string; subjectId?: string };
    return [decoded.teacherId, decoded.subjectId, decoded.studentId].map(value => String(value || "unknown")).join(":");
  } catch {
    return "current-student";
  }
}

function readQueue(key: string): PendingSubmission[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
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
  const [pending, setPending] = useState<PendingSubmission[]>([]);
  const syncing = useRef(false);
  const queueKey = useMemo(() => `lahooni-diagnostic-pending-v45:${accessIdentity(accessToken)}`, [accessToken]);

  const writeQueue = useCallback((entries: PendingSubmission[]) => {
    localStorage.setItem(queueKey, JSON.stringify(entries));
    setPending(entries);
  }, [queueKey]);

  const mergePending = useCallback((diagnostics: Diagnostic[], entries: PendingSubmission[]) => diagnostics.map(item => {
    const saved = entries.find(entry => entry.diagnosticId === item.id);
    if (!saved?.result || item.completed) return item;
    return { ...item, completed: true, questions: [], result: saved.result };
  }), []);

  async function load(selectResult = true) {
    setLoading(true);
    try {
      const response = await fetch("/api/student/diagnostics", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
      const data = await response.json();
      if (response.ok) {
        const entries = readQueue(queueKey);
        const diagnostics = mergePending(data.diagnostics || [], entries);
        setItems(diagnostics);
        const latest = diagnostics.find((item: Diagnostic) => item.completed && item.result);
        if (selectResult && latest) setResultView({ title: latest.title, result: latest.result });
      } else setMessage("تعذر تحميل الاختبارات.");
    } finally { setLoading(false); }
  }

  const syncPending = useCallback(async () => {
    if (syncing.current) return;
    const entries = readQueue(queueKey);
    if (!entries.length) return;
    syncing.current = true;
    let remaining = [...entries];
    let syncedAny = false;
    try {
      for (const entry of entries) {
        try {
          const response = entry.recoveryCode
            ? await fetch("/api/student/diagnostics/recover", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ recoveryCode: entry.recoveryCode }),
              })
            : await fetch("/api/student/diagnostics", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
                body: JSON.stringify({ diagnosticId: entry.diagnosticId, answers: entry.answers || {} }),
              });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) continue;
          if (data.pending && data.recoveryCode) {
            remaining = remaining.map(item => item.id === entry.id ? { ...item, result: data.result, recoveryCode: data.recoveryCode, answers: undefined } : item);
            if (data.result) setResultView({ title: entry.title, result: data.result });
            continue;
          }
          remaining = remaining.filter(item => item.id !== entry.id);
          syncedAny = true;
          if (data.result) setResultView({ title: entry.title, result: data.result });
        } catch {
          // تبقى المحاولة محفوظة على جهاز الطالب حتى تنجح المزامنة.
        }
      }
      writeQueue(remaining);
      if (syncedAny) {
        setMessage("تم إرسال النتيجة المحفوظة إلى بوابة المعلم بنجاح.");
        void load(false);
      }
    } finally {
      syncing.current = false;
    }
  }, [accessToken, queueKey, writeQueue]);

  useEffect(() => {
    const entries = readQueue(queueKey);
    setPending(entries);
    void load(true);
    const start = window.setTimeout(() => void syncPending(), 1200);
    const timer = window.setInterval(() => void syncPending(), 30000);
    const online = () => void syncPending();
    window.addEventListener("online", online);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(timer);
      window.removeEventListener("online", online);
    };
  }, [accessToken, queueKey, syncPending]);

  const progress = active?.questions.length ? Math.round(Object.keys(answers).length / active.questions.length * 100) : 0;
  const latestResult = resultView?.result || items.find(item => item.completed && item.result)?.result || pending.find(item => item.result)?.result || null;
  const motivation = useMemo(() => latestResult ? messages[Math.min(20, Math.max(0, Math.floor(latestResult.percentage / 5)))] : "أنا جاهز لتحليل مستواك وبناء خطة تناسبك.", [latestResult]);
  const plan = useMemo(() => dailyPlan(latestResult), [latestResult]);
  const pendingIds = useMemo(() => new Set(pending.map(item => item.diagnosticId)), [pending]);

  async function submit() {
    if (!active || Object.keys(answers).length !== active.questions.length) return setMessage("أجب عن جميع الأسئلة أولًا.");
    setSubmitting(true);
    const title = active.title;
    const diagnosticId = active.id;
    const entry: PendingSubmission = {
      id: `${diagnosticId}:${Date.now()}`,
      diagnosticId,
      title,
      answers: { ...answers },
      savedAt: new Date().toISOString(),
    };
    const queue = readQueue(queueKey).filter(item => item.diagnosticId !== diagnosticId);
    writeQueue([...queue, entry]);
    try {
      const response = await fetch("/api/student/diagnostics", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ diagnosticId, answers }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(data.message || "تم حفظ إجاباتك على هذا الجهاز وسيعاد إرسالها تلقائيًا. لا تمسح بيانات المتصفح.");
        return;
      }
      setResultView({ title, result: data.result });
      setActive(null); setAnswers({}); setTab("ai");
      setItems(current => current.map(item => item.id === diagnosticId ? { ...item, completed: true, questions: [], result: data.result } : item));
      if (data.pending && data.recoveryCode) {
        const updated = readQueue(queueKey).map(item => item.diagnosticId === diagnosticId ? { ...item, answers: undefined, result: data.result, recoveryCode: data.recoveryCode } : item);
        writeQueue(updated);
        setMessage(data.message || "تم حفظ النتيجة بأمان، وستصل إلى المعلم تلقائيًا عند عودة المزامنة.");
      } else {
        writeQueue(readQueue(queueKey).filter(item => item.diagnosticId !== diagnosticId));
        setMessage("تم تسليم الاختبار ووصلت النتيجة إلى بوابة المعلم.");
        await load(false);
      }
    } catch {
      setActive(null); setAnswers({}); setTab("tests");
      setMessage("تم حفظ إجاباتك كاملة على هذا الجهاز وسيعاد إرسالها تلقائيًا. لا تمسح بيانات المتصفح أو التطبيق.");
    } finally { setSubmitting(false); }
  }

  async function copyReceipt() {
    const receipt = pending.find(item => item.recoveryCode)?.recoveryCode;
    if (!receipt) return setMessage("إجاباتك محفوظة، وبانتظار التصحيح التلقائي لإصدار إيصال النتيجة.");
    try {
      await navigator.clipboard.writeText(receipt);
      setMessage("تم نسخ إيصال النتيجة الاحتياطي.");
    } catch {
      setMessage(`إيصال النتيجة: ${receipt}`);
    }
  }

  return <section className="student-diagnostics">
    <div className="student-section-title"><h2>مركز الطالب الذكي</h2><p>المساعد الذكي والاختبارات والخطة العلاجية في مساحة واحدة.</p></div>
    <div className="student-ai-tabs" role="tablist" aria-label="أقسام مركز الطالب الذكي">
      <button className={tab === "ai" ? "active" : ""} onClick={() => setTab("ai")} role="tab" aria-selected={tab === "ai"}><span>✦</span><b>المساعد الذكي</b><small>تحليل وخطة يومية</small></button>
      <button className={tab === "tests" ? "active" : ""} onClick={() => setTab("tests")} role="tab" aria-selected={tab === "tests"}><span>✓</span><b>الاختبارات التشخيصية</b><small>{items.length ? `${items.length} اختبار` : "الاختبارات المتاحة"}</small></button>
    </div>
    {message && <p className="student-diagnostic-message" role="status">{message}</p>}
    {pending.length ? <div className="student-diagnostic-message" role="status" style={{display:"flex",gap:10,alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",border:"2px solid #d59a22",background:"#fff8df",color:"#503600"}}><b>محفوظ بأمان: {pending.length} نتيجة أو محاولة بانتظار المزامنة التلقائية.</b><button type="button" onClick={copyReceipt} style={{border:0,borderRadius:10,padding:"9px 14px",fontWeight:900,cursor:"pointer"}}>نسخ إيصال احتياطي</button></div> : null}

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
      <div className="diagnostic-tests">{loading ? <p>جارٍ تحميل الاختبارات…</p> : !items.length ? <p>لا توجد اختبارات منشورة لهذه المادة حاليًا.</p> : items.map(item => <article key={item.id}><div><strong>{item.title}</strong><small>{item.questionCount} أسئلة • {item.completed ? "تم الأداء" : pendingIds.has(item.id) ? "محفوظ وبانتظار الإرسال" : "متاح الآن"}</small></div>{item.completed && item.result ? <button className="result-button" onClick={() => { setResultView({ title: item.title, result: item.result! }); setTab("ai"); }}>عرض التحليل الذكي</button> : pendingIds.has(item.id) ? <button disabled>بانتظار المزامنة</button> : <button onClick={() => { setActive(item); setAnswers({}); setMessage(""); }}>بدء الاختبار</button>}</article>)}</div>
    </div>}

    {active && <div className="diagnostic-modal" role="dialog" aria-modal="true"><section><header><div><small>اختبار تشخيصي</small><h2>{active.title}</h2><p>{active.instructions}</p></div><button onClick={() => setActive(null)}>إغلاق</button></header><div className="diagnostic-progress"><span style={{ width: `${progress}%` }} /><b>{progress}٪ مكتمل</b></div>{active.questions.map((question, index) => <fieldset key={question.id}><legend>{index + 1}. {question.text}</legend>{question.options.map((option, optionIndex) => <label key={optionIndex} className={answers[question.id] === optionIndex ? "selected" : ""}><input type="radio" name={question.id} checked={answers[question.id] === optionIndex} onChange={() => setAnswers(current => ({ ...current, [question.id]: optionIndex }))} /><span>{option}</span></label>)}</fieldset>)}<button className="submit-diagnostic" disabled={submitting} onClick={submit}>{submitting ? "جارٍ التصحيح والحفظ…" : "تسليم الاختبار وإظهار الخطة"}</button></section></div>}
  </section>;
}
''', encoding='utf-8')

for path in [root / 'public/sw.js', root / 'app/pwa-register.tsx']:
    value = path.read_text(encoding='utf-8')
    value = value.replace('ostadh-lahooni-v44-attendance-local-timetable', 'ostadh-lahooni-v45-diagnostic-safe-submit')
    value = value.replace('/sw.js?v=44-attendance-local-timetable', '/sw.js?v=45-diagnostic-safe-submit')
    path.write_text(value, encoding='utf-8')

print('diagnostic safe submit v45 applied')
