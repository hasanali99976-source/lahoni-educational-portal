"use client";
import { useEffect, useMemo, useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useTeacherClient } from "../../../lib/teacher-client";
import { tenantCollection } from "../../../lib/teacher-tenant";
import { calculateGradePlanResult, type GradePlan, type GradeStudentLike } from "../../../lib/grade-plan";
import { useGradePlan } from "../../../lib/use-grade-plan";
import "./teacher-ai.css";

type Student = GradeStudentLike & { id: string; name?: string; class?: string; className?: string };
type Analyzed = Student & { percentage: number; completion: number; hasGrades: boolean; weakest: string; action: string };

function actionFor(key: string, label: string) {
  const actions: Record<string, string> = {
    attendance: "متابعة الحضور والانضباط يوميًا مع تعزيز الالتزام بمهمة قصيرة في بداية الحصة.",
    participation: "إشراك الطالب في سؤال تمهيدي ونشاط ثنائي مع تغذية راجعة مباشرة.",
    homework: "تدريبات قصيرة متدرجة مع تصحيح فوري وإعادة المحاولة.",
    unitExam: "شرح مصغر للمفاهيم غير المتقنة ثم تقويم قصير متدرج.",
    research: "تقسيم البحث إلى خطوات صغيرة مع نموذج واضح ومعيار نجاح محدد.",
    project: "تفكيك المشروع إلى مراحل قصيرة ومراجعة المنتج في كل مرحلة.",
    performance: "نمذجة المهمة الأدائية ثم تدريب موجه وتغذية راجعة مباشرة.",
    custom: `تدريب موجه على ${label} ثم قياس قصير بعد التنفيذ.`,
  };
  return actions[key] || `تدريب موجه على ${label} ثم تقويم بعدي قصير.`;
}

function analyze(student: Student, plan: GradePlan, sectionIds: string[]): Analyzed {
  const result = calculateGradePlanResult(plan, student);
  const sections = result.sections.filter(section => sectionIds.includes(section.id));
  const recordedItems = sections.flatMap(section => section.items.filter(item => item.recorded));
  const recordedCategories = new Set(recordedItems.map(item => item.item.category));
  const earned = sections.reduce((sum, section) => sum + section.earned, 0);
  const recordedMaximum = recordedItems.reduce((sum, item) => sum + item.maximum, 0);
  const plannedMaximum = sections.reduce((sum, section) => sum + section.maximum, 0);
  const categoryTotals = new Map<string, { label: string; earned: number; maximum: number }>();
  recordedItems.forEach(item => { const key = item.item.category; const previous = categoryTotals.get(key) || { label: item.item.label, earned: 0, maximum: 0 }; previous.earned += item.counted; previous.maximum += item.maximum; categoryTotals.set(key, previous); });
  const weakest = [...categoryTotals.entries()].map(([key, item]) => ({ key, label: item.label, percentage: item.maximum ? item.earned / item.maximum * 100 : 0 })).filter(item => recordedCategories.has(item.key as never)).sort((a, b) => a.percentage - b.percentage)[0];
  const weakestLabel = weakest?.label || "المهارات الأساسية";
  return {
    ...student,
    percentage: recordedMaximum > 0 && plannedMaximum > 0 ? Math.max(0, Math.min(100, Math.round(earned / plannedMaximum * 1000) / 10)) : 0,
    hasGrades: recordedMaximum > 0,
    completion: plannedMaximum > 0 ? Math.round(recordedMaximum / plannedMaximum * 100) : 0,
    weakest: weakestLabel,
    action: actionFor(weakest?.key || "custom", weakestLabel),
  };
}

