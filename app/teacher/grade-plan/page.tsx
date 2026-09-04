"use client";

import { useMemo, useState } from "react";
import {
  GRADE_CATEGORY_LABELS,
  GRADE_PLAN_MODE_LABELS,
  createAutomaticGradePlan,
  planModeDescription,
  roundGrade,
  validateGradePlanDraft,
  normalizeGradePlan,
  type GradeCategory,
  type GradePlanDraft,
  type GradePlanItem,
  type GradePlanMethod,
  type GradePlanMode,
} from "../../../lib/grade-plan";
import { useGradePlan } from "../../../lib/use-grade-plan";
import { useTeacherClient } from "../../../lib/teacher-client";
import { createLocalGradePlan, saveLocalGradePlan } from "../../../lib/grade-plan-local";
import "./grade-plan-v9.css";

const categories: GradeCategory[] = ["attendance", "participation", "homework", "unitExam", "research", "project", "performance", "custom"];
const modes: GradePlanMode[] = ["units", "general100", "periods", "custom"];

function starter(mode: GradePlanMode, method: GradePlanMethod, unitCount: number): GradePlanDraft {
  const base = createAutomaticGradePlan(mode, unitCount);
  return { ...base, method: mode === "custom" ? "manual" : method };
}
function nextItemId(sectionId: string) { return `${sectionId}-item-${Date.now()}-${Math.random().toString(36).slice(2,6)}`; }
function total(items: GradePlanItem[]) { return roundGrade(items.reduce((sum,item) => sum + Number(item.max || 0),0)); }

