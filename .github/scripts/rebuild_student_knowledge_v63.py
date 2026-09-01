from pathlib import Path
import re

ROOT = Path('.')
PAGE = ROOT / 'app/student/page.tsx'
LAYOUT = ROOT / 'app/student/layout.tsx'
SCROLL = ROOT / 'app/student/student-keyboard-scroll.tsx'
STYLE = ROOT / 'app/student/student-knowledge-v63.css'
SW = ROOT / 'public/sw.js'
PWA = ROOT / 'app/pwa-register.tsx'

page = PAGE.read_text(encoding='utf-8')
page = page.replace('import Link from "next/link";\n', '', 1)
page = page.replace('import StudentDiagnostics from "./student-diagnostics";\n', 'import StudentDiagnostics from "./student-diagnostics";\nimport StudentKeyboardScroll from "./student-keyboard-scroll";\n', 1)

old_tabs_pattern = re.compile(r'type StudentTab = .*?const tabs: \{ key: StudentTab; icon: string; label: string; note: string \}\[\] = \[.*?\n\];', re.S)
new_tabs = '''type StudentTab = "home" | "achievement" | "tests" | "attendance" | "ai";

type SubjectKnowledgeProfile = {
  eyebrow: string;
  title: string;
  description: string;
  prompt: string;
};

const CODE_PATTERN = /^TH[123]\\d{3}$/;
const STUDENT_CODE_EXAMPLE = "TH1234";
const ar = (value: number) => new Intl.NumberFormat("ar-SA-u-nu-arab", { maximumFractionDigits: 1 }).format(Number.isFinite(value) ? value : 0);
const encouragements = ["البداية ممكنة، ركّز على خطوة واحدة اليوم.","ابدأ بخطة قصيرة واطلب مساعدة معلمك.","كل مراجعة صغيرة ترفع مستواك.","رتّب وقتك وابدأ بالمهارة الأضعف.","أنت قادر على التحسن، استمر.","تقدمك بدأ يظهر، لا تتوقف.","راجع أخطاءك وحوّلها إلى نقاط قوة.","خطوة جميلة، واصل التدريب.","أداؤك يتحسن بثبات.","أنت قريب من المستوى الجيد.","عمل جيد، ركّز على التفاصيل.","ثباتك يصنع الفرق.","مستواك جيد وقابل للارتفاع سريعًا.","أحسنت، حافظ على انتظامك.","تقدم واضح، استمر على خطتك.","أداء قوي، بقيت لمسات بسيطة.","متميز، راجع بذكاء للمحافظة على مستواك.","قريب جدًا من القمة.","أداء رائع ومطمئن.","مبدع، واصل تميزك.","إنجاز استثنائي، أنت قدوة في الاجتهاد."];
const tabs: { key: StudentTab; icon: string; label: string; note: string }[] = [
  { key: "home", icon: "⌂", label: "الرئيسية", note: "رحلتي اليوم" },
  { key: "achievement", icon: "◫", label: "تحصيلي", note: "درجاتي وخطتي" },
  { key: "tests", icon: "✓", label: "اختباراتي", note: "المتاح والنتائج" },
  { key: "attendance", icon: "◉", label: "انضباطي", note: "الحضور والمتابعة" },
  { key: "ai", icon: "✦", label: "المساعد", note: "توجيه ذكي" },
];'''
page, changed = old_tabs_pattern.subn(lambda _match: new_tabs, page, count=1)
if changed != 1:
    raise SystemExit('failed to replace student tabs block')

profile_helper = '''
function subjectKnowledgeProfile(subjectKey: string, subjectLabel: string): SubjectKnowledgeProfile {
  const key = subjectKey.split("--")[0];
  if (["history", "geography", "social-studies", "social-sciences", "citizenship"].includes(key)) {
    return { eyebrow: "بوابة المعرفة والوعي", title: `اكتشف ${subjectLabel} واربط المعرفة بالواقع`, description: "تتبّع فهمك للأحداث والمفاهيم، واربط الأسباب بالنتائج بخطوات واضحة.", prompt: "اسأل نفسك: ما الفكرة الأهم التي أستطيع شرحها اليوم؟" };
  }
  if (key === "critical-thinking") {
    return { eyebrow: "بوابة التحليل والاستدلال", title: "حلّل الأدلة وابنِ حكمك بوعي", description: "تابع مهاراتك في التحليل والاستنتاج واتخاذ القرار، ثم ركّز على المهارة الأقل إتقانًا.", prompt: "اسأل نفسك: ما الدليل؟ وما التفسير الأقوى؟" };
  }
  if (["mathematics", "financial-literacy"].includes(key)) {
    return { eyebrow: "بوابة الحل والتطبيق", title: `تقدّم في ${subjectLabel} خطوة بخطوة`, description: "حوّل كل مهارة إلى تدريب قصير، وراجع موضع الخطأ قبل الانتقال للمسألة التالية.", prompt: "ابدأ بمسألة واحدة، واكتب خطوات الحل بوضوح." };
  }
  if (["science", "physics", "chemistry", "biology", "earth-science", "environmental-science"].includes(key)) {
    return { eyebrow: "بوابة الاستكشاف العلمي", title: `استكشف ${subjectLabel} وافهم كيف يعمل العالم`, description: "اربط المفهوم بالملاحظة والتجربة، واستخدم نتائجك لتحديد ما يحتاج إلى مراجعة.", prompt: "ما الظاهرة التي أستطيع تفسيرها بما تعلمته؟" };
  }
  if (["arabic", "linguistic-competencies"].includes(key)) {
    return { eyebrow: "بوابة اللغة والتعبير", title: "اقرأ بفهم وعبّر بثقة", description: "تابع نموك في القراءة والكتابة والمهارات اللغوية، وابدأ من الجانب الأقل درجة.", prompt: "اكتب فكرة واحدة بأسلوب واضح ومترابط." };
  }
  if (key === "english") {
    return { eyebrow: "Learning & Communication", title: "Read, practise, and communicate with confidence", description: "Track your progress in reading, writing, vocabulary, and assessment tasks.", prompt: "Use one new word in a complete sentence today." };
  }
  if (["digital-technology", "computer-science"].includes(key)) {
    return { eyebrow: "بوابة المهارات الرقمية", title: "تعلّم، طبّق، وابنِ حلًا رقميًا", description: "تابع المهارات والمشروعات والاختبارات، وحوّل المعرفة إلى تطبيق عملي.", prompt: "ما الخطوة الرقمية التي أستطيع تنفيذها بنفسي؟" };
  }
  if (["islamic-studies", "quran", "quran-tafsir", "tafsir", "hadith", "fiqh", "tawhid"].includes(key)) {
    return { eyebrow: "بوابة العلم والقيم", title: `تعلّم ${subjectLabel} وافهم أثره في حياتك`, description: "تابع تحصيلك، واربط المعرفة بالقيم والسلوك والتطبيق اليومي.", prompt: "ما القيمة التي أستطيع تطبيقها اليوم؟" };
  }
  if (["physical-education", "fitness-health", "health-education"].includes(key)) {
    return { eyebrow: "بوابة الصحة والإنجاز", title: "تقدّم بوعي وحافظ على انتظامك", description: "تابع الأداء واللياقة والانضباط، واجعل هدفك اليومي واضحًا وقابلًا للقياس.", prompt: "اختر عادة صحية واحدة وحافظ عليها اليوم." };
  }
  if (["art", "arts"].includes(key)) {
    return { eyebrow: "بوابة الإبداع والتعبير", title: "حوّل فكرتك إلى عمل يعبر عنك", description: "تابع تقدمك في المهارات والمشروعات، واستفد من الملاحظات لتطوير عملك.", prompt: "جرّب فكرة جديدة وعدّلها بعد الملاحظة." };
  }
  return { eyebrow: "بوابة التحصيل العلمي", title: `تعلّم ${subjectLabel} بثقة ووضوح`, description: "كل بياناتك التعليمية في مسار واحد: التحصيل والاختبارات والانضباط والتوجيه الذكي.", prompt: "ابدأ بالمهمة الأقرب لهدفك اليوم." };
}
'''
page = page.replace('\nfunction normalizeStudentCode(value: string) {', profile_helper + '\nfunction normalizeStudentCode(value: string) {', 1)
page = page.replace('          <Link href="/" className="portal-back">← العودة للرئيسية</Link>\n', '', 1)
page = page.replace('\n\n  if (!selected) {', '\n  const subjectProfile = subjectKnowledgeProfile(selected?.subjectKey || "", selected?.subjectLabel || "المادة");\n\n  if (!selected) {', 1)

