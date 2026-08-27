import { NextResponse } from "next/server";
import { adminDb } from "../../../../../../lib/server/firebase-admin";
import { requireSession } from "../../../../../../lib/server/portal-auth";
import { SCHOOL_CLASSES_COLLECTION, SCHOOL_STUDENTS_COLLECTION, normalizeStudentRecord } from "../../../../../../lib/school-roster";

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  if (!await requireSession("admin")) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const { id } = await context.params;
    const classSnapshot = await adminDb().collection(SCHOOL_CLASSES_COLLECTION).doc(id).get();
    if (!classSnapshot.exists) return NextResponse.json({ ok: false, message: "الفصل غير موجود" }, { status: 404 });
    const schoolClass = classSnapshot.data() as { grade?: number; section?: string };
    const studentsSnapshot = await adminDb().collection(SCHOOL_STUDENTS_COLLECTION).get();
    const hasStudents = studentsSnapshot.docs.some(item => {
      const student = normalizeStudentRecord(item.data() as Record<string, unknown>, item.id);
      return !!student && student.active !== false && student.grade === Number(schoolClass.grade) && String(student.section) === String(schoolClass.section);
    });
    if (hasStudents) return NextResponse.json({ ok: false, message: "لا يمكن حذف فصل فيه طلاب. انقل الطلاب أو احذفهم أولًا." }, { status: 409 });
    await adminDb().collection(SCHOOL_CLASSES_COLLECTION).doc(id).delete();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("delete class failed", error);
    return NextResponse.json({ ok: false, message: "تعذر حذف الفصل" }, { status: 500 });
  }
}
