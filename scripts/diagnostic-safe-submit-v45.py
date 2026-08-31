from pathlib import Path

root = Path('.')

# 1) Signed recovery receipts kept in private Vercel logs as a third safety layer.
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
    expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 60,
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
    if (recovery.version != 1 || recovery.expiresAt <= Date.now() || !result) return null;
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
    portal_auth.write_text(text.replace(needle, addition), encoding='utf-8')

# 2) Vercel Runtime Cache: cloud backup independent from Firestore quotas.
backup = root / 'lib/server/diagnostic-backup.ts'
backup.write_text('''import "server-only";

import { createHash } from "node:crypto";
import { getCache } from "@vercel/functions";
import type { DiagnosticRecoveryResult } from "./portal-auth";

const BACKUP_TTL_SECONDS = 60 * 60 * 24 * 60;
const CACHE_PREFIX = "lahooni-diagnostic-v46";

function digest(parts: string[]) {
  return createHash("sha256").update(parts.join("\\u001f")).digest("hex");
}

function resultKey(teacherId: string, subjectId: string, diagnosticId: string, studentId: string) {
  return `${CACHE_PREFIX}:result:${digest([teacherId, subjectId, diagnosticId, studentId])}`;
}

function diagnosticTag(teacherId: string, subjectId: string, diagnosticId: string) {
  return `${CACHE_PREFIX}:test:${digest([teacherId, subjectId, diagnosticId]).slice(0, 48)}`;
}

function validResult(value: unknown): DiagnosticRecoveryResult | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<DiagnosticRecoveryResult>;
  if (!item.diagnosticId || !item.studentId || !item.teacherId || !item.subjectId) return null;
  if (!Number.isFinite(item.score) || !Number.isFinite(item.total) || !Number.isFinite(item.percentage)) return null;
  return {
    diagnosticId: String(item.diagnosticId),
    studentId: String(item.studentId),
    teacherId: String(item.teacherId),
    subjectId: String(item.subjectId),
    score: Number(item.score),
    total: Number(item.total),
    percentage: Number(item.percentage),
    plan: String(item.plan || "راجع المهارات التي لم تتقنها مع المعلم."),
    weakSkills: Array.isArray(item.weakSkills) ? item.weakSkills.map(String) : [],
    submittedAt: String(item.submittedAt || new Date().toISOString()),
  };
}

export async function saveDiagnosticBackup(result: DiagnosticRecoveryResult) {
  const cache = getCache();
  await cache.set(
    resultKey(result.teacherId, result.subjectId, result.diagnosticId, result.studentId),
    result,
    {
      ttl: BACKUP_TTL_SECONDS,
      tags: [diagnosticTag(result.teacherId, result.subjectId, result.diagnosticId)],
      name: "Ostadh Lahooni diagnostic result backup",
    },
  );
}

export async function readDiagnosticBackup(
  teacherId: string,
  subjectId: string,
  diagnosticId: string,
  studentId: string,
) {
  const value = await getCache().get(resultKey(teacherId, subjectId, diagnosticId, studentId));
  const result = validResult(value);
  if (!result) return null;
  if (result.teacherId !== teacherId || result.subjectId !== subjectId || result.diagnosticId !== diagnosticId || result.studentId !== studentId) return null;
  return result;
}

export async function readDiagnosticBackups(
  teacherId: string,
  subjectId: string,
  diagnosticId: string,
  studentIds: string[],
) {
  const uniqueIds = [...new Set(studentIds.map(String).map(value => value.trim()).filter(Boolean))].slice(0, 500);
  const values = await Promise.all(uniqueIds.map(studentId => readDiagnosticBackup(teacherId, subjectId, diagnosticId, studentId).catch(() => null)));
  const unique = new Map<string, DiagnosticRecoveryResult>();
  values.forEach(result => {
    if (!result) return;
    const current = unique.get(result.studentId);
    if (!current || Date.parse(result.submittedAt) >= Date.parse(current.submittedAt)) unique.set(result.studentId, result);
  });
  return [...unique.values()];
}
''', encoding='utf-8')

