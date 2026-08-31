"use client";

import { useEffect, useState } from "react";
import { collection, doc, getDocs, onSnapshot, query, setDoc, where, writeBatch } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { tenantCollection } from "../../../lib/teacher-tenant";
import type { SubjectKey } from "../../../lib/subject-config";
import { useTeacherClient } from "../../../lib/teacher-client";
import AiDiagnosticBuilder from "./ai-diagnostic-builder";
import DiagnosticResults from "./diagnostic-results";
import "./diagnostics.css";

type Question = { id: string; text: string; options: string[]; correctIndex: number; skill: string };
type Diagnostic = { id: string; title: string; instructions: string; published: boolean; questions: Question[]; plans: { low: string; medium: string; high: string } };
const newQuestion = (): Question => ({ id: crypto.randomUUID(), text: "", options: ["", "", "", ""], correctIndex: 0, skill: "" });
const emptyPlans = { low: "راجع المهارات الأساسية مع المعلم، ثم نفّذ أوراق العمل العلاجية وأعد التقييم.", medium: "راجع المهارات التي أخطأت فيها، ونفّذ تدريبًا قصيرًا قبل التقييم التالي.", high: "أداؤك متقن. انتقل إلى الأنشطة الإثرائية وحافظ على المراجعة المنتظمة." };
const optionCounts = [2, 3, 4, 5, 6, 7, 8];
const PORTAL_NAME = "بوابة أستاذ لحوني التعليمية";
const OPTION_LETTERS = ["أ", "ب", "ج", "د", "هـ", "و", "ز", "ح"];

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[character] || character));
}

