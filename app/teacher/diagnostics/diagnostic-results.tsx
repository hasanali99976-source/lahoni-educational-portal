"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { tenantCollection } from "../../../lib/teacher-tenant";
import type { SubjectKey } from "../../../lib/subject-config";
import "./diagnostic-results.css";

type Diagnostic = { id: string; title: string };
type Student = {
  id: string;
  name?: string;
  class?: string;
  className?: string;
  code?: string;
  accessCode?: string;
  studentCode?: string;
  active?: boolean;
  rosterActive?: boolean;
};
type Result = {
  id: string;
  diagnosticId: string;
  studentId: string;
  score: number;
  total: number;
  percentage: number;
  plan?: string;
  aiPlan?: string;
  teacherPlan?: string;
  weakSkills?: string[];
  submittedAt?: string;
};
type StatusFilter = "all" | "completed" | "pending";
type RosterRow = { student: Student; result?: Result };

const PORTAL_NAME = "بوابة أستاذ لحوني التعليمية";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char] || char));
}

function classOf(student: Student) {
  return String(student.className || student.class || "").trim();
}

function aliases(student: Student) {
  return [...new Set([student.id, student.code, student.accessCode, student.studentCode].map(value => String(value || "").trim()).filter(Boolean))];
}

function percentOf(result: Result) {
  const value = Number(result.percentage);
  if (Number.isFinite(value)) return Math.max(0, Math.min(100, Math.round(value)));
  const total = Number(result.total) || 0;
  return total ? Math.round((Number(result.score || 0) / total) * 100) : 0;
}

function resultLevel(result: Result) {
  const percentage = percentOf(result);
  if (percentage >= 80) return "متقن";
  if (percentage >= 50) return "يحتاج تحسين";
  return "يحتاج خطة علاجية";
}

function fallbackPlan(result: Result, studentName: string, subjectName: string) {
  const skills = result.weakSkills?.length ? result.weakSkills.join("، ") : "المهارات الأساسية";
  const percentage = percentOf(result);
  if (percentage >= 80) return `خطة إثرائية للطالب ${studentName}: نشاط إثرائي في ${subjectName}، وتكليف تطبيقي قصير، ثم مشاركة الخبرة مع زملائه.`;
  if (percentage >= 50) return `خطة تحسين للطالب ${studentName}: مراجعة ${skills}، حل تدريبات متدرجة، وتصحيح الأخطاء، ثم قياس قصير للتأكد من التحسن.`;
  return `خطة علاجية للطالب ${studentName}: شرح مبسط لمهارات ${skills}، تدريب موجه مع المعلم، واجب علاجي، ثم إعادة قياس قصيرة.`;
}

