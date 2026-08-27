export type SchoolStudent = {
  id: string;
  code: string;
  name: string;
  grade: number;
  section: string;
  className: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
  transferredAt?: string;
  archivedAt?: string;
};

export type SchoolClass = {
  id: string;
  grade: number;
  section: string;
  name: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type AssignmentLike = {
  subjectId?: string;
  grade?: string;
  section?: string;
};

export const SCHOOL_STUDENTS_COLLECTION = "portalV2Students";
export const SCHOOL_CLASSES_COLLECTION = "portalV2Classes";
export const GRADE_OPTIONS = [1, 2, 3] as const;
export const SECTION_OPTIONS = ["1", "2", "3", "4", "5", "6", "7", "8"] as const;

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export function clean(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function westernDigits(value: unknown) {
  return clean(value)
    .replace(/[٠-٩]/g, digit => String(ARABIC_DIGITS.indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
}

export function normalizeArabic(value: unknown) {
  return westernDigits(value)
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/ـ/g, "")
    .replace(/[إأآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLowerCase();
}

export function gradeNumber(value: unknown): 1 | 2 | 3 | null {
  const normalized = normalizeArabic(value);
  if (/(^|\s)(1|اول|الاول)(\s|$)/.test(normalized)) return 1;
  if (/(^|\s)(2|ثاني|الثاني)(\s|$)/.test(normalized)) return 2;
  if (/(^|\s)(3|ثالث|الثالث)(\s|$)/.test(normalized)) return 3;
  const numeric = Number(westernDigits(value));
  return numeric === 1 || numeric === 2 || numeric === 3 ? numeric : null;
}

export function gradeLabel(grade: number) {
  if (grade === 1) return "الأول الثانوي";
  if (grade === 2) return "الثاني الثانوي";
  if (grade === 3) return "الثالث الثانوي";
  return "";
}

export function arabicNumber(value: string | number) {
  return String(value).replace(/\d/g, digit => ARABIC_DIGITS[Number(digit)] || digit);
}

export function sectionNumber(value: unknown, className?: unknown) {
  const direct = westernDigits(value).match(/\d+/)?.[0] || "";
  if (direct) return direct;
  const numbers = westernDigits(className).match(/\d+/g) || [];
  return numbers.length ? numbers[numbers.length - 1] : "";
}

export function canonicalClassName(grade: number, section: string) {
  return `${gradeLabel(grade)} ${arabicNumber(section)}`.trim();
}

export function classId(grade: number, section: string) {
  return `${grade}-${westernDigits(section)}`;
}

export function normalizeClassRecord(value: Partial<SchoolClass> & { className?: string; name?: string }) {
  const grade = gradeNumber(value.grade || value.className || value.name);
  const section = sectionNumber(value.section, value.className || value.name);
  if (!grade || !section) return null;
  return {
    id: classId(grade, section),
    grade,
    section,
    name: canonicalClassName(grade, section),
    active: value.active !== false,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  } satisfies SchoolClass;
}

export function normalizeStudentRecord(value: Record<string, unknown>, fallbackId = "") {
  const name = clean(value.name);
  const className = clean(value.className || value.class);
  const grade = gradeNumber(value.grade || className);
  const section = sectionNumber(value.section, className);
  const code = clean(value.code || value.accessCode || value.studentCode || fallbackId).toUpperCase();
  if (!name || !grade || !section || !code) return null;
  return {
    ...value,
    id: code,
    code,
    name,
    grade,
    section,
    className: canonicalClassName(grade, section),
    active: value.active !== false && value.rosterActive !== false,
  } as SchoolStudent;
}

export function nextStudentCode(students: Array<Pick<SchoolStudent, "code">>, grade: number) {
  const used = new Set(students.map(student => clean(student.code).toUpperCase()));
  const prefix = `TH${grade}`;
  for (let number = 1; number <= 999; number += 1) {
    const code = `${prefix}${String(number).padStart(3, "0")}`;
    if (!used.has(code)) return code;
  }
  return "";
}

export function subjectAssignments(assignments: AssignmentLike[] | undefined, subjectId: string) {
  return (Array.isArray(assignments) ? assignments : []).filter(item => clean(item.subjectId) === clean(subjectId));
}

export function assignmentMatchesClass(assignment: AssignmentLike, grade: number, section: string) {
  const assignedGrade = gradeNumber(assignment.grade);
  if (!assignedGrade || assignedGrade !== grade) return false;
  const assignedSection = normalizeArabic(assignment.section);
  if (!assignedSection || assignedSection === "الكل" || assignedSection === "كل" || assignedSection === "جميع الفصول") return true;
  return sectionNumber(assignment.section) === westernDigits(section);
}

export function studentMatchesAssignments(student: Pick<SchoolStudent, "grade" | "section">, assignments: AssignmentLike[] | undefined, subjectId: string) {
  return subjectAssignments(assignments, subjectId).some(assignment => assignmentMatchesClass(assignment, student.grade, student.section));
}

export function classMatchesAssignments(schoolClass: Pick<SchoolClass, "grade" | "section">, assignments: AssignmentLike[] | undefined, subjectId: string) {
  return subjectAssignments(assignments, subjectId).some(assignment => assignmentMatchesClass(assignment, schoolClass.grade, schoolClass.section));
}

export function studentIdentity(student: Pick<SchoolStudent, "name" | "grade" | "section">) {
  return `${normalizeArabic(student.name)}|${student.grade}|${westernDigits(student.section)}`;
}
