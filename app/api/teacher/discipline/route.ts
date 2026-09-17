import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { requireSession } from "../../../../lib/server/portal-auth";
import { normalizeAssignments } from "../../../../lib/teacher-assignments";
import { isSubjectKey } from "../../../../lib/subject-config";
import { canonicalClassName, gradeNumber, sectionNumber } from "../../../../lib/school-roster";

const ATTENDANCE_START_DATE = "2026-08-23";
const VALID_STATUSES = new Set(["present", "absent", "late", "excused", "escaped"]);

function normalizedClass(value: unknown) {
  const raw = String(value || "").trim();
  const grade = gradeNumber(raw);
  const section = sectionNumber(undefined, raw);
  return grade && section ? canonicalClassName(grade, section) : raw;
}
function timestampValue(value: unknown) {
  if (typeof value === "string") return Date.parse(value) || 0;
  if (value && typeof value === "object" && "toMillis" in value && typeof (value as { toMillis?: unknown }).toMillis === "function") {
    try { return (value as { toMillis: () => number }).toMillis(); } catch { return 0; }
  }
  return 0;
}

async function readDisciplineAttendance(teacherId: string, subjectId: string) {
  const snapshot = await adminDb()
    .collection(`portalV2Data/${teacherId}/subjects/${subjectId}/attendance`)
    .where("date", ">=", ATTENDANCE_START_DATE)
    .get();

  const raw = snapshot.docs.map(document => {
    const data = document.data() as Record<string, unknown>;
    return { id: document.id, ...data, class: normalizedClass(data.class || data.className) };
  }).filter(item => String(item.date || "") >= ATTENDANCE_START_DATE);

  // السجلات التاريخية قد تحمل أكثر من تسمية للفصل نفسه. نجمعها حسب الفصل+التاريخ
  // ونأخذ أحدث حالة محفوظة لكل طالب حتى لا يتضاعف الغياب أو التأخير في الانضباط.
  const grouped = new Map<string, typeof raw>();
  raw.forEach(item => {
    const key = `${normalizedClass(item.class)}|${String(item.date || "")}`;
    const list = grouped.get(key) || [];
    list.push(item); grouped.set(key, list);
  });

  return [...grouped.values()].map(items => {
    const ordered = [...items].sort((a, b) => timestampValue(a.updatedAt) - timestampValue(b.updatedAt));
    const latest = ordered[ordered.length - 1];
    const records: Record<string, string> = {};
    ordered.forEach(item => {
      const source = item.records && typeof item.records === "object" ? item.records as Record<string, unknown> : {};
      Object.entries(source).forEach(([code, status]) => {
        const normalizedCode = String(code || "").trim().toUpperCase();
        const normalizedStatus = String(status || "").trim().toLowerCase();
        if (normalizedCode && VALID_STATUSES.has(normalizedStatus)) records[normalizedCode] = normalizedStatus;
      });
    });
    return { ...latest, class: normalizedClass(latest.class), records, duplicateDocumentsMerged: items.length };
  }).sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
}

export async function GET(request: Request) {
  const session = await requireSession("teacher");
  if (!session?.user) return NextResponse.json({ ok: false, message: "انتهت جلسة المعلم." }, { status: 401 });

  const url = new URL(request.url);
  const subjectId = String(url.searchParams.get("subjectId") || "").split("--")[0];
  if (!isSubjectKey(subjectId)) return NextResponse.json({ ok: false, message: "المادة غير صحيحة." }, { status: 400 });

  const assignments = normalizeAssignments(session.user.assignments, session.user.subjectIds);
  if (!assignments.some(item => item.subjectId === subjectId)) return NextResponse.json({ ok: false, message: "المادة غير مسندة إلى الحساب." }, { status: 403 });

  try {
    const attendance = await readDisciplineAttendance(session.userId, subjectId);
    return NextResponse.json(
      { ok: true, attendance, attendanceStartDate: ATTENDANCE_START_DATE, source: "teacher_saved_attendance", countingMode: "one_saved_record_per_class_date" },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("teacher discipline attendance read failed", error);
    return NextResponse.json(
      { ok: false, attendance: [], attendanceStartDate: ATTENDANCE_START_DATE, source: "teacher_saved_attendance", message: "تعذر تحميل بيانات الانضباط الآن." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
