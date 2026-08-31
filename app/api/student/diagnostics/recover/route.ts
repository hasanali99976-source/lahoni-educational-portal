import { NextResponse } from "next/server";
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
