"use client";

import { useEffect, useMemo, useState } from "react";
import { calculateGradePlanResult, type GradeStudentLike, type GradeValueMap } from "../../../lib/grade-plan";
import { useGradePlan } from "../../../lib/use-grade-plan";
import { useTeacherClient } from "../../../lib/teacher-client";
import "./dashboard-quick-deduction.css";

type Deduction = {
  id: string;
  planId: string;
  scope: "plan" | "section" | "item";
  sectionId?: string;
  itemId?: string;
  amount: number;
  reason: string;
  reversedAt?: string;
};

type Student = GradeStudentLike & {
  id: string;
  code: string;
  name: string;
  className: string;
  gradeValues?: GradeValueMap;
  gradePlanValues?: Record<string, GradeValueMap>;
  gradeDeductions?: Deduction[];
};

type Target = {
  value: string;
  scope: "plan" | "section" | "item";
  sectionId?: string;
  sectionLabel?: string;
  itemId?: string;
  itemLabel?: string;
  label: string;
};

type Lesson = { className?: string };

const reasons = [
  "عدم تسليم المهمة",
  "تأخر في التسليم",
  "نقص في متطلبات المهمة",
  "عدم إكمال النشاط",
  "ضعف المشاركة في التقييم",
  "مخالفة تعليمات التقييم",
  "سبب آخر",
];

const ar = (value: number) => new Intl.NumberFormat("ar-SA-u-nu-arab", { maximumFractionDigits: 2 }).format(Number.isFinite(value) ? value : 0);
const weekday = () => new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Riyadh", weekday: "long" }).format(new Date()).toLowerCase();

