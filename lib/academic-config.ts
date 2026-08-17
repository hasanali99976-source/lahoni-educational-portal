import type { SubjectKey } from "./subject-config";

export type GradeKey = "attendance" | "participation" | "homework" | "unitExam";

export const GRADE_DISTRIBUTION: Record<GradeKey, number> = {
  attendance: 3,
  participation: 4,
  homework: 2,
  unitExam: 10,
};

export const ACADEMIC_UNITS = [
  { key: "unit1", label: "الوحدة الأولى", examLabel: "اختبار الوحدة الأولى" },
  { key: "unit2", label: "الوحدة الثانية", examLabel: "اختبار الوحدة الثانية" },
  { key: "unit3", label: "الوحدة الثالثة", examLabel: "اختبار الوحدة الثالثة" },
  { key: "unit4", label: "الوحدة الرابعة", examLabel: "اختبار الوحدة الرابعة" },
  { key: "unit5", label: "الوحدة الخامسة", examLabel: "اختبار الوحدة الخامسة" },
] as const;

export type UnitKey = (typeof ACADEMIC_UNITS)[number]["key"];

export const UNIT_MAX = Object.values(GRADE_DISTRIBUTION).reduce((sum, value) => sum + value, 0);
export const RESEARCH_MAX = 5;
export const UNITS_MAX = UNIT_MAX * ACADEMIC_UNITS.length;
export const FINAL_MAX = UNITS_MAX + RESEARCH_MAX;

export const STUDENT_PORTAL_SUBJECTS: ReadonlyArray<{
  key: SubjectKey;
  label: string;
  teacher: string;
  teacherId: string;
  icon: string;
}> = [
  { key: "history", label: "التاريخ", teacher: "الأستاذ حسن علي الطويل", teacherId: "hasan-history", icon: "🏛️" },
  { key: "critical-thinking", label: "التفكير الناقد", teacher: "الأستاذ عبد الله الرويشد", teacherId: "abdullah-critical-thinking", icon: "🧠" },
];

export function subjectLabel(subjectKey?: string) {
  return STUDENT_PORTAL_SUBJECTS.find(subject => subject.key === subjectKey)?.label || "التاريخ";
}

export function clampGrade(key: GradeKey, value: number) {
  return Math.max(0, Math.min(GRADE_DISTRIBUTION[key], Number.isFinite(value) ? value : 0));
}

export function calculateUnitTotal(record: Partial<Record<GradeKey, number>>) {
  return (Object.keys(GRADE_DISTRIBUTION) as GradeKey[]).reduce(
    (sum, key) => sum + clampGrade(key, Number(record[key] || 0)),
    0,
  );
}

export function calculatePercentage(value: number, maximum: number) {
  if (!maximum) return 0;
  return Math.round((Math.max(0, value) / maximum) * 1000) / 10;
}
