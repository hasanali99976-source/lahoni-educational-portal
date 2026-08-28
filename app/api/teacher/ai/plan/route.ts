import { NextResponse } from "next/server";
import { adminDb } from "../../../../../lib/server/firebase-admin";
import { findUserById, requireSession } from "../../../../../lib/server/portal-auth";

export const dynamic = "force-dynamic";

function cleanText(value: unknown, maximum = 300) {
  return String(value || "").trim().slice(0, maximum);
}

export async function POST(request: Request) {
  const session = await requireSession("teacher");
  if (!session) return NextResponse.json({ ok: false, message: "انتهت جلسة المعلم" }, { status: 401 });

  try {
    const user = await findUserById(session.userId);
    if (!user?.active) return NextResponse.json({ ok: false, message: "حساب المعلم غير مفعل" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const subjectId = cleanText(body?.subjectId, 80).split("--")[0];
    if (!subjectId || !user.subjectIds.includes(subjectId)) {
      return NextResponse.json({ ok: false, message: "المادة غير مرتبطة بحساب المعلم" }, { status: 403 });
    }

    const students = Array.isArray(body?.students)
      ? body.students.slice(0, 500).map((student: Record<string, unknown>) => ({
          id: cleanText(student.id, 100),
          name: cleanText(student.name, 160),
          className: cleanText(student.className, 120),
          percentage: Math.max(0, Math.min(100, Number(student.percentage || 0))),
          weakest: cleanText(student.weakest, 160),
        })).filter((student: { id: string; name: string }) => student.id && student.name)
      : [];

    if (!students.length) {
      return NextResponse.json({ ok: false, message: "لا يوجد طلاب في الخطة الحالية" }, { status: 400 });
    }

    const objectives = Array.isArray(body?.objectives)
      ? body.objectives.slice(0, 12).map((item: unknown) => cleanText(item, 240)).filter(Boolean)
      : [];
    const createdAt = new Date().toISOString();
    const id = crypto.randomUUID();
    const path = `portalV2Data/${session.userId}/subjects/${subjectId}/treatmentPlans`;

    await adminDb().collection(path).doc(id).set({
      id,
      title: cleanText(body?.title, 180) || `الخطة العلاجية لمادة ${cleanText(body?.subject, 120)}`,
      teacherId: session.userId,
      teacherName: user.name,
      subject: cleanText(body?.subject, 120),
      subjectKey: subjectId,
      duration: cleanText(body?.duration, 60),
      threshold: body?.threshold == null ? null : Math.max(0, Math.min(100, Number(body.threshold))),
      scope: cleanText(body?.scope, 30),
      className: cleanText(body?.className, 120),
      students,
      objectives,
      createdAt,
      updatedAt: createdAt,
      source: "teacher-ai-server",
    });

    return NextResponse.json({ ok: true, id, createdAt }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("teacher AI plan save failed", error);
    return NextResponse.json({ ok: false, message: "تعذر حفظ الخطة الآن" }, { status: 500 });
  }
}
