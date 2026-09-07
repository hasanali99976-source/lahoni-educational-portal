import { NextResponse } from "next/server";
import { calculateGradePlanResult, roundGrade } from "../../../../lib/grade-plan";
import { readStudentAccessToken } from "../../../../lib/server/portal-auth";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { readActiveGradePlanForSubject } from "../../../../lib/server/grade-plan-store";

type TokenRow = { subjectKey?: unknown; accessToken?: unknown };
type GradeDeduction = {
  id?: unknown;
  planId?: unknown;
  scope?: unknown;
  amount?: unknown;
  reason?: unknown;
  note?: unknown;
  teacherName?: unknown;
  createdAt?: unknown;
  reversedAt?: unknown;
};

function studentReason(reasonValue: unknown, noteValue: unknown) {
  const reason = String(reasonValue || "").trim();
  const note = String(noteValue || "").trim();
  if (reason === "سبب آخر") return note || "خصم أكاديمي";
  return reason || note || "خصم أكاديمي";
}

function normalizeDeduction(item: GradeDeduction) {
  const rawReason = String(item.reason || "").trim();
  const rawNote = String(item.note || "").trim();
  const reason = studentReason(rawReason, rawNote);
  return {
    id: String(item.id || ""),
    amount: Math.max(0, Number(item.amount || 0)),
    reason,
    note: rawReason === "سبب آخر" ? "" : rawNote,
    teacherName: String(item.teacherName || "").trim(),
    createdAt: String(item.createdAt || "").trim(),
  };
}

function activeDeductions(data: Record<string, unknown>, planId: string) {
  const rows = Array.isArray(data.gradeDeductions) ? data.gradeDeductions as GradeDeduction[] : [];
  const active = rows.filter(item => !item.reversedAt && Number(item.amount || 0) > 0);

  // الخصم الإجمالي في جدول التحصيل يخص المادة نفسها، وليس إصدار الخطة فقط.
  // نعتمد أحدث خصم إجمالي نشط حتى يلغيه المعلم، لكي لا يختفي عند تغيير خطة الرصد.
  const latestPlanDeduction = active
    .filter(item => !item.scope || String(item.scope) === "plan")
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))[0];

  // الخصومات التفصيلية القديمة تبقى مرتبطة بالخطة التي أنشئت عليها فقط.
  const scoped = active.filter(item => {
    const scope = String(item.scope || "plan");
    if (scope === "plan") return false;
    return !item.planId || String(item.planId) === planId;
  });

  return [
    ...(latestPlanDeduction ? [normalizeDeduction(latestPlanDeduction)] : []),
    ...scoped.map(normalizeDeduction),
  ];
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const rows = Array.isArray(body?.tokens) ? body.tokens as TokenRow[] : [];
    const safeRows = rows.slice(0, 30);

    const summaries = await Promise.all(safeRows.map(async row => {
      const token = String(row.accessToken || "");
      const access = readStudentAccessToken(token);
      if (!access) return null;
      const subjectKey = String(row.subjectKey || access.subjectId).trim();
      if (!subjectKey || subjectKey !== access.subjectId) return null;

      const [studentSnapshot, planState] = await Promise.all([
        adminDb().collection(`portalV2Data/${access.teacherId}/subjects/${access.subjectId}/students`).doc(access.studentId).get(),
        readActiveGradePlanForSubject(access.teacherId, access.subjectId),
      ]);
      if (!studentSnapshot.exists || !planState.activePlan) {
        return {
          subjectKey: access.subjectId,
          hasPlan: Boolean(planState.activePlan),
          planMode: planState.activePlan?.mode || "",
          planVersion: planState.activePlan?.version || 0,
          beforeDeduction: 0,
          deduction: 0,
          afterDeduction: 0,
          maximum: 100,
          availableMaximum: 100,
          completion: 0,
          deductions: [],
        };
      }

      const data = studentSnapshot.data() as Record<string, unknown>;
      const plan = planState.activePlan;
      const result = calculateGradePlanResult(plan, data);
      const deductions = activeDeductions(data, plan.id);
      const deduction = roundGrade(deductions.reduce((sum, item) => sum + item.amount, 0));
      const maximum = roundGrade(result.maximum || 100);
      const availableMaximum = Math.max(0, roundGrade(maximum - deduction));
      const beforeDeduction = roundGrade(result.earned);
      const afterDeduction = Math.max(0, roundGrade(beforeDeduction - deduction));

      return {
        subjectKey: access.subjectId,
        hasPlan: true,
        planMode: plan.mode,
        planVersion: plan.version,
        planSource: planState.source,
        beforeDeduction,
        deduction,
        afterDeduction,
        maximum,
        availableMaximum,
        completion: result.completion,
        complete: result.complete,
        deductions,
      };
    }));

    return NextResponse.json({ ok: true, summaries: summaries.filter(Boolean) }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("student academic summary failed", error);
    return NextResponse.json({ ok: false, message: "تعذر تحميل ملخص التحصيل الآن." }, { status: 500 });
  }
}
