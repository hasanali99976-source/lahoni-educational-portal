from pathlib import Path
import re

ROOT = Path('.')
PAGE = ROOT / 'app/student/page.tsx'
STYLE = ROOT / 'app/student/student-knowledge-v63.css'
SW = ROOT / 'public/sw.js'
PWA = ROOT / 'app/pwa-register.tsx'


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'missing pattern: {label}')
    return text.replace(old, new, 1)

page = PAGE.read_text(encoding='utf-8')

page = replace_once(
    page,
    '''      <div className="knowledge-hero">
        <div className="knowledge-subject-mark" aria-hidden="true"><span>{selected.icon}</span></div>
        <div className="knowledge-hero-copy">
          <small>{subjectProfile.eyebrow}</small>''',
    '''      <div className="knowledge-hero knowledge-hero-compact">
        <div className="knowledge-hero-copy">
          <div className="knowledge-subject-heading"><span className="knowledge-subject-mini" aria-hidden="true">{selected.icon}</span><small>{subjectProfile.eyebrow}</small></div>''',
    'compact subject identity',
)

page = replace_once(
    page,
    '''<button type="button" className="knowledge-print-quick" data-student-action="print" data-native-print="true" onClick={() => window.print()}><span>▤</span><div><b>تقرير الطالب</b><small>طباعة البيانات والتفاصيل</small></div></button>''',
    '''<button type="button" className="knowledge-print-quick" data-student-action="print" data-native-print="true" onClick={() => window.print()}><span className="action-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M7 9V4h10v5M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><path d="M7 14h10v6H7z"/><path d="M17 12h.01"/></svg></span><div><b>تقرير الطالب</b><small>لوحة بيانية في صفحة واحدة</small></div></button>''',
    'print button icon',
)

old_actions = '''      <div className="knowledge-actions" aria-label="إجراءات الطالب">
        <button type="button" data-student-action="subjects" onClick={showStudentSubjects}><span>▦</span><div><b>تغيير المادة</b><small>عرض جميع المواد المرتبطة بك</small></div></button>
        <button type="button" className="danger" data-student-action="logout" onClick={exitStudentPortal}><span>↪</span><div><b>تسجيل الخروج</b><small>إنهاء جلسة الطالب الحالية</small></div></button>
      </div>'''
new_actions = '''      <div className="knowledge-actions knowledge-session-actions" aria-label="إجراءات الطالب">
        <button type="button" className="knowledge-subjects-action" data-student-action="subjects" onClick={showStudentSubjects}><span className="action-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></svg></span><div><b>موادي</b><small>الانتقال بين المواد المرتبطة بك</small></div><i>عرض</i></button>
        <button type="button" className="knowledge-logout-action" data-student-action="logout" onClick={exitStudentPortal}><span className="action-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M14 8V5.5A2.5 2.5 0 0 0 11.5 3h-5A2.5 2.5 0 0 0 4 5.5v13A2.5 2.5 0 0 0 6.5 21h5a2.5 2.5 0 0 0 2.5-2.5V16"/><path d="M10 12h10m-3.5-3.5L20 12l-3.5 3.5"/></svg></span><div><b>تسجيل الخروج</b><small>إنهاء جلسة الطالب بأمان</small></div><i>خروج</i></button>
      </div>'''
page = replace_once(page, old_actions, new_actions, 'session action buttons')

start = page.find('    <section className="student-print-report"')
end = page.find('\n  </main>;', start)
if start < 0 or end < 0:
    raise SystemExit('print report section not found')

