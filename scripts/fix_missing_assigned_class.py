from pathlib import Path
import re

# 1) Normalize legacy and current teacher assignment shapes.
assignments_path = Path("lib/teacher-assignments.ts")
text = assignments_path.read_text(encoding="utf-8")
import_anchor = 'import { getSubjectConfig } from "./subject-config";\n'
school_import = 'import { arabicNumber, gradeLabel, gradeNumber, normalizeArabic, sectionNumber } from "./school-roster";\n'
if school_import not in text:
    if import_anchor not in text:
        raise SystemExit("teacher assignments import anchor not found")
    text = text.replace(import_anchor, import_anchor + school_import, 1)

start = text.find("export function normalizeAssignments(")
if start == -1:
    raise SystemExit("normalizeAssignments function not found")

replacement = r'''export function normalizeAssignments(value: unknown, fallbackSubjectIds: unknown = []): TeacherAssignment[] {
  const normalized: TeacherAssignment[] = [];

  const append = (raw: unknown) => {
    if (!raw || typeof raw !== "object") return;
    const row = raw as Partial<TeacherAssignment> & {
      subjectKey?: unknown;
      workspaceKey?: unknown;
      className?: unknown;
      class?: unknown;
      sections?: unknown;
    };

    let fromId: TeacherAssignment | null = null;
    if (row.id) {
      try { fromId = assignmentFromId(String(row.id)); }
      catch { fromId = null; }
    }

    const subjectId = String(row.subjectId || row.subjectKey || fromId?.subjectId || row.workspaceKey || "")
      .trim()
      .split("--")[0];
    const className = String(row.className || row.class || "").trim();
    const rawGrade = String(row.grade || fromId?.grade || className || "").trim();
    const parsedGrade = gradeNumber(rawGrade || className);
    const grade = parsedGrade ? gradeLabel(parsedGrade) : rawGrade;

    const sectionSource = String(row.section || fromId?.section || "").trim();
    const normalizedSection = normalizeArabic(sectionSource);
    const allSections = ["الكل", "كل", "جميع الفصول"].includes(normalizedSection);
    const parsedSection = sectionNumber(sectionSource, className);
    const section = allSections ? "الكل" : parsedSection ? arabicNumber(parsedSection) : sectionSource;

    if (!subjectId || !grade || !section) return;
    normalized.push(assignmentFromId(assignmentId(subjectId, grade, section)));
  };

  if (Array.isArray(value)) {
    value.forEach(item => {
      if (item && typeof item === "object" && Array.isArray((item as { sections?: unknown }).sections)) {
        const row = item as Record<string, unknown>;
        (row.sections as unknown[]).forEach(section => append({ ...row, section }));
      } else {
        append(item);
      }
    });
  }

  if (normalized.length) return [...new Map(normalized.map(item => [item.id, item])).values()];

  return Array.isArray(fallbackSubjectIds)
    ? [...new Set(fallbackSubjectIds.map(item => String(item || "").trim().split("--")[0]).filter(Boolean))]
        .map(assignmentFromId)
    : [];
}
'''
text = text[:start] + replacement
assignments_path.write_text(text, encoding="utf-8")

# 2) Make explicit admin class assignments authoritative in the teacher roster/attendance API.
route_path = Path("app/api/teacher/students/route.ts")
route = route_path.read_text(encoding="utf-8")

route = route.replace(
    "  gradeNumber,\n  normalizeClassRecord,",
    "  gradeNumber,\n  normalizeArabic,\n  normalizeClassRecord,",
    1,
)
route = route.replace(
    "  normalizeStudentRecord,\n  studentIdentity,",
    "  normalizeStudentRecord,\n  sectionNumber,\n  studentIdentity,",
    1,
)
route = route.replace(
    "  assignmentScopeSignature,\n  normalizeClassIds,",
    "  assignmentAllowsClassExact,\n  assignmentScopeSignature,\n  defaultSelectedClassIds,\n  normalizeClassIds,",
    1,
)

