from pathlib import Path

# Teacher AI: replace full roster onSnapshot with one server request.
ai_path = Path("app/teacher/ai/page.tsx")
ai = ai_path.read_text(encoding="utf-8")
ai = ai.replace('import { collection, doc, onSnapshot, setDoc } from "firebase/firestore";', 'import { doc, setDoc } from "firebase/firestore";', 1)
ai = ai.replace('  const studentsPath = useMemo(() => teacherId ? tenantCollection(teacherId, subjectKey as never, "students") : "", [teacherId, subjectKey]);\n', '', 1)
old_ai = '''  useEffect(() => {\n    if (!studentsPath) return;\n    return onSnapshot(collection(db, studentsPath), snapshot => setStudents(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as Student)).sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"))));\n  }, [studentsPath]);\n'''
new_ai = '''  useEffect(() => {\n    if (!session?.subjectKey) return;\n    const controller = new AbortController();\n    const params = new URLSearchParams({ subjectId: session.subjectKey });\n    if (session.activeGrade) params.set("grade", String(session.activeGrade));\n    fetch(`/api/teacher/students?${params.toString()}`, { cache: "no-store", signal: controller.signal })\n      .then(async response => { const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message || "تعذر تحميل الطلاب"); return data; })\n      .then(data => setStudents((Array.isArray(data.students) ? data.students : []).map((item: Record<string, unknown>) => ({ ...item, id: String(item.code || item.id || ""), class: String(item.className || item.class || "") } as Student)).sort((a: Student, b: Student) => (a.name || "").localeCompare(b.name || "", "ar"))))\n      .catch(error => { if ((error as Error)?.name !== "AbortError") setMessage("تعذر تحميل طلاب مادة المعلم الحالي"); });\n    return () => controller.abort();\n  }, [session?.subjectKey, session?.activeGrade]);\n'''
if old_ai in ai:
    ai = ai.replace(old_ai, new_ai, 1)
elif '/api/teacher/students' not in ai:
    raise SystemExit('teacher AI roster listener block did not match')
ai_path.write_text(ai, encoding='utf-8')

# Research: use the same bounded/server roster source; preserve direct writes to existing tenant docs.
research_path = Path("app/teacher/research/page.tsx")
research = research_path.read_text(encoding="utf-8")
research = research.replace('import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";', 'import { doc, updateDoc } from "firebase/firestore";', 1)
research = research.replace('import { ClientTenant, migrateLegacyHistoryStudents, tenantStudentsPath } from "../../../lib/firestore-tenant-client";', 'import { ClientTenant, tenantStudentsPath } from "../../../lib/firestore-tenant-client";', 1)
old_research = '''  useEffect(()=>{ if(!tenant){ setMessage("انتهت جلسة المعلم. سجّل الدخول من جديد."); return; } let unsubscribe=()=>{};let cancelled=false; migrateLegacyHistoryStudents(db,tenant).catch(()=>{}).finally(()=>{ if(cancelled) return; unsubscribe=onSnapshot(collection(db,tenantStudentsPath(tenant)),snapshot=>{const list=snapshot.docs.map(item=>({id:item.id,...item.data()})) as Student[];list.sort((a,b)=>(a.name||"").localeCompare(b.name||"","ar"));setStudents(list);},()=>setMessage("تعذر تحميل طلاب مادة المعلم الحالي"));}); return ()=>{cancelled=true;unsubscribe();}; },[tenant]);\n'''
new_research = '''  useEffect(()=>{\n    if(!tenant||!session?.subjectKey){setMessage("انتهت جلسة المعلم. سجّل الدخول من جديد.");return;}\n    const controller=new AbortController();\n    const params=new URLSearchParams({subjectId:session.subjectKey});\n    if(session.activeGrade)params.set("grade",String(session.activeGrade));\n    fetch(`/api/teacher/students?${params.toString()}`,{cache:"no-store",signal:controller.signal})\n      .then(async response=>{const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||"تعذر تحميل الطلاب");return data;})\n      .then(data=>{const list=(Array.isArray(data.students)?data.students:[]).map((item:Record<string,unknown>)=>({...item,id:String(item.code||item.id||""),class:String(item.className||item.class||"")} as Student));list.sort((a:Student,b:Student)=>(a.name||"").localeCompare(b.name||"","ar"));setStudents(list);})\n      .catch(error=>{if((error as Error)?.name!=="AbortError")setMessage("تعذر تحميل طلاب مادة المعلم الحالي");});\n    return()=>controller.abort();\n  },[tenant,session?.subjectKey,session?.activeGrade]);\n'''
if old_research in research:
    research = research.replace(old_research, new_research, 1)
elif '/api/teacher/students' not in research:
    raise SystemExit('research roster listener block did not match')
research_path.write_text(research, encoding='utf-8')

# Protect both active routes from listener regression.
audit_path = Path("scripts/runtime-audit.mjs")
audit = audit_path.read_text(encoding="utf-8")
rule = '''\nfor (const route of ["app/teacher/ai/page.tsx", "app/teacher/research/page.tsx"]) {\n  forbid(\n    route,\n    /\\bonSnapshot\\s*\\(|\\bgetDocs\\s*\\(/,\n    "صفحات المعلم النشطة يجب ألا تراقب قائمة الطلاب كاملة من Firestore.",\n  );\n  requirePattern(\n    route,\n    /\\/api\\/teacher\\/students/,\n    "صفحات المعلم النشطة يجب أن تحمل القائمة مرة واحدة من API الطلاب.",\n  );\n}\n'''
if 'for (const route of ["app/teacher/ai/page.tsx", "app/teacher/research/page.tsx"])' not in audit:
    anchor = '// حماية المتابعة الذكية: لا مراقبة حية لمجموعة الطلاب كاملة.\n'
    if anchor not in audit:
        raise SystemExit('teacher roster audit insertion anchor not found')
    audit = audit.replace(anchor, rule + '\n' + anchor, 1)
audit_path.write_text(audit, encoding='utf-8')
