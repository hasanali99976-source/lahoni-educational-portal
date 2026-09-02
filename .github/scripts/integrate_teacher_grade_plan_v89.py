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

# -----------------------------------------------------------------------------
# 1) Grade-plan engine: no preset/fixed unit count and version-specific raw values.
# -----------------------------------------------------------------------------
path = "lib/grade-plan.ts"
text = read(path)
text = text.replace('  gradeValues?: GradeValueMap;\n', '  gradeValues?: GradeValueMap;\n  gradePlanValues?: Record<string, GradeValueMap>;\n', 1)
text = text.replace('const count = Math.max(1, Math.min(50, Math.floor(unitCount || 1)));', 'const count = Math.max(1, Math.floor(unitCount || 1));')
text = text.replace('const sections = rawSections.slice(0, 50).map(', 'const sections = rawSections.map(')
text = text.replace('const items = rawItems.slice(0, 80).map(', 'const items = rawItems.map(')
old = '''export function calculateGradePlanResult(plan: GradePlan | GradePlanDraft | null | undefined, student: GradeStudentLike): GradePlanResult {\n  if (!plan) return { earned: 0, maximum: 100, percentage: 0, recordedMaximum: 0, completion: 0, complete: false, finalScore: null, sections: [], dimensions: [] };\n  const draft = normalizeGradePlanDraft(plan);\n  const sections: GradeSectionResult[] = draft.sections.map(section => {\n    const items = section.items.map(item => {\n      const source = readGradeEntry(student, section, item);'''
new = '''export function calculateGradePlanResult(plan: GradePlan | GradePlanDraft | null | undefined, student: GradeStudentLike): GradePlanResult {\n  if (!plan) return { earned: 0, maximum: 100, percentage: 0, recordedMaximum: 0, completion: 0, complete: false, finalScore: null, sections: [], dimensions: [] };\n  const draft = normalizeGradePlanDraft(plan);\n  const planId = \"id\" in plan ? String(plan.id || \"\") : \"\";\n  const versionValues = planId && student.gradePlanValues?.[planId] ? student.gradePlanValues[planId] : null;\n  const effectiveStudent = versionValues ? { ...student, gradeValues: versionValues } : student;\n  const sections: GradeSectionResult[] = draft.sections.map(section => {\n    const items = section.items.map(item => {\n      const source = readGradeEntry(effectiveStudent, section, item);'''
text = must_replace(text, old, new, "grade result version values")
write(path, text)

# -----------------------------------------------------------------------------
# 2) Gradebook: preserve a raw snapshot for every approved plan version.
# -----------------------------------------------------------------------------
path = "app/teacher/grades/page.tsx"
text = read(path)
text = text.replace('  gradeValues?: GradeValueMap;\n', '  gradeValues?: GradeValueMap;\n  gradePlanValues?: Record<string, GradeValueMap>;\n', 1)
anchor = '''  function itemKey(item: GradePlanItem) {\n    return section ? gradeEntryKey(section.id, item.id) : \"\";\n  }\n'''
addition = '''  function valuesForPlan(student: Student) {\n    if (!activePlan) return student.gradeValues || {};\n    return student.gradePlanValues?.[activePlan.id] || student.gradeValues || {};\n  }\n\n  function studentForPlan(student: Student) {\n    return { ...student, gradeValues: valuesForPlan(student) };\n  }\n\n'''
text = must_replace(text, anchor, anchor + addition, "gradebook plan helpers")
text = text.replace('const entry = readGradeEntry(student, section, item);', 'const entry = readGradeEntry(studentForPlan(student), section, item);')
text = text.replace('return { ...student, gradeValues: { ...(student.gradeValues || {}), ...(localValues[student.id] || {}) } };', 'return { ...student, gradeValues: { ...valuesForPlan(student), ...(localValues[student.id] || {}) } };')
text = text.replace('const mergedValues = { ...(student.gradeValues || {}), ...(localValues[student.id] || {}) };', 'const mergedValues = { ...valuesForPlan(student), ...(localValues[student.id] || {}) };')
old = '''          gradeValues: mergedValues,\n          activeGradePlanId: activePlan.id,'''
new = '''          gradeValues: mergedValues,\n          gradePlanValues: { ...(student.gradePlanValues || {}), [activePlan.id]: mergedValues },\n          activeGradePlanId: activePlan.id,'''
text = must_replace(text, old, new, "gradebook snapshot save")
old = '''? { ...student, gradeValues: { ...(student.gradeValues || {}), ...(localValues[student.id] || {}) } }\n        : student));'''
new = '''? { ...student, gradeValues: { ...valuesForPlan(student), ...(localValues[student.id] || {}) }, gradePlanValues: { ...(student.gradePlanValues || {}), [activePlan.id]: { ...valuesForPlan(student), ...(localValues[student.id] || {}) } } }\n        : student));'''
text = must_replace(text, old, new, "gradebook state snapshot")
write(path, text)

