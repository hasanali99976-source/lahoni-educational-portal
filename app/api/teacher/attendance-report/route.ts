import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { requireSession } from "../../../../lib/server/portal-auth";
import { normalizeAssignments } from "../../../../lib/teacher-assignments";
import { isSubjectKey } from "../../../../lib/subject-config";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

function validDate(value: string) {
  return DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`));
}

function inclusiveDays(from: string, to: string) {
  return Math.floor((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / DAY_MS) + 1;
}

export async function GET(request: Request) {
  const session = await requireSession("teacher");
  if (!session?.user) {
    return NextResponse.json({ ok: false, message: "انتهت جلسة المعلم." }, { status: 401 });
  }

  const url = new URL(request.url);
  const subjectId = String(url.searchParams.get("subjectId") || "").split("--")[0];
  const mode = url.searchParams.get("mode") === "daily" ? "daily" : "range";
  if (!isSubjectKey(subjectId)) {
    return NextResponse.json({ ok: false, message: "المادة غير صحيحة." }, { status: 400 });
  }

  const assignments = normalizeAssignments(session.user.assignments, session.user.subjectIds);
  if (!assignments.some(item => item.subjectId === subjectId)) {
    return NextResponse.json({ ok: false, message: "المادة غير مسندة إلى الحساب." }, { status: 403 });
  }

  const collection = adminDb().collection(`portalV2Data/${session.userId}/subjects/${subjectId}/attendance`);
  let query: FirebaseFirestore.Query = collection;

  if (mode === "daily") {
    const date = String(url.searchParams.get("date") || "");
    if (!validDate(date)) {
      return NextResponse.json({ ok: false, message: "تاريخ التقرير غير صحيح." }, { status: 400 });
    }
    query = collection.where("date", "==", date);
  } else {
    const from = String(url.searchParams.get("from") || "");
    const to = String(url.searchParams.get("to") || "");
    if (!validDate(from) || !validDate(to) || from > to || inclusiveDays(from, to) > 31) {
      return NextResponse.json({ ok: false, message: "فترة التقرير غير صحيحة أو تتجاوز 31 يومًا." }, { status: 400 });
    }
    query = collection.where("date", ">=", from).where("date", "<=", to);
  }

  try {
    const snapshot = await query.get();
    const attendance = snapshot.docs.map(document => ({
      id: document.id,
      ...(document.data() as Record<string, unknown>),
    }));
    return NextResponse.json(
      { ok: true, attendance },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("teacher attendance report read failed", error);
    return NextResponse.json(
      { ok: false, attendance: [], message: "تعذر تحميل سجل الحضور الآن." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
