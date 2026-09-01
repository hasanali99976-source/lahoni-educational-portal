from pathlib import Path
import re

ROOT = Path('.')
PAGE = ROOT / 'app/student/page.tsx'
LAYOUT = ROOT / 'app/student/layout.tsx'
KEYBOARD = ROOT / 'app/student/student-keyboard-scroll.tsx'
STYLE = ROOT / 'app/student/student-refine-v64.css'
SW = ROOT / 'public/sw.js'
PWA = ROOT / 'app/pwa-register.tsx'


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'missing pattern: {label}')
    return text.replace(old, new, 1)

page = PAGE.read_text(encoding='utf-8')

replacements = {
    '{ key: "home", icon: "⌂", label: "الرئيسية", note: "رحلتي اليوم" },': '{ key: "home", icon: "⌂", label: "ملخصي", note: "وضعي الآن" },',
    '{ key: "achievement", icon: "◫", label: "تحصيلي", note: "درجاتي وخطتي" },': '{ key: "achievement", icon: "◫", label: "تحصيلي", note: "درجاتي وتقدمي" },',
    '{ key: "tests", icon: "✓", label: "اختباراتي", note: "المتاح والنتائج" },': '{ key: "tests", icon: "✓", label: "اختباراتي", note: "المتاح ونتائجي" },',
    '{ key: "attendance", icon: "◉", label: "انضباطي", note: "الحضور والمتابعة" },': '{ key: "attendance", icon: "◉", label: "حضوري", note: "الحضور والانضباط" },',
    '{ key: "ai", icon: "✦", label: "المساعد", note: "توجيه ذكي" },': '{ key: "ai", icon: "✦", label: "مساعدي", note: "تحليل وخطة" },',
}
for old, new in replacements.items():
    page = replace_once(page, old, new, old)

old_topline = '''        <div className="knowledge-sync" title="تتحدث بياناتك تلقائيًا"><i /><div><b>البيانات محدثة</b><small>تحديث تلقائي وآمن</small></div></div>'''
new_topline = '''        <div className="knowledge-topline-tools">
          <div className="knowledge-sync" title="تتحدث بياناتك تلقائيًا"><i /><div><b>البيانات محدثة</b><small>تحديث تلقائي وآمن</small></div></div>
          <button type="button" className="knowledge-print-quick" data-student-action="print" data-native-print="true" onClick={() => window.print()}><span>▤</span><div><b>تقرير الطالب</b><small>طباعة البيانات والتفاصيل</small></div></button>
        </div>'''
page = replace_once(page, old_topline, new_topline, 'topline print button')

old_actions = '''      <div className="knowledge-actions" aria-label="إجراءات الطالب">
        <button type="button" className="primary" data-student-action="print" data-native-print="true" onClick={() => window.print()}><span>▤</span><div><b>طباعة التقرير</b><small>تقرير شامل PDF</small></div></button>
        <button type="button" data-student-action="subjects" onClick={showStudentSubjects}><span>▦</span><div><b>تغيير المادة</b><small>عرض مواد الطالب</small></div></button>
        <button type="button" className="danger" data-student-action="logout" onClick={exitStudentPortal}><span>↪</span><div><b>تسجيل الخروج</b><small>إنهاء الجلسة</small></div></button>
      </div>'''
new_actions = '''      <div className="knowledge-actions" aria-label="إجراءات الطالب">
        <button type="button" data-student-action="subjects" onClick={showStudentSubjects}><span>▦</span><div><b>تغيير المادة</b><small>عرض جميع المواد المرتبطة بك</small></div></button>
        <button type="button" className="danger" data-student-action="logout" onClick={exitStudentPortal}><span>↪</span><div><b>تسجيل الخروج</b><small>إنهاء جلسة الطالب الحالية</small></div></button>
      </div>'''
page = replace_once(page, old_actions, new_actions, 'student actions')

print_start = page.find('    <section className="student-print-report"')
print_end = page.find('\n  </main>;', print_start)
if print_start < 0 or print_end < 0:
    raise SystemExit('print report block not found')

