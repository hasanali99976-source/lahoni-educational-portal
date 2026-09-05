import { NextResponse } from "next/server";
import { requireSession } from "../../../../lib/server/portal-auth";
import { buildTeacherCompetition } from "../../../../lib/server/teacher-competition";

export async function GET() {
  const session = await requireSession("teacher");
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const result = await buildTeacherCompetition();
    const current = result.rows.find(row => row.teacherId === session.userId) || null;
    const leader = result.rows[0] || null;
    const ahead = current && current.rank > 1 ? result.rows[current.rank - 2] || null : null;
    const gapToAhead = current && ahead ? Math.max(0, ahead.score - current.score + 1) : 0;
    const progressToLeader = current && leader && leader.score > 0
      ? Math.min(100, Math.round((current.score / leader.score) * 100))
      : current ? 100 : 0;

    return NextResponse.json({
      ok: true,
      period: result.period,
      current,
      leader,
      ahead,
      gapToAhead,
      progressToLeader,
      totalTeachers: result.rows.length,
      topThree: result.rows.slice(0, 3).map(row => ({ teacherId: row.teacherId, teacherName: row.teacherName, score: row.score, rank: row.rank })),
      rule: result.rule,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("teacher competition progress failed", error);
    return NextResponse.json({ ok: false, message: "تعذر تحميل تقدمك في التنافس الآن." }, { status: 500 });
  }
}
