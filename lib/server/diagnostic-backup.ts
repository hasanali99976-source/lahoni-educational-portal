import "server-only";

import { createHash } from "node:crypto";
import { getCache } from "@vercel/functions";
import type { DiagnosticRecoveryResult } from "./portal-auth";

const BACKUP_TTL_SECONDS = 60 * 60 * 24 * 60;
const CACHE_PREFIX = "lahooni-diagnostic-v46";

function digest(parts: string[]) {
  return createHash("sha256").update(parts.join("\u001f")).digest("hex");
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