export default function TeacherAiPage() {
  const session = useTeacherClient();
  const { activePlan, loading: planLoading } = useGradePlan(true);
  const teacherId = session.teacherId || "";
  const teacherName = session.teacherName || "المعلم";
  const subjectKey = session.subjectKey || "history";
  const subject = session.subject || "المادة";
  const [students, setStudents] = useState<Student[]>([]);
  const [scope, setScope] = useState<"threshold" | "class" | "manual">("threshold");
  const [selectedClass, setSelectedClass] = useState("");
  const [threshold, setThreshold] = useState(60);
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [duration, setDuration] = useState("٤ أسابيع");
  useEffect(() => { setSelectedUnits(current => { const valid = current.filter(id => activePlan?.sections.some(section => section.id === id)); return valid.length ? valid : activePlan?.sections[0] ? [activePlan.sections[0].id] : []; }); }, [activePlan]);

  const [message, setMessage] = useState("");
  const plansPath = useMemo(() => teacherId ? tenantCollection(teacherId, subjectKey as never, "treatmentPlans") : "", [teacherId, subjectKey]);

  useEffect(() => {
    if (!session?.subjectKey) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ subjectId: String(session.subjectKey).split("--")[0] });
    if (session.activeGrade) params.set("grade", String(session.activeGrade));
    Promise.all([
      fetch(`/api/teacher/students?${params.toString()}`, { cache: "no-store", signal: controller.signal, credentials: "same-origin" }).then(async response => { const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message || "تعذر تحميل الطلاب"); return data; }),
      fetch(`/api/teacher/grade-data?subjectId=${encodeURIComponent(String(session.subjectKey).split("--")[0])}`, { cache: "no-store", signal: controller.signal, credentials: "same-origin" }).then(async response => { const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message || "تعذر تحميل الدرجات المحفوظة"); return data; }),
    ]).then(([data, academicData]) => {
      const byCode = academicData.byCode && typeof academicData.byCode === "object" ? academicData.byCode as Record<string, Record<string, unknown>> : {};
      const key = (value: unknown) => String(value || "").trim().toUpperCase();
      const stored = new Map<string, Record<string, unknown>>();
      Object.entries(byCode).forEach(([code, row]) => {
        [code, row.documentId, row.id, row.code, row.accessCode, row.studentCode].map(key).filter(Boolean).forEach(alias => stored.set(alias, row));
      });
      const roster = (Array.isArray(data.students) ? data.students : []).map((item: Record<string, unknown>) => {
        const aliases = [item.id, item.code, item.accessCode, item.studentCode].map(key).filter(Boolean);
        const academic = aliases.map(alias => stored.get(alias)).find(Boolean);
        const className = String(item.className || item.class || "").trim();
        return {
          ...item, id: String(item.id || item.code || "").trim(), name: String(item.name || "").trim(),
          class: className, className,
          ...(academic ? {
            gradeValues: academic.gradeValues,
            gradePlanValues: academic.gradePlanValues,
            activeGradePlanId: academic.activeGradePlanId,
            activeGradePlanVersion: academic.activeGradePlanVersion,
          } : {}),
        } as Student;
      }).filter((item: Student) => item.id && item.name);
      setStudents(roster.sort((a: Student, b: Student) => (a.name || "").localeCompare(b.name || "", "ar")));
      setMessage("");
    }).catch(error => { if ((error as Error)?.name !== "AbortError") { setStudents([]); setMessage(error instanceof Error ? error.message : "تعذر تحميل درجات الطلاب"); } });
    return () => controller.abort();
  }, [session?.subjectKey, session?.activeGrade]);

  const analyzed = useMemo(() => activePlan && selectedUnits.length ? students.map(student => analyze(student, activePlan, selectedUnits)) : [], [students, activePlan, selectedUnits]);
  const unitLabel = activePlan?.sections.filter(section => selectedUnits.includes(section.id)).map(section => section.label).join("، ") || "لم تُحدد وحدات";
  const classes = useMemo(() => Array.from(new Set(students.map(student => String(student.className || student.class || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ar")), [students]);
  const candidates = useMemo(() => scope === "threshold" ? analyzed.filter(student => student.hasGrades && student.percentage <= threshold) : scope === "class" ? analyzed.filter(student => !selectedClass || String(student.className || student.class || "") === selectedClass) : analyzed.filter(student => selectedIds.includes(student.id)), [analyzed, scope, threshold, selectedClass, selectedIds]);
  const planStudents = [...new Map(candidates.filter(student => student.hasGrades && student.percentage <= threshold).map(student => [student.id, student])).values()];
  const remedialStudents = planStudents.filter(student => student.percentage <= threshold);
  const enrichmentStudents = remedialStudents;
  const gradedCandidates = planStudents.filter(student => student.hasGrades);
  const average = gradedCandidates.length ? Math.round(gradedCandidates.reduce((sum, student) => sum + student.percentage, 0) / gradedCandidates.length) : 0;
  const averageCompletion = gradedCandidates.length ? Math.round(gradedCandidates.reduce((sum, student) => sum + student.completion, 0) / gradedCandidates.length) : 0;
  const distribution = useMemo(() => [{label:"أقل من 50%",count:planStudents.filter(s=>s.percentage<50).length},{label:"50–59%",count:planStudents.filter(s=>s.percentage>=50&&s.percentage<60).length},{label:"60–74%",count:planStudents.filter(s=>s.percentage>=60&&s.percentage<75).length},{label:"75–89%",count:planStudents.filter(s=>s.percentage>=75&&s.percentage<90).length},{label:"90–100%",count:planStudents.filter(s=>s.percentage>=90).length}].filter(row=>row.count>0), [candidates,threshold]);
  const classStats = useMemo(()=>classes.map(name=>({name,rows:planStudents.filter(s=>String(s.className||s.class||"")===name)})).filter(group=>group.rows.length),[classes,candidates,threshold]);
  const lessonPlans = useMemo(()=>{const chosen=activePlan?.sections.filter(section=>selectedUnits.includes(section.id))||[];return chosen.flatMap((section,index)=>{const name=section.label;const first=/الأولى|الاولى|علم التاريخ|unit.?1/i.test(name)||(!/الثانية|الثانيه|العمق الحضاري|unit.?2/i.test(name)&&index===0);const second=/الثانية|الثانيه|العمق الحضاري|unit.?2/i.test(name)||(!first&&index===1);return first?[{unit:name,lesson:"مفهوم التاريخ ومصادره",remedy:"تصنيف الوثائق والآثار والنقوش والمسكوكات، ثم التمييز بين المصادر الأولية والمراجع الثانوية.",enrich:"تحليل مصدرين تاريخيين وتوثيق أوجه الاختلاف في موثوقيتهما."},{unit:name,lesson:"نشأة التدوين التاريخي عند المسلمين",remedy:"إنشاء خط زمني لأسباب نشأة التدوين وتطوره في العصر الإسلامي.",enrich:"بحث قصير يفسر أثر جمع السيرة والحديث في تطور التدوين التاريخي."},{unit:name,lesson:"منهج تدوين التاريخ عند المسلمين",remedy:"جدول مقارنة بين المنهج الحولي والموضوعي والطبقات والشامل والفلسفي.",enrich:"اختيار مؤلف تاريخي وتصنيف منهجه مع تقديم دليل."},{unit:name,lesson:"مهارات التفكير في التاريخ",remedy:"تدريبات على السبب والنتيجة والتسلسل الزمني والمقارنة.",enrich:"تحليل حدث تاريخي باستخدام الأسباب والنتائج والاستمرارية والتغير."}]:second?[{unit:name,lesson:"الموقع",remedy:"تحديد موقع المملكة والطرق التجارية وأهمية موقع شبه الجزيرة العربية على خريطة.",enrich:"رسم مسار تجاري وشرح أثره الحضاري والاقتصادي."},{unit:name,lesson:"الآثار والمصادر الكلاسيكية",remedy:"تمييز العصور التاريخية والنقوش والرسوم الصخرية والمصادر الكلاسيكية.",enrich:"مقارنة شاهد أثري برواية كلاسيكية مع مناقشة حدود كل مصدر."},{unit:name,lesson:"الكتابة والشعر",remedy:"بطاقات مطابقة للخطوط العربية القديمة وأغراض الشعر الجاهلي.",enrich:"عرض يوضح تطور الكتابة العربية ودور الشعر بوصفه ديوان العرب."},{unit:name,lesson:"أسواق العرب",remedy:"مقارنة مواقع أسواق دومة الجندل والمشقر وهجر وذي المجاز وأهميتها.",enrich:"إعداد خريطة تحليلية تربط الأسواق بالطرق التجارية والتبادل الثقافي."}]:[{unit:name,lesson:"دروس "+name,remedy:"مراجعة مفاهيم الوحدة باستخدام أسئلة تشخيصية وتدريبات متدرجة.",enrich:"بحث تحليلي قصير مرتبط بموضوعات الوحدة."}]} )},[activePlan,selectedUnits]);
  const weakSkills = useMemo(() => Object.entries(remedialStudents.reduce<Record<string, number>>((result, student) => ({ ...result, [student.weakest]: (result[student.weakest] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1]), [candidates]);

  async function savePlan() {
    if (!activePlan) return setMessage("اعتمد خطة توزيع الدرجات أولًا حتى يكون التحليل مبنيًا على نظام واضح.");
    if (!planStudents.length) return setMessage("لا يوجد طلاب مطابقون للاختيار الحالي.");
    if (!gradedCandidates.length) return setMessage("لا توجد درجات مرصودة للطلاب المختارين. لا يمكن اعتماد خطة علاجية دون نتائج فعلية.");
    const id = crypto.randomUUID();
    await setDoc(doc(db, plansPath, id), {
      title: `الخطة العلاجية والإثرائية لمادة ${subject}`,
      planType: "combined",
      teacherName,
      subject,
      subjectKey,
      duration,
      threshold,

      scope,
      unitId: selectedUnits[0],
      unitIds: selectedUnits,
      unitLabel,
      className: scope === "class" ? selectedClass : "",
      gradePlanId: activePlan.id,
      gradePlanVersion: activePlan.version,
      students: planStudents.map(student => ({ id: student.id, name: student.name || "", className: String(student.className || student.class || ""), percentage: student.percentage, completion: student.completion, weakest: student.weakest })),
      remedialStudentIds: remedialStudents.map(student => student.id),
      enrichmentStudentIds: enrichmentStudents.map(student => student.id),
      objectives: [...weakSkills.map(([skill]) => `رفع إتقان ${skill}`), "تنمية مهارات البحث والتحليل لدى الطلاب المتقنين"],
      createdAt: new Date().toISOString(),
    });
    setMessage("تم حفظ الخطة مبنية على توزيع الدرجات المعتمد.");
  }

  if (planLoading) return <main className="teacher-ai-page" dir="rtl"><p className="ai-message">جارٍ تحميل خطة توزيع الدرجات…</p></main>;

  return <main className="teacher-ai-page" dir="rtl">
    <section className="teacher-ai-hero no-print"><div><span>المساعد التعليمي الذكي</span><h1>تحليل الطلاب من خطة الدرجات المعتمدة</h1><p>الذكاء الاصطناعي لا يفترض توزيعًا ثابتًا؛ يحتسب الأداء من الخطة المعتمدة للمعلم ثم يبني المقترحات العلاجية.</p></div><div className="teacher-ai-status"><b>{subject}</b><small>{activePlan ? `خطة الدرجات: نسخة ${activePlan.version}` : "لا توجد خطة درجات معتمدة"}</small></div></section>
    {!activePlan ? <section className="plan-builder no-print"><header><div><small>إعداد مطلوب</small><h2>اعتمد توزيع الـ100 درجة أولًا</h2></div></header><p>لن يبدأ التحليل الذكي بدرجات افتراضية. بعد اعتماد الخطة سيقرأها تلقائيًا.</p><a href="/teacher/grade-plan">إعداد توزيع الدرجات</a></section> : <>
      <section className="plan-builder no-print"><header><div><small>١</small><h2>حدد نطاق التحليل</h2></div></header><div className="unit-analysis-field"><strong>اختر الوحدات المطلوب تحليلها</strong><div className="ai-unit-options">{activePlan.sections.map(section => <label key={section.id}><input type="checkbox" checked={selectedUnits.includes(section.id)} onChange={event => setSelectedUnits(current => event.target.checked ? [...current,section.id] : current.length > 1 ? current.filter(id => id !== section.id) : current)} /><span>{section.label} <small>من {section.max} درجة</small></span></label>)}</div><button type="button" className="ai-all-units" onClick={() => setSelectedUnits(activePlan.sections.map(section => section.id))}>تحديد جميع الوحدات</button><small>تُحسب النسبة من مجموع الدرجات الكاملة للوحدات المختارة فقط. تظهر نسبة اكتمال الرصد في التقرير.</small></div><div className="scope-buttons"><button className={scope === "threshold" ? "active" : ""} onClick={() => setScope("threshold")}>حسب الدرجة</button><button className={scope === "class" ? "active" : ""} onClick={() => setScope("class")}>فصل كامل</button><button className={scope === "manual" ? "active" : ""} onClick={() => setScope("manual")}>طلاب محددون</button></div>{scope === "threshold" && <label className="threshold-field">اختر الطلاب الذين تبلغ نسبة تحصيلهم أو تقل عن <span><input type="number" min="1" max="100" value={threshold} onChange={event => setThreshold(Number(event.target.value))} /><b>٪</b></span></label>}{scope === "class" && <label>الفصل<select value={selectedClass} onChange={event => setSelectedClass(event.target.value)}><option value="">جميع الفصول</option>{classes.map(name => <option key={name}>{name}</option>)}</select></label>}{scope === "manual" && <div className="manual-students"><div><button onClick={() => setSelectedIds(analyzed.map(student => student.id))}>تحديد الكل</button><button onClick={() => setSelectedIds([])}>إلغاء التحديد</button></div>{analyzed.map(student => <label key={student.id}><input type="checkbox" checked={selectedIds.includes(student.id)} onChange={event => setSelectedIds(current => event.target.checked ? [...new Set([...current, student.id])] : current.filter(id => id !== student.id))} /><span><b>{student.name || "—"}</b><small>{String(student.className || student.class || "—")} • {student.hasGrades ? `${student.percentage}%` : "لم تُرصد درجات"} • اكتمال {student.completion}%</small></span></label>)}</div>}<label>مدة تنفيذ الخطة<select value={duration} onChange={event => setDuration(event.target.value)}><option>أسبوعان</option><option>٣ أسابيع</option><option>٤ أسابيع</option><option>٦ أسابيع</option></select></label></section>
      <section className="plan-selection no-print"><article><small>طلاب الخطة العلاجية</small><strong>{remedialStudents.length}</strong></article><article><small>متوسط التحصيل — {unitLabel}</small><strong>{average}%</strong></article><article><small>اكتمال الرصد</small><strong>{averageCompletion}%</strong></article><article><small>أكثر عنصر يحتاج دعمًا</small><strong>{weakSkills[0]?.[0] || "—"}</strong></article></section>
      <section className="generated-plan"><header><div><span>تقرير التحصيل والخطط التعليمية</span><h2>الخطة العلاجية والإثرائية لمادة {subject}</h2><p>خطة الدرجات المعتمدة • النسخة {activePlan.version}</p></div><div className="plan-actions no-print"><button onClick={() => void savePlan()}>حفظ الخطتين</button><button onClick={() => window.print()}>طباعة / PDF</button></div></header><div className="ai-report-byline"><strong>إعداد المعلم: {teacherName}</strong><span>الوحدات المختارة: {unitLabel}</span></div><div className="plan-meta"><article><b>التصنيف حسب التحصيل</b><p>{remedialStudents.length} طالبًا بنسبة {threshold}% فأقل • خطة علاجية وإثرائية مساندة</p></article><article><b>مصدر التحليل</b><p>{unitLabel} من خطة توزيع الدرجات المعتمدة نسخة {activePlan.version}.</p></article></div><section className="ai-analytics"><h3>لوحة تحليل بيانات الطلاب المستهدفين</h3><div className="ai-kpi-row"><article><small>عدد الطلاب</small><strong>{planStudents.length}</strong></article><article><small>متوسط التحصيل</small><strong>{planStudents.length?average+"%":"—"}</strong></article><article><small>اكتمال الرصد</small><strong>{planStudents.length?averageCompletion+"%":"—"}</strong></article><article><small>الوحدات المحددة</small><strong>{selectedUnits.length}</strong></article></div><div className="ai-chart-grid"><div className="ai-chart"><h4>توزيع مستويات التحصيل المسجلة</h4>{distribution.map(row=><div className="ai-bar-line" key={row.label}><span>{row.label}</span><div className="ai-bar-track"><i style={{width:`${planStudents.length?row.count/planStudents.length*100:0}%`}}/></div><b>{row.count}</b></div>)}</div><div className="ai-chart"><h4>مقارنة الفصول المستهدفة</h4>{classStats.map(group=><div className="ai-bar-line" key={group.name}><span>{group.name}</span><div className="ai-bar-track ai-class-track"><i style={{width:`${planStudents.length?group.rows.length/planStudents.length*100:0}%`}}/></div><b>{group.rows.length}</b></div>)}{!classStats.length&&<p>لا توجد نتائج مطابقة للحد المحدد.</p>}</div></div><p className="ai-data-note">المخططات مبنية على درجات الطلاب المستهدفين فقط.</p></section><h3 className="ai-part-title">الخطة العلاجية</h3><div className="plan-steps"><h3>إجراءات علاجية موجهة</h3>{weakSkills.slice(0,4).map(([skill,count],index)=><article key={skill}><em>{index+1}</em><div><b>{skill}</b><small>{count} طالب يحتاجون دعمًا</small><p>{remedialStudents.find(student=>student.weakest===skill)?.action}</p></div></article>)}{!remedialStudents.length&&<p>لا توجد حالات علاجية حسب النسبة المختارة.</p>}</div><div className="ai-lessons"><h3>الأنشطة العلاجية المرتبطة بالدروس</h3>{lessonPlans.map((item,index)=><article key={item.unit+item.lesson}><b>{index+1}. {item.lesson}</b><small>{item.unit}</small><p>{item.remedy}</p></article>)}</div><p className="ai-plan-outcome"><b>قياس الأثر:</b> تقويم قبلي وبعدي ومقارنة التحسن.</p><div className="ai-enrichment-section"><h3 className="ai-part-title">الخطة الإثرائية</h3><p>أنشطة بحث وتحليل للطلاب المستهدفين ضمن الوحدات المختارة.</p><div className="ai-lessons ai-enrich-lessons"><h3>أنشطة إثرائية مرتبطة بالدروس</h3>{lessonPlans.map((item,index)=><article key={item.unit+item.lesson}><b>{index+1}. {item.lesson}</b><small>{item.unit}</small><p>{item.enrich}</p></article>)}</div><p className="ai-plan-outcome"><b>قياس الأثر:</b> تقويم المنتج ومقارنة مستوى الطالب قبل النشاط وبعده.</p></div><div className="plan-students ai-report-student-register"><h3>سجل الطلاب وتحليل المسارات ({planStudents.length})</h3><table className="plan-students-table"><thead><tr><th>م</th><th>اسم الطالب</th><th>الصف / الفصل</th><th>نسبة التحصيل</th><th>المسار</th></tr></thead><tbody>{planStudents.map((student,index)=><tr key={student.id}><td>{index+1}</td><td>{student.name||"—"}</td><td>{String(student.className||student.class||"—")}</td><td>{student.percentage}%</td><td>{"علاجي وإثرائي"}</td></tr>)}</tbody></table></div></section>
    </>}
    {message && <p className="ai-message no-print" role="status">{message}</p>}
  </main>;
}
