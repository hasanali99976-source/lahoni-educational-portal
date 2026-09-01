from pathlib import Path

layout_path = Path('app/student/layout.tsx')
layout = layout_path.read_text(encoding='utf-8')
import_line = 'import "./student-clarity-v69.css";\n'
if import_line not in layout:
    anchor = 'import "./student-dashboard-v68.css";\n'
    if anchor not in layout:
        raise SystemExit('v68 layout import anchor not found')
    layout = layout.replace(anchor, anchor + import_line, 1)
layout_path.write_text(layout, encoding='utf-8')

pwa_path = Path('app/pwa-register.tsx')
pwa = pwa_path.read_text(encoding='utf-8')
pwa = pwa.replace('ostadh-lahooni-v68-student-dashboard-svg', 'ostadh-lahooni-v69-student-tabs-print-clarity')
pwa = pwa.replace('/sw.js?v=68-student-dashboard-svg', '/sw.js?v=69-student-tabs-print-clarity')
pwa_path.write_text(pwa, encoding='utf-8')

sw_path = Path('public/sw.js')
sw = sw_path.read_text(encoding='utf-8')
sw = sw.replace('ostadh-lahooni-v68-student-dashboard-svg', 'ostadh-lahooni-v69-student-tabs-print-clarity')
sw_path.write_text(sw, encoding='utf-8')

css_path = Path('app/student/student-clarity-v69.css')
if not css_path.exists():
    raise SystemExit('v69 CSS file is missing')
