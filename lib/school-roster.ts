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
const ORDINALS: Record<string, string> = {
  "1": "1", "اول": "1", "الاول": "1", "اولي": "1", "الاولى": "1",
  "2": "2", "ثاني": "2", "الثاني": "2", "ثانيه": "2", "الثانيه": "2",
  "3": "3", "ثالث": "3", "الثالث": "3", "ثالثه": "3", "الثالثه": "3",
  "4": "4", "رابع": "4", "الرابع": "4", "رابعه": "4", "الرابعه": "4",
  "5": "5", "خامس": "5", "الخامس": "5", "خامسه": "5", "الخامسه": "5",
  "6": "6", "سادس": "6", "السادس": "6", "سادسه": "6", "السادسه": "6",
  "7": "7", "سابع": "7", "السابع": "7", "سابعه": "7", "السابعه": "7",
  "8": "8", "ثامن": "8", "الثامن": "8", "ثامنه": "8", "الثامنه": "8",
};

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

function ordinalValues(value: unknown) {
  const normalized = normalizeArabic(value).replace(/[\/_\-–—]+/g, " ");
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const values: string[] = [];
  for (const token of tokens) {
    const direct = ORDINALS[token];
    if (direct) values.push(direct);
    else {
      const numeric = token.match(/^\d+$/)?.[0];
      if (numeric) values.push(numeric);
    }
  }
  return values;
}

export function gradeNumber(value: unknown): 1 | 2 | 3 | null {
  const exact = Number(westernDigits(value));
  if (exact === 1 || exact === 2 || exact === 3) return exact;
  const first = ordinalValues(value).find(item => item === "1" || item === "2" || item === "3");
  return first ? Number(first) as 1 | 2 | 3 : null;
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
  const explicitNumbers = westernDigits(value).match(/\d+/g) || [];
  if (explicitNumbers.length) return explicitNumbers[explicitNumbers.length - 1];

  const explicitOrdinals = ordinalValues(value);
  if (explicitOrdinals.length) return explicitOrdinals[explicitOrdinals.length - 1];

  const classNumbers = westernDigits(className).match(/\d+/g) || [];
  if (classNumbers.length >= 2) return classNumbers[classNumbers.length - 1];
  if (classNumbers.length === 1) {
    const classOrdinals = ordinalValues(className);
    return classOrdinals.length >= 2 ? classOrdinals[classOrdinals.length - 1] : classNumbers[0];
  }

  const classOrdinals = ordinalValues(className);
  return classOrdinals.length >= 2 ? classOrdinals[classOrdinals.length - 1] : "";
}

export function canonicalClassName(grade: number, section: string) {
  return `${gradeLabel(grade)} ${arabicNumber(section)}`.trim();
}

export function classId(grade: number, section: string) {
  return `${grade}-${westernDigits(section)}`;
}

export function normalizeClassRecord(value: Partial<SchoolClass> & { className?: string; name?: string }) {
  const sourceName = value.className || value.name;
  const grade = gradeNumber(value.grade || sourceName);
  const section = sectionNumber(value.section, sourceName);
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
