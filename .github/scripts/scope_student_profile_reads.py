from pathlib import Path

path = Path("app/api/student/profile/route.ts")
source = path.read_text(encoding="utf-8")

old = '''  const studentData = student.data() as Record<string, unknown>;
  const studentClass = normalizeClass(studentData.class || studentData.className || `${String(studentData.grade || "")} ${String(studentData.section || "")}`);
  const [attendance, timetable, gradePlanState, referralSnapshot] = await Promise.all([
    adminDb().collection(`${root}/attendance`).where("date", ">=", ATTENDANCE_START_DATE).get(),
    adminDb().collection(`${root}/timetable`).doc("weekly").get(),
    readActiveGradePlanForSubject(access.teacherId, access.subjectId),
    adminDb().collection(`${root}/counselorReferrals`).get(),
  ]);

  const aliases = new Set<string>([access.studentId, student.id]);
  candidates.forEach(doc => {
    aliases.add(doc.id);
    const data = (doc.data() || {}) as Record<string, unknown>;
    [data.code, data.accessCode, data.studentCode].map(clean).filter(Boolean).forEach(value => aliases.add(value));
  });
  [studentData.code, studentData.accessCode, studentData.studentCode].map(clean).filter(Boolean).forEach(value => aliases.add(value));
'''
new = '''  const studentData = student.data() as Record<string, unknown>;
  const studentClass = normalizeClass(studentData.class || studentData.className || `${String(studentData.grade || "")} ${String(studentData.section || "")}`);

  const aliases = new Set<string>([access.studentId, student.id]);
  candidates.forEach(doc => {
    aliases.add(doc.id);
    const data = (doc.data() || {}) as Record<string, unknown>;
    [data.code, data.accessCode, data.studentCode].map(clean).filter(Boolean).forEach(value => aliases.add(value));
  });
  [studentData.code, studentData.accessCode, studentData.studentCode].map(clean).filter(Boolean).forEach(value => aliases.add(value));
  const aliasList = [...aliases].filter(Boolean).slice(0, 10);

  // Scope reads to this student's class/student instead of reading every class and referral.
  // Existing collection names, IDs and teacher/subject linkage remain unchanged.
  const attendanceQuery = studentClass
    ? adminDb().collection(`${root}/attendance`).where("class", "==", studentClass)
    : adminDb().collection(`${root}/attendance`).where("date", ">=", ATTENDANCE_START_DATE);
  const referralQuery = aliasList.length
    ? adminDb().collection(`${root}/counselorReferrals`).where("studentId", "in", aliasList)
    : adminDb().collection(`${root}/counselorReferrals`).where("studentId", "==", access.studentId);
  const [attendance, timetable, gradePlanState, referralSnapshot] = await Promise.all([
    attendanceQuery.get(),
    adminDb().collection(`${root}/timetable`).doc("weekly").get(),
    readActiveGradePlanForSubject(access.teacherId, access.subjectId),
    referralQuery.get(),
  ]);
'''

if old in source:
    source = source.replace(old, new, 1)
elif 'const attendanceQuery = studentClass' not in source:
    raise SystemExit('student profile read block not found; refusing unsafe patch')

path.write_text(source, encoding="utf-8")

audit = Path("scripts/runtime-audit.mjs")
audit_source = audit.read_text(encoding="utf-8")
marker = "// FINAL_DRAIN_GUARD_STUDENT_PROFILE_SCOPE"
if marker not in audit_source:
    audit_source += '''\n\n// FINAL_DRAIN_GUARD_STUDENT_PROFILE_SCOPE\nforbid(\n  "app/api/student/profile/route.ts",\n  /collection\\(`\\$\\{root\\}\\/counselorReferrals`\\)\\.get\\(\\)/,\n  "ملف الطالب يجب ألا يقرأ جميع إحالات المادة عند كل دخول.",\n);\nrequirePattern(\n  "app/api/student/profile/route.ts",\n  /collection\\(`\\$\\{root\\}\\/attendance`\\)\\.where\\(\\s*["']class["']\\s*,\\s*["']==["']\\s*,\\s*studentClass\\s*\\)/,\n  "قراءة حضور الطالب يجب أن تكون مقيدة بفصل الطالب عندما يكون الفصل معروفًا.",\n);\nrequirePattern(\n  "app/api/student/profile/route.ts",\n  /collection\\(`\\$\\{root\\}\\/counselorReferrals`\\)\\.where\\(\\s*["']studentId["']\\s*,\\s*["']in["']/,\n  "إحالات الطالب يجب أن تُقرأ بهوياته فقط لا كمجموعة كاملة.",\n);\n'''
    audit.write_text(audit_source, encoding="utf-8")

print('student profile reads scoped')
