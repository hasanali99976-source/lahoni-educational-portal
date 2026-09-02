from pathlib import Path


def replace_once(path: str, old: str, new: str):
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"pattern not found in {path}: {old[:120]!r}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


# 1) Keep the newest locally approved plan instead of letting an older cloud plan overwrite it.
replace_once(
    "lib/use-grade-plan.ts",
    "type GradePlanState = {\n  activePlan: GradePlan | null;\n  loading: boolean;\n  error: string;\n  history: Array<{ id: string; version: number; mode: string; method: string; status: string; activatedAt: string; archivedAt?: string }>;\n};\n\nexport function useGradePlan(enabled = true) {",
    "type GradePlanState = {\n  activePlan: GradePlan | null;\n  loading: boolean;\n  error: string;\n  history: Array<{ id: string; version: number; mode: string; method: string; status: string; activatedAt: string; archivedAt?: string }>;\n};\n\nfunction newestGradePlan(localPlan: GradePlan | null, serverPlan: GradePlan | null) {\n  if (!localPlan) return serverPlan;\n  if (!serverPlan) return localPlan;\n  if (serverPlan.id === localPlan.id) return serverPlan;\n  if (serverPlan.version !== localPlan.version) return serverPlan.version > localPlan.version ? serverPlan : localPlan;\n  const serverTime = Date.parse(serverPlan.activatedAt || serverPlan.createdAt || \"\") || 0;\n  const localTime = Date.parse(localPlan.activatedAt || localPlan.createdAt || \"\") || 0;\n  return serverTime >= localTime ? serverPlan : localPlan;\n}\n\nexport function useGradePlan(enabled = true) {"
)
replace_once(
    "lib/use-grade-plan.ts",
    "      const serverPlan = normalizeGradePlan(data.activePlan);\n      const activePlan = serverPlan || localPlan;\n      if (serverPlan) saveLocalGradePlan(serverPlan);",
    "      const serverPlan = normalizeGradePlan(data.activePlan);\n      const activePlan = newestGradePlan(localPlan, serverPlan);\n      if (activePlan) saveLocalGradePlan(activePlan);"
)

