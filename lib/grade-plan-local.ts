"use client";

import { normalizeGradePlan, type GradePlan, type GradePlanDraft } from "./grade-plan";

const STORAGE_KEY = "lahoni-grade-plan-local-v1";
const CURRENT_TEACHER_KEY = "lahoni-grade-plan-current-teacher";

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

export function setGradePlanCurrentTeacher(teacherId: string) {
  if (!storageAvailable() || !teacherId) return;
  window.localStorage.setItem(CURRENT_TEACHER_KEY, teacherId);
}

export function readLocalGradePlan(teacherId = currentTeacherId()) {
  if (!teacherId) return null;
  return normalizeGradePlan(readAll()[teacherId]);
}

export function saveLocalGradePlan(plan: GradePlan) {
  if (!storageAvailable() || !plan.teacherId) return;
  const normalized = normalizeGradePlan(plan);
  if (!normalized) return;
  const plans = readAll();
  plans[normalized.teacherId] = normalized;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
  setGradePlanCurrentTeacher(normalized.teacherId);
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
