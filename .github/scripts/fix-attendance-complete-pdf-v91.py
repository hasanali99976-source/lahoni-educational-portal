from pathlib import Path

root = Path(__file__).resolve().parents[2]
path = root / "app/teacher/attendance/page.tsx"
text = path.read_text(encoding="utf-8")

def replace_once(old: str, new: str, label: str):
    global text
    if old not in text:
        raise SystemExit(f"missing anchor: {label}")
    text = text.replace(old, new, 1)

# Normalize class matching so spelling/format variants do not drop students from the PDF.
anchor = '''function classNamesFromPayload(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return value.map(item => {
    if (typeof item === "string") return normalizeClass(item) || clean(item);
    if (!item || typeof item !== "object") return "";
    const row = item as Record<string, unknown>;
    return canonicalClassFromParts(
      row.grade,
      row.section,
      row.name || row.className || row.class || row.id,
    );
  }).filter(Boolean);
}
'''
helper = '''function classNamesFromPayload(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return value.map(item => {
    if (typeof item === "string") return normalizeClass(item) || clean(item);
    if (!item || typeof item !== "object") return "";
    const row = item as Record<string, unknown>;
    return canonicalClassFromParts(
      row.grade,
      row.section,
      row.name || row.className || row.class || row.id,
    );
  }).filter(Boolean);
}

function attendanceClassKey(value: unknown, gradeValue?: unknown, sectionValue?: unknown) {
  const canonical = canonicalClassFromParts(gradeValue, sectionValue, value);
  return normalizeClass(canonical) || clean(canonical);
}

function attendanceStudentMatchesClass(student: UnifiedStudent, className: string) {
  const studentClass = attendanceClassKey(student.className || student.class, student.grade, student.section);
  const targetClass = attendanceClassKey(className);
  return Boolean(studentClass && targetClass && studentClass === targetClass);
}

function uniqueActiveRoster(source: UnifiedStudent[]) {
  const byCode = new Map<string, UnifiedStudent>();
  source.forEach(student => {
    const code = studentCode(student);
    const name = clean(student.name);
    if (!code || !name || student.active === false || student.rosterActive === false) return;
    byCode.set(code, { ...student, id: code, code, name });
  });
  return [...byCode.values()];
}
'''
replace_once(anchor, helper, "class helper")

# Official admin roster is authoritative. Local deletion markers must never hide an official student.
old_students = '''  const students = useMemo(() => {
    const deleted = loadDeletedCodes(teacherId);
    const source = scopedOfficialStudents.length
      ? scopedOfficialStudents
      : mergeStudents(scopedLocalStudents, scopedOfficialStudents);
    return source.filter(student => {
      const code = studentCode(student);
      return !deleted.has(code) && student.active !== false && student.rosterActive !== false;
    });
  }, [scopedOfficialStudents, scopedLocalStudents, teacherId]);
'''
new_students = '''  const students = useMemo(() => {
    if (scopedOfficialStudents.length) return uniqueActiveRoster(scopedOfficialStudents);
    const deleted = loadDeletedCodes(teacherId);
    return uniqueActiveRoster(mergeStudents(scopedLocalStudents, scopedOfficialStudents))
      .filter(student => !deleted.has(studentCode(student)));
  }, [scopedOfficialStudents, scopedLocalStudents, teacherId]);
'''
replace_once(old_students, new_students, "official roster authority")

# Use normalized class matching in the attendance screen itself.
replace_once(
'''  const classStudents = useMemo(
    () => students.filter(student => clean(student.class) === clean(selectedClass)),
    [students, selectedClass],
  );
''',
'''  const classStudents = useMemo(
    () => students.filter(student => attendanceStudentMatchesClass(student, selectedClass)),
    [students, selectedClass],
  );
''',
"class students matching",
)

# Single-class PDF and Excel: always build rows from the authoritative official roster when available.
replace_once(
'''  function reportRows() {
    return classStudents.map((student, index) => ({
''',
'''  function reportRows() {
    const pdfRoster = uniqueActiveRoster(officialStudents.length ? officialStudents : students)
      .filter(student => attendanceStudentMatchesClass(student, selectedClass))
      .sort((a, b) => clean(a.name).localeCompare(clean(b.name), "ar"));
    return pdfRoster.map((student, index) => ({
''',
"single pdf authoritative roster",
)

# All-classes PDF: same authoritative source and normalized class matching.
replace_once(
'''      const reports = await Promise.all(classes.map(async className => {
        const roster = students
          .filter(student => clean(student.class) === clean(className))
          .sort((a, b) => clean(a.name).localeCompare(clean(b.name), "ar"));
''',
'''      const pdfRosterSource = uniqueActiveRoster(officialStudents.length ? officialStudents : students);
      const reports = await Promise.all(classes.map(async className => {
        const roster = pdfRosterSource
          .filter(student => attendanceStudentMatchesClass(student, className))
          .sort((a, b) => clean(a.name).localeCompare(clean(b.name), "ar"));
''',
"all pdf authoritative roster",
)

# Make the success message explicit about the actual complete count used by the PDF.
text = text.replace(
'تم إنشاء PDF التحضير من الصفر بنجاح: ${result.studentCount} طالبًا في ${result.pageCount} صفحة.',
'تم إنشاء PDF الحضور كاملًا: ${result.studentCount} طالبًا في ${result.pageCount} صفحة، بدون إسقاط أسماء من القائمة الرسمية.',
)

path.write_text(text, encoding="utf-8")
print("attendance complete pdf v91 patch applied")
