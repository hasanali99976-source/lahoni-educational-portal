export type GradePlanMode = "units" | "general100" | "periods" | "custom";
export type GradePlanMethod = "automatic" | "manual";
export type GradePlanStatus = "active" | "archived";
export type GradeCategory = "attendance" | "participation" | "homework" | "unitExam" | "research" | "project" | "performance" | "custom";

export type GradePlanItem = {
  id: string;
  label: string;
  max: number;
  category: GradeCategory;
};

export type GradePlanSection = {
  id: string;
  label: string;
  max: number;
  items: GradePlanItem[];
};

export type GradePlanDraft = {
  mode: GradePlanMode;
  method: GradePlanMethod;
  sections: GradePlanSection[];
};

export type GradePlan = GradePlanDraft & {
  id: string;
  version: number;
  teacherId: string;
  status: GradePlanStatus;
  createdAt: string;
  activatedAt: string;
};

export type GradeValueMap = Record<string, number>;
export type LegacyUnit = Record<string, unknown>;
export type GradeStudentLike = {
  gradeValues?: GradeValueMap;
  gradePlanValues?: Record<string, GradeValueMap>;
  units?: Record<string, LegacyUnit>;
  research?: number;
  researchScore?: number;
};

export type GradeEntryResult = {
  key: string;
  value: number;
  counted: number;
  recorded: boolean;
  maximum: number;
  item: GradePlanItem;
};

export type GradeSectionResult = {
  id: string;
  label: string;
  earned: number;
  maximum: number;
  recordedMaximum: number;
  percentage: number;
  complete: boolean;
  items: GradeEntryResult[];
};

export type GradeDimensionResult = {
  key: string;
  label: string;
  earned: number;
  maximum: number;
  percentage: number;
};

export type GradePlanResult = {
  earned: number;
  maximum: number;
  percentage: number;
  recordedMaximum: number;
  completion: number;
  complete: boolean;
  finalScore: number | null;
  sections: GradeSectionResult[];
  dimensions: GradeDimensionResult[];
};

export const GRADE_CATEGORY_LABELS: Record<GradeCategory, string> = {
  attendance: "الحضور",
  participation: "المشاركة",
  homework: "الواجبات",
  unitExam: "الاختبارات",
  research: "البحث",
  project: "المشروع",
  performance: "المهام الأدائية",
  custom: "عنصر مخصص",
};

export const GRADE_PLAN_MODE_LABELS: Record<GradePlanMode, string> = {
  units: "نظام الوحدات",
  general100: "نظام الـ100 العام",
  periods: "نظام الفترتين",
  custom: "نظام مخصص",
};

const UNIT_AUTO_ITEMS: Array<[string, string, GradeCategory, number]> = [
  ["attendance", "الحضور", "attendance", 10],
  ["participation", "المشاركة", "participation", 15],
  ["homework", "الواجبات", "homework", 10],
  ["unitExam", "اختبار الوحدة", "unitExam", 45],
  ["project", "المشروع / المهمة", "project", 20],
];

const GENERAL_AUTO_ITEMS: Array<[string, string, GradeCategory, number]> = [
  ["attendance", "الحضور", "attendance", 10],
  ["participation", "المشاركة", "participation", 15],
  ["homework", "الواجبات", "homework", 10],
  ["unitExam", "الاختبارات", "unitExam", 40],
  ["performance", "المهام الأدائية", "performance", 15],
  ["project", "المشروع / البحث", "project", 10],
];

const MODE_SET = new Set<GradePlanMode>(["units", "general100", "periods", "custom"]);
const METHOD_SET = new Set<GradePlanMethod>(["automatic", "manual"]);
const CATEGORY_SET = new Set<GradeCategory>(["attendance", "participation", "homework", "unitExam", "research", "project", "performance", "custom"]);

function text(value: unknown, fallback = "") {
  const result = String(value ?? "").replace(/\s+/g, " ").trim();
  return result || fallback;
}