new_report = r'''    <section className="student-print-report student-print-dashboard" aria-label="تقرير الطالب البياني القابل للطباعة">
      <header className="print-dashboard-head">
        <div className="print-dashboard-brand"><span>{selected.icon}</span><div><small>بوابة أستاذ لحوني التعليمية</small><h1>لوحة التحصيل العلمي للطالب</h1><p>{selected.subjectLabel} • {selected.teacherName}</p></div></div>
        <div className="print-dashboard-status"><small>التقدير الحالي</small><strong>{percentage >= 90 ? "متميز" : percentage >= 80 ? "متقدم" : percentage >= 70 ? "جيد" : percentage >= 50 ? "متوسط" : "يحتاج دعمًا"}</strong><span>{new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium" }).format(new Date())}</span></div>
      </header>

      <section className="print-dashboard-identity">
        <div><span>الطالب</span><strong>{selected.data.name || "الطالب"}</strong></div>
        <div><span>الفصل</span><strong>{classLabel}</strong></div>
        <div><span>المادة</span><strong>{selected.subjectLabel}</strong></div>
        <div><span>المعلم</span><strong>{selected.teacherName}</strong></div>
      </section>

      <section className="print-dashboard-visuals">
        <article className="print-score-visual">
          <div className="print-ring" style={{ "--print-score": percentage } as CSSProperties}><div><strong>{ar(percentage)}٪</strong><span>نسبة التحصيل</span></div></div>
          <div className="print-score-copy"><small>المجموع الكلي</small><strong>{ar(finalTotal)} <span>من {ar(FINAL_MAX)}</span></strong><p>{smartMessage}</p></div>
        </article>

        <section className="print-unit-chart">
          <header><div><small>الخريطة البيانية</small><h2>أداء الوحدات</h2></div><span>المقياس: {ar(UNIT_MAX)} درجات لكل وحدة</span></header>
          <div className="print-unit-bars">{units.map(unit => <article key={`chart-${unit.key}`} style={{ "--bar": Math.min(100, unit.total / Math.max(UNIT_MAX, 1) * 100) } as CSSProperties}><div><strong>{unit.label}</strong><span>{ar(unit.total)} / {ar(UNIT_MAX)}</span></div><div className="print-bar-track"><i /></div></article>)}</div>
        </section>

        <article className="print-discipline-visual">
          <div className="print-ring discipline" style={{ "--print-score": attendanceSummary.disciplineRate } as CSSProperties}><div><strong>{ar(attendanceSummary.disciplineRate)}٪</strong><span>الانضباط</span></div></div>
          <div className="print-attendance-mini"><span><b>{ar(attendanceSummary.present)}</b> حاضر</span><span className="absent"><b>{ar(attendanceSummary.absent)}</b> غائب</span><span className="late"><b>{ar(attendanceSummary.late)}</b> متأخر</span><span><b>{ar(attendanceSummary.excused)}</b> مستأذن</span></div>
        </article>
      </section>

      <section className="print-dashboard-guidance">
        <article className="print-reading-card strength"><small>نقطة القوة</small><strong>{strongestUnit?.label || "بانتظار اكتمال الرصد"}</strong><p>{strongestUnit ? `حقق الطالب ${ar(strongestUnit.total)} من ${ar(UNIT_MAX)}؛ ويحافظ عليها بالمراجعة المنتظمة.` : "تظهر نقطة القوة بعد اكتمال رصد الدرجات."}</p></article>
        <article className="print-reading-card priority"><small>أولوية التحسين</small><strong>{weakestUnit?.label || "المهارات الأساسية"}</strong><p>{weakestUnit ? `الدرجة الحالية ${ar(weakestUnit.total)} من ${ar(UNIT_MAX)}؛ ابدأ بالمفهوم ثم طبّق عليه.` : "ابدأ بمهارة واحدة، ثم اختبر فهمك بسؤال قصير."}</p></article>
        <article className="print-reading-card followup"><small>متابعة المعلم</small><strong>{selected.data.parentCounselorLastNotice?.title || "متابعة تعليمية"}</strong><p>{selected.data.parentCounselorLastNotice?.message || selected.data.teacherNote || disciplineMessage}</p></article>
        <article className="print-plan-card"><small>خطة العمل القادمة</small><ol>{dailyPlan.map((item, index) => <li key={`dashboard-plan-${item}`}><span>{index + 1}</span>{item}</li>)}</ol></article>
      </section>

      <footer className="print-dashboard-footer"><span>تقرير مبسط لفهم مستوى الطالب واتخاذ الخطوة التالية</span><strong>بوابة أستاذ لحوني التعليمية</strong></footer>
    </section>'''
page = page[:start] + new_report + page[end:]
PAGE.write_text(page, encoding='utf-8')

