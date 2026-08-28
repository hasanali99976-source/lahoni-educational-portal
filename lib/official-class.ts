import { SECTION_OPTIONS, canonicalClassName, gradeNumber, sectionNumber } from "./school-roster";

/**
 * Returns one official numeric class label only, e.g. "الثاني الثانوي ٣".
 * Legacy letter sections such as "ثاني أ" are rejected and never displayed.
 */
export function officialClassName(value: unknown, explicitSection?: unknown) {
  const grade = gradeNumber(value);
  const section = sectionNumber(explicitSection, value);
  if (!grade || !SECTION_OPTIONS.includes(section as (typeof SECTION_OPTIONS)[number])) return "";
  return canonicalClassName(grade, section);
}

export function hasOfficialNumericClass(value: unknown, explicitSection?: unknown) {
  return Boolean(officialClassName(value, explicitSection));
}