function dateValue(value?: string) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value?: string) {
  if (!value) return "—";
  try { return new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
  catch { return "—"; }
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export default function DiagnosticResults({
  teacherId,
  subjectKey,
  subjectName,
  diagnostics,
  diagnosticsLoaded,
}: {
  teacherId: string;
  subjectKey: SubjectKey;
  subjectName: string;
  diagnostics: Diagnostic[];
  diagnosticsLoaded: boolean;
}) {
  const [results, setResults] = useState<Result[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [testId, setTestId] = useState("");
  const [className, setClassName] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchName, setSearchName] = useState("");
  const [editing, setEditing] = useState<Result | null>(null);
  const [planText, setPlanText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [message, setMessage] = useState("");
  const resultsPath = tenantCollection(teacherId, subjectKey, "diagnosticResults");
  const studentsPath = tenantCollection(teacherId, subjectKey, "students");

  useEffect(() => {
    const stopResults = onSnapshot(collection(db, resultsPath), snapshot => {
      setResults(snapshot.docs.map(item => ({ id: item.id, ...(item.data() as Omit<Result, "id">) })));
    });
    const stopStudents = onSnapshot(collection(db, studentsPath), snapshot => {
      setStudents(snapshot.docs
        .map(item => ({ id: item.id, ...(item.data() as Omit<Student, "id">) }))
        .filter(student => student.active !== false && student.rosterActive !== false));
    });
    return () => { stopResults(); stopStudents(); };
  }, [resultsPath, studentsPath]);

  const classes = useMemo(() => [...new Set(students.map(classOf).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "ar", { numeric: true })), [students]);

  useEffect(() => {
    if (diagnostics.length && !diagnostics.some(item => item.id === testId)) setTestId(diagnostics[0].id);
  }, [diagnostics, testId]);

  useEffect(() => {
    if (classes.length && !classes.includes(className)) setClassName(classes[0]);
  }, [classes, className]);

  const studentByAlias = useMemo(() => {
    const map = new Map<string, Student>();
    students.forEach(student => aliases(student).forEach(alias => map.set(alias, student)));
    return map;
  }, [students]);

  const latestResultByStudent = useMemo(() => {
    const map = new Map<string, Result>();
    results.filter(result => result.diagnosticId === testId).forEach(result => {
      const student = studentByAlias.get(String(result.studentId || "").trim());
      if (!student) return;
      const current = map.get(student.id);
      if (!current || dateValue(result.submittedAt) >= dateValue(current.submittedAt)) map.set(student.id, result);
    });
    return map;
  }, [results, studentByAlias, testId]);

  const rosterRows = useMemo<RosterRow[]>(() => students
    .filter(student => classOf(student) === className)
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ar"))
    .map(student => ({ student, result: latestResultByStudent.get(student.id) })), [students, className, latestResultByStudent]);

  const completedRows = useMemo(() => rosterRows.filter(row => row.result), [rosterRows]);
  const completedCount = completedRows.length;
  const pendingCount = Math.max(0, rosterRows.length - completedCount);
  const average = completedCount
    ? Math.round(completedRows.reduce((sum, row) => sum + percentOf(row.result as Result), 0) / completedCount)
    : 0;

  const visibleRows = useMemo(() => {
    const search = searchName.trim().toLocaleLowerCase("ar");
    return rosterRows.filter(row => {
      const completed = Boolean(row.result);
      const statusMatches = statusFilter === "all" || (statusFilter === "completed" ? completed : !completed);
      const nameMatches = !search || String(row.student.name || "").toLocaleLowerCase("ar").includes(search);
      return statusMatches && nameMatches;
    });
  }, [rosterRows, statusFilter, searchName]);

  const diagnosticTitle = diagnostics.find(item => item.id === testId)?.title || "الاختبار التشخيصي";
  const smartSummary = !rosterRows.length
    ? "اختر فصلًا يحتوي طلابًا لعرض المتابعة."
    : !completedCount
      ? `لم يبدأ طلاب ${className} هذا الاختبار حتى الآن. يمكن متابعة ${pendingCount} طالبًا وتشجيعهم على الدخول.`
      : pendingCount
        ? `أكمل ${completedCount} من أصل ${rosterRows.length} طالبًا الاختبار، والمتوسط الحالي ${average}٪. ما زال ${pendingCount} طالبًا لم يؤدوا الاختبار.`
        : `أكمل جميع طلاب الفصل الاختبار، ومتوسط الفصل ${average}٪. يمكن الآن توليد الخطط الفردية واعتمادها.`;

  function openPlan(result: Result) {
    const student = studentByAlias.get(String(result.studentId || "").trim());
    setEditing(result);
    setPlanText(result.teacherPlan || result.aiPlan || result.plan || fallbackPlan(result, student?.name || "الطالب", subjectName));
  }

  async function savePlan() {
    if (!editing || !planText.trim()) return;
    await updateDoc(doc(db, resultsPath, editing.id), {
      teacherPlan: planText.trim(),
      updatedAt: new Date().toISOString(),
    });
    setMessage("تم اعتماد خطة الطالب وحفظها.");
    setEditing(null);
    setPlanText("");
  }

  async function generateAiPlans() {
    const rows = completedRows.filter((row): row is { student: Student; result: Result } => Boolean(row.result));
    if (!testId || !className || !rows.length || aiLoading) return;
    setAiLoading(true);
    setMessage("جارٍ تحليل نتائج الفصل واقتراح الخطط بالذكاء الاصطناعي…");
    try {
      const response = await fetch("/api/teacher/diagnostics/remedial-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId: subjectKey,
          subjectName,
          diagnosticId: testId,
          diagnosticTitle,
          className,
          students: rows.map(({ student, result }) => ({
            resultId: result.id,
            studentName: student.name || "الطالب",
            percentage: percentOf(result),
            score: Number(result.score || 0),
            total: Number(result.total || 0),
            weakSkills: result.weakSkills || [],
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "تعذر إنشاء الخطط الذكية.");
      const plans = Array.isArray(data.plans) ? data.plans : [];
      await Promise.all(plans.map((item: { resultId?: string; plan?: string }) => {
        const resultId = String(item.resultId || "");
        const plan = String(item.plan || "").trim();
        if (!resultId || !plan) return Promise.resolve();
        return updateDoc(doc(db, resultsPath, resultId), {
          aiPlan: plan,
          aiPlanUpdatedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }));
      setMessage(`تم إنشاء ${plans.length} خطة ذكية لطلاب الفصل دون تغيير الخطط المعتمدة سابقًا.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر إنشاء الخطط الذكية الآن.");
    } finally {
      setAiLoading(false);
    }
  }

  function downloadCsv() {
    if (!visibleRows.length) return;
    const rows = [
      ["الطالب", "الفصل", "الاختبار", "الحالة", "الدرجة", "النسبة", "المهارات الضعيفة", "الخطة المقترحة", "وقت التسليم"],
      ...visibleRows.map(row => {
        const result = row.result;
        return [
          row.student.name || row.student.id,
          classOf(row.student),
          diagnosticTitle,
          result ? "عمل الاختبار" : "لم يعمل الاختبار",
          result ? `${result.score}/${result.total}` : "—",
          result ? `${percentOf(result)}%` : "—",
          result?.weakSkills?.join(" - ") || "",
          result ? (result.teacherPlan || result.aiPlan || result.plan || fallbackPlan(result, row.student.name || "الطالب", subjectName)) : "",
          result ? formatDate(result.submittedAt) : "",
        ];
      }),
    ];
    const csv = "\uFEFF" + rows.map(row => row.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `متابعة-${diagnosticTitle}-${className}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function printClassReport() {
    if (!className || !testId) return window.alert("اختر الفصل والاختبار أولًا.");
    if (!visibleRows.length) return window.alert("لا توجد أسماء مطابقة للعرض الحالي.");
    const popup = window.open("", "_blank", "width=1400,height=900");
    if (!popup) return;
    const rowsHtml = visibleRows.map((row, index) => {
      const result = row.result;
      const status = result ? "عمل الاختبار" : "لم يعمل الاختبار";
      const plan = result ? (result.teacherPlan || result.aiPlan || result.plan || fallbackPlan(result, row.student.name || "الطالب", subjectName)) : "—";
      return `<tr class="${result ? "done" : "pending"}"><td>${index + 1}</td><td>${escapeHtml(row.student.name || row.student.id)}</td><td>${escapeHtml(status)}</td><td>${result ? `${result.score}/${result.total}` : "—"}</td><td>${result ? `${percentOf(result)}%` : "—"}</td><td>${result ? escapeHtml(resultLevel(result)) : "بانتظار الاختبار"}</td><td>${escapeHtml(result?.weakSkills?.join("، ") || "—")}</td><td>${escapeHtml(plan)}</td></tr>`;
    }).join("");
    popup.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>متابعة الاختبار التشخيصي</title><style>@page{size:A4 landscape;margin:8mm}*{box-sizing:border-box}body{font-family:Arial,Tahoma,sans-serif;color:#172b3a;margin:0}.toolbar{display:flex;justify-content:center;gap:8px;padding:8px;background:#173f61}.toolbar button{border:0;border-radius:8px;padding:9px 16px;font-weight:800;cursor:pointer}.page{padding:5mm}.portal{text-align:center;color:#173f61;font-weight:900;border-bottom:2px solid #173f61;padding-bottom:5px}h1{text-align:center;font-size:18px;margin:8px}.meta,.stats{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #263746}.meta span,.stats span{padding:6px;border-left:1px solid #263746;font-size:11px}.stats{border-top:0}.stats span{font-weight:800}table{width:100%;border-collapse:collapse;margin-top:8px;table-layout:fixed}th,td{border:1px solid #52677a;padding:5px;font-size:8px;vertical-align:top;overflow-wrap:anywhere}th{background:#eaf1f6}.pending{background:#fff7e8}.done{background:#f5fff9}th:nth-child(1){width:3%}th:nth-child(2){width:13%}th:nth-child(3){width:9%}th:nth-child(4){width:7%}th:nth-child(5){width:6%}th:nth-child(6){width:9%}th:nth-child(7){width:17%}th:nth-child(8){width:36%}.footer{margin-top:8px;display:flex;justify-content:space-between;border-top:1px solid #8a9aa8;padding-top:5px;font-size:9px}@media print{.toolbar{display:none}.page{padding:0}}</style></head><body><div class="toolbar"><button onclick="window.print()">طباعة أو حفظ PDF</button><button onclick="window.close()">إغلاق</button></div><main class="page"><div class="portal">${PORTAL_NAME}</div><h1>متابعة أداء الاختبار التشخيصي والخطط العلاجية</h1><div class="meta"><span><b>المادة:</b> ${escapeHtml(subjectName)}</span><span><b>الفصل:</b> ${escapeHtml(className)}</span><span><b>الاختبار:</b> ${escapeHtml(diagnosticTitle)}</span><span><b>عدد الطلاب:</b> ${rosterRows.length}</span></div><div class="stats"><span>عمل الاختبار: ${completedCount}</span><span>لم يعمل: ${pendingCount}</span><span>نسبة الإنجاز: ${rosterRows.length ? Math.round((completedCount / rosterRows.length) * 100) : 0}%</span><span>المتوسط: ${average}%</span></div><table><thead><tr><th>م</th><th>الطالب</th><th>الحالة</th><th>الدرجة</th><th>النسبة</th><th>المستوى</th><th>المهارات الضعيفة</th><th>الخطة المقترحة</th></tr></thead><tbody>${rowsHtml}</tbody></table><div class="footer"><span>توقيع المعلم: __________</span><strong>${PORTAL_NAME}</strong><span>اعتماد الإدارة: __________</span></div></main></body></html>`);
    popup.document.close();
  }

  return <section className="diag-results" dir="rtl">
    <header className="diag-results-head">
      <div><small>متابعة الفصل كاملة</small><h2>من عمل الاختبار ومن لم يعمله؟</h2><p>اختر الفصل والاختبار، وستظهر أسماء جميع الطلاب وحالة كل طالب وخطته المقترحة.</p></div>
      <div className="diag-head-actions"><button onClick={printClassReport} disabled={!className || !testId || !visibleRows.length}>تقرير الفصل PDF</button><button className="secondary" onClick={downloadCsv} disabled={!visibleRows.length}>تحميل Excel</button></div>
    </header>

    <div className="diag-primary-selectors">
      <label><span>١</span><div>اختر الفصل<small>تظهر قائمة طلاب الفصل كاملة</small></div><select value={className} onChange={event => { setClassName(event.target.value); setStatusFilter("all"); setSearchName(""); }}>{classes.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
      <label><span>٢</span><div>اختر الاختبار<small>الاختبارات الحالية محفوظة كما هي</small></div><select value={testId} onChange={event => { setTestId(event.target.value); setStatusFilter("all"); }}>{diagnostics.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
    </div>

    {!diagnosticsLoaded ? <p className="diag-empty">جارٍ تحميل الاختبارات الحالية…</p> : !diagnostics.length ? <p className="diag-empty">لا توجد اختبارات تشخيصية منشأة حتى الآن.</p> : null}

    <div className="diag-stats">
      <article><strong>{rosterRows.length}</strong><span>طلاب الفصل</span></article>
      <article className="done"><strong>{completedCount}</strong><span>عملوا الاختبار</span></article>
      <article className="pending"><strong>{pendingCount}</strong><span>لم يعملوا الاختبار</span></article>
      <article><strong>{average}٪</strong><span>متوسط من اختبروا</span></article>
    </div>

    <section className="diag-ai-summary">
      <div className="diag-ai-icon">AI</div>
      <div><small>اقتراح الذكاء الاصطناعي للفصل</small><strong>{smartSummary}</strong><p>الخطط الذكية تُحفظ كاقتراح مستقل، ولا تستبدل خطة المعلم المعتمدة.</p></div>
      <button onClick={() => void generateAiPlans()} disabled={aiLoading || !completedCount}>{aiLoading ? "جارٍ تحليل النتائج…" : "اقتراح الخطط بالذكاء الاصطناعي"}</button>
    </section>

    {message ? <p className="diag-message">{message}</p> : null}

    <div className="diag-list-tools">
      <label>بحث عن طالب<input value={searchName} onChange={event => setSearchName(event.target.value)} placeholder="اكتب اسم الطالب" /></label>
      <label>حالة الاختبار<select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}><option value="all">جميع الطلاب</option><option value="completed">عملوا الاختبار</option><option value="pending">لم يعملوا الاختبار</option></select></label>
      <button onClick={() => { setSearchName(""); setStatusFilter("all"); }}>إظهار الجميع</button>
    </div>

    <div className="diagnostic-roster">
      {visibleRows.map((row, index) => {
        const result = row.result;
        const code = row.student.code || row.student.accessCode || row.student.studentCode || row.student.id;
        return <article key={row.student.id} className={result ? "completed" : "not-completed"}>
          <div className="diag-student-identity"><b>{index + 1}</b><div><strong>{row.student.name || "طالب دون اسم"}</strong><small>{classOf(row.student)} • {code}</small></div></div>
          <div className="diag-status-cell"><span className={result ? "status-done" : "status-pending"}>{result ? "✓ عمل الاختبار" : "○ لم يعمل الاختبار"}</span>{result ? <small>{formatDate(result.submittedAt)}</small> : <small>بانتظار دخول الطالب</small>}</div>
          <div className="diag-score-cell">{result ? <><strong>{result.score} / {result.total}</strong><span>{percentOf(result)}٪ • {resultLevel(result)}</span></> : <><strong>—</strong><span>لا توجد نتيجة</span></>}</div>
          <div className="diag-skills-cell"><small>المهارات الضعيفة</small><span>{result?.weakSkills?.length ? result.weakSkills.join("، ") : result ? "لا توجد مهارات ضعيفة مسجلة" : "تظهر بعد أداء الاختبار"}</span></div>
          <div className="diag-row-actions">{result ? <button onClick={() => openPlan(result)}>{result.teacherPlan ? "عرض الخطة المعتمدة" : result.aiPlan ? "عرض الخطة الذكية" : "اقتراح الخطة العلاجية"}</button> : <button disabled>لم يؤد الاختبار</button>}</div>
        </article>;
      })}
      {!visibleRows.length ? <p className="diag-empty">لا توجد أسماء مطابقة للبحث أو الحالة المحددة.</p> : null}
    </div>

    {editing ? <div className="diag-modal" role="dialog" aria-modal="true">
      <section><header><div><small>الخطة العلاجية أو الإثرائية</small><h3>{studentByAlias.get(String(editing.studentId || "").trim())?.name || "الطالب"}</h3><p>{diagnosticTitle} • {percentOf(editing)}٪</p></div><button onClick={() => setEditing(null)} aria-label="إغلاق">×</button></header><textarea rows={8} value={planText} onChange={event => setPlanText(event.target.value)} /><div><button onClick={() => setEditing(null)}>إلغاء</button><button className="primary" onClick={() => void savePlan()}>اعتماد وحفظ الخطة</button></div></section>
    </div> : null}
  </section>;
}
