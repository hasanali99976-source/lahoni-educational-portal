import { NextResponse } from "next/server";
import { requireSession } from "../../../../lib/server/portal-auth";
import { buildTeacherCompetition } from "../../../../lib/server/teacher-competition";

export async function GET() {
  const session = await requireSession("admin");
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const result = await buildTeacherCompetition();
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("admin teacher activity leaderboard failed", error);
    return NextResponse.json({ ok: false, message: "تعذر تحميل ترتيب الاستخدام الفعلي الآن." }, { status: 500 });
  }
}
