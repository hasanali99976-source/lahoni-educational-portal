"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useTeacherClient } from "../../../lib/teacher-client";
import { tenantCollection, type SubjectKey } from "../../../lib/teacher-tenant";
import "./evaluation-plans.css";

type PlanStatus = "planned" | "active" | "completed";
type EvaluationType = "diagnostic" | "formative" | "performance" | "project" | "unit-exam" | "final";

type EvaluationPlan = {
  id: string;
  title: string;
  evaluationType: EvaluationType;
  classNames: string[];
  unit: string;
  objective: string;
  method: string;
  scheduledDate: string;
  maxScore: number;
  status: PlanStatus;
  notes: string;
  teacherId: string;
  subjectKey: string;
  createdAt: string;
  updatedAt: string;
};

type PlanDraft = Omit<EvaluationPlan, "id" | "teacherId" | "subjectKey" | "createdAt" | "updatedAt">;

type ClassOption = { id?: string; name?: string; className?: string };

const TYPE_LABELS: Record<EvaluationType, string> = {
  diagnostic: "تشخيصي",
  formative: "تكويني",
  performance: "مهمة أدائية",
  project: "مشروع",
  "unit-exam": "اختبار وحدة",
  final: "ختامي",
};

const STATUS_LABELS: Record<PlanStatus, string> = {
  planned: "مخطط",
  active: "قيد التنفيذ",
  completed: "مكتمل",
};

const METHODS = ["اختبار قصير", "ملاحظة", "أسئلة صفية", "مهمة أدائية", "مشروع", "واجب", "تقويم شفهي", "ورقة عمل"];

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function emptyDraft(): PlanDraft {
  return {
    title: "",
    evaluationType: "formative",
    classNames: [],
    unit: "",
    objective: "",
    method: "اختبار قصير",
    scheduledDate: today(),
    maxScore: 10,
    status: "planned",
    notes: "",
  };
}

