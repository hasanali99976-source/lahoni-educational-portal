"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSubjectConfig } from "../../../lib/subject-config";
import { useTeacherClient } from "../../../lib/teacher-client";
import { normalizeClass } from "../../../lib/unified-roster";
import "./timetable-v9.css";

type Lesson = { subject: string; className: string; notes: string };
type Schedule = Record<string, Lesson>;
type TimetableResponse = { ok?: boolean; lessons?: unknown; message?: string };
type PendingTimetable = { lessons: Schedule; classNames: string[]; updatedAt: string };

const days = [
  { key: "sunday", label: "الأحد" },
  { key: "monday", label: "الاثنين" },
  { key: "tuesday", label: "الثلاثاء" },
  { key: "wednesday", label: "الأربعاء" },
  { key: "thursday", label: "الخميس" },
] as const;
const periods = Array.from({ length: 7 }, (_, index) => index + 1);
const emptyLesson = (): Lesson => ({ subject: "", className: "", notes: "" });
const ar = new Intl.NumberFormat("ar-SA-u-nu-arab");
const keyFor = (day: string, period: number) => `${day}-${period}`;
const REQUEST_TIMEOUT_MS = 6000;

function cleanSchedule(value: unknown, subjectLabel: string) {
  if (!value || typeof value !== "object") return {} as Schedule;
  const cleaned: Schedule = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, raw]) => {
    if (!raw || typeof raw !== "object") return;
    const lesson = raw as Partial<Lesson>;
    const className = normalizeClass(lesson.className);
    if (!className) return;
    cleaned[key] = { subject: String(lesson.subject || subjectLabel), className, notes: String(lesson.notes || "") };
  });
  return cleaned;
}

async function requestTimetable(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  try {
    const response = await fetch(url, { ...init, cache: "no-store", credentials: "same-origin", headers, signal: controller.signal });
    const data = await response.json().catch(() => ({})) as TimetableResponse;
    if (!response.ok) throw new Error(data.message || "تعذر تنفيذ عملية الجدول");
    return data;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw new Error("انتهت مهلة الاتصال. أعد المحاولة.");
    throw error;
  } finally { window.clearTimeout(timer); }
}

function readPendingTimetable(key: string): PendingTimetable | null {
  if (!key) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingTimetable>;
    if (!parsed?.lessons || !Array.isArray(parsed.classNames)) return null;
    return { lessons: parsed.lessons as Schedule, classNames: [...new Set(parsed.classNames.map(normalizeClass).filter(Boolean))], updatedAt: String(parsed.updatedAt || "") };
  } catch { return null; }
}

