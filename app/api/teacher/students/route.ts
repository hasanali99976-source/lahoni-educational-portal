import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { findUserById, requireSession } from "../../../../lib/server/portal-auth";
import { normalizeAssignments } from "../../../../lib/teacher-assignments";
import {
  SCHOOL_CLASSES_COLLECTION,
  SCHOOL_STUDENTS_COLLECTION,
  canonicalClassName,
  classId,
  gradeNumber,
  normalizeArabic,
  normalizeClassRecord,
  normalizeStudentRecord,
  sectionNumber,
  studentIdentity,
  type SchoolClass,
  type SchoolStudent,
} from "../../../../lib/school-roster";
import {
  SUBJECT_CLASS_OWNERS_COLLECTION,
  TEACHER_CLASS_SCOPES_COLLECTION,
  assignmentAllowsClassExact,
  assignmentScopeSignature,
  defaultSelectedClassIds,
  normalizeClassIds,
  subjectClassOwnerId,
  teacherClassScopeId,
} from "../../../../lib/teacher-class-scope";

type Repair = { path: string; data: Record<string, unknown> };
type Grade = 1 | 2 | 3;
type LegacyRow = { id: string; raw: Record<string, unknown>; student: SchoolStudent };

function explicitlyArchived(value: Record<string, unknown>) {
  return value.deleted === true
    || value.archived === true
    || Boolean(value.deletedAt)
    || Boolean(value.archivedAt)
    || String(value.status || "").toLowerCase() === "archived";
}

function normalizeLegacy(value: Record<string, unknown>, id: string) {
  if (explicitlyArchived(value)) return null;
  return normalizeStudentRecord({ ...value, active: true, rosterActive: true }, id);
}

function documentReference(path: string) {
  const separator = path.lastIndexOf("/");
  return adminDb().collection(path.slice(0, separator)).doc(path.slice(separator + 1));
}

async function applyRepairs(repairs: Repair[]) {
  for (let index = 0; index < repairs.length; index += 350) {
    const batch = adminDb().batch();
    repairs.slice(index, index + 350).forEach(item => batch.set(documentReference(item.path), item.data, { merge: true }));
    await batch.commit();
  }
}

function classFromStudent(student: SchoolStudent): SchoolClass {
  return {
    id: classId(student.grade, student.section),
    grade: student.grade,
    section: student.section,
    name: canonicalClassName(student.grade, student.section),
    active: true,
  };
}

function assignedGrades(assignments: Array<{ grade: string }>, requestedGrade: Grade | null) {
  const grades = new Set<Grade>(
    assignments.map(item => gradeNumber(item.grade)).filter((item): item is Grade => !!item),
  );
  if (requestedGrade) return grades.has(requestedGrade) ? new Set<Grade>([requestedGrade]) : new Set<Grade>();
  return grades;
}

function classGradeFromId(value: string) {
  const grade = Number(value.split("-")[0]);
  return grade === 1 || grade === 2 || grade === 3 ? grade as Grade : null;
}

function gradeFromWorkspace(value: string, subjectId: string): Grade | null {
  const [workspaceSubject, workspaceGrade] = value.split("--");
  if (workspaceSubject !== subjectId) return null;
  const grade = Number(workspaceGrade || 0);
  return grade === 1 || grade === 2 || grade === 3 ? grade as Grade : null;
}

