import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { readStudentAccessToken } from "../../../../lib/server/portal-auth";

export async function GET(request: Request) {
  const header = request.headers.get("authorization") || "";
  const access = readStudentAccessToken(header.startsWith("Bearer ") ? header.slice(7) : "");
  if (!access) return NextResponse.json({ ok: false, message: "انتهت جلسة الطالب." }, { status: 401 });
  const student = await adminDb().collection(`portalV2Data/${access.teacherId}/subjects/${access.subjectId}/students`).doc(access.studentId).get();
  if (!student.exists) return NextResponse.json({ ok: false, message: "لم يعد سجل الطالب متاحًا." }, { status: 404 });
  return NextResponse.json({ ok: true, data: student.data(), updatedAt: new Date().toISOString() });
}