# 2) Store the exact active plan beside student grades and proactively sync plan names to every loaded student.
replace_once(
    "app/teacher/grades/page.tsx",
    "  gradePlanValues?: Record<string, GradeValueMap>;\n  units?: Record<string, LegacyUnit>;",
    "  gradePlanValues?: Record<string, GradeValueMap>;\n  activeGradePlanId?: string;\n  gradePlanSnapshot?: Record<string, unknown>;\n  units?: Record<string, LegacyUnit>;"
)
replace_once(
    "app/teacher/grades/page.tsx",
    "  useEffect(() => {\n    if (!activePlan?.sections.length) { setSelectedSection(\"\"); return; }\n    if (!selectedSection || !activePlan.sections.some(item => item.id === selectedSection)) setSelectedSection(activePlan.sections[0].id);\n  }, [activePlan, selectedSection]);\n\n  useEffect(() => {\n    if (!section) { setLocalValues({}); return; }",
    "  useEffect(() => {\n    if (!activePlan?.sections.length) { setSelectedSection(\"\"); return; }\n    if (!selectedSection || !activePlan.sections.some(item => item.id === selectedSection)) setSelectedSection(activePlan.sections[0].id);\n  }, [activePlan, selectedSection]);\n\n  useEffect(() => {\n    if (!tenant || !activePlan || !students.length || typeof window === \"undefined\") return;\n    const needsSync = students.filter(student => {\n      const snapshotId = String(student.gradePlanSnapshot?.id || \"\");\n      return student.activeGradePlanId !== activePlan.id || snapshotId !== activePlan.id;\n    });\n    if (!needsSync.length) return;\n    let cancelled = false;\n    const timer = window.setTimeout(async () => {\n      const now = new Date().toISOString();\n      try {\n        for (let index = 0; index < needsSync.length && !cancelled; index += 40) {\n          await Promise.all(needsSync.slice(index, index + 40).map(student => setDoc(\n            doc(db, tenantStudentsPath(tenant), student.id),\n            {\n              name: student.name,\n              class: student.class,\n              className: student.class,\n              code: student.code,\n              active: true,\n              rosterActive: true,\n              activeGradePlanId: activePlan.id,\n              activeGradePlanVersion: activePlan.version,\n              gradePlanSnapshot: activePlan,\n              gradePlanSyncedAt: now,\n              teacherId: tenant.teacherId,\n              subjectKey: tenant.subjectKey,\n            },\n            { merge: true },\n          )));\n        }\n      } catch (syncError) {\n        console.warn(\"grade-plan-student-sync-v99\", syncError);\n      }\n    }, 700);\n    return () => { cancelled = true; window.clearTimeout(timer); };\n  }, [tenant, activePlan?.id, activePlan?.version, students]);\n\n  useEffect(() => {\n    if (!section) { setLocalValues({}); return; }"
)
replace_once(
    "app/teacher/grades/page.tsx",
    "          activeGradePlanId: activePlan.id,\n          activeGradePlanVersion: activePlan.version,\n          gradePlanUpdatedAt: now,",
    "          activeGradePlanId: activePlan.id,\n          activeGradePlanVersion: activePlan.version,\n          gradePlanSnapshot: activePlan,\n          gradePlanSyncedAt: now,\n          gradePlanUpdatedAt: now,"
)
replace_once(
    "app/teacher/grades/page.tsx",
    "? { ...student, gradeValues: { ...valuesForPlan(student), ...(localValues[student.id] || {}) }, gradePlanValues: { ...(student.gradePlanValues || {}), [activePlan.id]: { ...valuesForPlan(student), ...(localValues[student.id] || {}) } } }",
    "? { ...student, gradeValues: { ...valuesForPlan(student), ...(localValues[student.id] || {}) }, gradePlanValues: { ...(student.gradePlanValues || {}), [activePlan.id]: { ...valuesForPlan(student), ...(localValues[student.id] || {}) } }, activeGradePlanId: activePlan.id, gradePlanSnapshot: activePlan as unknown as Record<string, unknown> }"
)

# 3) Student profile: prefer the newest plan available (cloud or embedded in the student record), and pair it with matching plan-specific values.
replace_once(
    "app/api/student/profile/route.ts",
    "function validStatus(value: unknown): value is AttendanceStatus {\n  return value === \"present\" || value === \"absent\" || value === \"late\" || value === \"excused\" || value === \"escaped\";\n}\n\nexport async function GET(request: Request) {",
    "function validStatus(value: unknown): value is AttendanceStatus {\n  return value === \"present\" || value === \"absent\" || value === \"late\" || value === \"excused\" || value === \"escaped\";\n}\n\nfunction objectRecord(value: unknown): Record<string, any> | null {\n  return value && typeof value === \"object\" && !Array.isArray(value) ? value as Record<string, any> : null;\n}\n\nfunction planVersion(value: Record<string, any> | null) {\n  return Math.max(0, Number(value?.version || 0));\n}\n\nfunction planTime(value: Record<string, any> | null) {\n  return Date.parse(String(value?.activatedAt || value?.createdAt || \"\")) || 0;\n}\n\nfunction chooseStudentGradePlan(serverPlan: Record<string, any> | null, studentData: Record<string, unknown>) {\n  const embedded = objectRecord(studentData.gradePlanSnapshot) || objectRecord(studentData.gradePlan);\n  if (!serverPlan) return embedded;\n  if (!embedded) return serverPlan;\n  if (String(serverPlan.id || \"\") === String(embedded.id || \"\")) return serverPlan;\n  if (planVersion(serverPlan) !== planVersion(embedded)) return planVersion(serverPlan) > planVersion(embedded) ? serverPlan : embedded;\n  return planTime(serverPlan) >= planTime(embedded) ? serverPlan : embedded;\n}\n\nfunction valuesForStudentPlan(studentData: Record<string, unknown>, planId: string) {\n  const all = objectRecord(studentData.gradePlanValues);\n  const specific = planId && all ? objectRecord(all[planId]) : null;\n  return specific || objectRecord(studentData.gradeValues) || {};\n}\n\nexport async function GET(request: Request) {"
)
replace_once(
    "app/api/student/profile/route.ts",
    "  const disciplineRate = counts.total\n    ? Math.max(0, Math.round(((counts.present + counts.excused + counts.late * 0.5) / counts.total) * 100))\n    : 100;\n\n  return NextResponse.json({",
    "  const disciplineRate = counts.total\n    ? Math.max(0, Math.round(((counts.present + counts.excused + counts.late * 0.5) / counts.total) * 100))\n    : 100;\n\n  const serverGradePlan = gradePlanSnapshot && gradePlanSnapshot.exists\n    ? { id: gradePlanSnapshot.id, ...gradePlanSnapshot.data() } as Record<string, any>\n    : null;\n  const gradePlan = chooseStudentGradePlan(serverGradePlan, studentData);\n  const effectiveGradePlanId = String(gradePlan?.id || studentData.activeGradePlanId || activeGradePlanId || \"\");\n  const effectiveGradeValues = valuesForStudentPlan(studentData, effectiveGradePlanId);\n\n  return NextResponse.json({"
)
replace_once(
    "app/api/student/profile/route.ts",
    "      gradePlan: gradePlanSnapshot && gradePlanSnapshot.exists ? { id: gradePlanSnapshot.id, ...gradePlanSnapshot.data() } : null,",
    "      gradePlan,\n      activeGradePlanId: effectiveGradePlanId,\n      gradeValues: effectiveGradeValues,"
)

