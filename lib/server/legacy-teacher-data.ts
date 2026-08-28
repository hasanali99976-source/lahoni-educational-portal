import "server-only";

import { adminDb } from "./firebase-admin";

const COLLECTIONS_TO_RESTORE = [
  "attendance",
  "timetable",
  "diagnostics",
  "diagnosticResults",
] as const;

function normalizeArabic(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/\s+/g, " ");
}

function legacyTeacherIds(teacherId: string, teacherName: string) {
  const normalized = normalizeArabic(teacherName);
  const ids = new Set<string>([teacherId]);
  if (normalized.includes("حسن") && normalized.includes("الطويل")) ids.add("hasan-history");
  if (normalized.includes("عبد الله") || normalized.includes("عبدالله")) {
    if (normalized.includes("الرويشد")) ids.add("abdullah-critical-thinking");
  }
  return [...ids];
}

function sourceRoots(teacherId: string, teacherName: string, subjectId: string) {
  const destination = `portalV2Data/${teacherId}/subjects/${subjectId}`;
  const roots = new Set<string>();
  legacyTeacherIds(teacherId, teacherName).forEach(id => {
    roots.add(`teacherData/${id}/subjects/${subjectId}`);
    roots.add(`portalV2Data/${id}/subjects/${subjectId}`);
  });
  roots.delete(destination);
  return [...roots];
}

export async function restoreLegacyTeacherLearningData(input: {
  teacherId: string;
  teacherName: string;
  subjectIds: string[];
}) {
  const database = adminDb();
  const markerId = `${input.teacherId}__legacy-learning-data-v1`;
  const markerRef = database.collection("portalV2Migrations").doc(markerId);
  const marker = await markerRef.get();
  if (marker.exists) return { restored: 0, alreadyChecked: true };

  let restored = 0;
  const sourcesUsed = new Set<string>();

  for (const subjectId of input.subjectIds) {
    const destinationRoot = `portalV2Data/${input.teacherId}/subjects/${subjectId}`;
    for (const collectionName of COLLECTIONS_TO_RESTORE) {
      const destinationCollection = database.collection(`${destinationRoot}/${collectionName}`);
      const destinationSnapshot = await destinationCollection.get();
      const existingIds = new Set(destinationSnapshot.docs.map(document => document.id));

      for (const sourceRoot of sourceRoots(input.teacherId, input.teacherName, subjectId)) {
        const sourcePath = `${sourceRoot}/${collectionName}`;
        const sourceSnapshot = await database.collection(sourcePath).get();
        const missing = sourceSnapshot.docs.filter(document => !existingIds.has(document.id));
        if (!missing.length) continue;

        for (let start = 0; start < missing.length; start += 400) {
          const batch = database.batch();
          missing.slice(start, start + 400).forEach(document => {
            batch.set(destinationCollection.doc(document.id), {
              ...(document.data() as Record<string, unknown>),
              restoredFromLegacy: true,
              restoredAt: new Date().toISOString(),
            }, { merge: true });
            existingIds.add(document.id);
            restored += 1;
          });
          await batch.commit();
        }
        sourcesUsed.add(sourcePath);
      }
    }
  }

  await markerRef.set({
    teacherId: input.teacherId,
    subjectIds: input.subjectIds,
    collections: [...COLLECTIONS_TO_RESTORE],
    restored,
    sourcesUsed: [...sourcesUsed],
    checkedAt: new Date().toISOString(),
  }, { merge: true });

  return { restored, alreadyChecked: false };
}
