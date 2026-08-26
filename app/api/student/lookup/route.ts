import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { getSubjectConfig } from "../../../../lib/subject-config";
import { createStudentAccessToken } from "../../../../lib/server/portal-auth";
import { normalizeAssignments } from "../../../../lib/teacher-assignments";

type SubjectAssignment = { id: string; label?: string };

const STUDENT_CODE_PATTERN = /^TH[123]\d{3}$/;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const accessCode = String(body?.accessCode || "").trim().toUpperCase();
    if (!STUDENT_CODE_PATTERN.test(accessCode)) {
      return NextResponse.json({ ok: false, message: "كود الطالب غير صحيح. استخدم صيغة مثل TH1001 أو TH2001 أو TH3001." }, { status: 400 });
    }

    const teachers = await adminDb().collection("portalV2Users").where("role", "==", "teacher").get();
    const searches = teachers.docs.flatMap(teacher => {
      const teacherData = teacher.data();
      if (teacherData.active !== true) return [];
      const assignments = normalizeAssignments(teacherData.assignments, teacherData.subjectIds) as SubjectAssignment[];
      const normalized: SubjectAssignment[] = assignments.length
        ? assignments
        : (Array.isArray(teacherData.subjectIds) ? teacherData.subjectIds : []).map((id: string) => ({ id, label: getSubjectConfig(id).label }));
      const unique = new Map<string, SubjectAssignment>();
      normalized.forEach((item: SubjectAssignment) => { if (item.id) unique.set(item.id, item); });
      return [...unique.values()].map((item: SubjectAssignment) => ({
        teacherId: teacher.id,
        teacherName: teacherData.name || "المعلم",
        subjectId: item.id,
        subjectLabel: item.label || getSubjectConfig(item.id).label,
      }));
    });

    const matches = await Promise.all(searches.map(async ({ teacherId, teacherName, subjectId, subjectLabel }) => {
      const collection = adminDb().collection(`portalV2Data/${teacherId}/subjects/${subjectId}/students`);
      let students = await collection.where("accessCode", "==", accessCode).limit(1).get();
      if (students.empty) students = await collection.where("studentCode", "==", accessCode).limit(1).get();
      if (students.empty) return null;

      const document = students.docs[0]!;
      const data = document.data();
      const storedCode = String(data.accessCode || data.studentCode || "").trim().toUpperCase();
      if (storedCode !== accessCode) return null;

      const subject = getSubjectConfig(subjectId);
      const accessToken = createStudentAccessToken({ studentId: document.id, teacherId, subjectId, expiresAt: Date.now() + 2 * 60 * 60 * 1000 });
      return { id: document.id, teacherId, subjectKey: subjectId, subjectLabel, teacherName, icon: subject.icon || "📘", accessToken, data };
    }));

    const valid = matches.filter(Boolean);
    if (!valid.length) return NextResponse.json({ ok: false, message: "كود الطالب غير صحيح، أو لم تُربط له مادة بعد." }, { status: 401 });
    return NextResponse.json({ ok: true, matches: valid });
  } catch (error) {
    console.error("student lookup failed", error);
    return NextResponse.json({ ok: false, message: "تعذر الوصول إلى بيانات الطالب الآن" }, { status: 500 });
  }
}