function writePendingTimetable(key: string, value: PendingTimetable) {
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("lahooni:timetable-updated", { detail: { storageKey: key } }));
}
function removePendingTimetable(key: string) { try { window.localStorage.removeItem(key); } catch {} }
function mergePendingTimetable(serverLessons: Schedule, pending: PendingTimetable) {
  const ownedClasses = new Set(pending.classNames);
  const retained = Object.fromEntries(Object.entries(serverLessons).filter(([, lesson]) => !ownedClasses.has(lesson.className))) as Schedule;
  return { ...retained, ...pending.lessons };
}
function riyadhWeekdayKey() { return new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Riyadh", weekday: "long" }).format(new Date()).toLowerCase(); }

export default function TimetablePage() {
  const session = useTeacherClient();
  const [classes, setClasses] = useState<string[]>([]);
  const [schedule, setSchedule] = useState<Schedule>({});
  const [selected, setSelected] = useState<{ day: string; period: number } | null>(null);
  const [draft, setDraft] = useState<Lesson>(emptyLesson());
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [todayKey, setTodayKey] = useState("");
  const syncQueue = useRef<Promise<void>>(Promise.resolve());
  const syncVersion = useRef(0);
  const teacherId = session?.teacherId || "";
  const subjectKey = session?.subjectKey || "history";
  const workspaceKey = session?.workspaceKey || subjectKey;
  const storageKey = teacherId ? `ostadh-lahooni:timetable:${teacherId}:${workspaceKey}:${session?.activeGrade || "all"}` : "";
  const subject = getSubjectConfig(subjectKey as never);

  useEffect(() => setTodayKey(riyadhWeekdayKey()), []);

  useEffect(() => {
    if (!teacherId || !subjectKey) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ subjectId: subjectKey });
    if (session.activeGrade) params.set("grade", String(session.activeGrade));
    fetch(`/api/teacher/students?${params}`, { cache: "no-store", signal: controller.signal })
      .then(async response => { const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message || "تعذر تحميل الفصول"); return data; })
      .then(data => {
        const names = (Array.isArray(data.classes) ? data.classes : []).map((item: Record<string, unknown>) => normalizeClass(item.name)).filter(Boolean);
        setClasses([...new Set<string>(names)].sort((a,b) => a.localeCompare(b,"ar",{numeric:true})));
      })
      .catch(error => { if ((error as Error)?.name !== "AbortError") setMessage(error instanceof Error ? error.message : "تعذر تحميل الفصول"); });
    return () => controller.abort();
  }, [teacherId, subjectKey, session.activeGrade]);

  useEffect(() => {
    if (!teacherId || !subjectKey) return;
    let mounted = true;
    const initialPending = readPendingTimetable(storageKey);
    if (initialPending) setSchedule(initialPending.lessons);
    requestTimetable(`/api/teacher/timetable?subjectId=${encodeURIComponent(subjectKey)}`)
      .then(data => {
        if (!mounted) return;
        const serverLessons = cleanSchedule(data.lessons, subject.label);
        const latestPending = readPendingTimetable(storageKey);
        setSchedule(latestPending ? mergePendingTimetable(serverLessons, latestPending) : serverLessons);
        if (latestPending) setMessage("يوجد تعديل محفوظ على هذا الجهاز وسيتم مزامنته تلقائيًا.");
      })
      .catch(error => { if (mounted && !initialPending) setMessage(error instanceof Error ? error.message : "تعذر تحميل الجدول"); });
    return () => { mounted = false; };
  }, [teacherId, subjectKey, subject.label, storageKey]);

  const visibleSchedule = useMemo(() => {
    const allowed = new Set(classes);
    return Object.fromEntries(Object.entries(schedule).filter(([, lesson]) => allowed.has(lesson.className))) as Schedule;
  }, [schedule, classes]);

  const smart = useMemo(() => {
    const dayLoads = days.map(day => ({ day: day.label, key: day.key, count: periods.filter(period => visibleSchedule[keyFor(day.key, period)]).length }));
    const total = dayLoads.reduce((sum,item) => sum + item.count, 0);
    const busiest = [...dayLoads].sort((a,b) => b.count - a.count)[0];
    const quietest = [...dayLoads].sort((a,b) => a.count - b.count)[0];
    const classCounts = new Map<string,number>();
    Object.values(visibleSchedule).forEach(lesson => classCounts.set(lesson.className,(classCounts.get(lesson.className)||0)+1));
    const imbalance = (busiest?.count || 0) - (quietest?.count || 0);
    const suggestion = total === 0 ? "ابدأ بحصة واحدة، ثم أكمل أسبوعك بهدوء." : imbalance >= 3 ? `${busiest.day} مزدحم أكثر من ${quietest.day}. يمكن موازنة الجدول.` : "توزيع أسبوعك يبدو متوازنًا.";
    return { total, dayLoads, classCounts, suggestion };
  }, [visibleSchedule]);

  const todayLessons = useMemo(() => periods.map(period => ({ period, lesson: visibleSchedule[keyFor(todayKey, period)] })).filter(item => item.lesson), [visibleSchedule, todayKey]);

  function openCell(day: string, period: number) {
    if (!editMode) return;
    const current = visibleSchedule[keyFor(day, period)] || emptyLesson();
    setSelected({ day, period });
    setDraft({ ...current, subject: current.subject || subject.label });
    setMessage("");
  }
  function closeEditor() { if (!saving) { setSelected(null); setDraft(emptyLesson()); } }

  async function persist(nextVisible: Schedule, success: string) {
    if (!teacherId || !subjectKey || saving) return false;
    if (!classes.length) { setMessage("اختر فصولك أولًا من إدارة الطلاب."); return false; }
    try {
      setSaving(true);
      const localLessons = cleanSchedule(nextVisible, subject.label);
      const pending: PendingTimetable = { lessons: localLessons, classNames: classes, updatedAt: new Date().toISOString() };
      writePendingTimetable(storageKey, pending);
      setSchedule(current => mergePendingTimetable(current, pending));
      setMessage(`${success}. جارٍ المزامنة...`);
      const version = ++syncVersion.current;
      const payload = JSON.stringify({ subjectId: subjectKey, classNames: classes, lessons: localLessons });
      syncQueue.current = syncQueue.current.catch(() => undefined).then(async () => {
        try {
          const data = await requestTimetable("/api/teacher/timetable", { method: "PATCH", body: payload });
          if (version !== syncVersion.current) return;
          removePendingTimetable(storageKey);
          setSchedule(cleanSchedule(data.lessons, subject.label));
          setMessage(success);
        } catch { if (version === syncVersion.current) setMessage("تم الحفظ على الجهاز وستتم المزامنة عند عودة الاتصال."); }
      });
      return true;
    } catch { setMessage("تعذر حفظ الجدول على الجهاز."); return false; }
    finally { setSaving(false); }
  }

  async function saveLesson() {
    if (!selected || saving) return;
    const canonical = normalizeClass(draft.className);
    if (!canonical || !classes.includes(canonical)) return setMessage("اختر فصلًا من فصولك.");
    const saved = await persist({ ...visibleSchedule, [keyFor(selected.day, selected.period)]: { subject: subject.label, className: canonical, notes: draft.notes.trim() } }, "تم حفظ الحصة");
    if (saved) closeEditor();
  }
  async function clearLesson() {
    if (!selected || saving) return;
    const next = { ...visibleSchedule }; delete next[keyFor(selected.day, selected.period)];
    const saved = await persist(next, "تم حذف الحصة"); if (saved) closeEditor();
  }
  async function clearAll() {
    if (!editMode || saving || !window.confirm("هل تريد تفريغ جدول هذه المادة والمرحلة؟")) return;
    await persist({}, "تم تفريغ الجدول");
  }
  async function smartAdd() {
    if (!editMode || saving) return;
    if (!classes.length) return setMessage("اختر فصولك من إدارة الطلاب أولًا.");
    const className = [...classes].sort((a,b) => (smart.classCounts.get(a)||0)-(smart.classCounts.get(b)||0))[0];
    const candidate = [...smart.dayLoads].sort((a,b) => a.count-b.count).flatMap(day => periods.map(period => ({ day:day.key, dayLabel:day.day, period }))).find(item => !visibleSchedule[keyFor(item.day,item.period)]);
    if (!candidate) return setMessage("جدولك مكتمل.");
    if (!window.confirm(`اقتراح بسيط:\n${className} — ${candidate.dayLabel} — الحصة ${ar.format(candidate.period)}\nإضافتها؟`)) return;
    await persist({ ...visibleSchedule, [keyFor(candidate.day,candidate.period)]: { subject:subject.label,className,notes:"" } }, "تمت إضافة الحصة المقترحة");
  }

  if (!session) return <main className="timetable-v9"><p>جارٍ تحميل الجدول...</p></main>;

  return <main className="timetable-v9" dir="rtl">
    <section className="ttv9-hero">
      <div><small>الجدول الدراسي</small><h1>أسبوعك في نظرة واحدة</h1><p>{subject.label}{session.activeGradeLabel ? ` • ${session.activeGradeLabel}` : ""}. الوضع الافتراضي للعرض فقط حتى لا تعدّل شيئًا بالخطأ.</p></div>
      <div className="ttv9-hero-actions"><button className={editMode ? "active" : ""} type="button" onClick={() => { setEditMode(value => !value); setSelected(null); }}>{editMode ? "إنهاء التعديل" : "السماح بالتعديل"}</button><button type="button" onClick={() => window.print()}>طباعة</button></div>
    </section>

    {message ? <p className="ttv9-message">{message}</p> : null}

    <section className="ttv9-today">
      <header><div><small>اليوم</small><h2>{days.find(day => day.key === todayKey)?.label || "اليوم"}</h2></div><span>{todayLessons.length ? `${ar.format(todayLessons.length)} حصص` : "لا توجد حصص"}</span></header>
      <div>{todayLessons.length ? todayLessons.map(item => <article key={item.period}><b>{ar.format(item.period)}</b><span><strong>{item.lesson!.className}</strong><small>{item.lesson!.notes || subject.label}</small></span></article>) : <article className="empty"><span><strong>اليوم هادئ في هذه المادة</strong><small>إذا كان الجدول ناقصًا افتح وضع التعديل.</small></span></article>}</div>
    </section>

    <section className="ttv9-week-head"><div><small>الأسبوع الكامل</small><h2>حصصك موزعة حسب اليوم</h2><p>{smart.suggestion}</p></div>{editMode ? <div><button type="button" onClick={smartAdd} disabled={saving}>اقتراح حصة</button><button type="button" className="danger" onClick={clearAll} disabled={saving}>تفريغ الجدول</button></div> : <span>للتعديل اضغط «السماح بالتعديل»</span>}</section>

    <section className={`ttv9-week ${editMode ? "editing" : ""}`}>
      {days.map(day => <article key={day.key} className={day.key === todayKey ? "today" : ""}>
        <header><div><small>{day.key === todayKey ? "اليوم" : "يوم دراسي"}</small><h3>{day.label}</h3></div><span>{ar.format(smart.dayLoads.find(item => item.key === day.key)?.count || 0)}</span></header>
        <div className="ttv9-periods">{periods.map(period => {
          const lesson = visibleSchedule[keyFor(day.key,period)];
          return <button type="button" key={period} className={lesson ? "filled" : "empty"} disabled={!editMode} onClick={() => openCell(day.key,period)}><b>{ar.format(period)}</b>{lesson ? <span><strong>{lesson.className}</strong><small>{lesson.notes || subject.label}</small></span> : <span><strong>فارغة</strong><small>{editMode ? "اضغط للإضافة" : ""}</small></span>}</button>;
        })}</div>
      </article>)}
    </section>

    {selected ? <div className="ttv9-modal" role="dialog" aria-modal="true"><section><header><div><small>{days.find(day => day.key === selected.day)?.label}</small><h2>الحصة {ar.format(selected.period)}</h2></div><button type="button" onClick={closeEditor}>×</button></header><div className="ttv9-fixed-subject"><span>المادة</span><strong>{subject.label}</strong><small>{session.activeGradeLabel || ""}</small></div><label><span>الفصل</span><select value={draft.className} onChange={event => setDraft(current => ({ ...current,className:event.target.value }))}><option value="">اختر الفصل</option>{classes.map(name => <option key={name}>{name}</option>)}</select></label><label><span>ملاحظة للحصة <em>اختيارية</em></span><textarea value={draft.notes} onChange={event => setDraft(current => ({ ...current,notes:event.target.value }))} placeholder="نشاط، اختبار، قاعة..."/></label><footer><button className="save" type="button" onClick={saveLesson} disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ"}</button><button type="button" onClick={clearLesson} disabled={saving}>حذف الحصة</button><button type="button" onClick={closeEditor}>إلغاء</button></footer></section></div> : null}
  </main>;
}
