import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { requireSession } from "../../../../lib/server/portal-auth";
import { normalizeAssignments } from "../../../../lib/teacher-assignments";
import { isSubjectKey } from "../../../../lib/subject-config";

const ATTENDANCE_START_DATE = "2026-08-23";

const readDisciplineAttendance = unstable_cache(
  async (teacherId: string, subjectId: string) => {
    const snapshot = await adminDb()
      .collection(`portalV2Data/${teacherId}/subjects/${subjectId}/attendance`)
      .where("date", ">=", ATTENDANCE_START_DATE)
      .get();

    return snapshot.docs.map(document => ({
      id: document.id,
      ...(document.data() as Record<string, unknown>),
    }));
  },
  ["teacher-discipline-attendance-v1"],
  { revalidate: 120 },
);

export async function GET(request: Request) {
  const session = await requireSession("teacher");
  if (!session?.user) {
    return NextResponse.json({ ok: false, message: "انتهت جلسة المعلم." }, { status: 401 });
  }

  const url = new URL(request.url);
  const subjectId = String(url.searchParams.get("subjectId") || "").split("--")[0];
  if (!isSubjectKey(subjectId)) {
    return NextResponse.json({ ok: false, message: "المادة غير صحيحة." }, { status: 400 });
  }

  const assignments = normalizeAssignments(session.user.assignments, session.user.subjectIds);
  if (!assignments.some(item => item.subjectId === subjectId)) {
    return NextResponse.json({ ok: false, message: "المادة غير مسندة إلى الحساب." }, { status: 403 });
  }

  try {
    const attendance = await readDisciplineAttendance(session.userId, subjectId);
    return NextResponse.json(
      { ok: true, attendance },
      { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false, attendance: [], message: "تعذر تحميل بيانات الانضباط الآن." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
