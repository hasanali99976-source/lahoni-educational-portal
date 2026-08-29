import { NextResponse } from "next/server";
import { adminDb } from "../../../../../../lib/server/firebase-admin";
import { requireSession } from "../../../../../../lib/server/portal-auth";
import { SCHOOL_CLASSES_COLLECTION } from "../../../../../../lib/school-roster";
import {
  countActiveStudentsInClass,
  managedClass,
  synchronizeClassChange,
  type ManagedClass,
} from "../../../../../../lib/server/admin-school-sync";

async function loadClass(id: string): Promise<ManagedClass | null> {
  const snapshot = await adminDb().collection(SCHOOL_CLASSES_COLLECTION).doc(id).get();
  if (!snapshot.exists) return null;
  const data = snapshot.data() as Record<string, unknown>;
  return managedClass(data.grade ?? id.split("-")[0], data.section ?? id.split("-")[1]);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await requireSession("admin")) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const { id } = await context.params;
    const previous = await loadClass(id);
    if (!previous) return NextResponse.json({ ok: false, message: "الفصل غير موجود" }, { status: 404 });

    const body = await request.json();
    const next = managedClass(body?.grade, body?.section);
    if (!next) {
      return NextResponse.json({ ok: false, message: "اختر صفًا صحيحًا من الأول إلى الثالث وفصلًا من ١ إلى ٨." }, { status: 400 });
    }

    const database = adminDb();
    if (next.id !== previous.id) {
      const conflict = await database.collection(SCHOOL_CLASSES_COLLECTION).doc(next.id).get();
      if (conflict.exists) {
        return NextResponse.json({ ok: false, message: `الفصل ${next.name} موجود مسبقًا.` }, { status: 409 });
      }
    }

    const summary = await synchronizeClassChange({ previous, next });
    const now = new Date().toISOString();
    await database.collection(SCHOOL_CLASSES_COLLECTION).doc(next.id).set({
      grade: next.grade,
      section: next.section,
      name: next.name,
      active: true,
      updatedAt: now,
      createdAt: now,
    }, { merge: true });
    if (next.id !== previous.id) {
      await database.collection(SCHOOL_CLASSES_COLLECTION).doc(previous.id).delete();
    }

    return NextResponse.json({
      ok: true,
      previousClass: previous,
      class: next,
      moved: next.id !== previous.id,
      synchronized: true,
      summary,
    });
  } catch (error) {
    console.error("update class failed", error);
    return NextResponse.json({ ok: false, message: "تعذر تعديل الفصل وربطه بالبوابات." }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await requireSession("admin")) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const { id } = await context.params;
    const previous = await loadClass(id);
    if (!previous) return NextResponse.json({ ok: false, message: "الفصل غير موجود" }, { status: 404 });

    const force = new URL(request.url).searchParams.get("force") === "1";
    const studentCount = await countActiveStudentsInClass(previous);
    if (studentCount > 0 && !force) {
      return NextResponse.json({
        ok: false,
        requiresForce: true,
        studentCount,
        message: `يوجد ${studentCount} طالبًا في الفصل. يمكن نقلهم أولًا، أو تأكيد الحذف لأرشفتهم مع بقاء سجلاتهم القديمة محفوظة.`,
      }, { status: 409 });
    }

    const summary = await synchronizeClassChange({
      previous,
      next: null,
      archiveStudents: force,
    });
    await adminDb().collection(SCHOOL_CLASSES_COLLECTION).doc(previous.id).delete();

    return NextResponse.json({
      ok: true,
      archivedStudents: force ? studentCount : 0,
      historicalRecordsPreserved: true,
      synchronized: true,
      summary,
    });
  } catch (error) {
    console.error("delete class failed", error);
    return NextResponse.json({ ok: false, message: "تعذر حذف الفصل وربط التغيير بالبوابات." }, { status: 500 });
  }
}
