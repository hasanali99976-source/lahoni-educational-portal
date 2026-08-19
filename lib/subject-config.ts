export const SUBJECT_CONFIG = {
  history: { key: "history", label: "التاريخ", shortMark: "ح", themeClass: "theme-history", welcomePoints: ["سجل الحضارات", "تقارير فورية", "متابعة دقيقة"], printTitle: "كشف درجات مادة التاريخ" },
  geography: { key: "geography", label: "الجغرافيا", shortMark: "ج", themeClass: "theme-geography", welcomePoints: ["خريطتك الجغرافية", "تقارير فورية"], printTitle: "كشف درجات مادة الجغرافيا" },
  "critical-thinking": { key: "critical-thinking", label: "التفكير الناقد", shortMark: "ف", themeClass: "theme-critical-thinking", welcomePoints: ["تحليل منطقي", "تقارير فورية", "تفكير متعمق"], printTitle: "كشف درجات مادة التفكير الناقد" },
  arabic: { key: "arabic", label: "اللغة العربية", shortMark: "ع", themeClass: "theme-arabic", welcomePoints: ["البلاغة والقراءة", "تقارير فورية"], printTitle: "كشف درجات مادة اللغة العربية" },
  english: { key: "english", label: "اللغة الإنجليزية", shortMark: "E", themeClass: "theme-english", welcomePoints: ["القراءة والكتابة", "تقارير فورية"], printTitle: "كشف درجات مادة اللغة الإنجليزية" },
  mathematics: { key: "mathematics", label: "الرياضيات", shortMark: "ر", themeClass: "theme-math", welcomePoints: ["حل المشكلات", "تقارير فورية"], printTitle: "كشف درجات مادة الرياضيات" },
  physics: { key: "physics", label: "الفيزياء", shortMark: "فز", themeClass: "theme-physics", welcomePoints: ["التجارب العلمية", "تقارير فورية"], printTitle: "كشف درجات مادة الفيزياء" },
  chemistry: { key: "chemistry", label: "الكيمياء", shortMark: "ك", themeClass: "theme-chemistry", welcomePoints: ["التفاعلات الكيميائية", "تقارير فورية"], printTitle: "كشف درجات مادة الكيمياء" },
  biology: { key: "biology", label: "الأحياء", shortMark: "ب", themeClass: "theme-biology", welcomePoints: ["الطبيعة الحية", "تقارير فورية"], printTitle: "كشف درجات مادة الأحياء" },
  science: { key: "science", label: "العلوم", shortMark: "علم", themeClass: "theme-science", welcomePoints: ["أساسيات العلوم", "تقارير فورية"], printTitle: "كشف درجات مادة العلوم" },
  "digital-technology": { key: "digital-technology", label: "التقنية الرقمية", shortMark: "ت", themeClass: "theme-digital", welcomePoints: ["برمجة وأساليب رقمية", "تقارير فورية"], printTitle: "كشف درجات مادة التقنية الرقمية" },
  "computer-science": { key: "computer-science", label: "علوم الحاسب", shortMark: "حس", themeClass: "theme-compsci", welcomePoints: ["خوارزميات", "تقارير فورية"], printTitle: "كشف درجات مادة علوم الحاسب" },
  "islamic-studies": { key: "islamic-studies", label: "التربية الإسلامية", shortMark: "د", themeClass: "theme-islamic", welcomePoints: ["القيم الدينية", "تقارير فورية"], printTitle: "كشف درجات مادة التربية الإسلامية" },
  quran: { key: "quran", label: "القرآن", shortMark: "ق", themeClass: "theme-quran", welcomePoints: ["التلاوة والتجويد", "تقارير فورية"], printTitle: "كشف درجات مادة القرآن" },
  art: { key: "art", label: "الفن", shortMark: "ف", themeClass: "theme-art", welcomePoints: ["الإبداع والمهارات", "تقارير فورية"], printTitle: "كشف درجات مادة الفن" },
  "physical-education": { key: "physical-education", label: "التربية البدنية", shortMark: "بد", themeClass: "theme-pe", welcomePoints: ["اللياقة البدنية", "تقارير فورية"], printTitle: "كشف درجات مادة التربية البدنية" },
  "life-skills": { key: "life-skills", label: "مهارات الحياة", shortMark: "ح", themeClass: "theme-life", welcomePoints: ["مهارات شخصية", "تقارير فورية"], printTitle: "كشف درجات مادة مهارات الحياة" },
  "social-studies": { key: "social-studies", label: "الدراسات الاجتماعية", shortMark: "د", themeClass: "theme-social", welcomePoints: ["المجتمع والتاريخ", "تقارير فورية"], printTitle: "كشف درجات مادة الدراسات الاجتماعية" },
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