export function roundGrade(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function numeric(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? roundGrade(number) : 0;
}

function safeId(value: unknown, fallback: string) {
  const normalized = text(value)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return normalized || fallback;
}

function sum(values: number[]) {
  return roundGrade(values.reduce((total, value) => total + numeric(value), 0));
}

function isHundred(value: number) {
  return Math.abs(value - 100) < 0.005;
}

function distributeByWeights(total: number, weights: number[]) {
  if (!weights.length) return [];
  const target = Math.max(0, Math.round(total));
  const weightTotal = weights.reduce((result, value) => result + Math.max(0, value), 0) || weights.length;
  const exact = weights.map(value => target * (Math.max(0, value) || (weightTotal === weights.length ? 1 : 0)) / weightTotal);
  const base = exact.map(Math.floor);
  let remainder = target - base.reduce((result, value) => result + value, 0);
  const order = exact.map((value, index) => ({ index, fraction: value - Math.floor(value) })).sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let index = 0; remainder > 0; index += 1, remainder -= 1) base[order[index % order.length].index] += 1;
  return base;
}

export function distributeEvenly(total: number, count: number) {
  const safeCount = Math.max(1, Math.floor(count || 1));
  return distributeByWeights(total, Array.from({ length: safeCount }, () => 1));
}

function automaticItems(total: number, template: Array<[string, string, GradeCategory, number]>) {
  const amounts = distributeByWeights(total, template.map(item => item[3]));
  return template.map(([id, label, category], index) => ({ id, label, category, max: amounts[index] } satisfies GradePlanItem));
}

export function createAutomaticGradePlan(mode: GradePlanMode, unitCount = 5): GradePlanDraft {
  if (mode === "units") {
    const count = Math.max(1, Math.floor(unitCount || 1));
    const unitTotals = distributeEvenly(100, count);
    return {
      mode,
      method: "automatic",
      sections: unitTotals.map((maximum, index) => ({
        id: `unit${index + 1}`,
        label: `الوحدة ${index + 1}`,
        max: maximum,
        items: automaticItems(maximum, UNIT_AUTO_ITEMS),
      })),
    };
  }

  if (mode === "periods") {
    return {
      mode,
      method: "automatic",
      sections: [1, 2].map(period => ({
        id: `period${period}`,
        label: `الفترة ${period === 1 ? "الأولى" : "الثانية"}`,
        max: 100,
        items: automaticItems(100, GENERAL_AUTO_ITEMS),
      })),
    };
  }

  if (mode === "custom") {
    return {
      mode,
      method: "manual",
      sections: [{
        id: "custom",
        label: "التوزيع المخصص",
        max: 100,
        items: [{ id: "custom-1", label: "عنصر التقييم", max: 100, category: "custom" }],
      }],
    };
  }

  return {
    mode: "general100",
    method: "automatic",
    sections: [{
      id: "general",
      label: "الدرجة العامة",
      max: 100,
      items: automaticItems(100, GENERAL_AUTO_ITEMS),
    }],
  };
}

export function normalizeGradePlanDraft(value: unknown): GradePlanDraft {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const rawMode = text(source.mode) as GradePlanMode;
  const rawMethod = text(source.method) as GradePlanMethod;
  const mode = MODE_SET.has(rawMode) ? rawMode : "general100";
  const method = METHOD_SET.has(rawMethod) ? rawMethod : "manual";
  const rawSections = Array.isArray(source.sections) ? source.sections : [];
  const sections = rawSections.map((sectionValue, sectionIndex) => {
    const section = sectionValue && typeof sectionValue === "object" ? sectionValue as Record<string, unknown> : {};
    const sectionId = safeId(section.id, mode === "units" ? `unit${sectionIndex + 1}` : mode === "periods" ? `period${sectionIndex + 1}` : mode === "custom" ? "custom" : "general");
    const rawItems = Array.isArray(section.items) ? section.items : [];
    const items = rawItems.map((itemValue, itemIndex) => {
      const item = itemValue && typeof itemValue === "object" ? itemValue as Record<string, unknown> : {};
      const rawCategory = text(item.category) as GradeCategory;
      return {
        id: safeId(item.id, `item-${itemIndex + 1}`),
        label: text(item.label, `عنصر ${itemIndex + 1}`),
        max: Math.max(0, numeric(item.max)),
        category: CATEGORY_SET.has(rawCategory) ? rawCategory : "custom",
      } satisfies GradePlanItem;
    });
    return {
      id: sectionId,
      label: text(section.label, `قسم ${sectionIndex + 1}`),
      max: Math.max(0, numeric(section.max)),
      items,
    } satisfies GradePlanSection;
  });
  return { mode, method, sections };
}

