"use client";

import { useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { tenantCollection } from "../../../lib/teacher-tenant";
import { useTeacherClient } from "../../../lib/teacher-client";

// نسخة الطباعة تقرأ نفس بيانات الطلاب والنتائج، ولا تعدل أي سجل.
type Student = { id: string; name?: string; class?: string; className?: string; code?: string; accessCode?: string; studentCode?: string };
type Result = { id: string; diagnosticId?: string; studentId?: string; score?: number; total?: number; percentage?: number; weakSkills?: string[]; plan?: string; aiPlan?: string; teacherPlan?: string; submittedAt?: string };

const LETTER_CLASS: Record<string, string> = { "أ":"1","ا":"1","ب":"2","ج":"3","د":"4","هـ":"5","ه":"5","و":"6","ز":"7","ح":"8","ط":"9","ي":"10","a":"1","b":"2","c":"3","d":"4","e":"5","f":"6","g":"7","h":"8","i":"9","j":"10" };

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[char] || char));
}

function aliases(student: Student) {
  return [...new Set([student.id, student.code, student.accessCode, student.studentCode].map(value => String(value || "").trim()).filter(Boolean))];
}

function classKey(value: unknown) {
  const raw = String(value || "").trim().replace(/[إآ]/g, "أ");
  if (!raw) return "";
  const western = raw.replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
  const trailingNumber = western.match(/(\d+)\s*$/)?.[1];
  if (trailingNumber) return String(Number(trailingNumber));
  const trailingLetter = raw.match(/([أابجدهـوزحطيA-Ja-j])\s*$/)?.[1];
  if (trailingLetter) return LETTER_CLASS[trailingLetter.toLowerCase()] || LETTER_CLASS[trailingLetter] || raw;
  return raw;
}

function arabicDigits(value: string) {
  return value.replace(/[0-9]/g, digit => "٠١٢٣٤٥٦٧٨٩"[Number(digit)]);
}

function classDisplay(value: string) {
  return /^\d+$/.test(value) ? `الفصل ${arabicDigits(value)}` : value || "فصل غير محدد";
}

function percentOf(result?: Result) {
  if (!result) return 0;
  const percentage = Number(result.percentage);
  if (Number.isFinite(percentage)) return Math.max(0, Math.min(100, Math.round(percentage)));
  return Number(result.total) ? Math.round(Number(result.score || 0) / Number(result.total) * 100) : 0;
}

function levelOf(result?: Result) {
  const percentage = percentOf(result);
  if (!result) return "لم يعمل";
  if (percentage >= 80) return "متقن";
  if (percentage >= 50) return "يحتاج تحسين";
  return "خطة علاجية";
}

function shortText(value: string, max = 110) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean || "—";
}

