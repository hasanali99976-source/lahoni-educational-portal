"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, increment, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { tenantCollection } from "../../../lib/teacher-tenant";
import { useTeacherClient } from "../../../lib/teacher-client";
import "./follow-up.css";

type UnitRecord = { attendance?: number; participation?: number; homework?: number; unitExam?: number; total?: number };
type TeacherNoteEntry = { id: string; type: string; label: string; message?: string; createdAt: string; teacherName?: string; subject?: string };
type Student = { id: string; storageId?: string; name?: string; class?: string; className?: string; code?: string; accessCode?: string; studentCode?: string; researchScore?: number; teacherNote?: string; teacherNoteCount?: number; teacherNoteCounts?: Record<string, number>; teacherNotes?: TeacherNoteEntry[]; units?: Record<string, UnitRecord> };
type SchoolClass = { id: string; name: string; grade?: number; section?: string };
type AiInsight = { analysis: string; recommendedAction: string; suggestedNote: string };
type EvaluatedStudent = Student & { points: number; completion: number; performance: number; finalScore: number | null; missing: number };

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

function evaluateStudent(student: Student): EvaluatedStudent {
  let points = 0;
  let recordedMax = 0;
  let missing = 0;
  unitKeys.forEach(unitKey => {
    const unit = student.units?.[unitKey];
    (Object.keys(componentMax) as Array<keyof typeof componentMax>).forEach(key => {
      const raw = unit?.[key];
      const value = Number(raw);
      if (raw === undefined || raw === null || !Number.isFinite(value)) {
        missing += 1;
        return;
      }
      const maximum = componentMax[key];
      points += Math.max(0, Math.min(maximum, value));
      recordedMax += maximum;
    });
  });
  const research = Number(student.researchScore);
  if (student.researchScore === undefined || student.researchScore === null || !Number.isFinite(research)) {
    missing += 1;
  } else {
    points += Math.max(0, Math.min(researchMax, research));
    recordedMax += researchMax;
  }
  const completion = Math.round(recordedMax);
  const performance = recordedMax ? Math.round((points / recordedMax) * 100) : 0;
  return { ...student, points: Math.round(points * 10) / 10, completion, performance, finalScore: recordedMax === 100 ? Math.round(points) : null, missing };
}

function dimensionScore(student: Student, key: keyof typeof componentMax) {
  const values = unitKeys.flatMap(unitKey => {
    const raw = student.units?.[unitKey]?.[key];
    const value = Number(raw);
    return raw === undefined || raw === null || !Number.isFinite(value) ? [] : [Math.max(0, Math.min(componentMax[key], value))];
  });
  if (!values.length) return { value: 0, recorded: 0 };
  return { value: Math.round(values.reduce((sum, value) => sum + value, 0) / (values.length * componentMax[key]) * 100), recorded: values.length };
}

function insightProfile(student: Student) {
  const labels: Record<keyof typeof componentMax, string> = {
    attendance: "الحضور والانضباط",
    participation: "المشاركة الصفية",
    homework: "الواجبات",
    unitExam: "اختبارات الوحدات",
  };
  const dimensions = (Object.keys(componentMax) as Array<keyof typeof componentMax>)
    .map(key => ({ key, label: labels[key], ...dimensionScore(student, key) }))
    .filter(item => item.recorded > 0);
  const weakest = [...dimensions].sort((a, b) => a.value - b.value)[0] || { key: "unitExam" as const, label: "لا يوجد رصد كافٍ", value: 0, recorded: 0 };
  const strongest = [...dimensions].sort((a, b) => b.value - a.value)[0] || { key: "participation" as const, label: "لا يوجد رصد كافٍ", value: 0, recorded: 0 };
  return { weakest, strongest };
}

function statusFor(student: EvaluatedStudent, threshold: number) {
  if (student.completion < 100) return { label: "الرصد غير مكتمل", className: "incomplete" };
  if ((student.finalScore || 0) >= threshold) return { label: "متقن", className: "mastered" };
  return { label: "يحتاج دعمًا", className: "support" };
}

