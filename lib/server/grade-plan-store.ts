import "server-only";

import { normalizeGradePlan, type GradePlan } from "../grade-plan";
import { adminDb } from "./firebase-admin";
import type { PortalUser } from "./portal-auth";

const CONFIG_COLLECTION = "gradePlanConfig";
const VERSIONS_COLLECTION = "gradePlanVersions";

export function cleanGradePlanSubject(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .split("--")[0]
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 80);
}

export function teacherOwnsGradePlanSubject(user: PortalUser | undefined, subjectId: string) {
  if (!subjectId || !user) return false;
  return user.subjectIds.map(cleanGradePlanSubject).includes(subjectId);
}

function subjectsFromTeacherData(data: Record<string, unknown>) {
  const ids = new Set<string>();
  if (Array.isArray(data.subjectIds)) {
    data.subjectIds.forEach(value => {
      const id = cleanGradePlanSubject(value);
      if (id) ids.add(id);
    });
  }
  if (Array.isArray(data.assignments)) {
    data.assignments.forEach(value => {
      if (!value || typeof value !== "object") return;
      const id = cleanGradePlanSubject((value as Record<string, unknown>).subjectId);
      if (id) ids.add(id);
    });
  }
  return [...ids];
}

async function canUseLegacyPlan(teacherId: string, subjectId: string) {
  if (!teacherId || !subjectId) return false;
  try {
    const snapshot = await adminDb().collection("portalV2Users").doc(teacherId).get();
    if (!snapshot.exists) return false;
    const subjects = subjectsFromTeacherData(snapshot.data() as Record<string, unknown>);
    return subjects.length === 1 && subjects[0] === subjectId;
  } catch {
    // When the assignment cannot be verified, never risk copying a plan across subjects.
    return false;
  }
}

export async function readActiveGradePlanForSubject(teacherId: string, subjectValue: unknown): Promise<{
  activePlan: GradePlan | null;
  activePlanId: string;
  source: "subject" | "legacy" | "none";
  configData: Record<string, unknown>;
}> {
  const subjectId = cleanGradePlanSubject(subjectValue);
  const database = adminDb();
  const root = `portalV2Data/${teacherId}`;
  const configs = database.collection(`${root}/${CONFIG_COLLECTION}`);

  const configSnapshot = subjectId ? await configs.doc(subjectId).get() : null;
  let source: "subject" | "legacy" | "none" = configSnapshot?.exists ? "subject" : "none";
  let configData = configSnapshot?.exists ? (configSnapshot.data() as Record<string, unknown>) : {};
  let activePlanId = String(configData.activePlanId || "");

  // Legacy teacher-wide plans are compatible only when that teacher has exactly one subject.
  // For a multi-subject teacher, an empty subject stays empty until that subject gets its own plan.
  const allowLegacy = !subjectId || await canUseLegacyPlan(teacherId, subjectId);
  if (!activePlanId && allowLegacy) {
    const legacy = await configs.doc("current").get();
    if (legacy.exists) {
      const legacyData = legacy.data() as Record<string, unknown>;
      const legacyPlanId = String(legacyData.activePlanId || "");
      if (legacyPlanId) {
        configData = legacyData;
        activePlanId = legacyPlanId;
        source = "legacy";
      }
    }
  }

  if (!activePlanId) return { activePlan: null, activePlanId: "", source: "none", configData };
  const version = await database.collection(`${root}/${VERSIONS_COLLECTION}`).doc(activePlanId).get();
  const activePlan = version.exists ? normalizeGradePlan({ id: version.id, ...version.data() }) : null;
  return { activePlan, activePlanId, source: activePlan ? source : "none", configData };
}