# 4) Initial student lookup must use the same preferred plan and plan-specific grades, not only the teacher cloud config.
replace_once(
    "app/api/student/lookup/route.ts",
    "function isQuotaError(error: unknown) {\n  const source = error as { code?: unknown; message?: unknown };\n  const text = `${String(source?.code || \"\")} ${String(source?.message || \"\")}`.toLowerCase();\n  return text.includes(\"resource-exhausted\") || text.includes(\"quota exceeded\");\n}\n\nfunction parseStudentPath",
    "function isQuotaError(error: unknown) {\n  const source = error as { code?: unknown; message?: unknown };\n  const text = `${String(source?.code || \"\")} ${String(source?.message || \"\")}`.toLowerCase();\n  return text.includes(\"resource-exhausted\") || text.includes(\"quota exceeded\");\n}\n\nfunction objectRecord(value: unknown): Record<string, any> | null {\n  return value && typeof value === \"object\" && !Array.isArray(value) ? value as Record<string, any> : null;\n}\n\nfunction planVersion(value: Record<string, any> | null) {\n  return Math.max(0, Number(value?.version || 0));\n}\n\nfunction planTime(value: Record<string, any> | null) {\n  return Date.parse(String(value?.activatedAt || value?.createdAt || \"\")) || 0;\n}\n\nfunction chooseStudentGradePlan(serverPlan: Record<string, unknown> | null, studentData: Record<string, unknown>) {\n  const cloud = objectRecord(serverPlan);\n  const embedded = objectRecord(studentData.gradePlanSnapshot) || objectRecord(studentData.gradePlan);\n  if (!cloud) return embedded;\n  if (!embedded) return cloud;\n  if (String(cloud.id || \"\") === String(embedded.id || \"\")) return cloud;\n  if (planVersion(cloud) !== planVersion(embedded)) return planVersion(cloud) > planVersion(embedded) ? cloud : embedded;\n  return planTime(cloud) >= planTime(embedded) ? cloud : embedded;\n}\n\nfunction valuesForStudentPlan(studentData: Record<string, unknown>, planId: string) {\n  const all = objectRecord(studentData.gradePlanValues);\n  const specific = planId && all ? objectRecord(all[planId]) : null;\n  return specific || objectRecord(studentData.gradeValues) || {};\n}\n\nfunction parseStudentPath"
)
replace_once(
    "app/api/student/lookup/route.ts",
    "    const matches = located.map(item => {\n      const candidate = chosenBySubject.get(item.subjectId)!;\n      const subject = getSubjectConfig(item.subjectId);\n      const accessToken = createStudentAccessToken({",
    "    const matches = located.map(item => {\n      const candidate = chosenBySubject.get(item.subjectId)!;\n      const subject = getSubjectConfig(item.subjectId);\n      const gradePlan = chooseStudentGradePlan(gradePlanByTeacher.get(item.teacherId) || null, item.data);\n      const effectiveGradePlanId = String(gradePlan?.id || item.data.activeGradePlanId || \"\");\n      const effectiveGradeValues = valuesForStudentPlan(item.data, effectiveGradePlanId);\n      const accessToken = createStudentAccessToken({"
)
replace_once(
    "app/api/student/lookup/route.ts",
    "          ...item.data,\n          gradePlan: gradePlanByTeacher.get(item.teacherId) || null,\n          absences: 0,",
    "          ...item.data,\n          gradePlan,\n          activeGradePlanId: effectiveGradePlanId,\n          gradeValues: effectiveGradeValues,\n          absences: 0,"
)