# -----------------------------------------------------------------------------
# 3) Teacher navigation: dedicated grade distribution, never called material plans.
# -----------------------------------------------------------------------------
path = "app/teacher/layout.tsx"
text = read(path)
nav_line = '  { href: "/teacher/grade-plan", key: "gradeplan", label: "توزيع الدرجات", note: "إعداد واعتماد الـ100 درجة" },\n'
if nav_line not in text:
    anchor = '  { href: "/teacher/diagnostics", key: "diagnostics", label: "الاختبارات التشخيصية", note: "النتائج والخطط العلاجية" },\n'
    text = must_replace(text, anchor, nav_line + anchor, "teacher grade plan nav")
icon = '  if (type === "gradeplan") return <svg {...common}><circle cx="12" cy="12" r="8.5"/><path d="M8 8h8M8 12h5M8 16h3"/><path d="m15.5 15 1.5 1.5 3-3"/></svg>;\n'
if icon not in text:
    anchor = '  if (type === "grades") return <svg {...common}><path d="M4 19.5h16M6.5 16V9.5M11.8 16V5M17.1 16v-3.8"/><path d="m5.8 6.8 3-2.3 3 1.8 5.4-3"/></svg>;\n'
    text = must_replace(text, anchor, anchor + icon, "teacher grade plan icon")
write(path, text)

# -----------------------------------------------------------------------------
# 4) Mobile navigation.
# -----------------------------------------------------------------------------
path = "app/mobile-app-enhancer.tsx"
text = read(path)
text = text.replace('type IconName = "home" | "students" | "attendance" | "grades" | "tests" | "ai" | "admin" | "back";', 'type IconName = "home" | "students" | "attendance" | "grades" | "gradeplan" | "tests" | "ai" | "admin" | "back";')
icon_anchor = '    grades: <><rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M8 8h8M8 12h5M8 16h3"/><path d="m15 16 1.5 1.5L20 14"/></>,\n'
plan_icon = '    gradeplan: <><circle cx="12" cy="12" r="8.5"/><path d="M8 8h8M8 12h5M8 16h3"/><path d="m15.5 15 1.5 1.5 3-3"/></>,\n'
if plan_icon not in text:
    text = must_replace(text, icon_anchor, icon_anchor + plan_icon, "mobile grade plan icon")
link_anchor = '      { href: "/teacher/grades", label: "الدرجات", icon: "grades" },\n'
plan_link = '      { href: "/teacher/grade-plan", label: "التوزيع", icon: "gradeplan" },\n'
if plan_link not in text:
    text = must_replace(text, link_anchor, link_anchor + plan_link, "mobile grade plan link")
write(path, text)

