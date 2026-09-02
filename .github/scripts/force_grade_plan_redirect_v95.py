from pathlib import Path
import re

page = Path('app/teacher/grade-plan/page.tsx')
text = page.read_text(encoding='utf-8')

old_hook = 'const { activePlan, history, loading, error, refresh } = useGradePlan(true);'
if old_hook in text:
    text = text.replace(old_hook, 'const { activePlan, history, loading, error } = useGradePlan(true);')

old_approve = '''      // الاعتماد ناجح: انتقل صراحة إلى واجهة الخطة المعتمدة بدل البقاء في وضع البناء.\n      await refresh();\n      window.location.replace("/teacher/grades");\n      return;'''
new_approve = '''      // الاعتماد ناجح: افتح سجل الدرجات فورًا بدون انتظار أي إعادة تحميل للخطة.\n      window.location.replace("/teacher/grades");\n      return;'''
if old_approve in text:
    text = text.replace(old_approve, new_approve)
else:
    text = re.sub(
        r'\s*await refresh\(\);\s*window\.location\.replace\("/teacher/grades"\);\s*return;',
        '\n      window.location.replace("/teacher/grades");\n      return;',
        text,
        count=1,
    )

marker = '''  }, [loading, activePlan?.id]);\n\n  function startNew()'''
redirect_effect = '''  }, [loading, activePlan?.id]);\n\n  useEffect(() => {\n    if (loading || !activePlan || building || typeof window === "undefined") return;\n    const editRequested = new URLSearchParams(window.location.search).get("edit") === "1";\n    if (!editRequested) window.location.replace("/teacher/grades");\n  }, [loading, activePlan?.id, building]);\n\n  function startNew()'''
if marker in text and 'if (!editRequested) window.location.replace("/teacher/grades");' not in text:
    text = text.replace(marker, redirect_effect)

pattern = re.compile(
    r'  if \(activePlan && !building\) \{\n    return <main className="grade-plan-page" dir="rtl">.*?\n  \}\n\n  return <main className="grade-plan-page" dir="rtl">',
    re.S,
)
replacement = '''  if (activePlan && !building) {\n    return <main className="grade-plan-page" dir="rtl"><section className="grade-plan-loading">جارٍ فتح سجل الدرجات…</section></main>;\n  }\n\n  return <main className="grade-plan-page" dir="rtl">'''
text, replaced = pattern.subn(replacement, text, count=1)
if replaced != 1:
    raise SystemExit('Could not replace approved-plan view')

page.write_text(text, encoding='utf-8')

sw = Path('public/sw.js')
sw_text = sw.read_text(encoding='utf-8')
sw_text = re.sub(r'ostadh-lahooni-v\d+-[^"\n]+', 'ostadh-lahooni-v95-grade-plan-direct', sw_text, count=1)
sw.write_text(sw_text, encoding='utf-8')

pwa = Path('app/pwa-register.tsx')
pwa_text = pwa.read_text(encoding='utf-8')
pwa_text = re.sub(r'ostadh-lahooni-v\d+-[^"\n]+', 'ostadh-lahooni-v95-grade-plan-direct', pwa_text)
pwa_text = re.sub(r'/sw\.js\?v=[^"\']+', '/sw.js?v=95-grade-plan-direct', pwa_text)
pwa.write_text(pwa_text, encoding='utf-8')

checks = [
    'window.location.replace("/teacher/grades")',
    'if (!editRequested) window.location.replace("/teacher/grades");',
    'جارٍ فتح سجل الدرجات…',
]
for check in checks:
    if check not in text:
        raise SystemExit(f'Missing expected check: {check}')

print('grade-plan direct redirect v95 applied')
