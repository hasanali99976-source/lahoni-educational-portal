from pathlib import Path

PAGE = Path("app/student/page.tsx")
LAYOUT = Path("app/student/layout.tsx")
CSS = Path("app/student/student-dashboard-v68.css")
SW = Path("public/sw.js")
PWA = Path("app/pwa-register.tsx")

page = PAGE.read_text(encoding="utf-8")

old_score = '''        <div className="knowledge-overall" style={{ "--score": percentage } as CSSProperties}>
          <div><strong>{ar(percentage)}٪</strong><span>مستوى التحصيل</span></div>
          <small>{ar(finalTotal)} من {ar(FINAL_MAX)}</small>
        </div>'''
new_score = '''        <div className="knowledge-score-pill" style={{ "--score": percentage } as CSSProperties} aria-label={`نسبة التحصيل ${ar(percentage)}٪`}>
          <small>التحصيل</small><strong>{ar(percentage)}٪</strong><span>{ar(finalTotal)} من {ar(FINAL_MAX)}</span><i aria-hidden="true" />
        </div>'''
if old_score not in page:
    raise SystemExit("score block not found")
page = page.replace(old_score, new_score, 1)

old_actions = '''      <div className="knowledge-actions knowledge-session-actions" aria-label="إجراءات الطالب">
        <button type="button" className="knowledge-subjects-action" data-student-action="subjects" onClick={showStudentSubjects}><span className="action-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></svg></span><div><b>موادي</b><small>الانتقال بين المواد المرتبطة بك</small></div><i>عرض</i></button>
        <button type="button" className="knowledge-logout-action" data-student-action="logout" onClick={exitStudentPortal}><span className="action-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M14 8V5.5A2.5 2.5 0 0 0 11.5 3h-5A2.5 2.5 0 0 0 4 5.5v13A2.5 2.5 0 0 0 6.5 21h5a2.5 2.5 0 0 0 2.5-2.5V16"/><path d="M10 12h10m-3.5-3.5L20 12l-3.5 3.5"/></svg></span><div><b>تسجيل الخروج</b><small>إنهاء جلسة الطالب بأمان</small></div><i>خروج</i></button>
      </div>'''
new_actions = '''      <div className="knowledge-actions knowledge-session-actions knowledge-compact-actions" aria-label="إجراءات الطالب">
        <button type="button" className="knowledge-subjects-action" data-student-action="subjects" onClick={showStudentSubjects} aria-label="العودة إلى موادي"><span className="action-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></svg></span><b>موادي</b></button>
        <button type="button" className="knowledge-logout-action" data-student-action="logout" onClick={exitStudentPortal} aria-label="تسجيل الخروج"><span className="action-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M14 8V5.5A2.5 2.5 0 0 0 11.5 3h-5A2.5 2.5 0 0 0 4 5.5v13A2.5 2.5 0 0 0 6.5 21h5a2.5 2.5 0 0 0 2.5-2.5V16"/><path d="M10 12h10m-3.5-3.5L20 12l-3.5 3.5"/></svg></span><b>خروج</b></button>
      </div>'''
if old_actions not in page:
    raise SystemExit("actions block not found")
page = page.replace(old_actions, new_actions, 1)

start_marker = '      <section className="print-dashboard-visuals">'
end_marker = '      <section className="print-dashboard-guidance">'
start = page.find(start_marker)
end = page.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit("print analytics markers not found")

