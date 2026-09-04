import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { requireSession } from "../../../../lib/server/portal-auth";
import { TEACHER_WORK_ACTIVITY_COLLECTION, TEACHER_WORK_WEIGHTS } from "../../../../lib/server/teacher-work-activity";

function currentRiyadhPeriod() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}`;
}

export async function GET() {
  const session = await requireSession("admin");
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const period = currentRiyadhPeriod();
    const snapshot = await adminDb().collection(TEACHER_WORK_ACTIVITY_COLLECTION).get();
    const rows = snapshot.docs
      .map(document => ({ id: document.id, ...(document.data() as Record<string, unknown>) }))
      .filter(row => String(row.period || "") === period)
      .map(row => ({
        teacherId: String(row.teacherId || ""),
        teacherName: String(row.teacherName || "المعلم"),
        score: Number(row.score || 0),
        meaningfulActions: Number(row.meaningfulActions || 0),
        activeDays: Number(row.activeDays || 0),
        counts: row.counts && typeof row.counts === "object" ? row.counts : {},
        lastActivityAt: String(row.lastActivityAt || ""),
      }))
      .filter(row => row.teacherId)
      .sort((a, b) => b.score - a.score || b.meaningfulActions - a.meaningfulActions || a.teacherName.localeCompare(b.teacherName, "ar"));

    return NextResponse.json({
      ok: true,
      period,
      rows,
      scoring: TEACHER_WORK_WEIGHTS,
      rule: "تُحتسب فقط عمليات العمل المحفوظة فعليًا، ولا تُحتسب الزيارات أو النقرات.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("admin teacher activity leaderboard failed", error);
    return NextResponse.json({ ok: false, message: "تعذر تحميل ترتيب الاستخدام الفعلي الآن." }, { status: 500 });
  }
}
