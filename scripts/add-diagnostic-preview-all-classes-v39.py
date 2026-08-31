from pathlib import Path
import re


def must_replace(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"missing marker: {label}")
    return text.replace(old, new, 1)

# 1) Teacher test preview after publishing.
page_path = Path("app/teacher/diagnostics/page.tsx")
page = page_path.read_text(encoding="utf-8")
page = must_replace(
    page,
    '  const [deletingId, setDeletingId] = useState("");\n',
    '  const [deletingId, setDeletingId] = useState("");\n  const [preview, setPreview] = useState<Diagnostic | null>(null);\n',
    "preview state",
)

preview_section = '''    <section className="diagnostic-list"><h2>اختبارات المادة</h2>{!items.length && <p>لا توجد اختبارات حتى الآن.</p>}{items.map(item => <article key={item.id}><div><strong>{item.title}</strong><small>{item.questions.length} أسئلة • {item.published ? "منشور" : "مسودة"}</small></div><div className="diagnostic-list-actions"><button className="preview-test-button" type="button" onClick={() => setPreview(item)}>معاينة الاختبار</button><button className="delete-test-button" disabled={deletingId === item.id} onClick={() => void deleteDiagnostic(item)}>{deletingId === item.id ? "جارٍ الحذف…" : "حذف بالكامل"}</button></div></article>)}</section>
    {preview ? <div className="diagnostic-preview-modal" role="dialog" aria-modal="true" onClick={() => setPreview(null)}><section onClick={event => event.stopPropagation()}><header><div><small>{preview.published ? "اختبار منشور للطلاب" : "اختبار محفوظ كمسودة"}</small><h2>{preview.title}</h2><p>{preview.instructions || "لا توجد تعليمات إضافية."}</p></div><button type="button" onClick={() => setPreview(null)} aria-label="إغلاق المعاينة">×</button></header><div className="diagnostic-preview-questions">{preview.questions.map((question, questionIndex) => <article key={question.id || questionIndex}><div className="preview-question-title"><b>السؤال {questionIndex + 1}</b><span>{question.skill || "مهارة غير محددة"}</span></div><h3>{question.text}</h3><div className="preview-options">{question.options.map((option, optionIndex) => <div key={optionIndex} className={question.correctIndex === optionIndex ? "correct" : ""}><i>{String.fromCharCode(65 + optionIndex)}</i><span>{option}</span>{question.correctIndex === optionIndex ? <strong>الإجابة الصحيحة</strong> : null}</div>)}</div></article>)}</div><footer><button type="button" onClick={() => window.print()}>طباعة المعاينة</button><button type="button" className="primary" onClick={() => setPreview(null)}>إغلاق</button></footer></section></div> : null}</main>;'''
page, count = re.subn(r'    <section className="diagnostic-list">.*?</main>;', preview_section, page, count=1, flags=re.S)
if count != 1:
    raise SystemExit("failed to replace diagnostic list")
page_path.write_text(page, encoding="utf-8")

