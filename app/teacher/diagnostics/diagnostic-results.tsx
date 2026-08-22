"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { tenantCollection } from "../../../lib/teacher-tenant";
import type { SubjectKey } from "../../../lib/subject-config";
import "./diagnostic-results.css";

type Diagnostic = { id: string; title: string };
type Student = { id: string; name?: string; class?: string; nationalId?: string };
type Result = { id: string; diagnosticId: string; studentId: string; score: number; total: number; percentage: number; plan?: string; teacherPlan?: string; weakSkills?: string[]; submittedAt?: string };

function suggestedPlan(result: Result, studentName: string, subjectName: string) {
  const skills = result.weakSkills?.length ? result.weakSkills.join("، ") : "المهارات الأساسية";
  if (result.percentage >= 80) return `خطة إثرائية للطالب ${studentName} في مادة ${subjectName}: المحافظة على الإتقان، تنفيذ نشاط إثرائي، وتطبيق المهارات في موقف جديد.`;
  if (result.percentage >= 50) return `خطة تحسين للطالب ${studentName} في مادة ${subjectName}: مراجعة ${skills}، حل تدريبات متدرجة، ثم إعادة قياس قصيرة.`;
  return `خطة علاجية للطالب ${studentName} في مادة ${subjectName}: شرح مبسط لمهارات ${skills}، تدريب موجه، واجب علاجي قصير، ثم إعادة الاختبار.`;
}

