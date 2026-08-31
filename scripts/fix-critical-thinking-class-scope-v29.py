from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"pattern not found in {path}: {old[:80]!r}")
    file_path.write_text(text.replace(old, new, 1), encoding="utf-8")


replace_once(
    "lib/school-roster.ts",
    '''export function assignmentMatchesClass(assignment: AssignmentLike, grade: number, _section: string) {
  const assignedGrade = gradeNumber(assignment.grade);
  return Boolean(assignedGrade && assignedGrade === grade);
}''',
    '''export function assignmentMatchesClass(assignment: AssignmentLike, grade: number, section: string) {
  const assignedGrade = gradeNumber(assignment.grade);
  if (!assignedGrade || assignedGrade !== grade) return false;
  const normalizedSection = normalizeArabic(assignment.section);
  if (!normalizedSection || ["الكل", "كل", "جميع الفصول"].includes(normalizedSection)) return true;
  const assignedSection = sectionNumber(assignment.section);
  return Boolean(assignedSection && westernDigits(assignedSection) === westernDigits(section));
}''',
)

replace_once(
    "lib/unified-roster.ts",
    '''export function classMatchesAssignments(className: string, assignments: AssignmentLike[] | undefined, subjectKey: string) {
  const relevant = subjectAssignments(assignments, subjectKey).filter((assignment) => !!clean(assignment.grade));
  if (!relevant.length) return false;
  const classGrade = gradeNumber(className);
  if (!classGrade) return false;

  return relevant.some((assignment) => gradeNumber(clean(assignment.grade)) === classGrade);
}''',
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
)

replace_once(
    "app/api/teacher/class-options/route.ts",
    '''  SCHOOL_CLASSES_COLLECTION,
  SCHOOL_STUDENTS_COLLECTION,
  classId,
  gradeNumber,
  normalizeClassRecord,
  normalizeStudentRecord,''',
    '''  SCHOOL_CLASSES_COLLECTION,
  SCHOOL_STUDENTS_COLLECTION,
  canonicalClassName,
  classId,
  gradeNumber,
  normalizeArabic,
  normalizeClassRecord,
  normalizeStudentRecord,
  sectionNumber,''',
)

replace_once(
    "app/api/teacher/class-options/route.ts",
    '''  SUBJECT_CLASS_OWNERS_COLLECTION,
  TEACHER_CLASS_SCOPES_COLLECTION,
  normalizeClassIds,
  teacherClassScopeId,''',
    '''  SUBJECT_CLASS_OWNERS_COLLECTION,
  TEACHER_CLASS_SCOPES_COLLECTION,
  assignmentAllowsClassExact,
  normalizeClassIds,
  teacherClassScopeId,''',
)

replace_once(
    "app/api/teacher/class-options/route.ts",
    '''    const assignmentGrades = new Set<Grade>(
      relevant.map(item => gradeNumber(item.grade)).filter((item): item is Grade => !!item),
    );

    if (!subjectId || !grade || !assignmentGrades.has(grade)) {''',
    '''    const assignmentGrades = new Set<Grade>(
      relevant.map(item => gradeNumber(item.grade)).filter((item): item is Grade => !!item),
    );
    const exactAssignmentClassIds = new Set<string>();
    let hasAllSectionsAssignment = false;
    relevant.forEach(assignment => {
      const normalizedSection = normalizeArabic(assignment.section);
      if (!normalizedSection || ["الكل", "كل", "جميع الفصول"].includes(normalizedSection)) {
        hasAllSectionsAssignment = true;
        return;
      }
      const assignedGrade = gradeNumber(assignment.grade);
      const assignedSection = sectionNumber(assignment.section);
      if (assignedGrade === grade && assignedSection) exactAssignmentClassIds.add(classId(assignedGrade, assignedSection));
    });

    if (!subjectId || !grade || !assignmentGrades.has(grade)) {''',
)

replace_once(
    "app/api/teacher/class-options/route.ts",
    '''    studentSnapshot.docs.forEach(document => {
      const student = normalizeStudentRecord(document.data() as Record<string, unknown>, document.id);
      if (!student || student.active === false || student.grade !== grade) return;
      classMap.set(classId(student.grade, student.section), classFromStudent(student));
    });

    const ownerByClass = new Map<string, string>();''',
    '''    studentSnapshot.docs.forEach(document => {
      const student = normalizeStudentRecord(document.data() as Record<string, unknown>, document.id);
      if (!student || student.active === false || student.grade !== grade) return;
      classMap.set(classId(student.grade, student.section), classFromStudent(student));
    });
    exactAssignmentClassIds.forEach(assignedClassId => {
      if (classMap.has(assignedClassId)) return;
      const [, section = ""] = assignedClassId.split("-");
      classMap.set(assignedClassId, {
        id: assignedClassId,
        grade,
        section,
        name: canonicalClassName(grade, section),
        active: true,
      });
    });

    const ownerByClass = new Map<string, string>();''',
)

replace_once(
    "app/api/teacher/class-options/route.ts",
    '''    const allClasses = [...classMap.values()]
      .filter(item => /^\\d+-\\d+$/.test(item.id))
      .sort((a, b) => Number(a.section) - Number(b.section));
    const availableClasses = allClasses.filter(item => {
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
      .filter(item => ownerByClass.get(item) === session.userId);

    return NextResponse.json({''',
    '''    const allClasses = [...classMap.values()]
      .filter(item => /^\\d+-\\d+$/.test(item.id))
      .sort((a, b) => Number(a.section) - Number(b.section));
    const assignmentAllowedClasses = allClasses.filter(item =>
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

    return NextResponse.json({''',
)

