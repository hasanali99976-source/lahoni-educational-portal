"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, increment, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { tenantCollection } from "../../../lib/teacher-tenant";
import { useTeacherClient } from "../../../lib/teacher-client";
import "./follow-up.css";

type UnitRecord = { attendance?: number; participation?: number; homework?: number; unitExam?: number; total?: number };
type TeacherNoteEntry = { id: string; type: string; label: string; message?: string; createdAt: string; teacherName?: string; subject?: string };
type Student = { id: string; storageId?: string; name?: string; class?: string; className?: string; code?: string; accessCode?: string; studentCode?: string; researchScore?: number; teacherNote?: string; teacherNoteCount?: number; teacherNoteCounts?: Record<string, number>; teacherNotes?: TeacherNoteEntry[]; units?: Record<string, UnitRecord> };
type SchoolClass = { id: string; name: string; grade?: number; section?: string };
type RankedStudent = Student & { total: number; missing: number };
type AiInsight = { analysis: string; recommendedAction: string; suggestedNote: string };
const unitKeys = ["unit1", "unit2", "unit3", "unit4", "unit5"];
const counselorPhone = "966598353651";
const noteOptions = [
  { type: "sleep", category: "سلوك داخل الحصة", label: "نام الطالب أثناء الحصة", description: "تسجيل حالة نوم واضحة أثناء وقت التعلم." },
  { type: "no_interaction", category: "تفاعل صفي", label: "الطالب لم يتفاعل مع أسئلة الحصة", description: "ضعف مشاركة أو استجابة أثناء الشرح والنشاط." },
  { type: "disruptive", category: "سلوك داخل الحصة", label: "الطالب كثير الحديث ويشتت زملاءه", description: "سلوك يؤثر في تركيز الطالب أو زملائه." },
  { type: "participation", category: "تميز إيجابي", label: "الطالب شارك بفاعلية وتميز", description: "مشاركة إيجابية تستحق التعزيز والإشادة." },
  { type: "homework_done", category: "واجبات", label: "الطالب أنجز الواجب المطلوب", description: "تم إنجاز الواجب المطلوب بصورة واضحة." },
  { type: "homework_missing", category: "واجبات", label: "الطالب لم ينجز الواجب", description: "الواجب المطلوب غير منجز ويحتاج متابعة." },
  { type: "attendance_followup", category: "انضباط", label: "الطالب يحتاج متابعة في الانضباط والحضور", description: "مناسبة عند تكرر الغياب أو التأخر أو ضعف الالتزام." },
  { type: "needs_review", category: "تحصيل", label: "الطالب يحتاج مراجعة المهارة", description: "تستخدم عندما تشير الدرجات إلى ضعف في جانب محدد." },
  { type: "improved", category: "تحسن", label: "الطالب أظهر تحسنًا ملحوظًا", description: "لتوثيق التحسن مقارنة بالمستوى السابق." },
  { type: "missing_materials", category: "استعداد", label: "الطالب لم يحضر الكتاب أو الأدوات", description: "نقص في الاستعداد للحصة أو أدوات التعلم." },
  { type: "other", category: "مخصصة", label: "ملاحظة مخصصة", description: "اكتب ملاحظة واضحة بصياغتك؛ سيظهر النص نفسه للطالب وولي الأمر." },
];
function studentTotal(student: Student) { return unitKeys.reduce((sum, key) => { const value = student.units?.[key] || {}; return sum + Number(value.total ?? ((value.attendance || 0) + (value.participation || 0) + (value.homework || 0) + (value.unitExam || 0))); }, 0) + Number(student.researchScore || 0); }
function missingCount(student: Student) { let count = 0; unitKeys.forEach(key => { const value = student.units?.[key] || {}; if (value.attendance === undefined) count++; if (value.participation === undefined) count++; if (value.homework === undefined) count++; if (value.unitExam === undefined) count++; }); if (student.researchScore === undefined) count++; return count; }
function level(total: number) {
  if (total >= 90) return { label: "إتقان متميز", className: "excellent" };
  if (total >= 80) return { label: "متقن", className: "mastered" };
  if (total >= 70) return { label: "قريب من الإتقان", className: "near" };
  if (total >= 60) return { label: "يحتاج تعزيزًا", className: "warning" };
  return { label: "تدخل علاجي", className: "danger" };
}