# -----------------------------------------------------------------------------
# 5) Dashboard analysis and charts use the approved teacher plan.
# -----------------------------------------------------------------------------
path = "app/teacher/dashboard/page.tsx"
text = read(path)
if 'from "../../../lib/grade-plan";' not in text:
    text = must_replace(text, 'import { useTeacherClient } from "../../../lib/teacher-client";\n', 'import { useTeacherClient } from "../../../lib/teacher-client";\nimport { calculateGradePlanResult, GRADE_CATEGORY_LABELS, type GradeStudentLike } from "../../../lib/grade-plan";\nimport { useGradePlan } from "../../../lib/use-grade-plan";\n', "dashboard grade imports")
text = text.replace('const dimensions = [\n', 'const legacyDimensions = [\n', 1)
text = must_replace(text, '  const session = useTeacherClient();\n', '  const session = useTeacherClient();\n  const { activePlan } = useGradePlan(true);\n', "dashboard plan hook")
state_anchor = '  const [message, setMessage] = useState("");\n'
if 'const dimensions = useMemo(() =>' not in text:
    dynamic_dimensions = '''\n  const dimensions = useMemo<Array<[string, string]>>(() => {\n    if (!activePlan) return legacyDimensions.map(item => [item[0], item[1]]);\n    const seen = new Set<string>();\n    const values: Array<[string, string]> = [];\n    activePlan.sections.forEach(section => section.items.forEach(item => {\n      const key = item.category || \"custom\";\n      if (seen.has(key)) return;\n      seen.add(key);\n      values.push([key, GRADE_CATEGORY_LABELS[item.category] || item.label]);\n    }));\n    return values.length ? values : legacyDimensions.map(item => [item[0], item[1]]);\n  }, [activePlan]);\n'''
    text = must_replace(text, state_anchor, state_anchor + dynamic_dimensions, "dashboard dynamic dimensions")
pattern = re.compile(r'  const analyses = useMemo\(\(\) => students\.map\(student => \{.*?\n  \}\), \[students, attendance\]\);', re.S)
replacement = '''  const analyses = useMemo(() => students.map(student => {\n    const result = activePlan ? calculateGradePlanResult(activePlan, student as unknown as GradeStudentLike) : null;\n    const units = Object.values(student.units || {});\n    const legacyPercentages = units.map(unit => Number(unit.percentage || 0)).filter(value => value > 0);\n    const dimensionScores = Object.fromEntries(dimensions.map(([key]) => {\n      if (result) return [key, result.dimensions.find(item => item.key === key)?.percentage || 0];\n      const maximum = key === \"attendance\" ? 3 : key === \"participation\" ? 4 : key === \"homework\" ? 2 : 10;\n      const values = units.map(unit => Number(key === \"unitExam\" ? unit.unitExam ?? unit.exam1 ?? unit.exam2 ?? 0 : (unit as Record<string, unknown>)[key] || 0));\n      return [key, values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / (values.length * maximum) * 100) : 0];\n    })) as Record<string, number>;\n    const statuses = attendance.map(day => day.records?.[student.id]).filter(Boolean);\n    const absence = statuses.filter(status => status === \"absent\" || status === \"escaped\").length;\n    const late = statuses.filter(status => status === \"late\").length;\n    const average = result ? Math.round(result.percentage) : legacyPercentages.length ? Math.round(legacyPercentages.reduce((sum, value) => sum + value, 0) / legacyPercentages.length) : 0;\n    const ratedUnits = result ? result.sections.filter(section => section.recordedMaximum > 0).length : legacyPercentages.length;\n    return { ...student, average, ratedUnits, dimensionScores, absence, late, completion: result?.completion || 0, level: level(average) };\n  }), [students, attendance, activePlan, dimensions]);'''
text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit("dashboard analyses block not replaced")
text = text.replace('تأكد من الوحدات والطلاب غير المرصودين', 'تأكد من أقسام الخطة والطلاب غير المرصودين')
text = text.replace('بعد رصد أول وحدة ستظهر هنا أولوية المتابعة ونقطة القوة والطلاب المحتاجون دعمًا.', 'بعد بدء الرصد وفق الخطة المعتمدة ستظهر هنا أولوية المتابعة ونقطة القوة والطلاب المحتاجون دعمًا.')
text = text.replace('<p>الحضور والمشاركة والواجبات والاختبارات</p>', '<p>عناصر التقييم في خطة توزيع الدرجات المعتمدة</p>')
text = text.replace('<dt>الوحدات</dt><dd>{selectedAnalysis?.ratedUnits ?? rated.reduce((sum, student) => sum + student.ratedUnits, 0)}</dd>', '<dt>الأقسام المرصودة</dt><dd>{selectedAnalysis?.ratedUnits ?? rated.reduce((sum, student) => sum + student.ratedUnits, 0)}</dd>')
action_anchor = '        <Link className="daily-action" href="/teacher/grades"><span>٪</span><div><b>رصد الدرجات</b><small>إدخال الدرجات وحفظها سحابيًا</small></div></Link>\n'
plan_action = '        <Link className="daily-action" href="/teacher/grade-plan"><span>١٠٠</span><div><b>توزيع الدرجات</b><small>{activePlan ? `الخطة المعتمدة — نسخة ${activePlan.version}` : "إعداد طريقة احتساب الـ100"}</small></div></Link>\n'
if plan_action not in text:
    text = must_replace(text, action_anchor, action_anchor + plan_action, "dashboard plan action")
