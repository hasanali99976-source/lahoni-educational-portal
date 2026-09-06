"use client";

import { normalizeGradePlan, type GradePlan, type GradePlanDraft } from "./grade-plan";

const STORAGE_KEY = "lahoni-grade-plan-local-v1";
const CURRENT_TEACHER_KEY = "lahoni-grade-plan-current-teacher";
const CURRENT_SUBJECT_KEY = "lahoni-grade-plan-current-subject";

type StoredPlans = Record<string, GradePlan>;

function storageAvailable() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readAll(): StoredPlans {
  if (!storageAvailable()) return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed as StoredPlans : {};
  } catch {
    return {};
  }
}

function currentTeacherId() {
  if (!storageAvailable()) return "";
  return String(window.localStorage.getItem(CURRENT_TEACHER_KEY) || "").trim();
}

function currentSubjectId() {
  if (!storageAvailable()) return "";
  return String(window.localStorage.getItem(CURRENT_SUBJECT_KEY) || "").trim().split("--")[0];
}

function planKey(teacherId: string, subjectId?: string) {
  const subject = String(subjectId || "").trim().split("--")[0];
  return subject ? `${teacherId}::${subject}` : teacherId;
}

export function setGradePlanCurrentTeacher(teacherId: string) {
  if (!storageAvailable() || !teacherId) return;
  window.localStorage.setItem(CURRENT_TEACHER_KEY, teacherId);
}

export function setGradePlanCurrentSubject(subjectId: string) {
  if (!storageAvailable()) return;
  const subject = String(subjectId || "").trim().split("--")[0];
  if (subject) window.localStorage.setItem(CURRENT_SUBJECT_KEY, subject);
}

export function readLocalGradePlan(teacherId = currentTeacherId(), subjectId = currentSubjectId()) {
  if (!teacherId) return null;
  const plans = readAll();
  const scoped = subjectId ? normalizeGradePlan(plans[planKey(teacherId, subjectId)]) : null;
  if (scoped) return scoped;
  return normalizeGradePlan(plans[teacherId]);
}

export function saveLocalGradePlan(plan: GradePlan, subjectId = currentSubjectId()) {
  if (!storageAvailable() || !plan.teacherId) return;
  const normalized = normalizeGradePlan(plan);
  if (!normalized) return;
  const plans = readAll();
  plans[planKey(normalized.teacherId, subjectId)] = normalized;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
  } catch {
    return;
  }
  setGradePlanCurrentTeacher(normalized.teacherId);
  if (subjectId) setGradePlanCurrentSubject(subjectId);
}

export function createLocalGradePlan(draft: GradePlanDraft, teacherId: string, version = 1): GradePlan {
  const now = new Date().toISOString();
  return {
    ...draft,
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    version: Math.max(1, Math.floor(Number(version) || 1)),
    teacherId,
    status: "active",
    createdAt: now,
    activatedAt: now,
  };
}