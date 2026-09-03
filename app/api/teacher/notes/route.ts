import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { requireSession } from "../../../../lib/server/portal-auth";
import { getSubjectConfig } from "../../../../lib/subject-config";

const NOTE_TYPES: Record<string, string> = {
  positive: "إيجابية",
  academic: "أكاديمية",
  homework: "واجب",
  behavioral: "سلوكية",
  followup: "متابعة",
  alert: "تنبيه",
};

function clean(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

async function resolveStudentDocument(teacherId: string, subjectId: string, studentCode: string) {
  const collection = adminDb().collection(`portalV2Data/${teacherId}/subjects/${subjectId}/students`);
  const direct = await collection.doc(studentCode).get();
  if (direct.exists) return direct.ref;
  const snapshot = await collection.where("code", "==", studentCode).limit(1).get();
  if (!snapshot.empty) return snapshot.docs[0]!.ref;
  const accessSnapshot = await collection.where("accessCode", "==", studentCode).limit(1).get();
  return accessSnapshot.empty ? null : accessSnapshot.docs[0]!.ref;
}

export async function GET(request: Request) {
  const session = await requireSession("teacher");
  if (!session?.user) return NextResponse.json({ ok: false }, { status: 401 });
  const url = new URL(request.url);
  const subjectId = clean(url.searchParams.get("subjectId")).split("--")[0];
  if (!subjectId || !session.user.subjectIds.includes(subjectId)) return NextResponse.json({ ok: false }, { status: 403 });

  const students = await adminDb().collection(`portalV2Data/${session.userId}/subjects/${subjectId}/students`).get();
  const notes = students.docs.flatMap(document => {
    const data = document.data() as Record<string, any>;
    const code = clean(data.code || data.accessCode || data.studentCode || document.id).toUpperCase();
    const name = clean(data.name);
    const className = clean(data.className || data.class);
    const publicNotes = Array.isArray(data.teacherNotes) ? data.teacherNotes : [];
    const internalNotes = Array.isArray(data.internalTeacherNotes) ? data.internalTeacherNotes : [];
    return [...publicNotes, ...internalNotes].map((note: Record<string, unknown>) => ({
      ...note,
      studentCode: code,
      studentName: name,
      className,
    }));
  }).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

  return NextResponse.json({ ok: true, notes }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const session = await requireSession("teacher");
  if (!session?.user) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const subjectId = clean(body.subjectId).split("--")[0];
  if (!subjectId || !session.user.subjectIds.includes(subjectId)) return NextResponse.json({ ok: false }, { status: 403 });

  const studentCodes = Array.isArray(body.studentCodes)
    ? [...new Set(body.studentCodes.map((item: unknown) => clean(item).toUpperCase()).filter(Boolean))]
    : [clean(body.studentCode).toUpperCase()].filter(Boolean);
  const message = clean(body.message);
  const type = NOTE_TYPES[clean(body.type)] ? clean(body.type) : "followup";
  const visibleToParent = body.visibleToParent !== false;
  if (!studentCodes.length || message.length < 2) {
    return NextResponse.json({ ok: false, message: "اختر طالبًا واكتب الملاحظة." }, { status: 400 });
  }
  if (studentCodes.length > 200) return NextResponse.json({ ok: false, message: "العدد المختار كبير جدًا." }, { status: 400 });

  const now = new Date().toISOString();
  let saved = 0;
  const missing: string[] = [];
  for (const studentCode of studentCodes) {
    const reference = await resolveStudentDocument(session.userId, subjectId, studentCode);
    if (!reference) {
      missing.push(studentCode);
      continue;
    }
    const snapshot = await reference.get();
    const data = snapshot.data() as Record<string, any>;
    const note = {
      id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      label: NOTE_TYPES[type],
      message,
      createdAt: now,
      teacherName: session.user.name,
      teacherId: session.userId,
      subject: getSubjectConfig(subjectId).label,
      subjectId,
      visibleToParent,
    };
    const key = visibleToParent ? "teacherNotes" : "internalTeacherNotes";
    const current = Array.isArray(data[key]) ? data[key] : [];
    const next = [note, ...current].slice(0, 250);
    const publicCount = visibleToParent
      ? next.length
      : Array.isArray(data.teacherNotes) ? data.teacherNotes.length : 0;
    await reference.set({
      [key]: next,
      teacherNoteCount: publicCount,
      teacherNoteUpdatedAt: now,
      updatedAt: now,
    }, { merge: true });
    saved += 1;
  }

  return NextResponse.json({ ok: true, saved, missing, visibleToParent }, { headers: { "Cache-Control": "no-store" } });
}