new_analytics = '''      <section className="print-analytics-board" aria-label="الرسوم البيانية والتحليل">
        <article className="print-gauge-card score">
          <header><small>مؤشر التحصيل</small><strong>{percentage >= 90 ? "متميز" : percentage >= 80 ? "متقدم" : percentage >= 70 ? "جيد" : percentage >= 50 ? "متوسط" : "يحتاج دعمًا"}</strong></header>
          <svg className="print-gauge-svg" viewBox="0 0 120 120" role="img" aria-label={`نسبة التحصيل ${ar(percentage)}٪`}>
            <circle className="gauge-track" cx="60" cy="60" r="46" pathLength="100" />
            <circle className="gauge-value" cx="60" cy="60" r="46" pathLength="100" strokeDasharray={`${Math.max(0, Math.min(100, percentage))} 100`} />
            <text x="60" y="57" textAnchor="middle" className="gauge-number">{ar(percentage)}٪</text>
            <text x="60" y="75" textAnchor="middle" className="gauge-label">التحصيل</text>
          </svg>
          <div className="print-gauge-detail"><b>{ar(finalTotal)} من {ar(FINAL_MAX)}</b><span>{smartMessage}</span></div>
        </article>

        <article className="print-bars-card">
          <header><div><small>مخطط بياني</small><h2>أداء الوحدات</h2></div><span>من {ar(UNIT_MAX)} لكل وحدة</span></header>
          <svg className="print-bars-svg" viewBox={`0 0 540 ${Math.max(170, units.length * 34 + 38)}`} role="img" aria-label="مخطط درجات الوحدات">
            {units.map((unit, index) => {
              const y = 24 + index * 34;
              const barWidth = Math.max(3, Math.min(100, unit.total / Math.max(UNIT_MAX, 1) * 100)) * 3.15;
              return <g key={`svg-unit-${unit.key}`}>
                <text x="520" y={y + 11} textAnchor="end" className="bar-unit-label">{unit.label}</text>
                <rect x="120" y={y} width="315" height="14" rx="7" className="bar-track" />
                <rect x="120" y={y} width={barWidth} height="14" rx="7" className="bar-value" />
                <text x="105" y={y + 11} textAnchor="end" className="bar-score-label">{ar(unit.total)}/{ar(UNIT_MAX)}</text>
              </g>;
            })}
          </svg>
          <p><b>قراءة سريعة:</b> أعلى أداء في {strongestUnit?.label || "الوحدات المكتملة"}، والأولوية الآن {weakestUnit?.label || "المراجعة الأساسية"}.</p>
        </article>

        <article className="print-gauge-card discipline">
          <header><small>مؤشر الانضباط</small><strong>{disciplineMessage}</strong></header>
          <svg className="print-gauge-svg" viewBox="0 0 120 120" role="img" aria-label={`نسبة الانضباط ${ar(attendanceSummary.disciplineRate)}٪`}>
            <circle className="gauge-track" cx="60" cy="60" r="46" pathLength="100" />
            <circle className="gauge-value" cx="60" cy="60" r="46" pathLength="100" strokeDasharray={`${Math.max(0, Math.min(100, attendanceSummary.disciplineRate))} 100`} />
            <text x="60" y="57" textAnchor="middle" className="gauge-number">{ar(attendanceSummary.disciplineRate)}٪</text>
            <text x="60" y="75" textAnchor="middle" className="gauge-label">الانضباط</text>
          </svg>
          <div className="print-attendance-numbers"><span><b>{ar(attendanceSummary.present)}</b> حاضر</span><span><b>{ar(attendanceSummary.absent)}</b> غائب</span><span><b>{ar(attendanceSummary.late)}</b> متأخر</span><span><b>{ar(attendanceSummary.excused)}</b> مستأذن</span></div>
        </article>
      </section>

'''
page = page[:start] + new_analytics + page[end:]
PAGE.write_text(page, encoding="utf-8")