css_path = Path("app/teacher/diagnostics/diagnostics.css")
css = css_path.read_text(encoding="utf-8")
marker = "/* diagnostic-preview-v39 */"
if marker not in css:
    css += '''\n/* diagnostic-preview-v39 */
.diagnostic-list-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.diagnostic-list .preview-test-button{background:#e1f1ff;color:#155fa7}.diagnostic-list .delete-test-button{background:#ffe7e7;color:#a52929}.diagnostic-preview-modal{position:fixed;inset:0;z-index:1600;display:grid;place-items:center;padding:18px;background:rgba(7,24,39,.72);backdrop-filter:blur(5px)}.diagnostic-preview-modal>section{width:min(920px,100%);max-height:calc(100dvh - 36px);overflow:auto;background:#fff;border-radius:24px;box-shadow:0 30px 90px rgba(0,0,0,.3)}.diagnostic-preview-modal>section>header{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;gap:16px;align-items:flex-start;padding:22px;background:#fff;border-bottom:1px solid #dce8f0}.diagnostic-preview-modal header small{color:#1766c2;font-weight:900}.diagnostic-preview-modal header h2{margin:5px 0}.diagnostic-preview-modal header p{margin:0;color:#62798a}.diagnostic-preview-modal header>button{width:42px;height:42px;border:0;border-radius:50%;background:#eef4f8;font-size:26px;cursor:pointer}.diagnostic-preview-questions{display:grid;gap:14px;padding:20px}.diagnostic-preview-questions>article{padding:18px;border:1px solid #dce8f0;border-radius:17px;background:#f8fbfd}.preview-question-title{display:flex;justify-content:space-between;gap:10px;align-items:center}.preview-question-title span{padding:5px 10px;border-radius:999px;background:#e3f3ff;color:#1761a7;font-size:12px;font-weight:900}.diagnostic-preview-questions h3{margin:12px 0;font-size:18px}.preview-options{display:grid;gap:8px}.preview-options>div{display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px;border:1px solid #dce8f0;border-radius:12px;background:#fff}.preview-options i{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:#edf3f7;font-style:normal;font-weight:900}.preview-options .correct{border-color:#19a879;background:#eafaf5}.preview-options .correct i{background:#19a879;color:#fff}.preview-options strong{color:#08735e;font-size:12px}.diagnostic-preview-modal footer{position:sticky;bottom:0;display:flex;justify-content:flex-end;gap:9px;padding:15px 20px;background:#fff;border-top:1px solid #dce8f0}.diagnostic-preview-modal footer button{border:0;border-radius:11px;padding:11px 18px;font-weight:900;cursor:pointer}.diagnostic-preview-modal footer .primary{background:#1766c2;color:#fff}@media(max-width:650px){.diagnostic-list article{align-items:flex-start;gap:12px;flex-direction:column}.diagnostic-list-actions{width:100%;display:grid;grid-template-columns:1fr 1fr}.diagnostic-list-actions button{width:100%}.diagnostic-preview-modal{padding:6px}.diagnostic-preview-modal>section{max-height:calc(100dvh - 12px);border-radius:16px}.diagnostic-preview-modal>section>header{padding:15px}.diagnostic-preview-questions{padding:12px}.preview-question-title{align-items:flex-start;flex-direction:column}.preview-options>div{grid-template-columns:30px minmax(0,1fr)}.preview-options strong{grid-column:2}}@media print{.teacher-sidebar,.teacher-mobile-header,.teacher-welcome-strip,.diagnostics-hero,.diag-results,.diagnostic-builder,.diagnostic-list,.teacher-menu-button,.diagnostic-preview-modal header>button,.diagnostic-preview-modal footer{display:none!important}.diagnostic-preview-modal{position:static;display:block;padding:0;background:#fff}.diagnostic-preview-modal>section{width:100%;max-height:none;overflow:visible;box-shadow:none}.diagnostic-preview-modal>section>header{position:static}.diagnostic-preview-questions{padding:0}.diagnostic-preview-questions>article{break-inside:avoid}}
'''
css_path.write_text(css, encoding="utf-8")

# 2) All classes selector and one PDF with a separate page per class.
results_path = Path("app/teacher/diagnostics/diagnostic-results.tsx")
results = results_path.read_text(encoding="utf-8")
results = must_replace(
    results,
    '  useEffect(() => {\n    if (!classes.length) { setClassName(""); return; }\n    if (!classes.includes(className)) setClassName(classes[0]);\n  }, [classes, className]);',
    '  useEffect(() => {\n    if (!classes.length) { setClassName(""); return; }\n    if (className !== "all" && !classes.includes(className)) setClassName("all");\n  }, [classes, className]);',
    "all classes default",
)
results = must_replace(
    results,
    '''  const rosterRows = useMemo<RosterRow[]>(() => students
    .filter(student => classOf(student) === className)
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ar"))
    .map(student => ({ student, result: latestResultByStudent.get(student.id) })), [students, className, latestResultByStudent]);''',
    '''  const allRosterRows = useMemo<RosterRow[]>(() => students
    .sort((a, b) => classOrder(classOf(a)) - classOrder(classOf(b)) || String(a.name || "").localeCompare(String(b.name || ""), "ar"))
    .map(student => ({ student, result: latestResultByStudent.get(student.id) })), [students, latestResultByStudent]);

  const rosterRows = useMemo<RosterRow[]>(() => className === "all"
    ? allRosterRows
    : allRosterRows.filter(row => classOf(row.student) === className), [allRosterRows, className]);''',
    "all roster rows",
)
results = must_replace(
    results,
    '  const diagnosticTitle = diagnostics.find(item => item.id === testId)?.title || "الاختبار التشخيصي";\n  const smartSummary = !rosterRows.length',
    '  const diagnosticTitle = diagnostics.find(item => item.id === testId)?.title || "الاختبار التشخيصي";\n  const selectedClassLabel = className === "all" ? "جميع الفصول" : classDisplay(className);\n  const smartSummary = !rosterRows.length',
    "selected class label",
)
results = results.replace('${classDisplay(className)} هذا الاختبار', '${selectedClassLabel} هذا الاختبار')
results = must_replace(
    results,
    '    if (!testId || !className || !rows.length || aiLoading) return;',
    '    if (!testId || !className || className === "all" || !rows.length || aiLoading) return;',
    "AI single class",
)

