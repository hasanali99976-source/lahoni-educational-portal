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
    const win=window.open("","_blank","width=900,height=1000"); if(!win)return setMessage("تعذر فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة ثم أعد المحاولة.");
    const esc=(value:unknown)=>String(value??"—").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch]||ch));
    const targetClasses=printScope==="all"?classes:(selectedClass?[selectedClass]:classes);
    const buildRows=(className:string)=>{const classSource=students.filter(row=>(row.class||"")===className);if(!activePlan||!classSource.length)return [] as EvaluatedStudent[];const results=classSource.map(student=>calculateGradePlanResult(activePlan,student));const count=Math.max(0,...results.map(result=>result.sections.length));const closed=Array.from({length:count},(_,idx)=>{const rows=results.map(result=>result.sections[idx]).filter(Boolean);return rows.length>0&&(rows.every(row=>row.complete)||results.some(row=>row.sections.slice(idx+1).some(next=>next.recordedMaximum>0)));});const last=closed.map((value,idx)=>value?idx:-1).filter(idx=>idx>=0).at(-1);return classSource.map(student=>{const base=evaluateStudent(student,activePlan);const result=calculateGradePlanResult(activePlan,student);const section=last===undefined?null:result.sections[last];return {...base,masteryScore:section?Math.round(section.percentage):null,masteryBasis:section?.label||"",hasCompletedSection:Boolean(section)};}).filter(student=>student.hasCompletedSection&&(student.masteryScore??100)<threshold);};
    const date=new Intl.DateTimeFormat("ar-SA",{timeZone:"Asia/Riyadh",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
    const pages=targetClasses.map((className,pageIndex)=>{const rows=buildRows(className);const body=rows.map((student,index)=>`<tr><td>${index+1}</td><td class="name">${esc(student.name)}</td><td><b>${student.masteryScore??"—"}%</b></td><td>${esc(student.masteryBasis)}</td><td>يحتاج دعمًا</td></tr>`).join("");return `<section class="sheet ${pageIndex?"new-page":""}"><header><div><small>بوابة أستاذ لحوني التعليمية</small><h1>تقرير الإتقان</h1></div><strong>${esc(subject)}</strong></header><div class="meta"><span>المعلم<b>${esc(teacherName)}</b></span><span>الفصل<b>${esc(className)}</b></span><span>معيار الإتقان<b>${threshold}%</b></span><span>العدد<b>${rows.length}</b></span></div><table><thead><tr><th>م</th><th>اسم الطالب</th><th>الإتقان</th><th>الفترة / الوحدة</th><th>الحالة</th></tr></thead><tbody>${body||'<tr><td colspan="5" class="empty">لا يوجد طلاب يحتاجون دعمًا.</td></tr>'}</tbody></table><footer><span>تاريخ التقرير: ${date}</span><span>توقيع المعلم: __________________</span></footer></section>`;}).join("");
    win.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير الإتقان</title><style>@page{size:A4 portrait;margin:8mm}*{box-sizing:border-box}body{margin:0;font-family:Tahoma,Arial,sans-serif;color:#17324d}.sheet{height:275mm;position:relative;overflow:hidden;padding-bottom:12mm;page-break-inside:avoid}.new-page{page-break-before:always}header{display:flex;align-items:center;justify-content:space-between;border:1px solid #bdd0e2;border-top:5px solid #1768c5;padding:9px 11px}header small{font-size:9px;color:#607d98}header h1{margin:2px 0 0;color:#124d87;font-size:19px}header>strong{background:#edf5fd;color:#155da8;border:1px solid #c9ddf0;padding:7px 11px;border-radius:7px}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin:6px 0}.meta span{display:flex;flex-direction:column;gap:2px;border:1px solid #d8e4ef;background:#f8fbfe;padding:6px 8px;font-size:8px;color:#71869a}.meta b{font-size:10px;color:#183f64}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:8.5px}th,td{border:1px solid #cad8e5;padding:4px;text-align:center;line-height:1.15}th{background:#1768c5;color:#fff}th:nth-child(1){width:7%}th:nth-child(2){width:39%}th:nth-child(3){width:13%}th:nth-child(4){width:24%}th:nth-child(5){width:17%}.name{text-align:right;font-weight:700}tbody tr:nth-child(even){background:#f6f9fc}.empty{padding:18px;color:#6d8295}footer{position:absolute;bottom:2mm;right:0;left:0;display:flex;justify-content:space-between;border-top:1px solid #d4e0ea;padding-top:6px;font-size:8px;color:#708397}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>${pages}</body></html>`);win.document.close();setTimeout(()=>win.print(),250);
  }

  function printReferrals() {
    const win = window.open("", "_blank", "width=1200,height=850");
    if (!win) return setMessage("تعذر فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة ثم أعد المحاولة.");
    const esc = (value: unknown) => String(value ?? "—").replace(/[&<>"']/g, ch => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[ch] || ch));
    const label = referralView === "all" ? "جميع الإحالات" : referralView === "mastery" ? "إحالات الإتقان والتحصيل" : "الإحالات الأخرى";
    const body = shownReferrals.map((row,index) => `<tr><td>${index+1}</td><td>${esc(row.studentName)}</td><td>${esc(row.className)}</td><td>${esc(row.referralTypeLabel || (row.referralType === "other" ? "إحالة أخرى" : "الإتقان والتحصيل"))}</td><td class="reason">${esc(row.reason)}</td><td>${esc(row.status || "جديدة")}</td><td>${esc(referralDate(row.createdAt))}</td></tr>`).join("");
    win.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>سجل الإحالات - بوابة أستاذ لحوني التعليمية</title><style>@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,Tahoma,sans-serif;color:#20364d;background:#fff}.letterhead{border:1px solid #cfdbe7;border-top:6px solid #1768c5;padding:16px 18px;margin-bottom:14px}.brand{display:flex;justify-content:space-between;align-items:flex-start;gap:20px}.brand h1{margin:0;color:#123f70;font-size:24px}.brand p{margin:5px 0 0;color:#667d91}.stamp{border:1px solid #bdd1e5;background:#f4f8fc;border-radius:8px;padding:8px 12px;font-weight:700;color:#174f83}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:14px}.meta div{border:1px solid #d9e4ee;background:#f8fafc;padding:8px 10px;border-radius:6px}.meta small{display:block;color:#71869a;margin-bottom:3px}.meta b{font-size:11px}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:10.5px}th,td{border:1px solid #cbd8e4;padding:8px 7px;text-align:right;vertical-align:middle}th{background:#1768c5;color:#fff;font-weight:700}th:first-child,td:first-child{width:4%;text-align:center}th:nth-child(2){width:20%}th:nth-child(3){width:11%}th:nth-child(4){width:17%}th:nth-child(5){width:28%}th:nth-child(6){width:9%}th:nth-child(7){width:11%}.reason{line-height:1.55}tbody tr:nth-child(even){background:#f7f9fc}.footer{display:flex;justify-content:space-between;margin-top:12px;padding-top:8px;border-top:1px solid #d7e1eb;color:#718397;font-size:9px}.sign{margin-top:22px;display:flex;justify-content:flex-end}.sign div{min-width:220px;text-align:center;border-top:1px solid #8093a5;padding-top:6px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><section class="letterhead"><div class="brand"><div><h1>سجل الإحالات للمرشد الطلابي</h1><p>بوابة أستاذ لحوني التعليمية — تقرير رسمي للمتابعة</p></div><div class="stamp">${esc(subject)}</div></div><div class="meta"><div><small>المعلم</small><b>${esc(teacherName)}</b></div><div><small>المادة</small><b>${esc(subject)}</b></div><div><small>نوع التقرير</small><b>${esc(label)}</b></div><div><small>عدد الإحالات</small><b>${shownReferrals.length}</b></div></div></section><table><thead><tr><th>م</th><th>الطالب</th><th>الفصل</th><th>نوع الإحالة</th><th>سبب الإحالة</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>${body || '<tr><td colspan="7" style="text-align:center;padding:24px">لا توجد إحالات في التصنيف المحدد.</td></tr>'}</tbody></table><div class="sign"><div>توقيع المعلم</div></div><div class="footer"><span>تم إصدار التقرير من بوابة أستاذ لحوني التعليمية</span><span>تاريخ الطباعة: ${new Intl.DateTimeFormat("ar-SA",{timeZone:"Asia/Riyadh",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}</span></div><script>window.onload=()=>setTimeout(()=>window.print(),220)<\/script></body></html>`);
    win.document.close();
  }

  async function copySupportList() {
    if (!support.length) return setMessage("لا توجد قائمة دعم مكتملة الرصد لنسخها.");
    await navigator.clipboard.writeText(support.map((student, index) => `${index + 1}. ${student.name} — ${student.class} — ${student.finalScore}%`).join("\n"));
    setMessage("تم نسخ قائمة الطلاب الذين يحتاجون دعمًا.");
  }

  const masteryGroups = (selectedClass ? [selectedClass] : classes).map(className => ({ className, rows: evaluated.filter(student => (student.class || "") === className) })).filter(group => group.rows.length > 0);

  if (!teacherId) return <main className="follow-page referral-history-page unified-mastery-page" dir="rtl"><p>جارٍ تجهيز صفحة المتابعة…</p></main>;

  return <main className="follow-page referral-history-page unified-mastery-page mastery-premium" dir="rtl">
    {!activePlan && <div className="follow-toast" role="status">لم تُعتمد خطة توزيع الدرجات بعد. <a href="/teacher/grade-plan">إعداد التوزيع الآن</a></div>}
    <section className="follow-head mastery-dashboard-head">
      <div className="mastery-title"><span>متابعة مستوى إتقان الطلاب</span><h1>الإتقان</h1><small>{subject}</small></div>
      <div className="follow-filters">
        <label>الفصل<select value={selectedClass} onChange={event => { setSelectedClass(event.target.value); setSelectedStudent(""); }}><option value="">جميع الفصول</option>{classes.map(name => <option key={name}>{name}</option>)}</select></label>
        <label>الطالب<select value={selectedStudent} onChange={event => setSelectedStudent(event.target.value)}><option value="">جميع الطلاب</option>{classStudents.map(student => <option key={student.id} value={student.id}>{student.name}</option>)}</select></label>
        <label>معيار الإتقان<select value={threshold} onChange={event => setThreshold(Number(event.target.value))}><option value={80}>٨٠٪</option><option value={75}>٧٥٪</option><option value={70}>٧٠٪</option></select></label>
      </div>
    </section>

    {scopeLoading ? <p className="follow-inline-message">جارٍ تحميل الفصول…</p> : !classes.length ? <p className="follow-inline-message">لا توجد فصول محددة لهذه المادة.</p> : null}

    <section className="mastery-summary-strip">
      <div><span>الطلاب المطلوب دعمهم</span><strong>{support.length}</strong></div>
      <div><span>الإحالات المسجلة</span><strong>{referrals.length}</strong></div>
      <div><span>الفصول</span><strong>{classes.length}</strong></div>
      
    </section>

    <section className="follow-card unified-referral-card">
      <header className="referral-history-head"><div><h2>سجل الإتقان</h2></div><label className="view-select">العرض<select value={referralView} onChange={event=>setReferralView(event.target.value as typeof referralView)}><option value="required">المطلوب دعمهم ({support.length})</option><option value="all">كل الإحالات ({referrals.length})</option><option value="mastery">إحالات الإتقان والتحصيل ({referralMasteryCount})</option><option value="other">الإحالات الأخرى ({referralOtherCount})</option></select></label></header>
      <div className="unified-toolbar"><div><button className="counselor-button" onClick={openReferral}>+ إحالة جديدة للمرشد</button>{referralView==="required" ? <><label className="print-scope">طباعة<select value={printScope} onChange={event=>setPrintScope(event.target.value as "current"|"all")}><option value="current">{selectedClass ? `الفصل: ${selectedClass}` : "الفصول المعروضة"}</option><option value="all">جميع الفصول — كل فصل في صفحة</option></select></label><button type="button" className="print-primary" onClick={printMasteryTable}>طباعة التقرير</button></> : <button type="button" className="referral-print-button" onClick={printReferrals} disabled={referralsLoading}>طباعة سجل الإحالات</button>}<button onClick={() => void copySupportList()}>نسخ القائمة</button></div></div>
      {referralView==="required" ? <div className="mastery-class-groups">{masteryGroups.map(group => <section className="mastery-class-block" key={group.className}>{!selectedClass && <div className="mastery-class-heading"><h3>{group.className}</h3><span>{group.rows.length} طالب</span></div>}<div className="follow-table-wrap mastery-table-wrap"><table><thead><tr><th>تحديد</th><th>الطالب</th><th>الأداء</th><th>الفترة/الوحدة</th><th>الحالة</th><th>الإجراءات</th></tr></thead><tbody>{group.rows.map(student => { const status=statusFor(student,threshold); return <tr key={student.id}><td><input type="checkbox" checked={selectedIds.includes(student.id)} onChange={event=>setSelectedIds(current=>event.target.checked?[...new Set([...current,student.id])]:current.filter(id=>id!==student.id))}/></td><td className="student-name-cell"><b>{student.name||"—"}</b></td><td><strong>{student.masteryScore!==null?`${student.masteryScore}%`:"—"}</strong></td><td>{student.masteryBasis||"—"}</td><td><span className={`level ${status.className}`}>{status.label}</span></td><td><div className="row-actions"><button type="button" className="analysis-btn" onClick={()=>{setAnalysisStudent(student);setAiInsight(null);}}>تحليل</button><button type="button" className="note-btn" onClick={()=>{setNoteStudent(student);setSelectedNoteType("");setNote("");}}>ملاحظة <small>{Number(student.teacherNoteCount||student.teacherNotes?.length||0)}</small></button><button type="button" onClick={()=>{setSelectedIds([student.id]);setReferralClass(student.class||"");setReferralType("achievement");setReason("انخفاض مستوى التحصيل الدراسي");setReferralOpen(true);}}>إحالة</button></div></td></tr>; })}</tbody></table></div></section>)}{!evaluated.length&&<p className="empty">لا يوجد طلاب مطلوب دعمهم بعد إغلاق الوحدة أو الفترة الحالية.</p>}</div>
      : <div className="follow-table-wrap"><table><thead><tr><th>الطالب</th><th>الفصل</th><th>نوع الإحالة</th><th>سبب الإحالة</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>{shownReferrals.map(row=><tr key={row.id}><td className="student-name-cell"><b>{row.studentName||"—"}</b></td><td>{row.className||"—"}</td><td><span className={`referral-type ${row.referralType==="other"?"other":"mastery"}`}>{row.referralTypeLabel||(row.referralType==="other"?"إحالة أخرى":"الإتقان والتحصيل")}</span></td><td className="referral-reason">{row.reason||"—"}</td><td><span className="referral-status">{row.status||"جديدة"}</span></td><td>{referralDate(row.createdAt)}</td></tr>)}</tbody></table>{referralsLoading?<p className="empty">جارٍ تحميل سجل الإحالات…</p>:!shownReferrals.length?<p className="empty">لا توجد إحالات محفوظة في هذا التصنيف.</p>:null}</div>}
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
