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
    await adminDb().collection(SCHOOL_CLASSES_COLLECTION).doc(id).set({ id, grade, section, name, active: true, createdAt: now, updatedAt: now }, { merge: true });
    return NextResponse.json({ ok: true, schoolClass: { id, grade, section, name, active: true } }, { status: 201 });
  } catch (error) {
    console.error("create class failed", error);
    return NextResponse.json({ ok: false, message: "تعذر إضافة الفصل" }, { status: 500 });
  }
}
