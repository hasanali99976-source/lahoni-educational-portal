import { NextResponse } from "next/server";
import { getSubjectConfig, isSubjectKey } from "../../../../lib/subject-config";
import { normalizeAssignments } from "../../../../lib/teacher-assignments";
import { normalizeClass } from "../../../../lib/unified-roster";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { requireSession } from "../../../../lib/server/portal-auth";

type Lesson = { subject: string; className: string; notes: string };
type Schedule = Record<string, Lesson>;

const FIRESTORE_TIMEOUT_MS = 7000;
const VALID_CELL = /^(sunday|monday|tuesday|wednesday|thursday)-[1-7]$/;

async function withTimeout<T>(promise: Promise<T>, milliseconds = FIRESTORE_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timetable_timeout")), milliseconds);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function cleanSchedule(value: unknown, subjectLabel: string) {
  if (!value || typeof value !== "object") return {} as Schedule;
  const cleaned: Schedule = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, raw]) => {
    if (!VALID_CELL.test(key) || !raw || typeof raw !== "object") return;
    const lesson = raw as Partial<Lesson>;
    const className = normalizeClass(lesson.className);
    if (!className) return;
    cleaned[key] = {
      subject: subjectLabel,
      className,
      notes: String(lesson.notes || "").trim().slice(0, 500),
    };
  });
  return cleaned;
}

function normalizedClassNames(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return [...new Set(value.map(normalizeClass).filter(Boolean))];
}

function timetableReference(teacherId: string, subjectId: string) {
  return adminDb()
    .collection(`portalV2Data/${teacherId}/subjects/${subjectId}/timetable`)
    .doc("weekly");
}

async function teacherContext(subjectId: string) {
  const session = await requireSession("teacher");
  if (!session || !session.user) return { error: NextResponse.json({ ok: false, message: "انتهت جلسة المعلم، سجل الدخول مرة أخرى." }, { status: 401 }) };
  if (!isSubjectKey(subjectId)) return { error: NextResponse.json({ ok: false, message: "المادة غير صحيحة." }, { status: 400 }) };

  const assignments = normalizeAssignments(session.user.assignments, session.user.subjectIds);
  if (!assignments.some(item => item.subjectId === subjectId)) {
    return { error: NextResponse.json({ ok: false, message: "هذه المادة غير مسندة إلى حسابك." }, { status: 403 }) };
  }

  return {
    session,
    subjectLabel: getSubjectConfig(subjectId).label,
    reference: timetableReference(session.userId, subjectId),
  };
}

function errorResponse(error: unknown, action: "تحميل" | "حفظ") {
  const message = error instanceof Error ? error.message : "";
  if (message === "timetable_timeout") {
    return NextResponse.json(
      { ok: false, message: `انتهت مهلة ${action} الجدول. تم الاحتفاظ بالتعديل على الجهاز.` },
      { status: 504 },
    );
  }
  const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code || "") : "";
  if (code === "resource-exhausted" || message.includes("RESOURCE_EXHAUSTED") || message.toLowerCase().includes("quota exceeded")) {
    return NextResponse.json(
      { ok: false, message: "خدمة الحفظ السحابي مزدحمة مؤقتًا. تم الاحتفاظ بالتعديل على الجهاز." },
      { status: 429 },
    );
  }
  console.error(`timetable_${action === "حفظ" ? "save" : "load"}_failed`, error);
  return NextResponse.json(
    { ok: false, message: `تعذر ${action} الجدول الآن. لم يتم فقد أي حصة سابقة.` },
    { status: 500 },
  );
}

export async function GET(request: Request) {
  const subjectId = String(new URL(request.url).searchParams.get("subjectId") || "").split("--")[0];
  const context = await teacherContext(subjectId);
  if ("error" in context) return context.error;

  try {
    const snapshot = await withTimeout(context.reference.get());
    const data = snapshot.exists ? snapshot.data() as { lessons?: unknown } : undefined;
    const lessons = cleanSchedule(data?.lessons, context.subjectLabel);
    return NextResponse.json(
      { ok: true, lessons },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    return errorResponse(error, "تحميل");
  }
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({})) as {
    subjectId?: unknown;
    classNames?: unknown;
    lessons?: unknown;
  };
  const subjectId = String(body.subjectId || "").split("--")[0];
  const context = await teacherContext(subjectId);
  if ("error" in context) return context.error;

  const classNames = normalizedClassNames(body.classNames);
  if (!classNames.length) {
    return NextResponse.json({ ok: false, message: "لا توجد فصول مسندة لهذه المرحلة." }, { status: 400 });
  }

  const allowedClasses = new Set(classNames);
  const submitted = cleanSchedule(body.lessons, context.subjectLabel);
  const invalidLesson = Object.values(submitted).find(lesson => !allowedClasses.has(lesson.className));
  if (invalidLesson) {
    return NextResponse.json({ ok: false, message: "إحدى الحصص مرتبطة بفصل غير مسند إلى حسابك." }, { status: 400 });
  }

  try {
    const lessons = await withTimeout(adminDb().runTransaction(async transaction => {
      const snapshot = await transaction.get(context.reference);
      const data = snapshot.exists ? snapshot.data() as { lessons?: unknown } : undefined;
      const existing = cleanSchedule(data?.lessons, context.subjectLabel);
      const retained = Object.fromEntries(
        Object.entries(existing).filter(([, lesson]) => !allowedClasses.has(lesson.className)),
      ) as Schedule;
      const next = { ...retained, ...submitted };
      const now = new Date().toISOString();

      transaction.set(context.reference, {
        lessons: next,
        teacherId: context.session.userId,
        teacherName: context.session.name || "",
        subjectKey: subjectId,
        updatedAt: now,
        savedThroughApiAt: now,
      }, { merge: true });
      return next;
    }));

    return NextResponse.json(
      { ok: true, lessons },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    return errorResponse(error, "حفظ");
  }
}
