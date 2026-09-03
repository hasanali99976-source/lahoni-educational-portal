import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { requireSession } from "../../../../lib/server/portal-auth";

function objectSize(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value as Record<string, unknown>).length : 0;
}

function gradeEntryCount(data: Record<string, unknown>) {
  const direct = objectSize(data.gradeValues);
  const plans = data.gradePlanValues && typeof data.gradePlanValues === "object" && !Array.isArray(data.gradePlanValues)
    ? Object.values(data.gradePlanValues as Record<string, unknown>).reduce((sum, value) => sum + objectSize(value), 0)
    : 0;
  const legacy = data.units && typeof data.units === "object" && !Array.isArray(data.units)
    ? Object.values(data.units as Record<string, unknown>).reduce((sum, value) => sum + objectSize(value), 0)
    : 0;
  return Math.max(direct, plans, legacy);
}

export async function GET() {
  const session = await requireSession("admin");
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const database = adminDb();
    const users = await database.collection("portalV2Users").where("role", "==", "teacher").get();
    const rows = await Promise.all(users.docs.map(async teacherDoc => {
      const teacher = teacherDoc.data() as Record<string, any>;
      const subjectIds = Array.isArray(teacher.subjectIds) ? [...new Set(teacher.subjectIds.map(String))] : [];
      let attendance = 0;
      let timetable = 0;
      let gradeEntries = 0;
      let notes = 0;
      let lastActivity = String(teacher.updatedAt || teacher.createdAt || "");

      for (const subjectId of subjectIds) {
        const root = `portalV2Data/${teacherDoc.id}/subjects/${subjectId}`;
        const [attendanceSnapshot, studentsSnapshot, timetableSnapshot] = await Promise.all([
          database.collection(`${root}/attendance`).get().catch(() => null),
          database.collection(`${root}/students`).get().catch(() => null),
          database.collection(`${root}/timetable`).doc("weekly").get().catch(() => null),
        ]);

        if (attendanceSnapshot) {
          attendance += attendanceSnapshot.size;
          attendanceSnapshot.docs.forEach(doc => {
            const value = String((doc.data() as Record<string, unknown>).updatedAt || "");
            if (value > lastActivity) lastActivity = value;
          });
        }

        studentsSnapshot?.docs.forEach(doc => {
          const data = doc.data() as Record<string, unknown>;
          gradeEntries += gradeEntryCount(data);
          notes += Array.isArray(data.teacherNotes) ? data.teacherNotes.length : 0;
          notes += Array.isArray(data.internalTeacherNotes) ? data.internalTeacherNotes.length : 0;
          const value = String(data.gradePlanUpdatedAt || data.teacherNoteUpdatedAt || data.updatedAt || "");
          if (value > lastActivity) lastActivity = value;
        });

        if (timetableSnapshot?.exists) {
          const lessons = timetableSnapshot.data()?.lessons;
          timetable += objectSize(lessons);
          const value = String(timetableSnapshot.data()?.updatedAt || "");
          if (value > lastActivity) lastActivity = value;
        }
      }

      const points = attendance * 5 + gradeEntries + timetable * 4 + notes * 3;
      return {
        teacherId: teacherDoc.id,
        name: String(teacher.name || "معلم"),
        active: teacher.active !== false,
        points,
        attendance,
        gradeEntries,
        timetable,
        notes,
        lastActivity,
        historical: true,
      };
    }));

    rows.sort((a, b) => b.points - a.points || b.lastActivity.localeCompare(a.lastActivity));
    const max = Math.max(1, rows[0]?.points || 1);
    const leaderboard = rows.map((row, index) => ({
      ...row,
      rank: index + 1,
      progress: Math.round(row.points / max * 100),
      gapToNext: index === 0 ? 0 : Math.max(0, rows[index - 1]!.points - row.points),
    }));

    return NextResponse.json({ ok: true, leaderboard, calculatedFromExistingData: true, updatedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("teacher race failed", error);
    return NextResponse.json({ ok: false, message: "تعذر حساب سباق التفاعل الآن" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
