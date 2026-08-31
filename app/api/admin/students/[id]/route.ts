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
    const studentData = snapshot.data() as Record<string, unknown>;
    const studentCode = String(studentData.code || studentData.accessCode || studentData.studentCode || id).trim().toUpperCase();
    const now = new Date().toISOString();
    await reference.set({ active: false, archivedAt: now, updatedAt: now }, { merge: true });

    let archivedTeacherCopies = 0;
    try {
      const relatedPaths = new Set<string>();
      for (const field of ["code", "accessCode", "studentCode"] as const) {
        const relatedSnapshot = await adminDb().collectionGroup("students").where(field, "==", studentCode).get();
        relatedSnapshot.docs.forEach(document => {
          const path = String(document.ref.path || "");
          if (path.startsWith("portalV2Data/")) relatedPaths.add(path);
        });
      }

      const paths = [...relatedPaths];
      for (let index = 0; index < paths.length; index += 400) {
        const batch = adminDb().batch();
        paths.slice(index, index + 400).forEach(path => {
          const separator = path.lastIndexOf("/");
          const itemReference = adminDb().collection(path.slice(0, separator)).doc(path.slice(separator + 1));
          batch.set(itemReference, {
            active: false,
            rosterActive: false,
            archived: true,
            archivedAt: now,
            updatedAt: now,
            archiveReason: "removed_from_admin_roster",
          }, { merge: true });
        });
        await batch.commit();
      }
      archivedTeacherCopies = paths.length;
    } catch (cascadeError) {
      console.warn("teacher student copies archive deferred", cascadeError);
    }

    return NextResponse.json({ ok: true, archivedTeacherCopies });
  } catch (error) {
    console.error("archive student failed", error);
    return NextResponse.json({ ok: false, message: "تعذر حذف الطالب" }, { status: 500 });
  }
}
