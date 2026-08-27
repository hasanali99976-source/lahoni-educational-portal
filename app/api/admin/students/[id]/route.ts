import { NextResponse } from "next/server";
import { adminDb } from "../../../../../lib/server/firebase-admin";
import { requireSession } from "../../../../../lib/server/portal-auth";
import {
  SCHOOL_CLASSES_COLLECTION,
  SCHOOL_STUDENTS_COLLECTION,
  canonicalClassName,
  classId,
  gradeNumber,
  sectionNumber,
} from "../../../../../lib/school-roster";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await requireSession("admin")) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const { id } = await context.params;
    const reference = adminDb().collection(SCHOOL_STUDENTS_COLLECTION).doc(id);
    const previous = await reference.get();
    if (!previous.exists) return NextResponse.json({ ok: false, message: "الطالب غير موجود" }, { status: 404 });
    const current = previous.data() as Record<string, unknown>;
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.replace(/\s+/g, " ").trim() : String(current.name || "");
    const grade = gradeNumber(body?.grade ?? current.grade ?? current.className);
    const section = sectionNumber(body?.section ?? current.section, current.className);
    if (name.length < 3 || !grade || !section) return NextResponse.json({ ok: false, message: "أكمل اسم الطالب والصف والفصل" }, { status: 400 });

    const oldGrade = gradeNumber(current.grade ?? current.className);
    const oldSection = sectionNumber(current.section, current.className);
    const moved = oldGrade !== grade || oldSection !== section;
    const now = new Date().toISOString();
    const className = canonicalClassName(grade, section);
    await reference.set({
      name,
      grade,
      section,
      className,
      active: body?.active === false ? false : true,
      updatedAt: now,
      transferredAt: moved ? now : current.transferredAt || null,
    }, { merge: true });
    await adminDb().collection(SCHOOL_CLASSES_COLLECTION).doc(classId(grade, section)).set({
      grade,
      section,
      name: className,
      active: true,
      updatedAt: now,
      createdAt: now,
    }, { merge: true });
    return NextResponse.json({ ok: true, moved, className });
  } catch (error) {
    console.error("update student failed", error);
    return NextResponse.json({ ok: false, message: "تعذر حفظ تعديل الطالب" }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  if (!await requireSession("admin")) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const { id } = await context.params;
    const reference = adminDb().collection(SCHOOL_STUDENTS_COLLECTION).doc(id);
    const snapshot = await reference.get();
    if (!snapshot.exists) return NextResponse.json({ ok: false, message: "الطالب غير موجود" }, { status: 404 });
    const now = new Date().toISOString();
    await reference.set({ active: false, archivedAt: now, updatedAt: now }, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("archive student failed", error);
    return NextResponse.json({ ok: false, message: "تعذر حذف الطالب" }, { status: 500 });
  }
}
