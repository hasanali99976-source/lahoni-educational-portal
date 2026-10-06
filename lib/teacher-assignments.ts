import { getSubjectConfig } from "./subject-config";
import { arabicNumber, gradeLabel, gradeNumber, normalizeArabic, sectionNumber } from "./school-roster";

export type TeacherAssignment = {
  id: string;
  stage: "middle" | "secondary";
  subjectId: string;
  subjectLabel?: string;
  grade: string;
  section: string;
  label: string;
};

const SEPARATOR = "--";

export function assignmentId(subjectId: string, grade: string, section: string, stage: "middle" | "secondary" = "secondary") {
  const base = [subjectId, grade.trim(), section.trim()].map(encodeURIComponent).join(SEPARATOR);
  return stage === "middle" ? `${base}${SEPARATOR}middle` : base;
}

export function assignmentFromId(id: string, preferredSubjectLabel = ""): TeacherAssignment {
  const [encodedSubject = id, encodedGrade = "", encodedSection = "", encodedStage = ""] = id.split(SEPARATOR);
  const subjectId = decodeURIComponent(encodedSubject);
  const grade = decodeURIComponent(encodedGrade);
  const section = decodeURIComponent(encodedSection);
  const stage = encodedStage==="middle"?"middle":"secondary";
  const subjectLabel = preferredSubjectLabel.trim() || getSubjectConfig(subjectId).label;
  const sectionLabel = section === "الكل" ? "جميع الفصول" : section ? `فصل ${section}` : "";
  const details = [grade, sectionLabel].filter(Boolean).join(" — ");
  return { id, stage, subjectId, subjectLabel, grade, section, label: details ? `${subjectLabel} — ${details}` : subjectLabel };
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
    const subjectLabel = String(row.subjectLabel || fromId?.subjectLabel || "").trim();
    const stage = row.stage==="middle"||fromId?.stage==="middle"?"middle":"secondary";
    const className = String(row.className || row.class || "").trim();
    const rawGrade = String(row.grade || fromId?.grade || className || "").trim();
    const parsedGrade = gradeNumber(rawGrade || className);
    const grade = parsedGrade ? gradeLabel(parsedGrade,stage) : rawGrade;

    const sectionSource = String(row.section || fromId?.section || "").trim();
    const normalizedSection = normalizeArabic(sectionSource);
    const allSections = ["الكل", "كل", "جميع الفصول"].includes(normalizedSection);
    const parsedSection = sectionNumber(sectionSource, className);
    const section = allSections ? "الكل" : parsedSection ? arabicNumber(parsedSection) : sectionSource;

    if (!subjectId || !grade || !section) return;
    normalized.push(assignmentFromId(assignmentId(subjectId, grade, section,stage), subjectLabel));
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
        .map(id => assignmentFromId(assignmentId(id, "", "")))
    : [];
}
