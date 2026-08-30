import { getSubjectConfig } from "./subject-config";
import { arabicNumber, gradeLabel, gradeNumber, normalizeArabic, sectionNumber } from "./school-roster";

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
  const normalized: TeacherAssignment[] = [];

  const append = (raw: unknown) => {
    if (!raw || typeof raw !== "object") return;
    const row = raw as Partial<TeacherAssignment> & {
      subjectKey?: unknown;
      workspaceKey?: unknown;
      className?: unknown;
      class?: unknown;
      sections?: unknown;
    };

    let fromId: TeacherAssignment | null = null;
    if (row.id) {
      try { fromId = assignmentFromId(String(row.id)); }
      catch { fromId = null; }
    }

    const subjectId = String(row.subjectId || row.subjectKey || fromId?.subjectId || row.workspaceKey || "")
      .trim()
      .split("--")[0];
    const className = String(row.className || row.class || "").trim();
    const rawGrade = String(row.grade || fromId?.grade || className || "").trim();
    const parsedGrade = gradeNumber(rawGrade || className);
    const grade = parsedGrade ? gradeLabel(parsedGrade) : rawGrade;

    const sectionSource = String(row.section || fromId?.section || "").trim();
    const normalizedSection = normalizeArabic(sectionSource);
    const allSections = ["الكل", "كل", "جميع الفصول"].includes(normalizedSection);
    const parsedSection = sectionNumber(sectionSource, className);
    const section = allSections ? "الكل" : parsedSection ? arabicNumber(parsedSection) : sectionSource;

    if (!subjectId || !grade || !section) return;
    normalized.push(assignmentFromId(assignmentId(subjectId, grade, section)));
  };

  if (Array.isArray(value)) {
    value.forEach(item => {
      if (item && typeof item === "object" && Array.isArray((item as { sections?: unknown }).sections)) {
        const row = item as Record<string, unknown>;
        (row.sections as unknown[]).forEach(section => append({ ...row, section }));
      } else {
        append(item);
      }
    });
  }

  if (normalized.length) return [...new Map(normalized.map(item => [item.id, item])).values()];

  return Array.isArray(fallbackSubjectIds)
    ? [...new Set(fallbackSubjectIds.map(item => String(item || "").trim().split("--")[0]).filter(Boolean))]
        .map(assignmentFromId)
    : [];
}
