import { NextResponse } from "next/server";
import { requireSession } from "../../../../lib/server/portal-auth";
import { buildTeacherCompetition } from "../../../../lib/server/teacher-competition";

export async function GET(request: Request) {
  const session = await requireSession("admin");
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const force = new URL(request.url).searchParams.get("refresh") === "1";
    const result = await buildTeacherCompetition({ force });
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("admin teacher activity leaderboard failed", error);
    return NextResponse.json({ ok: false, message: "تعذر التحقق من ترتيب المعلمين الآن. لم يتم عرض نقاط تقديرية." }, { status: 500 });
  }
}