export default function DiagnosticsPage() {
  const session = useTeacherClient();
  const [items, setItems] = useState<Diagnostic[]>([]);
  const [diagnosticsLoaded, setDiagnosticsLoaded] = useState(false);
  const [title, setTitle] = useState(""); const [instructions, setInstructions] = useState("");
  const [questions, setQuestions] = useState<Question[]>([newQuestion()]); const [plans, setPlans] = useState(emptyPlans);
  const [message, setMessage] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [preview, setPreview] = useState<Diagnostic | null>(null);
  const path = session?.teacherId && session.subjectKey ? tenantCollection(session.teacherId, session.subjectKey as SubjectKey, "diagnostics") : "";
  useEffect(() => {
    setDiagnosticsLoaded(false);
    if (!path) return;
    return onSnapshot(collection(db, path), snapshot => {
      setItems(snapshot.docs.map(item => ({ id: item.id, ...(item.data() as Omit<Diagnostic, "id">) })));
      setDiagnosticsLoaded(true);
    });
  }, [path]);
  function updateQuestion(id: string, patch: Partial<Question>) { setQuestions(current => current.map(question => question.id === id ? { ...question, ...patch } : question)); }
  function setOptionCount(question: Question, count: number) {
    const nextOptions = Array.from({ length: count }, (_, index) => question.options[index] || "");
    updateQuestion(question.id, { options: nextOptions, correctIndex: Math.min(question.correctIndex, count - 1) });
  }
  function useGenerated(generated: Array<Omit<Question, "id">>) {
    setQuestions(generated.map(question => {
      const options = Array.isArray(question.options) ? question.options.slice(0, 8) : [];
      while (options.length < 2) options.push("");
      return { ...question, options, correctIndex: Math.min(Math.max(question.correctIndex || 0, 0), options.length - 1), id: crypto.randomUUID() };
    }));
    if (!title.trim()) setTitle(`اختبار تشخيصي — ${session.subject || "المادة"}`);
  }
  async function save(published: boolean) {
    if (!path || !title.trim() || questions.some(question => !question.text.trim() || question.options.length < 2 || question.options.some(option => !option.trim()) || question.correctIndex < 0 || question.correctIndex >= question.options.length)) return setMessage("أكمل عنوان الاختبار وجميع الأسئلة والخيارات وحدد الإجابة الصحيحة.");
    const id = crypto.randomUUID(); await setDoc(doc(db, path, id), { title: title.trim(), instructions: instructions.trim(), published, questions, plans, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    setTitle(""); setInstructions(""); setQuestions([newQuestion()]); setPlans(emptyPlans); setMessage(published ? "تم نشر الاختبار في بوابة الطالب." : "تم حفظ الاختبار كمسودة.");
  }
  async function deleteDiagnostic(item: Diagnostic) {
    if (!path || !session?.teacherId || !session.subjectKey || deletingId) return;
    const confirmed = window.confirm(`حذف اختبار «${item.title}» بالكامل؟ سيتم حذف نتائج الطلاب والخطط العلاجية المرتبطة به أيضًا، ولا يمكن التراجع.`);
    if (!confirmed) return;
    setDeletingId(item.id);
    setMessage("جارٍ حذف الاختبار ونتائجه وخططه العلاجية…");
    try {
      const resultsPath = tenantCollection(session.teacherId, session.subjectKey as SubjectKey, "diagnosticResults");
      const relatedResults = await getDocs(query(collection(db, resultsPath), where("diagnosticId", "==", item.id)));
      const refs = [doc(db, path, item.id), ...relatedResults.docs.map(result => result.ref)];
      for (let start = 0; start < refs.length; start += 450) {
        const batch = writeBatch(db);
        refs.slice(start, start + 450).forEach(ref => batch.delete(ref));
        await batch.commit();
      }
      setMessage("تم حذف الاختبار وجميع نتائجه وخططه العلاجية بالكامل.");
    } catch {
      setMessage("تعذر الحذف الكامل. حاول مرة أخرى.");
    } finally {
      setDeletingId("");
    }
  }
  function printPreviewTest(item: Diagnostic) {
    const popup = window.open("", "_blank", "width=1100,height=900");
    if (!popup) return setMessage("تعذر فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة ثم أعد المحاولة.");
    const questionCount = item.questions.length;
    const density = questionCount <= 5 ? "comfortable" : questionCount <= 8 ? "compact" : "dense";
    const questionsHtml = item.questions.map((question, questionIndex) => {
      const optionsHtml = question.options.map((option, optionIndex) => `
        <div class="option ${question.correctIndex === optionIndex ? "correct" : ""}">
          <b>${OPTION_LETTERS[optionIndex] || optionIndex + 1}</b>
          <span>${escapeHtml(option)}</span>
          ${question.correctIndex === optionIndex ? "<strong>الإجابة الصحيحة</strong>" : ""}
        </div>`).join("");
      return `<article class="question">
        <header><b>السؤال ${questionIndex + 1}</b><span>${escapeHtml(question.skill || "مهارة غير محددة")}</span></header>
        <h2>${escapeHtml(question.text)}</h2>
        <div class="options">${optionsHtml}</div>
      </article>`;
    }).join("");
    popup.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${escapeHtml(item.title)}</title><style>
      @page{size:A4 portrait;margin:7mm 8mm 7mm}
      *{box-sizing:border-box}
      html,body{margin:0;padding:0;background:#fff;color:#18364a;font-family:Arial,Tahoma,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      body{padding-top:17mm}
      .print-header{position:fixed;top:0;right:0;left:0;height:13mm;display:flex;align-items:center;justify-content:center;border-bottom:2px solid #173f61;background:#fff;color:#173f61;font-size:15px;font-weight:900;z-index:10}
      .toolbar{position:fixed;top:0;left:0;right:0;z-index:20;display:flex;justify-content:center;gap:8px;padding:8px;background:#173f61}
      .toolbar button{border:0;border-radius:8px;padding:9px 16px;font:700 13px Arial;cursor:pointer}
      main{width:100%;margin:0 auto}
      .test-head{text-align:center;border:1px solid #9fb5c4;border-radius:10px;padding:7px 10px;margin-bottom:7px}
      .test-head h1{font-size:19px;margin:0 0 4px;color:#173f61}
      .test-head p{font-size:10px;margin:0;color:#4d6576}
      .meta{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:7px;font-size:10px}
      .meta span{border:1px solid #b9c9d4;border-radius:7px;padding:5px 7px}
      .questions{display:grid;grid-template-columns:1fr 1fr;gap:6px;align-items:start}
      .question{border:1px solid #aebfca;border-radius:9px;padding:7px;break-inside:avoid;page-break-inside:avoid;background:#fff}
      .question header{display:flex;justify-content:space-between;gap:6px;align-items:center;border-bottom:1px solid #dce6ec;padding-bottom:4px;margin-bottom:4px}
      .question header b{color:#173f61;font-size:11px}
      .question header span{font-size:8px;color:#476579;background:#eef5f8;border-radius:999px;padding:2px 6px}
      .question h2{font-size:11px;line-height:1.45;margin:4px 0 6px}
      .options{display:grid;grid-template-columns:1fr 1fr;gap:3px}
      .option{display:grid;grid-template-columns:18px 1fr auto;gap:4px;align-items:center;border:1px solid #d2dde4;border-radius:6px;padding:3px 4px;font-size:8.5px;min-height:23px}
      .option>b{width:17px;height:17px;display:grid;place-items:center;border-radius:50%;background:#eaf1f6;color:#173f61;font-size:8px}
      .option strong{font-size:6.5px;color:#08735e;white-space:nowrap}
      .option.correct{background:#e9f8f2;border-color:#73bda7}
      .footer{display:flex;justify-content:space-between;gap:8px;border-top:1px solid #8ea4b2;margin-top:7px;padding-top:5px;font-size:8px}
      body.compact{padding-top:15mm}.compact .print-header{height:11mm;font-size:13px}.compact .test-head{padding:5px;margin-bottom:5px}.compact .test-head h1{font-size:16px}.compact .meta{margin-bottom:5px}.compact .questions{gap:4px}.compact .question{padding:5px}.compact .question h2{font-size:9.5px;margin:3px 0 4px}.compact .option{font-size:7.5px;min-height:20px;padding:2px 3px}
      body.dense{padding-top:14mm}.dense .print-header{height:10mm;font-size:12px}.dense .test-head{padding:4px;margin-bottom:4px}.dense .test-head h1{font-size:14px}.dense .test-head p,.dense .meta{font-size:8px}.dense .meta{gap:3px;margin-bottom:4px}.dense .meta span{padding:3px 5px}.dense .questions{gap:3px}.dense .question{padding:4px}.dense .question header{padding-bottom:2px;margin-bottom:2px}.dense .question header b{font-size:9px}.dense .question header span{font-size:6.5px}.dense .question h2{font-size:8.5px;line-height:1.3;margin:2px 0 3px}.dense .options{gap:2px}.dense .option{font-size:6.7px;min-height:18px;padding:1px 2px;grid-template-columns:15px 1fr auto}.dense .option>b{width:14px;height:14px;font-size:6.5px}.dense .option strong{font-size:5.5px}.dense .footer{margin-top:4px;padding-top:3px;font-size:7px}
      @media screen{body{padding-top:58px}.print-header{top:48px}.toolbar{display:flex}main{max-width:820px;padding:12px}}
      @media print{.toolbar{display:none}.print-header{top:0}main{padding:0}.question{box-shadow:none}}
    </style></head><body class="${density}"><div class="toolbar"><button onclick="window.print()">طباعة أو حفظ PDF</button><button onclick="window.close()">إغلاق</button></div><div class="print-header">${PORTAL_NAME}</div><main><section class="test-head"><h1>${escapeHtml(item.title)}</h1><p>${escapeHtml(item.instructions || "اختر الإجابة الصحيحة لكل سؤال")}</p></section><section class="meta"><span><b>المادة:</b> ${escapeHtml(session?.subject || "المادة")}</span><span><b>عدد الأسئلة:</b> ${questionCount}</span></section><section class="questions">${questionsHtml}</section><footer class="footer"><span>اسم الطالب: ____________________</span><strong>${PORTAL_NAME}</strong><span>الدرجة: __________</span></footer></main></body></html>`);
    popup.document.close();
    popup.focus();
  }

  return <main className="diagnostics-page" dir="rtl"><section className="diagnostics-hero"><span>قياس وتشخيص</span><h1>الاختبارات التشخيصية والخطط العلاجية</h1><p>أنشئ اختبارًا للمادة الحالية، وحدد المهارة لكل سؤال، وستُقترح للطالب خطة مناسبة وفق نتيجته.</p></section>
    {session?.teacherId && session.subjectKey ? <DiagnosticResults teacherId={session.teacherId} subjectKey={session.subjectKey as SubjectKey} subjectName={session.subject || "المادة"} activeGrade={session.activeGrade || null} diagnostics={items.map(item => ({ id: item.id, title: item.title }))} diagnosticsLoaded={diagnosticsLoaded} /> : null}
    <AiDiagnosticBuilder subjectId={session.subjectKey || ""} subjectName={session.subject || "المادة"} onGenerated={useGenerated} onMessage={setMessage} />
    <section id="manual-diagnostic-editor" className="diagnostic-builder"><header><div><h2>اختبار جديد</h2><p>الطالب يرى الاختبارات المنشورة فقط.</p></div></header><label>عنوان الاختبار<input value={title} onChange={event => setTitle(event.target.value)} placeholder="الاختبار التشخيصي الأول" /></label><label>تعليمات الطالب<textarea value={instructions} onChange={event => setInstructions(event.target.value)} placeholder="اختر الإجابة الصحيحة لكل سؤال" /></label>
      <div className="questions-editor">{questions.map((question, index) => <article key={question.id}><header><strong>السؤال {index + 1}</strong>{questions.length > 1 && <button onClick={() => setQuestions(current => current.filter(item => item.id !== question.id))}>حذف</button>}</header><input value={question.text} onChange={event => updateQuestion(question.id, { text: event.target.value })} placeholder="نص السؤال" /><input value={question.skill} onChange={event => updateQuestion(question.id, { skill: event.target.value })} placeholder="المهارة التي يقيسها السؤال" /><label className="option-count">عدد خيارات الإجابة<select value={question.options.length} onChange={event => setOptionCount(question, Number(event.target.value))}>{optionCounts.map(count => <option key={count} value={count}>{count} خيارات</option>)}</select></label>{question.options.map((option, optionIndex) => <label className="answer-option" key={optionIndex}><input type="radio" name={`correct-${question.id}`} checked={question.correctIndex === optionIndex} onChange={() => updateQuestion(question.id, { correctIndex: optionIndex })} /><input value={option} onChange={event => { const options = [...question.options]; options[optionIndex] = event.target.value; updateQuestion(question.id, { options }); }} placeholder={`الخيار ${optionIndex + 1}`} /></label>)}</article>)}</div><button className="add-question" onClick={() => setQuestions(current => [...current, newQuestion()])}>+ إضافة سؤال</button>
      <section className="plan-editor"><h3>الخطة العلاجية حسب النتيجة</h3><label>أقل من ٥٠٪<textarea value={plans.low} onChange={event => setPlans({ ...plans, low: event.target.value })} /></label><label>من ٥٠٪ إلى ٧٩٪<textarea value={plans.medium} onChange={event => setPlans({ ...plans, medium: event.target.value })} /></label><label>٨٠٪ فأعلى<textarea value={plans.high} onChange={event => setPlans({ ...plans, high: event.target.value })} /></label></section>{message && <p className="diagnostic-message">{message}</p>}<div className="builder-actions"><button onClick={() => save(false)}>حفظ مسودة</button><button className="primary" onClick={() => save(true)}>نشر للطلاب</button></div></section>
    <section className="diagnostic-list"><h2>اختبارات المادة</h2>{!items.length && <p>لا توجد اختبارات حتى الآن.</p>}{items.map(item => <article key={item.id}><div><strong>{item.title}</strong><small>{item.questions.length} أسئلة • {item.published ? "منشور" : "مسودة"}</small></div><div className="diagnostic-list-actions"><button className="preview-test-button" type="button" onClick={() => setPreview(item)}>معاينة الاختبار</button><button className="delete-test-button" disabled={deletingId === item.id} onClick={() => void deleteDiagnostic(item)}>{deletingId === item.id ? "جارٍ الحذف…" : "حذف بالكامل"}</button></div></article>)}</section>
    {preview ? <div className="diagnostic-preview-modal" role="dialog" aria-modal="true" onClick={() => setPreview(null)}><section onClick={event => event.stopPropagation()}><header><div><small>{preview.published ? "اختبار منشور للطلاب" : "اختبار محفوظ كمسودة"}</small><h2>{preview.title}</h2><p>{preview.instructions || "لا توجد تعليمات إضافية."}</p></div><button type="button" onClick={() => setPreview(null)} aria-label="إغلاق المعاينة">×</button></header><div className="diagnostic-preview-questions">{preview.questions.map((question, questionIndex) => <article key={question.id || questionIndex}><div className="preview-question-title"><b>السؤال {questionIndex + 1}</b><span>{question.skill || "مهارة غير محددة"}</span></div><h3>{question.text}</h3><div className="preview-options">{question.options.map((option, optionIndex) => <div key={optionIndex} className={question.correctIndex === optionIndex ? "correct" : ""}><i>{String.fromCharCode(65 + optionIndex)}</i><span>{option}</span>{question.correctIndex === optionIndex ? <strong>الإجابة الصحيحة</strong> : null}</div>)}</div></article>)}</div><footer><button type="button" onClick={() => printPreviewTest(preview)}>طباعة الاختبار</button><button type="button" className="primary" onClick={() => setPreview(null)}>إغلاق</button></footer></section></div> : null}</main>;
}
