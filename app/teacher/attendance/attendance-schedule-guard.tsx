"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTeacherClient } from "../../../lib/teacher-client";
import { normalizeClass } from "../../../lib/unified-roster";
import "./attendance-schedule-guard.css";

type TimetableLesson = { className?: string; notes?: string; subject?: string };
type TimetableResponse = { ok?: boolean; lessons?: Record<string, TimetableLesson>; message?: string };
type LocalTimetable = { lessons: Record<string, TimetableLesson>; classNames: string[]; updatedAt?: string };
type ExistingResponse = { ok?: boolean; exists?: boolean; unavailable?: boolean; message?: string };
type ScheduledDate = { date: string; weekday: number; periods: number[] };
type ScheduledClass = { className: string; periods: number[] };

const DAY_INDEX: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4 };
const DAY_LABEL: Record<number, string> = { 0: "الأحد", 1: "الإثنين", 2: "الثلاثاء", 3: "الأربعاء", 4: "الخميس", 5: "الجمعة", 6: "السبت" };

function dateInput(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
function dateObject(value: string) { return new Date(`${value}T12:00:00`); }
function shiftDate(value: string, amount: number) { const date = dateObject(value); date.setDate(date.getDate() + amount); return dateInput(date); }
function safeId(value: string) { return encodeURIComponent(value).replace(/%/g, "_"); }
function arabicNumber(value: number) { return new Intl.NumberFormat("ar-SA-u-nu-arab").format(value); }
function shortDate(value: string) { return new Intl.DateTimeFormat("ar-SA-u-nu-arab", { day: "numeric", month: "short" }).format(dateObject(value)); }

function readLocalTimetable(storageKey: string): LocalTimetable | null {
  if (!storageKey || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey); if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalTimetable>;
    if (!parsed || !parsed.lessons || typeof parsed.lessons !== "object" || !Array.isArray(parsed.classNames)) return null;
    return { lessons: parsed.lessons as Record<string, TimetableLesson>, classNames: [...new Set(parsed.classNames.map(normalizeClass).filter(Boolean))], updatedAt: String(parsed.updatedAt || "") };
  } catch { return null; }
}
function mergeTimetable(remote: Record<string, TimetableLesson>, local: LocalTimetable | null) {
  if (!local) return remote;
  const ownedClasses = new Set(local.classNames);
  const retained = Object.fromEntries(Object.entries(remote).filter(([, lesson]) => !ownedClasses.has(normalizeClass(lesson.className)))) as Record<string, TimetableLesson>;
  return { ...retained, ...local.lessons };
}
function dailyControls() {
  const page = document.querySelector<HTMLElement>(".attendance-page");
  const controls = page?.querySelector<HTMLElement>(".attendance-primary-controls") || page?.querySelector<HTMLElement>(".attendance-controls") || page?.querySelector<HTMLElement>(".attendance-setup-panel") || null;
  return {
    controls,
    classSelect: page?.querySelector<HTMLSelectElement>('[data-attendance-class-select="true"]') || controls?.querySelector<HTMLSelectElement>("select") || null,
    dateInput: page?.querySelector<HTMLInputElement>('[data-attendance-date-input="true"]') || controls?.querySelector<HTMLInputElement>('input[type="date"]') || null,
  };
}
function putDateOnPage(value: string) {
  const input = dailyControls().dateInput; if (!input || input.value === value) return;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set; if (setter) setter.call(input, value); else input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true }));
}
function putClassOnPage(value: string) {
  const select = dailyControls().classSelect; if (!select || select.value === value) return;
  const option = [...select.options].find(item => normalizeClass(item.value) === normalizeClass(value)); if (!option) return;
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set; if (setter) setter.call(select, option.value); else select.value = option.value;
  select.dispatchEvent(new Event("input", { bubbles: true })); select.dispatchEvent(new Event("change", { bubbles: true }));
}

