from pathlib import Path
import re

root = Path(__file__).resolve().parents[2]

def read(path: str) -> str:
    return (root / path).read_text(encoding="utf-8")

def write(path: str, text: str) -> None:
    (root / path).write_text(text, encoding="utf-8")

def must_replace(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"anchor missing: {label}")
    return text.replace(old, new, 1)

# Student / parent lookup should receive the approved teacher-level grade plan
# immediately, before the periodic profile refresh runs.
path = "app/api/student/lookup/route.ts"
text = read(path)
anchor = '''    if (!chosenBySubject.size) {\n      return NextResponse.json({ ok: false, message: "لم تُربط مواد هذا الصف بالمعلمين بعد." }, { status: 401 });\n    }\n\n    const repairWrites: Array<{ path: string; data: Record<string, unknown> }> = [];'''
replacement = '''    if (!chosenBySubject.size) {\n      return NextResponse.json({ ok: false, message: "لم تُربط مواد هذا الصف بالمعلمين بعد." }, { status: 401 });\n    }\n\n    const gradePlanByTeacher = new Map<string, Record<string, unknown> | null>();\n    await Promise.all([...new Set([...chosenBySubject.values()].map(candidate => candidate.teacherId))].map(async teacherId => {\n      try {\n        const config = await adminDb().collection(`portalV2Data/${teacherId}/gradePlanConfig`).doc("current").get();\n        const activePlanId = config.exists ? String(config.data()?.activePlanId || "") : "";\n        if (!activePlanId) {\n          gradePlanByTeacher.set(teacherId, null);\n          return;\n        }\n        const plan = await adminDb().collection(`portalV2Data/${teacherId}/gradePlanVersions`).doc(activePlanId).get();\n        gradePlanByTeacher.set(teacherId, plan.exists ? { id: plan.id, ...plan.data() } : null);\n      } catch (gradePlanError) {\n        console.warn("student approved grade plan lookup deferred", gradePlanError);\n        gradePlanByTeacher.set(teacherId, null);\n      }\n    }));\n\n    const repairWrites: Array<{ path: string; data: Record<string, unknown> }> = [];'''
text = must_replace(text, anchor, replacement, "student lookup grade plan preload")
anchor = '''        data: {\n          ...item.data,\n          absences: 0,'''
replacement = '''        data: {\n          ...item.data,\n          gradePlan: gradePlanByTeacher.get(item.teacherId) || null,\n          absences: 0,'''
text = must_replace(text, anchor, replacement, "student lookup grade plan response")
write(path, text)

# Force installed PWA shells to discover the new grade-distribution navigation.
path = "app/pwa-register.tsx"
text = read(path)
text = re.sub(r'const CURRENT_CACHE = "[^"]+";', 'const CURRENT_CACHE = "ostadh-lahooni-v90-grade-distribution";', text, count=1)
text = re.sub(r'const RELOAD_KEY = "[^"]+";', 'const RELOAD_KEY = "ostadh-lahooni-v90-grade-distribution-reloaded";', text, count=1)
text = re.sub(r'navigator\.serviceWorker\.register\("/sw\.js\?v=[^"]+"', 'navigator.serviceWorker.register("/sw.js?v=90-grade-distribution"', text, count=1)
write(path, text)

path = "public/sw.js"
text = read(path)
text = re.sub(r'const CACHE_NAME = "[^"]+";', 'const CACHE_NAME = "ostadh-lahooni-v90-grade-distribution";', text, count=1)
write(path, text)

print("teacher grade distribution v90 finalization applied")
