from pathlib import Path

page_path = Path("app/teacher/report/page.tsx")
audit_path = Path("scripts/runtime-audit.mjs")
page = page_path.read_text(encoding="utf-8")

page = page.replace('import { collection, onSnapshot } from "firebase/firestore";\n', '', 1)
page = page.replace('import { db } from "../../../lib/firebase";\n', '', 1)
page = page.replace('import { tenantCollection } from "../../../lib/teacher-tenant";\n', '', 1)

old = '''  useEffect(()=>{\n    if(!session?.teacherId||!session?.subjectKey)return;\n    const path=tenantCollection(session.teacherId,session.subjectKey as never,"attendance");\n    return onSnapshot(collection(db,path),snapshot=>setAttendance(snapshot.docs.map(item=>item.data() as AttendanceRecord)),()=>setAttendance([]));\n  },[session?.teacherId,session?.subjectKey]);\n'''
new = '''  useEffect(()=>{\n    if(!session?.subjectKey)return;\n    const controller=new AbortController();\n    const formatter=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Riyadh",year:"numeric",month:"2-digit",day:"2-digit"});\n    const toDate=new Date();\n    const fromDate=new Date(toDate.getTime()-30*86_400_000);\n    const params=new URLSearchParams({subjectId:session.subjectKey,mode:"range",from:formatter.format(fromDate),to:formatter.format(toDate)});\n    fetch(`/api/teacher/attendance-report?${params.toString()}`,{cache:"no-store",signal:controller.signal})\n      .then(async response=>{const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||"تعذر تحميل الحضور");return data;})\n      .then(data=>setAttendance(Array.isArray(data.attendance)?data.attendance:[]))\n      .catch(error=>{if((error as Error)?.name!=="AbortError")setAttendance([]);});\n    return()=>controller.abort();\n  },[session?.subjectKey]);\n'''
if old in page:
    page = page.replace(old, new, 1)
elif '/api/teacher/attendance-report' not in page:
    raise SystemExit('teacher report listener block did not match')

page_path.write_text(page, encoding='utf-8')

audit = audit_path.read_text(encoding='utf-8')
rule = '''\nforbid(\n  "app/teacher/report/page.tsx",\n  /firebase\\/firestore|\\bonSnapshot\\s*\\(|\\bgetDocs\\s*\\(/,\n  "ملخص عمل المعلم يجب ألا يستمع إلى Firestore مباشرة من المتصفح.",\n);\nrequirePattern(\n  "app/teacher/report/page.tsx",\n  /\\/api\\/teacher\\/attendance-report/,\n  "ملخص عمل المعلم يجب أن يستخدم قراءة حضور خادمية محدودة.",\n);\n'''
if '"app/teacher/report/page.tsx"' not in audit:
    anchor = '// بيانات الدرجات المجمعة يجب أن تبقى خلف كاش خادمي قصير.\n'
    if anchor not in audit:
        raise SystemExit('teacher report audit insertion anchor not found')
    audit = audit.replace(anchor, rule + '\n' + anchor, 1)
elif 'ملخص عمل المعلم يجب ألا يستمع إلى Firestore مباشرة من المتصفح' not in audit:
    raise SystemExit('unexpected existing teacher report audit rule')
audit_path.write_text(audit, encoding='utf-8')
