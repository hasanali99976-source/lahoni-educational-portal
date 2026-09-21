import "server-only";

import { adminDb } from "./firebase-admin";
import {
  SCHOOL_STUDENTS_COLLECTION,
  canonicalClassName,
  gradeLabel,
  gradeNumber,
  normalizeStudentRecord,
  sectionNumber,
} from "../school-roster";
import {
  assignmentFromId,
  assignmentId,
  normalizeAssignments,
  type TeacherAssignment,
} from "../teacher-assignments";
import {
  SUBJECT_CLASS_OWNERS_COLLECTION,
  TEACHER_CLASS_SCOPES_COLLECTION,
  normalizeClassIds,
  subjectClassOwnerId,
  teacherClassScopeId,
} from "../teacher-class-scope";

export type ManagedClass = {
  id: string;
  grade: 1 | 2 | 3;
  section: string;
  name: string;
};

export type ClassSyncSummary = {
  studentsUpdated: number;
  linkedStudentsUpdated: number;
  teachersUpdated: number;
  assignmentsUpdated: number;
  scopesUpdated: number;
  ownersUpdated: number;
};

type WriteOperation =
  | { type: "set"; ref: any; data: Record<string, unknown>; options?: { merge: boolean } }
  | { type: "delete"; ref: any };

const ALL_SECTIONS = new Set(["", "الكل", "كل", "جميع الفصول"]);

function normalizedSection(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
}

function referenceFromPath(path: string) {
  const separator = path.lastIndexOf("/");
  if (separator <= 0 || separator === path.length - 1) {
    throw new Error(`مسار مستند غير صالح: ${path}`);
  }
  return adminDb().collection(path.slice(0, separator)).doc(path.slice(separator + 1));
}

function isAllSections(value: unknown) {
  return ALL_SECTIONS.has(String(value ?? "").trim());
}

function assignmentMatchesExact(assignment: TeacherAssignment, schoolClass: ManagedClass) {
  return gradeNumber(assignment.grade) === schoolClass.grade
    && !isAllSections(assignment.section)
    && normalizedSection(assignment.section) === schoolClass.section;
}

function studentMatchesClass(data: Record<string, unknown>, schoolClass: ManagedClass) {
  const student = normalizeStudentRecord(data, String(data.code || data.accessCode || data.studentCode || ""));
  if (student) return student.grade === schoolClass.grade && normalizedSection(student.section) === schoolClass.section;
  const grade = gradeNumber(data.grade || data.className || data.class);
  const section = sectionNumber(data.section, data.className || data.class);
  return grade === schoolClass.grade && normalizedSection(section) === schoolClass.section;
}

async function commitOperations(operations: WriteOperation[]) {
  const database = adminDb();
  for (let index = 0; index < operations.length; index += 350) {
    const batch = database.batch();
    operations.slice(index, index + 350).forEach(operation => {
      if (operation.type === "delete") batch.delete(operation.ref);
      else batch.set(operation.ref, operation.data, operation.options || { merge: true });
    });
    await batch.commit();
  }
}

export async function countActiveStudentsInClass(schoolClass: ManagedClass) {
  const snapshot = await adminDb().collection(SCHOOL_STUDENTS_COLLECTION).get();
  return snapshot.docs.filter(document => {
    const student = normalizeStudentRecord(document.data() as Record<string, unknown>, document.id);
    return !!student
      && student.active !== false
      && student.grade === schoolClass.grade
      && normalizedSection(student.section) === schoolClass.section;
  }).length;
}

async function synchronizeStudents(previous: ManagedClass, next: ManagedClass | null, archiveStudents: boolean) {
  const database = adminDb();
  const now = new Date().toISOString();
  const operations: WriteOperation[] = [];

  const centralSnapshot = await database.collection(SCHOOL_STUDENTS_COLLECTION).get();
  centralSnapshot.docs.forEach(document => {
    const data = document.data() as Record<string, unknown>;
    if (!studentMatchesClass(data, previous)) return;
    const reference = referenceFromPath(document.ref.path);
    if (next) {
      operations.push({
        type: "set",
        ref: reference,
        data: {
          grade: next.grade,
          section: next.section,
          className: next.name,
          class: next.name,
          active: data.active !== false,
          rosterActive: data.rosterActive !== false,
          transferredAt: now,
          updatedAt: now,
        },
        options: { merge: true },
      });
    } else if (archiveStudents) {
      operations.push({
        type: "set",
        ref: reference,
        data: { active: false, rosterActive: false, archivedAt: now, updatedAt: now },
        options: { merge: true },
      });
    }
  });
  const centralCount = operations.length;

  let linkedCount = 0;
  try {
    const linkedSnapshot = await database.collectionGroup("students").get();
    linkedSnapshot.docs.forEach(document => {
      const data = document.data() as Record<string, unknown>;
      if (!studentMatchesClass(data, previous)) return;
      const reference = referenceFromPath(document.ref.path);
      if (next) {
        operations.push({
          type: "set",
          ref: reference,
          data: {
            grade: next.grade,
            section: next.section,
            className: next.name,
            class: next.name,
            transferredAt: now,
            updatedAt: now,
          },
          options: { merge: true },
        });
        linkedCount += 1;
      } else if (archiveStudents) {
        operations.push({
          type: "set",
          ref: reference,
          data: { active: false, rosterActive: false, archivedAt: now, updatedAt: now },
          options: { merge: true },
        });
        linkedCount += 1;
      }
    });
  } catch (error) {
    console.warn("linked student class synchronization skipped", error);
  }

  await commitOperations(operations);
  return { studentsUpdated: centralCount, linkedStudentsUpdated: linkedCount };
}

async function synchronizeTeachers(previous: ManagedClass, next: ManagedClass | null) {
  // Class administration must never rewrite teacher subject assignments.
  // Assignments define the teacher workspace and are managed only from teacher administration.
  // Student/class moves are reflected through the central roster instead, preserving all teacher work.
  void previous;
  void next;
  return { teachersUpdated: 0, assignmentsUpdated: 0 };
}

async function synchronizeScopesAndOwners(previous: ManagedClass, next: ManagedClass | null) {
  // Preserve teacher scopes/owners when a school class is removed or renamed.
  // This prevents an admin roster action from hiding an existing teacher workspace.
  void previous;
  void next;
  return { scopesUpdated: 0, ownersUpdated: 0 };
}

export async function synchronizeClassChange(input: {
  previous: ManagedClass;
  next?: ManagedClass | null;
  archiveStudents?: boolean;
}) {
  const next = input.next ?? null;
  const [studentSummary, teacherSummary, scopeSummary] = await Promise.all([
    synchronizeStudents(input.previous, next, input.archiveStudents === true),
    synchronizeTeachers(input.previous, next),
    synchronizeScopesAndOwners(input.previous, next),
  ]);

  return {
    ...studentSummary,
    ...teacherSummary,
    ...scopeSummary,
  } satisfies ClassSyncSummary;
}

export function managedClass(gradeValue: unknown, sectionValue: unknown): ManagedClass | null {
  const grade = gradeNumber(gradeValue);
  const section = normalizedSection(sectionValue);
  if (!grade || !/^[1-8]$/.test(section)) return null;
  return {
    id: `${grade}-${section}`,
    grade,
    section,
    name: canonicalClassName(grade, section),
  };
}
