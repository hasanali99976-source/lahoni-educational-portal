from pathlib import Path
import re

attendance_path = Path("app/teacher/attendance/page.tsx")
attendance = attendance_path.read_text(encoding="utf-8")

old_payload = '''function classNamesFromPayload(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return value.map(item => {
    if (typeof item === "string") return normalizeClass(item);
    if (!item || typeof item !== "object") return "";
    const row = item as Record<string, unknown>;
    return normalizeClass(row.name || row.className || row.class || row.id);
  }).filter(Boolean);
}
'''
new_payload = '''function classNamesFromPayload(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return value.map(item => {
    if (typeof item === "string") return normalizeClass(item) || clean(item);
    if (!item || typeof item !== "object") return "";
    const row = item as Record<string, unknown>;
    const rawClassName = clean(row.name || row.className || row.class || row.id);
    return normalizeClass(rawClassName) || rawClassName;
  }).filter(Boolean);
}
'''
if old_payload not in attendance:
    raise SystemExit("classNamesFromPayload anchor not found")
attendance = attendance.replace(old_payload, new_payload, 1)

old_mapping = '''          const code = String(student.code || student.accessCode || student.studentCode || student.id || "").trim().toUpperCase();
          const className = normalizeClass(student.className || student.class);
          return {
'''
new_mapping = '''          const code = String(student.code || student.accessCode || student.studentCode || student.id || "").trim().toUpperCase();
          const rawClassName = clean(student.className || student.class);
          const className = normalizeClass(rawClassName) || rawClassName;
          return {
'''
if old_mapping not in attendance:
    raise SystemExit("official student mapping anchor not found")
attendance = attendance.replace(old_mapping, new_mapping, 1)

start_marker = '''  const scopedOfficialStudents = useMemo(
    () => officialStudents.filter(student => classAllowed(normalizeClass(student.class))),
    [officialStudents, assignmentScoped, assignments, subjectKey],
  );
'''
end_marker = '''  const classStudents = useMemo(
    () => students.filter(student => normalizeClass(student.class) === selectedClass),
    [students, selectedClass],
  );
'''
start = attendance.find(start_marker)
end = attendance.find(end_marker)
if start == -1 or end == -1 or end < start:
    raise SystemExit("attendance class source block not found")
end += len(end_marker)
replacement = '''  // القائمة الرسمية التي يعرضها الخادم هي المرجع نفسه المستخدم في صفحة الدرجات.
  // لا نعيد فلترتها في المتصفح حتى لا يسقط فصل صحيح بسبب صيغة تكليف قديمة.
  const scopedOfficialStudents = useMemo(() => officialStudents, [officialStudents]);
  const scopedLocalStudents = useMemo(
    () => localStudents.filter(student => classAllowed(normalizeClass(student.class) || clean(student.class))),
    [localStudents, assignmentScoped, assignments, subjectKey],
  );

  const students = useMemo(() => {
    const deleted = loadDeletedCodes(teacherId);
    const source = scopedOfficialStudents.length
      ? scopedOfficialStudents
      : mergeStudents(scopedLocalStudents, scopedOfficialStudents);
    return source.filter(student => {
      const code = studentCode(student);
      return !deleted.has(code) && student.active !== false && student.rosterActive !== false;
    });
  }, [scopedOfficialStudents, scopedLocalStudents, teacherId]);

  const officialStudentClasses = useMemo(
    () => officialStudents
      .map(student => normalizeClass(student.class) || clean(student.class))
      .filter(Boolean),
    [officialStudents],
  );

  const classes = useMemo(() => {
    const officialSource = [...officialClasses, ...officialStudentClasses].filter(Boolean);
    const fallbackSource = [
      ...assignedClasses,
      ...timetableClasses,
      ...students.map(student => normalizeClass(student.class) || clean(student.class)),
    ].filter(Boolean).filter(classAllowed);
    const source = officialSource.length ? officialSource : fallbackSource;
    return [...new Set(source)].sort((a, b) => a.localeCompare(b, "ar", { numeric: true }));
  }, [officialClasses, officialStudentClasses, assignedClasses, timetableClasses, students, assignmentScoped, assignments, subjectKey]);

  const classStudents = useMemo(
    () => students.filter(student => (normalizeClass(student.class) || clean(student.class)) === selectedClass),
    [students, selectedClass],
  );
'''
attendance = attendance[:start] + replacement + attendance[end:]
attendance_path.write_text(attendance, encoding="utf-8")

admin_path = Path("app/admin/page.tsx")
admin = admin_path.read_text(encoding="utf-8")
old_admin_sections = 'const SECTIONS = ["الكل", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨"] as const;'
new_admin_sections = 'const SECTIONS = ["الكل", "١", "٢", "٣", "٤", "٥", "٦", "٧"] as const;'
if old_admin_sections not in admin:
    raise SystemExit("admin sections anchor not found")
admin = admin.replace(old_admin_sections, new_admin_sections, 1)
admin_path.write_text(admin, encoding="utf-8")

roster_path = Path("lib/school-roster.ts")
roster = roster_path.read_text(encoding="utf-8")
old_roster_sections = 'export const SECTION_OPTIONS = ["1", "2", "3", "4", "5", "6", "7", "8"] as const;'
new_roster_sections = 'export const SECTION_OPTIONS = ["1", "2", "3", "4", "5", "6", "7"] as const;'
if old_roster_sections not in roster:
    raise SystemExit("school roster sections anchor not found")
roster = roster.replace(old_roster_sections, new_roster_sections, 1)
roster_path.write_text(roster, encoding="utf-8")

sw_path = Path("public/sw.js")
sw = sw_path.read_text(encoding="utf-8")
sw = re.sub(
    r'const CACHE_NAME = "[^"]+";',
    'const CACHE_NAME = "ostadh-lahooni-v27-attendance-grades-source";',
    sw,
    count=1,
)
sw_path.write_text(sw, encoding="utf-8")