export function normalizeGradePlan(value: unknown): GradePlan | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const draft = normalizeGradePlanDraft(source);
  const id = text(source.id);
  const teacherId = text(source.teacherId);
  if (!id || !teacherId) return null;
  return {
    ...draft,
    id,
    version: Math.max(1, Math.floor(numeric(source.version) || 1)),
    teacherId,
    status: text(source.status) === "archived" ? "archived" : "active",
    createdAt: text(source.createdAt),
    activatedAt: text(source.activatedAt),
  };
}

export function validateGradePlanDraft(value: GradePlanDraft) {
  const draft = normalizeGradePlanDraft(value);
  const errors: string[] = [];
  if (!draft.sections.length) errors.push("أضف قسمًا واحدًا على الأقل للخطة.");
  const sectionIds = new Set<string>();
  draft.sections.forEach((section, sectionIndex) => {
    if (sectionIds.has(section.id)) errors.push(`معرّف القسم ${section.label} مكرر.`);
    sectionIds.add(section.id);
    if (!section.label) errors.push(`اكتب اسم القسم رقم ${sectionIndex + 1}.`);
    if (section.max <= 0) errors.push(`درجة ${section.label} يجب أن تكون أكبر من صفر.`);
    if (!section.items.length) errors.push(`أضف عنصر تقييم واحدًا على الأقل داخل ${section.label}.`);
    const itemIds = new Set<string>();
    section.items.forEach(item => {
      if (itemIds.has(item.id)) errors.push(`يوجد عنصر مكرر داخل ${section.label}.`);
      itemIds.add(item.id);
      if (!item.label) errors.push(`اكتب اسم جميع عناصر ${section.label}.`);
      if (item.max < 0) errors.push(`درجة ${item.label} لا يمكن أن تكون سالبة.`);
    });
    const itemsTotal = sum(section.items.map(item => item.max));
    if (Math.abs(itemsTotal - section.max) >= 0.005) errors.push(`مجموع عناصر ${section.label} هو ${itemsTotal} ويجب أن يساوي ${section.max}.`);
  });

  if (draft.mode === "periods") {
    if (draft.sections.length !== 2) errors.push("نظام الفترتين يجب أن يحتوي على فترتين فقط.");
    draft.sections.forEach(section => {
      if (!isHundred(section.max)) errors.push(`${section.label} يجب أن تكون 100 درجة مستقلة.`);
    });
  } else {
    const total = sum(draft.sections.map(section => section.max));
    if (!isHundred(total)) errors.push(`المجموع النهائي للخطة هو ${total} ويجب أن يساوي 100.`);
  }

  if (draft.mode === "general100" || draft.mode === "custom") {
    if (draft.sections.length !== 1 || !isHundred(draft.sections[0]?.max || 0)) errors.push("هذا النظام يجب أن يحتوي على توزيع واحد مجموعه 100.");
  }

  return { valid: errors.length === 0, errors, draft };
}

export function gradeEntryKey(sectionId: string, itemId: string) {
  return `${safeId(sectionId, "section")}__${safeId(itemId, "item")}`;
}

function hasOwn(source: object, key: string) {
  return Object.prototype.hasOwnProperty.call(source, key);
}

function legacyUnitValue(unit: LegacyUnit | undefined, item: GradePlanItem) {
  if (!unit) return { recorded: false, value: 0 };
  if (item.category === "unitExam") {
    const keys = [item.id, "unitExam", "exam1", "exam2"];
    for (const key of keys) if (hasOwn(unit, key)) return { recorded: true, value: numeric(unit[key]) };
    return { recorded: false, value: 0 };
  }
  const keys = [item.id, item.category];
  for (const key of keys) if (hasOwn(unit, key)) return { recorded: true, value: numeric(unit[key]) };
  return { recorded: false, value: 0 };
}

export function readGradeEntry(student: GradeStudentLike, section: GradePlanSection, item: GradePlanItem) {
  const key = gradeEntryKey(section.id, item.id);
  const values = student.gradeValues && typeof student.gradeValues === "object" ? student.gradeValues : {};
  if (hasOwn(values, key)) return { key, recorded: true, value: numeric(values[key]) };

  if (item.category === "research") {
    if (student.researchScore !== undefined && student.researchScore !== null) return { key, recorded: true, value: numeric(student.researchScore) };
    if (student.research !== undefined && student.research !== null) return { key, recorded: true, value: numeric(student.research) };
  }

  if (/^unit\d+$/.test(section.id)) {
    const legacy = legacyUnitValue(student.units?.[section.id], item);
    if (legacy.recorded) return { key, ...legacy };
  }

  if (section.id === "general" && student.units && item.category !== "custom") {
    let recorded = false;
    let value = 0;
    Object.values(student.units).forEach(unit => {
      const legacy = legacyUnitValue(unit, item);
      if (!legacy.recorded) return;
      recorded = true;
      value += legacy.value;
    });
    if (recorded) return { key, recorded: true, value: roundGrade(value) };
  }

  return { key, recorded: false, value: 0 };
}