start = page.find('  return <main className={`student-clean')
if start < 0:
    raise SystemExit('student selected portal marker not found')

new_tail = r'''  return <main className={`student-clean student-portal-v2 student-knowledge-shell student-theme-${selected.subjectKey}`} data-subject={selected.subjectKey} dir="rtl">
    <StudentKeyboardScroll />

    <header className="knowledge-header">
      <div className="knowledge-topline">
        <div className="knowledge-brand"><span>{selected.icon}</span><div><small>بوابة أستاذ لحوني التعليمية</small><strong>بوابة الطالب المعرفية</strong></div></div>
        <div className="knowledge-sync" title="تتحدث بياناتك تلقائيًا"><i /><div><b>البيانات محدثة</b><small>تحديث تلقائي وآمن</small></div></div>
      </div>

      <div className="knowledge-hero">
        <div className="knowledge-subject-mark" aria-hidden="true"><span>{selected.icon}</span></div>
        <div className="knowledge-hero-copy">
          <small>{subjectProfile.eyebrow}</small>
          <h1>{selected.data.name || "الطالب"}</h1>
          <h2>{subjectProfile.title}</h2>
          <p>{subjectProfile.description}</p>
          <div className="knowledge-meta"><span>{selected.subjectLabel}</span><span>{classLabel}</span><span>{selected.teacherName}</span></div>
        </div>
        <div className="knowledge-overall" style={{ "--score": percentage } as CSSProperties}>
          <div><strong>{ar(percentage)}٪</strong><span>مستوى التحصيل</span></div>
          <small>{ar(finalTotal)} من {ar(FINAL_MAX)}</small>
        </div>
      </div>

      <div className="knowledge-actions" aria-label="إجراءات الطالب">
        <button type="button" className="primary" data-student-action="print" data-native-print="true" onClick={() => window.print()}><span>▤</span><div><b>طباعة التقرير</b><small>تقرير شامل PDF</small></div></button>
        <button type="button" data-student-action="subjects" onClick={showStudentSubjects}><span>▦</span><div><b>تغيير المادة</b><small>عرض مواد الطالب</small></div></button>
        <button type="button" className="danger" data-student-action="logout" onClick={exitStudentPortal}><span>↪</span><div><b>تسجيل الخروج</b><small>إنهاء الجلسة</small></div></button>
      </div>
    </header>

    <nav className="student-portal-tabs knowledge-tabs" aria-label="أقسام بوابة الطالب">
      {tabs.map(tab => <button type="button" key={tab.key} className={activeTab === tab.key ? "active" : ""} aria-current={activeTab === tab.key ? "page" : undefined} onClick={() => { setActiveTab(tab.key); window.scrollTo({ top: 0, behavior: "smooth" }); }}><span>{tab.icon}</span><div><b>{tab.label}</b><small>{tab.note}</small></div></button>)}
    </nav>

    {activeTab === "home" && <div className="student-tab-panel knowledge-panel">
      <section className="knowledge-welcome-card">
        <div className="knowledge-welcome-copy"><small>رحلتك التعليمية اليوم</small><h2>{percentage >= 90 ? "تحصيلك متميز، حافظ على عمق الفهم" : percentage >= 75 ? "تقدمك جيد، والخطوة التالية واضحة" : "ابدأ من نقطة واحدة وارفع مستوى إتقانك"}</h2><p>{smartMessage}</p><blockquote>{subjectProfile.prompt}</blockquote></div>
        <div className="knowledge-today-plan"><small>مهمة اليوم</small><ol>{dailyPlan.map(item => <li key={item}>{item}</li>)}</ol><button type="button" onClick={() => setActiveTab("achievement")}>افتح خطة التحصيل ←</button></div>
      </section>

      <section className="knowledge-metrics" aria-label="ملخص الطالب">
        <button type="button" onClick={() => setActiveTab("achievement")}><span>◫</span><div><small>التحصيل</small><strong>{ar(finalTotal)} / {ar(FINAL_MAX)}</strong><em>{ar(percentage)}٪ من الدرجة</em></div></button>
        <button type="button" onClick={() => setActiveTab("attendance")}><span>◉</span><div><small>الانضباط</small><strong>{ar(attendanceSummary.disciplineRate)}٪</strong><em>{ar(attendanceSummary.present)} حضور</em></div></button>
        <button type="button" onClick={() => setActiveTab("tests")}><span>✓</span><div><small>الاختبارات</small><strong>مركز الاختبارات</strong><em>المتاح والنتائج</em></div></button>
        <button type="button" onClick={() => setActiveTab("ai")}><span>✦</span><div><small>التوجيه الذكي</small><strong>{weakestUnit?.label || "ابدأ بالمراجعة"}</strong><em>أولوية التحسين</em></div></button>
      </section>

      <section className="knowledge-insights">
        <article className="success"><span>↗</span><div><small>أقوى جانب</small><strong>{strongestUnit?.label || "بانتظار رصد الدرجات"}</strong><p>{strongestUnit ? `${ar(strongestUnit.total)} من ${ar(UNIT_MAX)} — استمر على نفس أسلوب المراجعة.` : "ستظهر هنا أقوى وحدة بعد رصد الدرجات."}</p></div></article>
        <article className="focus"><span>◎</span><div><small>أولوية التركيز</small><strong>{weakestUnit?.label || "ابدأ بالأساسيات"}</strong><p>{weakestUnit ? `${ar(weakestUnit.total)} من ${ar(UNIT_MAX)} — راجع المهارة ثم اختبر نفسك.` : "اختر مهارة واحدة وابدأ بها اليوم."}</p></div></article>
        <article className="notice"><span>!</span><div><small>آخر متابعة</small><strong>{selected.data.parentCounselorLastNotice?.title || "لا توجد تنبيهات"}</strong><p>{selected.data.parentCounselorLastNotice?.message || selected.data.teacherNote || "أمورك جيدة، استمر في التعلم المنتظم."}</p></div></article>
      </section>
    </div>}

    {activeTab === "achievement" && <div className="student-tab-panel knowledge-panel">
      <section className="knowledge-section-head"><div><small>التحصيل العلمي</small><h2>درجاتي وخطة تقدمي</h2><p>تفصيل أداء {selected.subjectLabel} مع هدف واضح للمرحلة القادمة.</p></div><div className="knowledge-total"><strong>{ar(finalTotal)}</strong><span>من {ar(FINAL_MAX)}</span></div></section>

      <section className="knowledge-achievement-grid">
        <div className="knowledge-goal-card">
          <div className="goal-ring" style={{ "--goal": Math.min(100, percentage / Math.max(goal, 1) * 100) } as CSSProperties}><strong>{ar(goal)}٪</strong><span>هدفي</span></div>
          <div className="goal-controls"><label>الدرجة المستهدفة<input type="range" min="50" max="100" step="1" value={goal} onChange={event => setGoal(Number(event.target.value))} /></label><div className="goal-numbers"><span>الحالي <b>{ar(percentage)}٪</b></span><span>المطلوب <b>{ar(targetScore)}</b></span><span>المتبقي <b>{ar(remainingForGoal)}</b></span></div><p className={goalReached ? "goal-success" : ""}>{goalReached ? "أحسنت، وصلت إلى هدفك الحالي. ارفع الهدف عندما تكون جاهزًا." : `ابدأ بمراجعة ${weakestUnit?.label || "المهارة الأضعف"} ثم اختبر نفسك.`}</p></div>
        </div>
        <div className="knowledge-score-cards"><article><small>مجموع الوحدات</small><strong>{ar(unitsTotal)}</strong></article><article><small>البحث والمشروع</small><strong>{ar(research)}</strong></article><article><small>نسبة الإنجاز</small><strong>{ar(percentage)}٪</strong></article></div>
      </section>

      <section className="student-units-table knowledge-table-card"><div className="student-section-title"><h2>تفصيل الدرجات</h2><p>اضغط على المساعد الذكي لمعرفة نقطة البداية المناسبة.</p></div><div className="student-table-scroll"><table><thead><tr><th>الوحدة</th><th>الحضور</th><th>المشاركة</th><th>الواجبات</th><th>الاختبار</th><th>المجموع</th></tr></thead><tbody>{units.map(unit => <tr key={unit.key}><td data-label="الوحدة"><b>{unit.label}</b></td><td data-label="الحضور">{ar(unit.attendance)}/{ar(GRADE_DISTRIBUTION.attendance)}</td><td data-label="المشاركة">{ar(unit.participation)}/{ar(GRADE_DISTRIBUTION.participation)}</td><td data-label="الواجبات">{ar(unit.homework)}/{ar(GRADE_DISTRIBUTION.homework)}</td><td data-label="الاختبار">{ar(unit.unitExam)}/{ar(GRADE_DISTRIBUTION.unitExam)}</td><td data-label="المجموع"><strong>{ar(unit.total)}/{ar(UNIT_MAX)}</strong></td></tr>)}</tbody></table></div></section>
    </div>}

    {activeTab === "tests" && <div className="student-tab-panel knowledge-panel"><section className="knowledge-section-head"><div><small>القياس والتقويم</small><h2>اختباراتي</h2><p>الاختبارات المتاحة والنتائج في مكان واحد دون تغيير نظام الاختبارات.</p></div><span className="knowledge-section-icon">✓</span></section><div className="knowledge-tests-shell"><StudentDiagnostics accessToken={selected.accessToken} /></div></div>}

    {activeTab === "attendance" && <div className="student-tab-panel knowledge-panel">
      <section className="knowledge-section-head"><div><small>الانتظام والمسؤولية</small><h2>حضوري وانضباطي</h2><p>تُحدّث الحالة تلقائيًا، وأي تعديل يعتمده المعلم يظهر في بوابتك.</p></div><div className="knowledge-total"><strong>{ar(attendanceSummary.disciplineRate)}٪</strong><span>نسبة الانضباط</span></div></section>
      <section className="student-attendance-summary knowledge-attendance-card"><header><div><h2>سجل الحضور</h2><p>{attendanceSummary.latestDate ? `آخر تحديث: ${attendanceSummary.latestDate}` : "بانتظار أول يوم دراسي مكتمل"}</p></div><div className="attendance-discipline-rate" style={{ "--rate": attendanceSummary.disciplineRate } as CSSProperties}><strong>{ar(attendanceSummary.disciplineRate)}٪</strong></div></header><div className="attendance-discipline-grid"><article><span>الحضور</span><strong>{ar(attendanceSummary.present)}</strong></article><article className="absent"><span>الغياب</span><strong>{ar(attendanceSummary.absent)}</strong></article><article className="late"><span>التأخير</span><strong>{ar(attendanceSummary.late)}</strong></article><article><span>الاستئذان</span><strong>{ar(attendanceSummary.excused)}</strong></article><article className="escaped"><span>الهروب</span><strong>{ar(attendanceSummary.escaped)}</strong></article></div><p className={`attendance-discipline-message ${disciplineClass}`}>{disciplineMessage}</p></section>
      <section className="knowledge-discipline-guide"><article><span>١</span><div><strong>راجع حالتك</strong><p>تظهر الحالات المعتمدة من المعلم تلقائيًا.</p></div></article><article><span>٢</span><div><strong>انتبه للتأخر</strong><p>الانتظام اليومي يرفع نسبة الانضباط.</p></div></article><article><span>٣</span><div><strong>تواصل عند الحاجة</strong><p>راجع معلم المادة إذا وجدت حالة تحتاج تصحيحًا.</p></div></article></section>
    </div>}

    {activeTab === "ai" && <div className="student-tab-panel knowledge-panel">
      <section className="knowledge-ai-panel"><header><span>✦</span><div><small>مساعد تعلم ذكي مبني على بياناتك</small><h2>مساعد {selected.subjectLabel}</h2><p>يحلل درجاتك وحضورك ويقترح لك نقطة بداية عملية، دون تغيير بياناتك الأصلية.</p></div></header>
        <div className="knowledge-ai-grid">
          <article><small>تحليل المستوى</small><strong>{percentage >= 90 ? "متقدم" : percentage >= 75 ? "جيد" : percentage >= 50 ? "متوسط" : "يحتاج دعمًا"}</strong><p>{smartMessage}</p></article>
          <article><small>ابدأ من هنا</small><strong>{weakestUnit?.label || "المهارة الأساسية"}</strong><p>{weakestUnit ? `درجتك الحالية ${ar(weakestUnit.total)} من ${ar(UNIT_MAX)}. راجع المفهوم، ثم حل ثلاثة أسئلة قصيرة.` : "راجع المفهوم الأساسي ثم اختبر فهمك بسؤال قصير."}</p></article>
          <article><small>خطة اليوم</small><strong>{dailyPlan[0]}</strong><p>{dailyPlan.slice(1).join(" ثم ")}</p></article>
          <article><small>الانضباط</small><strong>{ar(attendanceSummary.disciplineRate)}٪</strong><p>{disciplineMessage}</p></article>
          <article className="wide"><small>سؤال التفكير اليومي</small><strong>{subjectProfile.prompt}</strong><p>اكتب إجابتك في دفترك، ثم قارنها بما تعلمته في الدرس.</p></article>
        </div>
        <div className="knowledge-ai-actions"><button type="button" onClick={() => setActiveTab("achievement")}>راجع درجاتي</button><button type="button" onClick={() => setActiveTab("tests")}>افتح اختباراتي</button><button type="button" onClick={() => setActiveTab("attendance")}>راجع انضباطي</button></div>
      </section>
    </div>}

    <section className="student-print-report" aria-label="تقرير الطالب القابل للطباعة">
      <header className="student-print-head"><div><small>بوابة أستاذ لحوني التعليمية</small><h1>تقرير التحصيل العلمي للطالب</h1><p>{selected.subjectLabel} • {selected.teacherName}</p></div><div className="student-print-badge"><span>{selected.icon}</span><strong>{ar(percentage)}٪</strong><small>نسبة الإنجاز</small></div></header>
      <section className="student-print-identity"><div><span>اسم الطالب</span><strong>{selected.data.name || "الطالب"}</strong></div><div><span>الفصل</span><strong>{classLabel}</strong></div><div><span>المادة</span><strong>{selected.subjectLabel}</strong></div><div><span>تاريخ التقرير</span><strong>{new Intl.DateTimeFormat("ar-SA", { dateStyle: "long" }).format(new Date())}</strong></div></section>
      <section className="student-print-summary"><article><span>المجموع</span><strong>{ar(finalTotal)} / {ar(FINAL_MAX)}</strong></article><article><span>الحضور</span><strong>{ar(attendanceSummary.present)}</strong></article><article><span>الغياب</span><strong>{ar(attendanceSummary.absent)}</strong></article><article><span>التأخر</span><strong>{ar(attendanceSummary.late)}</strong></article><article><span>الانضباط</span><strong>{ar(attendanceSummary.disciplineRate)}٪</strong></article></section>
      <section className="student-print-section"><h2>تفصيل الدرجات</h2><table><thead><tr><th>الوحدة</th><th>الحضور</th><th>المشاركة</th><th>الواجبات</th><th>الاختبار</th><th>المجموع</th></tr></thead><tbody>{units.map(unit => <tr key={`print-${unit.key}`}><td>{unit.label}</td><td>{ar(unit.attendance)}</td><td>{ar(unit.participation)}</td><td>{ar(unit.homework)}</td><td>{ar(unit.unitExam)}</td><td><strong>{ar(unit.total)} / {ar(UNIT_MAX)}</strong></td></tr>)}</tbody></table></section>
      <section className="student-print-note"><h2>تحليل وتوصية</h2><p>{selected.data.parentCounselorLastNotice?.message || selected.data.teacherNote || `${smartMessage} الأولوية الحالية: ${weakestUnit?.label || "المراجعة المنتظمة"}.`}</p></section>
      <footer><span>تقرير تعليمي صادر من بوابة أستاذ لحوني التعليمية</span><span>المعلم: {selected.teacherName}</span></footer>
    </section>
  </main>;
}
'''
PAGE.write_text(page[:start] + new_tail, encoding='utf-8')

