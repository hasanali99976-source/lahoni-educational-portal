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
type Referral = { id:string; studentName?:string; className?:string; referralType?:"mastery"|"achievement"|"other"; referralTypeLabel?:string; reason?:string; status?:string; createdAt?:string };

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
  const closedSections = result.sections.filter((section, index, sections) => section.complete || sections.slice(index + 1).some(next => next.recordedMaximum > 0));
  const latestCompleted = closedSections[closedSections.length - 1];
  return { ...student, points: result.earned, completion: Math.round(result.completion), performance: Math.round(result.percentage), finalScore: result.finalScore === null ? null : Math.round(result.finalScore), missing, masteryScore: latestCompleted ? Math.round(latestCompleted.percentage) : (result.finalScore === null ? null : Math.round(result.finalScore)), masteryBasis: latestCompleted?.label || (result.complete ? "الخطة كاملة" : ""), hasCompletedSection: Boolean(latestCompleted || result.complete) };
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
  if (student.masteryScore === null) return { label: "اختيار المعلم", className: "incomplete" };
  if (student.masteryScore >= threshold) return { label: "متقن", className: "mastered" };
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
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [referralsLoading, setReferralsLoading] = useState(false);
  const [referralView, setReferralView] = useState<"required"|"all"|"mastery"|"other">("required");
  const [printScope, setPrintScope] = useState<"current"|"all">("current");
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

  useEffect(() => {
    if (!subjectKey) { setReferrals([]); return; }
    let active = true;
    const controller = new AbortController();
    setReferralsLoading(true);
    const subjectId = String(subjectKey).split("--")[0];
    fetch(`/api/teacher/counselor-referrals?subjectId=${encodeURIComponent(subjectId)}`, { cache: "no-store", credentials: "same-origin", signal: controller.signal })
      .then(async response => { const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message || "تعذر تحميل سجل الإحالات."); return data; })
      .then(data => { if (active) setReferrals(Array.isArray(data.referrals) ? data.referrals : []); })
      .catch(error => { if (active && error?.name !== "AbortError") setMessage(error instanceof Error ? error.message : "تعذر تحميل سجل الإحالات."); })
      .finally(() => { if (active) setReferralsLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [subjectKey]);

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
  const classClosure = useMemo(() => {
    if (!activePlan || !classStudents.length) return [] as boolean[];
    const results = classStudents.map(student => calculateGradePlanResult(activePlan, student));
    const sectionCount = Math.max(0, ...results.map(result => result.sections.length));
    return Array.from({ length: sectionCount }, (_, index) => {
      const sectionRows = results.map(result => result.sections[index]).filter(Boolean);
      if (!sectionRows.length) return false;
      const fullyRecorded = sectionRows.every(section => section.complete);
      const laterStarted = results.some(result => result.sections.slice(index + 1).some(section => section.recordedMaximum > 0));
      return fullyRecorded || laterStarted;
    });
  }, [activePlan, classStudents]);
  const evaluated = useMemo(() => visible.map(student => {
    const base = evaluateStudent(student, activePlan);
    if (!activePlan) return base;
    const result = calculateGradePlanResult(activePlan, student);
    const closedIndexes = classClosure.map((closed, index) => closed ? index : -1).filter(index => index >= 0);
    const latestClosedIndex = closedIndexes[closedIndexes.length - 1];
    if (latestClosedIndex === undefined) return { ...base, masteryScore: null, masteryBasis: "", hasCompletedSection: false };
    const section = result.sections[latestClosedIndex];
    if (!section) return { ...base, masteryScore: null, masteryBasis: "", hasCompletedSection: false };
    return { ...base, masteryScore: Math.round(section.percentage), masteryBasis: section.label, hasCompletedSection: true };
  }).filter(student => student.hasCompletedSection && (student.masteryScore ?? 100) < threshold), [visible, activePlan, classClosure, threshold]);
  const completed = useMemo(() => evaluated.filter(student => student.masteryScore !== null), [evaluated]);
  const mastered = useMemo(() => completed.filter(student => (student.masteryScore || 0) >= threshold), [completed, threshold]);
  const support = useMemo(() => completed.filter(student => (student.masteryScore || 0) < threshold), [completed, threshold]);
  const incomplete = useMemo(() => evaluated.filter(student => student.masteryScore === null), [evaluated]);
  const referralCandidates = useMemo(() => students.filter(student => !referralClass || (student.class || "").trim() === referralClass).map(student => evaluateStudent(student, activePlan)), [students, referralClass, activePlan]);
  const selectedStudents = referralCandidates.filter(student => selectedIds.includes(student.id));
  const referralMasteryCount = useMemo(() => referrals.filter(row => row.referralType === "mastery" || row.referralType === "achievement").length, [referrals]);
  const referralOtherCount = useMemo(() => referrals.filter(row => row.referralType === "other").length, [referrals]);
  const shownReferrals = useMemo(() => referralView === "all" ? referrals : referralView === "mastery" ? referrals.filter(row => row.referralType === "mastery" || row.referralType === "achievement") : referralView === "other" ? referrals.filter(row => row.referralType === "other") : [], [referrals, referralView]);
  const referralDate = (value?: string) => { if (!value) return "—"; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("ar-SA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(parsed); };


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
    setReferrals(current => [...selectedStudents.map(student => ({ id: crypto.randomUUID(), studentName: student.name || "", className: student.class || "", referralType, referralTypeLabel: referralType === "achievement" ? "مرتبطة بالتحصيل/الإتقان" : "إحالة أخرى", reason: reason.trim(), status: "جديدة", createdAt: now } as Referral)), ...current]);
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
    const win = window.open("", "_blank", "width=900,height=1000");
    if (!win) return setMessage("تعذر فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة ثم أعد المحاولة.");
    const esc = (value: unknown) => String(value ?? "—").replace(/[&<>"']/g, ch => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[ch] || ch));
    const targetClasses = printScope === "current" && selectedClass ? [selectedClass] : classes;
    const buildRows = (className: string) => {
      const classSource = students.filter(row => (row.class || "") === className);
      if (!activePlan || !classSource.length) return [] as EvaluatedStudent[];
      const results = classSource.map(student => calculateGradePlanResult(activePlan, student));
      const sectionCount = Math.max(0, ...results.map(result => result.sections.length));
      const closed = Array.from({ length: sectionCount }, (_, index) => {
        const rows = results.map(result => result.sections[index]).filter(Boolean);
        return rows.length > 0 && (rows.every(row => row.complete) || results.some(row => row.sections.slice(index + 1).some(next => next.recordedMaximum > 0)));
      });
      const closedIndexes = closed.map((value,index) => value ? index : -1).filter(index => index >= 0);
      const last = closedIndexes[closedIndexes.length - 1];
      return classSource.map(student => {
        const base = evaluateStudent(student, activePlan);
        const result = calculateGradePlanResult(activePlan, student);
        const section = last === undefined ? null : result.sections[last];
        return { ...base, masteryScore: section ? Math.round(section.percentage) : null, masteryBasis: section?.label || "", hasCompletedSection: Boolean(section) };
      }).filter(student => student.hasCompletedSection && (student.masteryScore ?? 100) < threshold);
    };
    const date = new Intl.DateTimeFormat("ar-SA",{timeZone:"Asia/Riyadh",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
    const sheets = targetClasses.map((className,index) => {
      const rows = buildRows(className);
      const body = rows.map((student,i) => `<tr><td>${i+1}</td><td class="name">${esc(student.name)}</td><td><b>${student.masteryScore ?? "—"}%</b></td><td>${esc(student.masteryBasis)}</td><td><span>يحتاج دعمًا</span></td></tr>`).join("");
      return `<section class="sheet ${index ? "new-page" : ""}">
        <div class="official-head"><div><small>بوابة أستاذ لحوني التعليمية</small><h1>تقرير الإتقان</h1></div><div class="subject">${esc(subject)}</div></div>
        <div class="meta"><div><small>المعلم</small><b>${esc(teacherName)}</b></div><div><small>الفصل</small><b>${esc(className)}</b></div><div><small>معيار الإتقان</small><b>${threshold}%</b></div><div><small>الطلاب</small><b>${rows.length}</b></div></div>
        <table><thead><tr><th>م</th><th>اسم الطالب</th><th>الإتقان</th><th>الفترة / الوحدة</th><th>الحالة</th></tr></thead><tbody>${body || '<tr><td colspan="5" class="empty-print">لا يوجد طلاب يحتاجون دعمًا.</td></tr>'}</tbody></table>
        <div class="foot"><span>تاريخ التقرير: ${date}</span><span>توقيع المعلم: __________________</span></div>
      </section>`;
    }).join("");
    win.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير الإتقان</title><style>
      @page{size:A4 portrait;margin:7mm}*{box-sizing:border-box}html,body{margin:0;padding:0;font-family:Tahoma,Arial,sans-serif;color:#17324d;background:#fff}
      .sheet{width:100%;height:283mm;overflow:hidden;position:relative}.new-page{break-before:page;page-break-before:always}
      .official-head{height:20mm;display:flex;align-items:center;justify-content:space-between;border:1px solid #b8cce0;border-top:4px solid #1768c5;padding:4mm 5mm}.official-head small{font-size:8.5pt;color:#52708c}.official-head h1{margin:1mm 0 0;font-size:17pt;color:#0f4f91}.subject{padding:2.5mm 4mm;background:#eaf3fd;border:1px solid #c5dbef;border-radius:2mm;font-size:10pt;font-weight:700;color:#0f579f}
      .meta{display:grid;grid-template-columns:repeat(4,1fr);gap:2mm;margin:2.5mm 0}.meta div{border:1px solid #d3e0ec;background:#f7fafe;padding:2.2mm 2.5mm}.meta small{display:block;font-size:7pt;color:#70869a;margin-bottom:.5mm}.meta b{font-size:8.5pt}
      table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:8.2pt}th,td{border:1px solid #c9d7e4;padding:1.65mm 1.5mm;text-align:center;line-height:1.15}th{background:#1768c5;color:#fff;font-size:8pt}th:nth-child(1){width:7%}th:nth-child(2){width:38%}th:nth-child(3){width:13%}th:nth-child(4){width:24%}th:nth-child(5){width:18%}.name{text-align:right;font-weight:700}tbody tr:nth-child(even){background:#f6f9fc}td span{display:inline-block;padding:1mm 2mm;background:#fff0e4;color:#9a4d15;border-radius:20px;font-size:7.5pt}.empty-print{padding:8mm;color:#6d8295}
      .foot{position:absolute;bottom:1mm;right:0;left:0;display:flex;justify-content:space-between;border-top:1px solid #cfdbe7;padding-top:2.5mm;font-size:7.5pt;color:#687f94}
      @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.sheet{break-after:auto}}
    </style></head><body>${sheets}</body></html>`);
    win.document.close(); setTimeout(()=>win.print(),250);
  }

