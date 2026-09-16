"use client";

import { useEffect, useMemo, useState } from "react";
import { useTeacherClient } from "../../../lib/teacher-client";
import { normalizeClass } from "../../../lib/unified-roster";

type Lesson = { className?: string };
type TimetableResponse = { ok?: boolean; lessons?: Record<string, Lesson>; message?: string };
const DAY_KEY = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function riyadhToday() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
function weekday(value: string) { return DAY_KEY[new Date(`${value}T12:00:00`).getDay()] || ""; }
function controls() {
  const page = document.querySelector<HTMLElement>(".attendance-page");
  return {
    classSelect: page?.querySelector<HTMLSelectElement>('[data-attendance-class-select="true"]') || null,
    dateInput: page?.querySelector<HTMLInputElement>('[data-attendance-date-input="true"]') || null,
  };
}
function selectClass(select: HTMLSelectElement, className: string) {
  const option = [...select.options].find(item => normalizeClass(item.value) === className);
  if (!option || select.value === option.value) return;
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  if (setter) setter.call(select, option.value); else select.value = option.value;
  select.dispatchEvent(new Event("input", { bubbles: true }));
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

export default function AttendanceScheduleGuardV2() {
  const session = useTeacherClient();
  const subjectKey = session?.subjectKey || "history";
  const grade = session?.activeGrade ? String(session.activeGrade) : "";
  const [lessons, setLessons] = useState<Record<string, Lesson>>({});
  const [selectedDate, setSelectedDate] = useState(riyadhToday());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!session?.teacherId || !subjectKey || !grade) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ subjectId: subjectKey, grade });
    setLoaded(false);
    fetch(`/api/teacher/timetable?${params.toString()}`, { cache: "no-store", credentials: "same-origin", signal: controller.signal })
      .then(async response => {
        const data = await response.json().catch(() => ({})) as TimetableResponse;
        if (!response.ok) throw new Error(data.message || "تعذر تحميل الجدول");
        return data;
      })
      .then(data => setLessons(data.lessons && typeof data.lessons === "object" ? data.lessons : {}))
      .catch(() => setLessons({}))
      .finally(() => setLoaded(true));
    return () => controller.abort();
  }, [session?.teacherId, subjectKey, grade]);

  const scheduledClasses = useMemo(() => {
    const day = weekday(selectedDate), rows: { className: string; period: number }[] = [];
    Object.entries(lessons).forEach(([key, lesson]) => {
      const match = key.match(/^(sunday|monday|tuesday|wednesday|thursday)-([1-7])$/);
      const className = normalizeClass(lesson.className);
      if (match && match[1] === day && className) rows.push({ className, period: Number(match[2]) });
    });
    return [...new Map(rows.sort((a, b) => a.period - b.period).map(row => [row.className, row])).values()];
  }, [lessons, selectedDate]);

  useEffect(() => {
    const sync = () => {
      const { classSelect, dateInput } = controls();
      if (dateInput?.value && dateInput.value !== selectedDate) setSelectedDate(dateInput.value);
      if (!classSelect || !loaded) return;
      const today = riyadhToday();
      if ((dateInput?.value || selectedDate) !== today) {
        [...classSelect.options].forEach(option => { option.disabled = false; });
        return;
      }
      const allowed = new Set(scheduledClasses.map(item => item.className));
      [...classSelect.options].forEach(option => {
        if (!option.value) { option.disabled = false; return; }
        option.disabled = !allowed.has(normalizeClass(option.value));
      });
      if (!allowed.has(normalizeClass(classSelect.value)) && scheduledClasses.length) selectClass(classSelect, scheduledClasses[0].className);
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("change", sync, true);
    window.addEventListener("lahooni:timetable-synced", sync as EventListener);
    return () => {
      observer.disconnect();
      document.removeEventListener("change", sync, true);
      window.removeEventListener("lahooni:timetable-synced", sync as EventListener);
    };
  }, [loaded, scheduledClasses, selectedDate]);

  if (!loaded || selectedDate !== riyadhToday()) return null;
  return <aside dir="rtl" style={{margin:"0 0 14px",padding:"12px 14px",borderRadius:14,background:"#eef8f7",border:"1px solid #cde8e4",color:"#174c4a",fontWeight:700}}>
    {scheduledClasses.length
      ? `الحضور مرتبط بجدول اليوم: ${scheduledClasses.map(item => `${item.className} (الحصة ${item.period})`).join(" • ")}`
      : "لا توجد حصة مسجلة لك اليوم في الجدول؛ أضف حصصك من الجدول الدراسي أولًا."}
  </aside>;
}
