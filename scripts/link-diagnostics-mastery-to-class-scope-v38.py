from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"missing pattern: {label}")
    return text.replace(old, new, 1)

# Diagnostic results: use the official teacher class scope API instead of
# inferring classes from every legacy student document in Firestore.
diag_path = Path("app/teacher/diagnostics/diagnostic-results.tsx")
diag = diag_path.read_text(encoding="utf-8")

diag = replace_once(
    diag,
    'type Result = {',
    'type SchoolClass = { id: string; name: string; grade?: number; section?: string };\ntype Result = {',
    "diagnostic SchoolClass type",
)

diag = replace_once(
    diag,
    '''  subjectName,\n  diagnostics,\n  diagnosticsLoaded,\n}: {\n  teacherId: string;\n  subjectKey: SubjectKey;\n  subjectName: string;\n  diagnostics: Diagnostic[];\n  diagnosticsLoaded: boolean;\n}) {''',
    '''  subjectName,\n  activeGrade,\n  diagnostics,\n  diagnosticsLoaded,\n}: {\n  teacherId: string;\n  subjectKey: SubjectKey;\n  subjectName: string;\n  activeGrade: number | null;\n  diagnostics: Diagnostic[];\n  diagnosticsLoaded: boolean;\n}) {''',
    "diagnostic activeGrade prop",
)

diag = replace_once(
    diag,
    '''  const [results, setResults] = useState<Result[]>([]);\n  const [students, setStudents] = useState<Student[]>([]);''',
    '''  const [results, setResults] = useState<Result[]>([]);\n  const [students, setStudents] = useState<Student[]>([]);\n  const [scopeClasses, setScopeClasses] = useState<SchoolClass[]>([]);\n  const [rosterLoading, setRosterLoading] = useState(false);''',
    "diagnostic scope state",
)

diag = replace_once(
    diag,
    '''  const resultsPath = tenantCollection(teacherId, subjectKey, "diagnosticResults");\n  const studentsPath = tenantCollection(teacherId, subjectKey, "students");\n\n  useEffect(() => {\n    const stopResults = onSnapshot(collection(db, resultsPath), snapshot => {\n      setResults(snapshot.docs.map(item => ({ id: item.id, ...(item.data() as Omit<Result, "id">) })));\n    });\n    const stopStudents = onSnapshot(collection(db, studentsPath), snapshot => {\n      setStudents(snapshot.docs\n        .map(item => ({ id: item.id, ...(item.data() as Omit<Student, "id">) }))\n        .filter(student => student.active !== false && student.rosterActive !== false));\n    });\n    return () => { stopResults(); stopStudents(); };\n  }, [resultsPath, studentsPath]);\n\n  const classes = useMemo(() => [...new Set(students.map(classOf).filter(Boolean))]\n    .sort((a, b) => classOrder(a) - classOrder(b) || a.localeCompare(b, "ar", { numeric: true })), [students]);''',
    '''  const resultsPath = tenantCollection(teacherId, subjectKey, "diagnosticResults");\n\n  useEffect(() => onSnapshot(collection(db, resultsPath), snapshot => {\n    setResults(snapshot.docs.map(item => ({ id: item.id, ...(item.data() as Omit<Result, "id">) })));\n  }), [resultsPath]);\n\n  useEffect(() => {\n    if (!teacherId || !subjectKey || !activeGrade) {\n      setStudents([]);\n      setScopeClasses([]);\n      return;\n    }\n    const controller = new AbortController();\n    const params = new URLSearchParams({ subjectId: subjectKey, grade: String(activeGrade) });\n    setRosterLoading(true);\n    fetch(`/api/teacher/students?${params.toString()}`, { cache: "no-store", signal: controller.signal })\n      .then(async response => {\n        const data = await response.json().catch(() => ({}));\n        if (!response.ok) throw new Error(data.message || "تعذر تحميل الفصول المحددة.");\n        setStudents((Array.isArray(data.students) ? data.students : []).map((student: Student) => ({\n          ...student,\n          class: student.className || student.class || "",\n        })));\n        setScopeClasses(Array.isArray(data.classes) ? data.classes : []);\n      })\n      .catch(error => {\n        if (error instanceof DOMException && error.name === "AbortError") return;\n        setStudents([]);\n        setScopeClasses([]);\n        setMessage(error instanceof Error ? error.message : "تعذر تحميل الفصول المحددة.");\n      })\n      .finally(() => setRosterLoading(false));\n    return () => controller.abort();\n  }, [teacherId, subjectKey, activeGrade]);\n\n  const classes = useMemo(() => [...new Set(scopeClasses.map(item => classKey(item.name)).filter(Boolean))]\n    .sort((a, b) => classOrder(a) - classOrder(b) || a.localeCompare(b, "ar", { numeric: true })), [scopeClasses]);''',
    "diagnostic scoped roster loading",
)

