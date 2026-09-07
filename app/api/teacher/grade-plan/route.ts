import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { requireSession } from "../../../../lib/server/portal-auth";
import { normalizeGradePlan, validateGradePlanDraft } from "../../../../lib/grade-plan";
import {
  cleanGradePlanSubject,
  readActiveGradePlanForSubject,
  teacherOwnsGradePlanSubject,
} from "../../../../lib/server/grade-plan-store";

const CONFIG_COLLECTION = "gradePlanConfig";
const VERSIONS_COLLECTION = "gradePlanVersions";

function teacherRoot(teacherId: string) {
  return `portalV2Data/${teacherId}`;
}

function isQuotaError(error: unknown) {
  const source = error as { code?: string; message?: string } | null;
  const text = `${source?.code || ""} ${source?.message || ""}`.toLowerCase();
  return text.includes("resource-exhausted") || text.includes("resource_exhausted") || text.includes("quota exceeded");
}

export async function GET(request: Request) {
  const session = await requireSession("teacher");
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const url = new URL(request.url);
    const subjectId = cleanGradePlanSubject(url.searchParams.get("subjectId"));
    if (subjectId && !teacherOwnsGradePlanSubject(session.user, subjectId)) {
      return NextResponse.json({ ok: false, message: "هذه المادة غير مسندة للمعلم الحالي." }, { status: 403 });
    }

    const database = adminDb();
    const root = teacherRoot(session.userId);
    const gradePlan = subjectId
      ? await readActiveGradePlanForSubject(session.userId, subjectId)
      : await readActiveGradePlanForSubject(session.userId, "");
    const historySnapshot = await database.collection(`${root}/${VERSIONS_COLLECTION}`).get();
    const history = historySnapshot.docs
      .map((document: { id: string; data: () => Record<string, unknown> }) => ({ id: document.id, data: document.data() }))
      .filter(entry => {
        if (!subjectId) return !cleanGradePlanSubject(entry.data.subjectId);
        const entrySubject = cleanGradePlanSubject(entry.data.subjectId);
        if (gradePlan.source === "legacy") return !entrySubject;
        return entrySubject === subjectId;
      })
      .map(entry => ({
        id: entry.id,
        version: Number(entry.data.version || 0),
        mode: String(entry.data.mode || ""),
        method: String(entry.data.method || ""),
        status: String(entry.data.status || "archived"),
        activatedAt: String(entry.data.activatedAt || ""),
        archivedAt: String(entry.data.archivedAt || ""),
      }))
      .sort((a, b) => b.version - a.version)
      .slice(0, 20);

    return NextResponse.json({
      ok: true,
      subjectId,
      planSource: gradePlan.source,
      activePlan: gradePlan.activePlan,
      hasActivePlan: Boolean(gradePlan.activePlan || gradePlan.activePlanId),
      versionNumber: Number(gradePlan.configData.versionNumber || 0),
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
    const subjectId = cleanGradePlanSubject(body?.subjectId);
    if (!subjectId) return NextResponse.json({ ok: false, message: "حدد المادة قبل اعتماد الخطة." }, { status: 400 });
    if (!teacherOwnsGradePlanSubject(session.user, subjectId)) {
      return NextResponse.json({ ok: false, message: "هذه المادة غير مسندة للمعلم الحالي." }, { status: 403 });
    }

    const validation = validateGradePlanDraft(body?.plan ?? body);
    if (!validation.valid) {
      return NextResponse.json({ ok: false, message: validation.errors[0] || "الخطة غير مكتملة.", errors: validation.errors }, { status: 400 });
    }

    const database = adminDb();
    const root = teacherRoot(session.userId);
    const configRef = database.collection(`${root}/${CONFIG_COLLECTION}`).doc(subjectId);
    const now = new Date().toISOString();
    const planId = `${subjectId}--plan-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

    const configSnapshot = await configRef.get();
    const currentPlanId = configSnapshot.exists ? String(configSnapshot.data()?.activePlanId || "") : "";
    const version = Math.max(0, Number(configSnapshot.data()?.versionNumber || 0)) + 1;
    const batch = database.batch();

    if (currentPlanId && currentPlanId !== planId) {
      batch.set(database.collection(`${root}/${VERSIONS_COLLECTION}`).doc(currentPlanId), {
        status: "archived",
        archivedAt: now,
      }, { merge: true });
    }

    const versionRef = database.collection(`${root}/${VERSIONS_COLLECTION}`).doc(planId);
    batch.set(versionRef, {
      ...validation.draft,
      id: planId,
      version,
      teacherId: session.userId,
      subjectId,
      status: "active",
      createdAt: now,
      activatedAt: now,
      archivedAt: "",
    });
    batch.set(configRef, {
      subjectId,
      activePlanId: planId,
      versionNumber: version,
      mode: validation.draft.mode,
      method: validation.draft.method,
      activatedAt: now,
      updatedAt: now,
    }, { merge: true });
    await batch.commit();

    const activePlan = normalizeGradePlan({
      ...validation.draft,
      id: planId,
      version,
      teacherId: session.userId,
      status: "active",
      createdAt: now,
      activatedAt: now,
    });

    return NextResponse.json({ ok: true, subjectId, planId, version, activePlan, message: "تم اعتماد خطة المادة وقفلها ومزامنتها مع بوابة الطالب." }, { status: 201 });
  } catch (error) {
    console.error("teacher grade plan save failed", error);
    if (isQuotaError(error)) {
      return NextResponse.json({
        ok: false,
        code: "grade_plan_quota_exceeded",
        message: "تم بلوغ حصة التخزين السحابي مؤقتًا. ستبقى الخطة محليًا وسيعاد رفعها تلقائيًا عند عودة الاتصال بالسحابة.",
      }, { status: 507 });
    }
    return NextResponse.json({ ok: false, message: "تعذر اعتماد خطة المادة الآن. لم يتم تغيير الخطة الحالية." }, { status: 500 });
  }
}