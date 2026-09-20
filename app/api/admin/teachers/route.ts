import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { hashPassword } from "../../../../lib/server/password";
import { normalizeUsername, requireSession } from "../../../../lib/server/portal-auth";
import { normalizeAssignments } from "../../../../lib/teacher-assignments";

const ADMIN_TEACHERS_CACHE_TTL_MS = 30 * 1000;
type AdminTeacherRow = { id: string; username: unknown; name: string; active: unknown; subjectIds: string[]; assignments: ReturnType<typeof normalizeAssignments>; createdAt: unknown };
let teacherListCache: { teachers: AdminTeacherRow[]; expiresAt: number } | null = null;
let teacherListInflight: Promise<AdminTeacherRow[]> | null = null;

async function withTimeout<T>(promise: Promise<T>, milliseconds = 6500): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("firestore_timeout")), milliseconds);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function readTeacherList() {
  const snapshot = await withTimeout(
    adminDb().collection("portalV2Users").where("role", "==", "teacher").get(),
  );
  return snapshot.docs.map((item) => {
    const data = item.data();
    const storedSubjectIds: string[] = Array.isArray(data.subjectIds)
      ? data.subjectIds.map((id: unknown) => String(id))
      : [];
    const assignments = normalizeAssignments(data.assignments, storedSubjectIds);
    const subjectIds: string[] = assignments.length
      ? [...new Set<string>(assignments.map(assignment => assignment.subjectId))]
      : [...new Set<string>(storedSubjectIds.map((id: string) => id.split("--")[0]))];
    return { id: item.id, username: data.username, name: String(data.name || ""), active: data.active, subjectIds, assignments, createdAt: data.createdAt };
  }).sort((a, b) => a.name.localeCompare(b.name, "ar"));
}

async function loadTeacherList() {
  if (teacherListCache && teacherListCache.expiresAt > Date.now()) return teacherListCache.teachers;
  if (teacherListInflight) return teacherListInflight;
  teacherListInflight = readTeacherList();
  try {
    const teachers = await teacherListInflight;
    teacherListCache = { teachers, expiresAt: Date.now() + ADMIN_TEACHERS_CACHE_TTL_MS };
    return teachers;
  } finally {
    teacherListInflight = null;
  }
}

export async function GET() {
  if (!await requireSession("admin")) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const teachers = await loadTeacherList();
    return NextResponse.json({ ok: true, teachers }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.warn("admin teacher list temporarily unavailable", error);
    return NextResponse.json({
      ok: false,
      teachers: teacherListCache?.teachers || [],
      databaseUnavailable: true,
      message: "تم فتح لوحة الإدارة، لكن بيانات المعلمين مؤقتًا غير متاحة بسبب ضغط قاعدة البيانات. حاول التحديث بعد قليل.",
    }, { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" } });
  }
}

export async function POST(request: Request) {
  if (!await requireSession("admin")) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const body = await request.json();
    const name = String(body?.name || "").trim();
    const username = name;
    const password = String(body?.password || "");
    const assignments = normalizeAssignments(body?.assignments);
    const subjectIds: string[] = [...new Set<string>(assignments.map(item => item.subjectId))];
    if (name.length < 3 || password.length < 8 || !subjectIds.length) {
      return NextResponse.json({ ok: false, message: "أكمل اسم المعلم والرقم السري من ٨ خانات واختر مادة" }, { status: 400 });
    }
    const normalizedUsername = normalizeUsername(username);
    const duplicate = await withTimeout(
      adminDb().collection("portalV2Users").where("normalizedUsername", "==", normalizedUsername).limit(1).get(),
    );
    if (!duplicate.empty) return NextResponse.json({ ok: false, message: "اسم المعلم موجود مسبقًا" }, { status: 409 });
    const now = new Date().toISOString();
    const reference = adminDb().collection("portalV2Users").doc();
    await withTimeout(reference.set({ username, normalizedUsername, name, role: "teacher", passwordHash: hashPassword(password), active: true, subjectIds, assignments, createdAt: now, updatedAt: now }));
    const batch = adminDb().batch();
    for (const assignment of assignments) {
      batch.set(adminDb().collection("portalV2Assignments").doc(`${reference.id}__${assignment.id}`), { teacherId: reference.id, subjectId: assignment.subjectId, assignmentId: assignment.id, grade: assignment.grade, section: assignment.section, active: true, createdAt: now, updatedAt: now });
    }
    await withTimeout(batch.commit());
    teacherListCache = null;
    return NextResponse.json({ ok: true, id: reference.id }, { status: 201 });
  } catch (error) {
    console.error("create teacher failed", error);
    const unavailable = String((error as { message?: unknown })?.message || "").includes("firestore_timeout");
    return NextResponse.json({
      ok: false,
      databaseUnavailable: unavailable,
      message: unavailable
        ? "قاعدة البيانات مشغولة الآن. لم يُنشأ حساب ناقص؛ أعد المحاولة بعد قليل."
        : "تعذر إنشاء حساب المعلم",
    }, { status: unavailable ? 503 : 500 });
  }
}
