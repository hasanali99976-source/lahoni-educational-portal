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

type NoteView = Record<string, unknown> & {
  studentCode: string;
  studentName: string;
  className: string;
  createdAt?: string;
};

function clean(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

async function resolveStudentDocumentId(teacherId: string, subjectId: string, studentCode: string): Promise<string | null> {
  const students = adminDb().collection(`portalV2Data/${teacherId}/subjects/${subjectId}/students`);
  const direct = await students.doc(studentCode).get();
  if (direct.exists) return direct.id;
  const snapshot = await students.where("code", "==", studentCode).limit(1).get();
  if (!snapshot.empty) return snapshot.docs[0]!.id;
  const accessSnapshot = await students.where("accessCode", "==", studentCode).limit(1).get();
  return accessSnapshot.empty ? null : accessSnapshot.docs[0]!.id;
}

export async function GET(request: Request) {
  const session = await requireSession("teacher");
  if (!session?.user) return NextResponse.json({ ok: false }, { status: 401 });
  const url = new URL(request.url);
  const subjectId = clean(url.searchParams.get("subjectId")).split("--")[0];
  if (!subjectId || !session.user.subjectIds.includes(subjectId)) return NextResponse.json({ ok: false }, { status: 403 });

  const students = await adminDb().collection(`portalV2Data/${session.userId}/subjects/${subjectId}/students`).get();
  const notes: NoteView[] = students.docs.flatMap(document => {
    const data = document.data() as Record<string, unknown>;
    const code = clean(data.code || data.accessCode || data.studentCode || document.id).toUpperCase();
    const name = clean(data.name);
    const className = clean(data.className || data.class);
    const publicNotes = Array.isArray(data.teacherNotes) ? data.teacherNotes : [];
    const internalNotes = Array.isArray(data.internalTeacherNotes) ? data.internalTeacherNotes : [];
    return [...publicNotes, ...internalNotes].map(raw => {
      const note = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
      return {
        ...note,
        studentCode: code,
        studentName: name,
        className,
        createdAt: clean(note.createdAt),
      } satisfies NoteView;
    });
  });
  notes.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

  return NextResponse.json({ ok: true, notes }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const session = await requireSession("teacher");
  if (!session?.user) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const subjectId = clean(body.subjectId).split("--")[0];
  if (!subjectId || !session.user.subjectIds.includes(subjectId)) return NextResponse.json({ ok: false }, { status: 403 });

  const rawCodes = Array.isArray(body.studentCodes) ? body.studentCodes : [body.studentCode];
  const studentCodes: string[] = [...new Set(rawCodes.map(item => clean(item).toUpperCase()).filter((value): value is string => Boolean(value)))];
  const message = clean(body.message);
  const requestedType = clean(body.type);
  const type = NOTE_TYPES[requestedType] ? requestedType : "followup";
  const visibleToParent = body.visibleToParent !== false;
  if (!studentCodes.length || message.length < 2) {
    return NextResponse.json({ ok: false, message: "اختر طالبًا واكتب الملاحظة." }, { status: 400 });
  }
  if (studentCodes.length > 200) return NextResponse.json({ ok: false, message: "العدد المختار كبير جدًا." }, { status: 400 });

  const now = new Date().toISOString();
  let saved = 0;
  const missing: string[] = [];
  const studentCollection = adminDb().collection(`portalV2Data/${session.userId}/subjects/${subjectId}/students`);

  for (const studentCode of studentCodes) {
    const documentId = await resolveStudentDocumentId(session.userId, subjectId, studentCode);
    if (!documentId) {
      missing.push(studentCode);
      continue;
    }
    const reference = studentCollection.doc(documentId);
    const snapshot = await reference.get();
    const data = snapshot.data() as Record<string, unknown>;
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
    const current = Array.isArray(data[key]) ? data[key] as unknown[] : [];
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
