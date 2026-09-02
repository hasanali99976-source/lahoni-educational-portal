"use client";

import { useMemo, useState } from "react";
import {
  GRADE_CATEGORY_LABELS,
  GRADE_PLAN_MODE_LABELS,
  createAutomaticGradePlan,
  planModeDescription,
  roundGrade,
  validateGradePlanDraft,
  type GradeCategory,
  type GradePlanDraft,
  type GradePlanItem,
  type GradePlanMethod,
  type GradePlanMode,
} from "../../../lib/grade-plan";
import { useGradePlan } from "../../../lib/use-grade-plan";
import "./grade-plan.css";

const categories: GradeCategory[] = ["attendance", "participation", "homework", "unitExam", "research", "project", "performance", "custom"];
const modes: GradePlanMode[] = ["units", "general100", "periods", "custom"];

function nextItemId(sectionId: string) {
  return `${sectionId}-item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function starter(mode: GradePlanMode, method: GradePlanMethod, unitCount: number): GradePlanDraft {
  const base = createAutomaticGradePlan(mode, unitCount);
  return { ...base, method: mode === "custom" ? "manual" : method };
}

function total(items: GradePlanItem[]) {
  return roundGrade(items.reduce((sum, item) => sum + Number(item.max || 0), 0));
}

function formatDate(value: string) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Riyadh" }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function GradePlanPage() {
  const { activePlan, history, loading, error, refresh } = useGradePlan(true);
  const [building, setBuilding] = useState(false);
  const [mode, setMode] = useState<GradePlanMode>("units");
  const [method, setMethod] = useState<GradePlanMethod>("automatic");
  const [unitCount, setUnitCount] = useState(5);
  const [draft, setDraft] = useState<GradePlanDraft>(() => starter("units", "automatic", 5));
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const validation = useMemo(() => validateGradePlanDraft(draft), [draft]);
  const overall = useMemo(() => draft.mode === "periods" ? draft.sections.map(section => total(section.items)) : [roundGrade(draft.sections.reduce((sum, section) => sum + Number(section.max || 0), 0))], [draft]);

  function startNew() {
    setBuilding(true);
    setMessage("");
    const nextMode: GradePlanMode = activePlan?.mode || "units";
    const nextMethod: GradePlanMethod = nextMode === "custom" ? "manual" : "automatic";
    const existingUnits = activePlan?.mode === "units" ? activePlan.sections.length : 5;
    setMode(nextMode);
    setMethod(nextMethod);
    setUnitCount(existingUnits || 5);
    setDraft(starter(nextMode, nextMethod, existingUnits || 5));
  }

  function chooseMode(nextMode: GradePlanMode) {
    const nextMethod = nextMode === "custom" ? "manual" : method;
    setMode(nextMode);
    setMethod(nextMethod);
    setDraft(starter(nextMode, nextMethod, unitCount));
    setMessage("");
  }

  function chooseMethod(nextMethod: GradePlanMethod) {
    if (mode === "custom") return;
    setMethod(nextMethod);
    setDraft(current => ({ ...current, method: nextMethod }));
  }

  function regenerate() {
    setDraft(starter(mode, method, unitCount));
    setMessage(method === "automatic" ? "تم إنشاء اقتراح تلقائي ويمكنك مراجعته قبل الاعتماد." : "تم تجهيز التوزيع لتعديله يدويًا." );
  }

  function updateSection(sectionIndex: number, patch: Partial<GradePlanDraft["sections"][number]>) {
    setDraft(current => ({ ...current, sections: current.sections.map((section, index) => index === sectionIndex ? { ...section, ...patch } : section) }));
  }

  function updateItem(sectionIndex: number, itemIndex: number, patch: Partial<GradePlanItem>) {
    setDraft(current => ({
      ...current,
      sections: current.sections.map((section, index) => index !== sectionIndex ? section : {
        ...section,
        items: section.items.map((item, target) => target === itemIndex ? { ...item, ...patch } : item),
      }),
    }));
  }

  function addItem(sectionIndex: number) {
    setDraft(current => ({
      ...current,
      sections: current.sections.map((section, index) => index !== sectionIndex ? section : {
        ...section,
        items: [...section.items, { id: nextItemId(section.id), label: "عنصر جديد", max: 0, category: "custom" }],
      }),
    }));
  }

  function removeItem(sectionIndex: number, itemIndex: number) {
    setDraft(current => ({
      ...current,
      sections: current.sections.map((section, index) => index !== sectionIndex ? section : {
        ...section,
        items: section.items.filter((_, target) => target !== itemIndex),
      }),
    }));
  }

  async function approvePlan() {
    const checked = validateGradePlanDraft(draft);
    if (!checked.valid) return setMessage(checked.errors[0] || "أكمل توزيع الدرجات أولًا.");
    if (!window.confirm("بعد اعتماد الخطة ستُقفل نهائيًا. أي تغيير لاحق سيكون عبر «اختيار خطة جديدة» ولن تُحذف الدرجات القديمة. هل تريد الاعتماد؟")) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/teacher/grade-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ plan: checked.draft }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "تعذر اعتماد الخطة.");
      await refresh();
      setBuilding(false);
      setMessage("تم اعتماد الخطة وقفلها. أصبحت هي مصدر الاحتساب في البوابة.");
    } catch (saveError) {
      setMessage(saveError instanceof Error ? saveError.message : "تعذر اعتماد الخطة.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="grade-plan-page" dir="rtl"><section className="grade-plan-loading">جارٍ تحميل إعداد توزيع الدرجات…</section></main>;

  if (activePlan && !building) {
    return <main className="grade-plan-page" dir="rtl">
      <section className="approved-hero">
        <div><span>مقفلة ومعتمدة</span><h1>خطة التقييم المعتمدة</h1><p>هذه الصفحة للعرض فقط. الرصد والتقارير والإتقان والطالب والذكاء الاصطناعي يقرؤون هذا التوزيع تلقائيًا.</p></div>
        <button type="button" onClick={startNew}>اختيار خطة جديدة</button>
      </section>
      {message && <p className="grade-plan-message success">{message}</p>}
      <section className="approved-summary">
        <article><small>النظام</small><strong>{GRADE_PLAN_MODE_LABELS[activePlan.mode]}</strong></article>
        <article><small>طريقة البداية</small><strong>{activePlan.method === "automatic" ? "توزيع تلقائي" : "توزيع يدوي"}</strong></article>
        <article><small>الإصدار</small><strong>نسخة {activePlan.version}</strong></article>
        <article><small>تاريخ الاعتماد</small><strong>{formatDate(activePlan.activatedAt)}</strong></article>
      </section>
      <section className="approved-plan-card">
        {activePlan.sections.map(section => <article className="approved-section" key={section.id}>
          <header><div><small>{activePlan.mode === "periods" ? "100 مستقلة" : "جزء من 100"}</small><h2>{section.label}</h2></div><strong>{section.max} درجة</strong></header>
          <div className="approved-items">{section.items.map(item => <div key={item.id}><span>{item.label}<small>{GRADE_CATEGORY_LABELS[item.category]}</small></span><b>{item.max}</b></div>)}</div>
          <footer><span>مجموع العناصر</span><b>{total(section.items)} / {section.max}</b></footer>
        </article>)}
      </section>
      <section className="grade-plan-lock-note"><b>🔒 لا توجد خانات تعديل لهذه الخطة.</b><span>لأي تغيير استخدم «اختيار خطة جديدة». النسخ السابقة ودرجات الطلاب الأصلية لا تُحذف.</span></section>
      {history.length > 1 && <section className="grade-plan-history"><h2>سجل النسخ</h2>{history.map(item => <div key={item.id}><span>نسخة {item.version} — {GRADE_PLAN_MODE_LABELS[item.mode as GradePlanMode] || item.mode}</span><b>{item.status === "active" ? "المعتمدة الآن" : "محفوظة في الأرشيف"}</b><small>{formatDate(item.activatedAt)}</small></div>)}</section>}
    </main>;
  }

  return <main className="grade-plan-page" dir="rtl">
    <section className="grade-plan-builder-hero"><div><span>إعداد احتساب الـ100 درجة</span><h1>{activePlan ? "اختيار خطة توزيع جديدة" : "إعداد توزيع الدرجات لأول مرة"}</h1><p>اختر النظام المناسب ثم راجع مجموع الدرجات. لن يُسمح بالاعتماد حتى يصبح المجموع صحيحًا.</p></div>{activePlan && <button type="button" onClick={() => setBuilding(false)}>العودة للخطة المعتمدة</button>}</section>
    {error && <p className="grade-plan-message">{error}</p>}
    {message && <p className="grade-plan-message">{message}</p>}

    <section className="plan-mode-grid">
      {modes.map(item => <button type="button" key={item} className={mode === item ? "active" : ""} onClick={() => chooseMode(item)}><span>{item === "units" ? "١" : item === "general100" ? "٢" : item === "periods" ? "٣" : "٤"}</span><b>{GRADE_PLAN_MODE_LABELS[item]}</b><small>{planModeDescription(item)}</small></button>)}
    </section>

    <section className="plan-controls">
      {mode === "units" && <label><span>عدد الوحدات</span><input type="number" min="1" inputMode="numeric" value={unitCount} onChange={event => setUnitCount(Math.max(1, Math.floor(Number(event.target.value) || 1)))} /><small>اكتب أي عدد وحدات تحتاجه.</small></label>}
      {mode !== "custom" && <div className="method-choice"><span>طريقة التوزيع</span><button type="button" className={method === "automatic" ? "active" : ""} onClick={() => chooseMethod("automatic")}><b>تلقائي</b><small>اقتراح توزيع متوازن ثم مراجعته</small></button><button type="button" className={method === "manual" ? "active" : ""} onClick={() => chooseMethod("manual")}><b>يدوي</b><small>أنت تحدد الدرجات والعناصر</small></button></div>}
      <button type="button" className="regenerate-button" onClick={regenerate}>{method === "automatic" && mode !== "custom" ? "إنشاء التوزيع التلقائي" : "تجهيز التوزيع"}</button>
    </section>

    <section className="draft-plan-sections">
      {draft.sections.map((section, sectionIndex) => {
        const sectionTotal = total(section.items);
        const sectionValid = Math.abs(sectionTotal - section.max) < .005;
        const sectionMaxLocked = draft.mode === "periods" || draft.mode === "general100" || draft.mode === "custom";
        return <article className={`draft-section ${sectionValid ? "valid" : "invalid"}`} key={section.id}>
          <header>
            <label><span>اسم القسم</span><input value={section.label} onChange={event => updateSection(sectionIndex, { label: event.target.value })} /></label>
            <label><span>درجة القسم</span><input type="number" min="0" step="0.5" value={section.max} readOnly={sectionMaxLocked} onChange={event => updateSection(sectionIndex, { max: Math.max(0, Number(event.target.value) || 0) })} /></label>
            <div className="section-balance"><span>مجموع العناصر</span><strong>{sectionTotal} / {section.max}</strong><small>{sectionValid ? "صحيح" : `الفرق ${roundGrade(section.max - sectionTotal)}`}</small></div>
          </header>
          <div className="draft-items">
            {section.items.map((item, itemIndex) => <div className="draft-item" key={item.id}>
              <label className="item-name"><span>العنصر</span><input value={item.label} onChange={event => updateItem(sectionIndex, itemIndex, { label: event.target.value })} /></label>
              <label><span>النوع</span><select value={item.category} onChange={event => updateItem(sectionIndex, itemIndex, { category: event.target.value as GradeCategory })}>{categories.map(category => <option key={category} value={category}>{GRADE_CATEGORY_LABELS[category]}</option>)}</select></label>
              <label><span>الدرجة</span><input type="number" min="0" step="0.5" value={item.max} onChange={event => updateItem(sectionIndex, itemIndex, { max: Math.max(0, Number(event.target.value) || 0) })} /></label>
              <button type="button" className="remove-item" onClick={() => removeItem(sectionIndex, itemIndex)} disabled={section.items.length <= 1}>حذف</button>
            </div>)}
          </div>
          <button type="button" className="add-item" onClick={() => addItem(sectionIndex)}>+ إضافة عنصر تقييم داخل {section.label}</button>
        </article>;
      })}
    </section>

    <section className={`plan-validation ${validation.valid ? "valid" : "invalid"}`}>
      <div><small>التحقق النهائي</small><h2>{validation.valid ? "الخطة جاهزة للاعتماد" : "الخطة غير مكتملة"}</h2><p>{draft.mode === "periods" ? `الفترة الأولى ${overall[0] || 0}/100 — الفترة الثانية ${overall[1] || 0}/100` : `المجموع النهائي ${overall[0] || 0}/100`}</p></div>
      <div className="validation-errors">{validation.errors.slice(0, 5).map(errorText => <span key={errorText}>• {errorText}</span>)}</div>
      <button type="button" className="approve-plan" disabled={!validation.valid || saving} onClick={() => void approvePlan()}>{saving ? "جارٍ الاعتماد…" : "اعتماد الخطة وقفلها"}</button>
    </section>
  </main>;
}
