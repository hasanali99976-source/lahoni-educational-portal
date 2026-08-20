"use client";

import { useEffect, useState } from "react";

type Question = { id: string; text: string; options: string[]; skill: string };
type Result = { score: number; total: number; percentage: number; plan: string; weakSkills: string[] };
type Diagnostic = { id: string; title: string; instructions: string; questionCount: number; questions: Question[]; completed: boolean; result: Result | null };

export default function StudentDiagnostics({ accessToken }: { accessToken: string }) {
  const [items, setItems] = useState<Diagnostic[]>([]); const [active, setActive] = useState<Diagnostic | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({}); const [message, setMessage] = useState(""); const [loading, setLoading] = useState(true);
  async function load() { setLoading(true); const response = await fetch("/api/student/diagnostics", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }); const data = await response.json(); if (response.ok) setItems(data.diagnostics || []); else setMessage("تعذر تحميل الاختبارات."); setLoading(false); }
  useEffect(() => { void load(); }, [accessToken]);
  async function submit() { if (!active || Object.keys(answers).length !== active.questions.length) return setMessage("أجب عن جميع الأسئلة أولًا."); const response = await fetch("/api/student/diagnostics", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ diagnosticId: active.id, answers }) }); const data = await response.json(); if (!response.ok) return setMessage(data.message || "تعذر تسليم الاختبار."); setActive(null); setAnswers({}); setMessage("تم تسليم الاختبار وظهرت خطتك المقترحة."); await load(); }
  return <section className="student-diagnostics"><div className="student-section-title"><h2>الاختبارات التشخيصية</h2><p>أدِّ الاختبار لتظهر نتيجتك والخطة العلاجية المناسبة.</p></div>{message && <p className="student-diagnostic-message">{message}</p>}{loading ? <p>جارٍ تحميل الاختبارات…</p> : !items.length ? <p>لا توجد اختبارات منشورة لهذه المادة حاليًا.</p> : <div className="student-diagnostic-grid">{items.map((item) => <article key={item.id}><div><strong>{item.title}</strong><small>{item.questionCount} أسئلة</small></div>{item.completed && item.result ? <div className="student-plan"><b>{item.result.percentage}٪ — {item.result.score} من {item.result.total}</b><p>{item.result.plan}</p>{item.result.weakSkills.length > 0 && <small>مهارات تحتاج مراجعة: {item.result.weakSkills.join("، ")}</small>}</div> : <button onClick={() => { setActive(item); setAnswers({}); setMessage(""); }}>بدء الاختبار</button>}</article>)}</div>}
    {active && <div className="diagnostic-modal" role="dialog" aria-modal="true"><section><header><div><small>اختبار تشخيصي</small><h2>{active.title}</h2><p>{active.instructions}</p></div><button onClick={() => setActive(null)}>إغلاق</button></header>{active.questions.map((question, index) => <fieldset key={question.id}><legend>{index + 1}. {question.text}</legend>{question.options.map((option, optionIndex) => <label key={optionIndex}><input type="radio" name={question.id} checked={answers[question.id] === optionIndex} onChange={() => setAnswers((current) => ({ ...current, [question.id]: optionIndex }))} /><span>{option}</span></label>)}</fieldset>)}<button className="submit-diagnostic" onClick={submit}>تسليم الاختبار وإظهار الخطة</button></section></div>}
  </section>;
}
