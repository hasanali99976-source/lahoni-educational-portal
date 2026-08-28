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
  normalizeClassRecord,
  normalizeStudentRecord,
  studentIdentity,
  type SchoolClass,
  type SchoolStudent,
} from "../../../../lib/school-roster";
import {
  TEACHER_CLASS_SCOPES_COLLECTION,
  assignmentScopeSignature,
  normalizeClassIds,
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
    repairs.slice(index, index + 350).forEach(item => {
      batch.set(documentReference(item.path), item.data, { merge: true });
    });
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

function assignedGrades(assignments: Array<{ grade: string }>) {
  return new Set<Grade>(
    assignments.map(item => gradeNumber(item.grade)).filter((item): item is Grade => !!item),
  );
}

function classGradeFromId(value: string) {
  const grade = Number(value.split("-")[0]);
  return grade === 1 || grade === 2 || grade === 3 ? grade as Grade : null;
}

export async function GET(request: Request) {
  const session = await requireSession("teacher");
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const user = await findUserById(session.userId);
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });

    const subjectId = String(new URL(request.url).searchParams.get("subjectId") || "").split("--")[0];
    const assignments = normalizeAssignments(user.assignments, user.subjectIds);
    const relevant = assignments.filter(item => item.subjectId === subjectId);
    const grades = assignedGrades(relevant);
    if (!subjectId || !relevant.length || !grades.size) {
      return NextResponse.json({ ok: true, students: [], classes: [], availableClasses: [], selectedClassIds: [], assignments: relevant });
    }

    const subjectPath = `portalV2Data/${session.userId}/subjects/${subjectId}/students`;
    const scopeRef = adminDb().collection(TEACHER_CLASS_SCOPES_COLLECTION)
      .doc(teacherClassScopeId(session.userId, subjectId));

    const [legacySnapshot, scopeSnapshot, centralStudentSnapshot, centralClassSnapshot] = await Promise.all([
      adminDb().collection(subjectPath).get(),
      scopeRef.get(),
      adminDb().collection(SCHOOL_STUDENTS_COLLECTION).get(),
      adminDb().collection(SCHOOL_CLASSES_COLLECTION).get(),
    ]);

    const legacyRows = legacySnapshot.docs
      .map(item => ({ id: item.id, raw: item.data() as Record<string, unknown> }))
      .map(item => ({ ...item, student: normalizeLegacy(item.raw, item.id) }))
      .filter((item): item is LegacyRow => !!item.student && grades.has(item.student.grade as Grade));

    const centralAllRows = centralStudentSnapshot.docs
      .map(item => normalizeStudentRecord(item.data() as Record<string, unknown>, item.id))
      .filter((item): item is SchoolStudent => !!item && item.active !== false && grades.has(item.grade as Grade));

    const availableMap = new Map<string, SchoolClass>();
    centralClassSnapshot.docs.forEach(item => {
      const data = item.data() as Record<string, unknown>;
      const schoolClass = normalizeClassRecord({ id: item.id, ...data } as Partial<SchoolClass>);
      if (!schoolClass || schoolClass.active === false || !grades.has(schoolClass.grade as Grade)) return;
      availableMap.set(schoolClass.id, schoolClass);
    });
    centralAllRows.forEach(student => availableMap.set(classId(student.grade, student.section), classFromStudent(student)));
    legacyRows.forEach(item => availableMap.set(classId(item.student.grade, item.student.section), classFromStudent(item.student)));

    const availableClasses = [...availableMap.values()]
      .filter(item => /^\d+-\d+$/.test(item.id))
      .sort((a, b) => a.grade - b.grade || Number(a.section) - Number(b.section));

    const scopeData = scopeSnapshot.exists ? scopeSnapshot.data() as Record<string, unknown> : null;
    const currentSignature = assignmentScopeSignature(assignments, subjectId);
    const storedSignature = String(scopeData?.assignmentSignature || "");
    const storedSelection = normalizeClassIds(scopeData?.selectedClassIds)
      .filter(id => availableMap.has(id) && grades.has(classGradeFromId(id) as Grade));
    const scopeCustomized = scopeData?.customized === true
      && storedSignature === currentSignature
      && storedSelection.length > 0;

    const selectedClassIds = scopeCustomized
      ? storedSelection
      : availableClasses.map(item => item.id);
    const selected = new Set(selectedClassIds);

    const selectedLegacyRows = legacyRows.filter(item => selected.has(classId(item.student.grade, item.student.section)));
    const centralRows = centralAllRows.filter(item => selected.has(classId(item.grade, item.section)));

    const byIdentity = new Map<string, SchoolStudent>();
    selectedLegacyRows.forEach(item => byIdentity.set(studentIdentity(item.student), { ...item.student, active: true }));
    centralRows.forEach(item => {
      const identity = studentIdentity(item);
      const previous = byIdentity.get(identity);
      byIdentity.set(identity, { ...item, ...previous, code: previous?.code || item.code, active: true });
    });

    const students = [...byIdentity.values()]
      .map(item => ({ ...item, className: canonicalClassName(item.grade, item.section), active: true }))
      .sort((a, b) => a.className.localeCompare(b.className, "ar", { numeric: true }) || a.name.localeCompare(b.name, "ar"));

    const repairs: Repair[] = [];
    const existingIds = new Set(legacySnapshot.docs.map(item => item.id));
    const legacyIdentities = new Set(selectedLegacyRows.map(item => studentIdentity(item.student)));
    const now = new Date().toISOString();

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

    if (!scopeCustomized && scopeSnapshot.exists) {
      repairs.push({
        path: `${TEACHER_CLASS_SCOPES_COLLECTION}/${teacherClassScopeId(session.userId, subjectId)}`,
        data: {
          teacherId: session.userId,
          subjectId,
          selectedClassIds,
          customized: false,
          assignmentSignature: currentSignature,
          resetReason: "assignment_or_legacy_scope_changed",
          updatedAt: now,
        },
      });
    }

    try {
      if (repairs.length) await applyRepairs(repairs);
    } catch (repairError) {
      console.warn("teacher roster repair deferred", repairError);
    }

    const classes = availableClasses.filter(item => selected.has(item.id));
    return NextResponse.json({
      ok: true,
      students,
      classes,
      availableClasses,
      selectedClassIds,
      scopeCustomized,
      scopeInvalidated: Boolean(scopeSnapshot.exists && !scopeCustomized),
      assignments: relevant,
      assignedGrades: [...grades],
      recoveredLegacy: selectedLegacyRows.length,
      preservedHiddenLegacy: Math.max(0, legacyRows.length - selectedLegacyRows.length),
      centralAdded: Math.max(0, students.length - selectedLegacyRows.length),
      repairPending: repairs.length,
      centralReadCount: centralStudentSnapshot.docs.length,
      classReadCount: centralClassSnapshot.docs.length,
      preservedTeacherData: true,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("teacher central roster failed", error);
    return NextResponse.json({ ok: false, message: "تعذر تحميل قائمة الطلاب" }, { status: 500 });
  }
}
