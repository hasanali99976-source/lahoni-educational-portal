from pathlib import Path

page_path = Path('app/teacher/grades/page.tsx')
page = page_path.read_text(encoding='utf-8')

import_anchor = 'import { useGradePlan } from "../../../lib/use-grade-plan";\n'
import_replacement = import_anchor + 'import { downloadGradebookPdfDocument, type GradebookPdfClass } from "../../../lib/grades-pdf";\n'
if 'downloadGradebookPdfDocument' not in page:
    if import_anchor not in page:
        raise SystemExit('grades import anchor missing')
    page = page.replace(import_anchor, import_replacement, 1)

state_anchor = '  const [message, setMessage] = useState("");\n'
state_replacement = state_anchor + '  const [pdfBusy, setPdfBusy] = useState(false);\n  const [allPdfBusy, setAllPdfBusy] = useState(false);\n'
if 'const [pdfBusy' not in page:
    if state_anchor not in page:
        raise SystemExit('grades state anchor missing')
    page = page.replace(state_anchor, state_replacement, 1)

function_anchor = '\n  if (planLoading) return <main className="gradebook-page" dir="rtl"><section className="grade-plan-required">جارٍ تحميل خطة توزيع الدرجات…</section></main>;'
functions = r'''

  function buildPdfClass(className: string): GradebookPdfClass | null {
    if (!activePlan) return null;
    const roster = students
      .filter(student => student.class === className)
      .sort((a, b) => a.name.localeCompare(b.name, "ar"));
    if (!roster.length) return null;

    const sections = activePlan.sections.map(planSection => ({
      id: planSection.id,
      label: planSection.label,
      max: planSection.max,
      columns: planSection.items.map(item => ({ id: item.id, label: item.label, max: item.max })),
      rows: roster.map((student, index) => {
        const source = className === selectedClass ? effectiveStudent(student) : studentForPlan(student);
        const result = calculateGradePlanResult(activePlan, source);
        const sectionResult = result.sections.find(item => item.id === planSection.id);
        return {
          number: index + 1,
          name: student.name,
          values: planSection.items.map(item => readGradeEntry(source, planSection, item).value),
          sectionTotal: sectionResult?.earned || 0,
          overallTotal: result.earned,
          percentage: result.percentage,
        };
      }),
    }));

    return { className, sections };
  }

  async function downloadCurrentClassGradesPdf() {
    if (!activePlan || !selectedClass) return setMessage("اختر الفصل أولًا.");
    const report = buildPdfClass(selectedClass);
    if (!report) return setMessage("لا توجد أسماء طلاب في الفصل المحدد.");
    setPdfBusy(true);
    setMessage(`جارٍ تجهيز PDF كامل لدرجات ${selectedClass}...`);
    try {
      const result = await downloadGradebookPdfDocument({
        portalName: "بوابة أستاذ لحوني التعليمية",
        teacherName: session.teacherName || "المعلم",
        subject: session.subject || "المادة",
        gradeLabel: session.activeGradeLabel || "",
        planLabel: GRADE_PLAN_MODE_LABELS[activePlan.mode],
        planVersion: activePlan.version,
        classes: [report],
        fileName: `درجات-${selectedClass.replace(/[\\/:*?"<>|]/g, "-")}-كامل.pdf`,
      });
      setMessage(`تم إنشاء PDF كامل للفصل: ${result.studentCount} طالبًا في ${result.pageCount} صفحة.`);
    } catch (error) {
      console.error("gradebook-class-pdf-v98", error);
      setMessage("تعذر إنشاء PDF درجات الفصل الآن.");
    } finally {
      setPdfBusy(false);
    }
  }

  async function downloadAllClassesGradesPdf() {
    if (!activePlan || !classes.length) return setMessage("لا توجد فصول متاحة للطباعة.");
    setAllPdfBusy(true);
    setMessage("جارٍ جلب جميع الدرجات وتجهيز PDF لكل الفصول...");
    try {
      const reports = classes.map(buildPdfClass).filter((item): item is GradebookPdfClass => !!item);
      if (!reports.length) throw new Error("gradebook_all_pdf_no_students");
      const result = await downloadGradebookPdfDocument({
        portalName: "بوابة أستاذ لحوني التعليمية",
        teacherName: session.teacherName || "المعلم",
        subject: session.subject || "المادة",
        gradeLabel: session.activeGradeLabel || "",
        planLabel: GRADE_PLAN_MODE_LABELS[activePlan.mode],
        planVersion: activePlan.version,
        classes: reports,
        fileName: `جميع-الدرجات-${(session.subject || "المادة").replace(/[\\/:*?"<>|]/g, "-")}.pdf`,
      });
      setMessage(`تم إنشاء PDF جميع الدرجات: ${result.classCount} فصل، ${result.studentCount} طالبًا، ${result.pageCount} صفحة.`);
    } catch (error) {
      console.error("gradebook-all-pdf-v98", error);
      setMessage("تعذر إنشاء PDF جميع الدرجات الآن.");
    } finally {
      setAllPdfBusy(false);
    }
  }
'''
if 'async function downloadAllClassesGradesPdf' not in page:
    if function_anchor not in page:
        raise SystemExit('grades function insertion anchor missing')
    page = page.replace(function_anchor, functions + function_anchor, 1)

old_button = '<button type="button" className="research-link" onClick={() => window.print()}>🖨 طباعة / PDF</button>'
new_buttons = '<button type="button" className="research-link" onClick={() => void downloadCurrentClassGradesPdf()} disabled={!selectedClass || pdfBusy}>{pdfBusy ? "جارٍ إنشاء PDF..." : "📄 PDF الفصل كامل"}</button><button type="button" className="research-link" onClick={() => void downloadAllClassesGradesPdf()} disabled={allPdfBusy}>{allPdfBusy ? "جارٍ جلب الجميع..." : "📚 جميع الدرجات PDF"}</button>'
if old_button in page:
    page = page.replace(old_button, new_buttons, 1)
elif '📚 جميع الدرجات PDF' not in page:
    raise SystemExit('grades PDF button anchor missing')

page_path.write_text(page, encoding='utf-8')

pwa_path = Path('app/pwa-register.tsx')
pwa = pwa_path.read_text(encoding='utf-8')
pwa = pwa.replace('ostadh-lahooni-v97-grade-plan-quota-fallback', 'ostadh-lahooni-v98-full-grades-pdf')
pwa = pwa.replace('/sw.js?v=97-grade-plan-quota-fallback', '/sw.js?v=98-full-grades-pdf')
pwa_path.write_text(pwa, encoding='utf-8')

sw_path = Path('public/sw.js')
sw = sw_path.read_text(encoding='utf-8')
sw = sw.replace('ostadh-lahooni-v97-grade-plan-quota-fallback', 'ostadh-lahooni-v98-full-grades-pdf')
sw_path.write_text(sw, encoding='utf-8')