new_print = '''    <section className="student-print-report knowledge-print-report" aria-label="تقرير الطالب القابل للطباعة">
      <header className="student-print-head knowledge-print-head">
        <div><small>بوابة أستاذ لحوني التعليمية</small><h1>تقرير التحصيل العلمي والمتابعة</h1><p>{selected.subjectLabel} • {selected.teacherName}</p></div>
        <div className="student-print-badge"><span>{selected.icon}</span><strong>{ar(percentage)}٪</strong><small>مستوى التحصيل</small></div>
      </header>

      <section className="student-print-identity knowledge-print-identity">
        <div><span>اسم الطالب</span><strong>{selected.data.name || "الطالب"}</strong></div>
        <div><span>الفصل</span><strong>{classLabel}</strong></div>
        <div><span>المادة</span><strong>{selected.subjectLabel}</strong></div>
        <div><span>المعلم</span><strong>{selected.teacherName}</strong></div>
        <div><span>تاريخ التقرير</span><strong>{new Intl.DateTimeFormat("ar-SA", { dateStyle: "long" }).format(new Date())}</strong></div>
        <div><span>حالة البيانات</span><strong>محدثة من بوابة الطالب</strong></div>
      </section>

      <section className="knowledge-print-summary" aria-label="ملخص الأرقام">
        <article><span>المجموع الكلي</span><strong>{ar(finalTotal)} / {ar(FINAL_MAX)}</strong><small>إجمالي ما رُصد للطالب</small></article>
        <article><span>نسبة التحصيل</span><strong>{ar(percentage)}٪</strong><small>مقارنة بالدرجة الكاملة</small></article>
        <article><span>الحضور</span><strong>{ar(attendanceSummary.present)}</strong><small>أيام أو حصص الحضور المعتمدة</small></article>
        <article><span>الغياب</span><strong>{ar(attendanceSummary.absent)}</strong><small>الحالات المسجلة غيابًا</small></article>
        <article><span>التأخر</span><strong>{ar(attendanceSummary.late)}</strong><small>مرات التأخر المسجلة</small></article>
        <article><span>الانضباط</span><strong>{ar(attendanceSummary.disciplineRate)}٪</strong><small>مؤشر الانتظام في المادة</small></article>
      </section>

      <section className="knowledge-print-reading">
        <article className="strength"><small>نقطة القوة الحالية</small><strong>{strongestUnit?.label || "بانتظار رصد الدرجات"}</strong><p>{strongestUnit ? `حقق الطالب ${ar(strongestUnit.total)} من ${ar(UNIT_MAX)} في هذا الجانب.` : "ستظهر نقطة القوة بعد اكتمال رصد الدرجات."}</p></article>
        <article className="priority"><small>أولوية التحسين</small><strong>{weakestUnit?.label || "المراجعة المنتظمة"}</strong><p>{weakestUnit ? `الدرجة الحالية ${ar(weakestUnit.total)} من ${ar(UNIT_MAX)}؛ ويوصى بمراجعة المهارة ثم التدريب عليها.` : "يوصى بالبدء بمراجعة المهارات الأساسية."}</p></article>
      </section>

      <section className="student-print-section knowledge-print-table"><h2>تفصيل درجات الوحدات</h2><p className="knowledge-print-help">يبين الجدول مكونات درجة كل وحدة، ثم مجموعها من الدرجة المخصصة للوحدة.</p><table><thead><tr><th>الوحدة</th><th>الحضور</th><th>المشاركة</th><th>الواجبات</th><th>الاختبار</th><th>المجموع</th></tr></thead><tbody>{units.map(unit => <tr key={`print-${unit.key}`}><td>{unit.label}</td><td>{ar(unit.attendance)} / {ar(GRADE_DISTRIBUTION.attendance)}</td><td>{ar(unit.participation)} / {ar(GRADE_DISTRIBUTION.participation)}</td><td>{ar(unit.homework)} / {ar(GRADE_DISTRIBUTION.homework)}</td><td>{ar(unit.unitExam)} / {ar(GRADE_DISTRIBUTION.unitExam)}</td><td><strong>{ar(unit.total)} / {ar(UNIT_MAX)}</strong></td></tr>)}</tbody></table></section>

      <section className="knowledge-print-attendance"><h2>تفاصيل الحضور والانضباط</h2><div><article><span>حاضر</span><strong>{ar(attendanceSummary.present)}</strong></article><article><span>غائب</span><strong>{ar(attendanceSummary.absent)}</strong></article><article><span>متأخر</span><strong>{ar(attendanceSummary.late)}</strong></article><article><span>مستأذن</span><strong>{ar(attendanceSummary.excused)}</strong></article><article><span>هروب</span><strong>{ar(attendanceSummary.escaped)}</strong></article></div><p>{disciplineMessage}</p></section>

      <section className="knowledge-print-plan"><div><h2>خطة الطالب المقترحة</h2><p>خطوات قصيرة مبنية على مستوى التحصيل الحالي:</p></div><ol>{dailyPlan.map(item => <li key={`print-plan-${item}`}>{item}</li>)}</ol></section>

      <section className="student-print-note knowledge-print-note"><h2>ملاحظة المتابعة والتوصية</h2><p>{selected.data.parentCounselorLastNotice?.message || selected.data.teacherNote || `${smartMessage} الأولوية الحالية: ${weakestUnit?.label || "المراجعة المنتظمة"}.`}</p></section>
      <footer><span>تقرير تعليمي صادر من بوابة أستاذ لحوني التعليمية</span><span>المعلم: {selected.teacherName}</span></footer>
    </section>'''
