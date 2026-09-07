import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { requireSession } from "../../../../lib/server/portal-auth";

type DeductionEntry = {
  id: string;
  planId: string;
  scope: "plan" | "section" | "item";
  sectionId?: string;
  sectionLabel?: string;
  itemId?: string;
  itemLabel?: string;
  amount: number;
  reason: string;
  note?: string;
  createdAt: string;
  teacherId: string;
  teacherName: string;
  subjectKey: string;
  reversedAt?: string;
  reversedBy?: string;
};

function clean(value: unknown, limit = 300) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function numeric(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round(number * 100) / 100;
}

function directReason(reason: string, note: string) {
  return reason === "سبب آخر" ? (note || "خصم أكاديمي") : (reason || note || "خصم أكاديمي");
}

async function findStudentDoc(teacherId: string, subjectId: string, code: string) {
  const students = adminDb().collection(`portalV2Data/${teacherId}/subjects/${subjectId}/students`);
  const directRef = students.doc(code);
  const direct = await directRef.get();
  if (direct.exists) return { snapshot: direct, reference: directRef };
  for (const field of ["code", "accessCode", "studentCode"] as const) {
    const snapshot = await students.where(field, "==", code).limit(1).get();
    if (!snapshot.empty) {
      const found = snapshot.docs[0]!;
      return { snapshot: found, reference: students.doc(found.id) };
    }
  }
  return null;
}

