from pathlib import Path
import re

ROOT = Path('.')
PAGE = ROOT / 'app/student/page.tsx'
LAYOUT = ROOT / 'app/student/layout.tsx'
CSS = ROOT / 'app/student/student-lite-v61.css'
SW = ROOT / 'public/sw.js'
PWA = ROOT / 'app/pwa-register.tsx'


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'missing pattern: {label}')
    return text.replace(old, new, 1)

page = PAGE.read_text(encoding='utf-8')

page = replace_once(
    page,
    'type StudentTab = "home" | "grades" | "tests" | "plan" | "ai";',
    'type StudentTab = "home" | "grades" | "tests" | "more" | "plan" | "ai";',
    'student tab union',
)

old_tabs = '''const tabs: { key: StudentTab; icon: string; label: string; note: string }[] = [
  { key: "home", icon: "⌂", label: "الرئيسية", note: "ملخص اليوم" },
  { key: "grades", icon: "▥", label: "درجاتي", note: "الأداء والتقدم" },
  { key: "tests", icon: "✓", label: "اختباراتي", note: "الاختبارات والنتائج" },
  { key: "plan", icon: "◎", label: "خطتي", note: "هدفي ومهامي" },
  { key: "ai", icon: "✦", label: "المساعد الذكي", note: "نصيحة وشرح" },
];'''
new_tabs = '''const tabs: { key: StudentTab; icon: string; label: string; note: string }[] = [
  { key: "home", icon: "⌂", label: "الرئيسية", note: "ملخصك" },
  { key: "grades", icon: "▥", label: "درجاتي", note: "النتائج" },
  { key: "tests", icon: "✓", label: "اختباراتي", note: "الاختبارات" },
  { key: "more", icon: "•••", label: "المزيد", note: "خيارات إضافية" },
];'''
page = replace_once(page, old_tabs, new_tabs, 'tabs list')

old_actions = '''      <div className="student-head-actions">
        <button type="button" data-student-action="print" onClick={() => window.print()}>طباعة / PDF</button>
        <button type="button" data-student-action="subjects" className="ghost" onClick={showStudentSubjects}>المواد</button>
        <button type="button" data-student-action="logout" className="ghost" onClick={exitStudentPortal}>تسجيل الخروج</button>
      </div>'''
new_actions = '''      <div className="student-head-actions">
        <button type="button" data-student-action="subjects" className="ghost" onClick={showStudentSubjects}>تغيير المادة</button>
      </div>'''
page = replace_once(page, old_actions, new_actions, 'header actions')

old_nav = '<nav className="student-portal-tabs" aria-label="أقسام بوابة الطالب">{tabs.map(tab => <button type="button" key={tab.key} className={activeTab === tab.key ? "active" : ""} onClick={() => setActiveTab(tab.key)}><span>{tab.icon}</span><div><b>{tab.label}</b><small>{tab.note}</small></div></button>)}</nav>'
new_nav = '<nav className="student-portal-tabs" aria-label="أقسام بوابة الطالب">{tabs.map(tab => <button type="button" key={tab.key} className={activeTab === tab.key || (tab.key === "more" && (activeTab === "plan" || activeTab === "ai")) ? "active" : ""} onClick={() => setActiveTab(tab.key)}><span>{tab.icon}</span><div><b>{tab.label}</b><small>{tab.note}</small></div></button>)}</nav>'
page = replace_once(page, old_nav, new_nav, 'mobile nav')

