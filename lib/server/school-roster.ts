import "server-only";

import { createHash } from "node:crypto";
import { adminDb } from "./firebase-admin";
import { getSubjectConfig } from "../subject-config";
import { normalizeAssignments, type TeacherAssignment } from "../teacher-assignments";

const SHARED_STUDENTS = "school_shared_students";
const SHARED_CLASSES = "school_shared_classes";
const ARCHIVED_STUDENTS = "archivedStudents";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const SYNC_TTL = 45_000;

type TeacherRow = {
  id: string;
  name: string;
  active: boolean;
  assignments: TeacherAssignment[];
  subjectIds: string[];
};

type StudentRow = Record<string, unknown> & {
  name?: string;
  class?: string;
  accessCode?: string;
  studentCode?: string;
  sharedRosterId?: string;
  rosterActive?: boolean;
  active?: boolean;
};

let lastSyncAt = 0;
let syncPromise: Promise<void> | null = null;

const clean = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();
const normalizeArabic = (value: unknown) => clean(value)
  .replace(/[إأآ]/g, "ا")
  .replace(/ى/g, "ي")
  .replace(/ة/g, "ه")
  .replace(/[٠-٩]/g, digit => String(ARABIC_DIGITS.indexOf(digit)))
  .replace(/الأول|الاول/g, "اول")
  .replace(/الثاني/g, "ثاني")
  .replace(/الثالث/g, "ثالث")
  .replace(/[ـ،,/_-]+/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase();

const classId = (name: string) => encodeURIComponent(normalizeArabic(name)).replace(/%/g, "_").slice(0, 140);
const identityOf = (student: StudentRow) => `${normalizeArabic(student.class)}|${normalizeArabic(student.name)}`;
const codeOf = (id: string, student: StudentRow) => clean(student.accessCode || student.studentCode || id).toUpperCase();
const hashedRosterId = (identity: string) => `STU_${createHash("sha1").update(identity).digest("hex").slice(0, 24)}`;

export function canonicalSubjectIds(assignments: TeacherAssignment[]) {
  return [...new Set(assignments.map(item => clean(item.subjectId)).filter(Boolean))];
}

function gradeNumber(value: unknown): number | null {
  const normalized = normalizeArabic(value);
  if (/اول/.test(normalized)) return 1;
  if (/ثاني/.test(normalized)) return 2;
  if (/ثالث/.test(normalized)) return 3;
  const first = normalized.match(/(?:^|\s)([123])(?:\s|$)/)?.[1];
  return first ? Number(first) : null;
}

function sectionNumber(value: unknown): string | null {
  const normalized = normalizeArabic(value);
  if (!normalized || normalized === "الكل" || normalized === "كل") return null;
  const explicit = normalized.match(/(?:فصل\s*)?([1-8])$/)?.[1];
  return explicit || null;
}

export function assignmentMatchesClass(assignment: TeacherAssignment, className: string) {
  const assignmentGrade = gradeNumber(assignment.grade);
  const classGrade = gradeNumber(className);
  if (!assignmentGrade || assignmentGrade !== classGrade) return false;
  if (normalizeArabic(assignment.section) === "الكل") return true;
  const assignedSection = sectionNumber(assignment.section);
  const classSection = sectionNumber(className);
  return !!assignedSection && assignedSection === classSection;
}

function sameValues(left: string[], right: string[]) {
  return [...left].sort().join("|") === [...right].sort().join("|");
}

async function loadTeachers(): Promise<TeacherRow[]> {
  const snapshot = await adminDb().collection("portalV2Users").where("role", "==", "teacher").get();
  const teachers: TeacherRow[] = [];

  for (const item of snapshot.docs) {
    const data = item.data();
    const assignments = normalizeAssignments(data.assignments, data.subjectIds);
    const subjectIds = canonicalSubjectIds(assignments);
    if (!subjectIds.length) continue;

    const storedSubjectIds = Array.isArray(data.subjectIds) ? data.subjectIds.map(String) : [];
    const normalizedAssignments = assignments.filter(row => row.subjectId && row.grade && row.section);
    const update: Record<string, unknown> = {};
    if (!sameValues(storedSubjectIds, subjectIds)) update.subjectIds = subjectIds;
    if (!Array.isArray(data.assignments) && normalizedAssignments.length) update.assignments = normalizedAssignments;
    if (Object.keys(update).length) await adminDb().collection("portalV2Users").doc(item.id).update(update);

    teachers.push({
      id: item.id,
      name: clean(data.name) || "المعلم",
      active: data.active !== false,
      assignments: normalizedAssignments,
      subjectIds,
    });
  }

  return teachers;
}

async function copyLegacyCollection(teacher: TeacherRow, assignment: TeacherAssignment, collectionName: string) {
  if (!assignment.id || assignment.id === assignment.subjectId) return;
  const source = `portalV2Data/${teacher.id}/subjects/${assignment.id}/${collectionName}`;
  const target = `portalV2Data/${teacher.id}/subjects/${assignment.subjectId}/${collectionName}`;
  const snapshot = await adminDb().collection(source).get();

  for (const item of snapshot.docs) {
    const data = item.data();
    await adminDb().collection(target).doc(item.id).set({
      ...data,
      teacherId: teacher.id,
      teacherName: teacher.name,
      subjectKey: assignment.subjectId,
      migratedFromSubjectKey: assignment.id,
      migratedAt: new Date().toISOString(),
    }, { merge: true });
  }
}

async function migrateLegacyTeacherData(teacher: TeacherRow) {
  for (const assignment of teacher.assignments) {
    await copyLegacyCollection(teacher, assignment, "students");
    await copyLegacyCollection(teacher, assignment, "classes");
    await copyLegacyCollection(teacher, assignment, ARCHIVED_STUDENTS);
  }
}

async function rebuildSharedRoster(teachers: TeacherRow[]) {
  const sharedSnapshot = await adminDb().collection(SHARED_STUDENTS).get();
  const sharedById = new Map<string, StudentRow>();
  const idByIdentity = new Map<string, string>();

  sharedSnapshot.docs.forEach(item => {
    const data = item.data() as StudentRow;
    sharedById.set(item.id, data);
    const identity = identityOf(data);
    if (identity !== "|" && !idByIdentity.has(identity)) idByIdentity.set(identity, item.id);
  });

  for (const teacher of teachers) {
    if (!teacher.active) continue;
    const visitedSubjects = new Set<string>();

    for (const assignment of teacher.assignments) {
      if (visitedSubjects.has(assignment.subjectId)) continue;
      visitedSubjects.add(assignment.subjectId);
      const studentsPath = `portalV2Data/${teacher.id}/subjects/${assignment.subjectId}/students`;
      const studentsSnapshot = await adminDb().collection(studentsPath).get();

      for (const item of studentsSnapshot.docs) {
        const student = item.data() as StudentRow;
        if (student.rosterActive === false || student.active === false) continue;
        const name = clean(student.name);
        const className = clean(student.class);
        if (!name || !className) continue;

        const identity = identityOf({ ...student, name, class: className });
        const requestedId = clean(student.sharedRosterId);
        const sharedId = requestedId || idByIdentity.get(identity) || hashedRosterId(identity);
        const existing = sharedById.get(sharedId);
        if (existing?.active === false) continue;
        const code = codeOf(item.id, existing || student);
        const payload: StudentRow = {
          name,
          class: className,
          grade: student.grade || existing?.grade || gradeNumber(className),
          accessCode: code,
          studentCode: code,
          active: true,
          firstTeacherId: existing?.firstTeacherId || student.teacherId || teacher.id,
          firstTeacherName: existing?.firstTeacherName || student.teacherName || teacher.name,
          lastTeacherId: teacher.id,
          lastTeacherName: teacher.name,
          updatedAt: new Date().toISOString(),
        };
        await adminDb().collection(SHARED_STUDENTS).doc(sharedId).set(payload, { merge: true });
        await adminDb().collection(SHARED_CLASSES).doc(classId(className)).set({ name: className, updatedAt: new Date().toISOString() }, { merge: true });
        if (student.sharedRosterId !== sharedId) {
          await adminDb().collection(studentsPath).doc(item.id).set({ sharedRosterId: sharedId, rosterActive: true }, { merge: true });
        }
        sharedById.set(sharedId, { ...existing, ...payload });
        idByIdentity.set(identity, sharedId);
      }
    }
  }
}

async function archiveStudent(teacher: TeacherRow, subjectId: string, id: string, data: StudentRow, reason: string) {
  const archivePath = `portalV2Data/${teacher.id}/subjects/${subjectId}/${ARCHIVED_STUDENTS}`;
  const studentsPath = `portalV2Data/${teacher.id}/subjects/${subjectId}/students`;
  await adminDb().collection(archivePath).doc(id).set({
    ...data,
    rosterActive: false,
    archivedReason: reason,
    archivedAt: new Date().toISOString(),
  }, { merge: true });
  await adminDb().collection(studentsPath).doc(id).delete();
}

async function seedTeacher(teacher: TeacherRow, sharedStudents: Array<{ id: string; data: StudentRow }>) {
  const assignmentsBySubject = new Map<string, TeacherAssignment[]>();
  teacher.assignments.forEach(assignment => {
    const list = assignmentsBySubject.get(assignment.subjectId) || [];
    list.push(assignment);
    assignmentsBySubject.set(assignment.subjectId, list);
  });

  for (const [subjectId, assignments] of assignmentsBySubject) {
    const studentsPath = `portalV2Data/${teacher.id}/subjects/${subjectId}/students`;
    const classesPath = `portalV2Data/${teacher.id}/subjects/${subjectId}/classes`;
    const archivePath = `portalV2Data/${teacher.id}/subjects/${subjectId}/${ARCHIVED_STUDENTS}`;
    const existingSnapshot = await adminDb().collection(studentsPath).get();
    const existingBySharedId = new Map<string, { id: string; data: StudentRow }>();
    const existingByIdentity = new Map<string, { id: string; data: StudentRow }>();

    existingSnapshot.docs.forEach(item => {
      const data = item.data() as StudentRow;
      const sharedId = clean(data.sharedRosterId);
      if (sharedId) existingBySharedId.set(sharedId, { id: item.id, data });
      const identity = identityOf(data);
      if (identity !== "|") existingByIdentity.set(identity, { id: item.id, data });
    });

    for (const item of existingSnapshot.docs) {
      const data = item.data() as StudentRow;
      if (!assignments.some(assignment => assignmentMatchesClass(assignment, clean(data.class)))) {
        await archiveStudent(teacher, subjectId, item.id, data, "assignment_changed");
      }
    }

    for (const shared of sharedStudents) {
      if (shared.data.active === false) continue;
      const name = clean(shared.data.name);
      const className = clean(shared.data.class);
      if (!name || !className || !assignments.some(assignment => assignmentMatchesClass(assignment, className))) continue;

      const identity = identityOf(shared.data);
      const existing = existingBySharedId.get(shared.id) || existingByIdentity.get(identity);
      const code = codeOf(shared.id, shared.data);
      const localId = existing?.id || code || shared.id;
      const archivedRef = adminDb().collection(archivePath).doc(localId);
      const archived = await archivedRef.get();
      const archivedData = archived.exists ? archived.data() : {};

      await adminDb().collection(studentsPath).doc(localId).set({
        ...archivedData,
        name,
        class: className,
        grade: shared.data.grade || gradeNumber(className),
        accessCode: code,
        studentCode: code,
        teacherId: teacher.id,
        teacherName: teacher.name,
        subjectKey: subjectId,
        subject: getSubjectConfig(subjectId).label,
        sharedRosterId: shared.id,
        rosterActive: true,
        linkedFromSharedRoster: true,
        createdAt: archivedData.createdAt || new Date().toISOString(),
        restoredAt: archived.exists ? new Date().toISOString() : archivedData.restoredAt || null,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      if (archived.exists) await archivedRef.delete();

      await adminDb().collection(classesPath).doc(classId(className)).set({
        name: className,
        teacherId: teacher.id,
        teacherName: teacher.name,
        subjectKey: subjectId,
        linkedFromAssignment: true,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    }
  }
}

async function runSchoolRosterSync() {
  const teachers = await loadTeachers();
  for (const teacher of teachers) await migrateLegacyTeacherData(teacher);
  await rebuildSharedRoster(teachers);

  const sharedSnapshot = await adminDb().collection(SHARED_STUDENTS).get();
  const sharedStudents = sharedSnapshot.docs.map(item => ({ id: item.id, data: item.data() as StudentRow }));
  for (const teacher of teachers) if (teacher.active) await seedTeacher(teacher, sharedStudents);
}

export async function synchronizeSchoolRosters(force = false) {
  if (!force && Date.now() - lastSyncAt < SYNC_TTL) return;
  if (syncPromise) return syncPromise;
  syncPromise = runSchoolRosterSync()
    .then(() => { lastSyncAt = Date.now(); })
    .finally(() => { syncPromise = null; });
  return syncPromise;
}
