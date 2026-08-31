from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"anchor not found: {label}")
    return text.replace(old, new, 1)


# 1) Attendance UI: trust explicit grade + section before parsing a legacy class label.
attendance_path = Path("app/teacher/attendance/page.tsx")
attendance = attendance_path.read_text(encoding="utf-8")

attendance = replace_once(
    attendance,
    'import { useTeacherClient } from "../../../lib/teacher-client";\n',
    'import { useTeacherClient } from "../../../lib/teacher-client";\n'
    'import { canonicalClassName, gradeNumber as rosterGradeNumber, sectionNumber as rosterSectionNumber } from "../../../lib/school-roster";\n',
    "attendance school roster import",
)

helper_anchor = '''function classNamesFromPayload(value: unknown) {
'''
helper_replacement = '''function canonicalClassFromParts(gradeValue: unknown, sectionValue: unknown, classValue: unknown) {
  const rawClassName = clean(classValue);
  const grade = rosterGradeNumber(gradeValue || rawClassName);
  const section = rosterSectionNumber(sectionValue, rawClassName);
  return grade && section
    ? canonicalClassName(grade, section)
    : normalizeClass(rawClassName) || rawClassName;
}

function classNamesFromPayload(value: unknown) {
'''
attendance = replace_once(attendance, helper_anchor, helper_replacement, "attendance canonical class helper")

attendance = replace_once(
    attendance,
    '''    const row = item as Record<string, unknown>;
    const rawClassName = clean(row.name || row.className || row.class || row.id);
    return normalizeClass(rawClassName) || rawClassName;
''',
    '''    const row = item as Record<string, unknown>;
    return canonicalClassFromParts(
      row.grade,
      row.section,
      row.name || row.className || row.class || row.id,
    );
''',
    "attendance class payload mapping",
)

attendance = replace_once(
    attendance,
    '''          const rawClassName = clean(student.className || student.class);
          const className = normalizeClass(rawClassName) || rawClassName;
''',
    '''          const className = canonicalClassFromParts(
            student.grade,
            student.section,
            student.className || student.class,
          );
''',
    "attendance official student mapping",
)

attendance_path.write_text(attendance, encoding="utf-8")


# 2) Teacher roster API: central student record is authoritative by student code.
route_path = Path("app/api/teacher/students/route.ts")
route = route_path.read_text(encoding="utf-8")

source_block = '''    const legacyRows = legacySnapshot.docs
      .map(item => ({ id: item.id, raw: item.data() as Record<string, unknown> }))
      .map(item => ({ ...item, student: normalizeLegacy(item.raw, item.id) }))
      .filter((item): item is LegacyRow => !!item.student && grades.has(item.student.grade as Grade));

    const centralAllRows = centralStudentSnapshot.docs
      .map(item => normalizeStudentRecord(item.data() as Record<string, unknown>, item.id))
      .filter((item): item is SchoolStudent => !!item && item.active !== false && grades.has(item.grade as Grade));
'''
replacement_block = '''    const allLegacyRows = legacySnapshot.docs
      .map(item => ({ id: item.id, raw: item.data() as Record<string, unknown> }))
      .map(item => ({ ...item, student: normalizeLegacy(item.raw, item.id) }))
      .filter((item): item is LegacyRow => !!item.student);

    const centralRosterRows = centralStudentSnapshot.docs
      .map(item => normalizeStudentRecord(item.data() as Record<string, unknown>, item.id))
      .filter((item): item is SchoolStudent => !!item && item.active !== false);
    const centralByCode = new Map(centralRosterRows.map(student => [student.code, student]));
    const centralAllRows = centralRosterRows.filter(item => grades.has(item.grade as Grade));

    // A moved student may still have an older teacher-subject document. Resolve every
    // legacy row through the current central record by code before filtering the grade.
    const legacyRows = allLegacyRows
      .map(item => {
        const official = centralByCode.get(item.student.code);
        if (!official) return grades.has(item.student.grade as Grade) ? item : null;
        if (!grades.has(official.grade as Grade)) return null;
        return {
          ...item,
          student: {
            ...item.student,
            ...official,
            id: official.code,
            code: official.code,
            grade: official.grade,
            section: official.section,
            className: canonicalClassName(official.grade, official.section),
            active: true,
          } as SchoolStudent,
        };
      })
      .filter((item): item is LegacyRow => !!item);
'''
route = replace_once(route, source_block, replacement_block, "central authoritative roster")

identity_block = '''    const byIdentity = new Map<string, SchoolStudent>();
    selectedLegacyRows.forEach(item => byIdentity.set(studentIdentity(item.student), { ...item.student, active: true }));
    centralRows.forEach(item => {
      const identity = studentIdentity(item);
      const previous = byIdentity.get(identity);
      byIdentity.set(identity, { ...item, ...previous, code: previous?.code || item.code, active: true });
    });

    const students = [...byIdentity.values()]
      .map(item => ({ ...item, className: canonicalClassName(item.grade, item.section), active: true, officialRoster: true }))
      .sort((a, b) => a.className.localeCompare(b.className, "ar", { numeric: true }) || a.name.localeCompare(b.name, "ar"));
'''
code_block = '''    const byCode = new Map<string, SchoolStudent>();
    selectedLegacyRows.forEach(item => {
      byCode.set(item.student.code, { ...item.student, active: true });
    });
    centralRows.forEach(item => {
      const previous = byCode.get(item.code);
      byCode.set(item.code, {
        ...previous,
        ...item,
        id: item.code,
        code: item.code,
        grade: item.grade,
        section: item.section,
        className: canonicalClassName(item.grade, item.section),
        active: true,
      });
    });

    const students = [...byCode.values()]
      .map(item => ({
        ...item,
        id: item.code,
        code: item.code,
        className: canonicalClassName(item.grade, item.section),
        active: true,
        officialRoster: true,
      }))
      .sort((a, b) => a.className.localeCompare(b.className, "ar", { numeric: true }) || a.name.localeCompare(b.name, "ar"));
'''
route = replace_once(route, identity_block, code_block, "deduplicate roster by student code")

route = replace_once(
    route,
    '''      classReadCount: centralClassSnapshot.docs.length,
      exactAssignedClasses: exactAssignmentClassIds.size,
''',
    '''      classReadCount: centralClassSnapshot.docs.length,
      centralStudentCodes: centralByCode.size,
      deduplicatedStudentCodes: students.length,
      exactAssignedClasses: exactAssignmentClassIds.size,
''',
    "roster diagnostics",
)

route_path.write_text(route, encoding="utf-8")


# 3) Force installed app shells to refresh stale attendance JavaScript and local roster.
sw_path = Path("public/sw.js")
sw = sw_path.read_text(encoding="utf-8")
sw = re.sub(
    r'const CACHE_NAME = "[^"]+";',
    'const CACHE_NAME = "ostadh-lahooni-v28-student-class-authority";',
    sw,
    count=1,
)
sw_path.write_text(sw, encoding="utf-8")
