from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if text.count(old) != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {text.count(old)}")
    return text.replace(old, new, 1)


write("app/api/teacher/class-options/route.ts", '''import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { findUserById, requireSession } from "../../../../lib/server/portal-auth";
import { normalizeAssignments } from "../../../../lib/teacher-assignments";
import {
  SCHOOL_CLASSES_COLLECTION,
  SCHOOL_STUDENTS_COLLECTION,
  classId,
  gradeNumber,
  normalizeClassRecord,
  normalizeStudentRecord,
  type SchoolClass,
  type SchoolStudent,
} from "../../../../lib/school-roster";
import {
  TEACHER_CLASS_SCOPES_COLLECTION,
  normalizeClassIds,
  teacherClassScopeId,
} from "../../../../lib/teacher-class-scope";

type Grade = 1 | 2 | 3;

function parseGrade(value: unknown): Grade | null {
  const number = Number(value || 0);
  return number === 1 || number === 2 || number === 3 ? number as Grade : null;
}

function classFromStudent(student: SchoolStudent): SchoolClass {
  return {
    id: classId(student.grade, student.section),
    grade: student.grade,
    section: student.section,
    name: student.className,
    active: true,
  };
}

export async function GET(request: Request) {
  const session = await requireSession("teacher");
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const user = await findUserById(session.userId);
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });

    const url = new URL(request.url);
    const subjectId = String(url.searchParams.get("subjectId") || "").split("--")[0].trim();
    const grade = parseGrade(url.searchParams.get("grade"));
    const assignments = normalizeAssignments(user.assignments, user.subjectIds);
    const relevant = assignments.filter(item => item.subjectId === subjectId && (!grade || gradeNumber(item.grade) === grade));
    const assignmentGrades = new Set<Grade>(
      relevant.map(item => gradeNumber(item.grade)).filter((item): item is Grade => !!item),
    );

    if (!subjectId || !grade || !assignmentGrades.has(grade)) {
      return NextResponse.json({ ok: false, message: "المادة أو المرحلة غير مرتبطة بحسابك." }, { status: 400 });
    }

    const database = adminDb();
    const scopeRef = database.collection(TEACHER_CLASS_SCOPES_COLLECTION)
      .doc(teacherClassScopeId(session.userId, subjectId, grade));
    const [classSnapshot, studentSnapshot, scopeSnapshot] = await Promise.all([
      database.collection(SCHOOL_CLASSES_COLLECTION).get(),
      database.collection(SCHOOL_STUDENTS_COLLECTION).get(),
      scopeRef.get(),
    ]);

    const classMap = new Map<string, SchoolClass>();
    classSnapshot.docs.forEach(document => {
      const normalized = normalizeClassRecord({ id: document.id, ...(document.data() as Record<string, unknown>) } as Partial<SchoolClass>);
      if (!normalized || normalized.active === false || normalized.grade !== grade) return;
      classMap.set(normalized.id, normalized);
    });
    studentSnapshot.docs.forEach(document => {
      const student = normalizeStudentRecord(document.data() as Record<string, unknown>, document.id);
      if (!student || student.active === false || student.grade !== grade) return;
      classMap.set(classId(student.grade, student.section), classFromStudent(student));
    });

    const availableClasses = [...classMap.values()]
      .filter(item => /^\\d+-\\d+$/.test(item.id))
      .sort((a, b) => Number(a.section) - Number(b.section));
    const availableIds = new Set(availableClasses.map(item => item.id));
    const selectedClassIds = scopeSnapshot.exists
      ? normalizeClassIds(scopeSnapshot.data()?.selectedClassIds).filter(item => availableIds.has(item))
      : [];

    return NextResponse.json({
      ok: true,
      subjectId,
      grade,
      availableClasses,
      selectedClassIds,
      hiddenOwnedByOtherTeachers: 0,
      totalClasses: availableClasses.length,
      manualClassSelection: true,
      officialAdminRoster: true,
      persistedInDatabase: scopeSnapshot.exists,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("teacher class options failed", error);
    return NextResponse.json({ ok: false, message: "تعذر تحميل فصول المرحلة الآن." }, { status: 500 });
  }
}
''')