SCROLL.write_text(r'''"use client";

import { useEffect, useState } from "react";

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]'));
}

export default function StudentKeyboardScroll() {
  const [position, setPosition] = useState({ up: false, down: true });

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

    const update = () => {
      const top = window.scrollY || root.scrollTop || body.scrollTop || 0;
      const max = Math.max(0, root.scrollHeight - window.innerHeight);
      setPosition({ up: top > 8, down: top < max - 8 });
    };

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

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("keydown", onKeyDown);
      root.style.overflowY = previous.rootOverflowY;
      root.style.height = previous.rootHeight;
      root.style.scrollBehavior = previous.rootScrollBehavior;
      body.style.overflowY = previous.bodyOverflowY;
      body.style.height = previous.bodyHeight;
    };
  }, []);

  return <aside className="student-scroll-controller" aria-label="التنقل داخل صفحة الطالب">
    <button type="button" disabled={!position.up} onClick={() => window.scrollBy({ top: -Math.max(320, window.innerHeight * .75), behavior: "smooth" })} aria-label="الصعود في الصفحة">↑</button>
    <span>تنقّل</span>
    <button type="button" disabled={!position.down} onClick={() => window.scrollBy({ top: Math.max(320, window.innerHeight * .75), behavior: "smooth" })} aria-label="النزول في الصفحة">↓</button>
  </aside>;
}
''', encoding='utf-8')

