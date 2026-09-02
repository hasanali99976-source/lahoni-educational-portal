from pathlib import Path
import re

root = Path(__file__).resolve().parents[2]

# 1) Force the installed PWA to pick up the current UI instead of retaining old v74 markers.
pwa = root / "app/pwa-register.tsx"
text = pwa.read_text(encoding="utf-8")
text = re.sub(r'const CURRENT_CACHE = "[^"]+";', 'const CURRENT_CACHE = "ostadh-lahooni-v87-visible-evaluation-plans";', text, count=1)
text = re.sub(r'const RELOAD_KEY = "[^"]+";', 'const RELOAD_KEY = "ostadh-lahooni-v87-visible-evaluation-plans-reloaded";', text, count=1)
text = re.sub(r'navigator\.serviceWorker\.register\("/sw\.js\?v=[^"]+"', 'navigator.serviceWorker.register("/sw.js?v=87-visible-evaluation-plans"', text, count=1)
pwa.write_text(text, encoding="utf-8")

sw = root / "public/sw.js"
text = sw.read_text(encoding="utf-8")
text = re.sub(r'const CACHE_NAME = "[^"]+";', 'const CACHE_NAME = "ostadh-lahooni-v87-visible-evaluation-plans";', text, count=1)
sw.write_text(text, encoding="utf-8")

# 2) Move evaluation plans to the main teacher navigation so it is not hidden in “More”.
layout = root / "app/teacher/layout.tsx"
text = layout.read_text(encoding="utf-8")
evaluation_line = '  { href: "/teacher/evaluation-plans", key: "evaluation", label: "خطط التقييم", note: "جدولة أدوات التقويم ودرجاتها" },\n'
text = text.replace(evaluation_line, "")
primary_anchor = '  { href: "/teacher/grades", key: "grades", label: "الدرجات", note: "الرصد والحفظ" },\n'
if evaluation_line.strip() not in text:
    if primary_anchor not in text:
        raise SystemExit("primary navigation anchor not found")
    text = text.replace(primary_anchor, primary_anchor + evaluation_line, 1)
layout.write_text(text, encoding="utf-8")

# 3) Make it obvious from the dashboard too.
dashboard = root / "app/teacher/dashboard/page.tsx"
text = dashboard.read_text(encoding="utf-8")
action_anchor = '        <Link className="daily-action" href="/teacher/grades"><span>٪</span><div><b>رصد الدرجات</b><small>إدخال الدرجات وحفظها سحابيًا</small></div></Link>\n'
plan_action = '        <Link className="daily-action" href="/teacher/evaluation-plans"><span>▣</span><div><b>خطط التقييم</b><small>جدولة الاختبارات والمهام وربطها بالفصول</small></div></Link>\n'
if plan_action not in text:
    if action_anchor not in text:
        raise SystemExit("dashboard action anchor not found")
    text = text.replace(action_anchor, action_anchor + plan_action, 1)
dashboard.write_text(text, encoding="utf-8")

# 4) Expose plans in the global mobile app navigation as well.
mobile = root / "app/mobile-app-enhancer.tsx"
text = mobile.read_text(encoding="utf-8")
text = text.replace('type IconName = "home" | "students" | "attendance" | "grades" | "tests" | "ai" | "admin" | "back";', 'type IconName = "home" | "students" | "attendance" | "grades" | "plans" | "tests" | "ai" | "admin" | "back";')
icon_anchor = '    grades: <><rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M8 8h8M8 12h5M8 16h3"/><path d="m15 16 1.5 1.5L20 14"/></>,\n'
plans_icon = '    plans: <><rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M8 2.8v3M16 2.8v3M7.5 9.5h9M8 13h3M14 13h2M8 16.5h5"/></>,\n'
if plans_icon not in text:
    if icon_anchor not in text:
        raise SystemExit("mobile icon anchor not found")
    text = text.replace(icon_anchor, icon_anchor + plans_icon, 1)
link_anchor = '      { href: "/teacher/grades", label: "الدرجات", icon: "grades" },\n'
plan_link = '      { href: "/teacher/evaluation-plans", label: "الخطط", icon: "plans" },\n'
if plan_link not in text:
    if link_anchor not in text:
        raise SystemExit("mobile plans link anchor not found")
    text = text.replace(link_anchor, link_anchor + plan_link, 1)
mobile.write_text(text, encoding="utf-8")

# 5) Make the new attendance PDF controls visibly distinguishable.
attendance = root / "app/teacher/attendance/page.tsx"
text = attendance.read_text(encoding="utf-8")
text = text.replace('تحميل PDF كامل — كل الطلاب', 'PDF الحضور الجديد — الفصل')
text = text.replace('تحميل PDF لجميع الفصول', 'PDF الحضور الجديد — جميع الفصول')
attendance.write_text(text, encoding="utf-8")

print("v87 visibility and PWA refresh patch applied")