export default function GradePlanPage() {
  const session = useTeacherClient();
  const { activePlan, history, loading, error } = useGradePlan(true);
  const [editing, setEditing] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [mode, setMode] = useState<GradePlanMode>("units");
  const [method, setMethod] = useState<GradePlanMethod>("automatic");
  const [unitCount, setUnitCount] = useState(5);
  const [draft, setDraft] = useState<GradePlanDraft>(() => starter("units","automatic",5));
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const validation = useMemo(() => validateGradePlanDraft(draft), [draft]);
  const overall = useMemo(() => draft.mode === "periods" ? draft.sections.map(section => total(section.items)) : [roundGrade(draft.sections.reduce((sum,section) => sum + Number(section.max || 0),0))], [draft]);

  function loadActiveForEdit() {
    if (!activePlan) {
      setMode("units"); setMethod("automatic"); setUnitCount(5); setDraft(starter("units","automatic",5)); setEditing(true); return;
    }
    if (!window.confirm("سيتم فتح نسخة قابلة للتعديل مبنية على الخطة الحالية. الخطة المعتمدة لن تتغير إلا بعد اعتماد النسخة الجديدة. متابعة؟")) return;
    setMode(activePlan.mode);
    setMethod(activePlan.method);
    const count = activePlan.mode === "units" ? activePlan.sections.length : 5;
    setUnitCount(count || 5);
    setDraft({ mode: activePlan.mode, method: activePlan.method, sections: activePlan.sections.map(section => ({ ...section, items: section.items.map(item => ({ ...item })) })) });
    setMessage("تم السماح بالتعديل. لن تتأثر الخطة المعتمدة حتى تضغط «اعتماد النسخة الجديدة».");
    setEditing(true);
  }

  function chooseSuggestion(nextMode: GradePlanMode) {
    const nextMethod: GradePlanMethod = nextMode === "custom" ? "manual" : "automatic";
    setMode(nextMode); setMethod(nextMethod); setDraft(starter(nextMode,nextMethod,unitCount)); setEditing(true); setSuggestionsOpen(false);
    setMessage(`تم تجهيز مقترح ${GRADE_PLAN_MODE_LABELS[nextMode]}. راجعه وعدّله قبل الاعتماد.`);
  }

  function chooseMode(nextMode: GradePlanMode) {
    const nextMethod = nextMode === "custom" ? "manual" : method;
    setMode(nextMode); setMethod(nextMethod); setDraft(starter(nextMode,nextMethod,unitCount));
  }
  function chooseMethod(nextMethod: GradePlanMethod) { if (mode !== "custom") { setMethod(nextMethod); setDraft(current => ({ ...current, method: nextMethod })); } }
  function regenerate() { setDraft(starter(mode,method,unitCount)); setMessage(method === "automatic" ? "تم إنشاء اقتراح جديد ويمكنك تعديله." : "تم تجهيز الخطة للتوزيع اليدوي."); }
  function updateSection(sectionIndex:number, patch:Partial<GradePlanDraft["sections"][number]>) { setDraft(current => ({ ...current, sections: current.sections.map((section,index) => index === sectionIndex ? { ...section,...patch } : section) })); }
  function updateItem(sectionIndex:number,itemIndex:number,patch:Partial<GradePlanItem>) { setDraft(current => ({ ...current,sections:current.sections.map((section,index) => index !== sectionIndex ? section : { ...section,items:section.items.map((item,target) => target === itemIndex ? { ...item,...patch } : item) }) })); }
  function addItem(sectionIndex:number) { setDraft(current => ({ ...current,sections:current.sections.map((section,index) => index !== sectionIndex ? section : { ...section,items:[...section.items,{ id:nextItemId(section.id),label:"عنصر جديد",max:0,category:"custom" }] }) })); }
  function removeItem(sectionIndex:number,itemIndex:number) { setDraft(current => ({ ...current,sections:current.sections.map((section,index) => index !== sectionIndex ? section : { ...section,items:section.items.filter((_,target) => target !== itemIndex) }) })); }

  async function approvePlan() {
    const checked = validateGradePlanDraft(draft);
    if (!checked.valid) return setMessage(checked.errors[0] || "أكمل توزيع الدرجات أولًا.");
    if (!window.confirm("اعتماد هذه النسخة كخطة الدرجات الجديدة؟ سيتم الاحتفاظ بالنسخ السابقة في السجل.")) return;
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/teacher/grade-plan", { method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({ plan:checked.draft }) });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        const serverPlan = normalizeGradePlan(data.activePlan);
        if (serverPlan) saveLocalGradePlan(serverPlan); else if (session.teacherId) saveLocalGradePlan(createLocalGradePlan(checked.draft,session.teacherId,Number(data.version || activePlan?.version || 1)));
        setMessage("تم اعتماد الخطة الجديدة بنجاح."); setEditing(false); window.setTimeout(() => window.location.reload(),350); return;
      }
      if (data.code === "grade_plan_quota_exceeded" && session.teacherId) {
        saveLocalGradePlan(createLocalGradePlan(checked.draft,session.teacherId,(activePlan?.version || 0)+1));
        setMessage("تم اعتماد الخطة على الجهاز."); setEditing(false); return;
      }
      throw new Error(data.message || "تعذر اعتماد الخطة.");
    } catch (saveError) { setMessage(saveError instanceof Error ? saveError.message : "تعذر اعتماد الخطة."); }
    finally { setSaving(false); }
  }

  if (loading) return <main className="gradeplan-v9"><div className="gpv9-loading">جارٍ قراءة الخطة الدراسية…</div></main>;

  if (!editing) {
    return <main className="gradeplan-v9" dir="rtl">
      <section className="gpv9-hero"><div><small>الخطة الدراسية</small><h1>هيكلة الدرجات بدون مخاطرة</h1><p>الخطة هنا للعرض أولًا. لا يبدأ التعديل إلا بعد سماحك، والمقترحات لا تظهر إلا إذا طلبتها.</p></div><span>{activePlan ? "خطة معتمدة" : "لم تعتمد خطة بعد"}</span></section>
      {error ? <p className="gpv9-message">{error}</p> : null}{message ? <p className="gpv9-message">{message}</p> : null}

      {activePlan ? <>
        <section className="gpv9-current">
          <header><div><small>الخطة الحالية</small><h2>{GRADE_PLAN_MODE_LABELS[activePlan.mode]}</h2><p>نسخة {activePlan.version} • {activePlan.method === "automatic" ? "بدأت باقتراح آلي ثم اعتمدها المعلم" : "إعداد يدوي"}</p></div><strong>100 درجة</strong></header>
          <div className="gpv9-section-grid">{activePlan.sections.map(section => <article key={section.id}><header><b>{section.label}</b><span>{section.max}</span></header><div>{section.items.map(item => <span key={item.id}><b>{item.label}</b><small>{item.max} درجة</small></span>)}</div></article>)}</div>
        </section>
        <section className="gpv9-permission"><div><span>🔒</span><h2>التعديل مقفل حاليًا</h2><p>هذا يمنع تغيير هيكلة الدرجات بالخطأ أثناء الرصد. إذا كنت تريد نسخة جديدة افتح التعديل بإذن صريح.</p></div><div><button className="primary" type="button" onClick={loadActiveForEdit}>السماح بالتعديل</button><button type="button" onClick={() => setSuggestionsOpen(value => !value)}>{suggestionsOpen ? "إخفاء المقترحات" : "أحتاج مقترحات"}</button></div></section>
      </> : <section className="gpv9-empty"><span>📘</span><h2>ابدأ بخطة مناسبة لطريقتك</h2><p>يمكنك إنشاء خطة بنفسك أو طلب اقتراح جاهز ثم تعديله قبل الاعتماد.</p><div><button className="primary" type="button" onClick={loadActiveForEdit}>إعداد الخطة بنفسي</button><button type="button" onClick={() => setSuggestionsOpen(value => !value)}>عرض المقترحات</button></div></section>}

      {suggestionsOpen ? <section className="gpv9-suggestions"><header><small>مقترحات اختيارية</small><h2>اختر نقطة بداية فقط</h2><p>كل مقترح قابل للتعديل قبل الاعتماد.</p></header><div>{modes.map(item => <button type="button" key={item} onClick={() => chooseSuggestion(item)}><b>{GRADE_PLAN_MODE_LABELS[item]}</b><small>{planModeDescription(item)}</small><span>استخدام المقترح ←</span></button>)}</div></section> : null}

      {history.length > 1 ? <details className="gpv9-history"><summary>عرض النسخ السابقة ({history.length})</summary><div>{history.map(plan => <span key={plan.id}><b>نسخة {plan.version}</b><small>{GRADE_PLAN_MODE_LABELS[plan.mode]}</small></span>)}</div></details> : null}
    </main>;
  }

  return <main className="gradeplan-v9" dir="rtl">
    <section className="gpv9-edit-head"><div><small>وضع التعديل</small><h1>{activePlan ? "نسخة جديدة من الخطة" : "إعداد الخطة الأولى"}</h1><p>أي تغيير هنا مسودة فقط حتى الاعتماد.</p></div><button type="button" onClick={() => { setEditing(false); setMessage(""); }}>إلغاء والعودة للعرض</button></section>
    {message ? <p className="gpv9-message">{message}</p> : null}

    <section className="gpv9-mode-row">{modes.map(item => <button type="button" key={item} className={mode === item ? "active" : ""} onClick={() => chooseMode(item)}><b>{GRADE_PLAN_MODE_LABELS[item]}</b><small>{planModeDescription(item)}</small></button>)}</section>

    <section className="gpv9-controls">
      {mode === "units" ? <label><span>عدد الوحدات</span><input type="number" min="1" value={unitCount} onChange={event => setUnitCount(Math.max(1,Math.floor(Number(event.target.value)||1)))} /></label> : null}
      {mode !== "custom" ? <div><span>طريقة البداية</span><button type="button" className={method === "automatic" ? "active" : ""} onClick={() => chooseMethod("automatic")}>اقتراح تلقائي</button><button type="button" className={method === "manual" ? "active" : ""} onClick={() => chooseMethod("manual")}>يدوي</button></div> : null}
      <button className="regenerate" type="button" onClick={regenerate}>{method === "automatic" && mode !== "custom" ? "تحديث المقترح" : "تجهيز التوزيع"}</button>
    </section>

    <section className="gpv9-sections">{draft.sections.map((section,sectionIndex) => {
      const sectionTotal = total(section.items); const valid = Math.abs(sectionTotal-section.max) < .005; const locked = draft.mode === "periods" || draft.mode === "general100" || draft.mode === "custom";
      return <article key={section.id} className={valid ? "valid" : "invalid"}><header><label><span>اسم القسم</span><input value={section.label} onChange={event => updateSection(sectionIndex,{label:event.target.value})}/></label><label><span>درجة القسم</span><input type="number" min="0" step="0.5" value={section.max} readOnly={locked} onChange={event => updateSection(sectionIndex,{max:Math.max(0,Number(event.target.value)||0)})}/></label><div><small>المجموع</small><b>{sectionTotal} / {section.max}</b><span>{valid ? "متوازن" : `الفرق ${roundGrade(section.max-sectionTotal)}`}</span></div></header><div className="gpv9-items">{section.items.map((item,itemIndex) => <div key={item.id}><input className="name" value={item.label} onChange={event => updateItem(sectionIndex,itemIndex,{label:event.target.value})}/><select value={item.category} onChange={event => updateItem(sectionIndex,itemIndex,{category:event.target.value as GradeCategory})}>{categories.map(category => <option key={category} value={category}>{GRADE_CATEGORY_LABELS[category]}</option>)}</select><input type="number" min="0" step="0.5" value={item.max} onChange={event => updateItem(sectionIndex,itemIndex,{max:Math.max(0,Number(event.target.value)||0)})}/><button type="button" onClick={() => removeItem(sectionIndex,itemIndex)} disabled={section.items.length<=1}>حذف</button></div>)}</div><button className="add" type="button" onClick={() => addItem(sectionIndex)}>+ إضافة عنصر تقييم</button></article>;
    })}</section>

    <section className={`gpv9-validation ${validation.valid ? "valid" : "invalid"}`}><div><small>التحقق النهائي</small><h2>{validation.valid ? "الخطة جاهزة" : "راجع التوزيع"}</h2><p>{draft.mode === "periods" ? `الفترة الأولى ${overall[0]||0}/100 • الفترة الثانية ${overall[1]||0}/100` : `المجموع ${overall[0]||0}/100`}</p>{validation.errors.slice(0,4).map(item => <span key={item}>• {item}</span>)}</div><button type="button" disabled={!validation.valid || saving} onClick={() => void approvePlan()}>{saving ? "جارٍ الاعتماد..." : "اعتماد النسخة الجديدة"}</button></section>
  </main>;
}