const masteryDimensions = [
  { key: "attendance", label: "الحضور والانضباط", max: 3 },
  { key: "participation", label: "المشاركة الصفية", max: 4 },
  { key: "homework", label: "الواجبات والتطبيق", max: 2 },
  { key: "unitExam", label: "الاختبارات وفهم المفاهيم", max: 10 },
] as const;

function dimensionScore(student: Student, dimension: (typeof masteryDimensions)[number]) {
  const values = unitKeys.flatMap(unitKey => {
    const unit = student.units?.[unitKey];
    if (!unit || unit[dimension.key] === undefined) return [];
    return [Number(unit[dimension.key] || 0)];
  });
  if (!values.length) return { value: 0, recorded: 0 };
  const value = Math.round(values.reduce((sum, item) => sum + item, 0) / (values.length * dimension.max) * 100);
  return { value: Math.max(0, Math.min(100, value)), recorded: values.length };
}

function smartStudentProfile(student: Student) {
  const total = studentTotal(student);
  const missing = missingCount(student);
  const breakdown = masteryDimensions.map(dimension => ({ ...dimension, ...dimensionScore(student, dimension) }));
  const recorded = breakdown.filter(item => item.recorded > 0);
  const weakest = [...recorded].sort((a, b) => a.value - b.value)[0] || { ...masteryDimensions[3], value: 0, recorded: 0 };
  const strongest = [...recorded].sort((a, b) => b.value - a.value)[0] || { ...masteryDimensions[0], value: 0, recorded: 0 };
  const repeated = Object.entries(student.teacherNoteCounts || {}).sort((a, b) => Number(b[1]) - Number(a[1]))[0];
  const repeatedLabel = repeated ? noteOptions.find(option => option.type === repeated[0])?.label : "";
  const reasonParts: string[] = [];
  if (missing > 0) reasonParts.push(`الرصد غير مكتمل في ${missing} عنصرًا`);
  if (weakest.recorded > 0) reasonParts.push(`أضعف محور: ${weakest.label} (${weakest.value}٪)`);
  if (repeated && Number(repeated[1]) >= 2 && repeatedLabel) reasonParts.push(`تكررت «${repeatedLabel}» ${repeated[1]} مرات`);
  const recommendations: Record<string, string> = {
    attendance: "متابعة الانضباط والحضور يوميًا مع تعزيز الالتزام في بداية الحصة.",
    participation: "استخدم سؤالًا مباشرًا أو نشاطًا ثنائيًا قصيرًا ثم عزز أي استجابة إيجابية.",
    homework: "حدد واجبًا قصيرًا واضحًا مع إعادة المحاولة والتغذية الراجعة في الحصة التالية.",
    unitExam: "ابدأ بمفهوم واحد غير متقن، ثم تقويم قصير وإعادة شرح حسب النتيجة.",
  };
  return {
    total,
    missing,
    weakest,
    strongest,
    reason: reasonParts.join(" • ") || "لا توجد مؤشرات سلبية متكررة في البيانات الحالية.",
    recommendation: recommendations[weakest.key] || "استمر في المتابعة مع تقويم قصير للتحقق من ثبات الإتقان.",
  };
}

function suggestedTeacherNote(student: Student) {
  const profile = smartStudentProfile(student);
  if (profile.total >= 90) return "improved";
  if (profile.weakest.key === "attendance") return "attendance_followup";
  if (profile.weakest.key === "participation") return "no_interaction";
  if (profile.weakest.key === "homework") return "homework_missing";
  return "needs_review";
}
function aliases(student: Student) { return [...new Set([student.id, student.code, student.accessCode, student.studentCode].map(value => String(value || "").trim()).filter(Boolean))]; }