STYLE.write_text(r'''/* بوابة الطالب المعرفية v63 — تصميم مستقل حسب المادة */
html:has(.student-knowledge-shell),body:has(.student-knowledge-shell){height:auto!important;min-height:100%!important;overflow-x:hidden!important;overflow-y:auto!important;scroll-behavior:smooth}
body:has(.student-knowledge-shell) .mobile-app-nav{display:none!important}
.student-knowledge-shell{--portal-a:#0b5560;--portal-b:#139287;--portal-c:#66d6c1;--portal-soft:#eef9f7;--portal-ink:#102d3a;--portal-pattern:rgba(255,255,255,.1);width:100%;min-height:100vh!important;padding:clamp(12px,2.6vw,38px)!important;padding-bottom:110px!important;display:grid!important;gap:16px!important;background:radial-gradient(circle at 90% 0%,color-mix(in srgb,var(--portal-b) 13%,transparent),transparent 32%),linear-gradient(180deg,#edf4f6,#f8fafb 52%,#edf3f5)!important;color:var(--portal-ink);overflow:visible!important;overscroll-behavior-y:auto}
.student-knowledge-shell>*{width:min(1320px,100%);max-width:1320px;margin-inline:auto;min-width:0}
.student-knowledge-shell[data-subject^="history"]{--portal-a:#3d2818;--portal-b:#9a6a2f;--portal-c:#e0bd73;--portal-soft:#fbf3e4;--portal-ink:#332617}
.student-knowledge-shell[data-subject^="geography"],.student-knowledge-shell[data-subject^="social-"]{--portal-a:#234b42;--portal-b:#4c9277;--portal-c:#93d0ac;--portal-soft:#edf8f1;--portal-ink:#1b352f}
.student-knowledge-shell[data-subject^="citizenship"]{--portal-a:#174b3a;--portal-b:#16835f;--portal-c:#7bd4ad;--portal-soft:#eaf8f2}
.student-knowledge-shell[data-subject^="critical-thinking"]{--portal-a:#142c59;--portal-b:#4b62d1;--portal-c:#9eb2ff;--portal-soft:#eef1ff;--portal-ink:#172649}
.student-knowledge-shell[data-subject^="arabic"],.student-knowledge-shell[data-subject^="linguistic-"]{--portal-a:#5b2534;--portal-b:#a94f68;--portal-c:#eca1b4;--portal-soft:#fff0f4;--portal-ink:#46202b}
.student-knowledge-shell[data-subject^="english"]{--portal-a:#173964;--portal-b:#2776c4;--portal-c:#8fc8ff;--portal-soft:#edf6ff;--portal-ink:#17314f}
.student-knowledge-shell[data-subject^="mathematics"],.student-knowledge-shell[data-subject^="financial-"]{--portal-a:#282663;--portal-b:#6b56cf;--portal-c:#b5a7ff;--portal-soft:#f2efff;--portal-ink:#29234f}
.student-knowledge-shell[data-subject^="science"],.student-knowledge-shell[data-subject^="physics"],.student-knowledge-shell[data-subject^="chemistry"],.student-knowledge-shell[data-subject^="biology"],.student-knowledge-shell[data-subject^="earth-"],.student-knowledge-shell[data-subject^="environmental-"]{--portal-a:#075465;--portal-b:#078e9c;--portal-c:#7cdae0;--portal-soft:#eaf9fa;--portal-ink:#123b43}
.student-knowledge-shell[data-subject^="digital-"],.student-knowledge-shell[data-subject^="computer-"]{--portal-a:#151d42;--portal-b:#3458bb;--portal-c:#7ca2ff;--portal-soft:#edf2ff;--portal-ink:#182445}
.student-knowledge-shell[data-subject^="islamic-"],.student-knowledge-shell[data-subject^="quran"],.student-knowledge-shell[data-subject^="tafsir"],.student-knowledge-shell[data-subject^="hadith"],.student-knowledge-shell[data-subject^="fiqh"],.student-knowledge-shell[data-subject^="tawhid"]{--portal-a:#214b35;--portal-b:#3b8c59;--portal-c:#a0d8ae;--portal-soft:#eef8f1;--portal-ink:#203a2b}
.student-knowledge-shell[data-subject^="art"],.student-knowledge-shell[data-subject^="arts"]{--portal-a:#592b6d;--portal-b:#a64bb7;--portal-c:#ec9be9;--portal-soft:#fcf0fc;--portal-ink:#45234d}
.student-knowledge-shell[data-subject^="physical-"],.student-knowledge-shell[data-subject^="fitness-"],.student-knowledge-shell[data-subject^="health-"]{--portal-a:#8a321f;--portal-b:#e06a35;--portal-c:#ffc18e;--portal-soft:#fff2e9;--portal-ink:#532719}
.student-knowledge-shell[data-subject^="life-"],.student-knowledge-shell[data-subject^="family-"],.student-knowledge-shell[data-subject^="career-"]{--portal-a:#6a3e1e;--portal-b:#c07a37;--portal-c:#f0c27d;--portal-soft:#fff6e8;--portal-ink:#4d341f}

.knowledge-header{position:relative;isolation:isolate;overflow:hidden;padding:22px;border-radius:30px;background:linear-gradient(135deg,var(--portal-a),var(--portal-b));color:#fff;box-shadow:0 28px 70px color-mix(in srgb,var(--portal-a) 28%,transparent)}
.knowledge-header::before,.knowledge-header::after{content:"";position:absolute;z-index:-1;border-radius:50%;border:1px solid rgba(255,255,255,.14)}
.knowledge-header::before{width:330px;height:330px;left:-150px;top:-190px}.knowledge-header::after{width:230px;height:230px;right:35%;bottom:-190px}
.knowledge-topline{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-bottom:16px;border-bottom:1px solid rgba(255,255,255,.16)}
.knowledge-brand,.knowledge-sync{display:flex;align-items:center;gap:11px}.knowledge-brand>span{display:grid;place-items:center;width:46px;height:46px;border-radius:14px;background:rgba(255,255,255,.16);font-size:23px}.knowledge-brand div,.knowledge-sync div{display:grid}.knowledge-brand small,.knowledge-sync small{color:#d8f3ef}.knowledge-brand strong{font-size:16px}.knowledge-sync{padding:8px 12px;border-radius:14px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.16)}.knowledge-sync i{width:10px;height:10px;border-radius:50%;background:#83f5b8;box-shadow:0 0 0 6px rgba(131,245,184,.12)}.knowledge-sync b{font-size:12px}.knowledge-sync small{font-size:9px}
.knowledge-hero{display:grid;grid-template-columns:112px minmax(0,1fr) 190px;align-items:center;gap:22px;padding:28px 0 20px}.knowledge-subject-mark{display:grid;place-items:center;width:108px;height:108px;border-radius:30px;background:linear-gradient(145deg,rgba(255,255,255,.23),rgba(255,255,255,.08));border:1px solid rgba(255,255,255,.24);box-shadow:inset 0 1px 0 rgba(255,255,255,.25)}.knowledge-subject-mark span{font-size:50px}.knowledge-hero-copy>small{color:var(--portal-c);font-weight:900}.knowledge-hero-copy h1{margin:6px 0 1px;font-size:clamp(28px,4vw,47px);line-height:1.1}.knowledge-hero-copy h2{margin:5px 0;font-size:clamp(17px,2vw,24px);color:#fff}.knowledge-hero-copy p{max-width:760px;margin:5px 0;color:#e4f2f2;line-height:1.7}.knowledge-meta{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}.knowledge-meta span{padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.17);font-size:11px;font-weight:800}
.knowledge-overall{--score:0;display:grid;place-items:center;align-content:center;width:170px;height:170px;border-radius:50%;background:radial-gradient(circle,#123c46 55%,transparent 57%),conic-gradient(#fff calc(var(--score)*1%),rgba(255,255,255,.17) 0);box-shadow:0 18px 36px rgba(0,0,0,.18)}.knowledge-overall div{display:grid;text-align:center}.knowledge-overall strong{font-size:31px}.knowledge-overall span{font-size:10px;color:#d6edeb}.knowledge-overall>small{margin-top:4px;color:var(--portal-c);font-weight:900}
.knowledge-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;padding-top:16px;border-top:1px solid rgba(255,255,255,.16)}.knowledge-actions button{display:grid;grid-template-columns:44px minmax(0,1fr);align-items:center;gap:10px;min-height:64px;padding:10px 13px;border:1px solid rgba(255,255,255,.22);border-radius:16px;background:rgba(255,255,255,.1);color:#fff;font:inherit;text-align:right;cursor:pointer}.knowledge-actions button>span{display:grid;place-items:center;width:44px;height:44px;border-radius:13px;background:rgba(255,255,255,.14);font-size:20px}.knowledge-actions button div{display:grid;gap:2px}.knowledge-actions button b{font-size:13px}.knowledge-actions button small{font-size:9px;color:#d9edeb}.knowledge-actions button.primary{background:#fff;color:var(--portal-a);border-color:#fff}.knowledge-actions button.primary>span{background:var(--portal-soft);color:var(--portal-b)}.knowledge-actions button.primary small{color:#58727a}.knowledge-actions button.danger{background:rgba(92,13,13,.18)}

.knowledge-tabs{position:sticky!important;top:10px!important;z-index:70!important;display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:8px!important;padding:9px!important;border:1px solid #d7e4e8!important;border-radius:21px!important;background:rgba(255,255,255,.95)!important;box-shadow:0 16px 38px rgba(19,55,70,.11)!important;backdrop-filter:blur(15px)}.knowledge-tabs button{display:grid!important;grid-template-columns:39px minmax(0,1fr)!important;align-items:center!important;gap:9px!important;min-height:62px!important;padding:9px!important;border:1px solid #e3ecef!important;border-radius:15px!important;background:#f7f9fa!important;color:#244354!important;text-align:right!important}.knowledge-tabs button>span{display:grid!important;place-items:center!important;width:39px!important;height:39px!important;border-radius:12px!important;background:var(--portal-soft)!important;color:var(--portal-b)!important;font-size:18px!important;font-weight:900}.knowledge-tabs button div{display:grid!important;min-width:0}.knowledge-tabs button b{font-size:12px}.knowledge-tabs button small{font-size:9px;color:#718590}.knowledge-tabs button.active{background:linear-gradient(135deg,var(--portal-a),var(--portal-b))!important;color:#fff!important;border-color:transparent!important;box-shadow:0 10px 24px color-mix(in srgb,var(--portal-b) 22%,transparent)!important}.knowledge-tabs button.active>span{background:rgba(255,255,255,.17)!important;color:#fff!important}.knowledge-tabs button.active small{color:#d8efed}
.knowledge-panel{display:grid;gap:14px;animation:knowledgeIn .22s ease both}@keyframes knowledgeIn{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
.knowledge-welcome-card{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(310px,.8fr);gap:16px;padding:22px;border:1px solid #d8e5e9;border-radius:24px;background:linear-gradient(135deg,#fff,var(--portal-soft));box-shadow:0 15px 36px rgba(19,55,70,.07)}.knowledge-welcome-copy>small,.knowledge-today-plan>small,.knowledge-section-head small{color:var(--portal-b);font-weight:900}.knowledge-welcome-copy h2{margin:6px 0;font-size:clamp(21px,2.4vw,31px)}.knowledge-welcome-copy p{margin:0;color:#607784;line-height:1.7}.knowledge-welcome-copy blockquote{margin:15px 0 0;padding:13px 15px;border-right:4px solid var(--portal-b);border-radius:12px;background:#fff;color:var(--portal-a);font-weight:900}.knowledge-today-plan{padding:17px;border-radius:18px;background:#fff;border:1px solid #dce7ea}.knowledge-today-plan ol{margin:9px 0;padding-right:22px;line-height:1.9;color:#425f6d}.knowledge-today-plan button,.knowledge-ai-actions button{width:100%;padding:11px;border:0;border-radius:12px;background:linear-gradient(135deg,var(--portal-a),var(--portal-b));color:#fff;font:inherit;font-weight:900;cursor:pointer}
.knowledge-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.knowledge-metrics button{display:grid;grid-template-columns:47px minmax(0,1fr);align-items:center;gap:11px;min-height:100px;padding:14px;border:1px solid #dbe7ea;border-radius:18px;background:#fff;color:var(--portal-ink);font:inherit;text-align:right;cursor:pointer;box-shadow:0 10px 24px rgba(19,55,70,.05)}.knowledge-metrics button>span{display:grid;place-items:center;width:47px;height:47px;border-radius:14px;background:var(--portal-soft);color:var(--portal-b);font-size:22px;font-weight:900}.knowledge-metrics button div{display:grid;gap:2px;min-width:0}.knowledge-metrics small{color:#738894;font-size:10px}.knowledge-metrics strong{overflow:hidden;text-overflow:ellipsis;font-size:17px}.knowledge-metrics em{color:var(--portal-b);font-size:10px;font-style:normal;font-weight:900}
.knowledge-insights{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px}.knowledge-insights article{display:grid;grid-template-columns:45px minmax(0,1fr);gap:11px;padding:17px;border:1px solid #dce7ea;border-radius:18px;background:#fff}.knowledge-insights article>span{display:grid;place-items:center;width:45px;height:45px;border-radius:14px;font-size:20px;font-weight:900}.knowledge-insights article div{display:grid;gap:4px}.knowledge-insights small{color:#738894}.knowledge-insights strong{font-size:17px}.knowledge-insights p{margin:0;color:#607784;line-height:1.6;font-size:12px}.knowledge-insights .success>span{background:#e7f7ef;color:#13704d}.knowledge-insights .focus>span{background:#fff1db;color:#9a5b00}.knowledge-insights .notice>span{background:#eef1ff;color:#485eb7}
.knowledge-section-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:20px;border:1px solid #d8e5e9;border-radius:21px;background:#fff;box-shadow:0 12px 30px rgba(19,55,70,.06)}.knowledge-section-head h2{margin:4px 0;font-size:26px}.knowledge-section-head p{margin:0;color:#637b88}.knowledge-total{display:grid;min-width:115px;padding:12px;text-align:center;border-radius:16px;background:var(--portal-soft);color:var(--portal-a)}.knowledge-total strong{font-size:26px}.knowledge-total span{font-size:10px}.knowledge-section-icon{display:grid;place-items:center;width:65px;height:65px;border-radius:19px;background:var(--portal-soft);color:var(--portal-b);font-size:28px;font-weight:900}
.knowledge-achievement-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(260px,.65fr);gap:12px}.knowledge-goal-card{display:grid;grid-template-columns:170px minmax(0,1fr);align-items:center;gap:22px;padding:20px;border:1px solid #d8e5e9;border-radius:22px;background:#fff}.knowledge-goal-card .goal-ring{width:150px;height:150px}.knowledge-score-cards{display:grid;gap:9px}.knowledge-score-cards article{display:grid;gap:4px;padding:17px;border:1px solid #dbe7ea;border-radius:17px;background:linear-gradient(135deg,#fff,var(--portal-soft))}.knowledge-score-cards small{color:#6b818e}.knowledge-score-cards strong{font-size:24px;color:var(--portal-a)}.knowledge-table-card,.knowledge-tests-shell,.knowledge-attendance-card{border:1px solid #d8e5e9!important;border-radius:22px!important;background:#fff!important;box-shadow:0 12px 30px rgba(19,55,70,.06)!important}.knowledge-tests-shell{padding:6px;overflow:hidden}.knowledge-attendance-card{margin:0!important}.knowledge-discipline-guide{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.knowledge-discipline-guide article{display:grid;grid-template-columns:40px minmax(0,1fr);gap:10px;padding:15px;border:1px solid #dce7ea;border-radius:17px;background:#fff}.knowledge-discipline-guide article>span{display:grid;place-items:center;width:40px;height:40px;border-radius:12px;background:var(--portal-soft);color:var(--portal-b);font-weight:900}.knowledge-discipline-guide strong{display:block}.knowledge-discipline-guide p{margin:3px 0 0;color:#647b88;font-size:11px;line-height:1.6}
.knowledge-ai-panel{overflow:hidden;border:1px solid #d4e2e6;border-radius:26px;background:#fff;box-shadow:0 18px 42px rgba(19,55,70,.1)}.knowledge-ai-panel>header{display:flex;align-items:center;gap:16px;padding:26px;background:linear-gradient(135deg,var(--portal-a),var(--portal-b));color:#fff}.knowledge-ai-panel>header>span{display:grid;place-items:center;width:74px;height:74px;border-radius:22px;background:rgba(255,255,255,.15);font-size:32px}.knowledge-ai-panel h2{margin:5px 0;font-size:29px}.knowledge-ai-panel header p{margin:0;color:#dcefed}.knowledge-ai-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px;padding:16px}.knowledge-ai-grid article{padding:18px;border:1px solid #dce7ea;border-radius:18px;background:linear-gradient(180deg,#fff,var(--portal-soft))}.knowledge-ai-grid article.wide{grid-column:1/-1}.knowledge-ai-grid small{color:var(--portal-b);font-weight:900}.knowledge-ai-grid strong{display:block;margin:6px 0;font-size:19px}.knowledge-ai-grid p{margin:0;color:#5d7582;line-height:1.7}.knowledge-ai-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;padding:0 16px 16px}.knowledge-ai-actions button{padding:12px}
.student-scroll-controller{position:fixed;left:18px;top:50%;z-index:180;transform:translateY(-50%);display:grid;place-items:center;gap:5px;padding:7px;border:1px solid #d5e3e7;border-radius:18px;background:rgba(255,255,255,.95);box-shadow:0 15px 35px rgba(17,52,65,.18);backdrop-filter:blur(10px)}.student-scroll-controller button{display:grid;place-items:center;width:39px;height:39px;border:0;border-radius:12px;background:linear-gradient(135deg,var(--portal-a),var(--portal-b));color:#fff;font-size:20px;cursor:pointer}.student-scroll-controller button:disabled{opacity:.3;cursor:not-allowed}.student-scroll-controller span{writing-mode:vertical-rl;font-size:8px;font-weight:900;color:#6f838d;letter-spacing:1px}
.student-print-report{display:none}
.student-login-page .portal-back{display:none!important}.student-login-page.portal-login{background:radial-gradient(circle at 85% 10%,#d5f1ec,transparent 35%),linear-gradient(135deg,#eef5f6,#f9fbfc)!important}.student-login-shell{box-shadow:0 30px 80px rgba(17,57,70,.18)!important}.student-login-visual{background:linear-gradient(145deg,#073e4b,#139287)!important}.student-choice-grid button{transition:transform .18s ease,box-shadow .18s ease}.student-choice-grid button:hover{transform:translateY(-3px);box-shadow:0 14px 30px rgba(17,57,70,.12)}

@media(max-width:980px){.knowledge-hero{grid-template-columns:90px minmax(0,1fr)}.knowledge-subject-mark{width:88px;height:88px;border-radius:24px}.knowledge-subject-mark span{font-size:41px}.knowledge-overall{grid-column:1/-1;width:100%;height:auto;min-height:94px;border-radius:20px;background:linear-gradient(135deg,rgba(255,255,255,.17),rgba(255,255,255,.08));display:flex;justify-content:space-between;padding:15px 20px}.knowledge-overall div{display:flex;align-items:baseline;gap:8px}.knowledge-overall strong{font-size:28px}.knowledge-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.knowledge-achievement-grid{grid-template-columns:1fr}.student-scroll-controller{display:none}}
@media(max-width:760px){
  .student-knowledge-shell{padding:7px 7px calc(91px + env(safe-area-inset-bottom))!important;gap:10px!important}.knowledge-header{padding:14px;border-radius:21px}.knowledge-topline{align-items:flex-start}.knowledge-brand>span{width:39px;height:39px;border-radius:12px}.knowledge-brand strong{font-size:13px}.knowledge-brand small{font-size:9px}.knowledge-sync{padding:7px}.knowledge-sync b{font-size:9px}.knowledge-sync small{display:none}.knowledge-sync i{width:8px;height:8px}
  .knowledge-hero{grid-template-columns:58px minmax(0,1fr);gap:11px;padding:18px 0 13px}.knowledge-subject-mark{width:58px;height:58px;border-radius:17px}.knowledge-subject-mark span{font-size:29px}.knowledge-hero-copy>small{font-size:9px}.knowledge-hero-copy h1{font-size:24px}.knowledge-hero-copy h2{font-size:14px}.knowledge-hero-copy p{font-size:11px;line-height:1.55}.knowledge-meta{gap:4px}.knowledge-meta span{padding:4px 7px;font-size:8px}.knowledge-overall{min-height:72px;padding:11px 14px}.knowledge-overall strong{font-size:23px}.knowledge-overall span,.knowledge-overall>small{font-size:9px}
  .knowledge-actions{grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;padding-top:11px}.knowledge-actions button{grid-template-columns:1fr;place-items:center;gap:3px;min-height:63px;padding:6px 3px;text-align:center}.knowledge-actions button>span{width:29px;height:29px;border-radius:9px;font-size:15px}.knowledge-actions button b{font-size:9px}.knowledge-actions button small{display:none}
  .knowledge-tabs{position:fixed!important;right:6px!important;left:6px!important;bottom:max(6px,env(safe-area-inset-bottom))!important;top:auto!important;z-index:220!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:3px!important;width:auto!important;padding:5px!important;border-radius:18px!important}.knowledge-tabs button{grid-template-columns:1fr!important;place-items:center!important;gap:2px!important;min-width:0!important;min-height:58px!important;padding:5px 1px!important;text-align:center!important}.knowledge-tabs button>span{width:28px!important;height:28px!important;border-radius:9px!important;font-size:14px!important}.knowledge-tabs button div{display:block!important;width:100%;min-width:0}.knowledge-tabs button b{display:block;font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.knowledge-tabs button small{display:none}
  .knowledge-welcome-card{grid-template-columns:1fr;padding:14px;border-radius:18px}.knowledge-welcome-copy h2{font-size:20px}.knowledge-welcome-copy p,.knowledge-welcome-copy blockquote{font-size:11px}.knowledge-today-plan{padding:13px}.knowledge-today-plan ol{font-size:12px}.knowledge-metrics{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.knowledge-metrics button{grid-template-columns:38px minmax(0,1fr);gap:8px;min-height:83px;padding:10px;border-radius:14px}.knowledge-metrics button>span{width:38px;height:38px;border-radius:11px;font-size:17px}.knowledge-metrics strong{font-size:13px}.knowledge-metrics small,.knowledge-metrics em{font-size:8px}
  .knowledge-insights{grid-template-columns:1fr;gap:7px}.knowledge-insights article{padding:13px;border-radius:15px}.knowledge-section-head{padding:14px;border-radius:17px}.knowledge-section-head h2{font-size:20px}.knowledge-section-head p{font-size:10px}.knowledge-total{min-width:80px;padding:9px}.knowledge-total strong{font-size:19px}.knowledge-section-icon{width:49px;height:49px;border-radius:14px;font-size:21px}
  .knowledge-goal-card{grid-template-columns:1fr;padding:14px}.knowledge-goal-card .goal-ring{width:125px;height:125px}.knowledge-score-cards{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.knowledge-score-cards article{padding:10px}.knowledge-score-cards small{font-size:8px}.knowledge-score-cards strong{font-size:17px}.knowledge-table-card{padding:12px!important}.student-knowledge-shell .student-table-scroll{overflow:visible!important}.student-knowledge-shell .student-table-scroll table{display:block!important;width:100%!important;min-width:0!important}.student-knowledge-shell .student-table-scroll thead{display:none!important}.student-knowledge-shell .student-table-scroll tbody{display:grid!important;gap:9px}.student-knowledge-shell .student-table-scroll tr{display:grid!important;padding:12px!important;border:1px solid #dbe7ea!important;border-radius:14px!important;background:#fff!important}.student-knowledge-shell .student-table-scroll td{display:flex!important;justify-content:space-between!important;gap:10px!important;padding:7px 0!important;border-bottom:1px solid #edf2f4!important;text-align:left!important}.student-knowledge-shell .student-table-scroll td::before{content:attr(data-label);color:#6a818d;font-size:10px;font-weight:900}.student-knowledge-shell .student-table-scroll td:last-child{border-bottom:0!important}
  .attendance-discipline-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}.attendance-discipline-grid article:first-child{grid-column:auto!important}.knowledge-discipline-guide{grid-template-columns:1fr}.knowledge-ai-panel>header{align-items:flex-start;padding:17px}.knowledge-ai-panel>header>span{width:52px;height:52px;border-radius:16px;font-size:24px}.knowledge-ai-panel h2{font-size:21px}.knowledge-ai-panel header p{font-size:10px}.knowledge-ai-grid{grid-template-columns:1fr;padding:10px}.knowledge-ai-grid article.wide{grid-column:auto}.knowledge-ai-grid article{padding:13px}.knowledge-ai-actions{grid-template-columns:1fr;padding:0 10px 10px}
}
@media(max-width:390px){.student-knowledge-shell{padding-inline:5px!important}.knowledge-topline{display:grid;grid-template-columns:1fr}.knowledge-sync{width:max-content}.knowledge-actions{grid-template-columns:1fr}.knowledge-actions button{grid-template-columns:34px minmax(0,1fr);place-items:initial;align-items:center;text-align:right;min-height:48px}.knowledge-actions button>span{width:34px;height:34px}.knowledge-actions button small{display:block;font-size:8px}.knowledge-metrics{grid-template-columns:1fr}.knowledge-score-cards{grid-template-columns:1fr}.knowledge-tabs button b{font-size:8px}}

@media print{
 @page{size:A4 portrait;margin:9mm}html,body{background:#fff!important;overflow:visible!important}.student-knowledge-shell{display:block!important;min-height:auto!important;padding:0!important;background:#fff!important}.student-knowledge-shell>*:not(.student-print-report){display:none!important}.student-print-report{display:block!important;width:100%!important;color:#102d3a!important;font-family:'Tajawal','Segoe UI',Tahoma,Arial,sans-serif!important}.student-print-head{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:16px!important;padding:18px 20px!important;border-radius:16px!important;background:linear-gradient(135deg,var(--portal-a),var(--portal-b))!important;color:#fff!important;print-color-adjust:exact!important;-webkit-print-color-adjust:exact!important}.student-print-head small,.student-print-head p{color:#e1f2f0!important}.student-print-head h1{margin:4px 0!important;font-size:24px!important;color:#fff!important}.student-print-head p{margin:0!important}.student-print-badge{display:grid!important;place-items:center!important;min-width:110px!important;padding:10px!important;border:1px solid rgba(255,255,255,.3)!important;border-radius:14px!important;background:rgba(255,255,255,.12)!important}.student-print-badge strong{font-size:24px!important;color:#fff!important}.student-print-identity{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important;margin-top:10px!important}.student-print-identity div{display:grid!important;gap:3px!important;padding:10px 12px!important;border:1px solid #d8e5e8!important;border-radius:10px!important;background:#f7fafb!important}.student-print-identity span{font-size:9px!important;color:#68808c!important}.student-print-identity strong{font-size:12px!important;color:#173b48!important}.student-print-summary{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:7px!important;margin-top:9px!important}.student-print-summary article{display:grid!important;gap:4px!important;padding:9px!important;text-align:center!important;border:1px solid #d9e5e8!important;border-radius:10px!important}.student-print-summary span{font-size:9px!important;color:#68808c!important}.student-print-summary strong{font-size:15px!important;color:var(--portal-a)!important}.student-print-section,.student-print-note{margin-top:10px!important;padding:12px!important;border:1px solid #d5e2e6!important;border-radius:12px!important;background:#fff!important;break-inside:avoid!important}.student-print-section h2,.student-print-note h2{margin:0 0 8px!important;font-size:15px!important;color:var(--portal-a)!important}.student-print-section table{width:100%!important;border-collapse:collapse!important}.student-print-section th,.student-print-section td{padding:7px!important;border:1px solid #dce6e9!important;font-size:9px!important;text-align:center!important}.student-print-section th{background:var(--portal-soft)!important;color:#17474d!important;print-color-adjust:exact!important;-webkit-print-color-adjust:exact!important}.student-print-note p{margin:0!important;font-size:11px!important;line-height:1.7!important;color:#344f59!important}.student-print-report footer{display:flex!important;justify-content:space-between!important;gap:12px!important;margin-top:10px!important;padding-top:8px!important;border-top:1px solid #cbdadd!important;font-size:8px!important;color:#647b84!important}.student-scroll-controller{display:none!important}
}
''', encoding='utf-8')

