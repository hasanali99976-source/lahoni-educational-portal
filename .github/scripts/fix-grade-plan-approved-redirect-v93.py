from pathlib import Path
import re

PAGE = Path('app/teacher/grade-plan/page.tsx')
PWA = Path('app/pwa-register.tsx')
SW = Path('public/sw.js')

page = PAGE.read_text(encoding='utf-8')
old = '''      await refresh();\n      setBuilding(false);\n      setMessage("تم اعتماد الخطة وقفلها. أصبحت هي مصدر الاحتساب في البوابة.");'''
new = '''      // الاعتماد ناجح: انتقل صراحة إلى واجهة الخطة المعتمدة بدل البقاء في وضع البناء.\n      await refresh();\n      window.location.replace("/teacher/grade-plan?view=approved");\n      return;'''
if old not in page:
    raise SystemExit('approve redirect anchor not found')
page = page.replace(old, new, 1)
PAGE.write_text(page, encoding='utf-8')

# Force installed/PWA clients to receive the redirect fix immediately.
for path in (PWA, SW):
    text = path.read_text(encoding='utf-8')
    text = text.replace('ostadh-lahooni-v92-onepage-weekly-all', 'ostadh-lahooni-v93-grade-plan-approved-redirect')
    text = text.replace('v=92-onepage-weekly-all', 'v=93-grade-plan-approved-redirect')
    path.write_text(text, encoding='utf-8')

print('grade plan approval now redirects to approved view; cache bumped to v93')