page = page[:print_start] + new_print + page[print_end:]
PAGE.write_text(page, encoding='utf-8')

KEYBOARD.write_text('''"use client";

import { useEffect } from "react";

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]'));
}

export default function StudentKeyboardScroll() {
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const previous = {
      rootOverflowY: root.style.overflowY,
      rootHeight: root.style.height,
      rootScrollBehavior: root.style.scrollBehavior,
      bodyOverflowY: body.style.overflowY,
      bodyHeight: body.style.height,
    };

    root.style.overflowY = "auto";
    root.style.height = "auto";
    root.style.scrollBehavior = "smooth";
    body.style.overflowY = "auto";
    body.style.height = "auto";

    const move = (top: number) => window.scrollBy({ top, behavior: "smooth" });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || isEditableTarget(event.target)) return;
      const pageStep = Math.max(320, Math.round(window.innerHeight * 0.78));
      if (event.key === "ArrowDown") { event.preventDefault(); move(120); }
      else if (event.key === "ArrowUp") { event.preventDefault(); move(-120); }
      else if (event.key === "PageDown") { event.preventDefault(); move(pageStep); }
      else if (event.key === "PageUp") { event.preventDefault(); move(-pageStep); }
      else if (event.key === "Home") { event.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }
      else if (event.key === "End") { event.preventDefault(); window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" }); }
      else if (event.key === " " && !(event.target instanceof Element && event.target.closest("button,a"))) { event.preventDefault(); move(event.shiftKey ? -pageStep : pageStep); }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      root.style.overflowY = previous.rootOverflowY;
      root.style.height = previous.rootHeight;
      root.style.scrollBehavior = previous.rootScrollBehavior;
      body.style.overflowY = previous.bodyOverflowY;
      body.style.height = previous.bodyHeight;
    };
  }, []);

  return null;
}
''', encoding='utf-8')

layout = LAYOUT.read_text(encoding='utf-8')
if 'student-refine-v64.css' not in layout:
    layout = replace_once(layout, 'import "./student-knowledge-v63.css";\n', 'import "./student-knowledge-v63.css";\nimport "./student-refine-v64.css";\n', 'layout css import')
LAYOUT.write_text(layout, encoding='utf-8')

