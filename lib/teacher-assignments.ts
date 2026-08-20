import { getSubjectConfig } from "./subject-config";

export type TeacherAssignment = {
  id: string;
  subjectId: string;
  grade: string;
  section: string;
  label: string;
};

const SEPARATOR = "--";

export function assignmentId(subjectId: string, grade: string, section: string) {
  return [subjectId, grade.trim(), section.trim()].map(encodeURIComponent).join(SEPARATOR);
}

export function assignmentFromId(id: string): TeacherAssignment {
  const [encodedSubject = id, encodedGrade = "", encodedSection = ""] = id.split(SEPARATOR);
  const subjectId = decodeURIComponent(encodedSubject);
  const grade = decodeURIComponent(encodedGrade);
  const section = decodeURIComponent(encodedSection);
  const subject = getSubjectConfig(subjectId).label;
  const sectionLabel = section === "الكل" ? "جميع الفصول" : section ? `فصل ${section}` : "";
  const details = [grade, sectionLabel].filter(Boolean).join(" — ");
  return { id, subjectId, grade, section, label: details ? `${subject} — ${details}` : subject };
}

export function normalizeAssignments(value: unknown, fallbackSubjectIds: unknown = []): TeacherAssignment[] {
  if (Array.isArray(value)) {
    const assignments = value.map(item => {
      if (!item || typeof item !== "object") return null;
      const row = item as Partial<TeacherAssignment>;
      const subjectId = String(row.subjectId || "").trim();
      const grade = String(row.grade || "").trim();
      const section = String(row.section || "").trim();
      if (!subjectId || !grade || !section) return null;
      const id = assignmentId(subjectId, grade, section);
      return assignmentFromId(id);
    }).filter(Boolean) as TeacherAssignment[];
    if (assignments.length) return [...new Map(assignments.map(item => [item.id, item])).values()];
  }
  return Array.isArray(fallbackSubjectIds)
    ? fallbackSubjectIds.map(String).filter(Boolean).map(assignmentFromId)
    : [];
}