diag = replace_once(
    diag,
    '''  useEffect(() => {\n    if (classes.length && !classes.includes(className)) setClassName(classes[0]);\n  }, [classes, className]);''',
    '''  useEffect(() => {\n    if (!classes.length) { setClassName(""); return; }\n    if (!classes.includes(className)) setClassName(classes[0]);\n  }, [classes, className]);''',
    "diagnostic class selection reset",
)

diag = replace_once(
    diag,
    '''    {!diagnosticsLoaded ? <p className="diag-empty">جارٍ تحميل الاختبارات الحالية…</p> : !diagnostics.length ? <p className="diag-empty">لا توجد اختبارات تشخيصية منشأة حتى الآن.</p> : null}\n\n    <div className="diag-list-tools diag-list-tools-first">''',
    '''    {!diagnosticsLoaded ? <p className="diag-empty">جارٍ تحميل الاختبارات الحالية…</p> : !diagnostics.length ? <p className="diag-empty">لا توجد اختبارات تشخيصية منشأة حتى الآن.</p> : null}\n    {rosterLoading ? <p className="diag-empty">جارٍ تحميل الفصول المحددة من إدارة الفصول…</p> : !classes.length ? <p className="diag-empty">لا توجد فصول محددة لهذه المادة. افتح «إدارة الطلاب ← إدارة فصولي» وحدد الفصول أولًا.</p> : null}\n\n    <div className="diag-list-tools diag-list-tools-first">''',
    "diagnostic scope status message",
)

diag_path.write_text(diag, encoding="utf-8")

# Pass the active grade into the diagnostic roster component.
diag_page_path = Path("app/teacher/diagnostics/page.tsx")
diag_page = diag_page_path.read_text(encoding="utf-8")
diag_page = replace_once(
    diag_page,
    '''<DiagnosticResults teacherId={session.teacherId} subjectKey={session.subjectKey as SubjectKey} subjectName={session.subject || "المادة"} diagnostics={items.map(item => ({ id: item.id, title: item.title }))} diagnosticsLoaded={diagnosticsLoaded} />''',
    '''<DiagnosticResults teacherId={session.teacherId} subjectKey={session.subjectKey as SubjectKey} subjectName={session.subject || "المادة"} activeGrade={session.activeGrade || null} diagnostics={items.map(item => ({ id: item.id, title: item.title }))} diagnosticsLoaded={diagnosticsLoaded} />''',
    "diagnostic page active grade",
)
diag_page_path.write_text(diag_page, encoding="utf-8")