new_report = r'''  function rowsForClass(key: string) {
    return allRosterRows.filter(row => classOf(row.student) === key);
  }

  function reportPage(key: string, rows: RosterRow[], index: number) {
    const completed = rows.filter(row => row.result);
    const completedTotal = completed.length;
    const pendingTotal = Math.max(0, rows.length - completedTotal);
    const classAverage = completedTotal
      ? Math.round(completed.reduce((sum, row) => sum + percentOf(row.result as Result), 0) / completedTotal)
      : 0;
    const rowsHtml = rows.map((row, rowIndex) => {
      const result = row.result;
      const status = result ? "عمل الاختبار" : "لم يعمل الاختبار";
      const plan = result ? (result.teacherPlan || result.aiPlan || result.plan || fallbackPlan(result, row.student.name || "الطالب", subjectName)) : "—";
      return `<tr class="${result ? "done" : "pending"}"><td>${rowIndex + 1}</td><td>${escapeHtml(row.student.name || row.student.id)}</td><td>${escapeHtml(status)}</td><td>${result ? `${result.score}/${result.total}` : "—"}</td><td>${result ? `${percentOf(result)}%` : "—"}</td><td>${result ? escapeHtml(resultLevel(result)) : "بانتظار الاختبار"}</td><td>${escapeHtml(result?.weakSkills?.join("، ") || "—")}</td><td>${escapeHtml(plan)}</td></tr>`;
    }).join("");
    return `<main class="page${index ? " page-break" : ""}"><div class="portal">${PORTAL_NAME}</div><h1>متابعة أداء الاختبار التشخيصي والخطط العلاجية</h1><div class="meta"><span><b>المادة:</b> ${escapeHtml(subjectName)}</span><span><b>الفصل:</b> ${escapeHtml(classDisplay(key))}</span><span><b>الاختبار:</b> ${escapeHtml(diagnosticTitle)}</span><span><b>عدد الطلاب:</b> ${rows.length}</span></div><div class="stats"><span>عمل الاختبار: ${completedTotal}</span><span>لم يعمل: ${pendingTotal}</span><span>نسبة الإنجاز: ${rows.length ? Math.round((completedTotal / rows.length) * 100) : 0}%</span><span>المتوسط: ${classAverage}%</span></div><table><thead><tr><th>م</th><th>الطالب</th><th>الحالة</th><th>الدرجة</th><th>النسبة</th><th>المستوى</th><th>المهارات الضعيفة</th><th>الخطة المقترحة</th></tr></thead><tbody>${rowsHtml}</tbody></table><div class="footer"><span>توقيع المعلم: __________</span><strong>${PORTAL_NAME}</strong><span>اعتماد الإدارة: __________</span></div></main>`;
  }

  function printClassReport() {
    if (!className || !testId) return window.alert("اختر الفصول والاختبار أولًا.");
    const reportClasses = className === "all" ? classes : [className];
    const pages = reportClasses
      .map(key => ({ key, rows: rowsForClass(key) }))
      .filter(item => item.rows.length)
      .map((item, index) => reportPage(item.key, item.rows, index));
    if (!pages.length) return window.alert("لا توجد أسماء في الفصول المحددة.");
    const popup = window.open("", "_blank", "width=1400,height=900");
    if (!popup) return;
    popup.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>متابعة الاختبار التشخيصي — ${escapeHtml(className === "all" ? "جميع الفصول" : classDisplay(className))}</title><style>@page{size:A4 landscape;margin:8mm}*{box-sizing:border-box}body{font-family:Arial,Tahoma,sans-serif;color:#172b3a;margin:0}.toolbar{position:sticky;top:0;z-index:5;display:flex;justify-content:center;gap:8px;padding:8px;background:#173f61}.toolbar button{border:0;border-radius:8px;padding:9px 16px;font-weight:800;cursor:pointer}.page{padding:5mm;min-height:190mm}.page-break{break-before:page;page-break-before:always}.portal{text-align:center;color:#173f61;font-weight:900;border-bottom:2px solid #173f61;padding-bottom:5px}h1{text-align:center;font-size:18px;margin:8px}.meta,.stats{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #263746}.meta span,.stats span{padding:6px;border-left:1px solid #263746;font-size:11px}.stats{border-top:0}.stats span{font-weight:800}table{width:100%;border-collapse:collapse;margin-top:8px;table-layout:fixed}th,td{border:1px solid #52677a;padding:4px;font-size:7.5px;vertical-align:top;overflow-wrap:anywhere}th{background:#eaf1f6}.pending{background:#fff7e8}.done{background:#f5fff9}th:nth-child(1){width:3%}th:nth-child(2){width:13%}th:nth-child(3){width:9%}th:nth-child(4){width:7%}th:nth-child(5){width:6%}th:nth-child(6){width:9%}th:nth-child(7){width:17%}th:nth-child(8){width:36%}.footer{margin-top:8px;display:flex;justify-content:space-between;border-top:1px solid #8a9aa8;padding-top:5px;font-size:9px}@media print{.toolbar{display:none}.page{padding:0}.page-break{break-before:page;page-break-before:always}}</style></head><body><div class="toolbar"><button onclick="window.print()">طباعة أو حفظ PDF</button><button onclick="window.close()">إغلاق</button></div>${pages.join("")}</body></html>`);
    popup.document.close();
  }

  return <section'''
