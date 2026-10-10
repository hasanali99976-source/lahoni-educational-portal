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

function analyze(student: Student, plan: GradePlan, sectionId: string): Analyzed {
  const result = calculateGradePlanResult(plan, student);
  const sections = sectionId === "all" ? result.sections : result.sections.filter(section => section.id === sectionId);
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
  const [selectedUnit, setSelectedUnit] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [duration, setDuration] = useState("٤ أسابيع");

  const [message, setMessage] = useState("");
  const plansPath = useMemo(() => teacherId ? tenantCollection(teacherId, subjectKey as never, "treatmentPlans") : "", [teacherId, subjectKey]);

  useEffect(() => {
    if (!session?.subjectKey) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ subjectId: session.subjectKey });
    if (session.activeGrade) params.set("grade", String(session.activeGrade));
    Promise.all([
      fetch(`/api/teacher/students?${params.toString()}`, { cache: "no-store", signal: controller.signal, credentials: "same-origin" }).then(async response => { const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message || "تعذر تحميل الطلاب"); return data; }),
      fetch(`/api/teacher/grade-data?subjectId=${encodeURIComponent(session.subjectKey)}`, { cache: "no-store", signal: controller.signal, credentials: "same-origin" }).then(async response => { const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message || "تعذر تحميل الدرجات المحفوظة"); return data; }),
    ]).then(([data, academicData]) => {
      const byCode = academicData.byCode && typeof academicData.byCode === "object" ? academicData.byCode as Record<string, Record<string, unknown>> : {};
      const roster = (Array.isArray(data.students) ? data.students : []).map((item: Record<string, unknown>) => {
        const id = String(item.code || item.id || "").trim().toUpperCase();
        const academic = byCode[id] || Object.values(byCode).find(row => [row.code, row.accessCode, row.studentCode, row.documentId].some(value => String(value || "").trim().toUpperCase() === id)) || {};
        return {
          ...item, id, name: String(item.name || "").trim(),
          class: String(item.className || item.class || ""),
          gradeValues: academic.gradeValues && typeof academic.gradeValues === "object" ? academic.gradeValues : item.gradeValues,
          gradePlanValues: academic.gradePlanValues && typeof academic.gradePlanValues === "object" ? academic.gradePlanValues : item.gradePlanValues,
          units: academic.units && typeof academic.units === "object" ? academic.units : item.units,
        } as Student;
      }).filter((item: Student) => item.id && item.name);
      setStudents(roster.sort((a: Student, b: Student) => (a.name || "").localeCompare(b.name || "", "ar")));
      setMessage("");
    }).catch(error => { if ((error as Error)?.name !== "AbortError") { setStudents([]); setMessage(error instanceof Error ? error.message : "تعذر تحميل درجات الطلاب"); } });
    return () => controller.abort();
  }, [session?.subjectKey, session?.activeGrade]);

  const analyzed = useMemo(() => activePlan ? students.map(student => analyze(student, activePlan, selectedUnit)) : [], [students, activePlan, selectedUnit]);
  const unitLabel = selectedUnit === "all" ? "كل الوحدات" : activePlan?.sections.find(section => section.id === selectedUnit)?.label || "كل الوحدات";
  const classes = useMemo(() => Array.from(new Set(students.map(student => String(student.className || student.class || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ar")), [students]);
  const candidates = useMemo(() => scope === "threshold" ? analyzed.filter(student => student.hasGrades && student.percentage <= threshold) : scope === "class" ? analyzed.filter(student => !selectedClass || String(student.className || student.class || "") === selectedClass) : analyzed.filter(student => selectedIds.includes(student.id)), [analyzed, scope, threshold, selectedClass, selectedIds]);
  const eligibleStudents = scope === "threshold" ? analyzed.filter(student => student.hasGrades) : candidates.filter(student => student.hasGrades);
  const remedialStudents = eligibleStudents.filter(student => student.percentage <= threshold);
  const enrichmentStudents = eligibleStudents.filter(student => student.percentage > threshold);
  const planStudents = [...remedialStudents, ...enrichmentStudents];
  const gradedCandidates = planStudents.filter(student => student.hasGrades);
  const average = gradedCandidates.length ? Math.round(gradedCandidates.reduce((sum, student) => sum + student.percentage, 0) / gradedCandidates.length) : 0;
  const averageCompletion = gradedCandidates.length ? Math.round(gradedCandidates.reduce((sum, student) => sum + student.completion, 0) / gradedCandidates.length) : 0;
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
      threshold: scope === "threshold" ? threshold : null,
      scope,
      unitId: selectedUnit,
      unitLabel,
      className: scope === "class" ? selectedClass : "",
      gradePlanId: activePlan.id,
      gradePlanVersion: activePlan.version,
      students: planStudents.map(student => ({ id: student.id, name: student.name || "", className: String(student.className || student.class || ""), percentage: student.percentage, completion: student.completion, weakest: student.weakest })),
      remedialStudentIds: remedialStudents.map(student => student.id),
      enrichmentStudentIds: enrichmentStudents.map(student => student.id),
      objectives: [...weakSkills.map(([skill]) => `رفع إتقان ${skill}`), "تعميق التعلم بأنشطة بحثية وتطبيقية للطلاب المتقدمين"],
      createdAt: new Date().toISOString(),
    });
    setMessage("تم حفظ الخطة مبنية على توزيع الدرجات المعتمد.");
  }

  if (planLoading) return <main className="teacher-ai-page" dir="rtl"><p className="ai-message">جارٍ تحميل خطة توزيع الدرجات…</p></main>;

  return <main className="teacher-ai-page" dir="rtl">
    <section className="teacher-ai-hero no-print"><div><span>المساعد التعليمي الذكي</span><h1>تحليل الطلاب من خطة الدرجات المعتمدة</h1><p>الذكاء الاصطناعي لا يفترض توزيعًا ثابتًا؛ يحتسب الأداء من الخطة المعتمدة للمعلم ثم يبني المقترحات العلاجية.</p></div><div className="teacher-ai-status"><b>{subject}</b><small>{activePlan ? `خطة الدرجات: نسخة ${activePlan.version}` : "لا توجد خطة درجات معتمدة"}</small></div></section>
    {!activePlan ? <section className="plan-builder no-print"><header><div><small>إعداد مطلوب</small><h2>اعتمد توزيع الـ100 درجة أولًا</h2></div></header><p>لن يبدأ التحليل الذكي بدرجات افتراضية. بعد اعتماد الخطة سيقرأها تلقائيًا.</p><a href="/teacher/grade-plan">إعداد توزيع الدرجات</a></section> : <>
      <section className="plan-builder no-print"><header><div><small>١</small><h2>حدد نطاق التحليل</h2></div></header><label className="unit-analysis-field">نطاق التحصيل الدراسي<select value={activePlan.sections.some(section => section.id === selectedUnit) ? selectedUnit : "all"} onChange={event => setSelectedUnit(event.target.value)}><option value="all">كل الوحدات — التحصيل الإجمالي</option>{activePlan.sections.map(section => <option key={section.id} value={section.id}>{section.label} — {section.max} درجة</option>)}</select><small>تُحسب النسبة من الدرجة الكاملة للوحدة المختارة مثل الإتقان والمتابعة، ولا تُحسب الوحدات الأخرى.</small></label><div className="scope-buttons"><button className={scope === "threshold" ? "active" : ""} onClick={() => setScope("threshold")}>حسب الدرجة</button><button className={scope === "class" ? "active" : ""} onClick={() => setScope("class")}>فصل كامل</button><button className={scope === "manual" ? "active" : ""} onClick={() => setScope("manual")}>طلاب محددون</button></div>{scope === "threshold" && <label className="threshold-field">اختر الطلاب الذين تبلغ نسبة تحصيلهم أو تقل عن <span><input type="number" min="1" max="100" value={threshold} onChange={event => setThreshold(Number(event.target.value))} /><b>٪</b></span></label>}{scope === "class" && <label>الفصل<select value={selectedClass} onChange={event => setSelectedClass(event.target.value)}><option value="">جميع الفصول</option>{classes.map(name => <option key={name}>{name}</option>)}</select></label>}{scope === "manual" && <div className="manual-students"><div><button onClick={() => setSelectedIds(analyzed.map(student => student.id))}>تحديد الكل</button><button onClick={() => setSelectedIds([])}>إلغاء التحديد</button></div>{analyzed.map(student => <label key={student.id}><input type="checkbox" checked={selectedIds.includes(student.id)} onChange={event => setSelectedIds(current => event.target.checked ? [...new Set([...current, student.id])] : current.filter(id => id !== student.id))} /><span><b>{student.name || "—"}</b><small>{String(student.className || student.class || "—")} • {student.hasGrades ? `${student.percentage}%` : "لم تُرصد درجات"} • اكتمال {student.completion}%</small></span></label>)}</div>}<label>مدة تنفيذ الخطة<select value={duration} onChange={event => setDuration(event.target.value)}><option>أسبوعان</option><option>٣ أسابيع</option><option>٤ أسابيع</option><option>٦ أسابيع</option></select></label></section>
      <section className="plan-selection no-print"><article><small>الطلاب المختارون</small><strong>{planStudents.length}</strong></article><article><small>متوسط التحصيل — {unitLabel}</small><strong>{average}%</strong></article><article><small>اكتمال الرصد</small><strong>{averageCompletion}%</strong></article><article><small>أكثر عنصر يحتاج دعمًا</small><strong>{weakSkills[0]?.[0] || "—"}</strong></article></section>
      <section className="generated-plan"><header><div><span>تقرير التحصيل والخطط التعليمية</span><h2>الخطة العلاجية والإثرائية لمادة {subject} — {unitLabel}</h2><p>إعداد المعلم: {teacherName} • {unitLabel} • مبنية على خطة الدرجات نسخة {activePlan.version}</p></div><div className="plan-actions no-print"><button onClick={() => void savePlan()}>حفظ الخطتين</button><button onClick={() => window.print()}>طباعة / PDF</button></div></header><div className="plan-meta"><article><b>التصنيف حسب التحصيل</b><p>علاجي: {threshold}% فأقل ({remedialStudents.length} طالبًا) | إثرائي: أعلى من {threshold}% ({enrichmentStudents.length} طالبًا)</p></article><article><b>مصدر التحليل</b><p>{unitLabel} من خطة توزيع الدرجات المعتمدة نسخة {activePlan.version}.</p></article></div><h3 className="ai-part-title">أولًا: الخطة العلاجية</h3><div className="plan-steps"><h3>إجراءات علاجية موجهة</h3>{weakSkills.slice(0,4).map(([skill,count],index)=><article key={skill}><em>{index+1}</em><div><b>{skill}</b><small>{count} طالب يحتاجون دعمًا</small><p>{remedialStudents.find(student=>student.weakest===skill)?.action}</p></div></article>)}{!remedialStudents.length&&<p>لا توجد حالات علاجية حسب النسبة المختارة.</p>}</div><div className="plan-schedule"><h3>الجدول الزمني وقياس الأثر العلاجي</h3><span><b>البداية</b> تشخيص المهارات غير المتقنة.</span><span><b>التنفيذ</b> تدريب متدرج ومتابعة فردية.</span><span><b>الختام</b> تقويم بعدي ومقارنة التحسن.</span></div><div className="plan-students"><h3>طلاب الخطة العلاجية ({remedialStudents.length})</h3><table className="plan-students-table"><thead><tr><th>م</th><th>اسم الطالب</th><th>الصف / الفصل</th><th>التحصيل</th></tr></thead><tbody>{remedialStudents.map((student,index)=><tr key={student.id}><td>{index+1}</td><td>{student.name||"—"}</td><td>{String(student.className||student.class||"—")}</td><td>{student.percentage}%</td></tr>)}</tbody></table></div><div className="ai-enrichment-section"><h3 className="ai-part-title">ثانيًا: الخطة الإثرائية</h3><p>الطلاب الذين تجاوزوا نسبة {threshold}% في {unitLabel}.</p><div className="plan-steps"><h3>الأنشطة الإثرائية</h3>{["مشروع بحثي وتطبيقي مرتبط بمحتوى الوحدة","تحليل مصادر ومقارنة الأدلة وتنمية التفكير الناقد","إعداد عرض إثرائي أو ملف إنجاز","عرض المنتجات وتقويمها بسلم تقدير"].map((step,index)=><article key={step}><em>{index+1}</em><div><b>نشاط إثرائي {index+1}</b><p>{step}</p></div></article>)}</div><div className="plan-schedule"><h3>التنفيذ وقياس الأثر الإثرائي</h3><span><b>البداية</b> تحديد تحديات إثرائية ومعايير النجاح.</span><span><b>التنفيذ</b> متابعة المشروعات وتقديم التغذية الراجعة.</span><span><b>الختام</b> عرض المنتجات وتقييم جودة المخرجات.</span></div><div className="plan-students"><h3>طلاب الخطة الإثرائية ({enrichmentStudents.length})</h3><table className="plan-students-table"><thead><tr><th>م</th><th>اسم الطالب</th><th>الصف / الفصل</th><th>التحصيل</th></tr></thead><tbody>{enrichmentStudents.map((student,index)=><tr key={student.id}><td>{index+1}</td><td>{student.name||"—"}</td><td>{String(student.className||student.class||"—")}</td><td>{student.percentage}%</td></tr>)}</tbody></table></div></div></section>
    </>}
    {message && <p className="ai-message no-print" role="status">{message}</p>}
  </main>;
}