# Mastery/follow-up: keep live grade data from Firestore, but constrain the
# visible students and class selector to the official saved class scope.
follow_path = Path("app/teacher/follow-up/page.tsx")
follow = follow_path.read_text(encoding="utf-8")
follow = replace_once(
    follow,
    '''type Student = { id: string; name?: string; class?: string; researchScore?: number; teacherNote?: string; units?: Record<string, UnitRecord> };''',
    '''type Student = { id: string; storageId?: string; name?: string; class?: string; className?: string; code?: string; accessCode?: string; studentCode?: string; researchScore?: number; teacherNote?: string; units?: Record<string, UnitRecord> };\ntype SchoolClass = { id: string; name: string; grade?: number; section?: string };''',
    "follow-up student type",
)
follow = replace_once(
    follow,
    '''function level(total: number) { if (total >= 90) return { label: "متقن بتميز", className: "excellent" }; if (total >= 80) return { label: "متقن", className: "mastered" }; if (total >= 60) return { label: "غير متقن", className: "warning" }; return { label: "يحتاج تدخلًا", className: "danger" }; }''',
    '''function level(total: number) { if (total >= 90) return { label: "متقن بتميز", className: "excellent" }; if (total >= 80) return { label: "متقن", className: "mastered" }; if (total >= 60) return { label: "غير متقن", className: "warning" }; return { label: "يحتاج تدخلًا", className: "danger" }; }\nfunction aliases(student: Student) { return [...new Set([student.id, student.code, student.accessCode, student.studentCode].map(value => String(value || "").trim()).filter(Boolean))]; }''',
    "follow-up aliases",
)
follow = replace_once(
    follow,
    '''  const teacherId = session.teacherId || "", teacherName = session.teacherName || "المعلم", subjectKey = session.subjectKey || "history", subject = session.subject || "المادة";\n  const [students, setStudents] = useState<Student[]>([]), [selectedClass, setSelectedClass] = useState(""), [selectedStudent, setSelectedStudent] = useState(""), [threshold, setThreshold] = useState(80);''',
    '''  const teacherId = session.teacherId || "", teacherName = session.teacherName || "المعلم", subjectKey = session.subjectKey || "history", subject = session.subject || "المادة", activeGrade = session.activeGrade || null;\n  const [storedStudents, setStoredStudents] = useState<Student[]>([]), [scopeStudents, setScopeStudents] = useState<Student[]>([]), [scopeClasses, setScopeClasses] = useState<SchoolClass[]>([]), [scopeLoading, setScopeLoading] = useState(false);\n  const [selectedClass, setSelectedClass] = useState(""), [selectedStudent, setSelectedStudent] = useState(""), [threshold, setThreshold] = useState(80);''',
    "follow-up scoped states",
)
follow = replace_once(
    follow,
    '''  useEffect(() => { if (!studentsPath) return; return onSnapshot(collection(db, studentsPath), snapshot => { const list = snapshot.docs.map(item => ({ id: item.id, ...item.data() })) as Student[]; setStudents(list.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"))); }, () => setMessage("تعذر تحميل بيانات الطلاب.")); }, [studentsPath]);\n  const classes = useMemo(() => Array.from(new Set(students.map(student => (student.class || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ar")), [students]);\n  const classStudents = useMemo(() => students.filter(student => !selectedClass || (student.class || "").trim() === selectedClass), [students, selectedClass]);''',
    '''  useEffect(() => { if (!studentsPath) return; return onSnapshot(collection(db, studentsPath), snapshot => { const list = snapshot.docs.map(item => ({ id: item.id, ...item.data() })) as Student[]; setStoredStudents(list); }, () => setMessage("تعذر تحميل بيانات الطلاب.")); }, [studentsPath]);\n\n  useEffect(() => {\n    if (!teacherId || !subjectKey || !activeGrade) { setScopeStudents([]); setScopeClasses([]); return; }\n    const controller = new AbortController();\n    const params = new URLSearchParams({ subjectId: subjectKey, grade: String(activeGrade) });\n    setScopeLoading(true);\n    fetch(`/api/teacher/students?${params.toString()}`, { cache: "no-store", signal: controller.signal })\n      .then(async response => {\n        const data = await response.json().catch(() => ({}));\n        if (!response.ok) throw new Error(data.message || "تعذر تحميل الفصول المحددة.");\n        setScopeStudents(Array.isArray(data.students) ? data.students : []);\n        setScopeClasses(Array.isArray(data.classes) ? data.classes : []);\n      })\n      .catch(error => {\n        if (error instanceof DOMException && error.name === "AbortError") return;\n        setScopeStudents([]); setScopeClasses([]);\n        setMessage(error instanceof Error ? error.message : "تعذر تحميل الفصول المحددة.");\n      })\n      .finally(() => setScopeLoading(false));\n    return () => controller.abort();\n  }, [teacherId, subjectKey, activeGrade]);\n\n  const students = useMemo(() => {\n    const liveByAlias = new Map<string, Student>();\n    storedStudents.forEach(student => aliases(student).forEach(alias => liveByAlias.set(alias, student)));\n    return scopeStudents.map(rosterStudent => {\n      const live = aliases(rosterStudent).map(alias => liveByAlias.get(alias)).find(Boolean);\n      const officialClass = String(rosterStudent.className || rosterStudent.class || "").trim();\n      return {\n        ...rosterStudent,\n        ...(live || {}),\n        id: rosterStudent.id,\n        storageId: live?.id || rosterStudent.id,\n        code: rosterStudent.code || live?.code,\n        class: officialClass,\n        className: officialClass,\n      };\n    }).sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"));\n  }, [scopeStudents, storedStudents]);\n  const classes = useMemo(() => scopeClasses.map(item => item.name), [scopeClasses]);\n  useEffect(() => { if (selectedClass && !classes.includes(selectedClass)) { setSelectedClass(""); setSelectedStudent(""); } }, [classes, selectedClass]);\n  const classStudents = useMemo(() => students.filter(student => !selectedClass || (student.class || "").trim() === selectedClass), [students, selectedClass]);''',
    "follow-up scoped roster merge",
)
follow = follow.replace('doc(db, studentsPath, student.id)', 'doc(db, studentsPath, student.storageId || student.id)')
follow = follow.replace('doc(db, studentsPath, noteStudent.id)', 'doc(db, studentsPath, noteStudent.storageId || noteStudent.id)')
follow = replace_once(
    follow,
    '''    <section className="follow-head"><div><span>متابعة التحصيل — {subject}</span><h1>متابعة أداء الطلاب</h1><p>اعرض جميع الفصول أو فصلًا أو طالبًا، ثم اتخذ إجراءً واضحًا.</p></div><div className="follow-filters">''',
    '''    <section className="follow-head"><div><span>متابعة التحصيل — {subject}</span><h1>متابعة أداء الطلاب</h1><p>تظهر هنا فقط الفصول المحددة من «إدارة فصولي»، ثم يمكنك اختيار فصل أو طالب واتخاذ الإجراء المناسب.</p></div><div className="follow-filters">''',
    "follow-up header wording",
)
follow = replace_once(
    follow,
    '''    <section className="follow-overview">''',
    '''    {scopeLoading ? <p className="follow-toast" role="status">جارٍ تحميل الفصول المحددة من إدارة الفصول…</p> : !classes.length ? <p className="follow-toast" role="status">لا توجد فصول محددة لهذه المادة. افتح «إدارة الطلاب ← إدارة فصولي» وحدد الفصول أولًا.</p> : null}\n    <section className="follow-overview">''',
    "follow-up scope message",
)
follow_path.write_text(follow, encoding="utf-8")

# Force installed apps to discard the old class list cache.
for path in [Path("app/pwa-register.tsx"), Path("public/sw.js")]:
    text = path.read_text(encoding="utf-8")
    text = text.replace("ostadh-lahooni-v37-mobile-layout-fix", "ostadh-lahooni-v38-class-scope")
    text = text.replace("37-mobile-layout-fix", "38-class-scope")
    path.write_text(text, encoding="utf-8")
