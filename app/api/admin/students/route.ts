import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { requireSession } from "../../../../lib/server/portal-auth";
import {
  SCHOOL_CLASSES_COLLECTION,
  SCHOOL_STUDENTS_COLLECTION,
  canonicalClassName,
  classId,
  gradeNumber,
  nextStudentCode,
  normalizeClassRecord,
  normalizeStudentRecord,
  sectionNumber,
  type SchoolClass,
  type SchoolStudent,
} from "../../../../lib/school-roster";

async function loadStudents(includeArchived = false) {
  const snapshot = await adminDb().collection(SCHOOL_STUDENTS_COLLECTION).get();
  return snapshot.docs
    .map(item => normalizeStudentRecord(item.data() as Record<string, unknown>, item.id))
    .filter((item): item is SchoolStudent => !!item && (includeArchived || item.active !== false))
    .sort((a, b) => a.className.localeCompare(b.className, "ar", { numeric: true }) || a.name.localeCompare(b.name, "ar"));
}

async function loadClasses(students: SchoolStudent[]) {
  const snapshot = await adminDb().collection(SCHOOL_CLASSES_COLLECTION).get();
  const map = new Map<string, SchoolClass>();
  snapshot.docs.forEach(item => {
    const normalized = normalizeClassRecord({ id: item.id, ...(item.data() as Record<string, unknown>) } as Partial<SchoolClass>);
    if (normalized?.active !== false) map.set(normalized.id, normalized);
  });
  students.forEach(student => {
    const id = classId(student.grade, student.section);
    if (!map.has(id)) map.set(id, { id, grade: student.grade, section: student.section, name: student.className, active: true });
  });
  return [...map.values()].sort((a, b) => a.grade - b.grade || Number(a.section) - Number(b.section));
}

export async function GET(request: Request) {
  if (!await requireSession("admin")) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const includeArchived = new URL(request.url).searchParams.get("archived") === "1";
    const students = await loadStudents(includeArchived);
    const classes = await loadClasses(students.filter(student => student.active !== false));
    return NextResponse.json({ ok: true, students, classes }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("load school students failed", error);
    return NextResponse.json({ ok: false, message: "تعذر تحميل سجل الطلاب" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!await requireSession("admin")) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const body = await request.json();
    const name = String(body?.name || "").replace(/\s+/g, " ").trim();
    const grade = gradeNumber(body?.grade);
    const section = sectionNumber(body?.section);
    if (name.length < 3 || !grade || !section) {
      return NextResponse.json({ ok: false, message: "أدخل اسم الطالب واختر الصف والفصل" }, { status: 400 });
    }

    const existing = await loadStudents(true);
    const duplicate = existing.find(student => student.active !== false && student.name === name && student.grade === grade && student.section === section);
    if (duplicate) return NextResponse.json({ ok: false, message: `الطالب موجود مسبقًا، وكوده ${duplicate.code}` }, { status: 409 });

    const requestedCode = String(body?.code || "").trim().toUpperCase();
    const code = requestedCode || nextStudentCode(existing, grade);
    if (!code || existing.some(student => student.code === code && student.active !== false)) {
      return NextResponse.json({ ok: false, message: "تعذر إنشاء كود غير مستخدم" }, { status: 409 });
    }

    const now = new Date().toISOString();
    const className = canonicalClassName(grade, section);
    await adminDb().collection(SCHOOL_STUDENTS_COLLECTION).doc(code).set({
      code,
      name,
      grade,
      section,
      className,
      active: true,
      createdAt: now,
      updatedAt: now,
    }, { merge: true });
    await adminDb().collection(SCHOOL_CLASSES_COLLECTION).doc(classId(grade, section)).set({
      grade,
      section,
      name: className,
      active: true,
      updatedAt: now,
      createdAt: now,
    }, { merge: true });
    return NextResponse.json({ ok: true, student: { id: code, code, name, grade, section, className, active: true } }, { status: 201 });
  } catch (error) {
    console.error("create school student failed", error);
    return NextResponse.json({ ok: false, message: "تعذر إضافة الطالب" }, { status: 500 });
  }
}
