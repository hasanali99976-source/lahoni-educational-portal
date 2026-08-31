import { classId, gradeNumber, normalizeArabic, sectionNumber, westernDigits, type SchoolClass } from "./school-roster";
import type { TeacherAssignment } from "./teacher-assignments";

export const TEACHER_CLASS_SCOPES_COLLECTION = "portalV2TeacherClassScopes";
export const SUBJECT_CLASS_OWNERS_COLLECTION = "portalV2SubjectClassOwners";

export type TeacherClassScope = {
  teacherId: string;
  subjectId: string;
  grade?: number | null;
  selectedClassIds: string[];
  customized: boolean;
  assignmentSignature?: string;
  updatedAt?: string;
};

export function teacherClassScopeId(teacherId: string, subjectId: string, grade?: number | null) {
  const base = `${encodeURIComponent(teacherId)}__${encodeURIComponent(subjectId)}`;
  return grade === 1 || grade === 2 || grade === 3 ? `${base}__grade_${grade}` : base;
}

export function subjectClassOwnerId(subjectId: string, schoolClassId: string) {
  return `${encodeURIComponent(subjectId)}__${encodeURIComponent(schoolClassId)}`;
}

export function normalizeClassIds(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return [...new Set(value.map(item => String(item || "").trim()).filter(item => /^\d+-\d+$/.test(item)))];
}

export function assignmentScopeSignature(assignments: TeacherAssignment[], subjectId: string, grade?: number | null) {
  return [...new Set(assignments
    .filter(item => item.subjectId === subjectId)
    .filter(item => !grade || gradeNumber(item.grade) === grade)
    .map(item => `${gradeNumber(item.grade) || 0}`))]
    .sort()
    .join("|");
}

export function assignmentAllowsClassExact(assignment: Pick<TeacherAssignment, "grade" | "section">, grade: number, section: string) {
  const assignedGrade = gradeNumber(assignment.grade);
  if (!assignedGrade || assignedGrade !== grade) return false;
  const normalizedSection = normalizeArabic(assignment.section);
  if (!normalizedSection || normalizedSection === "الكل" || normalizedSection === "كل" || normalizedSection === "جميع الفصول") return true;
  return sectionNumber(assignment.section) === westernDigits(section);
}

export function defaultSelectedClassIds(assignments: TeacherAssignment[], subjectId: string, availableClasses: Array<Pick<SchoolClass, "id" | "grade" | "section">>, grade?: number | null) {
  const relevant = assignments.filter(item => item.subjectId === subjectId && !!gradeNumber(item.grade))
    .filter(item => !grade || gradeNumber(item.grade) === grade);
  const exact = availableClasses.filter(schoolClass => relevant.some(assignment => assignmentAllowsClassExact(assignment, schoolClass.grade, schoolClass.section)));
  if (exact.length) return exact.map(item => item.id);

  const grades = new Set(relevant.map(item => gradeNumber(item.grade)).filter(Boolean));
  return availableClasses.filter(item => grades.has(item.grade as 1 | 2 | 3)).map(item => item.id);
}

export function classIdFromStudent(student: { grade: number; section: string }) {
  return classId(student.grade, student.section);
}