export default function DiagnosticsPrintEnhancer() {
  const session = useTeacherClient();

  useEffect(() => {
    const onClick = async (event: MouseEvent) => {
      const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>(".diag-head-actions button");
      const label = button?.textContent?.replace(/\s+/g, " ").trim() || "";
      if (!button || !label.includes("تقرير")) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (!session?.teacherId || !session.subjectKey) return window.alert("انتهت جلسة المعلم. أعد تسجيل الدخول.");
      const selectors = document.querySelectorAll<HTMLSelectElement>(".diag-primary-selectors select");
      const selectedClass = selectors[0]?.value || "all";
      const selectedTest = selectors[1]?.value || "";
      const diagnosticTitle = selectors[1]?.selectedOptions[0]?.textContent?.trim() || "الاختبار التشخيصي";
      if (!selectedTest) return window.alert("اختر الاختبار أولًا.");

      button.disabled = true;
      const originalLabel = button.textContent;
      button.textContent = "جارٍ تجهيز التقرير…";
      try {
        const params = new URLSearchParams({ subjectId: session.subjectKey });
        if (session.activeGrade) params.set("grade", String(session.activeGrade));
        const rosterResponse = await fetch(`/api/teacher/students?${params.toString()}`, { cache: "no-store" });
        const rosterData = await rosterResponse.json().catch(() => ({}));
        if (!rosterResponse.ok) throw new Error(rosterData.message || "تعذر تحميل الطلاب.");
        const students = (Array.isArray(rosterData.students) ? rosterData.students : []) as Student[];
        if (!students.length) throw new Error("لا توجد أسماء طلاب في الفصول المحددة.");

        const resultSnapshot = await getDocs(collection(db, tenantCollection(session.teacherId, session.subjectKey as never, "diagnosticResults")));
        const cloudResults = resultSnapshot.docs.map(item => ({ id: item.id, ...(item.data() as Omit<Result, "id">) }));
        const studentIds = [...new Set(students.flatMap(aliases))];
        let backupResults: Result[] = [];
        try {
          const backupResponse = await fetch("/api/teacher/diagnostics/backup-results", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subjectId: session.subjectKey, diagnosticId: selectedTest, studentIds }),
            cache: "no-store",
          });
          const backupData = await backupResponse.json().catch(() => ({}));
          if (backupResponse.ok && Array.isArray(backupData.results)) backupResults = backupData.results;
        } catch {
          backupResults = [];
        }

        const resultMap = new Map<string, Result>();
        [...backupResults, ...cloudResults].filter(result => result.diagnosticId === selectedTest).forEach(result => resultMap.set(result.id, result));
        const studentByAlias = new Map<string, Student>();
        students.forEach(student => aliases(student).forEach(alias => studentByAlias.set(alias, student)));
        const latestByStudent = new Map<string, Result>();
        resultMap.forEach(result => {
          const student = studentByAlias.get(String(result.studentId || "").trim());
          if (!student) return;
          const current = latestByStudent.get(student.id);
          if (!current || String(result.submittedAt || "") >= String(current.submittedAt || "")) latestByStudent.set(student.id, result);
        });

        const grouped = new Map<string, { student: Student; result?: Result }[]>();
        students.forEach(student => {
          const key = classKey(student.className || student.class);
          if (selectedClass !== "all" && key !== selectedClass) return;
          const rows = grouped.get(key) || [];
          rows.push({ student, result: latestByStudent.get(student.id) });
          grouped.set(key, rows);
        });
        const groups = [...grouped.entries()].filter(([, rows]) => rows.length).sort((a, b) => Number(a[0]) - Number(b[0]) || a[0].localeCompare(b[0], "ar", { numeric: true }));
        if (!groups.length) throw new Error("لا توجد أسماء في الفصل المحدد.");

        const logoUrl = `${window.location.origin}/icons/ostadh-lahooni-192.jpg`;
        const pages = groups.map(([key, rows], pageIndex) => {
          rows.sort((a, b) => String(a.student.name || "").localeCompare(String(b.student.name || ""), "ar"));
          const completed = rows.filter(row => row.result);
          const average = completed.length ? Math.round(completed.reduce((sum, row) => sum + percentOf(row.result), 0) / completed.length) : 0;
          const mastered = completed.filter(row => percentOf(row.result) >= 80).length;
          const support = completed.filter(row => percentOf(row.result) < 50).length;
          const skillCounts = new Map<string, number>();
          completed.forEach(row => row.result?.weakSkills?.forEach(skill => skillCounts.set(skill, (skillCounts.get(skill) || 0) + 1)));
          const topSkill = [...skillCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "لا توجد مهارة ضعيفة مشتركة";
          const fontSize = rows.length >= 43 ? 6.3 : rows.length >= 36 ? 6.9 : rows.length >= 30 ? 7.5 : 8.1;
          const rowHeight = Math.max(3.6, Math.min(5.6, 123 / rows.length));
          const bodyRows = rows.map((row, index) => {
            const result = row.result;
            const percentage = percentOf(result);
            const plan = result ? (result.teacherPlan || result.aiPlan || result.plan || (percentage < 50 ? "شرح المهارة، تدريب موجه، ثم إعادة قياس قصيرة." : percentage < 80 ? "مراجعة مركزة وتدريبات متدرجة ثم قياس متابعة." : "نشاط إثرائي وتطبيق متقدم للمحافظة على الإتقان.")) : "متابعة الطالب وتشجيعه على أداء الاختبار.";
            const level = levelOf(result);
            const levelClass = !result ? "pending" : percentage >= 80 ? "mastered" : percentage >= 50 ? "improve" : "support";
            return `<tr><td>${index + 1}</td><td class="student">${escapeHtml(row.student.name || row.student.id)}</td><td><span class="state ${result ? "done" : "pending"}">${result ? "تم" : "لم يعمل"}</span></td><td>${result ? `${Number(result.score || 0)}/${Number(result.total || 0)}` : "—"}</td><td class="percent">${result ? `${percentage}%` : "—"}</td><td><span class="level ${levelClass}">${escapeHtml(level)}</span></td><td>${escapeHtml(shortText(result?.weakSkills?.join("، ") || "—", 62))}</td><td class="plan">${escapeHtml(shortText(plan, 115))}</td></tr>`;
          }).join("");
          return `<section class="page ${pageIndex ? "page-break" : ""}" style="--fs:${fontSize}px;--rh:${rowHeight}mm"><header class="top"><div class="brand"><img src="${logoUrl}" alt="شعار البوابة"><div><strong>بوابة أستاذ لحوني التعليمية</strong><small>القياس التشخيصي والخطط العلاجية</small></div></div><div class="title"><span>تحليل فصل كامل</span><h1>تقرير الاختبار التشخيصي</h1></div></header><main class="body"><section class="meta"><div><small>المعلم</small><strong>${escapeHtml(session.teacherName || "المعلم")}</strong></div><div><small>المادة</small><strong>${escapeHtml(session.subject || "المادة")}</strong></div><div><small>الفصل</small><strong>${escapeHtml(classDisplay(key))}</strong></div><div><small>الاختبار</small><strong>${escapeHtml(diagnosticTitle)}</strong></div></section><section class="stats"><article><strong>${rows.length}</strong><span>طلاب الفصل</span></article><article class="done"><strong>${completed.length}</strong><span>أدوا الاختبار</span></article><article class="average"><strong>${average}%</strong><span>متوسط الفصل</span></article><article class="mastered"><strong>${mastered}</strong><span>متقنون</span></article><article class="support"><strong>${support}</strong><span>خطة علاجية</span></article></section><section class="insight"><div><small>الأولوية المهارية المشتركة</small><strong>${escapeHtml(topSkill)}</strong></div><div class="progress"><span style="width:${rows.length ? Math.round(completed.length / rows.length * 100) : 0}%"></span></div><b>إنجاز الاختبار ${rows.length ? Math.round(completed.length / rows.length * 100) : 0}%</b></section><div class="table-wrap"><table><thead><tr><th>م</th><th>الطالب</th><th>الحالة</th><th>الدرجة</th><th>النسبة</th><th>المستوى</th><th>المهارات الضعيفة</th><th>الخطة المختصرة</th></tr></thead><tbody>${bodyRows}</tbody></table></div><footer><span>توقيع المعلم: ______________</span><strong>صفحة واحدة لكل فصل</strong><span>اعتماد الإدارة: ______________</span></footer></main></section>`;
        }).join("");

        const popup = window.open("", "_blank", "width=1450,height=920");
        if (!popup) throw new Error("اسمح بالنوافذ المنبثقة لفتح التقرير.");
        popup.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>تقرير الاختبار التشخيصي</title><style>
@page{size:A4 landscape;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#e8edf2;color:#17324d;font-family:'Segoe UI',Tahoma,Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}.toolbar{position:sticky;top:0;z-index:10;display:flex;justify-content:center;gap:9px;padding:10px;background:#173f61}.toolbar button{border:0;border-radius:10px;padding:10px 18px;font-weight:900;cursor:pointer}.toolbar .print{background:#f3c65b;color:#17324d}.toolbar .close{background:#fff;color:#17324d}.page{width:297mm;height:210mm;margin:6mm auto;background:#fff;overflow:hidden;box-shadow:0 18px 48px rgba(16,42,67,.18)}.page-break{break-before:page;page-break-before:always}.top{height:28mm;padding:4mm 7mm;display:flex;align-items:center;justify-content:space-between;background:linear-gradient(135deg,#173f61,#176c8d 68%,#0f9f8f);color:#fff;position:relative;overflow:hidden}.top:after{content:'';position:absolute;left:-18mm;top:-42mm;width:88mm;height:88mm;border:1.2mm solid rgba(255,255,255,.13);border-radius:50%}.brand{display:flex;align-items:center;gap:3.5mm;position:relative;z-index:1}.brand img{width:14mm;height:14mm;border-radius:4mm;border:1mm solid rgba(255,255,255,.24);background:#fff}.brand strong{display:block;font-size:14px}.brand small{display:block;margin-top:.8mm;font-size:8px;color:#dcecf4}.title{text-align:left;position:relative;z-index:1}.title span{display:inline-block;padding:1.2mm 3mm;border-radius:99px;background:#f3c65b;color:#17324d;font-size:7.8px;font-weight:900}.title h1{margin:2mm 0 0;font-size:18px}.body{height:182mm;padding:3mm 6mm;display:grid;grid-template-rows:auto auto auto minmax(0,1fr) 9mm;gap:2mm}.meta{display:grid;grid-template-columns:1.1fr 1fr .8fr 1.5fr;gap:1.7mm}.meta div{min-height:10mm;padding:1.7mm 2.2mm;border:1px solid #d9e5ed;border-radius:2.5mm;background:#f8fbfd}.meta small{display:block;font-size:6.8px;color:#728799;font-weight:800}.meta strong{display:block;margin-top:.5mm;font-size:8.8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.stats{display:grid;grid-template-columns:repeat(5,1fr);gap:1.6mm}.stats article{padding:1.5mm;border:1px solid #dce7ee;border-radius:2.5mm;text-align:center;background:#f8fbfd}.stats article.done{background:#e7f7ef;color:#116b55}.stats article.average{background:#e8f1ff;color:#2459a8}.stats article.mastered{background:#e4f7ec;color:#0c704e}.stats article.support{background:#fde8eb;color:#a12b39}.stats strong{display:block;font-size:13px;line-height:1}.stats span{display:block;margin-top:.6mm;font-size:7px;font-weight:900}.insight{min-height:10mm;display:grid;grid-template-columns:1.2fr 1fr auto;align-items:center;gap:3mm;padding:1.5mm 2.5mm;border:1px solid #d9e5ed;border-radius:2.5mm;background:linear-gradient(135deg,#f6fbfd,#eef7f7)}.insight div:first-child{display:grid}.insight small{font-size:6.8px;color:#718697;font-weight:800}.insight strong{font-size:8.5px;color:#155f65;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.progress{height:3mm;border-radius:99px;background:#dfe9ee;overflow:hidden}.progress span{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#176c8d,#0f9f8f)}.insight>b{font-size:7.5px;color:#17657a}.table-wrap{min-height:0;overflow:hidden;border:1px solid #c7d7e1;border-radius:2.8mm}table{width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed}th,td{height:var(--rh);padding:.45mm .7mm;border-left:1px solid #dbe6ed;border-top:1px solid #dbe6ed;font-size:var(--fs);line-height:1.05;text-align:center;vertical-align:middle;overflow-wrap:anywhere}thead th{height:7.7mm;background:#214f6a;color:#fff;font-weight:900;border-top:0}th:nth-child(1){width:3%}th:nth-child(2){width:15%}th:nth-child(3){width:7%}th:nth-child(4){width:7%}th:nth-child(5){width:6%}th:nth-child(6){width:9%}th:nth-child(7){width:19%}th:nth-child(8){width:34%}tbody tr:nth-child(even){background:#f8fbfd}.student{text-align:right!important;font-weight:850}.percent{font-weight:950;color:#176c8d}.state,.level{display:inline-block;padding:.7mm 1.3mm;border-radius:99px;font-size:calc(var(--fs) - .6px);font-weight:900;white-space:nowrap}.state.done,.level.mastered{background:#dff5e9;color:#116b4c}.state.pending{background:#fff0d5;color:#8a5a0c}.level.improve{background:#e5efff;color:#2458a2}.level.support{background:#fde4e8;color:#9e2937}.level.pending{background:#edf1f4;color:#667b8b}.plan{text-align:right!important}footer{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;border-top:1px dashed #aabcc8;color:#667b8b;font-size:7.5px}footer span:last-child{text-align:left}footer strong{padding:1mm 3mm;border-radius:99px;border:1px solid #d5aa3f;background:#fff8e5;color:#8b6612;font-size:7.8px}@media print{html,body{background:#fff}.toolbar{display:none}.page{margin:0;box-shadow:none}.page-break{break-before:page;page-break-before:always}}
</style></head><body><div class="toolbar"><button class="print" onclick="window.print()">طباعة أو حفظ PDF</button><button class="close" onclick="window.close()">إغلاق</button></div>${pages}</body></html>`);
        popup.document.close();
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "تعذر تجهيز التقرير.");
      } finally {
        button.disabled = false;
        button.textContent = originalLabel || "تقرير PDF";
      }
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [session?.teacherId, session?.subjectKey, session?.activeGrade, session?.teacherName, session?.subject]);

  return null;
}