assignment_class_anchor = '''    centralAllRows.forEach(student => availableMap.set(classId(student.grade, student.section), classFromStudent(student)));
    legacyRows.forEach(item => availableMap.set(classId(item.student.grade, item.student.section), classFromStudent(item.student)));

    const allStageClasses = [...availableMap.values()]
'''
assignment_class_replacement = '''    centralAllRows.forEach(student => availableMap.set(classId(student.grade, student.section), classFromStudent(student)));
    legacyRows.forEach(item => availableMap.set(classId(item.student.grade, item.student.section), classFromStudent(item.student)));

    const exactAssignmentClassIds = new Set<string>();
    relevant.forEach(assignment => {
      const normalizedSection = normalizeArabic(assignment.section);
      if (!normalizedSection || ["الكل", "كل", "جميع الفصول"].includes(normalizedSection)) return;
      const assignedGrade = gradeNumber(assignment.grade);
      const assignedSection = sectionNumber(assignment.section);
      if (!assignedGrade || !assignedSection || (requestedGrade && assignedGrade !== requestedGrade)) return;
      const assignedClassId = classId(assignedGrade, assignedSection);
      exactAssignmentClassIds.add(assignedClassId);
      if (!availableMap.has(assignedClassId)) {
        availableMap.set(assignedClassId, {
          id: assignedClassId,
          grade: assignedGrade,
          section: assignedSection,
          name: canonicalClassName(assignedGrade, assignedSection),
          active: true,
        });
      }
    });

    const allStageClasses = [...availableMap.values()]
'''
if assignment_class_anchor not in route:
    raise SystemExit("available class anchor not found")
route = route.replace(assignment_class_anchor, assignment_class_replacement, 1)

owner_anchor = '''    const ownerByClass = new Map<string, string>();
    ownerSnapshot.docs.forEach(item => {
      const data = item.data() as Record<string, unknown>;
      const ownedClassId = String(data.classId || "");
      const teacherId = String(data.teacherId || "");
      if (ownedClassId && teacherId) ownerByClass.set(ownedClassId, teacherId);
    });
    const classIsClaimable = (id: string) => {
      const owner = ownerByClass.get(id);
      return !owner || owner === session.userId;
    };
'''
owner_replacement = '''    const rawOwnerRows = ownerSnapshot.docs.map(item => {
      const data = item.data() as Record<string, unknown>;
      return {
        documentId: item.id,
        ownedClassId: String(data.classId || ""),
        teacherId: String(data.teacherId || ""),
      };
    }).filter(item => !!item.ownedClassId && !!item.teacherId);

    const ownerTeacherIds = [...new Set(rawOwnerRows.map(item => item.teacherId).filter(id => id !== session.userId))];
    const ownerTeacherRecords = new Map<string, Record<string, unknown>>();
    await Promise.all(ownerTeacherIds.map(async teacherId => {
      const snapshot = await database.collection("portalV2Users").doc(teacherId).get();
      if (snapshot.exists) ownerTeacherRecords.set(teacherId, snapshot.data() as Record<string, unknown>);
    }));

    const ownerByClass = new Map<string, string>();
    const invalidOwnerDocumentIds = new Set<string>();
    rawOwnerRows.forEach(row => {
      if (row.teacherId === session.userId) {
        ownerByClass.set(row.ownedClassId, row.teacherId);
        return;
      }

      const schoolClass = availableMap.get(row.ownedClassId);
      const ownerUser = ownerTeacherRecords.get(row.teacherId);
      const ownerAssignments = ownerUser
        ? normalizeAssignments(ownerUser.assignments, ownerUser.subjectIds)
        : [];
      const ownerStillAssigned = Boolean(
        ownerUser
        && ownerUser.active !== false
        && schoolClass
        && ownerAssignments.some(assignment =>
          assignment.subjectId === subjectId
          && assignmentAllowsClassExact(assignment, schoolClass.grade, schoolClass.section),
        ),
      );

      if (!ownerStillAssigned) {
        invalidOwnerDocumentIds.add(row.documentId);
        return;
      }

      if (exactAssignmentClassIds.has(row.ownedClassId)) return;
      ownerByClass.set(row.ownedClassId, row.teacherId);
    });

    const classIsClaimable = (id: string) => {
      if (exactAssignmentClassIds.has(id)) return true;
      const owner = ownerByClass.get(id);
      return !owner || owner === session.userId;
    };
'''
if owner_anchor not in route:
    raise SystemExit("owner anchor not found")
route = route.replace(owner_anchor, owner_replacement, 1)

