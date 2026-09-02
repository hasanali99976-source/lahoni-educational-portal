import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { requireSession } from "../../../../lib/server/portal-auth";
import { normalizeGradePlan, validateGradePlanDraft } from "../../../../lib/grade-plan";

const CONFIG_COLLECTION = "gradePlanConfig";
const VERSIONS_COLLECTION = "gradePlanVersions";

function teacherRoot(teacherId: string) {
  return `portalV2Data/${teacherId}`;
}

export async function GET() {
  const session = await requireSession("teacher");
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const database = adminDb();
    const root = teacherRoot(session.userId);
    const config = await database.collection(`${root}/${CONFIG_COLLECTION}`).doc("current").get();
    const activePlanId = config.exists ? String(config.data()?.activePlanId || "") : "";
    const [activeSnapshot, historySnapshot] = await Promise.all([
      activePlanId ? database.collection(`${root}/${VERSIONS_COLLECTION}`).doc(activePlanId).get() : Promise.resolve(null),
      database.collection(`${root}/${VERSIONS_COLLECTION}`).get(),
    ]);
    const activePlan = activeSnapshot && activeSnapshot.exists
      ? normalizeGradePlan({ id: activeSnapshot.id, ...activeSnapshot.data() })
      : null;
    const history = historySnapshot.docs.map((document: { id: string; data: () => Record<string, unknown> }) => {
      const data = document.data();
      return {
        id: document.id,
        version: Number(data.version || 0),
        mode: String(data.mode || ""),
        method: String(data.method || ""),
        status: String(data.status || "archived"),
        activatedAt: String(data.activatedAt || ""),
        archivedAt: String(data.archivedAt || ""),
      };
    }).sort((a, b) => b.version - a.version).slice(0, 20);
    return NextResponse.json({
      ok: true,
      activePlan,
      hasActivePlan: Boolean(activePlan),
      versionNumber: Number(config.data()?.versionNumber || 0),
      history,
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("teacher grade plan get failed", error);
    return NextResponse.json({ ok: false, message: "تعذر تحميل خطة توزيع الدرجات الآن." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireSession("teacher");
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const validation = validateGradePlanDraft(body?.plan ?? body);
    if (!validation.valid) {
      return NextResponse.json({ ok: false, message: validation.errors[0] || "الخطة غير مكتملة.", errors: validation.errors }, { status: 400 });
    }

    const database = adminDb();
    const root = teacherRoot(session.userId);
    const configRef = database.collection(`${root}/${CONFIG_COLLECTION}`).doc("current");
    const now = new Date().toISOString();
    const planId = `plan-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    let version = 1;

    await database.runTransaction(async transaction => {
      const configSnapshot = await transaction.get(configRef);
      const currentPlanId = configSnapshot.exists ? String(configSnapshot.data()?.activePlanId || "") : "";
      version = Math.max(0, Number(configSnapshot.data()?.versionNumber || 0)) + 1;

      if (currentPlanId) {
        const oldRef = database.collection(`${root}/${VERSIONS_COLLECTION}`).doc(currentPlanId);
        const oldSnapshot = await transaction.get(oldRef);
        if (oldSnapshot.exists) transaction.set(oldRef, { status: "archived", archivedAt: now }, { merge: true });
      }

      const versionRef = database.collection(`${root}/${VERSIONS_COLLECTION}`).doc(planId);
      transaction.set(versionRef, {
        ...validation.draft,
        id: planId,
        version,
        teacherId: session.userId,
        status: "active",
        createdAt: now,
        activatedAt: now,
        archivedAt: "",
      });
      transaction.set(configRef, {
        activePlanId: planId,
        versionNumber: version,
        mode: validation.draft.mode,
        method: validation.draft.method,
        activatedAt: now,
        updatedAt: now,
      }, { merge: true });
    });

    return NextResponse.json({ ok: true, planId, version, message: "تم اعتماد خطة توزيع الدرجات وقفلها." }, { status: 201 });
  } catch (error) {
    console.error("teacher grade plan save failed", error);
    return NextResponse.json({ ok: false, message: "تعذر اعتماد الخطة الآن. لم يتم تغيير الخطة الحالية." }, { status: 500 });
  }
}