export async function POST(request: Request) {
  const session = await requireSession("teacher");
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const subjectId = clean(body.subjectId, 80).split("--")[0];
    const studentCode = clean(body.studentCode, 40).toUpperCase();
    const planId = clean(body.planId, 120);
    const scope = body.scope === "item" || body.scope === "section" ? body.scope : "plan";
    const amount = numeric(body.amount);
    const reason = clean(body.reason, 180);
    const note = clean(body.note, 500);
    const sectionId = clean(body.sectionId, 120);
    const sectionLabel = clean(body.sectionLabel, 160);
    const itemId = clean(body.itemId, 120);
    const itemLabel = clean(body.itemLabel, 160);

    if (!subjectId || !studentCode || !planId || amount <= 0 || amount > 100 || !reason) {
      return NextResponse.json({ ok: false, message: "أكمل بيانات الخصم وحدد مقدارًا صحيحًا." }, { status: 400 });
    }
    if (scope === "section" && !sectionId) {
      return NextResponse.json({ ok: false, message: "اختر قسم التقييم المرتبط بالخصم." }, { status: 400 });
    }
    if (scope === "item" && (!sectionId || !itemId)) {
      return NextResponse.json({ ok: false, message: "اختر بند التقييم المرتبط بالخصم." }, { status: 400 });
    }

    const student = await findStudentDoc(session.userId, subjectId, studentCode);
    if (!student) return NextResponse.json({ ok: false, message: "تعذر العثور على سجل الطالب." }, { status: 404 });

    const current = student.snapshot.data() as Record<string, unknown>;
    const previous = Array.isArray(current.gradeDeductions) ? current.gradeDeductions as DeductionEntry[] : [];
    const createdAt = new Date().toISOString();
    const id = `ded-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const resolvedReason = directReason(reason, note);
    const entry: DeductionEntry = {
      id,
      planId,
      scope,
      amount,
      reason: resolvedReason,
      createdAt,
      teacherId: session.userId,
      teacherName: session.name || "المعلم",
      subjectKey: subjectId,
      ...(reason !== "سبب آخر" && note ? { note } : {}),
      ...(sectionId ? { sectionId, sectionLabel } : {}),
      ...(itemId ? { itemId, itemLabel } : {}),
    };
    const next = [entry, ...previous].slice(0, 120);

    await student.reference.set({
      gradeDeductions: next,
      gradeDeductionUpdatedAt: createdAt,
      updatedAt: createdAt,
    }, { merge: true });

    return NextResponse.json({ ok: true, deduction: entry, deductions: next });
  } catch (error) {
    console.error("grade deduction create failed", error);
    return NextResponse.json({ ok: false, message: "تعذر حفظ الخصم الآن." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await requireSession("teacher");
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const subjectId = clean(body.subjectId, 80).split("--")[0];
    const studentCode = clean(body.studentCode, 40).toUpperCase();
    const planId = clean(body.planId, 120);
    const amount = numeric(body.amount);
    const reason = clean(body.reason, 180);
    const note = clean(body.note, 500);

    if (!subjectId || !studentCode || !planId || amount < 0 || amount > 100 || (amount > 0 && !reason)) {
      return NextResponse.json({ ok: false, message: amount > 0 ? "اكتب مقدار الخصم وسببه." : "بيانات الخصم غير مكتملة." }, { status: 400 });
    }
    if (amount > 0 && reason === "سبب آخر" && !note) {
      return NextResponse.json({ ok: false, message: "اكتب ملاحظة توضح سبب الخصم." }, { status: 400 });
    }

    const student = await findStudentDoc(session.userId, subjectId, studentCode);
    if (!student) return NextResponse.json({ ok: false, message: "تعذر العثور على سجل الطالب." }, { status: 404 });

    const current = student.snapshot.data() as Record<string, unknown>;
    const previous = Array.isArray(current.gradeDeductions) ? current.gradeDeductions as DeductionEntry[] : [];
    const changedAt = new Date().toISOString();

    // الخصم الإجمالي في جدول التحصيل يخص المادة كلها، لذا أي حفظ جديد
    // يستبدل جميع الخصومات الإجمالية النشطة السابقة حتى لو تغير إصدار الخطة.
    const reversed = previous.map(entry => {
      const scope = entry.scope || "plan";
      if (entry.reversedAt || scope !== "plan") return entry;
      return { ...entry, reversedAt: changedAt, reversedBy: session.name || "المعلم" };
    });

    let entry: DeductionEntry | null = null;
    if (amount > 0) {
      const resolvedReason = directReason(reason, note);
      entry = {
        id: `ded-inline-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        planId,
        scope: "plan",
        amount,
        reason: resolvedReason,
        ...(reason !== "سبب آخر" && note ? { note } : {}),
        createdAt: changedAt,
        teacherId: session.userId,
        teacherName: session.name || "المعلم",
        subjectKey: subjectId,
      };
    }

    const next = [...(entry ? [entry] : []), ...reversed].slice(0, 120);
    await student.reference.set({
      gradeDeductions: next,
      gradeDeductionUpdatedAt: changedAt,
      updatedAt: changedAt,
    }, { merge: true });

    return NextResponse.json({ ok: true, deduction: entry, deductions: next });
  } catch (error) {
    console.error("grade deduction inline save failed", error);
    return NextResponse.json({ ok: false, message: "تعذر حفظ الخصم الآن." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await requireSession("teacher");
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const subjectId = clean(body.subjectId, 80).split("--")[0];
    const studentCode = clean(body.studentCode, 40).toUpperCase();
    const deductionId = clean(body.deductionId, 120);
    if (!subjectId || !studentCode || !deductionId) {
      return NextResponse.json({ ok: false, message: "بيانات الخصم غير مكتملة." }, { status: 400 });
    }

    const student = await findStudentDoc(session.userId, subjectId, studentCode);
    if (!student) return NextResponse.json({ ok: false, message: "تعذر العثور على سجل الطالب." }, { status: 404 });
    const current = student.snapshot.data() as Record<string, unknown>;
    const previous = Array.isArray(current.gradeDeductions) ? current.gradeDeductions as DeductionEntry[] : [];
    const reversedAt = new Date().toISOString();
    let found = false;
    const next = previous.map(entry => {
      if (String(entry.id || "") !== deductionId || entry.reversedAt) return entry;
      found = true;
      return { ...entry, reversedAt, reversedBy: session.name || "المعلم" };
    });
    if (!found) return NextResponse.json({ ok: false, message: "الخصم غير موجود أو تم إلغاؤه سابقًا." }, { status: 404 });

    await student.reference.set({
      gradeDeductions: next,
      gradeDeductionUpdatedAt: reversedAt,
      updatedAt: reversedAt,
    }, { merge: true });

    return NextResponse.json({ ok: true, deductions: next });
  } catch (error) {
    console.error("grade deduction reverse failed", error);
    return NextResponse.json({ ok: false, message: "تعذر إلغاء الخصم الآن." }, { status: 500 });
  }
}