write("app/api/teacher/class-scope/route.ts", '''import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { requireSession } from "../../../../lib/server/portal-auth";
import { normalizeAssignments } from "../../../../lib/teacher-assignments";
import {
  SCHOOL_CLASSES_COLLECTION,
  SCHOOL_STUDENTS_COLLECTION,
  classId,
  gradeNumber,
  normalizeClassRecord,
  normalizeStudentRecord,
  type SchoolClass,
} from "../../../../lib/school-roster";
import {
  SUBJECT_CLASS_OWNERS_COLLECTION,
  TEACHER_CLASS_SCOPES_COLLECTION,
  assignmentScopeSignature,
  normalizeClassIds,
  teacherClassScopeId,
} from "../../../../lib/teacher-class-scope";

type Grade = 1 | 2 | 3;

function classParts(value: string): { grade: Grade | null; section: string } {
  const [gradeText, section = ""] = value.split("-");
  const number = Number(gradeText);
  const grade: Grade | null = number === 1 || number === 2 || number === 3 ? number as Grade : null;
  return { grade, section };
}

function parseGrade(value: unknown): Grade | null {
  const number = Number(value || 0);
  return number === 1 || number === 2 || number === 3 ? number as Grade : null;
}

export async function PATCH(request: Request) {
  const session = await requireSession("teacher");
  if (!session?.user) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const user = session.user;
    const body = await request.json();
    const subjectId = String(body?.subjectId || "").split("--")[0].trim();
    const activeGrade = parseGrade(body?.grade);
    const selectedClassIds = normalizeClassIds(body?.selectedClassIds);
    const assignments = normalizeAssignments(user.assignments, user.subjectIds);
    const relevant = assignments.filter(item =>
      item.subjectId === subjectId && (!activeGrade || gradeNumber(item.grade) === activeGrade),
    );

    if (!subjectId || !activeGrade || !relevant.length) {
      return NextResponse.json({ ok: false, message: "المادة أو المرحلة غير مرتبطة بحسابك." }, { status: 400 });
    }

    const database = adminDb();
    const [classSnapshot, studentSnapshot] = await Promise.all([
      database.collection(SCHOOL_CLASSES_COLLECTION).get(),
      database.collection(SCHOOL_STUDENTS_COLLECTION).get(),
    ]);
    const officialClassIds = new Set<string>();
    classSnapshot.docs.forEach(document => {
      const schoolClass = normalizeClassRecord({
        id: document.id,
        ...(document.data() as Record<string, unknown>),
      } as Partial<SchoolClass>);
      if (schoolClass && schoolClass.active !== false && schoolClass.grade === activeGrade) {
        officialClassIds.add(schoolClass.id);
      }
    });
    studentSnapshot.docs.forEach(document => {
      const student = normalizeStudentRecord(document.data() as Record<string, unknown>, document.id);
      if (student && student.active !== false && student.grade === activeGrade) {
        officialClassIds.add(classId(student.grade, student.section));
      }
    });

    const invalid = selectedClassIds.filter(value => {
      const { grade } = classParts(value);
      return grade !== activeGrade || !officialClassIds.has(value);
    });
    if (invalid.length) {
      return NextResponse.json({
        ok: false,
        message: "أحد الفصول لم يعد موجودًا في سجل الإدارة. حدّث القائمة ثم أعد الحفظ.",
        invalidClassIds: invalid,
      }, { status: 400 });
    }

    const now = new Date().toISOString();
    const scopeRef = database.collection(TEACHER_CLASS_SCOPES_COLLECTION)
      .doc(teacherClassScopeId(session.userId, subjectId, activeGrade));
    await scopeRef.set({
      teacherId: session.userId,
      subjectId,
      grade: activeGrade,
      selectedClassIds,
      customized: true,
      assignmentSignature: assignmentScopeSignature(assignments, subjectId, activeGrade),
      officialAdminRoster: true,
      updatedAt: now,
    }, { merge: true });

    // إزالة حجوزات النسخ القديمة لهذا المعلم؛ الاختيار أصبح نطاقًا خاصًا بكل معلم
    // ولا يُسمح له بإخفاء الفصل عن معلم آخر في المرحلة نفسها.
    try {
      const legacyOwners = await database.collection(SUBJECT_CLASS_OWNERS_COLLECTION)
        .where("teacherId", "==", session.userId)
        .get();
      const batch = database.batch();
      let cleanupCount = 0;
      legacyOwners.docs.forEach(document => {
        const data = document.data() as Record<string, unknown>;
        const ownedGrade = classParts(String(data.classId || "")).grade;
        if (String(data.subjectId || "") !== subjectId || ownedGrade !== activeGrade) return;
        batch.delete(document.ref);
        cleanupCount += 1;
      });
      if (cleanupCount) await batch.commit();
    } catch (cleanupError) {
      console.warn("legacy class ownership cleanup deferred", cleanupError);
    }

    return NextResponse.json({
      ok: true,
      subjectId,
      activeGrade,
      selectedClassIds,
      selectedCount: selectedClassIds.length,
      preservedOtherGrades: true,
      preservedData: true,
      persistedInDatabase: true,
      manualClassSelection: true,
      officialAdminRoster: true,
    });
  } catch (error) {
    console.error("teacher class scope update failed", error);
    return NextResponse.json({ ok: false, message: "تعذر حفظ الفصول الآن." }, { status: 500 });
  }
}
''')

