import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { requireSession } from "../../../../lib/server/portal-auth";
import { normalizeAssignments } from "../../../../lib/teacher-assignments";

const COUNSELOR_PHONE = "966598353651";

type ReferralType = "mastery" | "other";

function clean(value: unknown, max = 500) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function studentAliases(id: string, data: Record<string, unknown>) {
  return [...new Set([
    id,
    clean(data.code, 40),
    clean(data.accessCode, 40),
    clean(data.studentCode, 40),
  ].filter(Boolean))];
}

export async function POST(request: Request) {
  const session = await requireSession("teacher");
  if (!session || !session.user) return NextResponse.json({ ok: false, message: "انتهت جلسة المعلم." }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const subjectId = clean(body?.subjectId, 100).split("--")[0];
    const referralType: ReferralType = body?.referralType === "mastery" ? "mastery" : "other";
    const reason = clean(body?.reason, 800);
    const requestedCodes = Array.isArray(body?.studentCodes)
      ? [...new Set(body.studentCodes.map((item: unknown) => clean(item, 50)).filter(Boolean))].slice(0, 80)
      : [];

    if (!subjectId) return NextResponse.json({ ok: false, message: "اختر المادة أولًا." }, { status: 400 });
    if (!requestedCodes.length) return NextResponse.json({ ok: false, message: "حدد طالبًا واحدًا على الأقل." }, { status: 400 });
    if (reason.length < 3) return NextResponse.json({ ok: false, message: "اكتب سبب الإحالة بوضوح." }, { status: 400 });

    const assignments = normalizeAssignments(session.user.assignments, session.user.subjectIds);
    if (!assignments.some(item => item.subjectId === subjectId)) {
      return NextResponse.json({ ok: false, message: "هذه المادة ليست ضمن تكليف المعلم الحالي." }, { status: 403 });
    }

    const root = `portalV2Data/${session.userId}/subjects/${subjectId}`;
    const studentsSnapshot = await adminDb().collection(`${root}/students`).get();
    const requested = new Set(requestedCodes);
    const matched = studentsSnapshot.docs.filter(document => {
      const data = document.data() as Record<string, unknown>;
      return studentAliases(document.id, data).some(alias => requested.has(alias));
    });

    if (!matched.length) {
      return NextResponse.json({ ok: false, message: "تعذر مطابقة الطلاب المحددين مع سجل المادة." }, { status: 404 });
    }

    const now = new Date().toISOString();
    const typeLabel = referralType === "mastery" ? "إحالة مرتبطة بالإتقان والتحصيل" : "إحالة أخرى للمرشد";
    const batch = adminDb().batch();
    const names: string[] = [];

    matched.forEach(document => {
      const data = document.data() as Record<string, unknown>;
      const studentName = clean(data.name, 160) || clean(data.studentName, 160) || "طالب";
      const className = clean(data.className || data.class, 120);
      const studentCode = clean(data.code || data.accessCode || data.studentCode || document.id, 50);
      names.push(studentName);
      const referralId = randomUUID();
      batch.set(adminDb().collection(`${root}/counselorReferrals`).doc(referralId), {
        id: referralId,
        studentId: document.id,
        studentCode,
        studentName,
        className,
        referralType,
        referralTypeLabel: typeLabel,
        masteryRelated: referralType === "mastery",
        reason,
        status: "جديدة",
        visibleToStudent: true,
        severity: "high",
        teacherId: session.userId,
        teacherName: session.name || session.user?.name || "المعلم",
        subjectId,
        subject: clean(body?.subjectLabel, 120) || subjectId,
        createdAt: now,
        updatedAt: now,
      });

      // تبقى الإحالة ظاهرة في سجل الطالب وولي الأمر حتى لو لم يوجد أي رصد درجات.
      batch.set(document.ref, {
        parentCounselorNoticeCount: Number(data.parentCounselorNoticeCount || 0) + 1,
        parentCounselorLastNotice: {
          title: "إحالة للمرشد الطلابي",
          message: reason,
          referralType,
          subject: clean(body?.subjectLabel, 120) || subjectId,
          teacherName: session.name || session.user?.name || "المعلم",
          createdAt: now,
        },
        updatedAt: now,
      }, { merge: true });
    });

    await batch.commit();

    const subjectLabel = clean(body?.subjectLabel, 120) || subjectId;
    const whatsappText = `السلام عليكم،\nإحالة للمرشد الطلابي — ${subjectLabel}\nالنوع: ${typeLabel}\nالسبب: ${reason}\n\n${names.map((name, index) => `${index + 1}. ${name}`).join("\n")}\n\nالمعلم: ${session.name || session.user.name}`;

    return NextResponse.json({
      ok: true,
      count: matched.length,
      referralType,
      counselorPhone: COUNSELOR_PHONE,
      whatsappText,
      message: `تم تسجيل إحالة ${matched.length} طالب للمرشد.`,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("counselor referral failed", error);
    return NextResponse.json({ ok: false, message: "تعذر تسجيل الإحالة الآن." }, { status: 500 });
  }
}
