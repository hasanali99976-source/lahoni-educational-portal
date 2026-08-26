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

const PORTAL_NAME = "بوابة أستاذ لحوني التعليمية";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char] || char));
}

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
      const matchesName = !normalizedSearch || (s?.name || "").toLocaleLowerCase("ar").includes(normalizedSearch);
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
    const rows = [["الطالب","الفصل","الاختبار","الدرجة","من","النسبة","المهارات الضعيفة","الخطة العلاجية"], ...visible.map(r => {
      const s = studentMap.get(r.studentId);
      return [s?.name || r.studentId, s?.class || "", testMap.get(r.diagnosticId) || "اختبار تشخيصي", String(r.score), String(r.total), String(r.percentage), (r.weakSkills || []).join(" - "), r.teacherPlan || r.plan || suggestedPlan(r, s?.name || "الطالب", subjectName)];
    })];
    const csv = "\uFEFF" + rows.map(row => row.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `نتائج-${className === "all" ? "جميع-الفصول" : className}-${subjectName}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  function printClassPdf() {
    if (className === "all") {
      window.alert("اختر فصلًا محددًا أولًا حتى يتم إنشاء تقرير مستقل له.");
      return;
    }
    if (!visible.length) {
      window.alert("لا توجد نتائج مطابقة لهذا الفصل.");
      return;
    }

    const classAverage = Math.round(visible.reduce((sum, result) => sum + result.percentage, 0) / visible.length);
    const remedialCount = visible.filter(result => result.percentage < 50).length;
    const improvementCount = visible.filter(result => result.percentage >= 50 && result.percentage < 80).length;
    const masteryCount = visible.filter(result => result.percentage >= 80).length;
    const testTitle = testId === "all" ? "جميع الاختبارات التشخيصية" : (testMap.get(testId) || "اختبار تشخيصي");
    const popup = window.open("", "_blank", "width=1200,height=900");
    if (!popup) return;

    const rowsHtml = visible.map((result, index) => {
      const student = studentMap.get(result.studentId);
      const plan = result.teacherPlan || result.plan || suggestedPlan(result, student?.name || "الطالب", subjectName);
      const level = result.percentage >= 80 ? "متقن" : result.percentage >= 50 ? "يحتاج تحسين" : "يحتاج خطة علاجية";
      return `<tr><td>${index + 1}</td><td>${escapeHtml(student?.name || result.studentId)}</td><td>${escapeHtml(testMap.get(result.diagnosticId) || "اختبار تشخيصي")}</td><td>${result.score} من ${result.total}</td><td>${result.percentage}%</td><td>${level}</td><td>${escapeHtml((result.weakSkills || []).join("، ") || "لا توجد")}</td><td>${escapeHtml(plan)}</td></tr>`;
    }).join("");

    popup.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير الاختبارات التشخيصية - ${escapeHtml(className)}</title><style>
      @page{size:A4 landscape;margin:8mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,Tahoma,sans-serif;color:#111;background:#eef2f5}.toolbar{position:sticky;top:0;display:flex;justify-content:center;gap:10px;padding:10px;background:#173f61}.toolbar button{border:0;border-radius:8px;padding:10px 18px;font-weight:800;cursor:pointer}.page{width:281mm;min-height:194mm;margin:8mm auto;background:#fff;padding:7mm}.portal{text-align:center;font-size:14px;font-weight:900;color:#173f61;border-bottom:2px solid #173f61;padding-bottom:5px}h1{text-align:center;font-size:18px;margin:7px 0}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;border:1px solid #222;padding:7px;font-size:10px}.summary{display:grid;grid-template-columns:repeat(5,1fr);border:1px solid #222;border-top:0}.summary span{text-align:center;padding:6px 2px;font-size:9px;font-weight:800;border-left:1px solid #222}.summary span:last-child{border-left:0}table{width:100%;border-collapse:collapse;margin-top:8px;table-layout:fixed}th,td{border:1px solid #222;padding:4px;font-size:8px;vertical-align:top;line-height:1.35}th{background:#edf3f7;text-align:center;font-size:8.5px}th:nth-child(1){width:3%}th:nth-child(2){width:13%}th:nth-child(3){width:11%}th:nth-child(4){width:7%}th:nth-child(5){width:6%}th:nth-child(6){width:9%}th:nth-child(7){width:18%}th:nth-child(8){width:33%}.footer{display:flex;justify-content:space-between;margin-top:8px;border-top:1px solid #666;padding-top:5px;font-size:9px;font-weight:700}@media print{body{background:#fff}.toolbar{display:none}.page{margin:0;width:auto;min-height:auto;padding:0}}
    </style></head><body><div class="toolbar"><button onclick="window.print()">طباعة أو حفظ PDF</button><button onclick="window.close()">إغلاق</button></div><section class="page"><div class="portal">${PORTAL_NAME}</div><h1>تقرير نتائج الاختبارات التشخيصية والخطة العلاجية</h1><div class="meta"><span><b>المادة:</b> ${escapeHtml(subjectName)}</span><span><b>الفصل:</b> ${escapeHtml(className)}</span><span><b>الاختبار:</b> ${escapeHtml(testTitle)}</span><span><b>نطاق النسبة:</b> ${Math.min(minimum, maximum)}% إلى ${Math.max(minimum, maximum)}%</span></div><div class="summary"><span>عدد النتائج: ${visible.length}</span><span>متوسط الفصل: ${classAverage}%</span><span>خطة علاجية: ${remedialCount}</span><span>يحتاج تحسين: ${improvementCount}</span><span>متقنون: ${masteryCount}</span></div><table><thead><tr><th>م</th><th>الطالب</th><th>الاختبار</th><th>الدرجة</th><th>النسبة</th><th>التصنيف</th><th>المهارات الضعيفة</th><th>الخطة العلاجية المقترحة</th></tr></thead><tbody>${rowsHtml}</tbody></table><div class="footer"><span>توقيع المعلم: __________________</span><strong>${PORTAL_NAME}</strong><span>اعتماد الإدارة: __________________</span></div></section></body></html>`);
    popup.document.close();
  }

  return <section className="diag-results" dir="rtl">
    <header><div><small>التحليل والخطة العلاجية</small><h2>نتائج الطلاب حسب الفصل</h2><p>اختر فصلًا محددًا ثم حمّل تقرير PDF مستقلًا يشمل الدرجات والخطة العلاجية.</p></div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button onClick={printClassPdf} disabled={className === "all" || !visible.length}>تقرير الفصل PDF</button><button onClick={downloadCsv} disabled={!visible.length}>تحميل النتائج والخطط</button></div></header>
    <div className="diag-filters">
      <label className="diag-search">بحث باسم الطالب<input value={searchName} onChange={e=>setSearchName(e.target.value)} placeholder="اكتب اسم الطالب" /></label>
      <label>الفصل<select value={className} onChange={e=>{setClassName(e.target.value);setStudentId("all")}}><option value="all">اختر فصلًا أو اعرض الجميع</option>{classes.map(c=><option key={c}>{c}</option>)}</select></label>
      <label>الطالب<select value={studentId} onChange={e=>setStudentId(e.target.value)}><option value="all">جميع الطلاب</option>{availableStudents.map(s=><option key={s.id} value={s.id}>{s.name || s.id}</option>)}</select></label>
      <label>الاختبار<select value={testId} onChange={e=>setTestId(e.target.value)}><option value="all">جميع الاختبارات الحالية</option>{diagnostics.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
      <label>من نسبة<input type="number" min="0" max="100" value={minimum} onChange={e=>setMinimum(Math.max(0,Math.min(100,Number(e.target.value))))}/></label>
      <label>إلى نسبة<input type="number" min="0" max="100" value={maximum} onChange={e=>setMaximum(Math.max(0,Math.min(100,Number(e.target.value))))}/></label>
      <label>ترتيب النتائج<select value={sortBy} onChange={e=>setSortBy(e.target.value as SortKey)}><option value="highest">الأعلى نسبة</option><option value="lowest">الأقل نسبة</option><option value="name">حسب الاسم</option><option value="newest">الأحدث</option></select></label>
      <button className="diag-reset" type="button" onClick={resetFilters}>إعادة تعيين</button>
    </div>
    <div className="diag-stats"><article><strong>{visible.length}</strong><span>نتيجة مطابقة</span></article><article><strong>{average}٪</strong><span>متوسط النسبة</span></article><article><strong>{visible.filter(r=>r.percentage<50).length}</strong><span>يحتاجون خطة علاجية</span></article><article><strong>{visible.filter(r=>r.percentage>=80).length}</strong><span>متقنون</span></article></div>
    {!visible.length ? <p className="diag-empty">لا توجد نتائج مطابقة للاختيار الحالي.</p> : <div className="diag-table"><table><thead><tr><th>الطالب</th><th>الفصل</th><th>الاختبار</th><th>الدرجة</th><th>النسبة</th><th>المهارات الضعيفة</th><th>الخطة</th></tr></thead><tbody>{visible.map(r=>{const s=studentMap.get(r.studentId);return <tr key={r.id}><td>{s?.name||r.studentId}</td><td>{s?.class||"غير محدد"}</td><td>{testMap.get(r.diagnosticId)}</td><td>{r.score} من {r.total}</td><td><b>{r.percentage}٪</b></td><td>{r.weakSkills?.length?r.weakSkills.join("، "):"لا توجد"}</td><td><button onClick={()=>openPlan(r)}>{r.teacherPlan?"عرض وتعديل":"اقتراح خطة"}</button></td></tr>})}</tbody></table></div>}
    {editing && <div className="diag-modal"><section><header><div><h3>{studentMap.get(editing.studentId)?.name || "الطالب"}</h3><p>{editing.percentage}٪ — {editing.score} من {editing.total}</p></div><button onClick={()=>setEditing(null)}>×</button></header><textarea rows={9} value={planText} onChange={e=>setPlanText(e.target.value)}/><div><button onClick={()=>setPlanText(suggestedPlan(editing, studentMap.get(editing.studentId)?.name||"الطالب", subjectName))}>إعادة اقتراح الخطة</button><button className="primary" onClick={savePlan}>حفظ وإظهارها للطالب</button></div></section></div>}
  </section>;
}