css = r'''/* v68 — رأس طالب فعلي مضغوط ورسوم طباعة SVG */
.student-knowledge-shell{gap:10px!important;padding-top:10px!important}
.knowledge-header{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;grid-template-areas:"top top" "hero actions"!important;align-items:center!important;gap:8px 12px!important;padding:10px 12px!important;border:1px solid color-mix(in srgb,var(--portal-b) 24%,#dbe5e8)!important;border-top:4px solid var(--portal-b)!important;border-radius:16px!important;background:#fff!important;color:var(--portal-ink)!important;box-shadow:0 8px 24px rgba(18,48,62,.08)!important;overflow:visible!important}
.knowledge-header::before,.knowledge-header::after{display:none!important}
.knowledge-topline{grid-area:top!important;min-height:30px!important;padding:0 0 6px!important;border-bottom:1px solid #e5ecef!important}
.knowledge-brand>span{display:none!important}.knowledge-brand small{color:#7a8e97!important;font-size:7px!important}.knowledge-brand strong{color:var(--portal-a)!important;font-size:10px!important}
.knowledge-topline-tools{gap:6px!important}.knowledge-sync{min-height:27px!important;padding:3px 7px!important;border:1px solid #dce7ea!important;background:#f6f9fa!important;color:#39545f!important}.knowledge-sync i{width:7px!important;height:7px!important;box-shadow:0 0 0 3px rgba(24,170,105,.12)!important}.knowledge-sync b{font-size:8px!important}.knowledge-sync small{display:none!important}
.knowledge-print-quick{min-height:28px!important;padding:3px 7px!important;border:1px solid var(--portal-b)!important;border-radius:8px!important;background:var(--portal-b)!important;color:#fff!important;grid-template-columns:18px auto!important;box-shadow:none!important}.knowledge-print-quick>span{width:18px!important;height:18px!important;border-radius:5px!important;background:rgba(255,255,255,.16)!important;color:#fff!important}.knowledge-print-quick svg{width:12px!important;height:12px!important}.knowledge-print-quick b{font-size:8px!important}.knowledge-print-quick small{display:none!important}
.knowledge-hero.knowledge-hero-compact,.knowledge-hero{grid-area:hero!important;display:grid!important;grid-template-columns:minmax(0,1fr) 112px!important;align-items:center!important;gap:10px!important;padding:2px 0!important;min-height:64px!important}
.knowledge-subject-heading{gap:5px!important}.knowledge-subject-mini{display:none!important}.knowledge-subject-heading small{color:var(--portal-b)!important;font-size:7.5px!important}
.knowledge-hero-copy h1{margin:1px 0!important;font-size:clamp(18px,2vw,25px)!important;line-height:1.15!important;color:var(--portal-ink)!important}.knowledge-hero-copy h2{margin:1px 0!important;font-size:11px!important;color:var(--portal-a)!important}.knowledge-hero-copy p{margin:2px 0!important;max-width:680px!important;font-size:8.5px!important;line-height:1.35!important;color:#667d87!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
.knowledge-meta{margin-top:4px!important;gap:4px!important}.knowledge-meta span{padding:2px 6px!important;border:1px solid #dfe9ec!important;background:#f7fafb!important;color:#4b6570!important;font-size:7px!important}
.knowledge-score-pill{--score:0;position:relative;display:grid!important;grid-template-columns:1fr auto!important;align-items:end!important;gap:0 6px!important;width:112px!important;min-height:55px!important;padding:7px 8px 10px!important;border:1px solid color-mix(in srgb,var(--portal-b) 25%,#dce7ea)!important;border-radius:11px!important;background:linear-gradient(145deg,var(--portal-soft),#fff)!important;color:var(--portal-a)!important;overflow:hidden!important}.knowledge-score-pill small{grid-column:1/-1;font-size:7px!important;color:#748992!important}.knowledge-score-pill strong{font-size:20px!important;line-height:1!important}.knowledge-score-pill span{font-size:7px!important;color:#607984!important}.knowledge-score-pill i{position:absolute!important;right:0!important;left:0!important;bottom:0!important;height:4px!important;background:linear-gradient(90deg,var(--portal-b) calc(var(--score)*1%),#dce7ea 0)!important}
.knowledge-actions.knowledge-session-actions.knowledge-compact-actions{grid-area:actions!important;display:flex!important;align-items:center!important;align-self:center!important;gap:5px!important;padding:0!important;border:0!important}.knowledge-compact-actions button{display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:5px!important;width:auto!important;min-width:68px!important;min-height:31px!important;padding:4px 8px!important;border:1px solid #d8e4e8!important;border-radius:8px!important;background:#fff!important;color:#36515c!important;box-shadow:none!important}.knowledge-compact-actions button>.action-icon{width:19px!important;height:19px!important;border-radius:5px!important;background:var(--portal-soft)!important;color:var(--portal-b)!important}.knowledge-compact-actions .action-icon svg{width:12px!important;height:12px!important;stroke:currentColor!important;stroke-width:1.8!important}.knowledge-compact-actions button b{font-size:8.5px!important}.knowledge-compact-actions .knowledge-logout-action{border-color:#f0d8d8!important;color:#9a3030!important;background:#fffafa!important}.knowledge-compact-actions .knowledge-logout-action>.action-icon{background:#fff0f0!important;color:#b33b3b!important}
.knowledge-tabs{margin-top:0!important}
@media(max-width:820px){.knowledge-header{grid-template-columns:1fr!important;grid-template-areas:"top" "hero" "actions"!important;padding:8px!important}.knowledge-topline{gap:5px!important}.knowledge-hero.knowledge-hero-compact,.knowledge-hero{grid-template-columns:minmax(0,1fr) 92px!important;min-height:58px!important}.knowledge-hero-copy p{display:none!important}.knowledge-score-pill{width:92px!important;min-height:50px!important}.knowledge-score-pill strong{font-size:17px!important}.knowledge-actions.knowledge-session-actions.knowledge-compact-actions{justify-content:flex-end!important}.knowledge-compact-actions button{min-width:62px!important;min-height:29px!important}.knowledge-topline-tools{display:flex!important;width:auto!important}.knowledge-sync{display:none!important}}
@media(max-width:430px){.knowledge-header{border-radius:13px!important}.knowledge-topline{align-items:center!important}.knowledge-brand strong{font-size:9px!important}.knowledge-hero.knowledge-hero-compact,.knowledge-hero{grid-template-columns:minmax(0,1fr) 82px!important}.knowledge-score-pill{width:82px!important;padding-inline:6px!important}.knowledge-score-pill span{display:none!important}.knowledge-hero-copy h1{font-size:17px!important}.knowledge-meta span{font-size:6.4px!important}.knowledge-actions.knowledge-session-actions.knowledge-compact-actions{justify-content:stretch!important}.knowledge-compact-actions button{flex:1!important;min-width:0!important}}

@media print{
  @page{size:A4 landscape;margin:3mm}
  .student-print-dashboard{display:grid!important;position:absolute!important;inset:0!important;width:291mm!important;height:204mm!important;max-width:none!important;margin:0!important;padding:4mm!important;grid-template-rows:17mm 15mm minmax(0,1fr) 50mm 10mm!important;gap:2.5mm!important;border:1px solid #cfdcdf!important;border-radius:4mm!important;background:linear-gradient(145deg,#fff,#f4f8f9)!important;overflow:hidden!important;box-sizing:border-box!important;print-color-adjust:exact!important;-webkit-print-color-adjust:exact!important}
  .print-dashboard-head{min-height:0!important;padding:2.5mm 3.5mm!important;border-radius:3mm!important}.print-dashboard-brand>span{width:8mm!important;height:8mm!important;font-size:3.5mm!important}.print-dashboard-brand h1{font-size:4.6mm!important}.print-dashboard-brand p{font-size:2.1mm!important}.print-dashboard-status{padding:2mm 3mm!important}
  .print-dashboard-identity{min-height:0!important;padding:2mm 3mm!important;border-radius:2.5mm!important}.print-dashboard-identity div{padding:1mm 2mm!important}
  .print-analytics-board{display:grid!important;grid-template-columns:47mm minmax(0,1fr) 47mm!important;gap:3mm!important;min-height:0!important}
  .print-gauge-card,.print-bars-card{display:grid!important;min-height:0!important;padding:3mm!important;border:1px solid #d5e1e5!important;border-radius:3mm!important;background:#fff!important;color:#173742!important;overflow:hidden!important}
  .print-gauge-card{grid-template-rows:auto 1fr auto!important;justify-items:center!important;text-align:center!important}.print-gauge-card header{display:grid!important;gap:.5mm!important;width:100%!important}.print-gauge-card header small{font-size:2.2mm!important;color:#6e838c!important}.print-gauge-card header strong{font-size:2.5mm!important;color:var(--portal-a)!important;line-height:1.3!important}
  .print-gauge-svg{width:35mm!important;height:35mm!important;margin:auto!important;overflow:visible!important}.print-gauge-svg .gauge-track{fill:none!important;stroke:#dfe8eb!important;stroke-width:10!important}.print-gauge-svg .gauge-value{fill:none!important;stroke:var(--portal-b)!important;stroke-width:10!important;stroke-linecap:round!important;transform:rotate(-90deg)!important;transform-origin:60px 60px!important}.print-gauge-card.discipline .gauge-value{stroke:#25885f!important}.gauge-number{font-size:17px!important;font-weight:900!important;fill:#193b46!important}.gauge-label{font-size:7px!important;font-weight:800!important;fill:#71868e!important}.print-gauge-detail{display:grid!important;gap:1mm!important}.print-gauge-detail b{font-size:3.2mm!important;color:var(--portal-a)!important}.print-gauge-detail span{font-size:2.1mm!important;line-height:1.35!important;color:#58707a!important}.print-attendance-numbers{display:grid!important;grid-template-columns:repeat(2,1fr)!important;gap:1mm!important;width:100%!important}.print-attendance-numbers span{padding:1mm!important;border:1px solid #dfe8eb!important;border-radius:1.5mm!important;font-size:2mm!important}.print-attendance-numbers b{font-size:2.8mm!important;color:var(--portal-a)!important}
  .print-bars-card{grid-template-rows:auto 1fr auto!important}.print-bars-card header{display:flex!important;align-items:end!important;justify-content:space-between!important;gap:3mm!important}.print-bars-card header small{font-size:2mm!important;color:#72878f!important}.print-bars-card h2{margin:.5mm 0 0!important;font-size:3.8mm!important;color:var(--portal-a)!important}.print-bars-card header>span{font-size:2mm!important;color:#6f838b!important}.print-bars-svg{width:100%!important;height:100%!important;min-height:42mm!important;overflow:visible!important}.bar-track{fill:#e4ecef!important;stroke:#d6e2e6!important;stroke-width:1!important}.bar-value{fill:var(--portal-b)!important}.bar-unit-label{font-size:11px!important;font-weight:800!important;fill:#294b56!important}.bar-score-label{font-size:10px!important;font-weight:900!important;fill:var(--portal-a)!important}.print-bars-card p{margin:0!important;padding:2mm 2.5mm!important;border-right:1.2mm solid var(--portal-b)!important;border-radius:1.5mm!important;background:var(--portal-soft)!important;font-size:2.2mm!important;line-height:1.45!important;color:#3e5b66!important}.print-bars-card p b{color:var(--portal-a)!important}
  .print-dashboard-guidance{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:2.5mm!important;min-height:0!important}.print-reading-card,.print-plan-card{height:100%!important;min-height:0!important;padding:3mm!important;border-radius:2.5mm!important;overflow:hidden!important}.print-reading-card small,.print-plan-card small{font-size:2.1mm!important}.print-reading-card strong{font-size:3.5mm!important}.print-reading-card p,.print-plan-card li{font-size:2.3mm!important;line-height:1.45!important}.print-plan-card ol{gap:1.6mm!important}.print-dashboard-footer{min-height:0!important;margin:0!important;padding:2mm 3mm!important;border-radius:2mm!important;background:var(--portal-a)!important;color:#fff!important}
}
'''
CSS.write_text(css, encoding="utf-8")

layout = LAYOUT.read_text(encoding="utf-8")
if 'student-dashboard-v68.css' not in layout:
    layout = layout.replace('import "./student-wow-v67.css";\n', 'import "./student-wow-v67.css";\nimport "./student-dashboard-v68.css";\n')
LAYOUT.write_text(layout, encoding="utf-8")

sw = SW.read_text(encoding="utf-8").replace("ostadh-lahooni-v67-student-wow", "ostadh-lahooni-v68-student-dashboard-svg")
SW.write_text(sw, encoding="utf-8")

pwa = PWA.read_text(encoding="utf-8")
pwa = pwa.replace("ostadh-lahooni-v67-student-wow", "ostadh-lahooni-v68-student-dashboard-svg")
pwa = pwa.replace("/sw.js?v=67-student-wow", "/sw.js?v=68-student-dashboard-svg")
PWA.write_text(pwa, encoding="utf-8")

print("v68 student dashboard redesign applied")
