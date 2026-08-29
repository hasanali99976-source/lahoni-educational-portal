import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { getSubjectConfig } from "../../../../lib/subject-config";
import { createStudentAccessToken } from "../../../../lib/server/portal-auth";
import { normalizeAssignments, type TeacherAssignment } from "../../../../lib/teacher-assignments";
import { canonicalClassName, classId, gradeNumber, normalizeArabic, normalizeStudentRecord, type SchoolStudent } from "../../../../lib/school-roster";
import {
  SUBJECT_CLASS_OWNERS_COLLECTION,
  TEACHER_CLASS_SCOPES_COLLECTION,
  assignmentAllowsClassExact,
  normalizeClassIds,
  subjectClassOwnerId,
  teacherClassScopeId,
} from "../../../../lib/teacher-class-scope";

type LocatedStudent = {
  studentId: string;
  teacherId: string;
  subjectId: string;
  data: Record<string, unknown>;
};
type Candidate = {
  teacherId: string;
  subjectId: string;
  teacherData: Record<string, unknown>;
  assignments: TeacherAssignment[];
  existing?: LocatedStudent;
  priority: number;
  matchedClass: boolean;
};

const STUDENT_CODE_PATTERN = /^TH[123]\d{3}$/;
const MAX_SUBJECT_MATCHES = 30;

function isQuotaError(error: unknown) {
  const source = error as { code?: unknown; message?: unknown };
  const text = `${String(source?.code || "")} ${String(source?.message || "")}`.toLowerCase();
  return text.includes("resource-exhausted") || text.includes("quota exceeded");
}

function parseStudentPath(path: string, data: Record<string, unknown>): LocatedStudent | null {
  const parts = path.split("/");
  if (parts.length !== 6 || parts[0] !== "portalV2Data" || parts[2] !== "subjects" || parts[4] !== "students") return null;
  const [, teacherId, , subjectId, , studentId] = parts;
  if (!teacherId || !subjectId || !studentId) return null;
  return { teacherId, subjectId, studentId, data };
}

async function findExistingStudentDocuments(accessCode: string) {
  try {
    const db = adminDb();
    let snapshot = await db.collectionGroup("students")
      .where("accessCode", "==", accessCode)
      .limit(MAX_SUBJECT_MATCHES)
      .get();

    if (snapshot.empty) {
      snapshot = await db.collectionGroup("students")
        .where("studentCode", "==", accessCode)
        .limit(MAX_SUBJECT_MATCHES)
        .get();
    }

    const unique = new Map<string, LocatedStudent>();
    snapshot.docs.forEach(document => {
      const located = parseStudentPath(document.ref.path, document.data() as Record<string, unknown>);
      if (!located) return;
      const storedCode = String(located.data.accessCode || located.data.studentCode || located.data.code || "").trim().toUpperCase();
      if (storedCode !== accessCode) return;
      const key = `${located.teacherId}:${located.subjectId}`;
      if (!unique.has(key)) unique.set(key, located);
    });
    return [...unique.values()];
  } catch (error) {
    const text = String((error as { message?: unknown })?.message || error).toLowerCase();
    if (text.includes("index") || text.includes("failed-precondition")) {
      console.warn("student collection-group lookup skipped; using central roster", error);
      return [];
    }
    throw error;
  }
}

async function loadCentralStudent(accessCode: string) {
  const snapshot = await adminDb().collection("portalV2Students").doc(accessCode).get();
  if (!snapshot.exists) return null;
  const normalized = normalizeStudentRecord(snapshot.data() as Record<string, unknown>, snapshot.id);
  return normalized && normalized.active !== false ? normalized : null;
}

function allSections(value: unknown) {
  const normalized = normalizeArabic(value);
  return !normalized || normalized === "الكل" || normalized === "كل" || normalized === "جميع الفصول";
}

