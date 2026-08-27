import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { findUserById, requireSession } from "../../../../lib/server/portal-auth";
import { normalizeAssignments, type TeacherAssignment } from "../../../../lib/teacher-assignments";
import {
  SCHOOL_CLASSES_COLLECTION,
  SCHOOL_STUDENTS_COLLECTION,
  canonicalClassName,
  classId,
  classMatchesAssignments,
  gradeNumber,
  normalizeArabic,
  normalizeClassRecord,
  normalizeStudentRecord,
  sectionNumber,
  studentIdentity,
  studentMatchesAssignments,
  type SchoolClass,
  type SchoolStudent,
} from "../../../../lib/school-roster";

type Repair = { path: string; data: Record<string, unknown> };
type Grade = 1 | 2 | 3;
type ScopeMap = Map<Grade, Set<string> | null>;

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

function allSections(value: unknown) {
  const normalized = normalizeArabic(value);
  return !normalized
    || normalized === "الكل"
    || normalized === "كل"
    || normalized === "جميع الفصول";
}

function addScope(scopes: ScopeMap, grade: Grade, section: string | null) {
  const current = scopes.get(grade);
  if (current === null) return;
  if (section === null) {
    scopes.set(grade, null);
    return;
  }
  const sections = current || new Set<string>();
  sections.add(section);
  scopes.set(grade, sections);
}

function scopesFromAssignments(assignments: TeacherAssignment[]) {
  const scopes: ScopeMap = new Map();
  assignments.forEach(assignment => {
    const grade = gradeNumber(assignment.grade);
    if (!grade) return;
    if (allSections(assignment.section)) {
      addScope(scopes, grade, null);
      return;
    }
    const section = sectionNumber(assignment.section);
    if (section) addScope(scopes, grade, section);
  });
  return scopes;
}

function scopesFromStudents(students: SchoolStudent[]) {
  const scopes: ScopeMap = new Map();
  students.forEach(student => addScope(scopes, student.grade as Grade, student.section));
  return scopes;
}

async function loadScopedStudentDocuments(scopes: ScopeMap) {
  const collection = adminDb().collection(SCHOOL_STUDENTS_COLLECTION);
  const queries: Promise<any>[] = [];

  scopes.forEach((sections, grade) => {
    if (sections === null) {
      queries.push(collection.where("grade", "==", grade).get());
      return;
    }
    sections.forEach(section => {
      queries.push(collection.where("className", "==", canonicalClassName(grade, section)).get());
    });
  });

  const snapshots = await Promise.all(queries);
  const documents = new Map<string, any>();
  snapshots.forEach(snapshot => snapshot.docs.forEach((item: any) => documents.set(item.id, item)));
  return [...documents.values()];
}