# 3) Student submit route: cache first, Firestore second, private recovery log third.
api_route = root / 'app/api/student/diagnostics/route.ts'
api_route.write_text('''import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { readDiagnosticBackup, saveDiagnosticBackup } from "../../../../lib/server/diagnostic-backup";
import {
  createDiagnosticRecoveryCode,
  readStudentAccessToken,
  type DiagnosticRecoveryResult,
} from "../../../../lib/server/portal-auth";

export const runtime = "nodejs";
export const maxDuration = 30;

const FIRESTORE_WRITE_TIMEOUT_MS = 5500;
const BACKUP_WRITE_TIMEOUT_MS = 4000;

function accessFrom(request: Request, body?: Record<string, unknown>) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : String(body?.accessToken || "");
  return readStudentAccessToken(token);
}

function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("operation_timeout")), milliseconds)),
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
  const completed = new Map(results.docs.map((item) => [String(item.data().diagnosticId || ""), item.data()]));
  const diagnostics = await Promise.all(tests.docs.map(async item => {
    const data = item.data();
    const firestoreResult = completed.get(item.id);
    const backupResult = firestoreResult ? null : await readDiagnosticBackup(access.teacherId, access.subjectId, item.id, access.studentId).catch(() => null);
    const result = firestoreResult || backupResult;
    return {
      id: item.id,
      title: data.title,
      instructions: data.instructions || "",
      questionCount: Array.isArray(data.questions) ? data.questions.length : 0,
      questions: result ? [] : (data.questions || []).map((question: Record<string, unknown>) => ({ id: question.id, text: question.text, options: question.options, skill: question.skill || "" })),
      completed: !!result,
      result: result ? { score: result.score, total: result.total, percentage: result.percentage, plan: result.teacherPlan || result.plan, weakSkills: result.weakSkills || [] } : null,
    };
  }));
  return NextResponse.json({ ok: true, diagnostics });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const access = accessFrom(request, body);
  if (!access) return NextResponse.json({ ok: false, message: "انتهت جلسة الطالب." }, { status: 401 });
  const diagnosticId = String(body.diagnosticId || "");
  const answers = body.answers && typeof body.answers === "object" ? body.answers as Record<string, number> : {};
  if (!diagnosticId) return NextResponse.json({ ok: false, message: "بيانات الاختبار غير مكتملة." }, { status: 400 });

  const root = `portalV2Data/${access.teacherId}/subjects/${access.subjectId}`;
  const resultId = `${diagnosticId}__${access.studentId}`;
  const resultRef = adminDb().collection(`${root}/diagnosticResults`).doc(resultId);

  try {
    const existing = await resultRef.get();
    if (existing.exists) {
      const stored = existing.data() || {};
      return NextResponse.json({ ok: true, alreadySubmitted: true, result: { score: stored.score, total: stored.total, percentage: stored.percentage, plan: stored.teacherPlan || stored.plan, weakSkills: stored.weakSkills || [] } });
    }
  } catch {
    // Continue using the independent Vercel backup when Firestore is unavailable.
  }

  const previousBackup = await readDiagnosticBackup(access.teacherId, access.subjectId, diagnosticId, access.studentId).catch(() => null);
  if (previousBackup) return NextResponse.json({ ok: true, alreadySubmitted: true, result: previousBackup });

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
  console.info("LAHONI_DIAGNOSTIC_RECOVERY", recoveryCode);

  const [backupWrite, firestoreWrite] = await Promise.allSettled([
    withTimeout(saveDiagnosticBackup(result), BACKUP_WRITE_TIMEOUT_MS),
    withTimeout(resultRef.set(result), FIRESTORE_WRITE_TIMEOUT_MS),
  ]);
  const backupSaved = backupWrite.status === "fulfilled";
  const firestoreSaved = firestoreWrite.status === "fulfilled";
  if (!backupSaved && !firestoreSaved) {
    console.error("diagnostic dual save failed", { diagnosticId, studentId: access.studentId });
    return NextResponse.json({ ok: false, result, recoveryCode, message: "تم استلام الاختبار." }, { status: 503 });
  }
  return NextResponse.json({ ok: true, result, backupSaved, firestoreSaved });
}
''', encoding='utf-8')

# 4) Recovery endpoint for the hidden device fallback; cloud backup is enough for success.
recover_route = root / 'app/api/student/diagnostics/recover/route.ts'
recover_route.parent.mkdir(parents=True, exist_ok=True)
recover_route.write_text('''import { NextResponse } from "next/server";
import { adminDb } from "../../../../../lib/server/firebase-admin";
import { saveDiagnosticBackup } from "../../../../../lib/server/diagnostic-backup";
import { readDiagnosticRecoveryCode } from "../../../../../lib/server/portal-auth";

export const runtime = "nodejs";

function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("recovery_timeout")), milliseconds)),
  ]);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const result = readDiagnosticRecoveryCode(String(body?.recoveryCode || ""));
  if (!result) return NextResponse.json({ ok: false, message: "إيصال النتيجة غير صالح أو انتهت مدته." }, { status: 400 });
  const root = `portalV2Data/${result.teacherId}/subjects/${result.subjectId}`;
  const resultRef = adminDb().collection(`${root}/diagnosticResults`).doc(`${result.diagnosticId}__${result.studentId}`);
  const [backupWrite, firestoreWrite] = await Promise.allSettled([
    withTimeout(saveDiagnosticBackup(result), 4000),
    withTimeout(resultRef.set(result), 5500),
  ]);
  const ok = backupWrite.status === "fulfilled" || firestoreWrite.status === "fulfilled";
  return NextResponse.json({ ok, synced: ok }, { status: ok ? 200 : 503 });
}
''', encoding='utf-8')

