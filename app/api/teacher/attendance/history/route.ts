import { NextResponse } from "next/server";
import { isSubjectKey } from "../../../../../lib/subject-config";
import { normalizeAssignments } from "../../../../../lib/teacher-assignments";
import { adminDb } from "../../../../../lib/server/firebase-admin";
import { requireSession } from "../../../../../lib/server/portal-auth";

function clean(value: unknown) { return String(value || "").trim(); }

export async function GET(request: Request) {
  const session = await requireSession("teacher");
  if (!session?.user) return NextResponse.json({ ok:false, message:"انتهت جلسة المعلم." }, { status:401 });
  const url = new URL(request.url);
  const subjectId = clean(url.searchParams.get("subjectId")).split("--")[0];
  if (!isSubjectKey(subjectId)) return NextResponse.json({ ok:false, message:"المادة غير صحيحة." }, { status:400 });
  const assignments = normalizeAssignments(session.user.assignments, session.user.subjectIds);
  if (!assignments.some(item => item.subjectId === subjectId)) return NextResponse.json({ ok:false, message:"المادة غير مسندة إلى الحساب." }, { status:403 });
  try {
    const snapshot = await adminDb().collection(`portalV2Data/${session.userId}/subjects/${subjectId}/attendance`).get();
    const records = snapshot.docs.map(doc => ({ id:doc.id, ...doc.data() }));
    return NextResponse.json({ ok:true, records }, { headers:{ "Cache-Control":"no-store, max-age=0, must-revalidate" } });
  } catch {
    return NextResponse.json({ ok:false, message:"تعذر تحميل سجل الحضور التراكمي." }, { status:503, headers:{ "Cache-Control":"no-store, max-age=0" } });
  }
}
