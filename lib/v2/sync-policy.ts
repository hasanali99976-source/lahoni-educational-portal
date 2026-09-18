export const V2_SYNC_POLICY = {
  officialRosterSource: "admin" as const,
  polling: false,
  retryLoops: false,
  preserveHistory: true,
  preserveTeacherSavedData: true,
  devices: ["web", "mobile", "app"] as const,
  isolation: ["teacherId", "subjectKey", "grade", "classId", "date", "period"] as const,
};

export function v2IsolationKey(parts: { teacherId: string; subjectKey: string; grade: string; classId: string; date: string; period?: string }) {
  return [parts.teacherId, parts.subjectKey, parts.grade, parts.classId, parts.date, parts.period || "all"]
    .map(value => encodeURIComponent(String(value).trim()))
    .join("__");
}