export default function DashboardQuickDeduction() {
  const session = useTeacherClient();
  const { activePlan } = useGradePlan(true);
  const [open, setOpen] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [className, setClassName] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [targetValue, setTargetValue] = useState("plan");
  const [amount, setAmount] = useState("1");
  const [reason, setReason] = useState(reasons[0]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const subjectId = String(session?.subjectKey || "").split("--")[0];

  useEffect(() => {
    if (!open || !subjectId) return;
    const controller = new AbortController();
    const studentParams = new URLSearchParams({ subjectId });
    if (session?.activeGrade) studentParams.set("grade", String(session.activeGrade));

    Promise.all([
      fetch(`/api/teacher/students?${studentParams.toString()}`, { cache: "no-store", signal: controller.signal }).then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "تعذر تحميل الطلاب");
        return data;
      }),
      fetch(`/api/teacher/timetable?subjectId=${encodeURIComponent(String(session?.subjectKey || subjectId))}`, { cache: "no-store", signal: controller.signal }).then(response => response.ok ? response.json() : ({})).catch(() => ({})),
    ]).then(([studentData, timetableData]) => {
      const list = (Array.isArray(studentData.students) ? studentData.students : []).map((value: Record<string, unknown>) => ({
        ...(value as unknown as Student),
        id: String(value.id || value.code || "").trim().toUpperCase(),
        code: String(value.code || value.id || "").trim().toUpperCase(),
        name: String(value.name || "").trim(),
        className: String(value.className || value.class || "").trim(),
        gradeDeductions: Array.isArray(value.gradeDeductions) ? value.gradeDeductions as Deduction[] : [],
      })).filter((student: Student) => student.code && student.name && student.className);
      setStudents(list);

      const lessons = timetableData?.lessons && typeof timetableData.lessons === "object" ? timetableData.lessons as Record<string, Lesson> : {};
      const day = weekday();
      const todayClasses = Object.entries(lessons)
        .filter(([cell, lesson]) => cell.startsWith(`${day}-`) && lesson?.className)
        .sort(([a], [b]) => Number(a.split("-")[1] || 0) - Number(b.split("-")[1] || 0))
        .map(([, lesson]) => String(lesson.className || ""));
      const preferred = todayClasses.find(name => list.some((student: Student) => student.className === name));
      setClassName(current => current && list.some((student: Student) => student.className === current) ? current : (preferred || list[0]?.className || ""));
      setMessage("");
    }).catch(error => {
      if ((error as Error)?.name !== "AbortError") setMessage(error instanceof Error ? error.message : "تعذر تحميل الطلاب");
    });

    return () => controller.abort();
  }, [open, subjectId, session?.subjectKey, session?.activeGrade]);

  const classes = useMemo(() => [...new Set(students.map(student => student.className))].sort((a, b) => a.localeCompare(b, "ar", { numeric: true })), [students]);
  const classStudents = useMemo(() => students.filter(student => student.className === className).sort((a, b) => a.name.localeCompare(b.name, "ar")), [students, className]);

  useEffect(() => {
    if (!classStudents.some(student => student.code === studentCode)) setStudentCode(classStudents[0]?.code || "");
  }, [classStudents, studentCode]);

  const student = students.find(item => item.code === studentCode) || null;
  const values = activePlan && student ? (student.gradePlanValues?.[activePlan.id] || student.gradeValues || {}) : {};
  const result = activePlan && student ? calculateGradePlanResult(activePlan, { ...student, gradeValues: values }) : null;

  const targets = useMemo<Target[]>(() => {
    if (!activePlan) return [];
    const list: Target[] = [{ value: "plan", scope: "plan", label: "إجمالي التحصيل" }];
    activePlan.sections.forEach(section => {
      list.push({ value: `section:${section.id}`, scope: "section", sectionId: section.id, sectionLabel: section.label, label: section.label });
      section.items.forEach(item => list.push({ value: `item:${section.id}:${item.id}`, scope: "item", sectionId: section.id, sectionLabel: section.label, itemId: item.id, itemLabel: item.label, label: `${section.label} • ${item.label}` }));
    });
    return list;
  }, [activePlan]);

  const target = targets.find(item => item.value === targetValue) || targets[0] || null;
  const activeDeductions = (student?.gradeDeductions || []).filter(item => !item.reversedAt && (!activePlan || item.planId === activePlan.id));

  function targetEarned() {
    if (!result || !target) return 0;
    if (target.scope === "plan") return result.earned;
    const section = result.sections.find(item => item.id === target.sectionId);
    if (!section) return 0;
    if (target.scope === "section") return section.earned;
    return section.items.find(item => item.item.id === target.itemId)?.value || 0;
  }

  function sameTarget(item: Deduction) {
    if (!target || item.scope !== target.scope) return false;
    if (target.scope === "plan") return true;
    if (item.sectionId !== target.sectionId) return false;
    return target.scope === "section" || item.itemId === target.itemId;
  }

  const alreadyOnTarget = activeDeductions.filter(sameTarget).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const available = Math.max(0, targetEarned() - alreadyOnTarget);
  const numericAmount = Math.max(0, Number(amount) || 0);
  const totalDeduction = activeDeductions.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const afterCurrent = Math.max(0, Number(result?.earned || 0) - totalDeduction);

  async function save() {
    if (!student || !activePlan || !target) return setMessage("اختر الطالب وبند الخصم أولًا.");
    if (numericAmount <= 0) return setMessage("حدد مقدار الخصم.");
    if (numericAmount > available) return setMessage(`أقصى خصم متاح لهذا البند ${ar(available)} درجة.`);
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/teacher/grade-deductions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId,
          studentCode: student.code,
          planId: activePlan.id,
          scope: target.scope,
          sectionId: target.sectionId,
          sectionLabel: target.sectionLabel,
          itemId: target.itemId,
          itemLabel: target.itemLabel,
          amount: numericAmount,
          reason,
          note,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "تعذر حفظ الخصم");
      setStudents(current => current.map(item => item.code === student.code ? { ...item, gradeDeductions: Array.isArray(data.deductions) ? data.deductions : item.gradeDeductions } : item));
      setAmount("1");
      setNote("");
      setMessage(`تم خصم ${ar(numericAmount)} من ${student.name} وحُفظ في سجله.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر حفظ الخصم");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <button type="button" className="tdq-open" onClick={() => setOpen(true)} aria-label="خصم درجة من طالب">
      <span>−</span><b>خصم طالب</b>
    </button>

    {open ? <div className="tdq-dialog" role="dialog" aria-modal="true" aria-label="الخصم السريع من الطالب">
      <section className="tdq-shell" dir="rtl">
        <header>
          <div><small>من اليومي مباشرة</small><h2>خصم سريع على طالب</h2></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="إغلاق">×</button>
        </header>

        <div className="tdq-body">
          {!activePlan ? <div className="tdq-empty"><b>لا توجد خطة تحصيل معتمدة لهذه المادة.</b><span>اعتمد خطة التحصيل أولًا حتى يُسجل الخصم في مكانه الصحيح.</span></div> : <>
            <div className="tdq-fields">
              <label><span>الفصل</span><select value={className} onChange={event => setClassName(event.target.value)}>{classes.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
              <label><span>الطالب</span><select value={studentCode} onChange={event => setStudentCode(event.target.value)}>{classStudents.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
              <label><span>يُخصم من</span><select value={targetValue} onChange={event => setTargetValue(event.target.value)}>{targets.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select><small>المتاح: {ar(available)} درجة</small></label>
              <label><span>السبب</span><select value={reason} onChange={event => setReason(event.target.value)}>{reasons.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
            </div>

            <section className="tdq-amount">
              <span>مقدار الخصم</span>
              <div>{[0.5, 1, 2].map(value => <button type="button" key={value} className={Number(amount) === value ? "active" : ""} onClick={() => setAmount(String(value))}>{ar(value)}</button>)}<input type="number" min="0" step="0.25" value={amount} onChange={event => setAmount(event.target.value)} aria-label="مقدار خصم مخصص" /></div>
            </section>

            <label className="tdq-note"><span>ملاحظة <small>اختيارية</small></span><input value={note} onChange={event => setNote(event.target.value)} placeholder="تفصيل مختصر عند الحاجة" /></label>

            {student && result ? <section className="tdq-preview">
              <div><small>الدرجة الحالية بعد الخصومات</small><b>{ar(afterCurrent)}</b></div>
              <span>←</span>
              <div><small>بعد الخصم الجديد</small><b>{ar(Math.max(0, afterCurrent - numericAmount))}</b></div>
            </section> : null}

            {message ? <p className="tdq-message">{message}</p> : null}
            <button type="button" className="tdq-save" disabled={busy || !student || numericAmount <= 0 || numericAmount > available} onClick={() => void save()}>{busy ? "جارٍ الحفظ…" : "اعتماد الخصم"}</button>
          </>}
        </div>
      </section>
    </div> : null}
  </>;
}