export async function GET(request: Request) {
  const session = await requireSession("teacher");
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const user = await findUserById(session.userId);
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });

    const url = new URL(request.url);
    const subjectId = String(url.searchParams.get("subjectId") || "").split("--")[0];
    const cookieStore = await cookies();
    const workspaceGrade = gradeFromWorkspace(cookieStore.get("lahooni_active_subject")?.value || "", subjectId);
    const requestedGradeValue = Number(url.searchParams.get("grade") || workspaceGrade || 0);
    const requestedGrade: Grade | null = requestedGradeValue === 1 || requestedGradeValue === 2 || requestedGradeValue === 3
      ? requestedGradeValue as Grade
      : null;
    const assignments = normalizeAssignments(user.assignments, user.subjectIds);
    const allRelevant = assignments.filter(item => item.subjectId === subjectId);
    const relevant = requestedGrade
      ? allRelevant.filter(item => gradeNumber(item.grade) === requestedGrade)
      : allRelevant;
    const grades = assignedGrades(allRelevant, requestedGrade);
    if (!subjectId || !relevant.length || !grades.size) {
      return NextResponse.json({ ok: true, students: [], classes: [], availableClasses: [], selectedClassIds: [], assignments: relevant });
    }

    const database = adminDb();
    const subjectPath = `portalV2Data/${session.userId}/subjects/${subjectId}/students`;
    const scopeRef = database.collection(TEACHER_CLASS_SCOPES_COLLECTION)
      .doc(teacherClassScopeId(session.userId, subjectId, requestedGrade));
    const legacySubjectScopeRef = database.collection(TEACHER_CLASS_SCOPES_COLLECTION)
      .doc(teacherClassScopeId(session.userId, subjectId));

    const [legacySnapshot, scopeSnapshot, legacySubjectScopeSnapshot, centralStudentSnapshot, centralClassSnapshot, ownerSnapshot] = await Promise.all([
      database.collection(subjectPath).get(),
      scopeRef.get(),
      requestedGrade ? legacySubjectScopeRef.get() : Promise.resolve({ exists: false, data: () => undefined }),
      database.collection(SCHOOL_STUDENTS_COLLECTION).get(),
      database.collection(SCHOOL_CLASSES_COLLECTION).get(),
      database.collection(SUBJECT_CLASS_OWNERS_COLLECTION).where("subjectId", "==", subjectId).get(),
    ]);

    const allLegacyRows = legacySnapshot.docs
      .map(item => ({ id: item.id, raw: item.data() as Record<string, unknown> }))
      .map(item => ({ ...item, student: normalizeLegacy(item.raw, item.id) }))
      .filter((item): item is LegacyRow => !!item.student);

    const centralRosterRows = centralStudentSnapshot.docs
      .map(item => normalizeStudentRecord(item.data() as Record<string, unknown>, item.id))
      .filter((item): item is SchoolStudent => !!item && item.active !== false);
    const centralByCode = new Map(centralRosterRows.map(student => [student.code, student]));
    const centralAllRows = centralRosterRows.filter(item => grades.has(item.grade as Grade));

    // A moved student may still have an older teacher-subject document. Resolve every
    // legacy row through the current central record by code before filtering the grade.
    const legacyRows = allLegacyRows
      .map(item => {
        const official = centralByCode.get(item.student.code);
        if (!official) return grades.has(item.student.grade as Grade) ? item : null;
        if (!grades.has(official.grade as Grade)) return null;
        return {
          ...item,
          student: {
            ...item.student,
            ...official,
            id: official.code,
            code: official.code,
            grade: official.grade,
            section: official.section,
            className: canonicalClassName(official.grade, official.section),
            active: true,
          } as SchoolStudent,
        };
      })
      .filter((item): item is LegacyRow => !!item);

    const availableMap = new Map<string, SchoolClass>();
    centralClassSnapshot.docs.forEach(item => {
      const data = item.data() as Record<string, unknown>;
      const schoolClass = normalizeClassRecord({ id: item.id, ...data } as Partial<SchoolClass>);
      if (!schoolClass || schoolClass.active === false || !grades.has(schoolClass.grade as Grade)) return;
      availableMap.set(schoolClass.id, schoolClass);
    });
    centralAllRows.forEach(student => availableMap.set(classId(student.grade, student.section), classFromStudent(student)));
    legacyRows.forEach(item => availableMap.set(classId(item.student.grade, item.student.section), classFromStudent(item.student)));

    const exactAssignmentClassIds = new Set<string>();
    relevant.forEach(assignment => {
      const normalizedSection = normalizeArabic(assignment.section);
      if (!normalizedSection || ["الكل", "كل", "جميع الفصول"].includes(normalizedSection)) return;
      const assignedGrade = gradeNumber(assignment.grade);
      const assignedSection = sectionNumber(assignment.section);
      if (!assignedGrade || !assignedSection || (requestedGrade && assignedGrade !== requestedGrade)) return;
      const assignedClassId = classId(assignedGrade, assignedSection);
      exactAssignmentClassIds.add(assignedClassId);
      if (!availableMap.has(assignedClassId)) {
        availableMap.set(assignedClassId, {
          id: assignedClassId,
          grade: assignedGrade,
          section: assignedSection,
          name: canonicalClassName(assignedGrade, assignedSection),
          active: true,
        });
      }
    });

    const allStageClasses = [...availableMap.values()]
      .filter(item => /^\d+-\d+$/.test(item.id))
      .sort((a, b) => a.grade - b.grade || Number(a.section) - Number(b.section));

    const rawOwnerRows = ownerSnapshot.docs.map(item => {
      const data = item.data() as Record<string, unknown>;
      return {
        documentId: item.id,
        ownedClassId: String(data.classId || ""),
        teacherId: String(data.teacherId || ""),
      };
    }).filter(item => !!item.ownedClassId && !!item.teacherId);

    const ownerTeacherIds = [...new Set(rawOwnerRows.map(item => item.teacherId).filter(id => id !== session.userId))];
    const ownerTeacherRecords = new Map<string, Record<string, unknown>>();
    await Promise.all(ownerTeacherIds.map(async teacherId => {
      const snapshot = await database.collection("portalV2Users").doc(teacherId).get();
      if (snapshot.exists) ownerTeacherRecords.set(teacherId, snapshot.data() as Record<string, unknown>);
    }));

    const ownerByClass = new Map<string, string>();
    const invalidOwnerDocumentIds = new Set<string>();
    rawOwnerRows.forEach(row => {
      if (row.teacherId === session.userId) {
        ownerByClass.set(row.ownedClassId, row.teacherId);
        return;
      }

      const schoolClass = availableMap.get(row.ownedClassId);
      const ownerUser = ownerTeacherRecords.get(row.teacherId);
      const ownerAssignments = ownerUser
        ? normalizeAssignments(ownerUser.assignments, ownerUser.subjectIds)
        : [];
      const ownerStillAssigned = Boolean(
        ownerUser
        && ownerUser.active !== false
        && schoolClass
        && ownerAssignments.some(assignment =>
          assignment.subjectId === subjectId
          && assignmentAllowsClassExact(assignment, schoolClass.grade, schoolClass.section),
        ),
      );

      if (!ownerStillAssigned) {
        invalidOwnerDocumentIds.add(row.documentId);
        return;
      }

      if (exactAssignmentClassIds.has(row.ownedClassId)) return;
      ownerByClass.set(row.ownedClassId, row.teacherId);
    });

    const classIsClaimable = (id: string) => {
      if (exactAssignmentClassIds.has(id)) return true;
      const owner = ownerByClass.get(id);
      return !owner || owner === session.userId;
    };

    const currentSignature = assignmentScopeSignature(assignments, subjectId, requestedGrade);
    const scopeData = scopeSnapshot.exists ? scopeSnapshot.data() as Record<string, unknown> : null;
    const storedSignature = String(scopeData?.assignmentSignature || "");
    const storedSelection = normalizeClassIds(scopeData?.selectedClassIds)
      .filter(id => availableMap.has(id) && grades.has(classGradeFromId(id) as Grade) && classIsClaimable(id));
    const savedScopeValid = scopeData?.customized === true && storedSignature === currentSignature;

    const legacyScopeData = legacySubjectScopeSnapshot.exists
      ? legacySubjectScopeSnapshot.data() as Record<string, unknown>
      : null;
    const legacySelection = normalizeClassIds(legacyScopeData?.selectedClassIds)
      .filter(id => availableMap.has(id) && grades.has(classGradeFromId(id) as Grade) && classIsClaimable(id));
    const canMigrateLegacySelection = !scopeSnapshot.exists
      && requestedGrade !== null
      && legacyScopeData?.customized === true
      && legacySelection.length > 0;

    const scopeCustomized = savedScopeValid || canMigrateLegacySelection;
    const claimableClasses = allStageClasses.filter(item => classIsClaimable(item.id));
    const defaultSelection = defaultSelectedClassIds(relevant, subjectId, claimableClasses, requestedGrade);
    const baseSelection = savedScopeValid
      ? storedSelection
      : canMigrateLegacySelection
        ? legacySelection
        : defaultSelection;
    const selectedClassIds = [...new Set([...baseSelection, ...exactAssignmentClassIds])]
      .filter(id => availableMap.has(id) && classIsClaimable(id));
    const selected = new Set(selectedClassIds);
    const availableClasses = scopeCustomized
      ? allStageClasses.filter(item => selected.has(item.id))
      : claimableClasses;

    const selectedLegacyRows = legacyRows.filter(item => selected.has(classId(item.student.grade, item.student.section)));
    const centralRows = centralAllRows.filter(item => selected.has(classId(item.grade, item.section)));

    const byCode = new Map<string, SchoolStudent>();
    selectedLegacyRows.forEach(item => {
      byCode.set(item.student.code, { ...item.student, active: true });
    });
    centralRows.forEach(item => {
      const previous = byCode.get(item.code);
      byCode.set(item.code, {
        ...previous,
        ...item,
        id: item.code,
        code: item.code,
        grade: item.grade,
        section: item.section,
        className: canonicalClassName(item.grade, item.section),
        active: true,
      });
    });

    const students = [...byCode.values()]
      .map(item => ({
        ...item,
        id: item.code,
        code: item.code,
        className: canonicalClassName(item.grade, item.section),
        active: true,
        officialRoster: true,
      }))
      .sort((a, b) => a.className.localeCompare(b.className, "ar", { numeric: true }) || a.name.localeCompare(b.name, "ar"));

    const repairs: Repair[] = [];
    const existingIds = new Set(legacySnapshot.docs.map(item => item.id));
    const legacyIdentities = new Set(selectedLegacyRows.map(item => studentIdentity(item.student)));
    const now = new Date().toISOString();

    exactAssignmentClassIds.forEach(selectedClassId => {
      repairs.push({
        path: `${SUBJECT_CLASS_OWNERS_COLLECTION}/${subjectClassOwnerId(subjectId, selectedClassId)}`,
        data: {
          teacherId: session.userId,
          subjectId,
          classId: selectedClassId,
          grade: classGradeFromId(selectedClassId),
          active: true,
          assignmentOwned: true,
          updatedAt: now,
        },
      });
    });

    selectedLegacyRows.forEach(item => {
      const canonical = canonicalClassName(item.student.grade, item.student.section);
      if (item.raw.active === false
        || item.raw.rosterActive === false
        || String(item.raw.class || "") !== canonical
        || String(item.raw.className || "") !== canonical
        || Number(item.raw.grade) !== item.student.grade
        || String(item.raw.section || "") !== item.student.section) {
        repairs.push({
          path: `${subjectPath}/${item.id}`,
          data: {
            name: item.student.name,
            class: canonical,
            className: canonical,
            grade: item.student.grade,
            section: item.student.section,
            code: item.student.code,
            accessCode: item.student.code,
            studentCode: item.student.code,
            teacherId: session.userId,
            subjectKey: subjectId,
            active: true,
            rosterActive: true,
            updatedAt: now,
          },
        });
      }
    });

    centralRows.forEach(student => {
      const identity = studentIdentity(student);
      if (legacyIdentities.has(identity)) return;
      let documentId = student.code;
      if (existingIds.has(documentId)) documentId = `${student.code}__${student.grade}_${student.section}`;
      existingIds.add(documentId);
      repairs.push({
        path: `${subjectPath}/${documentId}`,
        data: {
          name: student.name,
          class: student.className,
          className: student.className,
          grade: student.grade,
          section: student.section,
          code: student.code,
          accessCode: student.code,
          studentCode: student.code,
          teacherId: session.userId,
          subjectKey: subjectId,
          active: true,
          rosterActive: true,
          updatedAt: now,
        },
      });
    });

    if (scopeCustomized) {
      selectedClassIds.forEach(selectedClassId => {
        if (exactAssignmentClassIds.has(selectedClassId)) return;
        if (ownerByClass.get(selectedClassId)) return;
        repairs.push({
          path: `${SUBJECT_CLASS_OWNERS_COLLECTION}/${subjectClassOwnerId(subjectId, selectedClassId)}`,
          data: {
            teacherId: session.userId,
            subjectId,
            classId: selectedClassId,
            grade: classGradeFromId(selectedClassId),
            active: true,
            updatedAt: now,
          },
        });
      });
    }

    if (canMigrateLegacySelection) {
      repairs.push({
        path: `${TEACHER_CLASS_SCOPES_COLLECTION}/${teacherClassScopeId(session.userId, subjectId, requestedGrade)}`,
        data: {
          teacherId: session.userId,
          subjectId,
          grade: requestedGrade,
          selectedClassIds,
          customized: true,
          assignmentSignature: currentSignature,
          migratedFromSubjectScope: true,
          updatedAt: now,
        },
      });
    } else if (scopeSnapshot.exists && !savedScopeValid) {
      repairs.push({
        path: `${TEACHER_CLASS_SCOPES_COLLECTION}/${teacherClassScopeId(session.userId, subjectId, requestedGrade)}`,
        data: {
          teacherId: session.userId,
          subjectId,
          grade: requestedGrade,
          selectedClassIds,
          customized: false,
          assignmentSignature: currentSignature,
          resetReason: "assignment_changed",
          updatedAt: now,
        },
      });
    }

    try {
      if (repairs.length) await applyRepairs(repairs);
    } catch (repairError) {
      console.warn("teacher roster repair deferred", repairError);
    }

    try {
      if (invalidOwnerDocumentIds.size) {
        const cleanupBatch = database.batch();
        invalidOwnerDocumentIds.forEach(documentId => {
          cleanupBatch.delete(database.collection(SUBJECT_CLASS_OWNERS_COLLECTION).doc(documentId));
        });
        await cleanupBatch.commit();
      }
    } catch (cleanupError) {
      console.warn("stale class owner cleanup deferred", cleanupError);
    }

    const classes = allStageClasses.filter(item => selected.has(item.id));
    return NextResponse.json({
      ok: true,
      students,
      classes,
      availableClasses,
      selectedClassIds,
      scopeCustomized,
      scopeInvalidated: Boolean(scopeSnapshot.exists && !savedScopeValid),
      assignments: relevant,
      assignedGrades: [...grades],
      activeGrade: requestedGrade,
      reservedForTeacher: selectedClassIds.length,
      hiddenOwnedByOtherTeachers: Math.max(0, allStageClasses.length - claimableClasses.length),
      recoveredLegacy: selectedLegacyRows.length,
      preservedHiddenLegacy: Math.max(0, legacyRows.length - selectedLegacyRows.length),
      centralAdded: Math.max(0, students.length - selectedLegacyRows.length),
      repairPending: repairs.length,
      centralReadCount: centralStudentSnapshot.docs.length,
      classReadCount: centralClassSnapshot.docs.length,
      centralStudentCodes: centralByCode.size,
      deduplicatedStudentCodes: students.length,
      exactAssignedClasses: exactAssignmentClassIds.size,
      staleOwnersIgnored: invalidOwnerDocumentIds.size,
      preservedTeacherData: true,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("teacher central roster failed", error);
    return NextResponse.json({ ok: false, message: "تعذر تحميل قائمة الطلاب" }, { status: 500 });
  }
}