old_tests = '    {activeTab === "tests" && <div className="student-tab-panel"><StudentDiagnostics accessToken={selected.accessToken} /></div>}\n\n'
more_panel = '''    {activeTab === "tests" && <div className="student-tab-panel"><StudentDiagnostics accessToken={selected.accessToken} /></div>}

    {activeTab === "more" && <section className="student-more-panel student-tab-panel">
      <div className="student-section-title"><small>كل شيء في مكان واحد</small><h2>المزيد</h2><p>افتح الخيار الذي تحتاجه فقط؛ لن تظهر هذه الأدوات في الواجهة الرئيسية.</p></div>
      <div className="student-more-grid">
        <button type="button" onClick={() => setActiveTab("plan")}><span>◎</span><div><strong>خطتي الدراسية</strong><small>الهدف ومهمة اليوم</small></div><b>فتح</b></button>
        <button type="button" onClick={() => setActiveTab("ai")}><span>✦</span><div><strong>المساعد التعليمي</strong><small>تحليل المستوى ونصيحة مناسبة</small></div><b>فتح</b></button>
        <button type="button" onClick={() => window.print()}><span>▤</span><div><strong>تقرير الطالب PDF</strong><small>نسخة مرتبة للدرجات والحضور</small></div><b>إخراج</b></button>
        <button type="button" onClick={showStudentSubjects}><span>▦</span><div><strong>تغيير المادة</strong><small>العودة إلى مواد الطالب</small></div><b>عرض</b></button>
        <button type="button" className="danger" onClick={exitStudentPortal}><span>↪</span><div><strong>تسجيل الخروج</strong><small>إنهاء جلسة الطالب الحالية</small></div><b>خروج</b></button>
      </div>
    </section>}

'''
page = replace_once(page, old_tests, more_panel, 'more panel')

print_report = '''
    <section className="student-print-report" aria-label="تقرير الطالب القابل للطباعة">
      <header className="student-print-head">
        <div><small>بوابة أستاذ لحوني التعليمية</small><h1>تقرير الطالب</h1><p>{selected.subjectLabel} • {selected.teacherName}</p></div>
        <div className="student-print-badge"><span>{selected.icon}</span><strong>{ar(percentage)}٪</strong><small>نسبة الإنجاز</small></div>
      </header>
      <section className="student-print-identity">
        <div><span>اسم الطالب</span><strong>{selected.data.name || "الطالب"}</strong></div>
        <div><span>الفصل</span><strong>{classLabel}</strong></div>
        <div><span>المادة</span><strong>{selected.subjectLabel}</strong></div>
        <div><span>تاريخ التقرير</span><strong>{new Intl.DateTimeFormat("ar-SA", { dateStyle: "long" }).format(new Date())}</strong></div>
      </section>
      <section className="student-print-summary">
        <article><span>المجموع</span><strong>{ar(finalTotal)} / {ar(FINAL_MAX)}</strong></article>
        <article><span>الحضور</span><strong>{ar(attendanceSummary.present)}</strong></article>
        <article><span>الغياب</span><strong>{ar(attendanceSummary.absent)}</strong></article>
        <article><span>التأخر</span><strong>{ar(attendanceSummary.late)}</strong></article>
        <article><span>الانضباط</span><strong>{ar(attendanceSummary.disciplineRate)}٪</strong></article>
      </section>
      <section className="student-print-section">
        <h2>تفصيل الدرجات</h2>
        <table><thead><tr><th>الوحدة</th><th>الحضور</th><th>المشاركة</th><th>الواجبات</th><th>الاختبار</th><th>المجموع</th></tr></thead><tbody>{units.map(unit => <tr key={`print-${unit.key}`}><td>{unit.label}</td><td>{ar(unit.attendance)}</td><td>{ar(unit.participation)}</td><td>{ar(unit.homework)}</td><td>{ar(unit.unitExam)}</td><td><strong>{ar(unit.total)} / {ar(UNIT_MAX)}</strong></td></tr>)}</tbody></table>
      </section>
      <section className="student-print-note"><h2>ملخص المتابعة</h2><p>{selected.data.parentCounselorLastNotice?.message || selected.data.teacherNote || smartMessage}</p></section>
      <footer><span>تقرير تعليمي صادر من بوابة أستاذ لحوني التعليمية</span><span>المعلم: {selected.teacherName}</span></footer>
    </section>
'''
end_marker = '\n  </main>;\n}'
if end_marker not in page:
    raise SystemExit('missing page closing marker')
page = page.replace(end_marker, print_report + end_marker, 1)
PAGE.write_text(page, encoding='utf-8')

