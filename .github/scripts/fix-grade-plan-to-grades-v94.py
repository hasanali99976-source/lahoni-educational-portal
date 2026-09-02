from pathlib import Path

PLAN = Path('app/teacher/grade-plan/page.tsx')
GRADES = Path('app/teacher/grades/page.tsx')
GRADES_CSS = Path('app/teacher/grades/dynamic-gradebook.css')
LAYOUT = Path('app/teacher/layout.tsx')
PWA = Path('app/pwa-register.tsx')
SW = Path('public/sw.js')

plan = PLAN.read_text(encoding='utf-8')
grades = GRADES.read_text(encoding='utf-8')
css = GRADES_CSS.read_text(encoding='utf-8')
layout = LAYOUT.read_text(encoding='utf-8')

# 1) After approving, go straight to the gradebook.
plan = plan.replace(
    'window.location.replace("/teacher/grade-plan?view=approved");',
    'window.location.replace("/teacher/grades");',
    1,
)

# 2) When grade-plan is opened from the tiny edit icon, clone the active plan into a new editable draft.
old_import = 'import { useMemo, useState } from "react";'
new_import = 'import { useEffect, useMemo, useState } from "react";'
if old_import in plan:
    plan = plan.replace(old_import, new_import, 1)

anchor = '  const overall = useMemo(() => draft.mode === "periods" ? draft.sections.map(section => total(section.items)) : [roundGrade(draft.sections.reduce((sum, section) => sum + Number(section.max || 0), 0))], [draft]);\n'
insert = anchor + '''\n  useEffect(() => {\n    if (loading || !activePlan || typeof window === "undefined") return;\n    const editRequested = new URLSearchParams(window.location.search).get("edit") === "1";\n    if (!editRequested) return;\n    setBuilding(true);\n    setMode(activePlan.mode);\n    setMethod(activePlan.method);\n    setUnitCount(activePlan.mode === "units" ? activePlan.sections.length : 5);\n    setDraft({\n      mode: activePlan.mode,\n      method: activePlan.method,\n      sections: activePlan.sections.map(section => ({\n        ...section,\n        items: section.items.map(item => ({ ...item })),\n      })),\n    });\n    setMessage("أنت تعدّل نسخة جديدة مبنية على الخطة المعتمدة الحالية. لن تتأثر النسخة السابقة إلا بعد اعتماد النسخة الجديدة.");\n  }, [loading, activePlan?.id]);\n'''
if 'new URLSearchParams(window.location.search).get("edit") === "1"' not in plan:
    if anchor not in plan:
        raise SystemExit('grade plan effect anchor not found')
    plan = plan.replace(anchor, insert, 1)

# 3) Replace the large approved-plan link in gradebook with a tiny edit icon.
old_link = '<Link className="research-link" href="/teacher/grade-plan">🔒 خطة التقييم المعتمدة</Link>'
new_link = '<Link className="grade-plan-edit-icon" href="/teacher/grade-plan?edit=1" title="تعديل خطة توزيع الدرجات" aria-label="تعديل خطة توزيع الدرجات">✎</Link>'
if old_link not in grades:
    raise SystemExit('large grade plan link not found in grades page')
grades = grades.replace(old_link, new_link, 1)

# 4) Add compact icon styling.
icon_css = '.grade-plan-edit-icon{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;padding:0;border:1px solid #c9dce1;border-radius:10px;background:#f5fafb;color:#174d59;text-decoration:none;font-size:18px;font-weight:900;line-height:1;box-shadow:0 4px 12px rgba(18,64,75,.06)}.grade-plan-edit-icon:hover{background:#e8f4f6;border-color:#a9c9d1}.grade-plan-edit-icon:focus-visible{outline:3px solid rgba(23,77,89,.18);outline-offset:2px}'
if '.grade-plan-edit-icon{' not in css:
    css += '\n' + icon_css + '\n'

# 5) Remove the separate "توزيع الدرجات" item from the more menu; editing is now only via the small icon inside grades.
layout = layout.replace('  { href: "/teacher/grade-plan", key: "gradeplan", label: "توزيع الدرجات", note: "إعداد واعتماد الـ100 درجة" },\n', '', 1)

PLAN.write_text(plan, encoding='utf-8')
GRADES.write_text(grades, encoding='utf-8')
GRADES_CSS.write_text(css, encoding='utf-8')
LAYOUT.write_text(layout, encoding='utf-8')

# 6) Force PWA refresh.
for path in (PWA, SW):
    text = path.read_text(encoding='utf-8')
    text = text.replace('ostadh-lahooni-v93-grade-plan-approved-redirect', 'ostadh-lahooni-v94-grade-plan-to-grades')
    text = text.replace('v=93-grade-plan-approved-redirect', 'v=94-grade-plan-to-grades')
    path.write_text(text, encoding='utf-8')

print('approval redirects to grades; tiny edit icon added; grade-plan menu item removed; cache v94')