# 5) Student UI must calculate from the values belonging to the exact approved plan id.
replace_once(
    "app/student/page.tsx",
    "  const approvedPlan = useMemo(() => normalizeGradePlan(selected?.data.gradePlan), [selected?.data.gradePlan]);\n  const planResult = useMemo(() => approvedPlan ? calculateGradePlanResult(approvedPlan, selected?.data || {}) : null, [approvedPlan, selected]);",
    "  const approvedPlan = useMemo(() => normalizeGradePlan(selected?.data.gradePlan), [selected?.data.gradePlan]);\n  const studentDataForPlan = useMemo(() => {\n    const data = selected?.data;\n    if (!data || !approvedPlan) return data || {};\n    const specificValues = data.gradePlanValues?.[approvedPlan.id];\n    return {\n      ...data,\n      gradeValues: specificValues && typeof specificValues === \"object\" ? specificValues : (data.gradeValues || {}),\n    };\n  }, [selected?.data, approvedPlan?.id]);\n  const planResult = useMemo(() => approvedPlan ? calculateGradePlanResult(approvedPlan, studentDataForPlan) : null, [approvedPlan, studentDataForPlan]);"
)
replace_once(
    "app/student/page.tsx",
    "<svg className=\"print-bars-svg\" viewBox={`0 0 540 ${Math.max(170, units.length * 34 + 38)}`} role=\"img\" aria-label=\"مخطط درجات الوحدات\">",
    "<svg className=\"print-bars-svg\" viewBox={`0 0 540 ${Math.max(170, units.length * 34 + 38)}`} role=\"img\" aria-label={approvedPlan ? \"مخطط درجات أقسام الخطة المعتمدة\" : \"مخطط درجات الوحدات\"}>"
)

# 6) Force installed/PWA clients to load the linked student-grade version.
replace_once(
    "app/pwa-register.tsx",
    'const CURRENT_CACHE = "ostadh-lahooni-v98-full-grades-pdf";\nconst RELOAD_KEY = "ostadh-lahooni-v98-full-grades-pdf";',
    'const CURRENT_CACHE = "ostadh-lahooni-v99-gradebook-student-sync";\nconst RELOAD_KEY = "ostadh-lahooni-v99-gradebook-student-sync";'
)
replace_once(
    "app/pwa-register.tsx",
    'navigator.serviceWorker.register("/sw.js?v=98-full-grades-pdf", {',
    'navigator.serviceWorker.register("/sw.js?v=99-gradebook-student-sync", {'
)
replace_once(
    "public/sw.js",
    'const CACHE_NAME = "ostadh-lahooni-v98-full-grades-pdf";',
    'const CACHE_NAME = "ostadh-lahooni-v99-gradebook-student-sync";'
)

print("v99 gradebook/student sync patch applied")
