import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { findUserById, requireSession } from "../../../../lib/server/portal-auth";
import { normalizeAssignments } from "../../../../lib/teacher-assignments";
import {
  SCHOOL_CLASSES_COLLECTION,
  SCHOOL_STUDENTS_COLLECTION,
  canonicalClassName,
  classId,
  classMatchesAssignments,
  gradeNumber,
  normalizeClassRecord,
  normalizeStudentRecord,
  studentIdentity,
  studentMatchesAssignments,
  type SchoolClass,
  type SchoolStudent,
} from "../../../../lib/school-roster";

type Repair = { path: string; data: Record<string, unknown> };

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

async function applyRepairs(repairs: Repair[]) {
  for (let index = 0; index < repairs.length; index += 350) {
    const batch = adminDb().batch();
    repairs.slice(index, index + 350).forEach(item => {
      batch.set(adminDb().doc(item.path), item.data, { merge: true });
    });
    await batch.commit();
  }
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

    const [centralSnapshot, legacySnapshot, classesSnapshot] = await Promise.all([
      adminDb().collection(SCHOOL_STUDENTS_COLLECTION).get(),
      adminDb().collection(subjectPath).get(),
      adminDb().collection(SCHOOL_CLASSES_COLLECTION).get(),
    ]);

    const legacyRows = legacySnapshot.docs
      .map(item => ({ id: item.id, raw: item.data() as Record<string, unknown> }))
      .map(item => ({ ...item, student: normalizeLegacy(item.raw, item.id) }))
      .filter((item): item is { id: string; raw: Record<string, unknown>; student: SchoolStudent } => !!item.student)
      .filter(item => !hasDetailedAssignments || studentMatchesAssignments(item.student, assignments, subjectId));

    const legacyClassKeys = new Set(legacyRows.map(item => classId(item.student.grade, item.student.section)));
    const centralRows = centralSnapshot.docs
      .map(item => normalizeStudentRecord(item.data() as Record<string, unknown>, item.id))
      .filter((item): item is SchoolStudent => !!item && item.active !== false)
      .filter(item => hasDetailedAssignments
        ? studentMatchesAssignments(item, assignments, subjectId)
        : legacyClassKeys.has(classId(item.grade, item.section)));

    // Preserve each teacher's existing document/code first so grades, attendance and
    // historical records stay attached to the same student. Central rows only fill gaps.
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

    // A failed mirror must never hide the roster returned to the teacher.
    try {
      if (repairs.length) await applyRepairs(repairs);
    } catch (repairError) {
      console.warn("teacher roster repair deferred", repairError);
    }

    const classMap = new Map<string, SchoolClass>();
    classesSnapshot.docs.forEach(item => {
      const schoolClass = normalizeClassRecord({ id: item.id, ...(item.data() as Record<string, unknown>) } as Partial<SchoolClass>);
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
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("teacher central roster failed", error);
    return NextResponse.json({ ok: false, message: "تعذر تحميل قائمة الطلاب" }, { status: 500 });
  }
}