results, count = re.subn(r'  function printClassReport\(\) \{.*?\n  \}\n\n  return <section', new_report, results, count=1, flags=re.S)
if count != 1:
    raise SystemExit("failed to replace print report")

results = must_replace(
    results,
    '<div className="diag-head-actions"><button onClick={printClassReport} disabled={!className || !testId || !visibleRows.length}>تقرير الفصل PDF</button><button className="secondary" onClick={downloadCsv} disabled={!visibleRows.length}>تحميل Excel</button></div>',
    '<div className="diag-head-actions"><button onClick={printClassReport} disabled={!className || !testId || !students.length}>{className === "all" ? "تقرير جميع الفصول PDF" : "تقرير الفصل PDF"}</button><button className="secondary" onClick={downloadCsv} disabled={!visibleRows.length}>تحميل Excel</button></div>',
    "report button",
)
results = must_replace(
    results,
    '<label><span>١</span><div>اختر الفصل<small>تظهر قائمة طلاب الفصل كاملة</small></div><select value={className} onChange={event => { setClassName(event.target.value); setStatusFilter("all"); setSearchName(""); }}>{classes.map(item => <option key={item} value={item}>{classDisplay(item)}</option>)}</select></label>',
    '<label><span>١</span><div>اختر الفصل<small>اختر فصلًا أو جميع الفصول للتقرير الكامل</small></div><select value={className} onChange={event => { setClassName(event.target.value); setStatusFilter("all"); setSearchName(""); }}><option value="all">جميع الفصول</option>{classes.map(item => <option key={item} value={item}>{classDisplay(item)}</option>)}</select></label>',
    "all classes option",
)
results = results.replace('<span>طلاب الفصل</span>', '<span>طلاب النطاق</span>', 1)
results = must_replace(
    results,
    '<button onClick={() => void generateAiPlans()} disabled={aiLoading || !completedCount}>{aiLoading ? "جارٍ تحليل النتائج…" : "اقتراح الخطط بالذكاء الاصطناعي"}</button>',
    '<button onClick={() => void generateAiPlans()} disabled={aiLoading || !completedCount || className === "all"}>{aiLoading ? "جارٍ تحليل النتائج…" : className === "all" ? "اختر فصلًا لإنشاء الخطط" : "اقتراح الخطط بالذكاء الاصطناعي"}</button>',
    "AI button",
)
results_path.write_text(results, encoding="utf-8")

# 3) Bust the installed app cache.
for filename in ["app/pwa-register.tsx", "public/sw.js"]:
    path = Path(filename)
    text = path.read_text(encoding="utf-8")
    text = text.replace("ostadh-lahooni-v38-class-scope", "ostadh-lahooni-v39-diagnostic-preview-all-classes")
    text = text.replace("38-class-scope", "39-diagnostic-preview-all-classes")
    path.write_text(text, encoding="utf-8")