function percentage(earned: number, maximum: number) {
  return maximum > 0 ? roundGrade(Math.max(0, earned) / maximum * 100) : 0;
}

export function calculateGradePlanResult(plan: GradePlan | GradePlanDraft | null | undefined, student: GradeStudentLike): GradePlanResult {
  if (!plan) return { earned: 0, maximum: 100, percentage: 0, recordedMaximum: 0, completion: 0, complete: false, finalScore: null, sections: [], dimensions: [] };
  const draft = normalizeGradePlanDraft(plan);
  const planId = "id" in plan ? String(plan.id || "") : "";
  const versionValues = planId && student.gradePlanValues?.[planId] ? student.gradePlanValues[planId] : null;
  const effectiveStudent = versionValues ? { ...student, gradeValues: versionValues } : student;
  const sections: GradeSectionResult[] = draft.sections.map(section => {
    const items = section.items.map(item => {
      const source = readGradeEntry(effectiveStudent, section, item);
      const counted = source.recorded ? Math.max(0, Math.min(item.max, source.value)) : 0;
      return { ...source, counted: roundGrade(counted), maximum: item.max, item };
    });
    const earned = sum(items.map(item => item.counted));
    const recordedMaximum = sum(items.filter(item => item.recorded).map(item => item.maximum));
    return {
      id: section.id,
      label: section.label,
      earned,
      maximum: section.max,
      recordedMaximum,
      percentage: percentage(earned, section.max),
      complete: Math.abs(recordedMaximum - section.max) < 0.005,
      items,
    };
  });

  const dimensionsMap = new Map<string, { label: string; earned: number; maximum: number }>();
  sections.forEach(section => section.items.forEach(entry => {
    const key = entry.item.category || "custom";
    const current = dimensionsMap.get(key) || { label: GRADE_CATEGORY_LABELS[key] || entry.item.label, earned: 0, maximum: 0 };
    current.earned += entry.counted;
    current.maximum += entry.maximum;
    dimensionsMap.set(key, current);
  }));
  const dimensions = [...dimensionsMap.entries()].map(([key, value]) => ({
    key,
    label: value.label,
    earned: roundGrade(value.earned),
    maximum: roundGrade(value.maximum),
    percentage: percentage(value.earned, value.maximum),
  }));

  if (draft.mode === "periods") {
    const earned = sections.length ? roundGrade(sections.reduce((total, section) => total + section.earned, 0) / sections.length) : 0;
    const recordedMaximum = sections.length ? roundGrade(sections.reduce((total, section) => total + section.recordedMaximum, 0) / sections.length) : 0;
    const completion = percentage(recordedMaximum, 100);
    const complete = sections.length === 2 && sections.every(section => section.complete);
    return {
      earned,
      maximum: 100,
      percentage: sections.length ? roundGrade(sections.reduce((total, section) => total + section.percentage, 0) / sections.length) : 0,
      recordedMaximum,
      completion,
      complete,
      finalScore: complete ? earned : null,
      sections,
      dimensions,
    };
  }

  const earned = sum(sections.map(section => section.earned));
  const recordedMaximum = sum(sections.map(section => section.recordedMaximum));
  const complete = Math.abs(recordedMaximum - 100) < 0.005;
  return {
    earned,
    maximum: 100,
    percentage: percentage(earned, 100),
    recordedMaximum,
    completion: percentage(recordedMaximum, 100),
    complete,
    finalScore: complete ? earned : null,
    sections,
    dimensions,
  };
}

export function planModeDescription(mode: GradePlanMode) {
  if (mode === "units") return "تقسيم الـ100 على عدد مرن من الوحدات ثم توزيع درجة كل وحدة على عناصرها.";
  if (mode === "periods") return "فترتان مستقلتان، كل فترة من 100 درجة ولها توزيعها الخاص.";
  if (mode === "custom") return "عناصر تقييم بأسماء يحددها المعلم ودرجات يوزعها بنفسه.";
  return "توزيع الـ100 مباشرة على عناصر التقييم بدون وحدات.";
}