write(path, text)

# -----------------------------------------------------------------------------
# 6) Student profile returns the teacher-level approved plan with every refresh.
# -----------------------------------------------------------------------------
path = "app/api/student/profile/route.ts"
text = read(path)
old = '''  const [attendance, timetable] = await Promise.all([\n    adminDb().collection(`${root}/attendance`).get(),\n    adminDb().collection(`${root}/timetable`).doc("weekly").get(),\n  ]);'''
new = '''  const gradePlanConfig = await adminDb().collection(`portalV2Data/${access.teacherId}/gradePlanConfig`).doc("current").get();\n  const activeGradePlanId = gradePlanConfig.exists ? String(gradePlanConfig.data()?.activePlanId || "") : "";\n  const [attendance, timetable, gradePlanSnapshot] = await Promise.all([\n    adminDb().collection(`${root}/attendance`).get(),\n    adminDb().collection(`${root}/timetable`).doc("weekly").get(),\n    activeGradePlanId ? adminDb().collection(`portalV2Data/${access.teacherId}/gradePlanVersions`).doc(activeGradePlanId).get() : Promise.resolve(null),\n  ]);'''
text = must_replace(text, old, new, "student profile grade plan fetch")
old = '''      attendanceSummary: {\n        ...counts,\n        automaticPresent,\n        disciplineRate,\n        latestDate,\n        attendanceSource,\n      },'''
new = '''      attendanceSummary: {\n        ...counts,\n        automaticPresent,\n        disciplineRate,\n        latestDate,\n        attendanceSource,\n      },\n      gradePlan: gradePlanSnapshot && gradePlanSnapshot.exists ? { id: gradePlanSnapshot.id, ...gradePlanSnapshot.data() } : null,'''
text = must_replace(text, old, new, "student profile grade plan return")
write(path, text)

# -----------------------------------------------------------------------------
# 7) Student/parent portal calculations, tables and print chart use approved plan.
# -----------------------------------------------------------------------------
path = "app/student/page.tsx"
text = read(path)
if 'from "../../lib/grade-plan";' not in text:
    text = must_replace(text, 'import { ACADEMIC_UNITS, FINAL_MAX, GRADE_DISTRIBUTION, RESEARCH_MAX, UNIT_MAX, calculatePercentage, calculateUnitTotal } from "../../lib/academic-config";\n', 'import { ACADEMIC_UNITS, FINAL_MAX, GRADE_DISTRIBUTION, RESEARCH_MAX, UNIT_MAX, calculatePercentage, calculateUnitTotal } from "../../lib/academic-config";\nimport { calculateGradePlanResult, normalizeGradePlan, type GradePlan, type GradeValueMap } from "../../lib/grade-plan";\n', "student grade imports")
