import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { getSubjectConfig } from "../../../../lib/subject-config";
import { createStudentAccessToken } from "../../../../lib/server/portal-auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const nationalId = String(body?.nationalId || "").replace(/\D/g, "");
    const accessCode = String(body?.accessCode || "").trim().toUpperCase();
    if (!/^\d{10}$/.test(nationalId) || accessCode.length < 4) return NextResponse.json({ ok: false, message: "بيانات الدخول غير مكتملة" }, { status: 400 });

    const assignments = await adminDb().collection("portalV2Assignments").where("active", "==", true).get();
    const matches = await Promise.all(assignments.docs.slice(0, 100).map(async (assignment) => {
      const { teacherId, subjectId } = assignment.data() as { teacherId: string; subjectId: string };
      const teacher = await adminDb().collection("portalV2Users").doc(teacherId).get();
      if (!teacher.exists || teacher.data()?.active !== true) return null;
      const students = await adminDb().collection(`portalV2Data/${teacherId}/subjects/${subjectId}/students`).where("nationalId", "==", nationalId).limit(1).get();
      if (students.empty) return null;
      const document = students.docs[0]!;
      const data = document.data();
      const expectedCode = `TH${nationalId.slice(-4)}`;
      if (expectedCode !== accessCode) return null;
      const subject = getSubjectConfig(subjectId);
      const accessToken = createStudentAccessToken({ studentId: document.id, teacherId, subjectId, expiresAt: Date.now() + 2 * 60 * 60 * 1000 });
      return { id: document.id, teacherId, subjectKey: subjectId, subjectLabel: subject.label, teacherName: teacher.data()?.name || "المعلم", icon: subject.icon || "📘", accessToken, data };
    }));
    const valid = matches.filter(Boolean);
    if (!valid.length) return NextResponse.json({ ok: false, message: "رقم الهوية أو كود الدخول غير صحيح، أو لم تُربط لك مادة بعد." }, { status: 401 });
    return NextResponse.json({ ok: true, matches: valid });
  } catch (error) {
    console.error("student lookup failed", error);
    return NextResponse.json({ ok: false, message: "تعذر الوصول إلى بيانات الطالب الآن" }, { status: 500 });
  }
}
