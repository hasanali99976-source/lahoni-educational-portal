export const SUBJECT_CONFIG = {
  history: {
    key: "history",
    label: "التاريخ",
    shortMark: "ح",
    themeClass: "theme-history",
    welcomePoints: ["سجل الحضارات", "تقارير فورية", "متابعة دقيقة"],
    printTitle: "كشف درجات مادة التاريخ",
  },
  "critical-thinking": {
    key: "critical-thinking",
    label: "التفكير الناقد",
    shortMark: "ف",
    themeClass: "theme-critical-thinking",
    welcomePoints: ["تحليل منطقي", "تقارير فورية", "تفكير متعمق"],
    printTitle: "كشف درجات مادة التفكير الناقد",
  },
} as const;

export type SubjectKey = keyof typeof SUBJECT_CONFIG;
export type SubjectConfig = (typeof SUBJECT_CONFIG)[SubjectKey];

export function getSubjectConfig(subjectKey?: string) {
  if (subjectKey && subjectKey in SUBJECT_CONFIG) {
    return SUBJECT_CONFIG[subjectKey as SubjectKey];
  }
  return SUBJECT_CONFIG.history;
}

export function isSubjectKey(value?: string): value is SubjectKey {
  return !!value && value in SUBJECT_CONFIG;
}
