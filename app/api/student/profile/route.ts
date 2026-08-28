import { NextResponse } from "next/server";
import { officialClassName } from "../../../../lib/official-class";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { readStudentAccessToken } from "../../../../lib/server/portal-auth";

type AttendanceStatus = "present" | "absent" | "late" | "excused" | "escaped";

export async function GET(request: Request) {
  const header = request.headers.get("authorization") || "";
  const access = readStudentAccessToken(header.startsWith("Bearer ") ? header.slice(7) : "");
  if (!access) return NextResponse.json({ ok: false, message: "انتهت جلسة الطالب." }, { status: 401 });

  const root = `portalV2Data/${access.teacherId}/subjects/${access.subjectId}`;
  const student = await adminDb().collection(`${root}/students`).doc(access.studentId).get();
  if (!student.exists) return NextResponse.json({ ok: false, message: "لم يعد سجل الطالب متاحًا." }, { status: 404 });

  const studentData = student.data() || {};
  const className = officialClassName(studentData.class || studentData.className, studentData.section);
  const attendance = await adminDb().collection(`${root}/attendance`).get();
  const counts = { present: 0, absent: 0, late: 0, excused: 0, escaped: 0, total: 0 };
  let latestDate = "";

  for (const record of attendance.docs) {
    const data = record.data();
    const status = data?.records?.[access.studentId] as AttendanceStatus | undefined;
    if (!status || !(status in counts)) continue;
    counts[status] += 1;
    counts.total += 1;
    if (typeof data.date === "string" && data.date > latestDate) latestDate = data.date;
  }

  const disciplineRate = counts.total
    ? Math.max(0, Math.round(((counts.present + counts.excused + counts.late * 0.5) / counts.total) * 100))
    : 100;

  return NextResponse.json({
    ok: true,
    data: {
      ...studentData,
      class: className || "",
      className: className || "",
      absences: counts.absent,
      late: counts.late,
      attendanceSummary: { ...counts, disciplineRate, latestDate },
    },
    updatedAt: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}