function candidatePriority(assignments: TeacherAssignment[], student: SchoolStudent, customized: boolean, hasExisting: boolean) {
  const exactSection = assignments.some(item => assignmentAllowsClassExact(item, student.grade, student.section) && !allSections(item.section));
  return (customized ? 80 : exactSection ? 60 : 40) + (hasExisting ? 5 : 0);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const accessCode = String(body?.accessCode || "").trim().toUpperCase();
    if (!STUDENT_CODE_PATTERN.test(accessCode)) {
      return NextResponse.json({ ok: false, message: "كود الطالب غير صحيح. استخدم صيغة مثل TH1001 أو TH2001 أو TH3001." }, { status: 400 });
    }

    const [existingStudents, centralStudent, teachersSnapshot] = await Promise.all([
      findExistingStudentDocuments(accessCode),
      loadCentralStudent(accessCode),
      adminDb().collection("portalV2Users").where("role", "==", "teacher").get(),
    ]);

    const existingByTeacherSubject = new Map(existingStudents.map(item => [`${item.teacherId}:${item.subjectId}`, item]));
    const fallbackStudent = existingStudents
      .map(item => normalizeStudentRecord(item.data, item.studentId))
      .find((item): item is SchoolStudent => !!item);
    const student = centralStudent || fallbackStudent;
    if (!student) {
      return NextResponse.json({ ok: false, message: "كود الطالب غير صحيح، أو لم تُربط له مادة بعد." }, { status: 401 });
    }

    const studentClassId = classId(student.grade, student.section);
    const teacherEntries = teachersSnapshot.docs.flatMap(document => {
      const data = document.data() as Record<string, unknown>;
      if (data.active !== true) return [];
      const assignments = normalizeAssignments(data.assignments, data.subjectIds)
        .filter(item => gradeNumber(item.grade) === student.grade);
      if (!assignments.length) return [];
      return [{ teacherId: document.id, teacherData: data, assignments }];
    });

    const scopeRequests = new Map<string, Promise<any>>();
    teacherEntries.forEach(entry => {
      [...new Set(entry.assignments.map(item => item.subjectId))].forEach(subjectId => {
        const key = `${entry.teacherId}:${subjectId}`;
        scopeRequests.set(key, adminDb().collection(TEACHER_CLASS_SCOPES_COLLECTION).doc(teacherClassScopeId(entry.teacherId, subjectId, student.grade)).get());
      });
    });
    const scopeResults = await Promise.all([...scopeRequests.entries()].map(async ([key, promise]) => [key, await promise] as const));
    const scopes = new Map(scopeResults);

    const subjectIds = [...new Set(teacherEntries.flatMap(entry => entry.assignments.map(item => item.subjectId)))];
    const ownerResults = await Promise.all(subjectIds.map(async subjectId => {
      const snapshot = await adminDb().collection(SUBJECT_CLASS_OWNERS_COLLECTION).doc(subjectClassOwnerId(subjectId, studentClassId)).get();
      return [subjectId, snapshot] as const;
    }));
    const owners = new Map(ownerResults);

    const candidates: Candidate[] = [];
    teacherEntries.forEach(entry => {
      const grouped = new Map<string, TeacherAssignment[]>();
      entry.assignments.forEach(assignment => {
        const list = grouped.get(assignment.subjectId) || [];
        list.push(assignment);
        grouped.set(assignment.subjectId, list);
      });

      grouped.forEach((assignments, subjectId) => {
        const ownerSnapshot = owners.get(subjectId);
        const ownerTeacherId = ownerSnapshot?.exists ? String(ownerSnapshot.data()?.teacherId || "") : "";
        if (ownerTeacherId && ownerTeacherId !== entry.teacherId) return;

        const scopeSnapshot = scopes.get(`${entry.teacherId}:${subjectId}`);
        const customized = scopeSnapshot?.exists && scopeSnapshot.data()?.customized === true;
        const selectedClassIds = customized ? normalizeClassIds(scopeSnapshot.data()?.selectedClassIds) : [];
        const matchedClass = ownerTeacherId === entry.teacherId
          || (customized ? selectedClassIds.includes(studentClassId) : assignments.some(item => assignmentAllowsClassExact(item, student.grade, student.section)));

        const existing = existingByTeacherSubject.get(`${entry.teacherId}:${subjectId}`);
        candidates.push({
          teacherId: entry.teacherId,
          subjectId,
          teacherData: entry.teacherData,
          assignments,
          existing,
          matchedClass,
          priority: ownerTeacherId === entry.teacherId
            ? 100
            : matchedClass
              ? candidatePriority(assignments, student, customized, !!existing)
              : 10 + (existing ? 5 : 0),
        });
      });
    });

    const chosenBySubject = new Map<string, Candidate>();
    candidates
      .sort((a, b) => b.priority - a.priority || a.teacherId.localeCompare(b.teacherId))
      .forEach(candidate => {
        if (!chosenBySubject.has(candidate.subjectId)) chosenBySubject.set(candidate.subjectId, candidate);
      });

    if (!chosenBySubject.size) {
      return NextResponse.json({ ok: false, message: "لم تُربط مواد هذا الصف بالمعلمين بعد." }, { status: 401 });
    }

    const repairWrites: Array<{ path: string; data: Record<string, unknown> }> = [];
    const located = [...chosenBySubject.values()].map(candidate => {
      if (candidate.existing) return candidate.existing;
      const data = {
        ...student,
        id: accessCode,
        code: accessCode,
        accessCode,
        studentCode: accessCode,
        class: canonicalClassName(student.grade, student.section),
        className: canonicalClassName(student.grade, student.section),
        teacherId: candidate.teacherId,
        subjectKey: candidate.subjectId,
        active: true,
        rosterActive: true,
      } as Record<string, unknown>;
      repairWrites.push({
        path: `portalV2Data/${candidate.teacherId}/subjects/${candidate.subjectId}/students/${accessCode}`,
        data: {
          ...data,
          linkedFromCentralRoster: true,
          linkedByGradeFallback: !candidate.matchedClass,
          updatedAt: new Date().toISOString(),
        },
      });
      return { studentId: accessCode, teacherId: candidate.teacherId, subjectId: candidate.subjectId, data };
    });

    if (repairWrites.length) {
      try {
        for (let index = 0; index < repairWrites.length; index += 350) {
          const batch = adminDb().batch();
          repairWrites.slice(index, index + 350).forEach(item => {
            const separator = item.path.lastIndexOf("/");
            const reference = adminDb().collection(item.path.slice(0, separator)).doc(item.path.slice(separator + 1));
            batch.set(reference, item.data, { merge: true });
          });
          await batch.commit();
        }
      } catch (repairError) {
        console.warn("student subject links deferred", repairError);
      }
    }

    const matches = located.map(item => {
      const candidate = chosenBySubject.get(item.subjectId)!;
      const subject = getSubjectConfig(item.subjectId);
      const accessToken = createStudentAccessToken({
        studentId: item.studentId,
        teacherId: item.teacherId,
        subjectId: item.subjectId,
        expiresAt: Date.now() + 2 * 60 * 60 * 1000,
      });

      return {
        id: item.studentId,
        teacherId: item.teacherId,
        subjectKey: item.subjectId,
        subjectLabel: subject.label,
        teacherName: String(candidate.teacherData.name || "المعلم"),
        icon: subject.icon || "📘",
        accessToken,
        data: item.data,
      };
    }).sort((a, b) => a.subjectLabel.localeCompare(b.subjectLabel, "ar", { numeric: true }));

    return NextResponse.json({
      ok: true,
      matches,
      linkedFromCentralRoster: repairWrites.length,
      linkedByGradeFallback: [...chosenBySubject.values()].filter(item => !item.matchedClass).length,
      uniqueTeacherPerSubject: true,
      grade: student.grade,
      classId: studentClassId,
      subjectCount: matches.length,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("student lookup failed", error);
    if (isQuotaError(error)) {
      return NextResponse.json({ ok: false, message: "قاعدة البيانات مشغولة مؤقتًا. حاول مرة أخرى بعد تجدد الحصة المجانية." }, { status: 429 });
    }
    return NextResponse.json({ ok: false, message: "تعذر الوصول إلى بيانات الطالب الآن" }, { status: 500 });
  }
}