students_path = ROOT / "app/api/teacher/students/route.ts"
students = students_path.read_text(encoding="utf-8")
students = replace_once(students, "  SUBJECT_CLASS_OWNERS_COLLECTION,\n", "", "students owner import")
students = replace_once(students, "  subjectClassOwnerId,\n", "", "students owner id import")
students = replace_once(
    students,
    "    const [legacySnapshot, scopeSnapshot, legacySubjectScopeSnapshot, centralStudentSnapshot, centralClassSnapshot, ownerSnapshot] = await Promise.all([\n",
    "    const [legacySnapshot, scopeSnapshot, legacySubjectScopeSnapshot, centralStudentSnapshot, centralClassSnapshot] = await Promise.all([\n",
    "students promise variables",
)
students = replace_once(
    students,
    "      database.collection(SCHOOL_CLASSES_COLLECTION).get(),\n      database.collection(SUBJECT_CLASS_OWNERS_COLLECTION).where(\"subjectId\", \"==\", subjectId).get(),\n",
    "      database.collection(SCHOOL_CLASSES_COLLECTION).get(),\n",
    "students owner query",
)
owner_block = re.compile(
    r"\n    const rawOwnerRows = ownerSnapshot\.docs\.map\(item => \{.*?\n    const classIsClaimable = \(id: string\) => \{.*?\n    \};\n",
    re.S,
)
students, count = owner_block.subn("\n", students, count=1)
if count != 1:
    raise RuntimeError(f"students owner block: expected one match, found {count}")
