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

  let configSnapshot = subjectId ? await configs.doc(subjectId).get() : null;
  let source: "subject" | "legacy" | "none" = configSnapshot?.exists ? "subject" : "none";
  let configData = configSnapshot?.exists ? (configSnapshot.data() as Record<string, unknown>) : {};
  let activePlanId = String(configData.activePlanId || "");

  if (!activePlanId) {
    const legacy = await configs.doc("current").get();
    if (legacy.exists) {
      configSnapshot = legacy;
      configData = legacy.data() as Record<string, unknown>;
      activePlanId = String(configData.activePlanId || "");
      if (activePlanId) source = "legacy";
    }
  }

  if (!activePlanId) return { activePlan: null, activePlanId: "", source: "none", configData };
  const version = await database.collection(`${root}/${VERSIONS_COLLECTION}`).doc(activePlanId).get();
  const activePlan = version.exists ? normalizeGradePlan({ id: version.id, ...version.data() }) : null;
  return { activePlan, activePlanId, source: activePlan ? source : "none", configData };
}
