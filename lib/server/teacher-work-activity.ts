import "server-only";

import { createHash } from "node:crypto";
import { adminDb } from "./firebase-admin";

export const TEACHER_WORK_ACTIVITY_COLLECTION = "teacherWorkActivity";

// Competition v3: every verified educational work unit is worth exactly one point.
// The leaderboard itself is rebuilt from persisted portal data; this tracker is only
// a lightweight audit trail and never has authority to inflate the ranking.
export const TEACHER_WORK_WEIGHTS = {
  attendance: 1,
  grades: 1,
  note: 1,
  referral: 1,
  diagnostic: 1,
  remedial: 1,
  gradePlan: 1,
  timetable: 1,
} as const;

export type TeacherWorkKind = keyof typeof TEACHER_WORK_WEIGHTS;

type RecordTeacherWorkInput = {
  teacherId: string;
  teacherName: string;
  kind: TeacherWorkKind;
  signature?: string;
  meta?: Record<string, unknown>;
};

const REPEAT_COOLDOWN_MS: Record<TeacherWorkKind, number> = {
  attendance: 12 * 60 * 60 * 1000,
  grades: 60 * 60 * 1000,
  note: 10 * 60 * 1000,
  referral: 60 * 60 * 1000,
  diagnostic: 60 * 60 * 1000,
  remedial: 60 * 60 * 1000,
  gradePlan: 12 * 60 * 60 * 1000,
  timetable: 12 * 60 * 60 * 1000,
};

function riyadhDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const day = `${values.year}-${values.month}-${values.day}`;
  return { day, period: `${values.year}-${values.month}` };
}

function compactSignature(kind: string, signature: string) {
  return createHash("sha1").update(`${kind}:${signature}`).digest("hex").slice(0, 18);
}

export async function recordTeacherWork(input: RecordTeacherWorkInput) {
  const teacherId = String(input.teacherId || "").trim();
  if (!teacherId) return { counted: false, scoreAdded: 0 };

  const teacherName = String(input.teacherName || "المعلم").trim() || "المعلم";
  if (!(input.kind in TEACHER_WORK_WEIGHTS)) return { counted: false, scoreAdded: 0 };

  const now = new Date();
  const nowIso = now.toISOString();
  const { day, period } = riyadhDateParts(now);
  const database = adminDb();
  const ref = database.collection(TEACHER_WORK_ACTIVITY_COLLECTION).doc(`${teacherId}__${period}`);
  const signature = compactSignature(input.kind, String(input.signature || `${day}:${input.kind}`));
  const cooldown = REPEAT_COOLDOWN_MS[input.kind];

  let counted = false;
  await database.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.exists ? snapshot.data() as Record<string, unknown> : {};
    const recent = Array.isArray(current.recentActions)
      ? (current.recentActions as Array<{ key?: string; at?: string }>).filter(item => item?.key && item?.at)
      : [];
    const duplicate = recent.some(item => item.key === signature && now.getTime() - new Date(String(item.at)).getTime() < cooldown);
    if (duplicate) return;

    const counts = current.counts && typeof current.counts === "object"
      ? { ...(current.counts as Record<string, number>) }
      : {};
    counts[input.kind] = Number(counts[input.kind] || 0) + 1;

    const days = current.days && typeof current.days === "object"
      ? { ...(current.days as Record<string, number>) }
      : {};
    days[day] = Number(days[day] || 0) + 1;

    const nextRecent = [{ key: signature, at: nowIso }, ...recent]
      .filter((item, index, array) => array.findIndex(other => other.key === item.key) === index)
      .slice(0, 120);

    transaction.set(ref, {
      teacherId,
      teacherName,
      period,
      auditActions: Number(current.auditActions || 0) + 1,
      counts,
      days,
      activeDays: Object.keys(days).length,
      lastActivityAt: nowIso,
      updatedAt: nowIso,
      recentActions: nextRecent,
      lastMeta: input.meta || {},
      scoringVersion: 3,
      rankingAuthority: "persisted-work-only",
    }, { merge: true });
    counted = true;
  });

  return { counted, scoreAdded: counted ? 1 : 0 };
}