layout = LAYOUT.read_text(encoding='utf-8')
if 'student-lite-v61.css' not in layout:
    layout = replace_once(
        layout,
        'import "./student-mobile-complete.css";\n',
        'import "./student-mobile-complete.css";\nimport "./student-lite-v61.css";\n',
        'layout css import',
    )
LAYOUT.write_text(layout, encoding='utf-8')

CSS.write_text(r'''/* بوابة الطالب المبسطة v61 — واجهة فقط دون تغيير البيانات أو الربط */
.student-print-report{display:none}
.student-more-panel{padding:22px;border:1px solid #dce7ef;border-radius:22px;background:#fff}
.student-more-panel .student-section-title{margin-bottom:16px}
.student-more-panel .student-section-title small{color:var(--subject-primary,#1768c5);font-weight:900}
.student-more-panel .student-section-title h2{margin:5px 0 4px;font-size:26px}
.student-more-panel .student-section-title p{margin:0;color:#63798a}
.student-more-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.student-more-grid button{display:grid;grid-template-columns:48px minmax(0,1fr) auto;align-items:center;gap:12px;min-height:88px;padding:15px;border:1px solid #dce7ef;border-radius:17px;background:linear-gradient(180deg,#fff,var(--subject-soft,#f5f8fb));color:#183b54;font:inherit;text-align:right;cursor:pointer}
.student-more-grid button>span{display:grid;place-items:center;width:48px;height:48px;border-radius:14px;background:var(--subject-soft,#eaf3f9);color:var(--subject-primary,#1768c5);font-size:21px;font-weight:900}
.student-more-grid button div{display:grid;gap:4px;min-width:0}.student-more-grid button strong{font-size:15px}.student-more-grid button small{color:#667d8d;line-height:1.4}.student-more-grid button>b{color:var(--subject-primary,#1768c5);font-size:12px}
.student-more-grid button.danger{border-color:#f1d2cf;background:#fff8f7}.student-more-grid button.danger>span,.student-more-grid button.danger>b{color:#a62d24}.student-more-grid button.danger>span{background:#ffebe8}
.student-head-actions button[data-student-action="subjects"]{background:rgba(255,255,255,.16)!important;color:#fff!important;border:1px solid rgba(255,255,255,.34)!important}
.student-head-actions button[data-student-action="subjects"]::before{content:"▦"!important}

@media(max-width:820px){
  html,body{width:100%;max-width:100%;overflow-x:hidden!important}
  .student-clean.student-portal-v2{width:100%!important;min-height:100dvh!important;padding:8px 8px calc(88px + env(safe-area-inset-bottom))!important;gap:10px!important;overflow-x:hidden!important}
  .student-clean.student-portal-v2>*{width:100%!important;max-width:100%!important;min-width:0!important}
  .student-clean-head.student-identity-head{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;align-items:center!important;gap:10px!important;padding:15px!important;border-radius:18px!important}
  .student-identity-head>div:first-child{min-width:0}.student-identity-head>div:first-child>span{font-size:12px}.student-identity-head h1{font-size:20px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.student-identity-head p{font-size:11px!important;margin:0!important}.student-identity-head p b{padding:4px 8px!important}
  .student-head-actions{position:static!important;display:block!important;width:auto!important;padding:0!important;margin:0!important;background:transparent!important;border:0!important;box-shadow:none!important}
  .student-head-actions button{width:auto!important;min-width:74px!important;min-height:42px!important;padding:8px 9px!important;border-radius:12px!important;font-size:10px!important;box-shadow:none!important;white-space:normal!important}
  .student-head-actions button::before{font-size:16px!important}
  .student-portal-tabs{position:fixed!important;right:7px!important;left:7px!important;bottom:max(7px,env(safe-area-inset-bottom))!important;top:auto!important;z-index:100!important;display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:4px!important;width:auto!important;padding:6px!important;border-radius:18px!important;background:rgba(255,255,255,.97)!important;box-shadow:0 14px 36px rgba(12,44,63,.25)!important;overflow:hidden!important}
  .student-portal-tabs button{display:grid!important;place-items:center!important;min-width:0!important;min-height:58px!important;padding:6px 2px!important;gap:2px!important;border-radius:13px!important;text-align:center!important;overflow:hidden!important}
  .student-portal-tabs button>span{width:29px!important;height:29px!important;flex-basis:29px!important;border-radius:9px!important;font-size:15px!important;line-height:1!important}
  .student-portal-tabs button div{display:block!important;width:100%!important;min-width:0!important}.student-portal-tabs b{display:block!important;font-size:10px!important;line-height:1.15!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}.student-portal-tabs small{display:none!important}
  .student-main-summary{display:grid!important;grid-template-columns:74px minmax(0,1fr)!important;gap:12px!important;padding:14px!important;border-radius:17px!important}.student-score-ring{width:74px!important;height:74px!important;flex-basis:74px!important}.student-score-ring strong{font-size:21px!important}.student-main-summary h2{font-size:17px!important;margin:4px 0!important}.student-main-summary p{font-size:12px!important;line-height:1.55!important;margin:4px 0!important}.student-smart-action{width:100%!important;margin-top:8px!important;padding:10px!important}
  .student-mini-stats{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important;margin-top:8px!important}.student-mini-stats article{padding:12px!important;border-radius:13px!important}.student-mini-stats span{font-size:11px!important}.student-mini-stats strong{font-size:17px!important;overflow-wrap:anywhere}
  .student-attendance-summary{padding:13px!important;border-radius:17px!important;gap:11px!important;margin-top:8px!important}.student-attendance-summary>header{align-items:center!important}.student-attendance-summary h2{font-size:17px!important}.student-attendance-summary header p{font-size:10px!important}.attendance-discipline-rate{width:60px!important;height:60px!important;flex:0 0 60px!important}.attendance-discipline-rate strong{font-size:16px!important}.attendance-discipline-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:7px!important}.attendance-discipline-grid article{padding:10px!important;border-radius:12px!important}.attendance-discipline-grid article:first-child{grid-column:auto!important}.attendance-discipline-grid strong{font-size:18px!important}.attendance-discipline-message{font-size:11px!important;padding:10px!important}
  .student-home-grid{grid-template-columns:1fr!important;gap:8px!important}.student-home-grid article{padding:14px!important;border-radius:15px!important}.student-home-grid strong{font-size:16px!important}
  .student-more-panel{padding:14px!important;border-radius:18px!important}.student-more-panel .student-section-title h2{font-size:21px!important}.student-more-panel .student-section-title p{font-size:12px!important}.student-more-grid{grid-template-columns:1fr!important;gap:8px!important}.student-more-grid button{grid-template-columns:42px minmax(0,1fr) auto!important;min-height:72px!important;padding:11px!important;border-radius:14px!important}.student-more-grid button>span{width:42px!important;height:42px!important;border-radius:12px!important}.student-more-grid button strong{font-size:14px!important}.student-more-grid button small{font-size:10px!important}
  .student-units-table,.student-goal-panel,.student-ai-hub,.student-diagnostics{border-radius:18px!important}.student-units-table{padding:12px!important}.student-section-title h2{font-size:20px!important}.student-section-title p{font-size:11px!important}.student-table-scroll{overflow:visible!important}.student-units-table table{width:100%!important;min-width:0!important}.student-goal-card{grid-template-columns:1fr!important;gap:14px!important}.goal-ring{width:135px!important;height:135px!important}.goal-ring strong{font-size:29px!important}.goal-numbers{grid-template-columns:1fr!important}.student-ai-hub>header{padding:15px!important}.student-ai-grid{grid-template-columns:1fr!important;padding:10px!important}.student-ai-grid article{padding:13px!important}
}

@media(max-width:370px){
  .student-clean.student-portal-v2{padding-inline:6px!important}.student-clean-head.student-identity-head{grid-template-columns:1fr!important}.student-head-actions button{width:100%!important}.student-portal-tabs{right:4px!important;left:4px!important}.student-portal-tabs b{font-size:9px!important}.student-main-summary{grid-template-columns:64px minmax(0,1fr)!important}.student-score-ring{width:64px!important;height:64px!important;flex-basis:64px!important}
}

@media print{
  @page{size:A4 portrait;margin:9mm}
  html,body{background:#fff!important;width:auto!important;overflow:visible!important}
  .student-clean.student-portal-v2{display:block!important;min-height:auto!important;padding:0!important;background:#fff!important;color:#102b38!important}
  .student-portal-v2>*:not(.student-print-report){display:none!important}
  .student-print-report{display:block!important;width:100%!important;font-family:'Tajawal','Segoe UI',Tahoma,Arial,sans-serif!important;color:#102b38!important}
  .student-print-head{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:16px!important;padding:18px 20px!important;border-radius:16px!important;background:linear-gradient(135deg,#0b5b62,#118b84)!important;color:#fff!important;print-color-adjust:exact!important;-webkit-print-color-adjust:exact!important}
  .student-print-head small,.student-print-head p{color:#d9f4ef!important}.student-print-head h1{margin:4px 0!important;font-size:25px!important;color:#fff!important}.student-print-head p{margin:0!important}
  .student-print-badge{display:grid!important;place-items:center!important;min-width:112px!important;padding:10px!important;border:1px solid rgba(255,255,255,.3)!important;border-radius:14px!important;background:rgba(255,255,255,.12)!important}.student-print-badge span{font-size:22px!important}.student-print-badge strong{font-size:24px!important;color:#fff!important}.student-print-badge small{font-size:9px!important}
  .student-print-identity{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important;margin-top:10px!important}.student-print-identity div{display:grid!important;gap:3px!important;padding:10px 12px!important;border:1px solid #d8e5e8!important;border-radius:10px!important;background:#f7fafb!important}.student-print-identity span{font-size:9px!important;color:#68808c!important}.student-print-identity strong{font-size:12px!important;color:#173b48!important}
  .student-print-summary{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:7px!important;margin-top:9px!important}.student-print-summary article{display:grid!important;gap:4px!important;padding:9px!important;text-align:center!important;border:1px solid #d9e5e8!important;border-radius:10px!important}.student-print-summary span{font-size:9px!important;color:#68808c!important}.student-print-summary strong{font-size:15px!important;color:#0e5f64!important}
  .student-print-section,.student-print-note{margin-top:10px!important;padding:12px!important;border:1px solid #d5e2e6!important;border-radius:12px!important;background:#fff!important;break-inside:avoid!important}.student-print-section h2,.student-print-note h2{margin:0 0 8px!important;font-size:15px!important;color:#0b5b62!important}.student-print-section table{width:100%!important;border-collapse:collapse!important}.student-print-section th,.student-print-section td{padding:7px!important;border:1px solid #dce6e9!important;font-size:9px!important;text-align:center!important}.student-print-section th{background:#eaf5f3!important;color:#17474d!important;print-color-adjust:exact!important;-webkit-print-color-adjust:exact!important}.student-print-note p{margin:0!important;font-size:11px!important;line-height:1.7!important;color:#344f59!important}
  .student-print-report footer{display:flex!important;justify-content:space-between!important;gap:12px!important;margin-top:10px!important;padding-top:8px!important;border-top:1px solid #cbdadd!important;font-size:8px!important;color:#647b84!important}
}
''', encoding='utf-8')

sw = SW.read_text(encoding='utf-8')
sw = re.sub(r'const CACHE_NAME = "[^"]+";', 'const CACHE_NAME = "ostadh-lahooni-v61-student-lite";', sw, count=1)
SW.write_text(sw, encoding='utf-8')

pwa = PWA.read_text(encoding='utf-8')
pwa = re.sub(r'const CURRENT_CACHE = "[^"]+";', 'const CURRENT_CACHE = "ostadh-lahooni-v61-student-lite";', pwa, count=1)
pwa = re.sub(r'const RELOAD_KEY = "[^"]+";', 'const RELOAD_KEY = "ostadh-lahooni-v61-student-lite";', pwa, count=1)
pwa = re.sub(r'/sw\.js\?v=[^"\']+', '/sw.js?v=61-student-lite', pwa, count=1)
PWA.write_text(pwa, encoding='utf-8')

print('rebuilt student portal v61 without touching APIs or data paths')
