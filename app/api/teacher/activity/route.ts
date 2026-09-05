import { NextResponse } from "next/server";
import { requireSession } from "../../../../lib/server/portal-auth";
import { recordTeacherWork, TEACHER_WORK_WEIGHTS, type TeacherWorkKind } from "../../../../lib/server/teacher-work-activity";

export async function POST(request: Request) {
  const session = await requireSession("teacher");
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const kind = String(body?.kind || "") as TeacherWorkKind;
    if (!(kind in TEACHER_WORK_WEIGHTS)) {
      return NextResponse.json({ ok: false, message: "نوع النشاط غير معتمد." }, { status: 400 });
    }
    const result = await recordTeacherWork({
      teacherId: session.userId,
      teacherName: session.name || session.user?.name || "المعلم",
      kind,
      signature: String(body?.signature || ""),
      meta: body?.meta && typeof body.meta === "object" ? body.meta : {},
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("teacher activity record failed", error);
    return NextResponse.json({ ok: false, message: "تعذر تسجيل النشاط الآن." }, { status: 500 });
  }
}
