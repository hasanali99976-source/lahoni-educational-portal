import "server-only";

import { unstable_cache } from "next/cache";
import { normalizeGradePlan, type GradePlan } from "../grade-plan";
import { adminDb } from "./firebase-admin";
import type { PortalUser } from "./portal-auth";

const CONFIG_COLLECTION = "gradePlanConfig";
const VERSIONS_COLLECTION = "gradePlanVersions";

type ActivePlanResult = {
  activePlan: GradePlan | null;
  activePlanId: string;
  source: "subject" | "legacy" | "none";
  configData: Record<string, unknown>;
};

export function cleanGradePlanSubject(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
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

const readTeacherSubjectsForLegacyPlan = unstable_cache(async (teacherId: string) => {
  const snapshot = await adminDb().collection("portalV2Users").doc(teacherId).get();
  if (!snapshot.exists) return [] as string[];
  return subjectsFromTeacherData(snapshot.data() as Record<string, unknown>);
}, ["grade-plan-teacher-subjects-v2"], { revalidate: 3600 });

async function canUseLegacyPlan(teacherId: string, subjectId: string) {
  if (!teacherId || !subjectId) return false;
  try {
    const subjects = await readTeacherSubjectsForLegacyPlan(teacherId);
    return subjects.length === 1 && subjects[0] === subjectId;
  } catch {
    return false;
  }
}

async function readActiveGradePlanUncached(teacherId: string, subjectId: string): Promise<ActivePlanResult> {
  const database = adminDb();
  const root = `portalV2Data/${teacherId}`;
  const configs = database.collection(`${root}/${CONFIG_COLLECTION}`);
  const configSnapshot = subjectId ? await configs.doc(subjectId).get() : null;
  let source: "subject" | "legacy" | "none" = configSnapshot?.exists ? "subject" : "none";
  let configData = configSnapshot?.exists ? JSON.parse(JSON.stringify(configSnapshot.data())) as Record<string, unknown> : {};
  let activePlanId = String(configData.activePlanId || "");
  const allowLegacy = !subjectId || await canUseLegacyPlan(teacherId, subjectId);
  if (!activePlanId && allowLegacy) {
    const legacy = await configs.doc("current").get();
    if (legacy.exists) {
      const legacyData = JSON.parse(JSON.stringify(legacy.data())) as Record<string, unknown>;
      const legacyPlanId = String(legacyData.activePlanId || "");
      if (legacyPlanId) { configData = legacyData; activePlanId = legacyPlanId; source = "legacy"; }
    }
  }
  if (!activePlanId) return { activePlan: null, activePlanId: "", source: "none", configData };
  const version = await database.collection(`${root}/${VERSIONS_COLLECTION}`).doc(activePlanId).get();
  const activePlan = version.exists ? normalizeGradePlan({ id: version.id, ...JSON.parse(JSON.stringify(version.data())) }) : null;
  return { activePlan, activePlanId, source: activePlan ? source : "none", configData };
}

const readActiveGradePlanCached = unstable_cache(
  async (teacherId: string, subjectId: string) => readActiveGradePlanUncached(teacherId, subjectId),
  ["active-grade-plan-v2"],
  { revalidate: 3600 },
);

export async function readActiveGradePlanForSubject(teacherId: string, subjectValue: unknown): Promise<ActivePlanResult> {
  return readActiveGradePlanCached(teacherId, cleanGradePlanSubject(subjectValue));
}