students = replace_once(
    students,
    "      .filter(id => availableMap.has(id) && grades.has(classGradeFromId(id) as Grade) && classIsClaimable(id));",
    "      .filter(id => availableMap.has(id) && grades.has(classGradeFromId(id) as Grade));",
    "students stored selection",
)
students = replace_once(
    students,
    "      .filter(id => availableMap.has(id) && grades.has(classGradeFromId(id) as Grade) && classIsClaimable(id));",
    "      .filter(id => availableMap.has(id) && grades.has(classGradeFromId(id) as Grade));",
    "students legacy selection",
)
students = replace_once(
    students,
    "    const claimableClasses = allStageClasses.filter(item => classIsClaimable(item.id));\n",
    "    const claimableClasses = allStageClasses;\n",
    "students all stage classes",
)
students = replace_once(
    students,
    "    const selectedClassIds = [...new Set(baseSelection)]\n      .filter(id => availableMap.has(id) && classIsClaimable(id));\n",
    "    const selectedClassIds = [...new Set(baseSelection)]\n      .filter(id => availableMap.has(id) && grades.has(classGradeFromId(id) as Grade));\n",
    "students selected scope",
)
repair_owner_block = re.compile(
    r"\n    if \(scopeCustomized\) \{\n      selectedClassIds\.forEach\(selectedClassId => \{.*?\n    \}\n\n    if \(canMigrateLegacySelection\)",
    re.S,
)
students, count = repair_owner_block.subn("\n    if (canMigrateLegacySelection)", students, count=1)
if count != 1:
    raise RuntimeError(f"students owner repair block: expected one match, found {count}")
cleanup_owner_block = re.compile(
    r"\n    try \{\n      if \(invalidOwnerDocumentIds\.size\) \{.*?\n    \} catch \(cleanupError\) \{\n      console\.warn\(\"stale class owner cleanup deferred\", cleanupError\);\n    \}\n",
    re.S,
)
students, count = cleanup_owner_block.subn("\n", students, count=1)
if count != 1:
    raise RuntimeError(f"students owner cleanup block: expected one match, found {count}")
students = replace_once(
    students,
    "      hiddenOwnedByOtherTeachers: Math.max(0, allStageClasses.length - claimableClasses.length),",
    "      hiddenOwnedByOtherTeachers: 0,",
    "students hidden classes count",
)
students = replace_once(
    students,
    "      staleOwnersIgnored: invalidOwnerDocumentIds.size,",
    "      staleOwnersIgnored: 0,\n      officialAdminRoster: true,",
    "students stale owner output",
)
students_path.write_text(students, encoding="utf-8")

page_path = ROOT / "app/teacher/students/page.tsx"
page = page_path.read_text(encoding="utf-8")
page = page.replace('  const [hiddenForOthers,setHiddenForOthers] = useState(0);\n', '')
page = page.replace('      setHiddenForOthers(Number(data.hiddenOwnedByOtherTeachers) || 0);\n', '')
page = page.replace('تعذر تحميل الفصول المتبقية', 'تعذر تحميل فصول المرحلة')
page = page.replace('جارٍ تحميل الفصول المتبقية…', 'جارٍ تحميل فصول المرحلة…')
page = page.replace('سبق معلم آخر وحفظ أحد هذه الفصول. تم تحديث القائمة لتظهر لك الفصول المتبقية فقط.', 'تعذر اعتماد أحد الفصول. تم تحديث القائمة من سجل الإدارة.')
page = page.replace('{hiddenForOthers ? ` يوجد ${hiddenForOthers} فصل محفوظ لمعلم آخر ومخفي عنك.` : ""}', '')
page = page.replace('"محفوظ لك أو محدد للحفظ":"متاح للحجز"', '"محفوظ لك أو محدد للحفظ":"متاح للاختيار"')
page = page.replace('لا توجد فصول متاحة لهذه المرحلة؛ جميعها محفوظة لمعلمي المادة.', 'لا توجد فصول مسجلة لهذه المرحلة في بوابة الإدارة.')
page_path.write_text(page, encoding="utf-8")

for relative in ["app/pwa-register.tsx", "public/sw.js"]:
    path = ROOT / relative
    value = path.read_text(encoding="utf-8")
    value = value.replace("v30-manual-class-selection", "v31-stage-class-roster")
    value = value.replace("30-manual-class-selection", "31-stage-class-roster")
    path.write_text(value, encoding="utf-8")

print("Applied teacher stage/class roster fix v31")
