"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTeacherClient } from "../../../lib/teacher-client";
import "./today-lessons-center.css";

type TimetableLesson = { subject?: string; className?: string; notes?: string };
type WorkRow = {
  id: string;
  date: string;
  period: number;
  className: string;
  preparation?: string;
  completedWork?: string;
  prepared?: boolean;
  completed?: boolean;
  updatedAt?: string;
};
type TodayLesson = {
  period: number;
  className: string;
  notes: string;
  work?: WorkRow;
  attendanceDone: boolean;
};

const dayLabels: Record<string, string> = {
  sunday: "الأحد",
  monday: "الاثنين",
  tuesday: "الثلاثاء",
  wednesday: "الأربعاء",
  thursday: "الخميس",
};

function riyadhDate() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(item => [item.type, item.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
function riyadhWeekday() {
  return new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Riyadh", weekday: "long" }).format(new Date()).toLowerCase();
}
const ar = (value: number) => new Intl.NumberFormat("ar-SA-u-nu-arab").format(value);

export default function TodayLessonsCenter() {
  const session = useTeacherClient();
  const subjectId = String(session?.subjectKey || "").split("--")[0];
  const today = useMemo(riyadhDate, []);
  const weekday = useMemo(riyadhWeekday, []);
  const [lessons, setLessons] = useState<TodayLesson[]>([]);
  const [savedRows, setSavedRows] = useState<WorkRow[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<TodayLesson | null>(null);
  const [preparation, setPreparation] = useState("");
  const [completedWork, setCompletedWork] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!subjectId) return;
    setLoading(true);
    try {
      const timetableResponse = await fetch(`/api/teacher/timetable?subjectId=${encodeURIComponent(subjectId)}`, { cache: "no-store" });
      const timetableData = await timetableResponse.json().catch(() => ({}));
      if (!timetableResponse.ok) throw new Error(timetableData.message || "تعذر تحميل جدول اليوم");
      const timetable = timetableData.lessons && typeof timetableData.lessons === "object" ? timetableData.lessons as Record<string, TimetableLesson> : {};
      const scheduled = Object.entries(timetable).flatMap(([cell, lesson]) => {
        const match = cell.match(/^(sunday|monday|tuesday|wednesday|thursday)-([1-7])$/);
        if (!match || match[1] !== weekday || !lesson.className) return [];
        return [{ period: Number(match[2]), className: String(lesson.className), notes: String(lesson.notes || "") }];
      }).sort((a, b) => a.period - b.period);

      const params = new URLSearchParams({ subjectId, date: today });
      [...new Set(scheduled.map(item => item.className))].forEach(className => params.append("className", className));
      const workResponse = await fetch(`/api/teacher/lesson-work?${params.toString()}`, { cache: "no-store" });
      const workData = await workResponse.json().catch(() => ({}));
      const rows = workResponse.ok && Array.isArray(workData.rows) ? workData.rows as WorkRow[] : [];
      const attendance = workResponse.ok && workData.attendance && typeof workData.attendance === "object" ? workData.attendance as Record<string, boolean> : {};
      setSavedRows(rows);
      setAttendanceMap(attendance);
      setLessons(scheduled.map(item => ({
        ...item,
        work: rows.find(row => Number(row.period) === item.period && row.className === item.className),
        attendanceDone: Boolean(attendance[item.className]),
      })));
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تحديث مركز اليوم");
    } finally {
      setLoading(false);
    }
  }, [subjectId, today, weekday]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const refresh = () => void load();
    const visible = () => { if (document.visibilityState === "visible") void load(); };
    window.addEventListener("lahooni:timetable-updated", refresh as EventListener);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("lahooni:timetable-updated", refresh as EventListener);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [load]);

  function openEditor(lesson: TodayLesson) {
    setEditing(lesson);
    setPreparation(lesson.work?.preparation || lesson.notes || "");
    setCompletedWork(lesson.work?.completedWork || "");
    setMessage("");
  }

  async function save() {
    if (!editing || !subjectId) return;
    setSaving(true);
    try {
      const response = await fetch("/api/teacher/lesson-work", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId, date: today, period: editing.period, className: editing.className, preparation, completedWork }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "تعذر حفظ الحصة");
      const row = data.row as WorkRow;
      setSavedRows(current => [row, ...current.filter(item => item.id !== row.id)]);
      setLessons(current => current.map(item => item.period === editing.period && item.className === editing.className ? { ...item, work: row } : item));
      setEditing(null);
      setMessage(completedWork.trim() ? "تم تحديث تحضير الحصة وما تم تنفيذه." : "تم حفظ تحضير الحصة.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر حفظ الحصة");
    } finally { setSaving(false); }
  }

  const currentKeys = useMemo(() => new Set(lessons.map(item => `${item.period}::${item.className}`)), [lessons]);
  const preservedRows = useMemo(() => savedRows.filter(row => !currentKeys.has(`${Number(row.period)}::${row.className}`)).sort((a, b) => Number(a.period) - Number(b.period)), [savedRows, currentKeys]);
  const preparedSaved = savedRows.filter(item => item.prepared).length;
  const completedSaved = savedRows.filter(item => item.completed).length;
  const preparedFromCurrentNotes = lessons.filter(item => !item.work && item.notes).length;
  const preparedCount = preparedSaved + preparedFromCurrentNotes;
  const attendanceClasses = new Set([...lessons.map(item => item.className), ...savedRows.map(item => item.className)]);
  const attendanceCount = [...attendanceClasses].filter(className => attendanceMap[className]).length;

  return <section className="today-center" dir="rtl">
    <header className="today-center-head">
      <div>
        <small>مركز اليوم • {dayLabels[weekday] || "اليوم"}</small>
        <h2>حصصك اليوم مرتبطة بعملك مباشرة</h2>
        <p>الجدول يحدد الحصص الحالية فقط. التحضير وما تم تنفيذه يُحفظان كسجل مستقل داخل الفصل، لذلك تغيير الجدول لا يلغي تقدمك السابق.</p>
      </div>
      <div className="today-center-actions"><button type="button" onClick={() => void load()} disabled={loading}>{loading ? "تحديث…" : "تحديث"}</button><Link href="/teacher/timetable">تعديل الجدول</Link></div>
    </header>

    {message ? <p className="today-center-message">{message}</p> : null}

    <div className="today-center-kpis">
      <span><b>{ar(lessons.length)}</b> حصص الجدول الآن</span>
      <span><b>{ar(preparedCount)}</b> تحضير محفوظ اليوم</span>
      <span><b>{ar(attendanceCount)}</b> حضور محفوظ</span>
      <span><b>{ar(completedSaved)}</b> إنجاز محفوظ اليوم</span>
    </div>

    {lessons.length ? <div className="today-lessons-grid">{lessons.map(lesson => {
      const prepared = Boolean(lesson.work?.prepared || lesson.notes);
      const completed = Boolean(lesson.work?.completed);
      return <article key={`${lesson.period}-${lesson.className}`} className={completed ? "completed" : ""}>
        <div className="today-lesson-period"><small>الحصة</small><b>{ar(lesson.period)}</b></div>
        <div className="today-lesson-main">
          <header><div><h3>{lesson.className}</h3><span>{session?.subject || "المادة"}</span></div><div className="today-lesson-badges"><i className={prepared ? "ok" : "wait"}>{prepared ? "محضرة" : "بدون تحضير"}</i><i className={lesson.attendanceDone ? "ok" : "wait"}>{lesson.attendanceDone ? "الحضور تم" : "الحضور لم يسجل"}</i><i className={completed ? "done" : "wait"}>{completed ? "تم التنفيذ" : "بانتظار التنفيذ"}</i></div></header>
          <div className="today-lesson-summary"><div><small>التحضير</small><p>{lesson.work?.preparation || lesson.notes || "لم يضف تحضير لهذه الحصة بعد."}</p></div><div><small>ما تم في الحصة</small><p>{lesson.work?.completedWork || "بعد الحصة سجل باختصار ما تم تنفيذه."}</p></div></div>
          <footer><button type="button" onClick={() => openEditor(lesson)}>{prepared ? "فتح سجل الحصة" : "إضافة التحضير"}</button><Link href={`/teacher/attendance?class=${encodeURIComponent(lesson.className)}`}>{lesson.attendanceDone ? "مراجعة الحضور" : "تسجيل الحضور"}</Link></footer>
        </div>
      </article>;
    })}</div> : <div className="today-center-empty"><b>لا توجد حصص في جدول اليوم حاليًا</b><span>يمكن تعديل الجدول في أي وقت، وأعمال اليوم المحفوظة لن تتأثر.</span><Link href="/teacher/timetable">فتح الجدول الدراسي</Link></div>}

    {preservedRows.length ? <section className="today-preserved">
      <header><div><small>محفوظ مستقل عن الجدول</small><h3>أعمال اليوم من جدول سابق</h3></div><span>{ar(preservedRows.length)}</span></header>
      <div>{preservedRows.map(row => <article key={row.id}><b>الحصة {ar(Number(row.period))}</b><div><strong>{row.className}</strong><span>{row.preparation || "تحضير محفوظ"}</span><small>{row.completed ? `تم التنفيذ${row.completedWork ? ` • ${row.completedWork}` : ""}` : "التحضير محفوظ"}</small></div>{attendanceMap[row.className] ? <i>الحضور محفوظ</i> : null}</article>)}</div>
    </section> : null}

    {editing ? <div className="today-work-modal" role="dialog" aria-modal="true">
      <section>
        <header><div><small>{editing.className}</small><h3>الحصة {ar(editing.period)} • سجل الحصة</h3></div><button type="button" onClick={() => !saving && setEditing(null)}>×</button></header>
        <label><span>تحضير الحصة</span><textarea value={preparation} onChange={event => setPreparation(event.target.value)} placeholder="عنوان الدرس، الهدف، النشاط أو النقاط التي ستنفذها…"/><small>يُحفظ بتاريخ اليوم داخل سجل الفصل، ولا يعتمد بقاؤه على الجدول الأسبوعي.</small></label>
        <label><span>ما تم تنفيذه <em>بعد الحصة</em></span><textarea value={completedWork} onChange={event => setCompletedWork(event.target.value)} placeholder="ما الذي تم شرحه أو تنفيذه؟ هل بقي شيء للحصة القادمة؟"/></label>
        <footer><button className="save" type="button" onClick={() => void save()} disabled={saving}>{saving ? "جارٍ الحفظ…" : "حفظ سجل الحصة"}</button><button type="button" onClick={() => setEditing(null)} disabled={saving}>إلغاء</button></footer>
      </section>
    </div> : null}
  </section>;
}
