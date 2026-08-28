import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { getSubjectConfig } from "../../../../lib/subject-config";
import { createStudentAccessToken } from "../../../../lib/server/portal-auth";
import { normalizeAssignments } from "../../../../lib/teacher-assignments";
import { canonicalClassName, gradeNumber, normalizeStudentRecord } from "../../../../lib/school-roster";

type SubjectAssignment = { subjectId: string; grade?: string; section?: string; label?: string };
type LocatedStudent = {
  studentId: string;
  teacherId: string;
  subjectId: string;
  data: Record<string, unknown>;
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

    const teachers = new Map<string, Record<string, unknown>>();
    teachersSnapshot.docs.forEach(document => {
      const data = document.data() as Record<string, unknown>;
      if (data.active === true) teachers.set(document.id, data);
    });

    const located = new Map<string, LocatedStudent>();
    existingStudents.forEach(item => located.set(`${item.teacherId}:${item.subjectId}`, item));

    const repairWrites: Array<{ path: string; data: Record<string, unknown> }> = [];
    if (centralStudent) {
      teachers.forEach((teacherData, teacherId) => {
        const assignments = normalizeAssignments(teacherData.assignments, teacherData.subjectIds) as SubjectAssignment[];
        const studentGrade = centralStudent.grade;
        const subjects = new Map<string, SubjectAssignment>();

        assignments.forEach(assignment => {
          if (!assignment.subjectId || gradeNumber(assignment.grade) !== studentGrade) return;
          if (!subjects.has(assignment.subjectId)) subjects.set(assignment.subjectId, assignment);
        });

        subjects.forEach((assignment, subjectId) => {
          const key = `${teacherId}:${subjectId}`;
          if (!located.has(key)) {
            const data = {
              ...centralStudent,
              id: accessCode,
              code: accessCode,
              accessCode,
              studentCode: accessCode,
              class: canonicalClassName(centralStudent.grade, centralStudent.section),
              className: canonicalClassName(centralStudent.grade, centralStudent.section),
              teacherId,
              subjectKey: subjectId,
              active: true,
              rosterActive: true,
            } as Record<string, unknown>;
            located.set(key, { studentId: accessCode, teacherId, subjectId, data });
            repairWrites.push({
              path: `portalV2Data/${teacherId}/subjects/${subjectId}/students/${accessCode}`,
              data: { ...data, linkedFromCentralRoster: true, updatedAt: new Date().toISOString() },
            });
          }
        });
      });
    }

    if (!located.size) {
      return NextResponse.json({ ok: false, message: "كود الطالب غير صحيح، أو لم تُربط له مادة بعد." }, { status: 401 });
    }

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

    const matches = [...located.values()].flatMap(item => {
      const teacherData = teachers.get(item.teacherId);
      if (!teacherData) return [];

      const assignments = normalizeAssignments(teacherData.assignments, teacherData.subjectIds) as SubjectAssignment[];
      const assignment = assignments.find(entry => entry.subjectId === item.subjectId);
      const subject = getSubjectConfig(item.subjectId);
      const accessToken = createStudentAccessToken({
        studentId: item.studentId,
        teacherId: item.teacherId,
        subjectId: item.subjectId,
        expiresAt: Date.now() + 2 * 60 * 60 * 1000,
      });

      return [{
        id: item.studentId,
        teacherId: item.teacherId,
        subjectKey: item.subjectId,
        subjectLabel: assignment?.label || subject.label,
        teacherName: String(teacherData.name || "المعلم"),
        icon: subject.icon || "📘",
        accessToken,
        data: item.data,
      }];
    });

    if (!matches.length) {
      return NextResponse.json({ ok: false, message: "المواد المرتبطة بهذا الكود غير متاحة حاليًا." }, { status: 401 });
    }

    return NextResponse.json({
      ok: true,
      matches,
      linkedFromCentralRoster: repairWrites.length,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("student lookup failed", error);
    if (isQuotaError(error)) {
      return NextResponse.json({ ok: false, message: "قاعدة البيانات مشغولة مؤقتًا. حاول مرة أخرى بعد تجدد الحصة المجانية." }, { status: 429 });
    }
    return NextResponse.json({ ok: false, message: "تعذر الوصول إلى بيانات الطالب الآن" }, { status: 500 });
  }
}
