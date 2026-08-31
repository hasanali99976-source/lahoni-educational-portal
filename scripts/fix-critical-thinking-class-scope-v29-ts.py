from pathlib import Path

path = Path("app/api/teacher/class-options/route.ts")
text = path.read_text(encoding="utf-8")
old = '      if (assignedGrade === grade && assignedSection) exactAssignmentClassIds.add(classId(assignedGrade, assignedSection));'
new = '      if (grade && assignedGrade === grade && assignedSection) exactAssignmentClassIds.add(classId(grade, assignedSection));'
if old not in text:
    raise SystemExit("TypeScript narrowing target not found")
path.write_text(text.replace(old, new, 1), encoding="utf-8")
print("v29 TypeScript narrowing fix applied")