layout = LAYOUT.read_text(encoding='utf-8')
layout = re.sub(r'import "\./student-lite-v61\.css";\n?', '', layout)
layout = re.sub(r'import "\./student-premium-v62\.css";\n?', '', layout)
if 'student-knowledge-v63.css' not in layout:
    layout = layout.replace('import "./student-mobile-complete.css";\n', 'import "./student-mobile-complete.css";\nimport "./student-knowledge-v63.css";\n', 1)
LAYOUT.write_text(layout, encoding='utf-8')

sw = SW.read_text(encoding='utf-8')
sw = re.sub(r'const CACHE_NAME = "[^"]+";', 'const CACHE_NAME = "ostadh-lahooni-v63-student-knowledge";', sw, count=1)
SW.write_text(sw, encoding='utf-8')

pwa = PWA.read_text(encoding='utf-8')
pwa = re.sub(r'const CURRENT_CACHE = "[^"]+";', 'const CURRENT_CACHE = "ostadh-lahooni-v63-student-knowledge";', pwa, count=1)
pwa = re.sub(r'const RELOAD_KEY = "[^"]+";', 'const RELOAD_KEY = "ostadh-lahooni-v63-student-knowledge";', pwa, count=1)
pwa = re.sub(r'/sw\.js\?v=[^"\']+', '/sw.js?v=63-student-knowledge', pwa, count=1)
PWA.write_text(pwa, encoding='utf-8')

print('rebuilt student knowledge portal v63')