style = STYLE.read_text(encoding='utf-8')
marker = '/* v65 compact identity, polished actions, one-page visual report */'
if marker not in style:
    style += r'''

/* v65 compact identity, polished actions, one-page visual report */
.knowledge-hero-compact{grid-template-columns:minmax(0,1fr) 172px!important;gap:20px!important;padding:22px 0 18px!important}
.knowledge-subject-heading{display:flex;align-items:center;gap:10px;margin-bottom:5px}.knowledge-subject-heading small{color:var(--portal-c);font-weight:900}.knowledge-subject-mini{display:grid;place-items:center;width:36px;height:36px;border-radius:11px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.2);font-size:18px;box-shadow:inset 0 1px 0 rgba(255,255,255,.22)}
.knowledge-topline-tools{display:flex;align-items:center;gap:9px}.knowledge-print-quick{display:grid;grid-template-columns:38px minmax(0,1fr);align-items:center;gap:9px;min-height:51px;padding:6px 10px;border:1px solid rgba(255,255,255,.28);border-radius:14px;background:#fff;color:var(--portal-a);font:inherit;text-align:right;cursor:pointer;box-shadow:0 10px 22px rgba(0,0,0,.12)}.knowledge-print-quick div{display:grid}.knowledge-print-quick b{font-size:12px}.knowledge-print-quick small{font-size:8px;color:#607681}.action-icon{display:grid!important;place-items:center!important;width:38px!important;height:38px!important;border-radius:11px!important;background:rgba(255,255,255,.13)!important}.knowledge-print-quick .action-icon{background:var(--portal-soft)!important;color:var(--portal-b)!important}.action-icon svg{width:21px;height:21px;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.knowledge-session-actions{grid-template-columns:repeat(2,minmax(0,1fr))!important;max-width:720px;margin-right:auto}.knowledge-session-actions button{position:relative;grid-template-columns:42px minmax(0,1fr) auto!important;min-height:62px!important;padding:9px 12px!important;border-radius:17px!important;text-align:right!important;place-items:initial!important;align-items:center!important;transition:transform .18s ease,background .18s ease}.knowledge-session-actions button:hover{transform:translateY(-2px)}.knowledge-session-actions button div{display:grid}.knowledge-session-actions button i{padding:5px 9px;border-radius:999px;background:rgba(255,255,255,.12);font-size:9px;font-style:normal;font-weight:900}.knowledge-subjects-action{background:rgba(255,255,255,.14)!important}.knowledge-logout-action{background:rgba(90,12,22,.16)!important;border-color:rgba(255,225,225,.25)!important}.knowledge-session-actions .action-icon{width:42px!important;height:42px!important;border-radius:13px!important}
.student-print-dashboard{display:none}

@media(max-width:760px){
 .knowledge-hero-compact{grid-template-columns:1fr!important;padding:16px 0 12px!important}.knowledge-overall{justify-self:start!important;width:112px!important;height:112px!important}.knowledge-overall strong{font-size:22px!important}
 .knowledge-topline-tools{width:100%;justify-content:space-between}.knowledge-print-quick{flex:1;max-width:230px}.knowledge-sync{flex:1}
 .knowledge-session-actions{grid-template-columns:repeat(2,minmax(0,1fr))!important;max-width:none!important}.knowledge-session-actions button{grid-template-columns:34px minmax(0,1fr)!important;min-height:54px!important}.knowledge-session-actions button i{display:none}.knowledge-session-actions .action-icon{width:34px!important;height:34px!important}.knowledge-session-actions button small{display:block!important;font-size:8px!important}
 .knowledge-tabs{gap:4px!important}.knowledge-tabs button{min-height:60px!important;padding:6px 3px!important}.knowledge-tabs button>span{width:30px!important;height:30px!important}.knowledge-tabs button b{font-size:9px!important}
}
@media(max-width:430px){.knowledge-topline-tools{display:grid;grid-template-columns:1fr}.knowledge-print-quick,.knowledge-sync{width:100%;max-width:none}.knowledge-session-actions{grid-template-columns:1fr!important}.knowledge-session-actions button{grid-template-columns:36px minmax(0,1fr) auto!important}.knowledge-session-actions button i{display:inline-block}}

@media print{
 @page{size:A4 landscape;margin:6mm}
 html,body{width:100%!important;height:auto!important;margin:0!important;padding:0!important;background:#fff!important;overflow:hidden!important}
 .student-knowledge-shell{display:block!important;width:100%!important;min-height:0!important;padding:0!important;margin:0!important;background:#fff!important;overflow:hidden!important}
 .student-knowledge-shell>*:not(.student-print-dashboard){display:none!important}
 .student-print-dashboard{display:grid!important;grid-template-rows:auto auto minmax(0,1fr) auto auto!important;gap:5mm!important;width:100%!important;height:190mm!important;max-height:190mm!important;margin:0!important;padding:0!important;color:#172d37!important;font-family:'Tajawal','Segoe UI',Tahoma,Arial,sans-serif!important;overflow:hidden!important;break-inside:avoid!important;page-break-inside:avoid!important;page-break-after:avoid!important;print-color-adjust:exact!important;-webkit-print-color-adjust:exact!important}
 .print-dashboard-head{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10mm!important;padding:5mm 6mm!important;border-radius:5mm!important;background:linear-gradient(125deg,var(--portal-a),var(--portal-b))!important;color:#fff!important;box-shadow:none!important}
 .print-dashboard-brand{display:flex!important;align-items:center!important;gap:4mm!important}.print-dashboard-brand>span{display:grid!important;place-items:center!important;width:12mm!important;height:12mm!important;border-radius:3.5mm!important;background:rgba(255,255,255,.16)!important;border:1px solid rgba(255,255,255,.25)!important;font-size:17pt!important}.print-dashboard-brand div{display:grid!important}.print-dashboard-brand small{font-size:7.5pt!important;color:#dcefeb!important}.print-dashboard-brand h1{margin:1mm 0!important;font-size:17pt!important;color:#fff!important}.print-dashboard-brand p{margin:0!important;font-size:8pt!important;color:#e2f1ef!important}
 .print-dashboard-status{display:grid!important;min-width:38mm!important;padding:3mm 4mm!important;border:1px solid rgba(255,255,255,.25)!important;border-radius:4mm!important;background:rgba(255,255,255,.12)!important;text-align:center!important}.print-dashboard-status small{font-size:7pt!important;color:#dcefeb!important}.print-dashboard-status strong{font-size:14pt!important;color:#fff!important}.print-dashboard-status span{font-size:7pt!important;color:var(--portal-c)!important}
 .print-dashboard-identity{display:grid!important;grid-template-columns:1.3fr .7fr 1fr 1fr!important;gap:2.5mm!important}.print-dashboard-identity div{display:grid!important;gap:.8mm!important;padding:2.7mm 3.3mm!important;border:1px solid #d8e4e8!important;border-radius:3mm!important;background:#f7fafb!important}.print-dashboard-identity span{font-size:6.5pt!important;color:#70848d!important}.print-dashboard-identity strong{font-size:9pt!important;color:#193a46!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
 .print-dashboard-visuals{display:grid!important;grid-template-columns:43mm minmax(0,1fr) 49mm!important;gap:4mm!important;min-height:0!important}.print-score-visual,.print-unit-chart,.print-discipline-visual{min-height:0!important;padding:4mm!important;border:1px solid #d7e3e7!important;border-radius:4mm!important;background:#fff!important;overflow:hidden!important}.print-score-visual,.print-discipline-visual{display:grid!important;align-content:center!important;justify-items:center!important;gap:3mm!important;text-align:center!important}.print-ring{--print-score:0;display:grid!important;place-items:center!important;width:31mm!important;height:31mm!important;border-radius:50%!important;background:radial-gradient(circle,#fff 56%,transparent 58%),conic-gradient(var(--portal-b) calc(var(--print-score)*1%),#e7eef0 0)!important}.print-ring>div{display:grid!important}.print-ring strong{font-size:16pt!important;color:var(--portal-a)!important}.print-ring span{font-size:6.5pt!important;color:#6c818a!important}.print-ring.discipline{width:28mm!important;height:28mm!important}.print-score-copy{display:grid!important;gap:1mm!important}.print-score-copy small{font-size:7pt!important;color:#748791!important}.print-score-copy>strong{font-size:15pt!important;color:var(--portal-a)!important}.print-score-copy>strong span{font-size:7pt!important;color:#71858e!important}.print-score-copy p{max-height:12mm!important;margin:0!important;font-size:7pt!important;line-height:1.45!important;color:#4e6872!important;overflow:hidden!important}
 .print-unit-chart{display:grid!important;grid-template-rows:auto 1fr!important;gap:3mm!important}.print-unit-chart header{display:flex!important;align-items:end!important;justify-content:space-between!important;gap:5mm!important}.print-unit-chart header div{display:grid!important}.print-unit-chart header small{font-size:6.5pt!important;color:var(--portal-b)!important;font-weight:900!important}.print-unit-chart h2{margin:0!important;font-size:13pt!important;color:var(--portal-a)!important}.print-unit-chart header>span{font-size:6pt!important;color:#71858e!important}.print-unit-bars{display:grid!important;align-content:center!important;gap:2.6mm!important}.print-unit-bars article{display:grid!important;gap:1.1mm!important}.print-unit-bars article>div:first-child{display:flex!important;justify-content:space-between!important;gap:4mm!important;font-size:7pt!important}.print-unit-bars strong{color:#2a4651!important}.print-unit-bars span{color:var(--portal-b)!important;font-weight:900!important}.print-bar-track{height:3.4mm!important;border-radius:999px!important;background:#e8eff1!important;overflow:hidden!important}.print-bar-track i{display:block!important;width:calc(var(--bar)*1%)!important;height:100%!important;border-radius:inherit!important;background:linear-gradient(90deg,var(--portal-a),var(--portal-b),var(--portal-c))!important}
 .print-attendance-mini{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:1.7mm!important;width:100%!important}.print-attendance-mini span{display:flex!important;align-items:center!important;justify-content:center!important;gap:1mm!important;padding:1.8mm!important;border-radius:2.4mm!important;background:var(--portal-soft)!important;font-size:6.5pt!important;color:#405e68!important}.print-attendance-mini b{font-size:9pt!important;color:var(--portal-a)!important}.print-attendance-mini .absent{background:#fff0f0!important}.print-attendance-mini .absent b{color:#b52d38!important}.print-attendance-mini .late{background:#fff6e8!important}.print-attendance-mini .late b{color:#a86200!important}
 .print-dashboard-guidance{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr)) 1.25fr!important;gap:2.8mm!important}.print-reading-card,.print-plan-card{display:grid!important;align-content:start!important;gap:1.2mm!important;min-height:0!important;padding:3mm!important;border:1px solid #d7e3e7!important;border-radius:3.5mm!important;background:#fff!important;overflow:hidden!important}.print-reading-card small,.print-plan-card>small{font-size:6.5pt!important;color:#758992!important;font-weight:900!important}.print-reading-card strong{font-size:10pt!important;color:var(--portal-a)!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}.print-reading-card p{display:-webkit-box!important;-webkit-box-orient:vertical!important;-webkit-line-clamp:3!important;margin:0!important;font-size:6.5pt!important;line-height:1.45!important;color:#526d76!important;overflow:hidden!important}.print-reading-card.strength{border-top:3px solid #2f9a70!important}.print-reading-card.priority{border-top:3px solid #df9630!important}.print-reading-card.followup{border-top:3px solid var(--portal-b)!important}.print-plan-card{border-top:3px solid var(--portal-a)!important;background:linear-gradient(145deg,#fff,var(--portal-soft))!important}.print-plan-card ol{display:grid!important;gap:1.2mm!important;margin:0!important;padding:0!important;list-style:none!important}.print-plan-card li{display:grid!important;grid-template-columns:5mm 1fr!important;align-items:start!important;gap:1.5mm!important;font-size:6.5pt!important;line-height:1.35!important;color:#3f5c66!important}.print-plan-card li span{display:grid!important;place-items:center!important;width:5mm!important;height:5mm!important;border-radius:50%!important;background:var(--portal-a)!important;color:#fff!important;font-size:6pt!important;font-weight:900!important}
 .print-dashboard-footer{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:6mm!important;padding-top:2.5mm!important;border-top:1px solid #cad9dd!important;font-size:6.5pt!important;color:#657b84!important}.print-dashboard-footer strong{color:var(--portal-a)!important}
}
'''
STYLE.write_text(style, encoding='utf-8')

sw = SW.read_text(encoding='utf-8')
sw = re.sub(r'const CACHE_NAME = "[^"]+";', 'const CACHE_NAME = "ostadh-lahooni-v65-student-visual-report";', sw, count=1)
SW.write_text(sw, encoding='utf-8')

pwa = PWA.read_text(encoding='utf-8')
pwa = re.sub(r'const CURRENT_CACHE = "[^"]+";', 'const CURRENT_CACHE = "ostadh-lahooni-v65-student-visual-report";', pwa, count=1)
pwa = re.sub(r'const RELOAD_KEY = "[^"]+";', 'const RELOAD_KEY = "ostadh-lahooni-v65-student-visual-report";', pwa, count=1)
pwa = re.sub(r'/sw\.js\?v=[^"\']+', '/sw.js?v=65-student-visual-report', pwa, count=1)
PWA.write_text(pwa, encoding='utf-8')

print('student portal visual report v65 patched')
