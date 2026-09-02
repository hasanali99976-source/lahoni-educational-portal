"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useTeacherClient } from "../../../lib/teacher-client";
import { tenantCollection } from "../../../lib/teacher-tenant";
import { calculateGradePlanResult, type GradePlan, type GradeStudentLike } from "../../../lib/grade-plan";
import { useGradePlan } from "../../../lib/use-grade-plan";
import "./teacher-ai.css";

type Student = GradeStudentLike & { id: string; name?: string; class?: string; className?: string };
type Analyzed = Student & { percentage: number; completion: number; weakest: string; action: string };

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

function analyze(student: Student, plan: GradePlan): Analyzed {
  const result = calculateGradePlanResult(plan, student);
  const weakest = [...result.dimensions].filter(item => item.maximum > 0).sort((a, b) => a.percentage - b.percentage)[0];
  const weakestLabel = weakest?.label || "المهارات الأساسية";
  return {
    ...student,
    percentage: Math.round(result.percentage),
    completion: Math.round(result.completion),
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [duration, setDuration] = useState("٤ أسابيع");
  const [message, setMessage] = useState("");
  const studentsPath = useMemo(() => teacherId ? tenantCollection(teacherId, subjectKey as never, "students") : "", [teacherId, subjectKey]);
  const plansPath = useMemo(() => teacherId ? tenantCollection(teacherId, subjectKey as never, "treatmentPlans") : "", [teacherId, subjectKey]);

  useEffect(() => {
    if (!studentsPath) return;
    return onSnapshot(collection(db, studentsPath), snapshot => setStudents(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as Student)).sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"))));
  }, [studentsPath]);

  const analyzed = useMemo(() => activePlan ? students.map(student => analyze(student, activePlan)) : [], [students, activePlan]);
  const classes = useMemo(() => Array.from(new Set(students.map(student => String(student.className || student.class || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ar")), [students]);
  const candidates = useMemo(() => scope === "threshold" ? analyzed.filter(student => student.percentage < threshold) : scope === "class" ? analyzed.filter(student => !selectedClass || String(student.className || student.class || "") === selectedClass) : analyzed.filter(student => selectedIds.includes(student.id)), [analyzed, scope, threshold, selectedClass, selectedIds]);
  const average = candidates.length ? Math.round(candidates.reduce((sum, student) => sum + student.percentage, 0) / candidates.length) : 0;
  const averageCompletion = candidates.length ? Math.round(candidates.reduce((sum, student) => sum + student.completion, 0) / candidates.length) : 0;
  const weakSkills = useMemo(() => Object.entries(candidates.reduce<Record<string, number>>((result, student) => ({ ...result, [student.weakest]: (result[student.weakest] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1]), [candidates]);

  async function savePlan() {
    if (!activePlan) return setMessage("اعتمد خطة توزيع الدرجات أولًا حتى يكون التحليل مبنيًا على نظام واضح.");
    if (!candidates.length) return setMessage("لا يوجد طلاب مطابقون للاختيار الحالي.");
    const id = crypto.randomUUID();
    await setDoc(doc(db, plansPath, id), {
      title: `الخطة العلاجية لمادة ${subject}`,
      teacherName,
      subject,
      subjectKey,
      duration,
      threshold: scope === "threshold" ? threshold : null,
      scope,
      className: scope === "class" ? selectedClass : "",
      gradePlanId: activePlan.id,
      gradePlanVersion: activePlan.version,
      students: candidates.map(student => ({ id: student.id, name: student.name || "", className: String(student.className || student.class || ""), percentage: student.percentage, completion: student.completion, weakest: student.weakest })),
      objectives: weakSkills.map(([skill]) => `رفع إتقان ${skill}`),
      createdAt: new Date().toISOString(),
    });
    setMessage("تم حفظ الخطة العلاجية مبنية على توزيع الدرجات المعتمد.");
  }

  if (planLoading) return <main className="teacher-ai-page" dir="rtl"><p className="ai-message">جارٍ تحميل خطة توزيع الدرجات…</p></main>;

  return <main className="teacher-ai-page" dir="rtl">
    <section className="teacher-ai-hero no-print"><div><span>المساعد التعليمي الذكي</span><h1>تحليل الطلاب من خطة الدرجات المعتمدة</h1><p>الذكاء الاصطناعي لا يفترض توزيعًا ثابتًا؛ يحتسب الأداء من الخطة المعتمدة للمعلم ثم يبني المقترحات العلاجية.</p></div><div className="teacher-ai-status"><b>{subject}</b><small>{activePlan ? `خطة الدرجات: نسخة ${activePlan.version}` : "لا توجد خطة درجات معتمدة"}</small></div></section>
    {!activePlan ? <section className="plan-builder no-print"><header><div><small>إعداد مطلوب</small><h2>اعتمد توزيع الـ100 درجة أولًا</h2></div></header><p>لن يبدأ التحليل الذكي بدرجات افتراضية. بعد اعتماد الخطة سيقرأها تلقائيًا.</p><a href="/teacher/grade-plan">إعداد توزيع الدرجات</a></section> : <>
      <section className="plan-builder no-print"><header><div><small>١</small><h2>حدد نطاق التحليل</h2></div></header><div className="scope-buttons"><button className={scope === "threshold" ? "active" : ""} onClick={() => setScope("threshold")}>حسب الدرجة</button><button className={scope === "class" ? "active" : ""} onClick={() => setScope("class")}>فصل كامل</button><button className={scope === "manual" ? "active" : ""} onClick={() => setScope("manual")}>طلاب محددون</button></div>{scope === "threshold" && <label className="threshold-field">اختر كل طالب درجته أقل من <span><input type="number" min="1" max="100" value={threshold} onChange={event => setThreshold(Number(event.target.value))} /><b>٪</b></span></label>}{scope === "class" && <label>الفصل<select value={selectedClass} onChange={event => setSelectedClass(event.target.value)}><option value="">جميع الفصول</option>{classes.map(name => <option key={name}>{name}</option>)}</select></label>}{scope === "manual" && <div className="manual-students"><div><button onClick={() => setSelectedIds(analyzed.map(student => student.id))}>تحديد الكل</button><button onClick={() => setSelectedIds([])}>إلغاء التحديد</button></div>{analyzed.map(student => <label key={student.id}><input type="checkbox" checked={selectedIds.includes(student.id)} onChange={event => setSelectedIds(current => event.target.checked ? [...new Set([...current, student.id])] : current.filter(id => id !== student.id))} /><span><b>{student.name || "—"}</b><small>{String(student.className || student.class || "—")} • {student.percentage}% • اكتمال {student.completion}%</small></span></label>)}</div>}<label>مدة الخطة العلاجية<select value={duration} onChange={event => setDuration(event.target.value)}><option>أسبوعان</option><option>٣ أسابيع</option><option>٤ أسابيع</option><option>٦ أسابيع</option></select></label></section>
      <section className="plan-selection no-print"><article><small>الطلاب المختارون</small><strong>{candidates.length}</strong></article><article><small>متوسطهم الحالي</small><strong>{average}%</strong></article><article><small>اكتمال الرصد</small><strong>{averageCompletion}%</strong></article><article><small>أكثر عنصر يحتاج دعمًا</small><strong>{weakSkills[0]?.[0] || "—"}</strong></article></section>
      <section className="generated-plan"><header><div><span>الخطة العلاجية المقترحة</span><h2>خطة علاجية لمادة {subject}</h2><p>إعداد المعلم: {teacherName} • مبنية على خطة الدرجات نسخة {activePlan.version}</p></div><div className="plan-actions no-print"><button onClick={() => void savePlan()}>حفظ الخطة العلاجية</button><button onClick={() => window.print()}>طباعة / PDF</button></div></header><div className="plan-meta"><article><b>الفئة المستهدفة</b><p>{candidates.length} طالبًا {scope === "threshold" ? `درجاتهم أقل من ${threshold}%` : scope === "class" ? `من ${selectedClass || "جميع الفصول"}` : "تم تحديدهم يدويًا"}.</p></article><article><b>مصدر التحليل</b><p>خطة توزيع الدرجات المعتمدة رقم {activePlan.version}، مع الحفاظ على الدرجات الخام الأصلية.</p></article></div><div className="plan-steps"><h3>إجراءات التنفيذ</h3>{weakSkills.slice(0, 4).map(([skill, count], index) => <article key={skill}><em>{index + 1}</em><div><b>{skill}</b><small>{count} طالب يحتاجون دعمًا في هذا المحور</small><p>{candidates.find(student => student.weakest === skill)?.action}</p></div></article>)}{!weakSkills.length && <p>اختر طلابًا ليتم بناء الخطة العلاجية من درجاتهم.</p>}</div><div className="plan-schedule"><h3>الجدول الزمني وقياس الأثر</h3><span><b>الأسبوع الأول</b> تشخيص العنصر الأضعف وتحديد نقطة البداية.</span><span><b>منتصف الخطة</b> تدريب موجه ومتابعة قصيرة لكل مجموعة.</span><span><b>نهاية الخطة</b> تقويم بعدي ومقارنة النتيجة بالنسبة الحالية {average}%.</span></div><div className="plan-students"><h3>الطلاب المشمولون بالخطة</h3><div>{candidates.map(student => <span key={student.id}><b>{student.name || "—"}</b><small>{String(student.className || student.class || "—")} • {student.percentage}% • {student.weakest}</small></span>)}</div></div></section>
    </>}
    {message && <p className="ai-message no-print" role="status">{message}</p>}
  </main>;
}
