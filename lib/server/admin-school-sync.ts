import "server-only";

import { adminDb } from "./firebase-admin";
import {
  SCHOOL_STUDENTS_COLLECTION,
  canonicalClassName,
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
    if (next) {
      operations.push({
        type: "set",
        ref: document.ref,
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
        ref: document.ref,
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
      if (next) {
        operations.push({
          type: "set",
          ref: document.ref,
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
          ref: document.ref,
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
  const database = adminDb();
  const now = new Date().toISOString();
  const teachersSnapshot = await database.collection("portalV2Users").where("role", "==", "teacher").get();
  let teachersUpdated = 0;
  let assignmentsUpdated = 0;

  for (const teacherDocument of teachersSnapshot.docs) {
    const teacherData = teacherDocument.data() as Record<string, unknown>;
    const currentAssignments = normalizeAssignments(teacherData.assignments, teacherData.subjectIds);
    const affected = currentAssignments.some(assignment => assignmentMatchesExact(assignment, previous));
    if (!affected) continue;

    const nextAssignments: TeacherAssignment[] = [];
    currentAssignments.forEach(assignment => {
      if (!assignmentMatchesExact(assignment, previous)) {
        nextAssignments.push(assignment);
        return;
      }
      if (next) {
        nextAssignments.push(assignmentFromId(assignmentId(
          assignment.subjectId,
          next.name.replace(/\s+[٠-٩0-9]+$/, "").trim(),
          next.section,
        )));
      }
    });
    const uniqueAssignments = [...new Map(nextAssignments.map(item => [item.id, item])).values()];
    const subjectIds = [...new Set(uniqueAssignments.map(item => item.subjectId))];

    await teacherDocument.ref.set({
      assignments: uniqueAssignments,
      subjectIds,
      updatedAt: now,
    }, { merge: true });

    const assignmentCollection = database.collection("portalV2Assignments");
    const previousDocuments = await assignmentCollection.where("teacherId", "==", teacherDocument.id).get();
    const operations: WriteOperation[] = previousDocuments.docs.map(document => ({ type: "delete", ref: document.ref }));
    uniqueAssignments.forEach(assignment => {
      operations.push({
        type: "set",
        ref: assignmentCollection.doc(`${teacherDocument.id}__${assignment.id}`),
        data: {
          teacherId: teacherDocument.id,
          subjectId: assignment.subjectId,
          assignmentId: assignment.id,
          grade: assignment.grade,
          section: assignment.section,
          active: true,
          archivedAt: null,
          updatedAt: now,
          createdAt: now,
        },
        options: { merge: true },
      });
    });
    await commitOperations(operations);
    teachersUpdated += 1;
    assignmentsUpdated += uniqueAssignments.length;
  }

  return { teachersUpdated, assignmentsUpdated };
}

async function synchronizeScopesAndOwners(previous: ManagedClass, next: ManagedClass | null) {
  const database = adminDb();
  const now = new Date().toISOString();
  const operations: WriteOperation[] = [];
  let scopesUpdated = 0;
  let ownersUpdated = 0;

  const scopesSnapshot = await database.collection(TEACHER_CLASS_SCOPES_COLLECTION).get();
  scopesSnapshot.docs.forEach(document => {
    const data = document.data() as Record<string, unknown>;
    const selected = normalizeClassIds(data.selectedClassIds);
    if (!selected.includes(previous.id)) return;
    const nextSelected = [...new Set(selected.flatMap(value => value === previous.id ? (next ? [next.id] : []) : [value]))];
    const teacherId = String(data.teacherId || "");
    const subjectId = String(data.subjectId || "");
    const targetGrade = next?.grade || Number(data.grade || previous.grade);
    const targetId = teacherClassScopeId(teacherId, subjectId, targetGrade);
    operations.push({ type: "delete", ref: document.ref });
    if (nextSelected.length && teacherId && subjectId) {
      operations.push({
        type: "set",
        ref: database.collection(TEACHER_CLASS_SCOPES_COLLECTION).doc(targetId),
        data: {
          ...data,
          grade: targetGrade,
          selectedClassIds: nextSelected,
          customized: true,
          updatedAt: now,
        },
        options: { merge: true },
      });
    }
    scopesUpdated += 1;
  });

  const ownersSnapshot = await database.collection(SUBJECT_CLASS_OWNERS_COLLECTION)
    .where("classId", "==", previous.id)
    .get();
  ownersSnapshot.docs.forEach(document => {
    const data = document.data() as Record<string, unknown>;
    const subjectId = String(data.subjectId || "");
    operations.push({ type: "delete", ref: document.ref });
    if (next && subjectId) {
      operations.push({
        type: "set",
        ref: database.collection(SUBJECT_CLASS_OWNERS_COLLECTION).doc(subjectClassOwnerId(subjectId, next.id)),
        data: { ...data, classId: next.id, grade: next.grade, active: true, updatedAt: now },
        options: { merge: true },
      });
    }
    ownersUpdated += 1;
  });

  await commitOperations(operations);
  return { scopesUpdated, ownersUpdated };
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
