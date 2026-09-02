from pathlib import Path


def replace_once(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"pattern not found in {path}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1), encoding="utf-8")

# Grade plan page: use teacher identity + local fallback and always leave setup after approval.
replace_once(
    "app/teacher/grade-plan/page.tsx",
    '  validateGradePlanDraft,\n',
    '  validateGradePlanDraft,\n  normalizeGradePlan,\n',
)
replace_once(
    "app/teacher/grade-plan/page.tsx",
    'import { useGradePlan } from "../../../lib/use-grade-plan";\n',
    'import { useGradePlan } from "../../../lib/use-grade-plan";\nimport { useTeacherClient } from "../../../lib/teacher-client";\nimport { createLocalGradePlan, saveLocalGradePlan } from "../../../lib/grade-plan-local";\n',
)
replace_once(
    "app/teacher/grade-plan/page.tsx",
    'export default function GradePlanPage() {\n  const { activePlan, history, loading, error } = useGradePlan(true);\n',
    'export default function GradePlanPage() {\n  const session = useTeacherClient();\n  const { activePlan, history, loading, error } = useGradePlan(true);\n',
)
old_approve = '''      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "تعذر اعتماد الخطة.");
      // الاعتماد ناجح: افتح سجل الدرجات فورًا بدون انتظار أي إعادة تحميل للخطة.
      window.location.replace("/teacher/grades");
      return;'''
new_approve = '''      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        const serverPlan = normalizeGradePlan(data.activePlan);
        if (serverPlan) saveLocalGradePlan(serverPlan);
        else if (session.teacherId) saveLocalGradePlan(createLocalGradePlan(checked.draft, session.teacherId, Number(data.version || activePlan?.version || 1)));
        window.location.replace("/teacher/grades?approved=1");
        return;
      }
      if (data.code === "grade_plan_quota_exceeded" && session.teacherId) {
        const localPlan = createLocalGradePlan(checked.draft, session.teacherId, (activePlan?.version || 0) + 1);
        saveLocalGradePlan(localPlan);
        window.location.replace("/teacher/grades?approved=local");
        return;
      }
      throw new Error(data.message || "تعذر اعتماد الخطة.");'''
replace_once("app/teacher/grade-plan/page.tsx", old_approve, new_approve)

# Layout: local plan counts as approved, so it cannot bounce back to setup when Firebase quota is exhausted.
replace_once(
    "app/teacher/layout.tsx",
    'import { getSubjectConfig, type SubjectKey } from "../../lib/subject-config";\n',
    'import { getSubjectConfig, type SubjectKey } from "../../lib/subject-config";\nimport { readLocalGradePlan, setGradePlanCurrentTeacher } from "../../lib/grade-plan-local";\n',
)
replace_once(
    "app/teacher/layout.tsx",
    '  function applySession(session: TeacherSession) {\n    const nextSubjectKey = session.subjectKey || "history";\n',
    '  function applySession(session: TeacherSession) {\n    const nextSubjectKey = session.subjectKey || "history";\n    if (session.teacherId) setGradePlanCurrentTeacher(session.teacherId);\n',
)
replace_once(
    "app/teacher/layout.tsx",
    '        const nextHasGradePlan = Boolean(planData?.activePlan || planData?.hasActivePlan);\n',
    '        const nextHasGradePlan = Boolean(planData?.activePlan || planData?.hasActivePlan || readLocalGradePlan(session.teacherId));\n',
)

# Login: respect an already-approved local fallback plan for the same teacher.
replace_once(
    "app/teacher/page.tsx",
    'import { auth } from "../../lib/firebase";\n',
    'import { auth } from "../../lib/firebase";\nimport { readLocalGradePlan, setGradePlanCurrentTeacher } from "../../lib/grade-plan-local";\n',
)
replace_once(
    "app/teacher/page.tsx",
    'if(d?.firebaseToken)await signInWithCustomToken(auth,d.firebaseToken);let destination="/teacher/dashboard";try{const p=await fetch("/api/teacher/grade-plan",{cache:"no-store",credentials:"same-origin"});const plan=await p.json().catch(()=>({}));if(p.ok&&!Boolean(plan?.activePlan||plan?.hasActivePlan))destination="/teacher/grade-plan?setup=1"}catch{}router.replace(destination);router.refresh()',
    'if(d?.firebaseToken)await signInWithCustomToken(auth,d.firebaseToken);if(d?.teacherId)setGradePlanCurrentTeacher(d.teacherId);let destination="/teacher/dashboard";try{const p=await fetch("/api/teacher/grade-plan",{cache:"no-store",credentials:"same-origin"});const plan=await p.json().catch(()=>({}));const hasPlan=Boolean(plan?.activePlan||plan?.hasActivePlan||readLocalGradePlan(d?.teacherId));if(p.ok&&!hasPlan)destination="/teacher/grade-plan?setup=1"}catch{if(!readLocalGradePlan(d?.teacherId))destination="/teacher/grade-plan?setup=1"}router.replace(destination);router.refresh()',
)

# PWA refresh so the browser cannot keep the pre-fix bundle.
replace_once(
    "app/pwa-register.tsx",
    'const CURRENT_CACHE = "ostadh-lahooni-v96-first-entry-plan";\nconst RELOAD_KEY = "ostadh-lahooni-v96-first-entry-plan";',
    'const CURRENT_CACHE = "ostadh-lahooni-v97-grade-plan-quota-fallback";\nconst RELOAD_KEY = "ostadh-lahooni-v97-grade-plan-quota-fallback";',
)
replace_once(
    "app/pwa-register.tsx",
    'navigator.serviceWorker.register("/sw.js?v=96-first-entry-plan",',
    'navigator.serviceWorker.register("/sw.js?v=97-grade-plan-quota-fallback",',
)
replace_once(
    "public/sw.js",
    'const CACHE_NAME = "ostadh-lahooni-v96-first-entry-plan";',
    'const CACHE_NAME = "ostadh-lahooni-v97-grade-plan-quota-fallback";',
)

print("grade plan quota fallback v97 applied")