async function loadScopedClassDocuments(scopes: ScopeMap) {
  const collection = adminDb().collection(SCHOOL_CLASSES_COLLECTION);
  const queryTasks: Promise<any>[] = [];
  const documentTasks: Promise<any>[] = [];

  scopes.forEach((sections, grade) => {
    if (sections === null) {
      queryTasks.push(collection.where("grade", "==", grade).get());
      return;
    }
    sections.forEach(section => {
      documentTasks.push(collection.doc(classId(grade, section)).get());
    });
  });

  const [snapshots, exactDocuments] = await Promise.all([
    Promise.all(queryTasks),
    Promise.all(documentTasks),
  ]);

  const documents = new Map<string, any>();
  snapshots.forEach(snapshot => snapshot.docs.forEach((item: any) => documents.set(item.id, item)));
  exactDocuments.forEach(item => {
    if (item.exists) documents.set(item.id, item);
  });
  return [...documents.values()];
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
    if (!subjectId || !relevant.length) {
      return NextResponse.json({ ok: true, students: [], classes: [], assignments: [] });
    }

    const detailedAssignments = relevant.filter(item => !!gradeNumber(item.grade));
    const hasDetailedAssignments = detailedAssignments.length > 0;
    const subjectPath = `portalV2Data/${session.userId}/subjects/${subjectId}/students`;

    const legacySnapshot = await adminDb().collection(subjectPath).get();
    const legacyRows = legacySnapshot.docs
      .map(item => ({ id: item.id, raw: item.data() as Record<string, unknown> }))
      .map(item => ({ ...item, student: normalizeLegacy(item.raw, item.id) }))
      .filter((item): item is { id: string; raw: Record<string, unknown>; student: SchoolStudent } => !!item.student)
      .filter(item => !hasDetailedAssignments || studentMatchesAssignments(item.student, assignments, subjectId));

    const scopes = hasDetailedAssignments
      ? scopesFromAssignments(detailedAssignments)
      : scopesFromStudents(legacyRows.map(item => item.student));

    const [centralDocuments, classDocuments] = await Promise.all([
      loadScopedStudentDocuments(scopes),
      loadScopedClassDocuments(scopes),
    ]);

    const legacyClassKeys = new Set(legacyRows.map(item => classId(item.student.grade, item.student.section)));
    const centralRows = centralDocuments
      .map(item => normalizeStudentRecord(item.data() as Record<string, unknown>, item.id))
      .filter((item): item is SchoolStudent => !!item && item.active !== false)
      .filter(item => hasDetailedAssignments
        ? studentMatchesAssignments(item, assignments, subjectId)
        : legacyClassKeys.has(classId(item.grade, item.section)));

    const byIdentity = new Map<string, SchoolStudent>();
    legacyRows.forEach(item => byIdentity.set(studentIdentity(item.student), { ...item.student, active: true }));
    centralRows.forEach(item => {
      const identity = studentIdentity(item);
      if (!byIdentity.has(identity)) byIdentity.set(identity, { ...item, active: true });
    });

    const students = [...byIdentity.values()]
      .map(item => ({ ...item, className: canonicalClassName(item.grade, item.section), active: true }))
      .sort((a, b) => a.className.localeCompare(b.className, "ar", { numeric: true }) || a.name.localeCompare(b.name, "ar"));

    const repairs: Repair[] = [];
    const existingIds = new Set(legacySnapshot.docs.map(item => item.id));
    const legacyIdentities = new Set(legacyRows.map(item => studentIdentity(item.student)));

    legacyRows.forEach(item => {
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
            updatedAt: new Date().toISOString(),
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
          updatedAt: new Date().toISOString(),
        },
      });
    });

    try {
      if (repairs.length) await applyRepairs(repairs);
    } catch (repairError) {
      console.warn("teacher roster repair deferred", repairError);
    }

    const classMap = new Map<string, SchoolClass>();
    classDocuments.forEach(item => {
      const data = item.data();
      if (!data) return;
      const schoolClass = normalizeClassRecord({ id: item.id, ...data } as Partial<SchoolClass>);
      if (!schoolClass || schoolClass.active === false) return;
      if (hasDetailedAssignments && !classMatchesAssignments(schoolClass, assignments, subjectId)) return;
      if (!hasDetailedAssignments && !legacyClassKeys.has(schoolClass.id)) return;
      classMap.set(schoolClass.id, schoolClass);
    });

    students.forEach(student => {
      const id = classId(student.grade, student.section);
      if (!classMap.has(id)) {
        classMap.set(id, {
          id,
          grade: student.grade,
          section: student.section,
          name: student.className,
          active: true,
        });
      }
    });

    const classes = [...classMap.values()].sort((a, b) => a.grade - b.grade || Number(a.section) - Number(b.section));
    return NextResponse.json({
      ok: true,
      students,
      classes,
      assignments: relevant,
      recoveredLegacy: legacyRows.length,
      centralAdded: Math.max(0, students.length - legacyRows.length),
      repairPending: repairs.length,
      centralReadCount: centralDocuments.length,
      classReadCount: classDocuments.length,
    }, { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" } });
  } catch (error) {
    console.error("teacher central roster failed", error);
    return NextResponse.json({ ok: false, message: "تعذر تحميل قائمة الطلاب" }, { status: 500 });
  }
}