export default function FollowUpPage() {
  const session = useTeacherClient();
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
    if (!studentsPath) return;
    return onSnapshot(collection(db, studentsPath), snapshot => {
      setStoredStudents(snapshot.docs.map(item => ({ id: item.id, ...item.data() })) as Student[]);
    }, () => setMessage("تعذر تحميل بيانات الطلاب."));
  }, [studentsPath]);

  useEffect(() => {
    if (!teacherId || !subjectKey || !activeGrade) { setScopeStudents([]); setScopeClasses([]); return; }
    const controller = new AbortController();
    const params = new URLSearchParams({ subjectId: subjectKey, grade: String(activeGrade) });
    setScopeLoading(true);
    fetch(`/api/teacher/students?${params.toString()}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "تعذر تحميل الفصول المحددة.");
        setScopeStudents(Array.isArray(data.students) ? data.students : []);
        setScopeClasses(Array.isArray(data.classes) ? data.classes : []);
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setMessage(error instanceof Error ? error.message : "تعذر تحميل الفصول المحددة.");
      })
      .finally(() => setScopeLoading(false));
    return () => controller.abort();
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
  const evaluated = useMemo(() => visible.map(evaluateStudent), [visible]);
  const completed = useMemo(() => evaluated.filter(student => student.completion === 100), [evaluated]);
  const mastered = useMemo(() => completed.filter(student => (student.finalScore || 0) >= threshold), [completed, threshold]);
  const support = useMemo(() => completed.filter(student => (student.finalScore || 0) < threshold), [completed, threshold]);
  const incomplete = useMemo(() => evaluated.filter(student => student.completion < 100), [evaluated]);
  const referralCandidates = support;
  const selectedStudents = referralCandidates.filter(student => selectedIds.includes(student.id));

  function openReferral() {
    if (!support.length) return setMessage("لا يوجد طلاب مكتملو الرصد تحت معيار الإتقان حاليًا.");
    setSelectedIds(support.map(student => student.id));
    setNotifyParents(false);
    setReferralOpen(true);
  }

  async function sendReferral() {
    if (!selectedStudents.length) return setMessage("حدد طالبًا واحدًا على الأقل للإحالة.");
    const now = new Date().toISOString();
    await Promise.all(selectedStudents.map(async student => {
      const percentage = student.finalScore || 0;
      await setDoc(doc(db, referralsPath, crypto.randomUUID()), { studentId: student.id, studentName: student.name || "", className: student.class || "", percentage, reason, status: "جديدة", teacherName, subject, createdAt: now });
      if (notifyParents) await setDoc(doc(db, studentsPath, student.storageId || student.id), { parentCounselorNoticeCount: increment(1), parentCounselorLastNotice: { title: `إحالة للمرشد من معلم ${subject}`, message: `تمت إحالة الطالب للمتابعة بسبب: ${reason}. مستوى الإتقان بعد اكتمال الرصد ${percentage}%.`, percentage, createdAt: now } }, { merge: true });
    }));
    const text = `السلام عليكم،\nإحالة طلاب للمرشد في مادة ${subject}\nالسبب: ${reason}\n\n${selectedStudents.map((student, index) => `${index + 1}. ${student.name || "—"} — ${student.class || "—"} — ${student.finalScore || 0}%`).join("\n")}\n\nالمعلم: ${teacherName}`;
    window.open(`https://wa.me/${counselorPhone}?text=${encodeURIComponent(text)}`, "_blank");
    setMessage(`تم تسجيل إحالة ${selectedStudents.length} طالب للمرشد.`);
    setReferralOpen(false);
  }

  async function requestAiInsight() {
    if (!analysisStudent || aiLoading) return;
    const evaluation = evaluateStudent(analysisStudent);
    const profile = insightProfile(analysisStudent);
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

  async function copySupportList() {
    if (!support.length) return setMessage("لا توجد قائمة دعم مكتملة الرصد لنسخها.");
    await navigator.clipboard.writeText(support.map((student, index) => `${index + 1}. ${student.name} — ${student.class} — ${student.finalScore}%`).join("\n"));
    setMessage("تم نسخ قائمة الطلاب الذين يحتاجون دعمًا.");
  }

  if (!teacherId) return <main className="follow-page" dir="rtl"><p>جارٍ تجهيز صفحة المتابعة…</p></main>;

  return <main className="follow-page" dir="rtl">
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
      <header><div><h2>الطلاب</h2><p>درجة نهائية فقط عند اكتمال الرصد ١٠٠٪. قبل ذلك يظهر الأداء الحالي بوصفه مبدئيًا.</p></div><div className="follow-actions"><button onClick={() => void copySupportList()}>نسخ قائمة الدعم</button><button className="counselor-button" onClick={openReferral}>إحالة للمرشد</button></div></header>
      <div className="follow-table-wrap"><table><thead><tr><th>تحديد</th><th>الطالب</th><th>الفصل</th><th>الأداء</th><th>اكتمال الرصد</th><th>الحالة</th><th>الإجراءات</th></tr></thead><tbody>
        {evaluated.map(student => { const status = statusFor(student, threshold); return <tr key={student.id}>
          <td><input type="checkbox" disabled={status.className !== "support"} checked={selectedIds.includes(student.id)} onChange={event => setSelectedIds(current => event.target.checked ? [...new Set([...current, student.id])] : current.filter(id => id !== student.id))} /></td>
          <td className="student-name-cell"><b>{student.name || "—"}</b></td><td>{student.class || "—"}</td>
          <td><strong>{student.finalScore !== null ? `${student.finalScore}%` : `${student.performance}% مبدئي`}</strong></td>
          <td><div className="completion"><span><i style={{ width: `${student.completion}%` }} /></span><b>{student.completion}%</b></div></td>
          <td><span className={`level ${status.className}`}>{status.label}</span></td>
          <td><div className="row-actions"><button type="button" className="analysis-btn" onClick={() => { setAnalysisStudent(student); setAiInsight(null); }}>تحليل الطالب</button><button type="button" className="note-btn" onClick={() => { setNoteStudent(student); setSelectedNoteType(""); setNote(""); }}>ملاحظة <small>{Number(student.teacherNoteCount || student.teacherNotes?.length || 0)}</small></button></div></td>
        </tr>; })}
      </tbody></table>{!evaluated.length && <p className="empty">لا توجد بيانات طلاب في النطاق المختار.</p>}</div>
    </section>

    {analysisStudent && (() => { const evaluation = evaluateStudent(analysisStudent); const profile = insightProfile(analysisStudent); return <div className="follow-modal" onClick={() => setAnalysisStudent(null)}><section className="analysis-modal" onClick={event => event.stopPropagation()}>
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

    {referralOpen && <div className="follow-modal" onClick={() => setReferralOpen(false)}><section className="referral-modal" onClick={event => event.stopPropagation()}><header><div><h3>إحالة للمرشد الطلابي</h3><p>تعرض هنا فقط الحالات مكتملة الرصد وتحت معيار الإتقان.</p></div><button className="close" onClick={() => setReferralOpen(false)}>×</button></header><div className="referral-students">{referralCandidates.map(student => <label key={student.id}><input type="checkbox" checked={selectedIds.includes(student.id)} onChange={event => setSelectedIds(current => event.target.checked ? [...new Set([...current, student.id])] : current.filter(id => id !== student.id))} /><span><b>{student.name}</b><small>{student.class} • {student.finalScore}%</small></span></label>)}</div><label className="reason-field">سبب الإحالة<textarea value={reason} onChange={event => setReason(event.target.value)} /></label><label className="parent-notify"><input type="checkbox" checked={notifyParents} onChange={event => setNotifyParents(event.target.checked)} /><span>إبلاغ ولي الأمر في البوابة</span></label><div className="modal-actions"><button onClick={() => setReferralOpen(false)}>إلغاء</button><button className="primary" onClick={() => void sendReferral()}>تسجيل الإحالة وإرسالها</button></div></section></div>}

    {message && <div className="follow-toast" role="status">{message}</div>}
  </main>;
}
