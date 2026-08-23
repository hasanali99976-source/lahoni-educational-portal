"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { tenantCollection } from "../../../lib/teacher-tenant";
import type { SubjectKey } from "../../../lib/subject-config";
import "./diagnostic-results.css";

type Diagnostic = { id: string; title: string };
type Student = { id: string; name?: string; class?: string; nationalId?: string };
type Result = { id: string; diagnosticId: string; studentId: string; score: number; total: number; percentage: number; plan?: string; teacherPlan?: string; weakSkills?: string[]; submittedAt?: string };
type SortKey = "name" | "highest" | "lowest" | "newest";

function suggestedPlan(result: Result, studentName: string, subjectName: string) {
  const skills = result.weakSkills?.length ? result.weakSkills.join("، ") : "المهارات الأساسية";
  if (result.percentage >= 80) return `خطة إثرائية للطالب ${studentName} في مادة ${subjectName}: المحافظة على الإتقان، تنفيذ نشاط إثرائي، وتطبيق المهارات في موقف جديد.`;
  if (result.percentage >= 50) return `خطة تحسين للطالب ${studentName} في مادة ${subjectName}: مراجعة ${skills}، حل تدريبات متدرجة، ثم إعادة قياس قصيرة.`;
  return `خطة علاجية للطالب ${studentName} في مادة ${subjectName}: شرح مبسط لمهارات ${skills}، تدريب موجه، واجب علاجي قصير، ثم إعادة الاختبار.`;
}

