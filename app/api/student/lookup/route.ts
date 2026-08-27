import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { getSubjectConfig } from "../../../../lib/subject-config";
import { createStudentAccessToken } from "../../../../lib/server/portal-auth";
import { normalizeAssignments } from "../../../../lib/teacher-assignments";

type SubjectAssignment = { id: string; label?: string };
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

async function findStudentDocuments(accessCode: string) {
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
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const accessCode = String(body?.accessCode || "").trim().toUpperCase();
    if (!STUDENT_CODE_PATTERN.test(accessCode)) {
      return NextResponse.json({ ok: false, message: "كود الطالب غير صحيح. استخدم صيغة مثل TH1001 أو TH2001 أو TH3001." }, { status: 400 });
    }

    const locatedStudents = await findStudentDocuments(accessCode);
    if (!locatedStudents.length) {
      return NextResponse.json({ ok: false, message: "كود الطالب غير صحيح، أو لم تُربط له مادة بعد." }, { status: 401 });
    }

    const teacherIds = [...new Set(locatedStudents.map(item => item.teacherId))];
    const teacherEntries = await Promise.all(teacherIds.map(async teacherId => {
      const snapshot = await adminDb().collection("portalV2Users").doc(teacherId).get();
      return [teacherId, snapshot.exists ? snapshot.data() as Record<string, unknown> : null] as const;
    }));
    const teachers = new Map(teacherEntries);

    const matches = locatedStudents.flatMap(item => {
      const teacherData = teachers.get(item.teacherId);
      if (!teacherData || teacherData.active !== true || teacherData.role !== "teacher") return [];

      const assignments = normalizeAssignments(teacherData.assignments, teacherData.subjectIds) as SubjectAssignment[];
      const assignment = assignments.find(entry => entry.id === item.subjectId);
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

    return NextResponse.json({ ok: true, matches }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("student lookup failed", error);
    if (isQuotaError(error)) {
      return NextResponse.json({ ok: false, message: "قاعدة البيانات مشغولة مؤقتًا. حاول مرة أخرى بعد تجدد الحصة المجانية." }, { status: 429 });
    }
    return NextResponse.json({ ok: false, message: "تعذر الوصول إلى بيانات الطالب الآن" }, { status: 500 });
  }
}
