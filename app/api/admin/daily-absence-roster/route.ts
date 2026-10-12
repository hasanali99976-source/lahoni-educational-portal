import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { requireSession } from "../../../../lib/server/portal-auth";
import { SCHOOL_CLASSES_COLLECTION, SCHOOL_STUDENTS_COLLECTION, normalizeClassRecord, normalizeStudentRecord } from "../../../../lib/school-roster";

export const dynamic = "force-dynamic";

/**
 * Independent, read-only roster for secondary daily absence.
 * The original student and class collections remain the sole source of truth.
 * No student records are copied or mutated by this endpoint.
 */
export async function GET() {
  if (!await requireSession("admin")) {
    return NextResponse.json({ ok: false, message: "غير مصرح" }, { status: 401 });
  }
  try {
    const db = adminDb();
    const [studentSnapshot, classSnapshot] = await Promise.all([
      db.collection(SCHOOL_STUDENTS_COLLECTION).get(),
      db.collection(SCHOOL_CLASSES_COLLECTION).get(),
    ]);
    const students = studentSnapshot.docs
      .map(doc => normalizeStudentRecord(doc.data() as Record<string, unknown>, doc.id))
      .filter(student => student && student.active !== false && student.stage === "secondary")
      .map(student => ({
        id: student!.id,
        code: student!.code,
        name: student!.name,
        className: student!.className,
        grade: student!.grade,
        section: student!.section,
        stage: "secondary" as const,
      }));
    const classMap = new Map<string, { id: string; name: string; grade: number; section: string }>();
    classSnapshot.docs.forEach(doc => {
      const item = normalizeClassRecord({ id: doc.id, ...doc.data() });
      if (item && item.active !== false && item.stage === "secondary") {
        classMap.set(item.id, { id: item.id, name: item.name, grade: item.grade, section: String(item.section) });
      }
    });
    for (const student of students) {
      const key = student.className;
      if (![...classMap.values()].some(item => item.name === key)) {
        classMap.set(key, { id: key, name: key, grade: student.grade, section: String(student.section) });
      }
    }
    return NextResponse.json({ ok: true, students, classes: [...classMap.values()] }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("secondary absence roster unavailable", error);
    return NextResponse.json({ ok: false, message: "تعذر تحميل طلاب الثانوية" }, { status: 500 });
  }
}