function clean(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizePlan(id: string, source: Record<string, unknown>): EvaluationPlan {
  const evaluationTypeKey = String(source.evaluationType || "");
  const statusKey = String(source.status || "");
  const evaluationType = Object.prototype.hasOwnProperty.call(TYPE_LABELS, evaluationTypeKey) ? evaluationTypeKey as EvaluationType : "formative";
  const status = Object.prototype.hasOwnProperty.call(STATUS_LABELS, statusKey) ? statusKey as PlanStatus : "planned";
  return {
    id,
    title: clean(source.title) || "خطة تقييم",
    evaluationType,
    classNames: Array.isArray(source.classNames) ? source.classNames.map(clean).filter(Boolean) : [],
    unit: clean(source.unit),
    objective: clean(source.objective),
    method: clean(source.method) || "اختبار قصير",
    scheduledDate: clean(source.scheduledDate),
    maxScore: Math.max(0, Number(source.maxScore) || 0),
    status,
    notes: clean(source.notes),
    teacherId: clean(source.teacherId),
    subjectKey: clean(source.subjectKey),
    createdAt: clean(source.createdAt),
    updatedAt: clean(source.updatedAt),
  };
}

function formatDate(value: string) {
  if (!value) return "غير محدد";
  try {
    return new Intl.DateTimeFormat("ar-SA", { timeZone: "Asia/Riyadh", day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`));
  } catch {
    return value;
  }
}

function nextId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function EvaluationPlansPage() {
  const { teacherId = "", teacherName = "المعلم", subjectKey = "", subject = "المادة", activeGrade, activeGradeLabel = "" } = useTeacherClient();
  const [plans, setPlans] = useState<EvaluationPlan[]>([]);
  const [draft, setDraft] = useState<PlanDraft>(() => emptyDraft());
  const [editingId, setEditingId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [classOptions, setClassOptions] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<"all" | PlanStatus>("all");
  const [filterClass, setFilterClass] = useState("all");
  const [filterType, setFilterType] = useState<"all" | EvaluationType>("all");

  const planPath = useMemo(() => teacherId && subjectKey ? tenantCollection(teacherId, subjectKey as SubjectKey, "evaluationPlans") : "", [teacherId, subjectKey]);

  useEffect(() => {
    if (!planPath) return;
    return onSnapshot(collection(db, planPath), snapshot => {
      const next = snapshot.docs
        .map(item => normalizePlan(item.id, item.data() as Record<string, unknown>))
        .filter(item => !item.teacherId || (item.teacherId === teacherId && item.subjectKey === subjectKey))
        .sort((a, b) => (a.scheduledDate || "9999-12-31").localeCompare(b.scheduledDate || "9999-12-31") || b.updatedAt.localeCompare(a.updatedAt));
      setPlans(next);
    }, () => setMessage("تعذر مزامنة خطط التقييم الآن؛ تحقق من الاتصال."));
  }, [planPath, teacherId, subjectKey]);

  useEffect(() => {
    if (!subjectKey || !activeGrade) {
      setClassOptions([]);
      return;
    }
    let active = true;
    const params = new URLSearchParams({ subjectId: subjectKey, grade: String(activeGrade) });
    fetch(`/api/teacher/class-options?${params.toString()}`, { cache: "no-store" })
      .then(response => response.ok ? response.json() : Promise.reject(new Error("classes_failed")))
      .then(data => {
        if (!active) return;
        const available = Array.isArray(data.availableClasses) ? data.availableClasses as ClassOption[] : [];
        setClassOptions(available.map(item => clean(item.name || item.className)).filter(Boolean));
      })
      .catch(() => {
        if (active) setClassOptions([]);
      });
    return () => { active = false; };
  }, [subjectKey, activeGrade]);

  const filteredPlans = useMemo(() => plans.filter(plan => {
    if (filterStatus !== "all" && plan.status !== filterStatus) return false;
    if (filterType !== "all" && plan.evaluationType !== filterType) return false;
    if (filterClass !== "all" && !plan.classNames.includes(filterClass)) return false;
    return true;
  }), [plans, filterStatus, filterType, filterClass]);

  const stats = useMemo(() => ({
    total: plans.length,
    planned: plans.filter(plan => plan.status === "planned").length,
    active: plans.filter(plan => plan.status === "active").length,
    completed: plans.filter(plan => plan.status === "completed").length,
  }), [plans]);

  const nextPlan = useMemo(() => plans.find(plan => plan.status !== "completed" && plan.scheduledDate >= today()) || null, [plans]);

  function openNew() {
    setDraft(emptyDraft());
    setEditingId("");
    setFormOpen(true);
    setMessage("");
  }

  function editPlan(plan: EvaluationPlan) {
    setDraft({
      title: plan.title,
      evaluationType: plan.evaluationType,
      classNames: [...plan.classNames],
      unit: plan.unit,
      objective: plan.objective,
      method: plan.method,
      scheduledDate: plan.scheduledDate || today(),
      maxScore: plan.maxScore,
      status: plan.status,
      notes: plan.notes,
    });
    setEditingId(plan.id);
    setFormOpen(true);
    setMessage("");
  }

  function duplicatePlan(plan: EvaluationPlan) {
    setDraft({
      title: `${plan.title} — نسخة`,
      evaluationType: plan.evaluationType,
      classNames: [...plan.classNames],
      unit: plan.unit,
      objective: plan.objective,
      method: plan.method,
      scheduledDate: today(),
      maxScore: plan.maxScore,
      status: "planned",
      notes: plan.notes,
    });
    setEditingId("");
    setFormOpen(true);
    setMessage("تم نسخ بيانات الخطة؛ عدّل ما يلزم ثم احفظ.");
  }

  function toggleClass(className: string) {
    setDraft(current => ({
      ...current,
      classNames: current.classNames.includes(className) ? current.classNames.filter(item => item !== className) : [...current.classNames, className],
    }));
  }

  async function savePlan() {
    if (!planPath || !teacherId || !subjectKey) return setMessage("تعذر تحديد مساحة المعلم والمادة.");
    if (!clean(draft.title)) return setMessage("اكتب عنوان خطة التقييم.");
    if (!draft.classNames.length) return setMessage("اختر فصلًا واحدًا على الأقل.");
    if (!draft.scheduledDate) return setMessage("حدد تاريخ تنفيذ التقييم.");
    if (draft.maxScore < 0 || draft.maxScore > 1000) return setMessage("درجة التقييم يجب أن تكون بين 0 و1000.");

    setSaving(true);
    const id = editingId || nextId();
    const existing = editingId ? plans.find(plan => plan.id === editingId) : null;
    const now = new Date().toISOString();
    try {
      await setDoc(doc(db, planPath, id), {
        ...draft,
        title: clean(draft.title).slice(0, 180),
        unit: clean(draft.unit).slice(0, 180),
        objective: clean(draft.objective).slice(0, 700),
        method: clean(draft.method).slice(0, 120),
        notes: clean(draft.notes).slice(0, 1000),
        classNames: draft.classNames.map(clean).filter(Boolean).slice(0, 30),
        maxScore: Number(draft.maxScore) || 0,
        teacherId,
        teacherName,
        subjectKey,
        subject,
        grade: activeGrade || null,
        gradeLabel: activeGradeLabel || "",
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      }, { merge: true });
      setMessage(editingId ? "تم تحديث خطة التقييم بنجاح." : "تم إنشاء خطة التقييم بنجاح.");
      setFormOpen(false);
      setEditingId("");
      setDraft(emptyDraft());
    } catch (error) {
      console.error("evaluation-plan-save", error);
      setMessage("تعذر حفظ الخطة في السحابة. تحقق من الاتصال ثم أعد المحاولة.");
    } finally {
      setSaving(false);
    }
  }

  async function removePlan(plan: EvaluationPlan) {
    if (!planPath) return;
    if (!window.confirm(`حذف خطة «${plan.title}» نهائيًا؟`)) return;
    try {
      await deleteDoc(doc(db, planPath, plan.id));
      setMessage("تم حذف خطة التقييم.");
    } catch {
      setMessage("تعذر حذف الخطة الآن.");
    }
  }

  async function setPlanStatus(plan: EvaluationPlan, status: PlanStatus) {
    if (!planPath) return;
    try {
      await setDoc(doc(db, planPath, plan.id), { status, updatedAt: new Date().toISOString() }, { merge: true });
    } catch {
      setMessage("تعذر تحديث حالة الخطة الآن.");
    }
  }

  return <main className="evaluation-page" dir="rtl">
    <section className="evaluation-hero">
      <div>
        <span className="evaluation-kicker">تنظيم التقييمات</span>
        <h1>خطط التقييم</h1>
        <p>أنشئ خطة واضحة لكل أداة تقييم، اربطها بالفصول والدرجة والتاريخ، وتابع التنفيذ من التخطيط حتى الاكتمال.</p>
      </div>
      <div className="evaluation-hero-actions">
        <button type="button" className="evaluation-secondary" onClick={() => window.print()} disabled={!filteredPlans.length}>طباعة الخطط</button>
        <button type="button" className="evaluation-primary" onClick={openNew}>+ خطة تقييم جديدة</button>
      </div>
    </section>

    <section className="evaluation-stats" aria-label="ملخص خطط التقييم">
      <article><span>إجمالي الخطط</span><strong>{stats.total}</strong></article>
      <article><span>مخطط</span><strong>{stats.planned}</strong></article>
      <article><span>قيد التنفيذ</span><strong>{stats.active}</strong></article>
      <article><span>مكتمل</span><strong>{stats.completed}</strong></article>
      <article className="evaluation-next"><span>أقرب تقييم</span><strong>{nextPlan ? formatDate(nextPlan.scheduledDate) : "لا يوجد"}</strong><small>{nextPlan?.title || "أضف خطة جديدة"}</small></article>
    </section>

    {message ? <div className="evaluation-message" role="status">{message}</div> : null}

    {formOpen ? <section className="evaluation-form-card">
      <div className="evaluation-form-head"><div><span>{editingId ? "تعديل الخطة" : "خطة جديدة"}</span><h2>{editingId ? "تحديث بيانات التقييم" : "إضافة تقييم للخطة"}</h2></div><button type="button" onClick={() => setFormOpen(false)} aria-label="إغلاق">×</button></div>
      <div className="evaluation-form-grid">
        <label className="wide"><span>عنوان التقييم *</span><input value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} placeholder="مثال: اختبار الوحدة الأولى" /></label>
        <label><span>نوع التقييم</span><select value={draft.evaluationType} onChange={event => setDraft(current => ({ ...current, evaluationType: event.target.value as EvaluationType }))}>{Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span>الوحدة / الموضوع</span><input value={draft.unit} onChange={event => setDraft(current => ({ ...current, unit: event.target.value }))} placeholder="الوحدة أو الدرس" /></label>
        <label><span>أداة التقييم</span><select value={draft.method} onChange={event => setDraft(current => ({ ...current, method: event.target.value }))}>{METHODS.map(method => <option key={method}>{method}</option>)}</select></label>
        <label><span>تاريخ التنفيذ *</span><input type="date" value={draft.scheduledDate} onChange={event => setDraft(current => ({ ...current, scheduledDate: event.target.value }))} /></label>
        <label><span>الدرجة</span><input type="number" min="0" max="1000" step="0.5" value={draft.maxScore} onChange={event => setDraft(current => ({ ...current, maxScore: Number(event.target.value) }))} /></label>
        <label><span>الحالة</span><select value={draft.status} onChange={event => setDraft(current => ({ ...current, status: event.target.value as PlanStatus }))}>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="wide"><span>هدف التقييم</span><textarea rows={2} value={draft.objective} onChange={event => setDraft(current => ({ ...current, objective: event.target.value }))} placeholder="ما المهارة أو ناتج التعلم الذي سيقيسه هذا التقييم؟" /></label>
        <div className="evaluation-classes wide"><span>الفصول المستهدفة *</span>{classOptions.length ? <div>{classOptions.map(className => <label key={className} className={draft.classNames.includes(className) ? "selected" : ""}><input type="checkbox" checked={draft.classNames.includes(className)} onChange={() => toggleClass(className)} /><b>{className}</b></label>)}</div> : <p>لم تُحمّل قائمة الفصول لهذه المرحلة. افتح المادة/المرحلة المرتبطة أو أعد المحاولة.</p>}</div>
        <label className="wide"><span>ملاحظات التنفيذ</span><textarea rows={3} value={draft.notes} onChange={event => setDraft(current => ({ ...current, notes: event.target.value }))} placeholder="تعليمات، تهيئة، احتياجات خاصة، أو ملاحظات بعد التنفيذ" /></label>
      </div>
      <div className="evaluation-form-actions"><button type="button" className="evaluation-secondary" onClick={() => setFormOpen(false)}>إلغاء</button><button type="button" className="evaluation-primary" disabled={saving} onClick={() => void savePlan()}>{saving ? "جارٍ الحفظ..." : editingId ? "حفظ التعديلات" : "إنشاء الخطة"}</button></div>
    </section> : null}

    <section className="evaluation-toolbar">
      <div><strong>قائمة الخطط</strong><span>{filteredPlans.length} من {plans.length}</span></div>
      <label><span>الحالة</span><select value={filterStatus} onChange={event => setFilterStatus(event.target.value as "all" | PlanStatus)}><option value="all">الكل</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label><span>النوع</span><select value={filterType} onChange={event => setFilterType(event.target.value as "all" | EvaluationType)}><option value="all">الكل</option>{Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label><span>الفصل</span><select value={filterClass} onChange={event => setFilterClass(event.target.value)}><option value="all">كل الفصول</option>{classOptions.map(className => <option key={className}>{className}</option>)}</select></label>
    </section>

    <section className="evaluation-list">
      {filteredPlans.length ? filteredPlans.map(plan => <article key={plan.id} className={`evaluation-plan status-${plan.status}`}>
        <div className="evaluation-plan-main">
          <div className="evaluation-plan-top"><span className={`evaluation-status status-${plan.status}`}>{STATUS_LABELS[plan.status]}</span><span className="evaluation-type">{TYPE_LABELS[plan.evaluationType]}</span><time>{formatDate(plan.scheduledDate)}</time></div>
          <h2>{plan.title}</h2>
          <div className="evaluation-plan-meta"><span><b>الفصول:</b> {plan.classNames.join("، ") || "—"}</span><span><b>الدرجة:</b> {plan.maxScore}</span><span><b>الأداة:</b> {plan.method || "—"}</span>{plan.unit ? <span><b>الوحدة:</b> {plan.unit}</span> : null}</div>
          {plan.objective ? <p className="evaluation-objective"><b>الهدف:</b> {plan.objective}</p> : null}
          {plan.notes ? <p className="evaluation-notes">{plan.notes}</p> : null}
        </div>
        <div className="evaluation-plan-actions">
          <select aria-label="تغيير حالة الخطة" value={plan.status} onChange={event => void setPlanStatus(plan, event.target.value as PlanStatus)}>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <button type="button" onClick={() => editPlan(plan)}>تعديل</button>
          <button type="button" onClick={() => duplicatePlan(plan)}>نسخ</button>
          <button type="button" className="danger" onClick={() => void removePlan(plan)}>حذف</button>
        </div>
      </article>) : <div className="evaluation-empty"><div>✓</div><h2>لا توجد خطط ضمن هذا العرض</h2><p>أنشئ خطة تقييم جديدة أو غيّر عوامل التصفية.</p><button type="button" className="evaluation-primary" onClick={openNew}>إنشاء أول خطة</button></div>}
    </section>

    <footer className="evaluation-print-footer">{teacherName} — {subject}{activeGradeLabel ? ` — ${activeGradeLabel}` : ""} — بوابة أستاذ لحوني التعليمية</footer>
  </main>;
}
