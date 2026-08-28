import "server-only";

import { adminDb } from "./firebase-admin";

const COLLECTIONS_TO_RESTORE = [
  "students",
  "classes",
  "attendance",
  "timetable",
  "diagnostics",
  "diagnosticResults",
  "grades",
  "portfolio",
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

  if (normalized.includes("حسن") && normalized.includes("الطويل")) {
    ids.add("hasan-history");
  }
  if ((normalized.includes("عبد الله") || normalized.includes("عبدالله")) && normalized.includes("الرويشد")) {
    ids.add("abdullah-critical-thinking");
  }

  return [...ids];
}

function sourceRoots(teacherId: string, teacherName: string, subjectId: string) {
  const destination = `portalV2Data/${teacherId}/subjects/${subjectId}`;
  const roots = new Set<string>();

  legacyTeacherIds(teacherId, teacherName).forEach(id => {
    roots.add(`portalV2Data/${id}/subjects/${subjectId}`);
    roots.add(`teacherData/${id}/subjects/${subjectId}`);
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
  const markerId = `${input.teacherId}__legacy-learning-data-v2`;
  const markerRef = database.collection("portalV2Migrations").doc(markerId);
  const marker = await markerRef.get();
  if (marker.exists) {
    const data = marker.data() as Record<string, unknown>;
    return {
      restored: Number(data.restored || 0),
      alreadyChecked: true,
      sourcesUsed: Array.isArray(data.sourcesUsed) ? data.sourcesUsed : [],
    };
  }

  let restored = 0;
  const sourcesUsed = new Set<string>();
  const counts: Record<string, number> = {};

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

        sourcesUsed.add(sourcePath);
        counts[collectionName] = (counts[collectionName] || 0) + missing.length;

        for (let start = 0; start < missing.length; start += 350) {
          const batch = database.batch();
          missing.slice(start, start + 350).forEach(document => {
            batch.set(destinationCollection.doc(document.id), {
              ...(document.data() as Record<string, unknown>),
              teacherId: input.teacherId,
              subjectKey: subjectId,
              restoredFromLegacy: true,
              restoredAt: new Date().toISOString(),
            }, { merge: true });
            existingIds.add(document.id);
            restored += 1;
          });
          await batch.commit();
        }
      }
    }
  }

  await markerRef.set({
    version: 2,
    teacherId: input.teacherId,
    teacherName: input.teacherName,
    subjectIds: input.subjectIds,
    collections: [...COLLECTIONS_TO_RESTORE],
    restored,
    counts,
    sourcesUsed: [...sourcesUsed],
    checkedAt: new Date().toISOString(),
  }, { merge: true });

  console.info("legacy teacher data restoration", {
    teacherId: input.teacherId,
    teacherName: input.teacherName,
    restored,
    counts,
    sourcesUsed: [...sourcesUsed],
  });

  return { restored, alreadyChecked: false, counts, sourcesUsed: [...sourcesUsed] };
}