replace_once(
    "app/api/teacher/class-options/route.ts",
    '''      hiddenOwnedByOtherTeachers: Math.max(0, allClasses.length - availableClasses.length),
      totalClasses: allClasses.length,''',
    '''      hiddenOwnedByOtherTeachers: Math.max(0, assignmentAllowedClasses.length - availableClasses.length),
      totalClasses: assignmentAllowedClasses.length,
      exactAssignmentEnforced: exactAssignmentClassIds.size > 0 && !hasAllSectionsAssignment,''',
)

replace_once(
    "app/api/teacher/class-scope/route.ts",
    '''import { gradeNumber } from "../../../../lib/school-roster";''',
    '''import { classId, gradeNumber, normalizeArabic, sectionNumber } from "../../../../lib/school-roster";''',
)

replace_once(
    "app/api/teacher/class-scope/route.ts",
    '''  assignmentScopeSignature,
  normalizeClassIds,''',
    '''  assignmentAllowsClassExact,
  assignmentScopeSignature,
  normalizeClassIds,''',
)

replace_once(
    "app/api/teacher/class-scope/route.ts",
    '''    const activeGrade = parseGrade(body?.grade);
    const selectedClassIds = normalizeClassIds(body?.selectedClassIds);
    const assignments = normalizeAssignments(user.assignments, user.subjectIds);''',
    '''    const activeGrade = parseGrade(body?.grade);
    const requestedClassIds = normalizeClassIds(body?.selectedClassIds);
    const assignments = normalizeAssignments(user.assignments, user.subjectIds);''',
)

replace_once(
    "app/api/teacher/class-scope/route.ts",
    '''    if (!subjectId || !relevant.length) {
      return NextResponse.json({ ok: false, message: "المادة أو المرحلة غير مرتبطة بحسابك." }, { status: 400 });
    }

    const allowedGrades = new Set<Grade>(''',
    '''    if (!subjectId || !relevant.length) {
      return NextResponse.json({ ok: false, message: "المادة أو المرحلة غير مرتبطة بحسابك." }, { status: 400 });
    }

    const exactAssignmentClassIds = new Set<string>();
    let hasAllSectionsAssignment = false;
    relevant.forEach(assignment => {
      const normalizedSection = normalizeArabic(assignment.section);
      if (!normalizedSection || ["الكل", "كل", "جميع الفصول"].includes(normalizedSection)) {
        hasAllSectionsAssignment = true;
        return;
      }
      const assignedGrade = gradeNumber(assignment.grade);
      const assignedSection = sectionNumber(assignment.section);
      if (assignedGrade && assignedSection) exactAssignmentClassIds.add(classId(assignedGrade, assignedSection));
    });
    const selectedClassIds = exactAssignmentClassIds.size > 0 && !hasAllSectionsAssignment
      ? [...exactAssignmentClassIds]
      : requestedClassIds;

    const allowedGrades = new Set<Grade>(''',
)

replace_once(
    "app/api/teacher/class-scope/route.ts",
    '''    const invalid = selectedClassIds.filter(item => {
      const { grade } = classParts(item);
      return !grade || !allowedGrades.has(grade) || (activeGrade !== null && grade !== activeGrade);
    });''',
    '''    const invalid = selectedClassIds.filter(item => {
      const { grade, section } = classParts(item);
      return !grade
        || !allowedGrades.has(grade)
        || (activeGrade !== null && grade !== activeGrade)
        || !relevant.some(assignment => assignmentAllowsClassExact(assignment, grade, section));
    });''',
)

replace_once(
    "app/api/teacher/class-scope/route.ts",
    '''        if (previousTeacherId && previousTeacherId !== session.userId) {
          unavailableClassIds.push(selectedClassIds[index]);
        }''',
    '''        if (previousTeacherId && previousTeacherId !== session.userId && !exactAssignmentClassIds.has(selectedClassIds[index])) {
          unavailableClassIds.push(selectedClassIds[index]);
        }''',
)

replace_once(
    "app/api/teacher/class-scope/route.ts",
    '''      persistedInDatabase: true,''',
    '''      persistedInDatabase: true,
      exactAssignmentEnforced: exactAssignmentClassIds.size > 0 && !hasAllSectionsAssignment,''',
)

pwa = Path("app/pwa-register.tsx")
pwa_text = pwa.read_text(encoding="utf-8")
pwa_text = pwa_text.replace('const CURRENT_CACHE = "ostadh-lahooni-v23-print-diagnostics";', 'const CURRENT_CACHE = "ostadh-lahooni-v29-exact-class-assignment";')
pwa_text = pwa_text.replace('const RELOAD_KEY = "ostadh-lahooni-v23-print-diagnostics-reloaded";', 'const RELOAD_KEY = "ostadh-lahooni-v29-exact-class-assignment-reloaded";')
pwa_text = pwa_text.replace('/sw.js?v=23-print-diagnostics', '/sw.js?v=29-exact-class-assignment')
pwa.write_text(pwa_text, encoding="utf-8")

sw = Path("public/sw.js")
sw_text = sw.read_text(encoding="utf-8")
import re
sw_text, count = re.subn(r'const CACHE_NAME = "[^"]+";', 'const CACHE_NAME = "ostadh-lahooni-v29-exact-class-assignment";', sw_text, count=1)
if count != 1:
    raise SystemExit("service worker cache name not found")
sw.write_text(sw_text, encoding="utf-8")

print("v29 exact class assignment fix applied")