text = text.replace('type StudentRecord = { name?: string;', 'type StudentRecord = { gradePlan?: GradePlan | null; gradeValues?: GradeValueMap; gradePlanValues?: Record<string, GradeValueMap>; name?: string;', 1)
start = text.find('  const units = useMemo(() => ACADEMIC_UNITS.map(unit => {')
end = text.find('  const subjectProfile = subjectKnowledgeProfile(', start)
if start < 0 or end < 0:
    raise SystemExit("student calculation block anchors missing")
end_line = text.find('\n', end)
old_block = text[start:end_line+1]
new_block = '''  const approvedPlan = useMemo(() => normalizeGradePlan(selected?.data.gradePlan), [selected?.data.gradePlan]);\n  const planResult = useMemo(() => approvedPlan ? calculateGradePlanResult(approvedPlan, selected?.data || {}) : null, [approvedPlan, selected]);\n  const units = useMemo(() => {\n    if (approvedPlan && planResult) return planResult.sections.map(section => {\n      const byCategory = Object.fromEntries(planResult.dimensions.map(item => [item.key, item]));\n      const itemValue = (category: string) => section.items.filter(entry => entry.item.category === category).reduce((sum, entry) => sum + entry.counted, 0);\n      return {\n        key: section.id, label: section.label, examLabel: section.label,\n        attendance: itemValue(\"attendance\"), participation: itemValue(\"participation\"), homework: itemValue(\"homework\"), unitExam: itemValue(\"unitExam\"),\n        total: section.earned, max: section.maximum, items: section.items, byCategory,\n      };\n    });\n    return ACADEMIC_UNITS.map(unit => {\n      const row = selected?.data.units?.[unit.key] || {};\n      const attendance = Number(row.attendance || 0);\n      const participation = Number(row.participation || 0);\n      const homework = Number(row.homework || 0);\n      const unitExam = Number(row.unitExam ?? row.exam1 ?? row.exam2 ?? 0);\n      const total = Math.min(UNIT_MAX, Number(row.total ?? calculateUnitTotal({ attendance, participation, homework, unitExam })));\n      return { ...unit, attendance, participation, homework, unitExam, total, max: UNIT_MAX, items: [] as never[] };\n    });\n  }, [approvedPlan, planResult, selected]);\n\n  const legacyResearch = Math.min(RESEARCH_MAX, Number(selected?.data.researchScore ?? selected?.data.research ?? 0));\n  const research = approvedPlan ? (planResult?.dimensions.filter(item => item.key === \"research\" || item.key === \"project\").reduce((sum, item) => sum + item.earned, 0) || 0) : legacyResearch;\n  const unitsTotal = approvedPlan ? (planResult?.earned || 0) : units.reduce((sum, unit) => sum + unit.total, 0);\n  const finalMaximum = 100;\n  const finalTotal = approvedPlan ? (planResult?.earned || 0) : Math.min(FINAL_MAX, unitsTotal + research);\n  const percentage = approvedPlan ? (planResult?.percentage || 0) : calculatePercentage(finalTotal, FINAL_MAX);\n  const completion = approvedPlan ? (planResult?.completion || 0) : percentage;\n  const smartMessage = encouragements[Math.min(20, Math.max(0, Math.floor(percentage / 5)))]!;\n  const weakestUnit = [...units].sort((a, b) => (a.max ? a.total / a.max : 0) - (b.max ? b.total / b.max : 0))[0];\n  const strongestUnit = [...units].sort((a, b) => (b.max ? b.total / b.max : 0) - (a.max ? a.total / a.max : 0))[0];\n  const targetScore = Math.min(finalMaximum, Math.max(0, goal / 100 * finalMaximum));\n  const remainingForGoal = Math.max(0, targetScore - finalTotal);\n  const goalReached = percentage >= goal;\n  const classLabel = selected?.data.class?.trim() || \"الفصل غير محدد\";\n  const attendanceSummary = selected?.data.attendanceSummary || { present: 0, absent: Number(selected?.data.absences || 0), late: Number(selected?.data.late || 0), excused: 0, escaped: 0, total: 0, disciplineRate: 100 };\n  const disciplineMessage = attendanceSummary.escaped > 0 || attendanceSummary.absent >= 3\n    ? \"يحتاج انتظامك إلى متابعة مباشرة مع المعلم وولي الأمر.\"\n    : attendanceSummary.late >= 3\n      ? \"حاول الوصول مبكرًا؛ تقليل التأخير سيرفع نسبة انضباطك.\"\n      : \"انضباطك جيد، حافظ على حضورك وانتظامك.\";\n  const disciplineClass = attendanceSummary.escaped > 0 || attendanceSummary.absent >= 3 ? \"danger\" : attendanceSummary.late >= 3 ? \"warning\" : \"\";\n  const dailyPlan = percentage >= 90\n    ? [\"راجع ملخص الدرس لمدة ١٥ دقيقة.\", \"حل سؤالين إثرائيين.\", \"اشرح فكرة واحدة لزميلك.\"]\n    : percentage >= 70\n      ? [`راجع ${weakestUnit?.label || \"القسم الأضعف\"} لمدة ٢٠ دقيقة.`, \"حل ثلاثة أسئلة من أخطائك السابقة.\", \"سجّل نقطة واحدة تحتاج سؤال المعلم عنها.\"]\n      : [`ابدأ بأساسيات ${weakestUnit?.label || \"القسم الأضعف\"} لمدة ٢٠ دقيقة.`, \"حل مثالًا مع الشرح خطوة بخطوة.\", \"اطلب تغذية راجعة من معلمك قبل الانتقال لمهارة جديدة.\"];\n  const subjectProfile = subjectKnowledgeProfile(selected?.subjectKey || \"\", selected?.subjectLabel || \"المادة\");\n'''
text = text[:start] + new_block + text[end_line+1:]
text = text.replace('{ar(finalTotal)} من {ar(FINAL_MAX)}', '{ar(finalTotal)} من {ar(finalMaximum)}')
text = text.replace('<span>من {ar(FINAL_MAX)}</span>', '<span>من {ar(finalMaximum)}</span>')
text = text.replace('`${ar(strongestUnit.total)} من ${ar(UNIT_MAX)} — استمر على نفس أسلوب المراجعة.`', '`${ar(strongestUnit.total)} من ${ar(strongestUnit.max)} — استمر على نفس أسلوب المراجعة.`')
text = text.replace('`${ar(weakestUnit.total)} من ${ar(UNIT_MAX)} — راجع المهارة ثم اختبر نفسك.`', '`${ar(weakestUnit.total)} من ${ar(weakestUnit.max)} — راجع المهارة ثم اختبر نفسك.`')
text = text.replace('`درجتك الحالية ${ar(weakestUnit.total)} من ${ar(UNIT_MAX)}. راجع المفهوم، ثم حل ثلاثة أسئلة قصيرة.`', '`درجتك الحالية ${ar(weakestUnit.total)} من ${ar(weakestUnit.max)}. راجع المفهوم، ثم حل ثلاثة أسئلة قصيرة.`')
old = '<div className="knowledge-score-cards"><article><small>مجموع الوحدات</small><strong>{ar(unitsTotal)}</strong></article><article><small>البحث والمشروع</small><strong>{ar(research)}</strong></article><article><small>نسبة الإنجاز</small><strong>{ar(percentage)}٪</strong></article></div>'
new = '<div className="knowledge-score-cards"><article><small>{approvedPlan ? "المجموع الحالي" : "مجموع الوحدات"}</small><strong>{ar(unitsTotal)}</strong></article><article><small>{approvedPlan ? "اكتمال الرصد" : "البحث والمشروع"}</small><strong>{approvedPlan ? `${ar(completion)}٪` : ar(research)}</strong></article><article><small>نسبة الإنجاز</small><strong>{ar(percentage)}٪</strong></article></div>'
text = must_replace(text, old, new, "student achievement cards")
old_table = '<section className="student-units-table knowledge-table-card"><div className="student-section-title"><h2>تفصيل الدرجات</h2><p>اضغط على المساعد الذكي لمعرفة نقطة البداية المناسبة.</p></div><div className="student-table-scroll"><table><thead><tr><th>الوحدة</th><th>الحضور</th><th>المشاركة</th><th>الواجبات</th><th>الاختبار</th><th>المجموع</th></tr></thead><tbody>{units.map(unit => <tr key={unit.key}><td data-label="الوحدة"><b>{unit.label}</b></td><td data-label="الحضور">{ar(unit.attendance)}/{ar(GRADE_DISTRIBUTION.attendance)}</td><td data-label="المشاركة">{ar(unit.participation)}/{ar(GRADE_DISTRIBUTION.participation)}</td><td data-label="الواجبات">{ar(unit.homework)}/{ar(GRADE_DISTRIBUTION.homework)}</td><td data-label="الاختبار">{ar(unit.unitExam)}/{ar(GRADE_DISTRIBUTION.unitExam)}</td><td data-label="المجموع"><strong>{ar(unit.total)}/{ar(UNIT_MAX)}</strong></td></tr>)}</tbody></table></div></section>'
new_table = '<section className="student-units-table knowledge-table-card"><div className="student-section-title"><h2>تفصيل الدرجات</h2><p>{approvedPlan ? "حسب خطة توزيع الدرجات المعتمدة من المعلم." : "حسب نظام الرصد السابق."}</p></div>{approvedPlan && planResult ? <div className="student-table-scroll dynamic-student-grades">{planResult.sections.map(section => <table key={section.id}><thead><tr><th colSpan={3}>{section.label} — {ar(section.earned)} من {ar(section.maximum)}</th></tr><tr><th>عنصر التقييم</th><th>درجتي</th><th>من</th></tr></thead><tbody>{section.items.map(entry => <tr key={entry.key}><td><b>{entry.item.label}</b></td><td>{entry.recorded ? ar(entry.value) : "—"}</td><td>{ar(entry.maximum)}</td></tr>)}</tbody></table>)}</div> : <div className="student-table-scroll"><table><thead><tr><th>الوحدة</th><th>الحضور</th><th>المشاركة</th><th>الواجبات</th><th>الاختبار</th><th>المجموع</th></tr></thead><tbody>{units.map(unit => <tr key={unit.key}><td data-label="الوحدة"><b>{unit.label}</b></td><td data-label="الحضور">{ar(unit.attendance)}/{ar(GRADE_DISTRIBUTION.attendance)}</td><td data-label="المشاركة">{ar(unit.participation)}/{ar(GRADE_DISTRIBUTION.participation)}</td><td data-label="الواجبات">{ar(unit.homework)}/{ar(GRADE_DISTRIBUTION.homework)}</td><td data-label="الاختبار">{ar(unit.unitExam)}/{ar(GRADE_DISTRIBUTION.unitExam)}</td><td data-label="المجموع"><strong>{ar(unit.total)}/{ar(unit.max)}</strong></td></tr>)}</tbody></table></div>}</section>'
text = must_replace(text, old_table, new_table, "student dynamic grade table")
text = text.replace('<h2>أداء الوحدات</h2></div><span>من {ar(UNIT_MAX)} لكل وحدة</span>', '<h2>{approvedPlan ? "أداء أقسام الخطة" : "أداء الوحدات"}</h2></div><span>{approvedPlan ? "حسب الدرجة القصوى لكل قسم" : `من ${ar(UNIT_MAX)} لكل وحدة`}</span>')
text = text.replace('const barWidth = Math.max(3, Math.min(100, unit.total / Math.max(UNIT_MAX, 1) * 100)) * 3.15;', 'const barWidth = Math.max(3, Math.min(100, unit.total / Math.max(unit.max, 1) * 100)) * 3.15;')
text = text.replace('{ar(unit.total)}/{ar(UNIT_MAX)}</text>', '{ar(unit.total)}/{ar(unit.max)}</text>')
text = text.replace('أعلى أداء في {strongestUnit?.label || "الوحدات المكتملة"}', 'أعلى أداء في {strongestUnit?.label || "الأقسام المكتملة"}')
write(path, text)