export default function DiagnosticResults({ teacherId, subjectKey, subjectName, diagnostics }: { teacherId: string; subjectKey: SubjectKey; subjectName: string; diagnostics: Diagnostic[] }) {
  const [results, setResults] = useState<Result[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [testId, setTestId] = useState("all");
  const [className, setClassName] = useState("all");
  const [studentId, setStudentId] = useState("all");
  const [minimum, setMinimum] = useState(0);
  const [maximum, setMaximum] = useState(100);
  const [editing, setEditing] = useState<Result | null>(null);
  const [planText, setPlanText] = useState("");
  const resultsPath = tenantCollection(teacherId, subjectKey, "diagnosticResults");
  const studentsPath = tenantCollection(teacherId, subjectKey, "students");

  useEffect(() => {
    const a = onSnapshot(collection(db, resultsPath), snap => setResults(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Result, "id">) }))));
    const b = onSnapshot(collection(db, studentsPath), snap => setStudents(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Student, "id">) }))));
    return () => { a(); b(); };
  }, [resultsPath, studentsPath]);

  const studentMap = useMemo(() => new Map(students.map(s => [s.id, s])), [students]);
  const testMap = useMemo(() => new Map(diagnostics.map(t => [t.id, t.title])), [diagnostics]);
  const classes = useMemo(() => [...new Set(students.map(s => s.class?.trim()).filter(Boolean) as string[])].sort(), [students]);
  const visible = useMemo(() => results.filter(r => {
    const s = studentMap.get(r.studentId);
    return (testId === "all" || r.diagnosticId === testId) && (className === "all" || s?.class === className) && (studentId === "all" || r.studentId === studentId) && r.percentage >= minimum && r.percentage <= maximum;
  }).sort((a,b) => b.percentage-a.percentage), [results, studentMap, testId, className, studentId, minimum, maximum]);
  const average = visible.length ? Math.round(visible.reduce((n,r)=>n+r.percentage,0)/visible.length) : 0;

  function openPlan(result: Result) {
    const s = studentMap.get(result.studentId);
    setEditing(result);
    setPlanText(result.teacherPlan || result.plan || suggestedPlan(result, s?.name || "الطالب", subjectName));
  }
  async function savePlan() {
    if (!editing || !planText.trim()) return;
    await updateDoc(doc(db, resultsPath, editing.id), { teacherPlan: planText.trim(), updatedAt: new Date().toISOString() });
    setEditing(null); setPlanText("");
  }
  function downloadCsv() {
    const rows = [["الطالب","الفصل","الاختبار","الدرجة","من","النسبة","المهارات الضعيفة","الخطة العلاجية"], ...visible.map(r => { const s = studentMap.get(r.studentId); return [s?.name || r.studentId, s?.class || "", testMap.get(r.diagnosticId) || "اختبار تشخيصي", String(r.score), String(r.total), String(r.percentage), (r.weakSkills || []).join(" - "), r.teacherPlan || r.plan || suggestedPlan(r, s?.name || "الطالب", subjectName)]; })];
    const csv = "\uFEFF" + rows.map(row => row.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `نتائج-${subjectName}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  return <section className="diag-results" dir="rtl">
    <header><div><small>التحليل والخطة العلاجية</small><h2>نتائج الطلاب</h2><p>استعراض طالب أو فصل، تحديد نطاق النسبة، ثم تنزيل النتائج والخطط.</p></div><button onClick={downloadCsv} disabled={!visible.length}>تحميل النتائج والخطط</button></header>
    <div className="diag-filters">
      <label>الاختبار<select value={testId} onChange={e=>setTestId(e.target.value)}><option value="all">جميع الاختبارات</option>{diagnostics.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
      <label>الفصل<select value={className} onChange={e=>setClassName(e.target.value)}><option value="all">جميع الفصول</option>{classes.map(c=><option key={c}>{c}</option>)}</select></label>
      <label>الطالب<select value={studentId} onChange={e=>setStudentId(e.target.value)}><option value="all">جميع الطلاب</option>{students.filter(s=>className==="all"||s.class===className).map(s=><option key={s.id} value={s.id}>{s.name || s.id}</option>)}</select></label>
      <label>من نسبة<input type="number" min="0" max="100" value={minimum} onChange={e=>setMinimum(Number(e.target.value))}/></label>
      <label>إلى نسبة<input type="number" min="0" max="100" value={maximum} onChange={e=>setMaximum(Number(e.target.value))}/></label>
    </div>
    <div className="diag-stats"><article><strong>{visible.length}</strong><span>نتيجة</span></article><article><strong>{average}٪</strong><span>متوسط النسبة</span></article><article><strong>{visible.filter(r=>r.percentage<50).length}</strong><span>يحتاجون خطة علاجية</span></article><article><strong>{visible.filter(r=>r.percentage>=80).length}</strong><span>متقنون</span></article></div>
    {!visible.length ? <p className="diag-empty">لا توجد نتائج مطابقة للاختيار الحالي.</p> : <div className="diag-table"><table><thead><tr><th>الطالب</th><th>الفصل</th><th>الاختبار</th><th>الدرجة</th><th>النسبة</th><th>المهارات الضعيفة</th><th>الخطة</th></tr></thead><tbody>{visible.map(r=>{const s=studentMap.get(r.studentId);return <tr key={r.id}><td>{s?.name||r.studentId}</td><td>{s?.class||"غير محدد"}</td><td>{testMap.get(r.diagnosticId)||"اختبار تشخيصي"}</td><td>{r.score} من {r.total}</td><td><b>{r.percentage}٪</b></td><td>{r.weakSkills?.length?r.weakSkills.join("، "):"لا توجد"}</td><td><button onClick={()=>openPlan(r)}>{r.teacherPlan?"عرض وتعديل":"اقتراح خطة"}</button></td></tr>})}</tbody></table></div>}
    {editing && <div className="diag-modal"><section><header><div><h3>{studentMap.get(editing.studentId)?.name || "الطالب"}</h3><p>{editing.percentage}٪ — {editing.score} من {editing.total}</p></div><button onClick={()=>setEditing(null)}>×</button></header><textarea rows={9} value={planText} onChange={e=>setPlanText(e.target.value)}/><div><button onClick={()=>setPlanText(suggestedPlan(editing, studentMap.get(editing.studentId)?.name||"الطالب", subjectName))}>إعادة اقتراح الخطة</button><button className="primary" onClick={savePlan}>حفظ وإظهارها للطالب</button></div></section></div>}
  </section>;
}
