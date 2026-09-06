import { NextResponse } from "next/server";
import { calculateGradePlanResult, roundGrade } from "../../../../lib/grade-plan";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { requireSession } from "../../../../lib/server/portal-auth";
import { cleanGradePlanSubject, readActiveGradePlanForSubject } from "../../../../lib/server/grade-plan-store";

type GradeDeduction = { planId?: unknown; amount?: unknown; reversedAt?: unknown };

function archived(value: Record<string, unknown>) {
  return value.deleted === true
    || value.archived === true
    || Boolean(value.deletedAt)
    || Boolean(value.archivedAt)
    || String(value.status || "").toLowerCase() === "archived";
}

function activeDeductionTotal(data: Record<string, unknown>, planId: string) {
  const rows = Array.isArray(data.gradeDeductions) ? data.gradeDeductions as GradeDeduction[] : [];
  return roundGrade(rows
    .filter(item => !item.reversedAt && (!item.planId || String(item.planId) === planId))
    .reduce((sum, item) => sum + Math.max(0, Number(item.amount || 0)), 0));
}

export async function GET() {
  const session = await requireSession("teacher");
  if (!session?.user) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const subjectIds = [...new Set(session.user.subjectIds.map(cleanGradePlanSubject).filter(Boolean))];
    const database = adminDb();
    const summaries = await Promise.all(subjectIds.map(async subjectId => {
      const [planState, studentsSnapshot] = await Promise.all([
        readActiveGradePlanForSubject(session.userId, subjectId),
        database.collection(`portalV2Data/${session.userId}/subjects/${subjectId}/students`).get(),
      ]);
      const plan = planState.activePlan;
      if (!plan) {
        return {
          subjectId,
          hasPlan: false,
          planSource: planState.source,
          planMode: "",
          planVersion: 0,
          maximum: 100,
          students: 0,
          gradedStudents: 0,
          achievement: 0,
          originalAchievement: 0,
          completion: 0,
          deductedStudents: 0,
          deductionTotal: 0,
          averageDeduction: 0,
        };
      }

      const rows = studentsSnapshot.docs
        .map(document => document.data() as Record<string, unknown>)
        .filter(data => !archived(data));
      const graded = rows.map(data => {
        const result = calculateGradePlanResult(plan, data);
        const deduction = activeDeductionTotal(data, plan.id);
        const adjusted = Math.max(0, roundGrade(result.earned - deduction));
        return { result, deduction, adjusted };
      }).filter(row => row.result.recordedMaximum > 0);

      const originalAchievement = graded.length
        ? roundGrade(graded.reduce((sum, row) => sum + row.result.earned, 0) / graded.length)
        : 0;
      const achievement = graded.length
        ? roundGrade(graded.reduce((sum, row) => sum + row.adjusted, 0) / graded.length)
        : 0;
      const completion = graded.length
        ? Math.round(graded.reduce((sum, row) => sum + row.result.completion, 0) / graded.length)
        : 0;
      const deductionTotal = roundGrade(graded.reduce((sum, row) => sum + row.deduction, 0));
      const deductedStudents = graded.filter(row => row.deduction > 0).length;
      const averageDeduction = graded.length ? roundGrade(deductionTotal / graded.length) : 0;

      return {
        subjectId,
        hasPlan: true,
        planSource: planState.source,
        planMode: plan.mode,
        planVersion: plan.version,
        maximum: 100,
        students: rows.length,
        gradedStudents: graded.length,
        achievement,
        originalAchievement,
        completion,
        deductedStudents,
        deductionTotal,
        averageDeduction,
      };
    }));

    return NextResponse.json({ ok: true, summaries }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("teacher subject achievement failed", error);
    return NextResponse.json({ ok: false, message: "تعذر تحميل تحصيل المواد الآن." }, { status: 500 });
  }
}
