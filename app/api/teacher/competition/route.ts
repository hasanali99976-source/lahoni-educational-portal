import { NextResponse } from "next/server";
import { requireSession } from "../../../../lib/server/portal-auth";

/**
 * Quota-safety guard.
 *
 * The old implementation rebuilt the whole teacher competition from every
 * teacher/subject collection whenever this endpoint was opened. A single
 * request could therefore fan out into thousands of Firestore reads.
 *
 * Competition calculation is intentionally NOT performed from the normal
 * teacher request path anymore. This keeps login, dashboard, student sync,
 * attendance, grades and saved data completely independent from competition.
 * No Firestore data is changed or deleted here.
 */
export async function GET() {
  const session = await requireSession("teacher");
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  return NextResponse.json({
    ok: true,
    protectedMode: true,
    period: null,
    current: null,
    leader: null,
    ahead: null,
    gapToAhead: 0,
    progressToLeader: 0,
    totalTeachers: 0,
    topThree: [],
    rule: null,
    message: "تم إيقاف الحساب التلقائي الثقيل لحماية حصة القراءات. لا يؤثر ذلك على الطلاب أو الدرجات أو الحضور أو المحفوظات.",
  }, {
    headers: {
      "Cache-Control": "private, max-age=300, stale-while-revalidate=3600",
    },
  });
}
