from pathlib import Path
p=Path('app/api/student/profile/route.ts')
s=p.read_text()
old='''  const attendanceQuery = studentClass
    ? adminDb().collection(`${root}/attendance`).where("class", "==", studentClass)
    : adminDb().collection(`${root}/attendance`).where("date", ">=", ATTENDANCE_START_DATE);'''
new='''  // Read attendance records from the same subject cloud collection used by the teacher.
  // Filter class after normalization so legacy/canonical class spellings cannot hide saved attendance.
  const attendanceQuery = adminDb().collection(`${root}/attendance`).where("date", ">=", ATTENDANCE_START_DATE);'''
if old not in s: raise SystemExit('guard attendance query changed')
s=s.replace(old,new)
old='''    const date = typeof data.date === "string" ? data.date : "";
    if (!date || date < ATTENDANCE_START_DATE) continue;
    const recordMap = data?.records && typeof data.records === "object" ? data.records as Record<string, unknown> : {};'''
new='''    const date = typeof data.date === "string" ? data.date : "";
    if (!date || date < ATTENDANCE_START_DATE) continue;
    const recordClass = normalizeClass(data.class || data.className || "");
    if (studentClass && recordClass && recordClass !== studentClass) continue;
    const recordMap = data?.records && typeof data.records === "object" ? data.records as Record<string, unknown> : {};'''
if old not in s: raise SystemExit('guard attendance loop changed')
s=s.replace(old,new)
old='''  const expectedWeekdays = timetableWeekdays.size ? timetableWeekdays : new Set<number>(SCHOOL_WEEKDAYS);
  const attendanceSource = timetableWeekdays.size ? "timetable_automatic_until_teacher_override" : "school_days_automatic_until_teacher_override";
  const counts = { present: 0, absent: 0, late: 0, excused: 0, escaped: 0, total: 0 };
  let latestDate = "";
  let automaticPresent = 0;
  explicitByDate.forEach((entry, date) => { counts[entry.status] += 1; counts.total += 1; if (date > latestDate) latestDate = date; });
  const today = riyadhDateInput(new Date());
  const cursor = dateObject(ATTENDANCE_START_DATE);
  const end = dateObject(today);
  while (cursor <= end) {
    const date = cursor.toISOString().slice(0, 10);
    if (expectedWeekdays.has(cursor.getUTCDay()) && !explicitByDate.has(date)) { counts.present += 1; counts.total += 1; automaticPresent += 1; if (date > latestDate) latestDate = date; }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }'''
new='''  const expectedWeekdays = timetableWeekdays.size ? timetableWeekdays : new Set<number>(SCHOOL_WEEKDAYS);
  // Counts shown in the app must match teacher-saved attendance exactly.
  // Do not invent automatic present days that were never saved by the teacher.
  const attendanceSource = "teacher_saved_attendance";
  const counts = { present: 0, absent: 0, late: 0, excused: 0, escaped: 0, total: 0 };
  let latestDate = "";
  const automaticPresent = 0;
  explicitByDate.forEach((entry, date) => { counts[entry.status] += 1; counts.total += 1; if (date > latestDate) latestDate = date; });
  const today = riyadhDateInput(new Date());'''
if old not in s: raise SystemExit('guard attendance count block changed')
s=s.replace(old,new)
s=s.replace('attendanceMode: "automatic_until_teacher_override"','attendanceMode: "teacher_saved_only"')
p.write_text(s)
print('student attendance counts now mirror teacher-saved cloud records')
