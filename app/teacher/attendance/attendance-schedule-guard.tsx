"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTeacherClient } from "../../../lib/teacher-client";
import { normalizeClass } from "../../../lib/unified-roster";
import "./attendance-schedule-guard.css";

type TimetableLesson = { className?: string; notes?: string; subject?: string };
type TimetableResponse = { ok?: boolean; lessons?: Record<string, TimetableLesson>; message?: string };
type ExistingResponse = { ok?: boolean; exists?: boolean; unavailable?: boolean; message?: string };
type ScheduledDate = { date: string; weekday: number; periods: number[] };

const DAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
};

const DAY_LABEL: Record<number, string> = {
  0: "الأحد",
  1: "الإثنين",
  2: "الثلاثاء",
  3: "الأربعاء",
  4: "الخميس",
  5: "الجمعة",
  6: "السبت",
};

function dateInput(date: Date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function dateObject(value: string) {
  return new Date(`${value}T12:00:00`);
}

function shiftDate(value: string, amount: number) {
  const date = dateObject(value);
  date.setDate(date.getDate() + amount);
  return dateInput(date);
}

function safeId(value: string) {
  return encodeURIComponent(value).replace(/%/g, "_");
}

function arabicNumber(value: number) {
  return new Intl.NumberFormat("ar-SA-u-nu-arab").format(value);
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("ar-SA-u-nu-arab", {
    day: "numeric",
    month: "short",
  }).format(dateObject(value));
}

function dailyControls() {
  const page = document.querySelector<HTMLElement>(".attendance-page");
  const controls = page?.querySelector<HTMLElement>(".attendance-controls");
  return {
    controls,
    classSelect: controls?.querySelector<HTMLSelectElement>("select") || null,
    dateInput: controls?.querySelector<HTMLInputElement>('input[type="date"]') || null,
  };
}

function putDateOnPage(value: string) {
  const input = dailyControls().dateInput;
  if (!input || input.value === value) return;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (setter) setter.call(input, value);
  else input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

export default function AttendanceScheduleGuard() {
  const session = useTeacherClient();
  const teacherId = session?.teacherId || "";
  const subjectKey = session?.subjectKey || "history";
  const [lessons, setLessons] = useState<Record<string, TimetableLesson>>({});
  const [loaded, setLoaded] = useState(false);
  const [loadMessage, setLoadMessage] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedDate, setSelectedDate] = useState(dateInput(new Date()));
  const [remoteSaved, setRemoteSaved] = useState(false);
  const [checkingRemote, setCheckingRemote] = useState(false);
  const [remoteUnavailable, setRemoteUnavailable] = useState(false);
  const [notice, setNotice] = useState("");
  const programmatic = useRef(false);

  useEffect(() => {
    if (!teacherId || !subjectKey) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 9000);
    setLoaded(false);
    setLoadMessage("");
    fetch(`/api/teacher/timetable?subjectId=${encodeURIComponent(subjectKey)}`, {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async response => {
        const data = await response.json().catch(() => ({})) as TimetableResponse;
        if (!response.ok) throw new Error(data.message || "تعذر تحميل الجدول");
        return data;
      })
      .then(data => setLessons(data.lessons && typeof data.lessons === "object" ? data.lessons : {}))
      .catch(error => {
        setLessons({});
        setLoadMessage(error instanceof Error ? error.message : "تعذر تحميل الجدول");
      })
      .finally(() => {
        window.clearTimeout(timer);
        setLoaded(true);
      });
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [teacherId, subjectKey]);

  const classDays = useMemo(() => {
    const result = new Map<string, Map<number, number[]>>();
    Object.entries(lessons).forEach(([cell, lesson]) => {
      const match = cell.match(/^(sunday|monday|tuesday|wednesday|thursday)-([1-7])$/);
      const className = normalizeClass(lesson.className);
      if (!match || !className) return;
      const weekday = DAY_INDEX[match[1]];
      const period = Number(match[2]);
      if (weekday === undefined || !period) return;
      if (!result.has(className)) result.set(className, new Map());
      const days = result.get(className)!;
      days.set(weekday, [...new Set([...(days.get(weekday) || []), period])].sort((a, b) => a - b));
    });
    return result;
  }, [lessons]);

  const normalizedClass = normalizeClass(selectedClass);
  const scheduledDays = normalizedClass ? classDays.get(normalizedClass) : undefined;
  const guardEnabled = loaded && !!scheduledDays?.size;
  const selectedWeekday = selectedDate ? dateObject(selectedDate).getDay() : -1;
  const selectedPeriods = scheduledDays?.get(selectedWeekday) || [];
  const isScheduled = selectedPeriods.length > 0;

  const hasSavedAttendance = useCallback((className: string, value: string) => {
    if (!teacherId || !className || !value || typeof window === "undefined") return false;
    const canonical = normalizeClass(className) || className;
    const currentKey = `lahooni-attendance:${teacherId}:${subjectKey}:${safeId(canonical)}:${value}`;
    const legacyKey = `lahooni-local-attendance:${teacherId}:${subjectKey}:${canonical}:${value}`;
    if (localStorage.getItem(currentKey) || localStorage.getItem(legacyKey)) return true;
    try {
      const index = JSON.parse(localStorage.getItem(`lahooni-attendance-index:${teacherId}:${subjectKey}`) || "{}");
      return Boolean(index?.[`${safeId(canonical)}_${value}`]);
    } catch {
      return false;
    }
  }, [teacherId, subjectKey]);

  const localSaved = hasSavedAttendance(normalizedClass, selectedDate);

  useEffect(() => {
    setRemoteSaved(false);
    setRemoteUnavailable(false);
    setCheckingRemote(false);
    if (!teacherId || !guardEnabled || isScheduled || localSaved || !normalizedClass || !selectedDate) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 6500);
    setCheckingRemote(true);
    const params = new URLSearchParams({
      subjectId: subjectKey,
      className: normalizedClass,
      date: selectedDate,
    });
    fetch(`/api/teacher/attendance/exists?${params.toString()}`, {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async response => {
        const data = await response.json().catch(() => ({})) as ExistingResponse;
        if (!response.ok) throw new Error(data.message || "attendance_exists_failed");
        return data;
      })
      .then(data => setRemoteSaved(data.exists === true))
      .catch(() => {
        // نفشل بشكل مفتوح حتى لا يُحجب أي تحضير قديم عند تعطل الاتصال.
        setRemoteUnavailable(true);
      })
      .finally(() => {
        window.clearTimeout(timer);
        setCheckingRemote(false);
      });

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [teacherId, subjectKey, guardEnabled, isScheduled, localSaved, normalizedClass, selectedDate]);

  const selectedIsSaved = localSaved || remoteSaved;
  const locked = guardEnabled && !isScheduled && !selectedIsSaved && !remoteUnavailable;

  const periodsForDate = useCallback((className: string, value: string) => {
    const canonical = normalizeClass(className);
    if (!canonical || !value) return [] as number[];
    return classDays.get(canonical)?.get(dateObject(value).getDay()) || [];
  }, [classDays]);

  const findScheduled = useCallback((className: string, from: string, direction: 1 | -1, includeFrom = false) => {
    if (!classDays.get(normalizeClass(className))?.size) return "";
    for (let step = includeFrom ? 0 : 1; step <= 60; step += 1) {
      const candidate = shiftDate(from, step * direction);
      if (periodsForDate(className, candidate).length) return candidate;
    }
    return "";
  }, [classDays, periodsForDate]);

  const upcomingDates = useMemo(() => {
    if (!guardEnabled || !normalizedClass) return [] as ScheduledDate[];
    const values: ScheduledDate[] = [];
    const start = selectedDate || dateInput(new Date());
    for (let step = 0; step <= 45 && values.length < 10; step += 1) {
      const candidate = shiftDate(start, step);
      const periods = periodsForDate(normalizedClass, candidate);
      if (periods.length) values.push({ date: candidate, weekday: dateObject(candidate).getDay(), periods });
    }
    return values;
  }, [guardEnabled, normalizedClass, selectedDate, periodsForDate]);

  const setAllowedDate = useCallback((value: string, text = "") => {
    if (!value) return;
    programmatic.current = true;
    putDateOnPage(value);
    setSelectedDate(value);
    if (text) setNotice(text);
    window.setTimeout(() => { programmatic.current = false; }, 50);
  }, []);

  useEffect(() => {
    const sync = () => {
      const controls = dailyControls();
      if (controls.classSelect) setSelectedClass(controls.classSelect.value);
      if (controls.dateInput?.value) setSelectedDate(controls.dateInput.value);
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });

    const onChange = (event: Event) => {
      const target = event.target as HTMLElement | null;
      const controls = dailyControls();
      if (target === controls.classSelect) {
        const className = controls.classSelect?.value || "";
        setSelectedClass(className);
        setNotice("");
      }
      if (target === controls.dateInput && controls.dateInput) {
        const value = controls.dateInput.value;
        setSelectedDate(value);
        if (programmatic.current) return;
        const className = controls.classSelect?.value || "";
        const days = classDays.get(normalizeClass(className));
        if (days?.size && !periodsForDate(className, value).length && !hasSavedAttendance(className, value)) {
          setNotice("هذا اليوم ليس ضمن حصص الفصل؛ يتم التحقق من وجود تحضير سابق محفوظ.");
        } else {
          setNotice("");
        }
      }
    };

    const onClick = (event: MouseEvent) => {
      const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>("button");
      if (!button) return;
      const text = button.textContent?.replace(/\s+/g, " ").trim() || "";
      const controls = dailyControls();
      const className = controls.classSelect?.value || selectedClass;
      const value = controls.dateInput?.value || selectedDate;
      const days = classDays.get(normalizeClass(className));
      if (button.closest(".hijri-card") && ["اليوم السابق", "اليوم", "اليوم التالي"].includes(text) && days?.size) {
        event.preventDefault();
        event.stopPropagation();
        const direction: 1 | -1 = text === "اليوم السابق" ? -1 : 1;
        const base = text === "اليوم" ? dateInput(new Date()) : value;
        const next = text === "اليوم"
          ? (periodsForDate(className, base).length ? base : findScheduled(className, base, 1, true) || findScheduled(className, base, -1, true))
          : findScheduled(className, base, direction, false);
        if (next) setAllowedDate(next, "تم الانتقال إلى موعد الحصة حسب الجدول.");
        return;
      }
      if (locked && (button.closest(".status-buttons") || text.includes("حفظ التحضير"))) {
        event.preventDefault();
        event.stopPropagation();
        setNotice(checkingRemote
          ? "جارٍ التحقق من وجود تحضير سابق لهذا التاريخ."
          : "لا يمكن إنشاء تحضير جديد؛ لا توجد حصة لهذا الفصل في التاريخ المختار.");
      }
    };

    document.addEventListener("change", onChange, true);
    document.addEventListener("click", onClick, true);
    return () => {
      observer.disconnect();
      document.removeEventListener("change", onChange, true);
      document.removeEventListener("click", onClick, true);
    };
  }, [classDays, findScheduled, hasSavedAttendance, periodsForDate, selectedClass, selectedDate, setAllowedDate, locked, checkingRemote]);

  useEffect(() => {
    const page = document.querySelector<HTMLElement>(".attendance-page");
    if (!page) return;
    page.classList.toggle("attendance-date-locked", locked);
    page.dataset.scheduleGuard = guardEnabled ? "enabled" : "fallback";
    const saveButton = [...page.querySelectorAll<HTMLButtonElement>(".attendance-controls button")]
      .find(button => button.textContent?.includes("حفظ التحضير"));
    const statusButtons = page.querySelectorAll<HTMLButtonElement>(".status-buttons button");
    if (saveButton) {
      saveButton.dataset.scheduleLocked = locked ? "true" : "false";
      if (locked) saveButton.setAttribute("aria-disabled", "true");
      else saveButton.removeAttribute("aria-disabled");
    }
    statusButtons.forEach(button => {
      button.dataset.scheduleLocked = locked ? "true" : "false";
      if (locked) button.setAttribute("aria-disabled", "true");
      else button.removeAttribute("aria-disabled");
    });
  }, [guardEnabled, locked, selectedClass, selectedDate]);

  return <section className={`attendance-schedule-guard no-print ${locked ? "locked" : ""} ${selectedIsSaved && !isScheduled ? "saved-legacy" : ""}`} dir="rtl">
    <div className="attendance-schedule-copy">
      <span>🔗 ربط التحضير بالجدول</span>
      {!loaded ? <strong>جارٍ قراءة حصص المعلم…</strong> : null}
      {loaded && !selectedClass ? <strong>اختر الفصل لعرض مواعيد تحضيره.</strong> : null}
      {loaded && selectedClass && !guardEnabled ? <strong>لا توجد حصص محفوظة لهذا الفصل في الجدول؛ التحضير يعمل بالطريقة السابقة دون تقييد.</strong> : null}
      {guardEnabled && isScheduled ? <strong>التحضير متاح: {DAY_LABEL[selectedWeekday]} — الحصة {selectedPeriods.map(arabicNumber).join("، ")}</strong> : null}
      {guardEnabled && checkingRemote && !isScheduled && !localSaved ? <strong>جارٍ التحقق من وجود تحضير سابق في هذا التاريخ…</strong> : null}
      {guardEnabled && selectedIsSaved && !isScheduled ? <strong>هذا سجل تحضير سابق محفوظ؛ بقي متاحًا للمراجعة والتعديل.</strong> : null}
      {guardEnabled && remoteUnavailable && !isScheduled ? <strong>تعذر التحقق من السجل السحابي؛ لم يُفرض القفل حفاظًا على التحاضير السابقة.</strong> : null}
      {locked && !checkingRemote ? <strong>لا توجد حصة لهذا الفصل في هذا التاريخ، لذلك إنشاء تحضير جديد مقفول.</strong> : null}
      {loadMessage ? <small>{loadMessage} — لم يتم فرض القفل حتى يعود الاتصال.</small> : null}
      {notice ? <small>{notice}</small> : null}
    </div>
    {upcomingDates.length ? <div className="attendance-schedule-dates" aria-label="مواعيد التحضير حسب الجدول">
      {upcomingDates.map(item => <button type="button" key={item.date} className={item.date === selectedDate ? "active" : ""} onClick={() => setAllowedDate(item.date)}>
        <b>{DAY_LABEL[item.weekday]}</b>
        <span>{shortDate(item.date)}</span>
        <small>ح {item.periods.map(arabicNumber).join("،")}</small>
      </button>)}
    </div> : null}
  </section>;
}
