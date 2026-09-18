"use client";
import { useEffect, useMemo, useState } from "react";
import { doc, increment, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { tenantCollection } from "../../../lib/teacher-tenant";
import { useTeacherClient } from "../../../lib/teacher-client";
import { calculateGradePlanResult, type GradePlan, type GradeStudentLike } from "../../../lib/grade-plan";
import { useGradePlan } from "../../../lib/use-grade-plan";
import "./follow-up.css";

type UnitRecord = { attendance?: number; participation?: number; homework?: number; unitExam?: number; total?: number };
type TeacherNoteEntry = { id: string; type: string; label: string; message?: string; createdAt: string; teacherName?: string; subject?: string };
type Student = GradeStudentLike & { id: string; storageId?: string; name?: string; class?: string; className?: string; code?: string; accessCode?: string; studentCode?: string; researchScore?: number; teacherNote?: string; teacherNoteCount?: number; teacherNoteCounts?: Record<string, number>; teacherNotes?: TeacherNoteEntry[]; units?: Record<string, UnitRecord> };
type SchoolClass = { id: string; name: string; grade?: number; section?: string };
type AiInsight = { analysis: string; recommendedAction: string; suggestedNote: string };
type EvaluatedStudent = Student & { points: number; completion: number; performance: number; finalScore: number | null; missing: number; masteryScore: number | null; masteryBasis: string; hasCompletedSection: boolean };

const unitKeys = ["unit1", "unit2", "unit3", "unit4", "unit5"];
const counselorPhone = "966598353651";
const componentMax = { attendance: 3, participation: 4, homework: 2, unitExam: 10 } as const;
const researchMax = 5;
const noteOptions = [
  { type: "participation", group: "إيجابية", label: "الطالب شارك بفاعلية وتميز في الحصة.", description: "تعزيز واضح للمشاركة الإيجابية." },
  { type: "improved", group: "إيجابية", label: "الطالب أظهر تحسنًا ملحوظًا في مستواه.", description: "لتوثيق التحسن مقارنة بمستواه السابق." },
  { type: "needs_review", group: "تحصيل", label: "الطالب يحتاج إلى مراجعة المهارة أو المفهوم.", description: "عندما تشير الدرجات إلى حاجة لمراجعة محددة." },
  { type: "homework_missing", group: "تحصيل", label: "الطالب لم ينجز الواجب المطلوب.", description: "ملاحظة مباشرة خاصة بالواجب." },
  { type: "no_interaction", group: "تفاعل", label: "الطالب يحتاج إلى زيادة التفاعل والمشاركة أثناء الحصة.", description: "عند ضعف الاستجابة والمشاركة الصفية." },
  { type: "disruptive", group: "سلوك", label: "الطالب يكثر الحديث أثناء الحصة مما يؤثر في التركيز.", description: "تستخدم عند تكرر الحديث أو التشتيت داخل الحصة." },
  { type: "other", group: "مخصصة", label: "كتابة ملاحظة مخصصة للطالب.", description: "اكتب النص الذي تريد ظهوره للطالب وولي الأمر." },
];

function aliases(student: Student) {
  return [...new Set([student.id, student.code, student.accessCode, student.studentCode].map(value => String(value || "").trim()).filter(Boolean))];
}

function evaluateStudent(student: Student, plan: GradePlan | null): EvaluatedStudent {
  const result = calculateGradePlanResult(plan, student);
  const missing = result.sections.reduce((sum, section) => sum + section.items.filter(item => !item.recorded).length, 0);
  const completedSections = result.sections.filter(section => section.complete);\n  const latestCompleted = completedSections[completedSections.length - 1];\n  return { ...student, points: result.earned, completion: Math.round(result.completion), performance: Math.round(result.percentage), finalScore: result.finalScore === null ? null : Math.round(result.finalScore), missing, masteryScore: latestCompleted ? Math.round(latestCompleted.percentage) : (result.finalScore === null ? null : Math.round(result.finalScore)), masteryBasis: latestCompleted?.label || (result.complete ? "الخطة كاملة" : ""), hasCompletedSection: Boolean(latestCompleted || result.complete) };
}

function insightProfile(student: Student, plan: GradePlan | null) {
  const result = calculateGradePlanResult(plan, student);
  const dimensions = result.dimensions.filter(item => item.maximum > 0);
  const weakest = [...dimensions].sort((a, b) => a.percentage - b.percentage)[0];
  const strongest = [...dimensions].sort((a, b) => b.percentage - a.percentage)[0];
  return {
    weakest: weakest ? { key: weakest.key, label: weakest.label, value: Math.round(weakest.percentage), recorded: weakest.maximum } : { key: "none", label: "لا يوجد رصد كافٍ", value: 0, recorded: 0 },
    strongest: strongest ? { key: strongest.key, label: strongest.label, value: Math.round(strongest.percentage), recorded: strongest.maximum } : { key: "none", label: "لا يوجد رصد كافٍ", value: 0, recorded: 0 },
  };
}

function statusFor(student: EvaluatedStudent, threshold: number) {
  if (student.completion < 100) return { label: "الرصد غير مكتمل", className: "incomplete" };
  if ((student.finalScore || 0) >= threshold) return { label: "متقن", className: "mastered" };
  return { label: "يحتاج دعمًا", className: "support" };
}

export default function FollowUpPage() {
  const session = useTeacherClient();
  const { activePlan } = useGradePlan(true);
  const teacherId = session.teacherId || "";
  const teacherName = session.teacherName || "المعلم";
  const subjectKey = session.subjectKey || "history";
  const subject = session.subject || "المادة";
  const activeGrade = session.activeGrade || null;
  const [storedStudents, setStoredStudents] = useState<Student[]>([]);
  const [scopeStudents, setScopeStudents] = useState<Student[]>([]);
  const [scopeClasses, setScopeClasses] = useState<SchoolClass[]>([]);
  const [scopeLoading, setScopeLoading] = useState(false);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [threshold, setThreshold] = useState(80);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [referralOpen, setReferralOpen] = useState(false);
  const [referralClass, setReferralClass] = useState("");
  const [referralType, setReferralType] = useState<"achievement" | "other">("achievement");
  const [notifyParents, setNotifyParents] = useState(false);
  const [reason, setReason] = useState("انخفاض مستوى التحصيل الدراسي");
  const [noteStudent, setNoteStudent] = useState<Student | null>(null);
  const [selectedNoteType, setSelectedNoteType] = useState("");
  const [note, setNote] = useState("");
  const [analysisStudent, setAnalysisStudent] = useState<Student | null>(null);
  const [aiInsight, setAiInsight] = useState<AiInsight | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [message, setMessage] = useState("");
  const studentsPath = useMemo(() => teacherId ? tenantCollection(teacherId, subjectKey as never, "students") : "", [teacherId, subjectKey]);
  const referralsPath = useMemo(() => teacherId ? tenantCollection(teacherId, subjectKey as never, "counselorReferrals") : "", [teacherId, subjectKey]);

  useEffect(() => {
    if (!teacherId || !subjectKey) { setStoredStudents([]); return; }
    let active = true;
    let loading = false;
    let controller: AbortController | null = null;
    const refresh = async () => {
      if (!active || loading) return;
      loading = true;
      controller?.abort();
      controller = new AbortController();
      try {
        const response = await fetch(`/api/teacher/grade-data?subjectId=${encodeURIComponent(String(subjectKey).split("--")[0])}`, {
          credentials: "same-origin", signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "تعذر تحميل بيانات الطلاب.");
        if (!active) return;
        const byCode = data.byCode && typeof data.byCode === "object" ? data.byCode as Record<string, Record<string, unknown>> : {};
        setStoredStudents(Object.entries(byCode).map(([code, row]) => ({
          ...row, id: String(row.documentId || code), code: String(row.code || row.accessCode || row.studentCode || code),
        })) as Student[]);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (active) setMessage(error instanceof Error ? error.message : "تعذر تحميل بيانات الطلاب.");
      } finally { loading = false; }
    };
    // Load once for the active scope. Focus/visibility/online refreshes caused
    // repeated students + grade-data requests without any underlying data change.
    void refresh();
    return () => { active = false; controller?.abort(); };
  }, [teacherId, subjectKey]);

  useEffect(() => {
    if (!teacherId || !subjectKey || !activeGrade) { setScopeStudents([]); setScopeClasses([]); return; }
    let active = true;
    let loading = false;
    let controller: AbortController | null = null;
    const params = new URLSearchParams({ subjectId: subjectKey, grade: String(activeGrade) });
    const refresh = async () => {
      if (!active || loading) return;
      loading = true;
      controller?.abort();
      controller = new AbortController();
      setScopeLoading(true);
      try {
        const response = await fetch(`/api/teacher/students?${params.toString()}`, { signal: controller.signal });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "تعذر تحميل الفصول المحددة.");
        if (!active) return;
        setScopeStudents(Array.isArray(data.students) ? data.students : []);
        setScopeClasses(Array.isArray(data.classes) ? data.classes : []);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (active) setMessage(error instanceof Error ? error.message : "تعذر تحميل الفصول المحددة.");
      } finally { loading = false; if (active) setScopeLoading(false); }
    };
    // Load once for the active scope. Focus/visibility/online refreshes caused
    // repeated students + grade-data requests without any underlying data change.
    void refresh();
    return () => { active = false; controller?.abort(); };
  }, [teacherId, subjectKey, activeGrade]);

  const students = useMemo(() => {
    const liveByAlias = new Map<string, Student>();
    storedStudents.forEach(student => aliases(student).forEach(alias => liveByAlias.set(alias, student)));
    return scopeStudents.map(rosterStudent => {
      const live = aliases(rosterStudent).map(alias => liveByAlias.get(alias)).find(Boolean);
      const officialClass = String(rosterStudent.className || rosterStudent.class || "").trim();
      return { ...rosterStudent, ...(live || {}), id: rosterStudent.id, storageId: live?.id || rosterStudent.id, code: rosterStudent.code || live?.code, class: officialClass, className: officialClass };
    }).sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"));
  }, [scopeStudents, storedStudents]);
  const classes = useMemo(() => scopeClasses.map(item => item.name), [scopeClasses]);
  useEffect(() => { if (selectedClass && !classes.includes(selectedClass)) { setSelectedClass(""); setSelectedStudent(""); } }, [classes, selectedClass]);
  const classStudents = useMemo(() => students.filter(student => !selectedClass || (student.class || "").trim() === selectedClass), [students, selectedClass]);
  const visible = useMemo(() => classStudents.filter(student => !selectedStudent || student.id === selectedStudent), [classStudents, selectedStudent]);
  const evaluated = useMemo(() => visible.map(student => evaluateStudent(student, activePlan)).filter(student => Boolean(selectedStudent) || student.hasCompletedSection), [visible, activePlan, selectedStudent]);
  const completed = useMemo(() => evaluated.filter(student => student.completion === 100), [evaluated]);
  const mastered = useMemo(() => completed.filter(student => (student.finalScore || 0) >= threshold), [completed, threshold]);
  const support = useMemo(() => completed.filter(student => (student.finalScore || 0) < threshold), [completed, threshold]);
  const incomplete = useMemo(() => evaluated.filter(student => student.completion < 100), [evaluated]);
  const referralCandidates = useMemo(() => students.filter(student => !referralClass || (student.class || "").trim() === referralClass).map(student => evaluateStudent(student, activePlan)), [students, referralClass, activePlan]);
  const selectedStudents = referralCandidates.filter(student => selectedIds.includes(student.id));

  function openReferral() {
    if (!students.length) return setMessage("لا توجد قائمة طلاب متاحة للإحالة في هذه المادة.");
    const initialClass = selectedClass && classes.includes(selectedClass) ? selectedClass : (classes[0] || "");
    setReferralClass(initialClass);
    setSelectedIds([]);
    setReferralType("achievement");
    setReason("انخفاض مستوى التحصيل الدراسي");
    setNotifyParents(false);
    setReferralOpen(true);
  }

  async function sendReferral() {
    if (!referralClass) return setMessage("اختر الفصل أولًا.");
    if (!selectedStudents.length) return setMessage("حدد طالبًا واحدًا على الأقل للإحالة.");
    if (!reason.trim()) return setMessage("اكتب سبب الإحالة.");
    const now = new Date().toISOString();
    await Promise.all(selectedStudents.map(async student => {
      const percentage = student.finalScore ?? student.performance ?? 0;
      await setDoc(doc(db, referralsPath, crypto.randomUUID()), {
        studentId: student.id,
        studentName: student.name || "",
        className: student.class || "",
        percentage,
        reason: reason.trim(),
        referralType,
        referralTypeLabel: referralType === "achievement" ? "مرتبطة بالتحصيل/الإتقان" : "إحالة أخرى",
        status: "جديدة",
        teacherId,
        teacherName,
        subjectId: subjectKey,
        subject,
        explicitTeacherAction: true,
        createdAt: now,
      });
      if (notifyParents) await setDoc(doc(db, studentsPath, student.storageId || student.id), { parentCounselorNoticeCount: increment(1), parentCounselorLastNotice: { title: `إحالة للمرشد من معلم ${subject}`, message: `تمت إحالة الطالب للمتابعة بسبب: ${reason.trim()}.`, percentage, reason: reason.trim(), referralType, className: student.class || "", teacherId, teacherName, subjectId: subjectKey, subject, explicitTeacherAction: true, createdAt: now } }, { merge: true });
    }));
    const text = `السلام عليكم،\nإحالة طلاب للمرشد في مادة ${subject}\nالفصل: ${referralClass}\nنوع الإحالة: ${referralType === "achievement" ? "مرتبطة بالتحصيل/الإتقان" : "إحالة أخرى"}\nالسبب: ${reason.trim()}\n\n${selectedStudents.map((student, index) => `${index + 1}. ${student.name || "—"} — ${student.class || "—"}${student.finalScore !== null ? ` — ${student.finalScore}%` : ""}`).join("\n")}\n\nالمعلم: ${teacherName}`;
    window.open(`https://wa.me/${counselorPhone}?text=${encodeURIComponent(text)}`, "_blank");
    setMessage(`تم تسجيل إحالة ${selectedStudents.length} طالب للمرشد.`);
    setReferralOpen(false);
  }

  async function requestAiInsight() {
    if (!analysisStudent || aiLoading) return;
    const evaluation = evaluateStudent(analysisStudent, activePlan);
    const profile = insightProfile(analysisStudent, activePlan);
    const repeatedNotes = Object.entries(analysisStudent.teacherNoteCounts || {}).filter(([, count]) => Number(count) > 0).map(([type, count]) => ({ label: noteOptions.find(option => option.type === type)?.label || type, count: Number(count) }));
    setAiLoading(true);
    setAiInsight(null);
    try {
      const response = await fetch("/api/teacher/student-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, performance: evaluation.performance, completion: evaluation.completion, missing: evaluation.missing, weakest: { label: profile.weakest.label, value: profile.weakest.value }, strongest: { label: profile.strongest.label, value: profile.strongest.value }, repeatedNotes }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.message || "تعذر تحليل البيانات بالذكاء الاصطناعي.");
      setAiInsight({ analysis: String(data.analysis || ""), recommendedAction: String(data.recommendedAction || ""), suggestedNote: String(data.suggestedNote || "") });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر الاتصال بالذكاء الاصطناعي الآن.");
    } finally {
      setAiLoading(false);
    }
  }

  async function saveNote() {
    if (!noteStudent) return;
    if (!selectedNoteType) return setMessage("اختر نوع الملاحظة أولًا.");
    if (selectedNoteType === "other" && !note.trim()) return setMessage("اكتب نص الملاحظة المخصصة أولًا.");
    const option = noteOptions.find(item => item.type === selectedNoteType);
    if (!option) return;
    const now = new Date().toISOString();
    const previous = Array.isArray(noteStudent.teacherNotes) ? noteStudent.teacherNotes : [];
    const counts = { ...(noteStudent.teacherNoteCounts || {}) };
    counts[selectedNoteType] = Number(counts[selectedNoteType] || 0) + 1;
    const entry: TeacherNoteEntry = { id: crypto.randomUUID(), type: selectedNoteType, label: option.label, message: selectedNoteType === "other" ? note.trim() : "", createdAt: now, teacherName, subject };
    const notes = [entry, ...previous].slice(0, 100);
    const latestText = selectedNoteType === "other" ? note.trim() : option.label;
    await setDoc(doc(db, studentsPath, noteStudent.storageId || noteStudent.id), { teacherNote: latestText, teacherNoteCount: Number(noteStudent.teacherNoteCount || previous.length || 0) + 1, teacherNoteCounts: counts, teacherNotes: notes, teacherLastNoteAt: now }, { merge: true });
    setMessage("تم حفظ الملاحظة وإضافتها إلى سجل الطالب.");
    setNoteStudent(null);
    setSelectedNoteType("");
    setNote("");
  }

  function printMasteryTable() {
    const win = window.open("", "_blank", "width=1100,height=820");
    if (!win) return setMessage("تعذر فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة ثم أعد المحاولة.");
    const escapeHtml = (value: unknown) => String(value ?? "—").replace(/[&<>"\']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "\'": "&#039;" }[char] || char));
    const rows = evaluated.map((student, index) => { const status = statusFor(student, threshold); return `<tr><td>${index + 1}</td><td>${escapeHtml(student.name)}</td><td>${escapeHtml(student.class)}</td><td>${student.finalScore !== null ? `${student.finalScore}%` : `${student.performance}% مبدئي`}</td><td>${student.completion}%</td><td>${escapeHtml(status.label)}</td></tr>`; }).join("");
    win.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير الإتقان والمتابعة</title><style>@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{font-family:Arial,Tahoma,sans-serif;color:#173c63;margin:0;background:#fff}.report-head{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #1768c5;padding:0 0 10px;margin-bottom:10px}.report-head h1{margin:0;color:#124f8c;font-size:22px}.report-head p{margin:4px 0 0;color:#647d95}.badge{background:#1768c5;color:#fff;padding:7px 12px;border-radius:8px;font-weight:700}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin:10px 0 12px}.meta b{padding:8px 9px;background:#eef6ff;border:1px solid #d4e5f6;border-radius:7px;font-size:11px}table{width:100%;border-collapse:collapse;font-size:11px;table-layout:fixed}th,td{border:1px solid #c9d9e8;padding:7px 6px;text-align:center;vertical-align:middle}th{background:#1768c5;color:#fff;font-size:11px}th:nth-child(1){width:5%}th:nth-child(2){width:28%}td:nth-child(2){text-align:right;font-weight:bold}tbody tr:nth-child(even){background:#f4f8fc}.foot{margin-top:9px;display:flex;justify-content:space-between;color:#70869b;font-size:9px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><div class="report-head"><div><h1>تقرير الإتقان والمتابعة</h1><p>بوابة أستاذ لحوني التعليمية</p></div><span class="badge">${escapeHtml(subject)}</span></div><div class="meta"><b>المعلم: ${escapeHtml(teacherName)}</b><b>الفصل: ${escapeHtml(selectedClass || "جميع الفصول")}</b><b>معيار الإتقان: ${threshold}%</b><b>عدد الطلاب: ${evaluated.length}</b></div><table><thead><tr><th>م</th><th>الطالب</th><th>الفصل</th><th>الأداء</th><th>اكتمال الرصد</th><th>الحالة</th></tr></thead><tbody>${rows || `<tr><td colspan="6">لا توجد بيانات في النطاق الحالي.</td></tr>`}</tbody></table><div class="foot"><span>تقرير منظم للطباعة والحفظ بصيغة PDF</span><span>إعداد: ${escapeHtml(teacherName)}</span></div><script>window.onload=()=>setTimeout(()=>window.print(),220)<\/script></body></html>`);
    win.document.close();
  }

  async function copySupportList() {
    if (!support.length) return setMessage("لا توجد قائمة دعم مكتملة الرصد لنسخها.");
    await navigator.clipboard.writeText(support.map((student, index) => `${index + 1}. ${student.name} — ${student.class} — ${student.finalScore}%`).join("\n"));
    setMessage("تم نسخ قائمة الطلاب الذين يحتاجون دعمًا.");
  }

  if (!teacherId) return <main className="follow-page" dir="rtl"><p>جارٍ تجهيز صفحة المتابعة…</p></main>;

  return <main className="follow-page" dir="rtl">
    {!activePlan && <div className="follow-toast" role="status">لم تُعتمد خطة توزيع الدرجات بعد. <a href="/teacher/grade-plan">إعداد التوزيع الآن</a></div>}
    <section className="follow-head">
      <div><span>متابعة التحصيل — {subject}</span><h1>متابعة الإتقان</h1><p>صفحة مختصرة: تفرّق بين الإتقان الحقيقي والرصد غير المكتمل، وتترك التحليل الذكي كإجراء اختياري لكل طالب.</p></div>
      <div className="follow-filters">
        <label>الفصل<select value={selectedClass} onChange={event => { setSelectedClass(event.target.value); setSelectedStudent(""); }}><option value="">جميع الفصول</option>{classes.map(name => <option key={name}>{name}</option>)}</select></label>
        <label>الطالب<select value={selectedStudent} onChange={event => setSelectedStudent(event.target.value)}><option value="">جميع الطلاب</option>{classStudents.map(student => <option key={student.id} value={student.id}>{student.name}</option>)}</select></label>
        <label>معيار الإتقان<select value={threshold} onChange={event => setThreshold(Number(event.target.value))}><option value={80}>٨٠٪</option><option value={75}>٧٥٪</option><option value={70}>٧٠٪</option></select></label>
      </div>
    </section>

    {scopeLoading ? <p className="follow-inline-message">جارٍ تحميل الفصول…</p> : !classes.length ? <p className="follow-inline-message">لا توجد فصول محددة لهذه المادة.</p> : null}

    <section className="follow-overview">
      <article><span>الطلاب</span><strong>{evaluated.length}</strong><small>في النطاق الحالي</small></article>
      <article><span>مكتملو الرصد</span><strong>{completed.length}</strong><small>يمكن الحكم على الإتقان</small></article>
      <article className="mastered"><span>متقنون</span><strong>{mastered.length}</strong><small>حسب معيار {threshold}٪</small></article>
      <article className="support"><span>يحتاجون دعمًا</span><strong>{support.length}</strong><small>بعد اكتمال الرصد</small></article>
      <article className="incomplete"><span>الرصد غير مكتمل</span><strong>{incomplete.length}</strong><small>لا يصدر عليهم حكم نهائي</small></article>
    </section>

    <section className="follow-card students-follow-card">
      <header><div><h2>الطلاب</h2><p>درجة نهائية فقط عند اكتمال الرصد ١٠٠٪. قبل ذلك يظهر الأداء الحالي بوصفه مبدئيًا.</p></div><div className="follow-actions"><button type="button" onClick={printMasteryTable}>PDF / طباعة جدول الإتقان</button><a className="follow-action-link" href="/teacher/follow-up/referrals">سجل الإحالات</a><button onClick={() => void copySupportList()}>نسخ قائمة الدعم</button><button className="counselor-button" onClick={openReferral}>إحالة للمرشد</button></div></header>
      <div className="follow-table-wrap"><table><thead><tr><th>تحديد</th><th>الطالب</th><th>الفصل</th><th>الأداء</th><th>اكتمال الرصد</th><th>الحالة</th><th>الإجراءات</th></tr></thead><tbody>
        {evaluated.map(student => { const status = statusFor(student, threshold); return <tr key={student.id}>
          <td><input type="checkbox" checked={selectedIds.includes(student.id)} onChange={event => setSelectedIds(current => event.target.checked ? [...new Set([...current, student.id])] : current.filter(id => id !== student.id))} /></td>
          <td className="student-name-cell"><b>{student.name || "—"}</b></td><td>{student.class || "—"}</td>
          <td><strong>{student.finalScore !== null ? `${student.finalScore}%` : `${student.performance}% مبدئي`}</strong></td>
          <td><div className="completion"><span><i style={{ width: `${student.completion}%` }} /></span><b>{student.completion}%</b></div></td>
          <td><span className={`level ${status.className}`}>{status.label}</span></td>
          <td><div className="row-actions"><button type="button" className="analysis-btn" onClick={() => { setAnalysisStudent(student); setAiInsight(null); }}>تحليل الطالب</button><button type="button" className="note-btn" onClick={() => { setNoteStudent(student); setSelectedNoteType(""); setNote(""); }}>ملاحظة <small>{Number(student.teacherNoteCount || student.teacherNotes?.length || 0)}</small></button></div></td>
        </tr>; })}
      </tbody></table>{!evaluated.length && <p className="empty">لا توجد بيانات طلاب في النطاق المختار.</p>}</div>
    </section>

    {analysisStudent && (() => { const evaluation = evaluateStudent(analysisStudent, activePlan); const profile = insightProfile(analysisStudent, activePlan); return <div className="follow-modal" onClick={() => setAnalysisStudent(null)}><section className="analysis-modal" onClick={event => event.stopPropagation()}>
      <header><div><small>تحليل اختياري</small><h3>تحليل الطالب بالذكاء الاصطناعي</h3><p>{analysisStudent.name}</p></div><button className="close" onClick={() => setAnalysisStudent(null)}>×</button></header>
      <div className="analysis-facts"><article><span>الأداء الحالي</span><strong>{evaluation.performance}%</strong></article><article><span>اكتمال الرصد</span><strong>{evaluation.completion}%</strong></article><article><span>أضعف محور مرصود</span><strong>{profile.weakest.label} — {profile.weakest.value}%</strong></article></div>
      <p className="ai-note">الذكاء الاصطناعي يحلل المؤشرات المرصودة فقط، ولا يحفظ أو يرسل ملاحظة تلقائيًا. إذا كان الرصد ناقصًا فالتحليل مبدئي.</p>
      <button className="generate-ai" onClick={() => void requestAiInsight()} disabled={aiLoading}>{aiLoading ? "جارٍ التحليل..." : "تحليل البيانات الآن"}</button>
      {aiInsight && <div className="ai-result"><article><span>ملخص التحليل</span><p>{aiInsight.analysis}</p></article><article><span>الخطوة المقترحة للمعلم</span><p>{aiInsight.recommendedAction}</p></article><article><span>صياغة ملاحظة مقترحة</span><p>{aiInsight.suggestedNote}</p><button type="button" onClick={() => { setNoteStudent(analysisStudent); setSelectedNoteType("other"); setNote(aiInsight.suggestedNote); setAnalysisStudent(null); setAiInsight(null); }}>استخدامها كملاحظة مخصصة</button></article></div>}
    </section></div>; })()}

    {noteStudent && <div className="follow-modal" onClick={() => setNoteStudent(null)}><section className="note-modal-card" onClick={event => event.stopPropagation()}>
      <header><div><small>سجل الطالب</small><h3>إضافة ملاحظة</h3><p>{noteStudent.name}</p></div><button className="close" onClick={() => setNoteStudent(null)}>×</button></header>
      <p className="note-visibility">الملاحظة التي تحفظها هنا تظهر في بوابة الطالب وولي الأمر، لذلك كل خيار مكتوب بصياغته النهائية.</p>
      <div className="note-options">{noteOptions.map(option => <label key={option.type} className={selectedNoteType === option.type ? "selected" : ""}><input type="radio" name="student-note" checked={selectedNoteType === option.type} onChange={() => setSelectedNoteType(option.type)} /><div><small>{option.group}</small><b>{option.label}</b><span>{option.description}</span></div><em>{Number(noteStudent.teacherNoteCounts?.[option.type] || 0)} مرة</em></label>)}</div>
      {selectedNoteType === "other" && <label className="custom-note"><span>نص الملاحظة المخصصة</span><textarea value={note} onChange={event => setNote(event.target.value)} placeholder="اكتب الملاحظة كما تريد أن يقرأها الطالب وولي الأمر." /></label>}
      <details className="note-history"><summary>عرض سجل الملاحظات السابقة ({noteStudent.teacherNotes?.length || 0})</summary><div>{(noteStudent.teacherNotes || []).slice(0, 10).map(entry => <article key={entry.id}><b>{entry.type === "other" ? (entry.message || entry.label) : entry.label}</b><small>{new Date(entry.createdAt).toLocaleDateString("ar-SA-u-ca-gregory")} • {entry.subject || subject}</small></article>)}{!(noteStudent.teacherNotes || []).length && <p>لا توجد ملاحظات سابقة.</p>}</div></details>
      <div className="modal-actions"><button onClick={() => setNoteStudent(null)}>إلغاء</button><button className="primary" onClick={() => void saveNote()}>حفظ الملاحظة</button></div>
    </section></div>}

    {referralOpen && <div className="follow-modal" onClick={() => setReferralOpen(false)}><section className="referral-modal" onClick={event => event.stopPropagation()}>
      <header><div><h3>إحالة للمرشد الطلابي</h3><p>اختر الفصل والطالب ونوع الإحالة. يمكن الإحالة حتى بدون رصد درجات.</p></div><button className="close" onClick={() => setReferralOpen(false)}>×</button></header>
      <label className="reason-field">الفصل<select value={referralClass} onChange={event => { setReferralClass(event.target.value); setSelectedIds([]); }}><option value="">اختر الفصل</option>{classes.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
      <label className="reason-field">نوع الإحالة<select value={referralType} onChange={event => { const value = event.target.value as "achievement" | "other"; setReferralType(value); if (value === "achievement") setReason("انخفاض مستوى التحصيل الدراسي"); else setReason(""); }}><option value="achievement">مرتبطة بالتحصيل/الإتقان</option><option value="other">إحالة أخرى</option></select></label>
      <div className="referral-students">{referralCandidates.map(student => <label key={student.id}><input type="checkbox" checked={selectedIds.includes(student.id)} onChange={event => setSelectedIds(current => event.target.checked ? [...new Set([...current, student.id])] : current.filter(id => id !== student.id))} /><span><b>{student.name}</b><small>{student.class}{student.finalScore !== null ? ` • ${student.finalScore}%` : " • بدون رصد مكتمل"}</small></span></label>)}{referralClass && !referralCandidates.length ? <p>لا يوجد طلاب في الفصل المختار.</p> : null}</div>
      <label className="reason-field">سبب الإحالة<textarea value={reason} onChange={event => setReason(event.target.value)} placeholder={referralType === "other" ? "مثال: سلوك، غياب، عدم تفاعل، مشكلة صفية، أو أي سبب يحتاج متابعة" : "اكتب سبب الإحالة"} /></label>
      <label className="parent-notify"><input type="checkbox" checked={notifyParents} onChange={event => setNotifyParents(event.target.checked)} /><span>إبلاغ ولي الأمر في البوابة</span></label>
      <div className="modal-actions"><button onClick={() => setReferralOpen(false)}>إلغاء</button><button className="primary" onClick={() => void sendReferral()}>تسجيل الإحالة وإرسالها</button></div>
    </section></div>}

    {message && <div className="follow-toast" role="status">{message}</div>}
  </main>;
}
