import { NextResponse } from "next/server";
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