STYLE.write_text('''/* تحسين بوابة الطالب v64: تبويبات متناسقة وطباعة بيانات واضحة */
.student-scroll-controller{display:none!important}
.knowledge-topline-tools{display:flex;align-items:center;gap:10px}
.knowledge-print-quick{display:grid!important;grid-template-columns:38px minmax(0,1fr)!important;align-items:center!important;gap:9px!important;min-height:52px!important;padding:7px 11px!important;border:1px solid #fff!important;border-radius:14px!important;background:#fff!important;color:var(--portal-a)!important;font:inherit!important;text-align:right!important;cursor:pointer!important;box-shadow:0 10px 25px rgba(0,0,0,.13)!important}
.knowledge-print-quick>span{display:grid;place-items:center;width:38px;height:38px;border-radius:11px;background:var(--portal-soft);color:var(--portal-b);font-size:19px;font-weight:900}
.knowledge-print-quick>div{display:grid;gap:1px}.knowledge-print-quick b{font-size:12px}.knowledge-print-quick small{font-size:9px;color:#61757e}
.knowledge-actions{grid-template-columns:repeat(2,minmax(0,1fr))!important}
.knowledge-tabs{padding:7px!important;gap:6px!important;border-radius:18px!important}
.knowledge-tabs button{grid-template-columns:34px minmax(0,1fr)!important;gap:7px!important;min-height:57px!important;padding:7px 9px!important;border-radius:13px!important}
.knowledge-tabs button>span{width:34px!important;height:34px!important;border-radius:10px!important;font-size:16px!important}
.knowledge-tabs button b{font-size:12px!important;line-height:1.2!important}.knowledge-tabs button small{font-size:8.5px!important;line-height:1.25!important}
.student-print-report{display:none}

@media(max-width:820px){
  .knowledge-topline{display:grid!important;grid-template-columns:1fr!important;gap:10px!important}
  .knowledge-topline-tools{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;width:100%!important}
  .knowledge-sync,.knowledge-print-quick{width:100%!important;min-width:0!important;min-height:50px!important}
  .knowledge-print-quick{grid-template-columns:34px minmax(0,1fr)!important;padding:6px 8px!important}
  .knowledge-print-quick>span{width:34px;height:34px}.knowledge-print-quick b{font-size:10px}.knowledge-print-quick small{font-size:8px}
  .knowledge-actions{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  .knowledge-tabs{position:fixed!important;top:auto!important;right:6px!important;left:6px!important;bottom:max(6px,env(safe-area-inset-bottom))!important;z-index:120!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:3px!important;padding:5px!important;border-radius:17px!important;overflow:hidden!important}
  .knowledge-tabs button{display:grid!important;grid-template-columns:1fr!important;place-items:center!important;gap:2px!important;min-width:0!important;min-height:59px!important;padding:5px 1px!important;text-align:center!important;border-radius:12px!important;overflow:hidden!important}
  .knowledge-tabs button>span{width:27px!important;height:27px!important;border-radius:8px!important;font-size:14px!important}
  .knowledge-tabs button div{display:block!important;width:100%!important;min-width:0!important}.knowledge-tabs button b{display:block!important;font-size:9px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}.knowledge-tabs button small{display:none!important}
}

@media(max-width:390px){
  .knowledge-topline-tools{grid-template-columns:1fr!important}
  .knowledge-actions{grid-template-columns:1fr!important}
  .knowledge-tabs{right:3px!important;left:3px!important;gap:2px!important;padding:4px!important}
  .knowledge-tabs button{min-height:56px!important}.knowledge-tabs button b{font-size:8.2px!important}
}

@media print{
  @page{size:A4 portrait;margin:8mm}
  html,body{width:auto!important;height:auto!important;overflow:visible!important;background:#fff!important}
  body *{visibility:hidden!important}
  .student-print-report,.student-print-report *{visibility:visible!important}
  .student-knowledge-shell{display:block!important;width:auto!important;min-height:0!important;padding:0!important;background:#fff!important;color:#172f39!important}
  .student-knowledge-shell>*:not(.student-print-report){display:none!important}
  .student-print-report.knowledge-print-report{display:block!important;position:absolute!important;inset:0 auto auto 0!important;width:100%!important;max-width:none!important;margin:0!important;font-family:"Tajawal","Segoe UI",Tahoma,Arial,sans-serif!important;color:#172f39!important}
  .knowledge-print-head{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:14px!important;padding:15px 17px!important;border:0!important;border-radius:15px!important;background:linear-gradient(135deg,var(--portal-a,#174e58),var(--portal-b,#168b80))!important;color:#fff!important;print-color-adjust:exact!important;-webkit-print-color-adjust:exact!important}
  .knowledge-print-head h1{margin:3px 0!important;font-size:22px!important;color:#fff!important}.knowledge-print-head p,.knowledge-print-head small{margin:0!important;color:#e2f3f1!important}.knowledge-print-head .student-print-badge{display:grid!important;place-items:center!important;min-width:105px!important;padding:8px!important;border:1px solid rgba(255,255,255,.3)!important;border-radius:12px!important;background:rgba(255,255,255,.13)!important}.knowledge-print-head .student-print-badge span{font-size:20px!important}.knowledge-print-head .student-print-badge strong{font-size:22px!important;color:#fff!important}.knowledge-print-head .student-print-badge small{font-size:8px!important}
  .knowledge-print-identity{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px!important;margin-top:8px!important}.knowledge-print-identity div{display:grid!important;gap:2px!important;padding:8px 9px!important;border:1px solid #d8e4e8!important;border-radius:9px!important;background:#f7fafb!important}.knowledge-print-identity span{font-size:8px!important;color:#697f88!important}.knowledge-print-identity strong{font-size:10px!important;color:#173742!important}
  .knowledge-print-summary{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px!important;margin-top:8px!important}.knowledge-print-summary article{display:grid!important;gap:2px!important;padding:8px!important;border:1px solid #d8e4e8!important;border-radius:9px!important;background:#fff!important}.knowledge-print-summary span{font-size:8px!important;color:#687f89!important}.knowledge-print-summary strong{font-size:14px!important;color:var(--portal-a,#174e58)!important}.knowledge-print-summary small{font-size:7px!important;color:#7a8d95!important;line-height:1.35!important}
  .knowledge-print-reading{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:7px!important;margin-top:8px!important}.knowledge-print-reading article{padding:9px 10px!important;border:1px solid #d7e4e7!important;border-radius:10px!important;background:#fff!important}.knowledge-print-reading article.strength{border-right:4px solid #24865f!important}.knowledge-print-reading article.priority{border-right:4px solid #cc8123!important}.knowledge-print-reading small{font-size:8px!important;color:#6d818a!important}.knowledge-print-reading strong{display:block!important;margin:2px 0!important;font-size:12px!important}.knowledge-print-reading p{margin:0!important;font-size:8px!important;line-height:1.5!important;color:#526a74!important}
  .knowledge-print-table{margin-top:8px!important;padding:9px!important;border:1px solid #d5e2e6!important;border-radius:10px!important;background:#fff!important;break-inside:avoid!important}.knowledge-print-table h2,.knowledge-print-attendance h2,.knowledge-print-plan h2,.knowledge-print-note h2{margin:0 0 4px!important;font-size:13px!important;color:var(--portal-a,#174e58)!important}.knowledge-print-help{margin:0 0 6px!important;font-size:7px!important;color:#6c8089!important}.knowledge-print-table table{width:100%!important;border-collapse:collapse!important}.knowledge-print-table th,.knowledge-print-table td{padding:5px!important;border:1px solid #dce6e9!important;font-size:7.5px!important;text-align:center!important}.knowledge-print-table th{background:var(--portal-soft,#eef7f5)!important;color:#21444d!important;print-color-adjust:exact!important;-webkit-print-color-adjust:exact!important}
  .knowledge-print-attendance{margin-top:8px!important;padding:9px!important;border:1px solid #d5e2e6!important;border-radius:10px!important;break-inside:avoid!important}.knowledge-print-attendance>div{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:5px!important}.knowledge-print-attendance article{display:grid!important;gap:2px!important;padding:6px!important;text-align:center!important;border-radius:8px!important;background:#f5f8f9!important}.knowledge-print-attendance span{font-size:7px!important;color:#667c85!important}.knowledge-print-attendance strong{font-size:12px!important}.knowledge-print-attendance p{margin:6px 0 0!important;font-size:8px!important;color:#536a74!important}
  .knowledge-print-plan{display:grid!important;grid-template-columns:minmax(0,.72fr) minmax(0,1.28fr)!important;gap:8px!important;margin-top:8px!important;padding:9px!important;border:1px solid #d5e2e6!important;border-radius:10px!important;background:var(--portal-soft,#eef7f5)!important;break-inside:avoid!important;print-color-adjust:exact!important;-webkit-print-color-adjust:exact!important}.knowledge-print-plan p{margin:0!important;font-size:8px!important;color:#60757d!important}.knowledge-print-plan ol{margin:0!important;padding-right:17px!important;font-size:8px!important;line-height:1.65!important}
  .knowledge-print-note{margin-top:8px!important;padding:9px!important;border:1px solid #d5e2e6!important;border-radius:10px!important;break-inside:avoid!important}.knowledge-print-note p{margin:0!important;font-size:9px!important;line-height:1.6!important;color:#405b65!important}
  .knowledge-print-report footer{display:flex!important;justify-content:space-between!important;gap:10px!important;margin-top:8px!important;padding-top:6px!important;border-top:1px solid #ccdadd!important;font-size:7px!important;color:#6b7f87!important}
}
''', encoding='utf-8')

sw = SW.read_text(encoding='utf-8')
sw = re.sub(r'const CACHE_NAME = "[^"]+";', 'const CACHE_NAME = "ostadh-lahooni-v64-student-report-tabs";', sw, count=1)
SW.write_text(sw, encoding='utf-8')

pwa = PWA.read_text(encoding='utf-8')
pwa = re.sub(r'const CURRENT_CACHE = "[^"]+";', 'const CURRENT_CACHE = "ostadh-lahooni-v64-student-report-tabs";', pwa, count=1)
pwa = re.sub(r'const RELOAD_KEY = "[^"]+";', 'const RELOAD_KEY = "ostadh-lahooni-v64-student-report-tabs";', pwa, count=1)
pwa = re.sub(r'/sw\.js\?v=[^"\']+', '/sw.js?v=64-student-report-tabs', pwa, count=1)
PWA.write_text(pwa, encoding='utf-8')

print('refined student tabs, keyboard scroll, and detailed print report v64')