# -----------------------------------------------------------------------------
# 8) Follow-up/mastery reads plan; no hardcoded 5 units/19+research model.
# -----------------------------------------------------------------------------
path = "app/teacher/follow-up/page.tsx"
text = read(path)
if 'from "../../../lib/grade-plan";' not in text:
    text = must_replace(text, 'import { useTeacherClient } from "../../../lib/teacher-client";\n', 'import { useTeacherClient } from "../../../lib/teacher-client";\nimport { calculateGradePlanResult, type GradePlan, type GradeStudentLike } from "../../../lib/grade-plan";\nimport { useGradePlan } from "../../../lib/use-grade-plan";\n', "follow grade imports")
text = text.replace('type Student = { id: string;', 'type Student = GradeStudentLike & { id: string;', 1)
pattern = re.compile(r'function evaluateStudent\(student: Student\): EvaluatedStudent \{.*?\nfunction statusFor\(student: EvaluatedStudent, threshold: number\) \{', re.S)
replacement = '''function evaluateStudent(student: Student, plan: GradePlan | null): EvaluatedStudent {\n  const result = calculateGradePlanResult(plan, student);\n  const missing = result.sections.reduce((sum, section) => sum + section.items.filter(item => !item.recorded).length, 0);\n  return { ...student, points: result.earned, completion: Math.round(result.completion), performance: Math.round(result.percentage), finalScore: result.finalScore === null ? null : Math.round(result.finalScore), missing };\n}\n\nfunction insightProfile(student: Student, plan: GradePlan | null) {\n  const result = calculateGradePlanResult(plan, student);\n  const dimensions = result.dimensions.filter(item => item.maximum > 0);\n  const weakest = [...dimensions].sort((a, b) => a.percentage - b.percentage)[0];\n  const strongest = [...dimensions].sort((a, b) => b.percentage - a.percentage)[0];\n  return {\n    weakest: weakest ? { key: weakest.key, label: weakest.label, value: Math.round(weakest.percentage), recorded: weakest.maximum } : { key: \"none\", label: \"لا يوجد رصد كافٍ\", value: 0, recorded: 0 },\n    strongest: strongest ? { key: strongest.key, label: strongest.label, value: Math.round(strongest.percentage), recorded: strongest.maximum } : { key: \"none\", label: \"لا يوجد رصد كافٍ\", value: 0, recorded: 0 },\n  };\n}\n\nfunction statusFor(student: EvaluatedStudent, threshold: number) {'''
text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit("follow evaluation functions not replaced")
anchor = '  const session = useTeacherClient();\n'
text = must_replace(text, anchor, anchor + '  const { activePlan } = useGradePlan(true);\n', "follow plan hook")
text = text.replace('const evaluated = useMemo(() => visible.map(evaluateStudent), [visible]);', 'const evaluated = useMemo(() => visible.map(student => evaluateStudent(student, activePlan)), [visible, activePlan]);')
text = text.replace('evaluateStudent(analysisStudent)', 'evaluateStudent(analysisStudent, activePlan)')
text = text.replace('insightProfile(analysisStudent)', 'insightProfile(analysisStudent, activePlan)')
main_anchor = '  return <main className="follow-page" dir="rtl">\n'
if 'لم تُعتمد خطة توزيع الدرجات' not in text:
    banner = '    {!activePlan && <div className="follow-toast" role="status">لم تُعتمد خطة توزيع الدرجات بعد. <a href="/teacher/grade-plan">إعداد التوزيع الآن</a></div>}\n'
    text = must_replace(text, main_anchor, main_anchor + banner, "follow no plan banner")
write(path, text)

print("teacher grade plan v89 integration applied")
