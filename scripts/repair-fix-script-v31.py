from pathlib import Path

path = Path(__file__).with_name("fix-teacher-stage-classes-v31.py")
text = path.read_text(encoding="utf-8")
old = '''students = replace_once(
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
'''
new = '''selection_filter = "      .filter(id => availableMap.has(id) && grades.has(classGradeFromId(id) as Grade) && classIsClaimable(id));"
selection_filter_replacement = "      .filter(id => availableMap.has(id) && grades.has(classGradeFromId(id) as Grade));"
if students.count(selection_filter) != 2:
    raise RuntimeError(f"students selection filters: expected two matches, found {students.count(selection_filter)}")
students = students.replace(selection_filter, selection_filter_replacement)
'''
if old not in text:
    raise RuntimeError("Could not locate duplicate selection replacement block")
text = text.replace(old, new, 1)
old_delete = "        batch.delete(document.ref);"
new_delete = "        batch.delete(database.collection(SUBJECT_CLASS_OWNERS_COLLECTION).doc(document.id));"
if text.count(old_delete) != 1:
    raise RuntimeError(f"Could not locate legacy owner delete line: {text.count(old_delete)}")
text = text.replace(old_delete, new_delete, 1)
path.write_text(text, encoding="utf-8")
print("Repaired v31 fix script")
