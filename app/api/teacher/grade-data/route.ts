import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { requireSession } from "../../../../lib/server/portal-auth";

function clean(value: unknown, limit = 100) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function archived(value: Record<string, unknown>) {
  return value.deleted === true
    || value.archived === true
    || Boolean(value.deletedAt)
    || Boolean(value.archivedAt)
    || String(value.status || "").toLowerCase() === "archived";
}

export async function GET(request: Request) {
  const session = await requireSession("teacher");
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const url = new URL(request.url);
    const subjectId = clean(url.searchParams.get("subjectId"), 80).split("--")[0];
    if (!subjectId) return NextResponse.json({ ok: false, message: "المادة غير محددة." }, { status: 400 });

    const snapshot = await adminDb()
      .collection(`portalV2Data/${session.userId}/subjects/${subjectId}/students`)
      .get();

    const byCode: Record<string, Record<string, unknown>> = {};
    snapshot.docs.forEach(item => {
      const data = item.data() as Record<string, unknown>;
      if (archived(data)) return;
      const code = clean(data.code || data.accessCode || data.studentCode || item.id, 40).toUpperCase();
      if (!code) return;
      const current = byCode[code] || {};
      const currentUpdated = String(current.updatedAt || current.gradePlanUpdatedAt || current.gradeDeductionUpdatedAt || "");
      const nextUpdated = String(data.updatedAt || data.gradePlanUpdatedAt || data.gradeDeductionUpdatedAt || "");
      if (!byCode[code] || nextUpdated >= currentUpdated) byCode[code] = { ...data, documentId: item.id };
    });

    return NextResponse.json({ ok: true, byCode }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("teacher grade data failed", error);
    return NextResponse.json({ ok: false, message: "تعذر تحميل بيانات التحصيل المحفوظة." }, { status: 500 });
  }
}
