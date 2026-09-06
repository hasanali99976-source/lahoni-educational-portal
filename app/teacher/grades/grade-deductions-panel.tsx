"use client";

import { useEffect, useMemo, useState } from "react";
import { calculateGradePlanResult, type GradeStudentLike, type GradeValueMap } from "../../../lib/grade-plan";
import { useGradePlan } from "../../../lib/use-grade-plan";
import { useTeacherClient } from "../../../lib/teacher-client";
import "./grade-deductions.css";

type Deduction = {
  id: string;
  planId: string;
  scope: "plan" | "section" | "item";
  sectionId?: string;
  sectionLabel?: string;
  itemId?: string;
  itemLabel?: string;
  amount: number;
  reason: string;
  note?: string;
  createdAt: string;
  teacherName?: string;
  reversedAt?: string;
};

type Student = GradeStudentLike & {
  id: string;
  code: string;
  name: string;
  className: string;
  class?: string;
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
const dateLabel = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Riyadh" }).format(date);
};

export default function GradeDeductionsPanel() {
  const session = useTeacherClient();
  const { activePlan } = useGradePlan(true);
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

  async function load() {
    if (!subjectId) return;
    const params = new URLSearchParams({ subjectId });
    if (session?.activeGrade) params.set("grade", String(session.activeGrade));
    try {
      const response = await fetch(`/api/teacher/students?${params.toString()}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "تعذر تحميل الطلاب");
      const list = (Array.isArray(data.students) ? data.students : []).map((value: Record<string, unknown>) => ({
        ...(value as unknown as Student),
        id: String(value.id || value.code || "").trim().toUpperCase(),
        code: String(value.code || value.id || "").trim().toUpperCase(),
        name: String(value.name || "").trim(),
        className: String(value.className || value.class || "").trim(),
        gradeDeductions: Array.isArray(value.gradeDeductions) ? value.gradeDeductions as Deduction[] : [],
      })).filter((student: Student) => student.code && student.name && student.className);
      setStudents(list);
      setClassName(current => current && list.some((student: Student) => student.className === current) ? current : (list[0]?.className || ""));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تحميل نظام الخصومات");
    }
  }

  useEffect(() => { void load(); }, [subjectId, session?.activeGrade]);

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

  const allDeductions = (student?.gradeDeductions || []).filter(item => !item.reversedAt && (!activePlan || item.planId === activePlan.id));
  const reversedDeductions = (student?.gradeDeductions || []).filter(item => item.reversedAt && (!activePlan || item.planId === activePlan.id));
  const totalDeduction = allDeductions.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const adjusted = Math.max(0, Number(result?.earned || 0) - totalDeduction);

  function targetEarned() {
    if (!result || !target) return 0;
    if (target.scope === "plan") return result.earned;
    const section = result.sections.find(item => item.id === target.sectionId);
    if (!section) return 0;
    if (target.scope === "section") return section.earned;
    return section.items.find(item => item.item.id === target.itemId)?.value || 0;
  }
  function sameTarget(item: Deduction) {
    if (!target) return false;
    if (item.scope !== target.scope) return false;
    if (target.scope === "plan") return true;
    if (item.sectionId !== target.sectionId) return false;
    return target.scope === "section" || item.itemId === target.itemId;
  }
  const alreadyOnTarget = allDeductions.filter(sameTarget).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const available = Math.max(0, targetEarned() - alreadyOnTarget);
  const numericAmount = Math.max(0, Number(amount) || 0);

  async function save() {
    if (!student || !activePlan || !target) return setMessage("اختر الطالب وبند الخصم أولًا.");
    if (numericAmount <= 0) return setMessage("حدد مقدار الخصم.");
    if (numericAmount > available) return setMessage(`أقصى خصم متاح لهذا البند حاليًا ${ar(available)} درجة.`);
    setBusy(true); setMessage("");
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
      setNote(""); setAmount("1"); setMessage("تم اعتماد الخصم وسيظهر للطالب وولي الأمر مع السبب.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر حفظ الخصم");
    } finally { setBusy(false); }
  }

  async function reverse(deductionId: string) {
    if (!student || !window.confirm("إلغاء هذا الخصم وإعادة الدرجة المحتسبة؟")) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/teacher/grade-deductions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId, studentCode: student.code, deductionId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "تعذر إلغاء الخصم");
      setStudents(current => current.map(item => item.code === student.code ? { ...item, gradeDeductions: Array.isArray(data.deductions) ? data.deductions : item.gradeDeductions } : item));
      setMessage("تم إلغاء الخصم وإعادة احتساب الدرجة.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر إلغاء الخصم");
    } finally { setBusy(false); }
  }

  if (!activePlan) return null;

  return <section className="gded" dir="rtl">
    <header className="gded-head">
      <div><small>مرتبط مباشرة بالتحصيل العلمي</small><h2>الخصومات والتعديلات</h2><p>الدرجة الأصلية تبقى محفوظة كما رصدتها. الخصم يُسجل بشكل مستقل مع السبب ويمكن إلغاؤه لاحقًا.</p></div>
      <span>سجل موثق</span>
    </header>

    {message ? <p className="gded-message">{message}</p> : null}

    <div className="gded-grid">
      <aside className="gded-pick">
        <label><span>الفصل</span><select value={className} onChange={event => setClassName(event.target.value)}>{classes.map(name => <option key={name}>{name}</option>)}</select></label>
        <label><span>الطالب</span><select value={studentCode} onChange={event => setStudentCode(event.target.value)}>{classStudents.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
        {student && result ? <section className="gded-score">
          <div><small>الدرجة الأصلية</small><b>{ar(result.earned)} <i>/ {ar(result.maximum)}</i></b></div>
          <strong>− {ar(totalDeduction)}</strong>
          <div className="final"><small>بعد الخصم</small><b>{ar(adjusted)} <i>/ {ar(result.maximum)}</i></b></div>
        </section> : null}
      </aside>

      <section className="gded-form">
        <div className="gded-fields">
          <label><span>يُخصم من</span><select value={targetValue} onChange={event => setTargetValue(event.target.value)}>{targets.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select><small>المتاح حاليًا: {ar(available)}</small></label>
          <label><span>سبب الخصم</span><select value={reason} onChange={event => setReason(event.target.value)}>{reasons.map(item => <option key={item}>{item}</option>)}</select></label>
        </div>
        <div className="gded-amount"><span>مقدار الخصم</span><div>{[0.5,1,2].map(value => <button type="button" key={value} className={Number(amount) === value ? "active" : ""} onClick={() => setAmount(String(value))}>{ar(value)}</button>)}<input type="number" min="0" step="0.25" value={amount} onChange={event => setAmount(event.target.value)} aria-label="مقدار خصم مخصص"/></div></div>
        <label className="gded-note"><span>ملاحظة داخلية <em>اختيارية</em></span><input value={note} onChange={event => setNote(event.target.value)} placeholder="تفصيل مختصر يساعدك عند المراجعة لاحقًا"/></label>
        <section className="gded-preview"><div><small>قبل الخصم</small><b>{ar(result?.earned || 0)}</b></div><span>←</span><div><small>بعد اعتماد هذا الخصم</small><b>{ar(Math.max(0, adjusted - numericAmount))}</b></div><p>{reason}{target ? ` • ${target.label}` : ""}</p></section>
        <button type="button" className="gded-save" disabled={busy || !student || numericAmount <= 0 || numericAmount > available} onClick={() => void save()}>{busy ? "جارٍ الحفظ…" : "اعتماد الخصم"}</button>
      </section>
    </div>

    <section className="gded-history">
      <header><div><small>سجل الطالب المختار</small><h3>الخصومات السابقة</h3></div><span>{allDeductions.length} نشط</span></header>
      {allDeductions.length ? <div>{allDeductions.map(item => <article key={item.id}><b>− {ar(item.amount)}</b><div><strong>{item.reason}</strong><span>{item.itemLabel || item.sectionLabel || "إجمالي التحصيل"}</span><small>{dateLabel(item.createdAt)}{item.teacherName ? ` • ${item.teacherName}` : ""}</small>{item.note ? <p>{item.note}</p> : null}</div><button type="button" disabled={busy} onClick={() => void reverse(item.id)}>إلغاء الخصم</button></article>)}</div> : <p className="gded-empty">لا توجد خصومات فعالة على هذا الطالب.</p>}
      {reversedDeductions.length ? <details><summary>الخصومات الملغاة ({reversedDeductions.length})</summary><div>{reversedDeductions.slice(0, 10).map(item => <p key={item.id}><b>− {ar(item.amount)}</b> {item.reason} • تم الإلغاء {dateLabel(item.reversedAt)}</p>)}</div></details> : null}
    </section>
  </section>;
}
