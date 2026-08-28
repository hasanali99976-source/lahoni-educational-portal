"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { getSubjectConfig } from "../../../lib/subject-config";
import { tenantCollection } from "../../../lib/teacher-tenant";
import { useTeacherClient } from "../../../lib/teacher-client";
import { normalizeClass } from "../../../lib/unified-roster";
import "./timetable.css";

type Lesson = { subject: string; className: string; notes: string };
type Schedule = Record<string, Lesson>;

const days = [
  { key: "sunday", label: "الأحد" },
  { key: "monday", label: "الإثنين" },
  { key: "tuesday", label: "الثلاثاء" },
  { key: "wednesday", label: "الأربعاء" },
  { key: "thursday", label: "الخميس" },
] as const;
const periods = Array.from({ length: 7 }, (_, index) => index + 1);
const emptyLesson = (): Lesson => ({ subject: "", className: "", notes: "" });
const ar = new Intl.NumberFormat("ar-SA-u-nu-arab");
const keyFor = (day: string, period: number) => `${day}-${period}`;

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cleanSchedule(value: unknown, subjectLabel: string) {
  if (!value || typeof value !== "object") return {} as Schedule;
  const cleaned: Schedule = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, raw]) => {
    if (!raw || typeof raw !== "object") return;
    const lesson = raw as Partial<Lesson>;
    const className = normalizeClass(lesson.className);
    if (!className) return;
    cleaned[key] = {
      subject: String(lesson.subject || subjectLabel),
      className,
      notes: String(lesson.notes || ""),
    };
  });
  return cleaned;
}

