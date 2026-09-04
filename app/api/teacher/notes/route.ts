import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { requireSession } from "../../../../lib/server/portal-auth";
import { recordTeacherWork } from "../../../../lib/server/teacher-work-activity";

type NoteEntry = {
  id: string;
  type: string;
  label: string;
  message: string;
  createdAt: string;
  teacherName: string;
  subject: string;
};

function clean(value: unknown, limit = 500) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

async function findStudentDoc(teacherId: string, subjectId: string, code: string) {
  const students = adminDb().collection(`portalV2Data/${teacherId}/subjects/${subjectId}/students`);
  const directRef = students.doc(code);
  const direct = await directRef.get();
  if (direct.exists) return { snapshot: direct, reference: directRef };
  for (const field of ["code", "accessCode", "studentCode"] as const) {
    const snapshot = await students.where(field, "==", code).limit(1).get();
    if (!snapshot.empty) {
      const found = snapshot.docs[0]!;
      return { snapshot: found, reference: students.doc(found.id) };
    }
  }
  return null;
}

export async function GET(request: Request) {
  const session = await requireSession("teacher");
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  const url = new URL(request.url);
  const subjectId = clean(url.searchParams.get("subjectId"), 80).split("--")[0];
  if (!subjectId) return NextResponse.json({ ok: true, rows: [] });

  try {
    const snapshot = await adminDb().collection(`portalV2Data/${session.userId}/subjects/${subjectId}/students`).get();
    const rows = snapshot.docs.map(document => {
      const data = document.data() as Record<string, unknown>;
      const notes = Array.isArray(data.teacherNotes) ? data.teacherNotes as NoteEntry[] : [];
      return {
        studentCode: clean(data.code || data.accessCode || data.studentCode || document.id, 40),
        studentName: clean(data.name, 120),
        className: clean(data.className || data.class, 80),
        notes: notes.slice().sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))),
      };
    }).filter(row => row.studentCode && row.studentName);
    return NextResponse.json({ ok: true, rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("teacher notes get failed", error);
    return NextResponse.json({ ok: false, message: "تعذر تحميل الملاحظات." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireSession("teacher");
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const subjectId = clean(body.subjectId, 80).split("--")[0];
    const studentCode = clean(body.studentCode, 40).toUpperCase();
    const type = clean(body.type || "academic", 40);
    const label = clean(body.label || "ملاحظة المعلم", 120);
    const message = clean(body.message, 600);
    const subject = clean(body.subject || subjectId, 100);
    if (!subjectId || !studentCode || message.length < 3) {
      return NextResponse.json({ ok: false, message: "اختر الطالب واكتب الملاحظة." }, { status: 400 });
    }

    const student = await findStudentDoc(session.userId, subjectId, studentCode);
    if (!student) return NextResponse.json({ ok: false, message: "تعذر العثور على سجل الطالب." }, { status: 404 });
    const current = student.snapshot.data() as Record<string, unknown>;
    const previous = Array.isArray(current.teacherNotes) ? current.teacherNotes as NoteEntry[] : [];
    const createdAt = new Date().toISOString();
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const entry: NoteEntry = { id, type, label, message, createdAt, teacherName: session.name || "المعلم", subject };
    const next = [entry, ...previous].slice(0, 100);
    const counts = previous.reduce<Record<string, number>>((acc, note) => {
      const key = String(note.type || "other");
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    counts[type] = (counts[type] || 0) + 1;

    await student.reference.set({
      teacherNotes: next,
      teacherNote: message,
      teacherNoteCount: next.length,
      teacherNoteCounts: counts,
      teacherNoteUpdatedAt: createdAt,
      updatedAt: createdAt,
    }, { merge: true });

    await recordTeacherWork({
      teacherId: session.userId,
      teacherName: session.name || "المعلم",
      kind: "note",
      signature: `${subjectId}|${studentCode}|${id}`,
      meta: { subjectId, studentCode, type },
    }).catch(() => null);

    return NextResponse.json({ ok: true, note: entry });
  } catch (error) {
    console.error("teacher note create failed", error);
    return NextResponse.json({ ok: false, message: "تعذر حفظ الملاحظة." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await requireSession("teacher");
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const subjectId = clean(body.subjectId, 80).split("--")[0];
    const studentCode = clean(body.studentCode, 40).toUpperCase();
    const noteId = clean(body.noteId, 80);
    const student = await findStudentDoc(session.userId, subjectId, studentCode);
    if (!student) return NextResponse.json({ ok: false, message: "تعذر العثور على الطالب." }, { status: 404 });
    const current = student.snapshot.data() as Record<string, unknown>;
    const previous = Array.isArray(current.teacherNotes) ? current.teacherNotes as NoteEntry[] : [];
    const next = previous.filter(note => String(note.id || "") !== noteId);
    const counts = next.reduce<Record<string, number>>((acc, note) => {
      const key = String(note.type || "other");
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    await student.reference.set({
      teacherNotes: next,
      teacherNote: next[0]?.message || "",
      teacherNoteCount: next.length,
      teacherNoteCounts: counts,
      teacherNoteUpdatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("teacher note delete failed", error);
    return NextResponse.json({ ok: false, message: "تعذر حذف الملاحظة." }, { status: 500 });
  }
}
