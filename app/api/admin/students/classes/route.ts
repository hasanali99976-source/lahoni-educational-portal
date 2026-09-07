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

    if (existing.exists) {
      const data = existing.data() as Record<string, unknown>;
      if (data.active !== false) {
        return NextResponse.json({ ok: false, message: `الفصل ${name} موجود مسبقًا.` }, { status: 409 });
      }
      // امسح بقايا وثيقة الفصل المحذوفة قبل إنشائه من جديد.
      // لا نحذف سجلات الطلاب المؤرشفة؛ فهي تاريخية ولا يجب أن تمنع إنشاء فصل جديد بنفس الاسم.
      await reference.delete();
    }

    await reference.set({ id, grade, section, name, active: true, createdAt: now, updatedAt: now });
    return NextResponse.json({
      ok: true,
      schoolClass: { id, grade, section, name, active: true },
      recreated: existing.exists,
    }, { status: 201 });
  } catch (error) {
    console.error("create class failed", error);
    return NextResponse.json({ ok: false, message: "تعذر إضافة الفصل" }, { status: 500 });
  }
}