export default function TimetablePage() {
  const session = useTeacherClient();
  const [classes, setClasses] = useState<string[]>([]);
  const [schedule, setSchedule] = useState<Schedule>({});
  const [selected, setSelected] = useState<{ day: string; period: number } | null>(null);
  const [draft, setDraft] = useState<Lesson>(emptyLesson());
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const teacherId = session?.teacherId || "";
  const subjectKey = session?.subjectKey || "history";
  const subject = getSubjectConfig(subjectKey as never);
  const timetablePath = useMemo(() => teacherId ? tenantCollection(teacherId, subjectKey as never, "timetable") : "", [teacherId, subjectKey]);

  useEffect(() => {
    if (!teacherId || !subjectKey) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ subjectId: subjectKey });
    if (session.activeGrade) params.set("grade", String(session.activeGrade));
    fetch(`/api/teacher/students?${params.toString()}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "تعذر تحميل الفصول");
        return data;
      })
      .then(data => {
        const names = (Array.isArray(data.classes) ? data.classes : [])
          .map((item: Record<string, unknown>) => normalizeClass(item.name))
          .filter(Boolean);
        setClasses([...new Set<string>(names)].sort((a, b) => a.localeCompare(b, "ar", { numeric: true })));
      })
      .catch(error => {
        if (error?.name !== "AbortError") setMessage(error instanceof Error ? error.message : "تعذر تحميل الفصول الرقمية");
      });
    return () => controller.abort();
  }, [teacherId, subjectKey, session.activeGrade]);

  useEffect(() => {
    if (!timetablePath) return;
    return onSnapshot(doc(db, timetablePath, "weekly"), snapshot => {
      const raw = (snapshot.data() as { lessons?: Schedule } | undefined)?.lessons || {};
      const cleaned = cleanSchedule(raw, subject.label);
      setSchedule(cleaned);
      if (JSON.stringify(raw) !== JSON.stringify(cleaned)) {
        void setDoc(doc(db, timetablePath, "weekly"), {
          lessons: cleaned,
          teacherId,
          teacherName: session?.teacherName || "",
          subjectKey,
          cleanedLegacyLetterClassesAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }, { merge: true }).catch(() => undefined);
      }
    }, () => setMessage("تعذر تحميل الجدول"));
  }, [timetablePath, teacherId, subjectKey, subject.label, session?.teacherName]);

  const visibleSchedule = useMemo(() => {
    const allowed = new Set(classes);
    return Object.fromEntries(Object.entries(schedule).filter(([, lesson]) => allowed.has(lesson.className))) as Schedule;
  }, [schedule, classes]);

  const smart = useMemo(() => {
    const dayLoads = days.map(day => ({ day: day.label, key: day.key, count: periods.filter(period => visibleSchedule[keyFor(day.key, period)]).length }));
    const total = dayLoads.reduce((sum, item) => sum + item.count, 0);
    const empty = 35 - total;
    const busiest = [...dayLoads].sort((a, b) => b.count - a.count)[0];
    const quietest = [...dayLoads].sort((a, b) => a.count - b.count)[0];
    const classCounts = new Map<string, number>();
    Object.values(visibleSchedule).forEach(lesson => { if (lesson.className) classCounts.set(lesson.className, (classCounts.get(lesson.className) || 0) + 1); });
    const mostClass = [...classCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    const imbalance = busiest && quietest ? busiest.count - quietest.count : 0;
    const suggestion = total === 0 ? "ابدأ بإضافة أول حصة، وسيحلل المساعد توزيع أسبوعك تلقائيًا." : imbalance >= 3 ? `توزيعك غير متوازن قليلًا؛ ${busiest.day} مزدحم أكثر من ${quietest.day}.` : empty > 10 ? `باقي ${ar.format(empty)} خانة فارغة. يمكنك إكمالها تدريجيًا بدون ضغط.` : "جدولك متوازن ومكتمل بدرجة جيدة.";
    return { total, empty, busiest, quietest, mostClass, imbalance, suggestion, dayLoads, classCounts };
  }, [visibleSchedule]);

  function openCell(day: string, period: number) {
    const current = visibleSchedule[keyFor(day, period)] || emptyLesson();
    setSelected({ day, period });
    setDraft({ ...current, subject: current.subject || subject.label });
    setMessage("");
  }

  function closeEditor() {
    setSelected(null);
    setDraft(emptyLesson());
  }

  async function persist(nextVisible: Schedule, success: string) {
    if (!timetablePath) return;
    try {
      setSaving(true);
      const allowed = new Set(classes);
      const otherStages = Object.fromEntries(
        Object.entries(schedule).filter(([, lesson]) => !allowed.has(lesson.className)),
      ) as Schedule;
      const next = { ...otherStages, ...nextVisible };
      await setDoc(doc(db, timetablePath, "weekly"), {
        lessons: next,
        teacherId,
        teacherName: session?.teacherName || "",
        subjectKey,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      setSchedule(next);
      setMessage(success);
    } catch {
      setMessage("تعذر حفظ الجدول");
    } finally {
      setSaving(false);
    }
  }

  async function saveLesson() {
    if (!selected || !timetablePath) return;
    const canonical = normalizeClass(draft.className);
    if (!canonical || !classes.includes(canonical)) return setMessage("اختر فصلًا رقميًا من فصولك المسندة.");
    const cellKey = keyFor(selected.day, selected.period);
    await persist({ ...visibleSchedule, [cellKey]: { subject: subject.label, className: canonical, notes: draft.notes.trim() } }, "تم حفظ الحصة");
    closeEditor();
  }

  async function clearLesson() {
    if (!selected || !timetablePath) return;
    const next = { ...visibleSchedule };
    delete next[keyFor(selected.day, selected.period)];
    await persist(next, "تم حذف الحصة");
    closeEditor();
  }

  async function clearAll() {
    if (!timetablePath || !window.confirm("سيتم حذف جميع حصص الجدول الأسبوعي للمرحلة الحالية. هل أنت متأكد؟")) return;
    await persist({}, "تم تفريغ جدول المرحلة الحالية بالكامل");
    closeEditor();
  }

  function printTimetable() {
    setMessage("");
    const printable = window.open("", "lahooni-timetable-print", "width=1200,height=850");
    if (!printable) {
      setMessage("تعذر فتح صفحة الطباعة. اسمح بالنوافذ المنبثقة ثم أعد المحاولة.");
      return;
    }

    const rows = days.map(day => {
      const cells = periods.map(period => {
        const lesson = visibleSchedule[keyFor(day.key, period)];
        if (!lesson) return "<td class=\"empty\">—</td>";
        return `<td><strong>${escapeHtml(lesson.subject || subject.label)}</strong><span>${escapeHtml(lesson.className)}</span>${lesson.notes ? `<small>${escapeHtml(lesson.notes)}</small>` : ""}</td>`;
      }).join("");
      return `<tr><th>${escapeHtml(day.label)}</th>${cells}</tr>`;
    }).join("");

    const printedAt = new Intl.DateTimeFormat("ar-SA-u-nu-arab", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date());

    printable.document.open();
    printable.document.write(`<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>الجدول الدراسي - ${escapeHtml(session.teacherName || "المعلم")}</title>
<style>
@page{size:A4 landscape;margin:9mm}
*{box-sizing:border-box}
html,body{margin:0;background:#eef4f7;color:#17384a;font-family:Arial,Tahoma,sans-serif;direction:rtl}
body{padding:18px}.toolbar{display:flex;justify-content:center;gap:10px;margin-bottom:14px}.toolbar button{border:0;border-radius:10px;padding:11px 18px;font:inherit;font-weight:800;cursor:pointer}.toolbar .print{background:#1768c5;color:#fff}.toolbar .close{background:#fff;color:#17384a}
.report{width:min(1120px,100%);margin:auto;background:#fff;padding:18px;border-radius:16px;box-shadow:0 10px 28px rgba(23,56,74,.12)}
header{text-align:center;border-bottom:2px solid #173f5d;padding-bottom:12px;margin-bottom:12px}header small{color:#60798a}h1{margin:5px 0;font-size:25px}header p{margin:4px 0;font-weight:700}
.meta{display:flex;justify-content:center;flex-wrap:wrap;gap:7px;margin:10px 0 14px}.meta span{padding:6px 10px;border-radius:999px;background:#edf5fb;font-size:12px;font-weight:700}
table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #9fb2bd;padding:7px;text-align:center;vertical-align:middle;height:72px;font-size:11px}thead th{height:auto;background:#173f5d;color:#fff}tbody th{width:78px;background:#e9f1f5}td strong,td span,td small{display:block}td strong{color:#1768c5;margin-bottom:4px}td span{font-weight:800}td small{margin-top:4px;color:#5e7380}.empty{color:#a6b2b8;background:#fafcfd}
footer{text-align:center;margin-top:12px;padding-top:9px;border-top:1px solid #cbd8df;color:#617581;font-size:10px}
@media print{html,body{background:#fff}body{padding:0}.toolbar{display:none}.report{width:100%;padding:0;border-radius:0;box-shadow:none}thead th{background:#dce8ee!important;color:#111!important}th,td{break-inside:avoid;page-break-inside:avoid}}
</style>
</head>
<body>
<div class="toolbar"><button class="print" onclick="window.print()">🖨️ طباعة أو حفظ PDF</button><button class="close" onclick="window.close()">إغلاق</button></div>
<main class="report">
<header><small>بوابة أستاذ لحوني التعليمية</small><h1>الجدول الدراسي الأسبوعي</h1><p>${escapeHtml(subject.label)}${session.activeGradeLabel ? ` — ${escapeHtml(session.activeGradeLabel)}` : ""}</p></header>
<div class="meta"><span>المعلم: ${escapeHtml(session.teacherName || "المعلم")}</span><span>عدد الحصص: ${escapeHtml(ar.format(smart.total))}</span><span>تاريخ الطباعة: ${escapeHtml(printedAt)}</span></div>
<table><thead><tr><th>اليوم</th>${periods.map(period => `<th>الحصة ${escapeHtml(ar.format(period))}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>
<footer>تم إنشاء الجدول من بوابة أستاذ لحوني التعليمية</footer>
</main>
<script>window.addEventListener('load',function(){setTimeout(function(){window.focus();window.print();},300);});<\/script>
</body>
</html>`);
    printable.document.close();
  }

  async function smartAdd() {
    if (!classes.length) return setMessage("لا توجد فصول رقمية مختارة لهذه المرحلة.");
    if (smart.empty === 0) return setMessage("الجدول مكتمل ولا توجد خانة فارغة للاقتراح.");
    const className = [...classes].sort((a, b) => (smart.classCounts.get(a) || 0) - (smart.classCounts.get(b) || 0))[0];
    const candidate = [...smart.dayLoads].sort((a, b) => a.count - b.count)
      .flatMap(day => periods.map(period => ({ day: day.key, dayLabel: day.day, period })))
      .find(item => !visibleSchedule[keyFor(item.day, item.period)]);
    if (!candidate) return setMessage("لم أجد خانة مناسبة الآن.");
    if (!window.confirm(`الاقتراح الذكي:\n${subject.label} — ${className}\n${candidate.dayLabel}، الحصة ${ar.format(candidate.period)}\n\nهل تريد إضافتها؟`)) return;
    await persist({ ...visibleSchedule, [keyFor(candidate.day, candidate.period)]: { subject: subject.label, className, notes: "اقتراح ذكي" } }, `أضاف المساعد الذكي ${subject.label} لفصل ${className} في ${candidate.dayLabel}`);
  }

  if (!session) return <main className="timetable-page"><section className="timetable-hero"><h1>الجدول الدراسي</h1><p>جارٍ تحميل الجدول...</p></section></main>;

  return <main className="timetable-page" dir="rtl">
    <section className="timetable-hero"><div><span>📅 تنظيم أسبوعك</span><h1>الجدول الدراسي الذكي</h1><p>{subject.label}{session.activeGradeLabel ? ` — ${session.activeGradeLabel}` : ""}. لا تظهر إلا الفصول الرقمية المختارة.</p></div><div className="timetable-actions no-print"><button type="button" className="print-main" onClick={printTimetable}>🖨 طباعة صفحة واحدة</button><button type="button" className="danger" onClick={() => void clearAll()} disabled={saving}>تفريغ الجدول</button></div></section>
    {message && <p className="timetable-message no-print" role="status">{message}</p>}
    <section className="smart-strip no-print"><div className="smart-head"><span>✨ مساعد الجدول الذكي</span><strong>{smart.suggestion}</strong><button type="button" className="smart-action" onClick={() => void smartAdd()} disabled={saving}>🤖 اقترح وأضف أفضل حصة</button></div><div className="smart-stats"><article><small>الحصص المسجلة</small><b>{ar.format(smart.total)}</b></article><article><small>الخانات الفارغة</small><b>{ar.format(smart.empty)}</b></article><article><small>أكثر يوم ازدحامًا</small><b>{smart.busiest?.count ? smart.busiest.day : "—"}</b></article><article><small>أكثر فصل تكرارًا</small><b>{smart.mostClass ? smart.mostClass[0] : "—"}</b></article></div></section>
    <section className="timetable-meta"><strong>{session.teacherName}</strong><span>{subject.label}</span><span>{session.activeGradeLabel || "جميع المراحل"}</span><span>{ar.format(smart.total)} حصة مسجلة</span></section>
    <section className="table-wrap"><table className="weekly-table"><thead><tr><th>اليوم</th>{periods.map(period => <th key={period}>الحصة {ar.format(period)}</th>)}</tr></thead><tbody>{days.map(day => <tr key={day.key}><th>{day.label}</th>{periods.map(period => { const lesson = visibleSchedule[keyFor(day.key, period)]; return <td key={period}><button type="button" className={`lesson-cell ${lesson ? "filled" : ""}`} onClick={() => openCell(day.key, period)}><small>{ar.format(period)}</small>{lesson ? <><strong>{lesson.subject}</strong><span>{lesson.className}</span>{lesson.notes && <em>{lesson.notes}</em>}</> : <b>＋</b>}</button></td>; })}</tr>)}</tbody></table></section>
    <section className="mobile-days">{days.map(day => <article key={day.key}><h2>{day.label}</h2><div>{periods.map(period => { const lesson = visibleSchedule[keyFor(day.key, period)]; return <button type="button" key={period} className={lesson ? "filled" : ""} onClick={() => openCell(day.key, period)}><span>الحصة {ar.format(period)}</span>{lesson ? <><strong>{subject.label}</strong><small>{lesson.className}</small></> : <b>إضافة الفصل</b>}</button>; })}</div></article>)}</section>
    {selected && <div className="lesson-modal no-print" role="dialog" aria-modal="true"><div className="lesson-editor"><header><div><span>تعديل الحصة {ar.format(selected.period)}</span><h2>{days.find(day => day.key === selected.day)?.label}</h2></div><button type="button" className="close" onClick={closeEditor}>×</button></header><div className="fixed-subject"><span>المادة الحالية</span><strong>{subject.label}</strong><small>{session.activeGradeLabel || ""}</small></div><label><span>الفصل</span><select value={draft.className} onChange={event => setDraft(current => ({ ...current, className: event.target.value }))}><option value="">اختر الفصل</option>{classes.map(className => <option key={className} value={className}>{className}</option>)}</select>{!classes.length && <small>حدد فصولك الرقمية من إدارة الطلاب أولًا.</small>}</label><label><span>ملاحظات اختيارية</span><textarea value={draft.notes} onChange={event => setDraft(current => ({ ...current, notes: event.target.value }))} placeholder="قاعة، نشاط، اختبار..." /></label><footer><button type="button" className="save" onClick={() => void saveLesson()} disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ الحصة"}</button><button type="button" className="delete" onClick={() => void clearLesson()} disabled={saving}>حذف الحصة</button><button type="button" onClick={closeEditor}>إلغاء</button></footer></div></div>}
  </main>;
}
