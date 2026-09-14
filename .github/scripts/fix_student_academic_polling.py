from pathlib import Path

page_path = Path("app/student/academic-record/page.tsx")
audit_path = Path("scripts/runtime-audit.mjs")

page = page_path.read_text(encoding="utf-8")
page = page.replace(
    'import { FormEvent, useEffect, useMemo, useRef, useState } from "react";',
    'import { FormEvent, useMemo, useState } from "react";',
    1,
)
page = page.replace(
    'const[matches,setMatches]=useState<Match[]>([]);const[selectedKey,setSelectedKey]=useState("");const[live,setLive]=useState<Change[]>([]);const refreshTimer=useRef<number|undefined>(undefined);',
    'const[matches,setMatches]=useState<Match[]>([]);const[selectedKey,setSelectedKey]=useState("");const[live,setLive]=useState<Change[]>([]);',
    1,
)
old = ''' useEffect(()=>()=>{if(refreshTimer.current)window.clearTimeout(refreshTimer.current)},[]);\n useEffect(()=>{if(!matches.length)return;const run=async()=>{const before=snapshotFor(matches);const updated=await Promise.all(matches.map(hydrate));const after=snapshotFor(updated);const changed=liveChanges(before,after,updated);if(changed.length)setLive(current=>[...changed,...current].slice(0,30));setMatches(updated);refreshTimer.current=window.setTimeout(run,15000)};refreshTimer.current=window.setTimeout(run,15000);return()=>{if(refreshTimer.current)window.clearTimeout(refreshTimer.current)}},[matches.length]);\n'''
new = ''' // لا يوجد polling خلفي هنا: الملف الشخصي يُقرأ مرة عند الدخول فقط.\n'''
if old in page:
    page = page.replace(old, new, 1)
elif "refreshTimer.current=window.setTimeout(run,15000)" in page:
    raise SystemExit("student academic polling block changed unexpectedly")
page_path.write_text(page, encoding="utf-8")

audit = audit_path.read_text(encoding="utf-8")
rule = '''\nforbid(\n  "app/student/academic-record/page.tsx",\n  /setInterval\\s*\\(|setTimeout\\s*\\(\\s*run\\s*,|refreshTimer/,\n  "السجل الأكاديمي للطالب يجب ألا يشغّل أي polling دوري بالخلفية.",\n);\n'''
if '"app/student/academic-record/page.tsx"' not in audit:
    anchor = '''forbid(\n  "app/student-academic-record-bridge.tsx",\n  /setInterval\\s*\\(/,\n  "السجل الأكاديمي المدمج لا يكرر قراءة بيانات الطالب دوريًا؛ التحديث يكون عند الفتح أو عودة التركيز.",\n);\n'''
    if anchor not in audit:
        raise SystemExit("student academic audit insertion anchor not found")
    audit = audit.replace(anchor, anchor + rule, 1)
elif "السجل الأكاديمي للطالب يجب ألا يشغّل أي polling دوري بالخلفية" not in audit:
    raise SystemExit("unexpected existing academic-record audit rule")
audit_path.write_text(audit, encoding="utf-8")
