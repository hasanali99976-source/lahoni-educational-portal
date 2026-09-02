from pathlib import Path

root = Path(__file__).resolve().parents[2]
path = root / "app/teacher/evaluation-plans/page.tsx"
text = path.read_text(encoding="utf-8")
old = '''  const evaluationType = Object.prototype.hasOwnProperty.call(TYPE_LABELS, source.evaluationType) ? source.evaluationType as EvaluationType : "formative";\n  const status = Object.prototype.hasOwnProperty.call(STATUS_LABELS, source.status) ? source.status as PlanStatus : "planned";'''
new = '''  const evaluationTypeKey = String(source.evaluationType || "");\n  const statusKey = String(source.status || "");\n  const evaluationType = Object.prototype.hasOwnProperty.call(TYPE_LABELS, evaluationTypeKey) ? evaluationTypeKey as EvaluationType : "formative";\n  const status = Object.prototype.hasOwnProperty.call(STATUS_LABELS, statusKey) ? statusKey as PlanStatus : "planned";'''
if old not in text:
    raise SystemExit("v86 evaluation type normalization target not found")
path.write_text(text.replace(old, new, 1), encoding="utf-8")
print("v86 evaluation enum typing fixed")
