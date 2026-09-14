from pathlib import Path

page_path = Path('app/teacher/follow-up/page.tsx')
source = page_path.read_text(encoding='utf-8')
source = source.replace(
    'import { collection, doc, increment, onSnapshot, setDoc } from "firebase/firestore";',
    'import { doc, increment, setDoc } from "firebase/firestore";'
)
old = '''  useEffect(() => {
    if (!studentsPath) return;
    return onSnapshot(collection(db, studentsPath), snapshot => {
      setStoredStudents(snapshot.docs.map(item => ({ id: item.id, ...item.data() })) as Student[]);
    }, () => setMessage("تعذر تحميل بيانات الطلاب."));
  }, [studentsPath]);
'''
new = '''  useEffect(() => {
    if (!teacherId || !subjectKey) { setStoredStudents([]); return; }
    const controller = new AbortController();
    fetch(`/api/teacher/grade-data?subjectId=${encodeURIComponent(String(subjectKey).split("--")[0])}`, {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "تعذر تحميل بيانات الطلاب.");
        const byCode = data.byCode && typeof data.byCode === "object" ? data.byCode as Record<string, Record<string, unknown>> : {};
        setStoredStudents(Object.entries(byCode).map(([code, row]) => ({
          ...row,
          id: String(row.documentId || code),
          code: String(row.code || row.accessCode || row.studentCode || code),
        })) as Student[]);
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setMessage(error instanceof Error ? error.message : "تعذر تحميل بيانات الطلاب.");
      });
    return () => controller.abort();
  }, [teacherId, subjectKey]);
'''
if old not in source:
    raise SystemExit('follow-up listener block not found; refusing unsafe edit')
source = source.replace(old, new)
page_path.write_text(source, encoding='utf-8')

audit_path = Path('scripts/runtime-audit.mjs')
audit = audit_path.read_text(encoding='utf-8')
marker = '// حماية المتابعة الذكية: لا مراقبة حية لمجموعة الطلاب كاملة.'
if marker not in audit:
    insert = '''\n// حماية المتابعة الذكية: لا مراقبة حية لمجموعة الطلاب كاملة.\nforbid(\n  "app/teacher/follow-up/page.tsx",\n  /\\bonSnapshot\\s*\\(|firebase\\/firestore[^\\n]*\\bcollection\\b/,\n  "صفحة الإتقان والمتابعة يجب ألا تراقب مجموعة الطلاب كاملة مباشرة من Firestore.",\n);\nrequirePattern(\n  "app/teacher/follow-up/page.tsx",\n  /\\/api\\/teacher\\/grade-data/,\n  "صفحة الإتقان والمتابعة يجب أن تستخدم بيانات التحصيل المخزنة خادميًا بدل الاستماع الحي.",\n);\n'''
    audit = audit.replace('\nconst teacherRosterRequests = count(', insert + '\nconst teacherRosterRequests = count(')
    audit_path.write_text(audit, encoding='utf-8')
