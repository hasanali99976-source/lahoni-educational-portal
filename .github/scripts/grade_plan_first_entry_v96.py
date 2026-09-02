from pathlib import Path


def replace_once(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"pattern not found in {path}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1), encoding="utf-8")

# 1) Teacher shell owns the first-entry decision and the permanent edit icon.
layout = Path("app/teacher/layout.tsx")
text = layout.read_text(encoding="utf-8")
if "const [hasGradePlan, setHasGradePlan]" not in text:
    text = text.replace(
        '  const [ready, setReady] = useState(false);',
        '  const [ready, setReady] = useState(false);\n  const [hasGradePlan, setHasGradePlan] = useState<boolean | null>(null);',
        1,
    )
if "setHasGradePlan(null);" not in text:
    text = text.replace(
        '    setAssignments([]);\n    setMenuOpen(false);',
        '    setAssignments([]);\n    setHasGradePlan(null);\n    setMenuOpen(false);',
        1,
    )
old_session = '''      .then((session: TeacherSession) => {\n        if (!active) return;\n        if (!session.teacherId) throw new Error("missing_teacher_identity");\n        applySession(session);\n        setReady(true);\n      })'''
new_session = '''      .then(async (session: TeacherSession) => {\n        if (!active) return;\n        if (!session.teacherId) throw new Error("missing_teacher_identity");\n        applySession(session);\n\n        const planResponse = await fetch("/api/teacher/grade-plan", { cache: "no-store", credentials: "same-origin" });\n        const planData = planResponse.ok ? await planResponse.json().catch(() => ({})) : {};\n        const nextHasGradePlan = Boolean(planData?.activePlan || planData?.hasActivePlan);\n        if (!active) return;\n        setHasGradePlan(nextHasGradePlan);\n\n        const onGradePlanPage = pathname.startsWith("/teacher/grade-plan");\n        const editRequested = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("edit") === "1";\n        if (!nextHasGradePlan && !onGradePlanPage) {\n          window.location.replace("/teacher/grade-plan?setup=1");\n          return;\n        }\n        if (nextHasGradePlan && onGradePlanPage && !editRequested) {\n          window.location.replace("/teacher/grades");\n          return;\n        }\n        setReady(true);\n      })'''
if old_session in text:
    text = text.replace(old_session, new_session, 1)
elif "const nextHasGradePlan = Boolean(planData?.activePlan || planData?.hasActivePlan);" not in text:
    raise SystemExit("teacher session block not found")

old_actions = '''        <div className="teacher-pro-actions">\n          <Link className="teacher-pro-action ai" href="/teacher/ai"><TabIcon type="ai"/><span>المساعد</span></Link>\n          <button className="teacher-pro-action" type="button" aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)}><TabIcon type="more"/><span>المزيد</span></button>\n        </div>'''
new_actions = '''        <div className="teacher-pro-actions">\n          <Link className="teacher-pro-action ai" href="/teacher/ai"><TabIcon type="ai"/><span>المساعد</span></Link>\n          {hasGradePlan ? <Link className="teacher-pro-action grade-plan-mini-action" href="/teacher/grade-plan?edit=1" title="تعديل خطة توزيع الدرجات" aria-label="تعديل خطة توزيع الدرجات"><TabIcon type="gradeplan"/></Link> : null}\n          <button className="teacher-pro-action" type="button" aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)}><TabIcon type="more"/><span>المزيد</span></button>\n        </div>'''
if old_actions in text:
    text = text.replace(old_actions, new_actions, 1)
elif "grade-plan-mini-action" not in text:
    raise SystemExit("teacher actions block not found")
layout.write_text(text, encoding="utf-8")

# 2) Login chooses the correct first destination immediately.
login = Path("app/teacher/page.tsx")
text = login.read_text(encoding="utf-8")
old_login = 'if(d?.firebaseToken)await signInWithCustomToken(auth,d.firebaseToken);router.replace("/teacher/dashboard");router.refresh()'
new_login = 'if(d?.firebaseToken)await signInWithCustomToken(auth,d.firebaseToken);let destination="/teacher/dashboard";try{const p=await fetch("/api/teacher/grade-plan",{cache:"no-store",credentials:"same-origin"});const plan=await p.json().catch(()=>({}));if(p.ok&&!Boolean(plan?.activePlan||plan?.hasActivePlan))destination="/teacher/grade-plan?setup=1"}catch{}router.replace(destination);router.refresh()'
if old_login in text:
    text = text.replace(old_login, new_login, 1)
elif 'destination="/teacher/grade-plan?setup=1"' not in text:
    raise SystemExit("login redirect pattern not found")
login.write_text(text, encoding="utf-8")

# 3) Keep one clear edit entry point: the small icon in the portal header.
grades = Path("app/teacher/grades/page.tsx")
text = grades.read_text(encoding="utf-8")
old_edit = '<Link className="grade-plan-edit-icon" href="/teacher/grade-plan?edit=1" title="تعديل خطة توزيع الدرجات" aria-label="تعديل خطة توزيع الدرجات">✎</Link>'
text = text.replace(old_edit, "", 1)
grades.write_text(text, encoding="utf-8")

# 4) Make the permanent edit entry visibly icon-sized.
css = Path("app/teacher/teacher-professional-v71.css")
text = css.read_text(encoding="utf-8")
marker = '.teacher-pro-action.grade-plan-mini-action'
if marker not in text:
    text += '\n.teacher-pro-action.grade-plan-mini-action{width:42px;min-width:42px;padding-inline:0;color:var(--teacher-accent);background:color-mix(in srgb,var(--teacher-accent) 7%,#fff);border-color:color-mix(in srgb,var(--teacher-accent) 22%,#dce6ef)}.teacher-pro-action.grade-plan-mini-action svg{width:20px;height:20px}\n'
css.write_text(text, encoding="utf-8")

# 5) Force every PWA client onto the new portal flow.
pwa = Path("app/pwa-register.tsx")
text = pwa.read_text(encoding="utf-8").replace("ostadh-lahooni-v95-grade-plan-direct", "ostadh-lahooni-v96-first-entry-plan").replace("/sw.js?v=95-grade-plan-direct", "/sw.js?v=96-first-entry-plan")
pwa.write_text(text, encoding="utf-8")

sw = Path("public/sw.js")
text = sw.read_text(encoding="utf-8").replace("ostadh-lahooni-v95-grade-plan-direct", "ostadh-lahooni-v96-first-entry-plan")
sw.write_text(text, encoding="utf-8")

print("Applied first-entry grade-plan flow v96")