# 5) Teacher endpoint reads cached results immediately without consuming Firestore quota.
teacher_backup_route = root / 'app/api/teacher/diagnostics/backup-results/route.ts'
teacher_backup_route.parent.mkdir(parents=True, exist_ok=True)
teacher_backup_route.write_text('''import { NextResponse } from "next/server";
import { readDiagnosticBackups } from "../../../../../lib/server/diagnostic-backup";
import { requireSession } from "../../../../../lib/server/portal-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await requireSession("teacher");
  if (!session?.user?.active) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const subjectId = String(body?.subjectId || "");
  const diagnosticId = String(body?.diagnosticId || "");
  const studentIds = Array.isArray(body?.studentIds) ? body.studentIds.map(String) : [];
  if (!session.user.subjectIds.includes(subjectId)) return NextResponse.json({ ok: false }, { status: 403 });
  if (!diagnosticId || !studentIds.length) return NextResponse.json({ ok: true, results: [] });
  const values = await readDiagnosticBackups(session.userId, subjectId, diagnosticId, studentIds).catch(() => []);
  const results = values.map(result => ({ id: `${result.diagnosticId}__${result.studentId}`, ...result }));
  return NextResponse.json({ ok: true, results }, { headers: { "Cache-Control": "no-store" } });
}
''', encoding='utf-8')

# 6) Student UI stays calm: always a normal success experience, with hidden local + beacon fallback.
student_component = root / 'app/student/student-diagnostics.tsx'
student_component.write_text('''"use client";
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
''', encoding='utf-8')

# 7) Teacher results merge Firestore live data with Vercel cloud backups.
results_component = root / 'app/teacher/diagnostics/diagnostic-results.tsx'
text = results_component.read_text(encoding='utf-8')
text = text.replace(
    '  const [results, setResults] = useState<Result[]>([]);\n',
    '  const [results, setResults] = useState<Result[]>([]);\n  const [backupResults, setBackupResults] = useState<Result[]>([]);\n',
)
old_snapshot = '''  useEffect(() => onSnapshot(collection(db, resultsPath), snapshot => {
    setResults(snapshot.docs.map(item => ({ id: item.id, ...(item.data() as Omit<Result, "id">) })));
  }), [resultsPath]);
'''
new_snapshot = '''  useEffect(() => onSnapshot(collection(db, resultsPath), snapshot => {
    setResults(snapshot.docs.map(item => ({ id: item.id, ...(item.data() as Omit<Result, "id">) })));
  }, () => setResults([])), [resultsPath]);
'''
if old_snapshot not in text:
    raise SystemExit('diagnostic results snapshot anchor not found')
text = text.replace(old_snapshot, new_snapshot)
anchor = '''  const classes = useMemo(() => [...new Set(scopeClasses.map(item => classKey(item.name)).filter(Boolean))]
'''
backup_effect = '''  useEffect(() => {
    if (!teacherId || !subjectKey || !testId || !students.length) {
      setBackupResults([]);
      return;
    }
    let cancelled = false;
    const studentIds = [...new Set(students.flatMap(student => aliases(student)))];
    const loadBackups = async () => {
      try {
        const response = await fetch("/api/teacher/diagnostics/backup-results", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subjectId: subjectKey, diagnosticId: testId, studentIds }),
          cache: "no-store",
        });
        const data = await response.json().catch(() => ({}));
        if (!cancelled && response.ok) setBackupResults(Array.isArray(data.results) ? data.results : []);
      } catch {
        if (!cancelled) setBackupResults([]);
      }
    };
    void loadBackups();
    const timer = window.setInterval(loadBackups, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [teacherId, subjectKey, testId, students]);

  const classes = useMemo(() => [...new Set(scopeClasses.map(item => classKey(item.name)).filter(Boolean))]
'''
if anchor not in text:
    raise SystemExit('diagnostic results classes anchor not found')
text = text.replace(anchor, backup_effect)
latest_anchor = '''  const latestResultByStudent = useMemo(() => {
    const map = new Map<string, Result>();
    results.filter(result => result.diagnosticId === testId).forEach(result => {
'''
latest_replacement = '''  const combinedResults = useMemo(() => {
    const map = new Map<string, Result>();
    backupResults.forEach(result => map.set(result.id, result));
    results.forEach(result => map.set(result.id, result));
    return [...map.values()];
  }, [results, backupResults]);

  const latestResultByStudent = useMemo(() => {
    const map = new Map<string, Result>();
    combinedResults.filter(result => result.diagnosticId === testId).forEach(result => {
'''
if latest_anchor not in text:
    raise SystemExit('diagnostic results latest anchor not found')
text = text.replace(latest_anchor, latest_replacement)
text = text.replace('  }, [results, studentByAlias, testId]);\n', '  }, [combinedResults, studentByAlias, testId]);\n', 1)
results_component.write_text(text, encoding='utf-8')

# 8) PWA cache bump makes the new behavior activate after one normal reopen before the exam.
for path in [root / 'public/sw.js', root / 'app/pwa-register.tsx']:
    value = path.read_text(encoding='utf-8')
    value = value.replace('ostadh-lahooni-v44-attendance-local-timetable', 'ostadh-lahooni-v46-diagnostic-cloud-backup')
    value = value.replace('/sw.js?v=44-attendance-local-timetable', '/sw.js?v=46-diagnostic-cloud-backup')
    path.write_text(value, encoding='utf-8')

print('diagnostic cloud backup v46 applied')
