from pathlib import Path
import re


def read(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    Path(path).write_text(text, encoding="utf-8")


def replace_once(text: str, old: str, new: str, path: str) -> str:
    if old not in text:
        raise SystemExit(f"pattern not found in {path}: {old[:120]!r}")
    return text.replace(old, new, 1)

# 1) Admin assignments grant the grade; the teacher's saved class scope grants sections.
path = "lib/school-roster.ts"
text = read(path)
text = replace_once(
    text,
    '''export function assignmentMatchesClass(assignment: AssignmentLike, grade: number, section: string) {
  const assignedGrade = gradeNumber(assignment.grade);
  if (!assignedGrade || assignedGrade !== grade) return false;
  const normalizedSection = normalizeArabic(assignment.section);
  if (!normalizedSection || ["الكل", "كل", "جميع الفصول"].includes(normalizedSection)) return true;
  const assignedSection = sectionNumber(assignment.section);
  return Boolean(assignedSection && westernDigits(assignedSection) === westernDigits(section));
}''',
    '''export function assignmentMatchesClass(assignment: AssignmentLike, grade: number, _section: string) {
  const assignedGrade = gradeNumber(assignment.grade);
  return Boolean(assignedGrade && assignedGrade === grade);
}''',
    path,
)
write(path, text)

path = "lib/unified-roster.ts"
text = read(path)
text = replace_once(
    text,
    '''export function classMatchesAssignments(className: string, assignments: AssignmentLike[] | undefined, subjectKey: string) {
  const relevant = subjectAssignments(assignments, subjectKey).filter((assignment) => !!clean(assignment.grade));
  if (!relevant.length) return false;
  const classGrade = gradeNumber(className);
  const classSection = rosterSectionNumber("", className);
  if (!classGrade || !classSection) return false;

  return relevant.some((assignment) => {
    if (gradeNumber(clean(assignment.grade)) !== classGrade) return false;
    const normalizedSection = normalizeArabic(assignment.section);
    if (!normalizedSection || ["الكل", "كل", "جميع الفصول"].includes(normalizedSection)) return true;
    const assignedSection = rosterSectionNumber(assignment.section);
    return Boolean(assignedSection && westernDigits(assignedSection) === westernDigits(classSection));
  });
}''',
    '''export function classMatchesAssignments(className: string, assignments: AssignmentLike[] | undefined, subjectKey: string) {
  const relevant = subjectAssignments(assignments, subjectKey).filter((assignment) => !!clean(assignment.grade));
  if (!relevant.length) return false;
  const classGrade = gradeNumber(className);
  if (!classGrade) return false;
  return relevant.some((assignment) => gradeNumber(clean(assignment.grade)) === classGrade);
}''',
    path,
)
write(path, text)

# 2) A saved manual selection must not be invalidated when only the section text in admin assignment changes.
path = "lib/teacher-class-scope.ts"
text = read(path)
text = replace_once(
    text,
    '''export function assignmentScopeSignature(assignments: TeacherAssignment[], subjectId: string, grade?: number | null) {
  return assignments
    .filter(item => item.subjectId === subjectId)
    .filter(item => !grade || gradeNumber(item.grade) === grade)
    .map(item => `${gradeNumber(item.grade) || 0}:${sectionNumber(item.section) || normalizeArabic(item.section)}`)
    .sort()
    .join("|");
}''',
    '''export function assignmentScopeSignature(assignments: TeacherAssignment[], subjectId: string, grade?: number | null) {
  return [...new Set(assignments
    .filter(item => item.subjectId === subjectId)
    .filter(item => !grade || gradeNumber(item.grade) === grade)
    .map(item => `${gradeNumber(item.grade) || 0}`))]
    .sort()
    .join("|");
}''',
    path,
)
write(path, text)

# 3) Class-options: show every unreserved class in the active grade and never force exact assignment section.
path = "app/api/teacher/class-options/route.ts"
text = read(path)
text = re.sub(
    r'''\n    const exactAssignmentClassIds = new Set<string>\(\);\n    let hasAllSectionsAssignment = false;\n    relevant\.forEach\(assignment => \{.*?\n    \}\);\n''',
    "\n",
    text,
    count=1,
    flags=re.S,
)
text = re.sub(
    r'''\n    exactAssignmentClassIds\.forEach\(assignedClassId => \{.*?\n    \}\);\n''',
    "\n",
    text,
    count=1,
    flags=re.S,
)
old = '''    const assignmentAllowedClasses = allClasses.filter(item =>
      relevant.some(assignment => assignmentAllowsClassExact(assignment, item.grade, item.section)),
    );
    const availableClasses = assignmentAllowedClasses.filter(item => {
      const owner = ownerByClass.get(item.id);
      return exactAssignmentClassIds.has(item.id) || !owner || owner === session.userId;
    });
    const availableIds = new Set(availableClasses.map(item => item.id));
    const ownedByTeacher = assignmentAllowedClasses
      .filter(item => ownerByClass.get(item.id) === session.userId)
      .map(item => item.id);
    const storedSelection = scopeSnapshot.exists
      ? normalizeClassIds(scopeSnapshot.data()?.selectedClassIds).filter(item => availableIds.has(item))
      : [];
    const selectedClassIds = exactAssignmentClassIds.size > 0 && !hasAllSectionsAssignment
      ? [...exactAssignmentClassIds].filter(item => availableIds.has(item))
      : [...new Set([...ownedByTeacher, ...storedSelection])].filter(item => availableIds.has(item));

    return NextResponse.json({'''
new = '''    const availableClasses = allClasses.filter(item => {
      const owner = ownerByClass.get(item.id);
      return !owner || owner === session.userId;
    });
    const availableIds = new Set(availableClasses.map(item => item.id));
    const ownedByTeacher = allClasses
      .filter(item => ownerByClass.get(item.id) === session.userId)
      .map(item => item.id);
    const storedSelection = scopeSnapshot.exists
      ? normalizeClassIds(scopeSnapshot.data()?.selectedClassIds).filter(item => availableIds.has(item))
      : [];
    const selectedClassIds = [...new Set([...ownedByTeacher, ...storedSelection])]
      .filter(item => availableIds.has(item));

    return NextResponse.json({'''
text = replace_once(text, old, new, path)
text = replace_once(
    text,
    '''      hiddenOwnedByOtherTeachers: Math.max(0, assignmentAllowedClasses.length - availableClasses.length),
      totalClasses: assignmentAllowedClasses.length,
      exactAssignmentEnforced: exactAssignmentClassIds.size > 0 && !hasAllSectionsAssignment,''',
    '''      hiddenOwnedByOtherTeachers: Math.max(0, allClasses.length - availableClasses.length),
      totalClasses: allClasses.length,
      manualClassSelection: true,''',
    path,
)
text = text.replace("  canonicalClassName,\n", "")
text = text.replace("  normalizeArabic,\n", "")
text = text.replace("  sectionNumber,\n", "")
text = text.replace("  assignmentAllowsClassExact,\n", "")
write(path, text)

# 4) Class-scope: persist exactly what the teacher checked, constrained only to subject + active grade.
path = "app/api/teacher/class-scope/route.ts"
text = read(path)
text = replace_once(
    text,
    '''import { classId, gradeNumber, normalizeArabic, sectionNumber } from "../../../../lib/school-roster";''',
    '''import { gradeNumber } from "../../../../lib/school-roster";''',
    path,
)
text = text.replace("  assignmentAllowsClassExact,\n", "")
text = replace_once(
    text,
    '''    const activeGrade = parseGrade(body?.grade);
    const requestedClassIds = normalizeClassIds(body?.selectedClassIds);''',
    '''    const activeGrade = parseGrade(body?.grade);
    const selectedClassIds = normalizeClassIds(body?.selectedClassIds);''',
    path,
)
text = re.sub(
    r'''\n    const exactAssignmentClassIds = new Set<string>\(\);\n    let hasAllSectionsAssignment = false;\n    relevant\.forEach\(assignment => \{.*?\n    const selectedClassIds = exactAssignmentClassIds\.size > 0 && !hasAllSectionsAssignment\n      \? \[\.\.\.exactAssignmentClassIds\]\n      : requestedClassIds;\n''',
    "\n",
    text,
    count=1,
    flags=re.S,
)
text = replace_once(
    text,
    '''    const invalid = selectedClassIds.filter(item => {
      const { grade, section } = classParts(item);
      return !grade
        || !allowedGrades.has(grade)
        || (activeGrade !== null && grade !== activeGrade)
        || !relevant.some(assignment => assignmentAllowsClassExact(assignment, grade, section));
    });''',
    '''    const invalid = selectedClassIds.filter(item => {
      const { grade } = classParts(item);
      return !grade || !allowedGrades.has(grade) || (activeGrade !== null && grade !== activeGrade);
    });''',
    path,
)
text = replace_once(
    text,
    '''        if (previousTeacherId && previousTeacherId !== session.userId && !exactAssignmentClassIds.has(selectedClassIds[index])) {
          unavailableClassIds.push(selectedClassIds[index]);
        }''',
    '''        if (previousTeacherId && previousTeacherId !== session.userId) {
          unavailableClassIds.push(selectedClassIds[index]);
        }''',
    path,
)
text = replace_once(
    text,
    '''      persistedInDatabase: true,
      exactAssignmentEnforced: exactAssignmentClassIds.size > 0 && !hasAllSectionsAssignment,''',
    '''      persistedInDatabase: true,
      manualClassSelection: true,''',
    path,
)
write(path, text)

# 5) Roster API: the saved class scope is authoritative. Do not force the assignment's section back in.
path = "app/api/teacher/students/route.ts"
text = read(path)
text = re.sub(
    r'''\n    const exactAssignmentClassIds = new Set<string>\(\);\n    relevant\.forEach\(assignment => \{.*?\n    \}\);\n''',
    "\n",
    text,
    count=1,
    flags=re.S,
)
text = replace_once(
    text,
    '''          assignment.subjectId === subjectId
          && assignmentAllowsClassExact(assignment, schoolClass.grade, schoolClass.section),''',
    '''          assignment.subjectId === subjectId
          && gradeNumber(assignment.grade) === schoolClass.grade,''',
    path,
)
text = replace_once(text, '''      if (exactAssignmentClassIds.has(row.ownedClassId)) return;
      ownerByClass.set(row.ownedClassId, row.teacherId);''', '''      ownerByClass.set(row.ownedClassId, row.teacherId);''', path)
text = replace_once(
    text,
    '''    const classIsClaimable = (id: string) => {
      if (exactAssignmentClassIds.has(id)) return true;
      const owner = ownerByClass.get(id);
      return !owner || owner === session.userId;
    };''',
    '''    const classIsClaimable = (id: string) => {
      const owner = ownerByClass.get(id);
      return !owner || owner === session.userId;
    };''',
    path,
)
text = replace_once(
    text,
    '''    const selectedClassIds = [...new Set([...baseSelection, ...exactAssignmentClassIds])]
      .filter(id => availableMap.has(id) && classIsClaimable(id));''',
    '''    const selectedClassIds = [...new Set(baseSelection)]
      .filter(id => availableMap.has(id) && classIsClaimable(id));''',
    path,
)
text = re.sub(
    r'''\n    exactAssignmentClassIds\.forEach\(selectedClassId => \{.*?\n    \}\);\n''',
    "\n",
    text,
    count=1,
    flags=re.S,
)
text = replace_once(text, '''        if (exactAssignmentClassIds.has(selectedClassId)) return;
        if (ownerByClass.get(selectedClassId)) return;''', '''        if (ownerByClass.get(selectedClassId)) return;''', path)
text = replace_once(text, '''      exactAssignedClasses: exactAssignmentClassIds.size,''', '''      manualClassSelection: true,''', path)
text = text.replace("  normalizeArabic,\n", "")
text = text.replace("  sectionNumber,\n", "")
text = text.replace("  assignmentAllowsClassExact,\n", "")
write(path, text)

# 6) Make the manager wording match the actual model.
path = "app/teacher/students/page.tsx"
text = read(path)
text = replace_once(
    text,
    '''<p>كل معلم يرى فصوله فقط، والفصول التي يحفظها تختفي فورًا من خيارات معلمي المادة الآخرين.</p>''',
    '''<p>تظهر جميع فصول المرحلة المتاحة، واختر الفصول التي تدرّسها لتظهر في التحضير والدرجات وبقية صفحات المعلم.</p>''',
    path,
)
text = replace_once(
    text,
    '''<p>تظهر هنا فصولك المحفوظة والفصول التي لم يحجزها معلم آخر للمادة نفسها.{hiddenForOthers ? ` يوجد ${hiddenForOthers} فصل محفوظ لمعلم آخر ومخفي عنك.` : ""}</p>''',
    '''<p>حدد فصلًا واحدًا أو عدة فصول ثم احفظ. ستصبح هذه القائمة هي المرجع في التحضير والدرجات والتقارير.{hiddenForOthers ? ` يوجد ${hiddenForOthers} فصل محفوظ لمعلم آخر ومخفي عنك.` : ""}</p>''',
    path,
)
write(path, text)

# 7) Force a fresh PWA version.
path = "app/pwa-register.tsx"
text = read(path)
text = re.sub(r'ostadh-lahooni-v\d+[-a-z0-9]*', 'ostadh-lahooni-v30-manual-class-selection', text)
text = re.sub(r'/sw\.js\?v=[^"\']+', '/sw.js?v=30-manual-class-selection', text)
write(path, text)

path = "public/sw.js"
text = read(path)
text = re.sub(r'ostadh-lahooni-v\d+[-a-z0-9]*', 'ostadh-lahooni-v30-manual-class-selection', text)
write(path, text)

print("v30 manual class selection fix applied")
