from pathlib import Path

PAGE = Path('app/teacher/attendance/page.tsx')
SW = Path('public/sw.js')
text = PAGE.read_text(encoding='utf-8')

old_map = '''        const list = (Array.isArray(data.students) ? data.students : []).map((student: Record<string, unknown>) => {
          const code = String(student.code || student.accessCode || student.studentCode || student.id || "").trim().toUpperCase();
          const className = canonicalClassFromParts(
            student.grade,
            student.section,
            student.className || student.class,
          );
          return {
            ...student,
            id: code,
            code,
            accessCode: code,
            studentCode: code,
            class: className,
            className,
            active: student.active !== false,
            rosterActive: student.active !== false,
          } as UnifiedStudent;
        }).filter((student: UnifiedStudent) => !!student.id && !!student.name && !!student.class);'''

new_map = '''        // استخدم نفس قائمة وطريقة صفحة رصد الدرجات حتى لا يختلف عدد طلاب الفصل بين الصفحتين.
        const list = (Array.isArray(data.students) ? data.students : []).map((student: Record<string, unknown>) => {
          const code = String(student.code || student.id || student.accessCode || student.studentCode || "").trim().toUpperCase();
          const className = String(student.className || student.class || "").trim();
          return {
            ...student,
            id: code,
            code,
            accessCode: code,
            studentCode: code,
            name: String(student.name || "").trim(),
            class: className,
            className,
            active: student.active !== false,
            rosterActive: student.active !== false,
          } as UnifiedStudent;
        }).filter((student: UnifiedStudent) => !!student.id && !!student.name && !!student.class);
        list.sort((a, b) => clean(a.class).localeCompare(clean(b.class), "ar", { numeric: true }) || clean(a.name).localeCompare(clean(b.name), "ar"));'''

if old_map not in text:
    raise SystemExit('official student mapping anchor not found')
text = text.replace(old_map, new_map, 1)

old_class_students = '''  const classStudents = useMemo(
    () => students.filter(student => (normalizeClass(student.class) || clean(student.class)) === selectedClass),
    [students, selectedClass],
  );'''
new_class_students = '''  const classStudents = useMemo(
    () => students.filter(student => clean(student.class) === clean(selectedClass)),
    [students, selectedClass],
  );'''
if old_class_students not in text:
    raise SystemExit('classStudents anchor not found')
text = text.replace(old_class_students, new_class_students, 1)

# Make the PDF message explicitly prove how many rows are being sent to the generator.
text = text.replace('setMessage(`جارٍ إنشاء PDF كامل لـ ${rows.length} طالبًا...`);', 'setMessage(`جارٍ إنشاء PDF التحضير من القائمة الكاملة: ${rows.length} طالبًا...`);', 1)
text = text.replace('setMessage(`تم تنزيل التحضير كاملًا: ${rows.length} طالبًا في ${canvases.length} صفحة واضحة.`);', 'setMessage(`تم تنزيل التحضير كاملًا: ${rows.length} من ${classStudents.length} طالبًا في ${canvases.length} صفحة.`);', 1)

PAGE.write_text(text, encoding='utf-8')

sw = SW.read_text(encoding='utf-8')
import re
sw = re.sub(r'const CACHE_NAME = "[^"]+";', 'const CACHE_NAME = "ostadh-lahooni-v84-attendance-roster-pdf";', sw, count=1)
SW.write_text(sw, encoding='utf-8')

print('fixed attendance roster source to match grades and bumped cache')