export default function FollowUpPage() {
  const session = useTeacherClient();
  const teacherId = session.teacherId || "", teacherName = session.teacherName || "المعلم", subjectKey = session.subjectKey || "history", subject = session.subject || "المادة", activeGrade = session.activeGrade || null;
  const [storedStudents, setStoredStudents] = useState<Student[]>([]), [scopeStudents, setScopeStudents] = useState<Student[]>([]), [scopeClasses, setScopeClasses] = useState<SchoolClass[]>([]), [scopeLoading, setScopeLoading] = useState(false);
  const [selectedClass, setSelectedClass] = useState(""), [selectedStudent, setSelectedStudent] = useState(""), [threshold, setThreshold] = useState(80);
  const [selectedIds, setSelectedIds] = useState<string[]>([]), [referralOpen, setReferralOpen] = useState(false), [notifyParents, setNotifyParents] = useState(false), [reason, setReason] = useState("انخفاض مستوى التحصيل الدراسي");
  const [noteStudent, setNoteStudent] = useState<Student | null>(null), [selectedNoteTypes, setSelectedNoteTypes] = useState<string[]>([]), [note, setNote] = useState(""), [message, setMessage] = useState("");
  const [aiInsight, setAiInsight] = useState<AiInsight | null>(null), [aiLoading, setAiLoading] = useState(false);
  const studentsPath = useMemo(() => teacherId ? tenantCollection(teacherId, subjectKey as never, "students") : "", [teacherId, subjectKey]);
  const referralsPath = useMemo(() => teacherId ? tenantCollection(teacherId, subjectKey as never, "counselorReferrals") : "", [teacherId, subjectKey]);

  useEffect(() => { if (!studentsPath) return; return onSnapshot(collection(db, studentsPath), snapshot => { const list = snapshot.docs.map(item => ({ id: item.id, ...item.data() })) as Student[]; setStoredStudents(list); }, () => setMessage("تعذر تحميل بيانات الطلاب.")); }, [studentsPath]);

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
        setScopeStudents([]); setScopeClasses([]);
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
      return {
        ...rosterStudent,
        ...(live || {}),
        id: rosterStudent.id,
        storageId: live?.id || rosterStudent.id,
        code: rosterStudent.code || live?.code,
        class: officialClass,
        className: officialClass,
      };
    }).sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"));
  }, [scopeStudents, storedStudents]);
  const classes = useMemo(() => scopeClasses.map(item => item.name), [scopeClasses]);
  useEffect(() => { if (selectedClass && !classes.includes(selectedClass)) { setSelectedClass(""); setSelectedStudent(""); } }, [classes, selectedClass]);
  const classStudents = useMemo(() => students.filter(student => !selectedClass || (student.class || "").trim() === selectedClass), [students, selectedClass]);
  const visible = useMemo(() => classStudents.filter(student => !selectedStudent || student.id === selectedStudent), [classStudents, selectedStudent]);
  const ranked = useMemo<RankedStudent[]>(() => visible.map(student => ({ ...student, total: studentTotal(student), missing: missingCount(student) })).sort((a, b) => b.total - a.total), [visible]);
  const struggling = useMemo(() => ranked.filter(student => student.total < threshold).sort((a, b) => a.total - b.total), [ranked, threshold]);
  const incomplete = ranked.filter(student => student.missing > 0), average = ranked.length ? Math.round(ranked.reduce((sum, student) => sum + student.total, 0) / ranked.length) : 0;
  const referralCandidates = struggling.length ? struggling : ranked;
  const selectedStudents = referralCandidates.filter(student => selectedIds.includes(student.id));
  const masteryRate = ranked.length ? Math.round(ranked.filter(student => student.total >= threshold).length / ranked.length * 100) : 0;
  const dimensionSummary = masteryDimensions.map(dimension => {
    const scores = ranked.map(student => dimensionScore(student, dimension)).filter(item => item.recorded > 0);
    return { ...dimension, value: scores.length ? Math.round(scores.reduce((sum, item) => sum + item.value, 0) / scores.length) : 0, recorded: scores.length };
  });
  const weakestDimension = [...dimensionSummary].filter(item => item.recorded > 0).sort((a, b) => a.value - b.value)[0];
  const firstPriority = struggling[0] ? smartStudentProfile(struggling[0]) : null;

  function openReferral() { setSelectedIds(struggling.map(student => student.id)); setNotifyParents(false); setReferralOpen(true); }
  async function sendReferral() {
    if (!selectedStudents.length) return setMessage("حدد طالبًا واحدًا على الأقل للإحالة.");
    const now = new Date().toISOString();
    await Promise.all(selectedStudents.map(async student => {
      await setDoc(doc(db, referralsPath, crypto.randomUUID()), { studentId: student.id, studentName: student.name || "", className: student.class || "", percentage: student.total, reason, status: "جديدة", teacherName, subject, createdAt: now });
      if (notifyParents) await updateDoc(doc(db, studentsPath, student.storageId || student.id), { parentCounselorNoticeCount: increment(1), parentCounselorLastNotice: { title: `إحالة للمرشد من معلم ${subject}`, message: `تمت إحالة الطالب للمتابعة بسبب: ${reason}. المستوى الحالي ${student.total}%.`, percentage: student.total, createdAt: now } });
    }));
    const text = `السلام عليكم،\
إحالة طلاب للمرشد في مادة ${subject}\
السبب: ${reason}\
\
${selectedStudents.map((student, index) => `${index + 1}. ${student.name || "—"} — ${student.class || "—"} — ${student.total}%`).join("\
")}\
\
المعلم: ${teacherName}`;
    window.open(`https://wa.me/${counselorPhone}?text=${encodeURIComponent(text)}`, "_blank");
    setMessage(`تم تسجيل إحالة ${selectedStudents.length} طالب للمرشد.`); setReferralOpen(false);
  }
  async function requestAiInsight() {
    if (!noteStudent || aiLoading) return;
    const smart = smartStudentProfile(noteStudent);
    const repeatedNotes = Object.entries(noteStudent.teacherNoteCounts || {})
      .filter(([, count]) => Number(count) > 0)
      .map(([type, count]) => ({ label: noteOptions.find(option => option.type === type)?.label || type, count: Number(count) }));
    setAiLoading(true);
    setAiInsight(null);
    try {
      const response = await fetch("/api/teacher/student-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          total: smart.total,
          missing: smart.missing,
          weakest: { label: smart.weakest.label, value: smart.weakest.value },
          strongest: { label: smart.strongest.label, value: smart.strongest.value },
          repeatedNotes,
        }),
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
    if (!selectedNoteTypes.length) return setMessage("اختر ملاحظة واحدة على الأقل.");
    const now = new Date().toISOString();
    const previous = Array.isArray(noteStudent.teacherNotes) ? noteStudent.teacherNotes : [];
    const counts = { ...(noteStudent.teacherNoteCounts || {}) };
    const entries = selectedNoteTypes.map(type => {
      const option = noteOptions.find(item => item.type === type)!;
      counts[type] = Number(counts[type] || 0) + 1;
      return { id: crypto.randomUUID(), type, label: option.label, message: type === "other" ? note.trim() : "", createdAt: now, teacherName, subject } as TeacherNoteEntry;
    });
    const notes = [...entries, ...previous].slice(0, 100);
    const latestText = entries.map(entry => entry.type === "other" ? (entry.message || entry.label) : entry.message ? `${entry.label}: ${entry.message}` : entry.label).join(" • ");
    await setDoc(doc(db, studentsPath, noteStudent.storageId || noteStudent.id), {
      teacherNote: latestText,
      teacherNoteCount: Number(noteStudent.teacherNoteCount || previous.length || 0) + entries.length,
      teacherNoteCounts: counts,
      teacherNotes: notes,
      teacherLastNoteAt: now,
    }, { merge: true });
    setMessage(`تم حفظ ${entries.length} ملاحظة للطالب وإضافتها إلى السجل.`);
    setNoteStudent(null); setSelectedNoteTypes([]); setNote("");
  }
  async function copyList() { await navigator.clipboard.writeText(struggling.map((student, index) => `${index + 1}. ${student.name} — ${student.class} — ${student.total}%`).join("\
")); setMessage("تم نسخ قائمة الطلاب المتعثرين."); }

  if (!teacherId) return <main className="follow-page" dir="rtl"><p>جارٍ تجهيز صفحة المتابعة…</p></main>;
  return <main className="follow-page" dir="rtl">
    <section className="follow-head"><div><span>متابعة التحصيل — {subject}</span><h1>الإتقان والمتابعة الذكية</h1><p>قراءة أوضح لدرجة الإتقان، سبب التعثر، تكرار الملاحظات، والإجراء الأنسب لكل طالب.</p></div><div className="follow-filters"><label>الفصل<select value={selectedClass} onChange={event => { setSelectedClass(event.target.value); setSelectedStudent(""); }}><option value="">جميع الفصول</option>{classes.map(name => <option key={name}>{name}</option>)}</select></label><label>الطالب<select value={selectedStudent} onChange={event => setSelectedStudent(event.target.value)}><option value="">جميع الطلاب</option>{classStudents.map(student => <option key={student.id} value={student.id}>{student.name}</option>)}</select></label><label>معيار الإتقان<select value={threshold} onChange={event => setThreshold(Number(event.target.value))}><option value={80}>٨٠٪</option><option value={75}>٧٥٪</option><option value={70}>٧٠٪</option></select></label></div></section>
    {scopeLoading ? <p className="follow-toast" role="status">جارٍ تحميل الفصول المحددة من إدارة الفصول…</p> : !classes.length ? <p className="follow-toast" role="status">لا توجد فصول محددة لهذه المادة. افتح «إدارة الطلاب ← إدارة فصولي» وحدد الفصول أولًا.</p> : null}
    <section className="follow-overview"><article><span>الطلاب المعروضون</span><strong>{ranked.length}</strong><small>في النطاق الحالي</small></article><article className="mastery"><span>نسبة الإتقان</span><strong>{masteryRate}%</strong><small>حسب معيار {threshold}%</small></article><article><span>متوسط الأداء</span><strong>{average}%</strong><small>من إجمالي الرصد</small></article><article className="warn"><span>يحتاجون متابعة</span><strong>{struggling.length}</strong><small>تحت معيار الإتقان</small></article><article className="alert"><span>ناقصو الرصد</span><strong>{incomplete.length}</strong><small>الحكم غير مكتمل</small></article></section>
    <section className="follow-smart-panel"><header><div><span>✦ تحليل ذكي مبني على بيانات الفصل</span><h2>ما الذي يحتاج انتباه المعلم الآن؟</h2></div><button type="button" onClick={() => { window.location.href = "/teacher/ai"; }}>فتح المساعد الذكي</button></header><div className="follow-smart-grid"><article><small>أضعف محور حاليًا</small><strong>{weakestDimension ? `${weakestDimension.label} — ${weakestDimension.value}%` : "بانتظار اكتمال الرصد"}</strong><p>يتم الحساب من درجات الطلاب المرصودة فعليًا، وليس من انطباع عام.</p></article><article><small>أولوية التدخل</small><strong>{struggling[0]?.name || "لا توجد أولوية حرجة"}</strong><p>{firstPriority?.reason || "الطلاب في النطاق الحالي ضمن مستوى الإتقان أو لم يكتمل الرصد بعد."}</p></article><article><small>الإجراء المقترح</small><strong>{firstPriority ? firstPriority.weakest.label : "متابعة دورية"}</strong><p>{firstPriority?.recommendation || "استمر في التقويم القصير وتوثيق التحسن والملاحظات الإيجابية."}</p></article></div></section>
    <section className="follow-rank-grid"><article className="follow-card leaders-card"><header><div><small>تميز</small><h2>أفضل الطلاب</h2><p>أعلى النتائج في النطاق المختار.</p></div><b className="rank-icon">★</b></header><div className="rank-list">{ranked.slice(0, 5).map((student, index) => <div key={student.id}><i>{index + 1}</i><span><b>{student.name || "—"}</b><small>{student.class || "بدون فصل"}</small></span><strong>{student.total}%</strong></div>)}{!ranked.length && <p>لا توجد بيانات في هذا النطاق.</p>}</div></article>
      <article className="follow-card support-card"><header><div><small>تدخل مبكر</small><h2>الطلاب الأكثر حاجة للدعم</h2><p>الأقل نتيجة أولًا لاتخاذ الإجراء سريعًا.</p></div><b className="rank-icon">!</b></header><div className="rank-list">{struggling.slice(0, 5).map((student, index) => <div key={student.id}><i>{index + 1}</i><span><b>{student.name || "—"}</b><small>{student.class || "بدون فصل"}</small></span><strong>{student.total}%</strong></div>)}{!struggling.length && <p>لا يوجد طلاب تحت معيار الإتقان.</p>}</div></article></section>
    <section className="follow-card students-follow-card"><header><div><h2>قائمة المتابعة والإجراءات</h2><p>{selectedClass || "جميع الفصول"} • جميع الطلاب • يظهر عدد الملاحظات لكل طالب</p></div><div className="follow-actions"><button onClick={copyList}>نسخ القائمة</button><button className="counselor-button" onClick={openReferral}>إحالة للمرشد</button><button onClick={() => window.print()}>طباعة</button></div></header><div className="follow-table-wrap"><table><thead><tr><th>تحديد</th><th>الطالب</th><th>الفصل</th><th>درجة الإتقان</th><th>الحالة</th><th>القراءة الذكية</th><th>الملاحظات</th></tr></thead><tbody>{ranked.map(student => { const status = level(student.total); const totalNotes = Number(student.teacherNoteCount || student.teacherNotes?.length || 0); const smart = smartStudentProfile(student); return <tr key={student.id}><td><input type="checkbox" checked={selectedIds.includes(student.id)} onChange={event => setSelectedIds(current => event.target.checked ? [...new Set([...current, student.id])] : current.filter(id => id !== student.id))} /></td><td><b>{student.name || "—"}</b></td><td>{student.class || "—"}</td><td><div className="mastery-score"><strong>{student.total}%</strong><span><i style={{ width: `${Math.min(100, Math.max(0, student.total))}%` }} /></span></div></td><td><span className={`level ${status.className}`}>{status.label}</span></td><td className="follow-reason-cell"><b>{smart.reason}</b><small>{smart.recommendation}</small></td><td><div className="student-note-actions"><button className="note-btn" onClick={() => { setNoteStudent(student); setSelectedNoteTypes([]); setNote(""); setAiInsight(null); }}>ملاحظات الطالب</button><span className="note-total">{totalNotes} ملاحظة</span></div></td></tr>; })}</tbody></table>{!ranked.length && <p className="empty">لا توجد بيانات طلاب في النطاق المختار.</p>}</div></section>
    {referralOpen && <div className="report-modal" onClick={() => setReferralOpen(false)}><section onClick={event => event.stopPropagation()}><header><div><h3>إحالة للمرشد الطلابي</h3><p>حدد طالبًا أو مجموعة طلاب، ثم سجل الإحالة.</p></div><button onClick={() => setReferralOpen(false)}>×</button></header><div className="referral-tools"><button onClick={() => setSelectedIds(referralCandidates.map(student => student.id))}>تحديد الكل</button><button onClick={() => setSelectedIds([])}>إلغاء التحديد</button></div><div className="referral-students">{referralCandidates.map(student => <label key={student.id}><input type="checkbox" checked={selectedIds.includes(student.id)} onChange={event => setSelectedIds(current => event.target.checked ? [...new Set([...current, student.id])] : current.filter(id => id !== student.id))} /><span><b>{student.name}</b><small>{student.class} • {student.total}%</small></span></label>)}</div><label className="reason-field">سبب الإحالة<textarea value={reason} onChange={event => setReason(event.target.value)} /></label><label className="parent-notify-option"><input type="checkbox" checked={notifyParents} onChange={event => setNotifyParents(event.target.checked)} /><span><b>إبلاغ ولي الأمر في بوابة الطالب وولي الأمر</b></span></label><div className="report-modal-actions"><button onClick={() => setReferralOpen(false)}>إلغاء</button><button className="primary" onClick={sendReferral}>تسجيل الإحالة وإرسالها</button></div></section></div>}
    {noteStudent && (() => { const smart = smartStudentProfile(noteStudent); const suggestedType = suggestedTeacherNote(noteStudent); return <div className="note-modal" onClick={() => setNoteStudent(null)}><section className="note-modal-card" onClick={event => event.stopPropagation()}><header className="note-modal-title"><div><small>سجل واضح ومباشر</small><h3>ملاحظات الطالب</h3><p className="note-student-name">{noteStudent.name}</p></div><span className={`level ${level(smart.total).className}`}>{level(smart.total).label} — {smart.total}%</span></header><div className="note-ai-card"><div className="note-ai-head"><span>✦</span><div><small>قراءة ذكية قبل كتابة الملاحظة</small><strong>{smart.reason}</strong></div></div><p>{smart.recommendation}</p><div className="note-ai-actions"><button type="button" className="note-ai-suggest" onClick={() => { setSelectedNoteTypes(current => current.includes(suggestedType) ? current : [...current, suggestedType]); }}>اقتراح سريع من بيانات الطالب</button><button type="button" className="note-ai-generate" onClick={() => void requestAiInsight()} disabled={aiLoading}>{aiLoading ? "جاري تحليل البيانات بالذكاء الاصطناعي..." : "✦ تحليل وصياغة بالذكاء الاصطناعي"}</button></div>{aiInsight && <div className="note-ai-result"><div><small>تحليل AI</small><strong>{aiInsight.analysis}</strong></div><div><small>الإجراء المقترح</small><p>{aiInsight.recommendedAction}</p></div><div className="note-ai-ready"><small>ملاحظة جاهزة للطالب وولي الأمر</small><p>{aiInsight.suggestedNote}</p><button type="button" onClick={() => { setSelectedNoteTypes(current => current.includes("other") ? current : [...current, "other"]); setNote(aiInsight.suggestedNote); }}>استخدام هذه الصياغة كملاحظة مخصصة</button></div></div>}</div><div className="note-stats"><strong>{Number(noteStudent.teacherNoteCount || noteStudent.teacherNotes?.length || 0)}</strong><span>إجمالي الملاحظات السابقة — يظهر بجانب كل خيار عدد مرات تكراره</span></div><div className="note-options">{noteOptions.map(option => <label key={option.type} className={selectedNoteTypes.includes(option.type) ? "selected" : ""}><input type="checkbox" checked={selectedNoteTypes.includes(option.type)} onChange={event => setSelectedNoteTypes(current => event.target.checked ? [...current, option.type] : current.filter(type => type !== option.type))} /><div className="note-option-copy"><small>{option.category}</small><span>{option.label}</span><em>{option.description}</em></div><b>{Number(noteStudent.teacherNoteCounts?.[option.type] || 0)} مرة</b></label>)}</div>{selectedNoteTypes.includes("other") && <label className="other-note-wrap"><span>نص الملاحظة التي ستظهر للطالب وولي الأمر</span><textarea className="other-note" placeholder="مثال: يحتاج الطالب إلى التركيز عند قراءة السؤال كاملًا قبل الإجابة." value={note} onChange={event => setNote(event.target.value)} /><small>في بوابة الطالب سيظهر هذا النص فقط، ولن تظهر عبارة «ملاحظة مخصصة».</small></label>}<div className="note-history"><h4>سجل الملاحظات السابقة</h4>{(noteStudent.teacherNotes || []).slice(0, 8).map(entry => <article key={entry.id}>{entry.type === "other" ? <b>{entry.message || "ملاحظة مخصصة"}</b> : <><b>{entry.label}</b>{entry.message && <p>{entry.message}</p>}</>}<small>{new Date(entry.createdAt).toLocaleDateString("ar-SA-u-ca-gregory")} • {entry.subject || subject}</small></article>)}{!(noteStudent.teacherNotes || []).length && <p className="empty-note-history">لا توجد ملاحظات سابقة.</p>}</div><div className="note-modal-actions"><button onClick={() => setNoteStudent(null)}>إلغاء</button><button className="primary" onClick={saveNote}>حفظ الملاحظات</button></div></section></div>; })()}
    {message && <div className="follow-toast" role="status">{message}</div>}
  </main>;
}
