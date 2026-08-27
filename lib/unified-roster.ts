export type UnifiedStudent = {
  id: string;
  name?: string;
  class?: string;
  className?: string;
  accessCode?: string;
  studentCode?: string;
  code?: string;
  grade?: number;
  active?: boolean;
  rosterActive?: boolean;
  ownerTeacherId?: string;
  teacherId?: string;
  firstTeacherId?: string;
  lastTeacherId?: string;
  synced?: boolean;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

export const SHARED_STUDENTS_COLLECTION = "school_shared_students";
export const SHARED_CLASSES_COLLECTION = "school_shared_classes";

export function clean(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function normalizeArabic(value: unknown) {
  return clean(value)
    .replace(/[إأآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLowerCase();
}

export function normalizeClass(value: unknown) {
  return clean(value);
}

export function studentCode(student: UnifiedStudent) {
  return clean(student.accessCode || student.studentCode || student.code || student.id).toUpperCase();
}

export function gradeNumber(className: string): 1 | 2 | 3 | null {
  const value = normalizeArabic(className);
  if (/(^|\s)(1|١|اول|الاول|first)(\s|$)/.test(value)) return 1;
  if (/(^|\s)(2|٢|ثاني|الثاني|second)(\s|$)/.test(value)) return 2;
  if (/(^|\s)(3|٣|ثالث|الثالث|third)(\s|$)/.test(value)) return 3;
  return null;
}

export function nextAvailableCode(used: Set<string>, className: string) {
  const grade = gradeNumber(className);
  if (!grade) return "";
  const prefix = `TH${grade}`;
  for (let number = 1; number <= 999; number += 1) {
    const code = `${prefix}${String(number).padStart(3, "0")}`;
    if (!used.has(code)) return code;
  }
  return "";
}

export function rosterStorageKey(teacherId: string) {
  return `lahooni-unified-roster:${teacherId}`;
}

export function rosterClassesStorageKey(teacherId: string) {
  return `lahooni-unified-classes:${teacherId}`;
}

export function rosterDeletedStorageKey(teacherId: string) {
  return `lahooni-unified-roster-deleted:${teacherId}`;
}

function browserReady() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function asStudent(value: unknown): UnifiedStudent | null {
  if (!value || typeof value !== "object") return null;
  const source = value as UnifiedStudent;
  const name = clean(source.name);
  const className = normalizeClass(source.class || source.className);
  const code = studentCode(source);
  if (!name || !className || !code) return null;
  return {
    ...source,
    id: code,
    name,
    class: className,
    className,
    accessCode: code,
    studentCode: code,
    code,
    active: source.active !== false,
    rosterActive: source.rosterActive !== false,
  };
}

export function mergeStudents(...groups: UnifiedStudent[][]) {
  const merged = new Map<string, UnifiedStudent>();
  groups.flat().forEach((item) => {
    const normalized = asStudent(item);
    if (!normalized) return;
    const code = studentCode(normalized);
    const previous = merged.get(code);
    merged.set(code, { ...previous, ...normalized, id: code });
  });
  return [...merged.values()].sort((a, b) => {
    const classCompare = normalizeClass(a.class).localeCompare(normalizeClass(b.class), "ar", { numeric: true });
    return classCompare || normalizeArabic(a.name).localeCompare(normalizeArabic(b.name), "ar", { numeric: true });
  });
}

export function loadDeletedCodes(teacherId: string) {
  if (!browserReady() || !teacherId) return new Set<string>();
  try {
    const parsed = JSON.parse(localStorage.getItem(rosterDeletedStorageKey(teacherId)) || "[]");
    return new Set<string>(Array.isArray(parsed) ? parsed.map((value) => clean(value).toUpperCase()).filter(Boolean) : []);
  } catch {
    return new Set<string>();
  }
}

export function saveDeletedCodes(teacherId: string, codes: Set<string>) {
  if (!browserReady() || !teacherId) return;
  localStorage.setItem(rosterDeletedStorageKey(teacherId), JSON.stringify([...codes]));
}

export function saveLocalRoster(teacherId: string, students: UnifiedStudent[]) {
  if (!browserReady() || !teacherId) return;
  const deleted = loadDeletedCodes(teacherId);
  const normalized = mergeStudents(students).filter((student) => !deleted.has(studentCode(student)));
  localStorage.setItem(rosterStorageKey(teacherId), JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent("lahooni-roster-updated", { detail: { teacherId } }));
}

export function loadLocalRoster(teacherId: string) {
  if (!browserReady() || !teacherId) return [] as UnifiedStudent[];
  const sources: UnifiedStudent[][] = [];
  try {
    const parsed = JSON.parse(localStorage.getItem(rosterStorageKey(teacherId)) || "[]");
    if (Array.isArray(parsed)) sources.push(parsed as UnifiedStudent[]);
  } catch {
    // Rebuild from any older saved roster below.
  }

  const legacyPrefix = `lahooni-pending-students:${teacherId}:`;
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index) || "";
    if (!key.startsWith(legacyPrefix)) continue;
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "[]");
      if (Array.isArray(parsed)) sources.push(parsed as UnifiedStudent[]);
    } catch {
      // Ignore malformed legacy entries.
    }
  }

  const deleted = loadDeletedCodes(teacherId);
  const merged = mergeStudents(...sources).filter((student) => !deleted.has(studentCode(student)));
  localStorage.setItem(rosterStorageKey(teacherId), JSON.stringify(merged));
  return merged;
}

export function loadLocalClasses(teacherId: string) {
  if (!browserReady() || !teacherId) return [] as string[];
  try {
    const parsed = JSON.parse(localStorage.getItem(rosterClassesStorageKey(teacherId)) || "[]");
    const values = Array.isArray(parsed) ? parsed.map((value: unknown) => normalizeClass(value)).filter(Boolean) : [];
    return [...new Set<string>(values)].sort((a, b) => a.localeCompare(b, "ar", { numeric: true }));
  } catch {
    return [];
  }
}

export function saveLocalClasses(teacherId: string, classes: string[]) {
  if (!browserReady() || !teacherId) return;
  const normalized = [...new Set(classes.map(normalizeClass).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ar", { numeric: true }));
  localStorage.setItem(rosterClassesStorageKey(teacherId), JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent("lahooni-roster-updated", { detail: { teacherId } }));
}

export function belongsToTeacher(student: UnifiedStudent, teacherId: string) {
  return [student.ownerTeacherId, student.teacherId, student.firstTeacherId, student.lastTeacherId]
    .map(clean)
    .includes(clean(teacherId));
}

export function sharedStudentDocumentId(student: UnifiedStudent) {
  return studentCode(student);
}
