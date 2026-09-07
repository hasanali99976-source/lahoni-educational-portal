import { NextResponse } from "next/server";
import { adminDb } from "../../../../../lib/server/firebase-admin";
import { requireSession } from "../../../../../lib/server/portal-auth";
import {
  SCHOOL_CLASSES_COLLECTION,
  canonicalClassName,
  classId,
  gradeNumber,
  sectionNumber,
} from "../../../../../lib/school-roster";

export async function POST(request: Request) {
  if (!await requireSession("admin")) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const body = await request.json();
    const grade = gradeNumber(body?.grade);
    const section = sectionNumber(body?.section);
    if (!grade || !section) return NextResponse.json({ ok: false, message: "اختر الصف والفصل" }, { status: 400 });

    const now = new Date().toISOString();
    const name = canonicalClassName(grade, section);
    const id = classId(grade, section);
    const database = adminDb();
    const reference = database.collection(SCHOOL_CLASSES_COLLECTION).doc(id);
    const existing = await reference.get();
    const previous = existing.exists ? existing.data() as Record<string, unknown> : null;

    // إنشاء الفصل هنا عملية idempotent: أي بقايا قديمة أو وثيقة نشطة مخفية
    // بنفس الهوية تُستبدل بسجل فصل نظيف، بينما سجلات الطلاب التاريخية تبقى كما هي.
    await reference.set({
      id,
      grade,
      section,
      name,
      active: true,
      createdAt: typeof previous?.createdAt === "string" ? previous.createdAt : now,
      updatedAt: now,
      archivedAt: null,
      deletedAt: null,
    });

    return NextResponse.json({
      ok: true,
      schoolClass: { id, grade, section, name, active: true },
      recreated: existing.exists,
    }, { status: existing.exists ? 200 : 201 });
  } catch (error) {
    console.error("create class failed", error);
    return NextResponse.json({ ok: false, message: "تعذر إضافة الفصل" }, { status: 500 });
  }
}
