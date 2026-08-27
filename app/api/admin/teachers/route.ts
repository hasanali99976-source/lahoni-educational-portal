import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { hashPassword } from "../../../../lib/server/password";
import { normalizeUsername, requireSession } from "../../../../lib/server/portal-auth";
import { normalizeAssignments } from "../../../../lib/teacher-assignments";

function sameStringList(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export async function GET() {
  if (!await requireSession("admin")) return NextResponse.json({ ok: false }, { status: 401 });
  const snapshot = await adminDb().collection("portalV2Users").where("role", "==", "teacher").get();
  const batch = adminDb().batch();
  let hasRepairs = false;
  const teachers = snapshot.docs.map((item) => {
    const data = item.data();
    const storedSubjectIds = Array.isArray(data.subjectIds) ? data.subjectIds.map(String) : [];
    const assignments = normalizeAssignments(data.assignments, storedSubjectIds);
    const subjectIds = assignments.length ? assignments.map(assignment => assignment.id) : storedSubjectIds;
    if (!sameStringList(storedSubjectIds, subjectIds)) {
      batch.set(item.ref, { subjectIds }, { merge: true });
      hasRepairs = true;
    }
    return { id: item.id, username: data.username, name: data.name, active: data.active, subjectIds, assignments, createdAt: data.createdAt };
  }).sort((a, b) => a.name.localeCompare(b.name, "ar"));
  if (hasRepairs) await batch.commit();
  return NextResponse.json({ ok: true, teachers }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!await requireSession("admin")) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const body = await request.json();
    const name = String(body?.name || "").trim();
    const username = name;
    const password = String(body?.password || "");
    const assignments = normalizeAssignments(body?.assignments);
    const subjectIds = assignments.map(item => item.id);
    if (name.length < 3 || password.length < 8 || !subjectIds.length) {
      return NextResponse.json({ ok: false, message: "أكمل اسم المعلم والرقم السري من ٨ خانات واختر مادة" }, { status: 400 });
    }
    const normalizedUsername = normalizeUsername(username);
    const duplicate = await adminDb().collection("portalV2Users").where("normalizedUsername", "==", normalizedUsername).limit(1).get();
    if (!duplicate.empty) return NextResponse.json({ ok: false, message: "اسم المعلم موجود مسبقًا" }, { status: 409 });
    const now = new Date().toISOString();
    const reference = adminDb().collection("portalV2Users").doc();
    await reference.set({ username, normalizedUsername, name, role: "teacher", passwordHash: hashPassword(password), active: true, subjectIds, assignments, createdAt: now, updatedAt: now });
    const batch = adminDb().batch();
    for (const subjectId of subjectIds) {
      batch.set(adminDb().collection("portalV2Assignments").doc(`${reference.id}__${subjectId}`), { teacherId: reference.id, subjectId, active: true, createdAt: now, updatedAt: now });
    }
    await batch.commit();
    return NextResponse.json({ ok: true, id: reference.id }, { status: 201 });
  } catch (error) {
    console.error("create teacher failed", error);
    return NextResponse.json({ ok: false, message: "تعذر إنشاء حساب المعلم" }, { status: 500 });
  }
}