export default function DiagnosticResults({ teacherId, subjectKey, subjectName, diagnostics, diagnosticsLoaded }: { teacherId: string; subjectKey: SubjectKey; subjectName: string; diagnostics: Diagnostic[]; diagnosticsLoaded: boolean }) {
  const [results, setResults] = useState<Result[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [testId, setTestId] = useState("all");
  const [className, setClassName] = useState("all");
  const [studentId, setStudentId] = useState("all");
  const [searchName, setSearchName] = useState("");
  const [minimum, setMinimum] = useState(0);
  const [maximum, setMaximum] = useState(100);
  const [sortBy, setSortBy] = useState<SortKey>("highest");
  const [editing, setEditing] = useState<Result | null>(null);
  const [planText, setPlanText] = useState("");
  const cleanedIds = useRef(new Set<string>());
  const resultsPath = tenantCollection(teacherId, subjectKey, "diagnosticResults");
  const studentsPath = tenantCollection(teacherId, subjectKey, "students");

  useEffect(() => {
    const a = onSnapshot(collection(db, resultsPath), snap => setResults(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Result, "id">) }))));
    const b = onSnapshot(collection(db, studentsPath), snap => setStudents(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Student, "id">) }))));
    return () => { a(); b(); };
  }, [resultsPath, studentsPath]);

  const activeDiagnosticIds = useMemo(() => new Set(diagnostics.map(test => test.id)), [diagnostics]);

  useEffect(() => {
    if (!diagnosticsLoaded || !results.length) return;
    const orphaned = results.filter(result => !activeDiagnosticIds.has(result.diagnosticId) && !cleanedIds.current.has(result.id));
    if (!orphaned.length) return;
    orphaned.forEach(result => cleanedIds.current.add(result.id));
    void Promise.all(orphaned.map(result => deleteDoc(doc(db, resultsPath, result.id)).catch(() => cleanedIds.current.delete(result.id))));
  }, [diagnosticsLoaded, results, activeDiagnosticIds, resultsPath]);

  const studentMap = useMemo(() => new Map(students.map(s => [s.id, s])), [students]);
  const testMap = useMemo(() => new Map(diagnostics.map(t => [t.id, t.title])), [diagnostics]);
  const classes = useMemo(() => [...new Set(students.map(s => s.class?.trim()).filter(Boolean) as string[])].sort((a,b)=>a.localeCompare(b,"ar",{numeric:true})), [students]);
  const availableStudents = useMemo(() => students.filter(s => className === "all" || s.class === className).sort((a,b)=>(a.name||"").localeCompare(b.name||"","ar")), [students, className]);
  const visible = useMemo(() => {
    const normalizedSearch = searchName.trim().toLocaleLowerCase("ar");
    const rows = results.filter(r => {
      if (!activeDiagnosticIds.has(r.diagnosticId)) return false;
      const s = studentMap.get(r.studentId);
      const matchesName = !normalizedSearch || (s?.name || "").toLocaleLowerCase("ar").includes(normalizedSearch) || (s?.nationalId || "").includes(normalizedSearch);
      return matchesName && (testId === "all" || r.diagnosticId === testId) && (className === "all" || s?.class === className) && (studentId === "all" || r.studentId === studentId) && r.percentage >= Math.min(minimum, maximum) && r.percentage <= Math.max(minimum, maximum);
    });
    return rows.sort((a,b) => {
      if (sortBy === "lowest") return a.percentage - b.percentage;
      if (sortBy === "newest") return String(b.submittedAt || "").localeCompare(String(a.submittedAt || ""));
      if (sortBy === "name") return (studentMap.get(a.studentId)?.name || "").localeCompare(studentMap.get(b.studentId)?.name || "", "ar");
      return b.percentage - a.percentage;
    });
  }, [results, activeDiagnosticIds, studentMap, testId, className, studentId, searchName, minimum, maximum, sortBy]);
  const average = visible.length ? Math.round(visible.reduce((n,r)=>n+r.percentage,0)/visible.length) : 0;

  function resetFilters() {
    setTestId("all"); setClassName("all"); setStudentId("all"); setSearchName(""); setMinimum(0); setMaximum(100); setSortBy("highest");
  }
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
    <header><div><small>التحليل والخطة العلاجية</small><h2>نتائج الطلاب</h2><p>اختر الفصل أو ابحث بالاسم وحدد نطاق النسبة المطلوبة.</p></div><button onClick={downloadCsv} disabled={!visible.length}>تحميل النتائج والخطط</button></header>
    <div className="diag-filters">
      <label className="diag-search">بحث باسم الطالب<input value={searchName} onChange={e=>setSearchName(e.target.value)} placeholder="اكتب اسم الطالب أو هويته" /></label>
      <label>الفصل<select value={className} onChange={e=>{setClassName(e.target.value);setStudentId("all")}}><option value="all">جميع الفصول</option>{classes.map(c=><option key={c}>{c}</option>)}</select></label>
      <label>الطالب<select value={studentId} onChange={e=>setStudentId(e.target.value)}><option value="all">جميع الطلاب</option>{availableStudents.map(s=><option key={s.id} value={s.id}>{s.name || s.id}</option>)}</select></label>
      <label>الاختبار<select value={testId} onChange={e=>setTestId(e.target.value)}><option value="all">جميع الاختبارات الحالية</option>{diagnostics.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
      <label>من نسبة<input type="number" min="0" max="100" value={minimum} onChange={e=>setMinimum(Math.max(0,Math.min(100,Number(e.target.value))))}/></label>
      <label>إلى نسبة<input type="number" min="0" max="100" value={maximum} onChange={e=>setMaximum(Math.max(0,Math.min(100,Number(e.target.value))))}/></label>
      <label>ترتيب النتائج<select value={sortBy} onChange={e=>setSortBy(e.target.value as SortKey)}><option value="highest">الأعلى نسبة</option><option value="lowest">الأقل نسبة</option><option value="name">حسب الاسم</option><option value="newest">الأحدث</option></select></label>
      <button className="diag-reset" type="button" onClick={resetFilters}>إعادة تعيين</button>
    </div>
    <div className="diag-stats"><article><strong>{visible.length}</strong><span>نتيجة مطابقة</span></article><article><strong>{average}٪</strong><span>متوسط النسبة</span></article><article><strong>{visible.filter(r=>r.percentage<50).length}</strong><span>يحتاجون خطة علاجية</span></article><article><strong>{visible.filter(r=>r.percentage>=80).length}</strong><span>متقنون</span></article></div>
    {!visible.length ? <p className="diag-empty">لا توجد نتائج مطابقة للاختيار الحالي، والنتائج التابعة لاختبارات محذوفة لا تُعرض وتُنظف تلقائيًا.</p> : <div className="diag-table"><table><thead><tr><th>الطالب</th><th>الفصل</th><th>الاختبار</th><th>الدرجة</th><th>النسبة</th><th>المهارات الضعيفة</th><th>الخطة</th></tr></thead><tbody>{visible.map(r=>{const s=studentMap.get(r.studentId);return <tr key={r.id}><td>{s?.name||r.studentId}</td><td>{s?.class||"غير محدد"}</td><td>{testMap.get(r.diagnosticId)}</td><td>{r.score} من {r.total}</td><td><b>{r.percentage}٪</b></td><td>{r.weakSkills?.length?r.weakSkills.join("، "):"لا توجد"}</td><td><button onClick={()=>openPlan(r)}>{r.teacherPlan?"عرض وتعديل":"اقتراح خطة"}</button></td></tr>})}</tbody></table></div>}
    {editing && <div className="diag-modal"><section><header><div><h3>{studentMap.get(editing.studentId)?.name || "الطالب"}</h3><p>{editing.percentage}٪ — {editing.score} من {editing.total}</p></div><button onClick={()=>setEditing(null)}>×</button></header><textarea rows={9} value={planText} onChange={e=>setPlanText(e.target.value)}/><div><button onClick={()=>setPlanText(suggestedPlan(editing, studentMap.get(editing.studentId)?.name||"الطالب", subjectName))}>إعادة اقتراح الخطة</button><button className="primary" onClick={savePlan}>حفظ وإظهارها للطالب</button></div></section></div>}
  </section>;
}