export default function AttendanceScheduleGuard() {
  const session = useTeacherClient();
  const teacherId = session?.teacherId || "", subjectKey = session?.subjectKey || "history", workspaceKey = session?.workspaceKey || subjectKey;
  const storageKey = teacherId ? `ostadh-lahooni:timetable:${teacherId}:${workspaceKey}:${session?.activeGrade || "all"}` : "";
  const [lessons, setLessons] = useState<Record<string, TimetableLesson>>({}), [loaded, setLoaded] = useState(false), [loadMessage, setLoadMessage] = useState("");
  const [selectedClass, setSelectedClass] = useState(""), [selectedDate, setSelectedDate] = useState(dateInput(new Date()));
  const [remoteSaved, setRemoteSaved] = useState(false), [checkingRemote, setCheckingRemote] = useState(false), [remoteUnavailable, setRemoteUnavailable] = useState(false), [notice, setNotice] = useState("");
  const programmatic = useRef(false), autoLinked = useRef("");

  useEffect(() => {
    if (!teacherId || !subjectKey) return;
    const controller = new AbortController(), timer = window.setTimeout(() => controller.abort(), 9000), localAtStart = readLocalTimetable(storageKey);
    setLoaded(false); setLoadMessage(""); if (localAtStart) setLessons(localAtStart.lessons);
    const refreshLocal = () => { const latest = readLocalTimetable(storageKey); if (latest) setLessons(current => mergeTimetable(current, latest)); };
    window.addEventListener("storage", refreshLocal); window.addEventListener("lahooni:timetable-updated", refreshLocal);
    fetch(`/api/teacher/timetable?subjectId=${encodeURIComponent(subjectKey)}`, { cache: "no-store", credentials: "same-origin", signal: controller.signal })
      .then(async response => { const data = await response.json().catch(() => ({})) as TimetableResponse; if (!response.ok) throw new Error(data.message || "تعذر تحميل الجدول"); return data; })
      .then(data => { const remote = data.lessons && typeof data.lessons === "object" ? data.lessons : {}; const latestLocal = readLocalTimetable(storageKey); setLessons(mergeTimetable(remote, latestLocal)); if (latestLocal) setLoadMessage("تم تحميل الجدول وربطه بالحضور، مع دمج آخر نسخة محفوظة على الجهاز."); })
      .catch(error => { const latestLocal = readLocalTimetable(storageKey); if (latestLocal) { setLessons(latestLocal.lessons); setLoadMessage("تعذر التحديث السحابي؛ تم استخدام آخر جدول محفوظ على الجهاز."); } else { setLessons({}); setLoadMessage(error instanceof Error ? error.message : "تعذر تحميل الجدول"); } })
      .finally(() => { window.clearTimeout(timer); setLoaded(true); });
    return () => { controller.abort(); window.clearTimeout(timer); window.removeEventListener("storage", refreshLocal); window.removeEventListener("lahooni:timetable-updated", refreshLocal); };
  }, [teacherId, subjectKey, storageKey]);

  const classDays = useMemo(() => {
    const result = new Map<string, Map<number, number[]>>();
    Object.entries(lessons).forEach(([cell, lesson]) => { const match = cell.match(/^(sunday|monday|tuesday|wednesday|thursday)-([1-7])$/), className = normalizeClass(lesson.className); if (!match || !className) return; const weekday = DAY_INDEX[match[1]], period = Number(match[2]); if (weekday === undefined || !period) return; if (!result.has(className)) result.set(className, new Map()); const days = result.get(className)!; days.set(weekday, [...new Set([...(days.get(weekday) || []), period])].sort((a, b) => a - b)); });
    return result;
  }, [lessons]);
  const normalizedClass = normalizeClass(selectedClass), scheduledDays = normalizedClass ? classDays.get(normalizedClass) : undefined, guardEnabled = loaded && !!scheduledDays?.size;
  const selectedWeekday = selectedDate ? dateObject(selectedDate).getDay() : -1, selectedPeriods = scheduledDays?.get(selectedWeekday) || [], isScheduled = selectedPeriods.length > 0;
  const scheduledClasses = useMemo(() => [...classDays.entries()].map(([className, days]) => ({ className, periods: days.get(selectedWeekday) || [] })).filter(item => item.periods.length).sort((a, b) => a.periods[0] - b.periods[0]) as ScheduledClass[], [classDays, selectedWeekday]);

  const hasSavedAttendance = useCallback((className: string, value: string) => {
    if (!teacherId || !className || !value || typeof window === "undefined") return false;
    const canonical = normalizeClass(className) || className, currentKey = `lahooni-attendance:${teacherId}:${subjectKey}:${safeId(canonical)}:${value}`, legacyKey = `lahooni-local-attendance:${teacherId}:${subjectKey}:${canonical}:${value}`;
    if (localStorage.getItem(currentKey) || localStorage.getItem(legacyKey)) return true;
    try { const index = JSON.parse(localStorage.getItem(`lahooni-attendance-index:${teacherId}:${subjectKey}`) || "{}"); return Boolean(index?.[`${safeId(canonical)}_${value}`]); } catch { return false; }
  }, [teacherId, subjectKey]);
  const localSaved = hasSavedAttendance(normalizedClass, selectedDate);

  useEffect(() => {
    setRemoteSaved(false); setRemoteUnavailable(false); setCheckingRemote(false);
    if (!teacherId || !guardEnabled || isScheduled || localSaved || !normalizedClass || !selectedDate) return;
    const controller = new AbortController(), timer = window.setTimeout(() => controller.abort(), 6500); setCheckingRemote(true);
    const params = new URLSearchParams({ subjectId: subjectKey, className: normalizedClass, date: selectedDate });
    fetch(`/api/teacher/attendance/exists?${params.toString()}`, { cache: "no-store", credentials: "same-origin", signal: controller.signal })
      .then(async response => { const data = await response.json().catch(() => ({})) as ExistingResponse; if (!response.ok) throw new Error(data.message || "attendance_exists_failed"); return data; })
      .then(data => setRemoteSaved(data.exists === true)).catch(() => setRemoteUnavailable(true)).finally(() => { window.clearTimeout(timer); setCheckingRemote(false); });
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [teacherId, subjectKey, guardEnabled, isScheduled, localSaved, normalizedClass, selectedDate]);

  const selectedIsSaved = localSaved || remoteSaved, today = dateInput(new Date()), futureDateLocked = Boolean(selectedDate && selectedDate > today), locked = futureDateLocked || (guardEnabled && !isScheduled && !selectedIsSaved);
  const periodsForDate = useCallback((className: string, value: string) => { const canonical = normalizeClass(className); if (!canonical || !value) return [] as number[]; return classDays.get(canonical)?.get(dateObject(value).getDay()) || []; }, [classDays]);
  const findScheduled = useCallback((className: string, from: string, direction: 1 | -1, includeFrom = false) => { if (!classDays.get(normalizeClass(className))?.size) return ""; for (let step = includeFrom ? 0 : 1; step <= 60; step += 1) { const candidate = shiftDate(from, step * direction); if (periodsForDate(className, candidate).length) return candidate; } return ""; }, [classDays, periodsForDate]);
  const upcomingDates = useMemo(() => { if (!guardEnabled || !normalizedClass) return [] as ScheduledDate[]; const values: ScheduledDate[] = [], start = selectedDate || dateInput(new Date()); for (let step = 0; step <= 45 && values.length < 10; step += 1) { const candidate = shiftDate(start, step), periods = periodsForDate(normalizedClass, candidate); if (periods.length) values.push({ date: candidate, weekday: dateObject(candidate).getDay(), periods }); } return values; }, [guardEnabled, normalizedClass, selectedDate, periodsForDate]);

  const setAllowedDate = useCallback((value: string, text = "") => { if (!value) return; const currentToday = dateInput(new Date()); if (value > currentToday) { setNotice("تحضير الغد مقفول حتى الساعة 12:00 منتصف الليل بتوقيت الرياض."); return; } programmatic.current = true; putDateOnPage(value); setSelectedDate(value); if (text) setNotice(text); window.setTimeout(() => { programmatic.current = false; }, 50); }, []);
  const selectScheduledClass = useCallback((className: string, text = "تم اختيار الفصل مباشرة من جدول الحصص.") => { if (!className) return; programmatic.current = true; putClassOnPage(className); setSelectedClass(className); setNotice(text); window.setTimeout(() => { programmatic.current = false; }, 50); }, []);

  useEffect(() => {
    if (!loaded || selectedDate !== today || !scheduledClasses.length || isScheduled || localSaved) return;
    const key = `${selectedDate}:${scheduledClasses.map(item => item.className).join("|")}`; if (autoLinked.current === key) return;
    const controls = dailyControls(); if (!controls.classSelect) return;
    const firstAvailable = scheduledClasses.find(item => [...controls.classSelect!.options].some(option => normalizeClass(option.value) === item.className));
    if (!firstAvailable) return; autoLinked.current = key; selectScheduledClass(firstAvailable.className, "تم فتح أول فصل في جدول اليوم تلقائيًا للحضور.");
  }, [loaded, selectedDate, today, scheduledClasses, isScheduled, localSaved, selectScheduledClass]);

  useEffect(() => {
    const sync = () => { const controls = dailyControls(); if (controls.classSelect) setSelectedClass(controls.classSelect.value); if (controls.dateInput) { controls.dateInput.max = dateInput(new Date()); if (controls.dateInput.value > controls.dateInput.max) putDateOnPage(controls.dateInput.max); if (controls.dateInput.value) setSelectedDate(controls.dateInput.value); } };
    sync(); const observer = new MutationObserver(sync); observer.observe(document.body, { childList: true, subtree: true });
    const onChange = (event: Event) => { const target = event.target as HTMLElement | null, controls = dailyControls(); if (target === controls.classSelect) { setSelectedClass(controls.classSelect?.value || ""); setNotice(""); } if (target === controls.dateInput && controls.dateInput) { const value = controls.dateInput.value, currentToday = dateInput(new Date()); if (value > currentToday) { setAllowedDate(currentToday, "تحضير الغد مقفول حتى الساعة 12:00 منتصف الليل بتوقيت الرياض."); return; } setSelectedDate(value); if (programmatic.current) return; const className = controls.classSelect?.value || "", days = classDays.get(normalizeClass(className)); if (days?.size && !periodsForDate(className, value).length && !hasSavedAttendance(className, value)) setNotice("هذا اليوم ليس ضمن حصص الفصل؛ يتم التحقق من وجود تحضير سابق محفوظ."); else setNotice(""); } };
    const onClick = (event: MouseEvent) => { const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>("button"); if (!button) return; const text = button.textContent?.replace(/\s+/g, " ").trim() || "", action = button.getAttribute("aria-label") || text, controls = dailyControls(), className = controls.classSelect?.value || selectedClass, value = controls.dateInput?.value || selectedDate, days = classDays.get(normalizeClass(className)); if (button.closest(".hijri-card") && ["اليوم السابق", "السابق", "اليوم", "اليوم التالي", "التالي"].includes(action) && days?.size) { event.preventDefault(); event.stopPropagation(); const direction: 1 | -1 = ["اليوم السابق", "السابق"].includes(action) ? -1 : 1, base = action === "اليوم" ? dateInput(new Date()) : value, next = action === "اليوم" ? (periodsForDate(className, base).length ? base : findScheduled(className, base, 1, true) || findScheduled(className, base, -1, true)) : findScheduled(className, base, direction, false); if (next) setAllowedDate(next, "تم الانتقال إلى موعد الحصة حسب الجدول."); return; } if (locked && (button.closest(".status-buttons") || text.includes("حفظ التحضير"))) { event.preventDefault(); event.stopPropagation(); setNotice(checkingRemote ? "جارٍ التحقق من وجود تحضير سابق لهذا التاريخ." : "لا يمكن إنشاء تحضير جديد؛ لا توجد حصة لهذا الفصل في التاريخ المختار."); } };
    document.addEventListener("change", onChange, true); document.addEventListener("click", onClick, true);
    return () => { observer.disconnect(); document.removeEventListener("change", onChange, true); document.removeEventListener("click", onClick, true); };
  }, [classDays, findScheduled, hasSavedAttendance, periodsForDate, selectedClass, selectedDate, setAllowedDate, locked, checkingRemote]);

  useEffect(() => {
    const page = document.querySelector<HTMLElement>(".attendance-page"); if (!page) return;
    page.classList.toggle("attendance-date-locked", locked); page.dataset.scheduleGuard = guardEnabled ? "enabled" : "fallback";
    const saveButton = [...page.querySelectorAll<HTMLButtonElement>(".attendance-main-actions button, .attendance-controls button")].find(button => button.textContent?.includes("حفظ التحضير"));
    const statusButtons = page.querySelectorAll<HTMLButtonElement>(".status-buttons button");
    if (saveButton) { saveButton.dataset.scheduleLocked = locked ? "true" : "false"; if (locked) saveButton.setAttribute("aria-disabled", "true"); else saveButton.removeAttribute("aria-disabled"); }
    statusButtons.forEach(button => { button.dataset.scheduleLocked = locked ? "true" : "false"; if (locked) button.setAttribute("aria-disabled", "true"); else button.removeAttribute("aria-disabled"); });
  }, [guardEnabled, locked, selectedClass, selectedDate]);

  return <section className={`attendance-schedule-guard no-print ${locked ? "locked" : ""} ${selectedIsSaved && !isScheduled ? "saved-legacy" : ""}`} dir="rtl">
    <div className="attendance-schedule-copy">
      <span>🔗 ربط الحضور بالجدول</span>
      {!loaded ? <strong>جارٍ قراءة حصص المعلم…</strong> : null}
      {loaded && scheduledClasses.length ? <strong>حصص {DAY_LABEL[selectedWeekday]} مرتبطة مباشرة بالحضور؛ اختر الحصة لفتح فصلها.</strong> : null}
      {loaded && !selectedClass ? <strong>اختر الفصل لعرض مواعيد تحضيره.</strong> : null}
      {loaded && selectedClass && !guardEnabled ? <strong>لا توجد حصص محفوظة لهذا الفصل في الجدول؛ السجلات السابقة تبقى متاحة.</strong> : null}
      {guardEnabled && isScheduled ? <strong>الحضور متاح: {DAY_LABEL[selectedWeekday]} — الحصة {selectedPeriods.map(arabicNumber).join("، ")}</strong> : null}
      {guardEnabled && checkingRemote && !isScheduled && !localSaved ? <strong>جارٍ التحقق من وجود تحضير سابق في هذا التاريخ…</strong> : null}
      {guardEnabled && selectedIsSaved && !isScheduled ? <strong>هذا سجل تحضير سابق محفوظ؛ بقي متاحًا للمراجعة والتعديل.</strong> : null}
      {guardEnabled && remoteUnavailable && !isScheduled ? <strong>تعذر التحقق من تحضير سابق سحابي؛ بقي القفل مفعّلًا حسب الجدول.</strong> : null}
      {locked && !checkingRemote ? <strong>لا توجد حصة لهذا الفصل في هذا التاريخ، لذلك إنشاء تحضير جديد مقفول.</strong> : null}
      {loadMessage ? <small>{loadMessage}</small> : null}{notice ? <small>{notice}</small> : null}
    </div>
    {scheduledClasses.length ? <div className="attendance-schedule-dates" aria-label="حصص اليوم من الجدول">{scheduledClasses.map(item => <button type="button" key={`${item.className}-${item.periods.join("-")}`} className={item.className === normalizedClass ? "active" : ""} onClick={() => selectScheduledClass(item.className)}><b>{item.className}</b><span>الحصة {item.periods.map(arabicNumber).join("، ")}</span><small>فتح الحضور</small></button>)}</div> : null}
    {upcomingDates.length ? <div className="attendance-schedule-dates" aria-label="مواعيد التحضير حسب الجدول">{upcomingDates.map(item => <button type="button" key={item.date} className={item.date === selectedDate ? "active" : ""} onClick={() => setAllowedDate(item.date)}><b>{DAY_LABEL[item.weekday]}</b><span>{shortDate(item.date)}</span><small>ح {item.periods.map(arabicNumber).join("،")}</small></button>)}</div> : null}
  </section>;
}