selection_anchor = '''    const scopeCustomized = savedScopeValid || canMigrateLegacySelection;
    const claimableClasses = allStageClasses.filter(item => classIsClaimable(item.id));
    const selectedClassIds = savedScopeValid
      ? storedSelection
      : canMigrateLegacySelection
        ? legacySelection
        : claimableClasses.map(item => item.id);
    const selected = new Set(selectedClassIds);
'''
selection_replacement = '''    const scopeCustomized = savedScopeValid || canMigrateLegacySelection;
    const claimableClasses = allStageClasses.filter(item => classIsClaimable(item.id));
    const defaultSelection = defaultSelectedClassIds(relevant, subjectId, claimableClasses, requestedGrade);
    const baseSelection = savedScopeValid
      ? storedSelection
      : canMigrateLegacySelection
        ? legacySelection
        : defaultSelection;
    const selectedClassIds = [...new Set([...baseSelection, ...exactAssignmentClassIds])]
      .filter(id => availableMap.has(id) && classIsClaimable(id));
    const selected = new Set(selectedClassIds);
'''
if selection_anchor not in route:
    raise SystemExit("selection anchor not found")
route = route.replace(selection_anchor, selection_replacement, 1)

now_anchor = '''    const repairs: Repair[] = [];
    const existingIds = new Set(legacySnapshot.docs.map(item => item.id));
    const legacyIdentities = new Set(selectedLegacyRows.map(item => studentIdentity(item.student)));
    const now = new Date().toISOString();

    selectedLegacyRows.forEach(item => {
'''
now_replacement = '''    const repairs: Repair[] = [];
    const existingIds = new Set(legacySnapshot.docs.map(item => item.id));
    const legacyIdentities = new Set(selectedLegacyRows.map(item => studentIdentity(item.student)));
    const now = new Date().toISOString();

    exactAssignmentClassIds.forEach(selectedClassId => {
      repairs.push({
        path: `${SUBJECT_CLASS_OWNERS_COLLECTION}/${subjectClassOwnerId(subjectId, selectedClassId)}`,
        data: {
          teacherId: session.userId,
          subjectId,
          classId: selectedClassId,
          grade: classGradeFromId(selectedClassId),
          active: true,
          assignmentOwned: true,
          updatedAt: now,
        },
      });
    });

    selectedLegacyRows.forEach(item => {
'''
if now_anchor not in route:
    raise SystemExit("repairs anchor not found")
route = route.replace(now_anchor, now_replacement, 1)

route = route.replace(
    '''      selectedClassIds.forEach(selectedClassId => {
        if (ownerByClass.get(selectedClassId)) return;
''',
    '''      selectedClassIds.forEach(selectedClassId => {
        if (exactAssignmentClassIds.has(selectedClassId)) return;
        if (ownerByClass.get(selectedClassId)) return;
''',
    1,
)

apply_anchor = '''    try {
      if (repairs.length) await applyRepairs(repairs);
    } catch (repairError) {
      console.warn("teacher roster repair deferred", repairError);
    }

    const classes = allStageClasses.filter(item => selected.has(item.id));
'''
apply_replacement = '''    try {
      if (repairs.length) await applyRepairs(repairs);
    } catch (repairError) {
      console.warn("teacher roster repair deferred", repairError);
    }

    try {
      if (invalidOwnerDocumentIds.size) {
        const cleanupBatch = database.batch();
        invalidOwnerDocumentIds.forEach(documentId => {
          cleanupBatch.delete(database.collection(SUBJECT_CLASS_OWNERS_COLLECTION).doc(documentId));
        });
        await cleanupBatch.commit();
      }
    } catch (cleanupError) {
      console.warn("stale class owner cleanup deferred", cleanupError);
    }

    const classes = allStageClasses.filter(item => selected.has(item.id));
'''
if apply_anchor not in route:
    raise SystemExit("apply repairs anchor not found")
route = route.replace(apply_anchor, apply_replacement, 1)

response_anchor = '''      classReadCount: centralClassSnapshot.docs.length,
      preservedTeacherData: true,
'''
response_replacement = '''      classReadCount: centralClassSnapshot.docs.length,
      exactAssignedClasses: exactAssignmentClassIds.size,
      staleOwnersIgnored: invalidOwnerDocumentIds.size,
      preservedTeacherData: true,
'''
if response_anchor not in route:
    raise SystemExit("response diagnostics anchor not found")
route = route.replace(response_anchor, response_replacement, 1)

route_path.write_text(route, encoding="utf-8")

# 3) Force installed web/app shells to refresh the fixed source.
sw_path = Path("public/sw.js")
sw = sw_path.read_text(encoding="utf-8")
sw = re.sub(
    r'const CACHE_NAME = "[^"]+";',
    'const CACHE_NAME = "ostadh-lahooni-v26-assigned-class";',
    sw,
    count=1,
)
sw_path.write_text(sw, encoding="utf-8")
