"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { normalizeClass } from "../lib/unified-roster";

const DAY_INDEX: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4 };
const MIN_DATE = "2026-08-23";
const SEARCH_LIMIT_DAYS = 180;

function riyadhTodayValue() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dateObject(value: string) {
  return new Date(`${value}T12:00:00Z`);
}

function dateValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function shortDate(value: string | null) {
  if (!value) return "—";
  const [, month, day] = value.split("-");
  return `${day}/${month}`;
}

function longDate(value: string | null) {
  if (!value) return "لا يوجد";
  const date = dateObject(value);
  return new Intl.DateTimeFormat("ar-SA", {
    timeZone: "Asia/Riyadh",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

function setReactInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function classKey(value: string) {
  return normalizeClass(value) || value.replace(/\s+/g, " ").trim();
}

export default function TeacherAttendanceScheduleNav() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.startsWith("/teacher/attendance")) return;

    let stopped = false;
    let schedule = new Map<string, Set<number>>();
    let updateTimer = 0;
    let minuteTimer = 0;

    function scheduledDate(className: string, anchor: string, direction: -1 | 1, includeAnchor = false, allowFuture = false) {
      const days = schedule.get(classKey(className));
      if (!days?.size || !anchor) return null;
      const today = riyadhTodayValue();
      const cursor = dateObject(anchor);
      if (Number.isNaN(cursor.getTime())) return null;

      if (includeAnchor) {
        const current = dateValue(cursor);
        if (current >= MIN_DATE && (allowFuture || current <= today) && days.has(cursor.getUTCDay())) return current;
      }

      for (let step = 0; step < SEARCH_LIMIT_DAYS; step += 1) {
        cursor.setUTCDate(cursor.getUTCDate() + direction);
        const value = dateValue(cursor);
        if (value < MIN_DATE) return null;
        if (!allowFuture && value > today) {
          if (direction > 0) return null;
          continue;
        }
        if (days.has(cursor.getUTCDay())) return value;
      }
      return null;
    }

    function nearestScheduledToday(className: string) {
      return scheduledDate(className, riyadhTodayValue(), -1, true, false);
    }

    function controls() {
      const classSelect = document.querySelector<HTMLSelectElement>("[data-attendance-class-select='true']");
      const dateInput = document.querySelector<HTMLInputElement>("[data-attendance-date-input='true']");
      return { classSelect, dateInput };
    }

    function ensureCalendar() {
      const host = document.querySelector<HTMLElement>(".hijri-card");
      if (!host || host.querySelector(".attendance-calendar-v21")) return;

      const wrap = document.createElement("div");
      wrap.className = "attendance-calendar-v21";
      wrap.innerHTML = `
        <button type="button" class="attendance-calendar-v21-trigger" aria-expanded="false" aria-label="فتح تقويم حصص الفصل">
          <span class="cal-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M7 14h3M14 14h3M7 18h3"/></svg></span>
          <span><b>تقويم الحصص</b><small data-calendar-current>اختر الفصل</small></span>
          <span class="chev">⌄</span>
        </button>
        <div class="attendance-calendar-v21-popover" hidden>
          <div class="attendance-calendar-v21-head"><div><b>انتقل حسب جدول الفصل</b><small>لا تظهر إلا أيام الحصص الفعلية</small></div><span>مرتبط بالجدول</span></div>
          <div class="attendance-calendar-v21-options">
            <button type="button" class="attendance-calendar-v21-option" data-calendar-action="previous"><span>‹</span><span><b>الحصة السابقة</b><small data-calendar-prev-long>—</small></span><strong data-calendar-prev>—</strong></button>
            <button type="button" class="attendance-calendar-v21-option" data-calendar-action="today"><span>●</span><span><b>اليوم / أقرب حصة</b><small data-calendar-today-long>—</small></span><strong data-calendar-today>—</strong></button>
            <button type="button" class="attendance-calendar-v21-option" data-calendar-action="next"><span>›</span><span><b>الحصة التالية</b><small data-calendar-next-long>—</small></span><strong data-calendar-next>—</strong></button>
          </div>
          <div class="attendance-calendar-v21-lock">الحصة المستقبلية لا تُفتح للتحضير قبل الساعة 12:00 صباحًا بتوقيت الرياض. عند بداية اليوم تُفتح تلقائيًا.</div>
        </div>`;
      host.appendChild(wrap);
    }

    function calendarNodes() {
      ensureCalendar();
      const root = document.querySelector<HTMLElement>(".attendance-calendar-v21");
      if (!root) return null;
      return {
        root,
        trigger: root.querySelector<HTMLButtonElement>(".attendance-calendar-v21-trigger"),
        popover: root.querySelector<HTMLElement>(".attendance-calendar-v21-popover"),
        current: root.querySelector<HTMLElement>("[data-calendar-current]"),
        previous: root.querySelector<HTMLButtonElement>("[data-calendar-action='previous']"),
        today: root.querySelector<HTMLButtonElement>("[data-calendar-action='today']"),
        next: root.querySelector<HTMLButtonElement>("[data-calendar-action='next']"),
        previousShort: root.querySelector<HTMLElement>("[data-calendar-prev]"),
        todayShort: root.querySelector<HTMLElement>("[data-calendar-today]"),
        nextShort: root.querySelector<HTMLElement>("[data-calendar-next]"),
        previousLong: root.querySelector<HTMLElement>("[data-calendar-prev-long]"),
        todayLong: root.querySelector<HTMLElement>("[data-calendar-today-long]"),
        nextLong: root.querySelector<HTMLElement>("[data-calendar-next-long]"),
      };
    }

    function refreshCalendar() {
      if (stopped) return;
      const nodes = calendarNodes();
      const { classSelect, dateInput } = controls();
      if (!nodes || !classSelect || !dateInput) return;

      const className = classSelect.value;
      const selected = dateInput.value;
      const days = className ? schedule.get(classKey(className)) : null;
      const hasSchedule = Boolean(days?.size);
      if (nodes.current) nodes.current.textContent = className ? `${className} • ${selected || "اختر التاريخ"}` : "اختر الفصل";

      if (!hasSchedule) {
        [nodes.previous, nodes.today, nodes.next].forEach(button => { if (button) button.disabled = true; });
        if (nodes.previousShort) nodes.previousShort.textContent = "—";
        if (nodes.todayShort) nodes.todayShort.textContent = "—";
        if (nodes.nextShort) nodes.nextShort.textContent = "—";
        if (nodes.previousLong) nodes.previousLong.textContent = className ? "لا توجد حصة سابقة في الجدول" : "اختر الفصل أولًا";
        if (nodes.todayLong) nodes.todayLong.textContent = className ? "لا توجد حصص لهذا الفصل" : "اختر الفصل أولًا";
        if (nodes.nextLong) nodes.nextLong.textContent = className ? "لا توجد حصة لاحقة في الجدول" : "اختر الفصل أولًا";
        return;
      }

      const previousDate = scheduledDate(className, selected || riyadhTodayValue(), -1);
      const todayDate = nearestScheduledToday(className);
      const nextDate = scheduledDate(className, selected || riyadhTodayValue(), 1);
      const nextAny = scheduledDate(className, selected || riyadhTodayValue(), 1, false, true);
      const lockedFuture = !nextDate && nextAny && nextAny > riyadhTodayValue() ? nextAny : null;

      if (nodes.previous) nodes.previous.disabled = !previousDate;
      if (nodes.today) nodes.today.disabled = !todayDate;
      if (nodes.next) nodes.next.disabled = !nextDate;
      if (nodes.previousShort) nodes.previousShort.textContent = shortDate(previousDate);
      if (nodes.todayShort) nodes.todayShort.textContent = shortDate(todayDate);
      if (nodes.nextShort) nodes.nextShort.textContent = nextDate ? shortDate(nextDate) : lockedFuture ? shortDate(lockedFuture) : "—";
      if (nodes.previousLong) nodes.previousLong.textContent = previousDate ? longDate(previousDate) : "لا توجد حصة سابقة";
      if (nodes.todayLong) nodes.todayLong.textContent = todayDate ? longDate(todayDate) : "لا توجد حصة حتى اليوم";
      if (nodes.nextLong) nodes.nextLong.textContent = nextDate ? longDate(nextDate) : lockedFuture ? `${longDate(lockedFuture)} • تُفتح 12:00 ص` : "لا توجد حصة لاحقة";
      if (nodes.next) nodes.next.title = lockedFuture ? `هذه الحصة مستقبلية وتفتح عند بداية ${lockedFuture} الساعة 12:00 صباحًا` : "الحصة التالية المتاحة حتى اليوم";
    }

    function scheduleRefresh(delay = 0) {
      window.clearTimeout(updateTimer);
      updateTimer = window.setTimeout(refreshCalendar, delay);
    }

    async function loadSchedule() {
      const shell = document.querySelector<HTMLElement>(".teacher-academy-v12");
      const subjectId = shell?.dataset.subject || "history";
      try {
        const response = await fetch(`/api/teacher/timetable?subjectId=${encodeURIComponent(subjectId)}`, { cache: "no-store", credentials: "same-origin" });
        const data = await response.json();
        const lessons = data?.lessons && typeof data.lessons === "object" ? data.lessons : {};
        const nextMap = new Map<string, Set<number>>();
        Object.entries(lessons).forEach(([cell, raw]) => {
          const match = cell.match(/^(sunday|monday|tuesday|wednesday|thursday)-[1-7]$/);
          if (!match) return;
          const className = classKey(String((raw as { className?: string })?.className || ""));
          if (!className) return;
          const values = nextMap.get(className) || new Set<number>();
          values.add(DAY_INDEX[match[1]]);
          nextMap.set(className, values);
        });
        if (!stopped) {
          schedule = nextMap;
          scheduleRefresh();
        }
      } catch {
        schedule = new Map();
        scheduleRefresh();
      }
    }

    function closePopover() {
      const nodes = calendarNodes();
      if (!nodes?.popover || !nodes.trigger) return;
      nodes.popover.hidden = true;
      nodes.trigger.setAttribute("aria-expanded", "false");
    }

    function onClick(event: MouseEvent) {
      const target = event.target as HTMLElement;
      const nodes = calendarNodes();
      if (!nodes) return;

      if (target.closest(".attendance-calendar-v21-trigger")) {
        event.preventDefault();
        if (nodes.popover && nodes.trigger) {
          nodes.popover.hidden = !nodes.popover.hidden;
          nodes.trigger.setAttribute("aria-expanded", String(!nodes.popover.hidden));
          if (!nodes.popover.hidden) refreshCalendar();
        }
        return;
      }

      const option = target.closest<HTMLButtonElement>("[data-calendar-action]");
      if (option && nodes.root.contains(option)) {
        event.preventDefault();
        if (option.disabled) return;
        const { classSelect, dateInput } = controls();
        if (!classSelect?.value || !dateInput) return;
        const className = classSelect.value;
        let chosen: string | null = null;
        if (option.dataset.calendarAction === "previous") chosen = scheduledDate(className, dateInput.value || riyadhTodayValue(), -1);
        if (option.dataset.calendarAction === "today") chosen = nearestScheduledToday(className);
        if (option.dataset.calendarAction === "next") chosen = scheduledDate(className, dateInput.value || riyadhTodayValue(), 1);
        if (chosen && chosen <= riyadhTodayValue()) setReactInput(dateInput, chosen);
        closePopover();
        scheduleRefresh(40);
        return;
      }

      if (!target.closest(".attendance-calendar-v21")) closePopover();
    }

    function onChange(event: Event) {
      const element = event.target as HTMLElement;
      if (element.matches?.("[data-attendance-class-select='true']")) {
        const { classSelect, dateInput } = controls();
        if (classSelect?.value && dateInput) {
          const targetDate = nearestScheduledToday(classSelect.value);
          if (targetDate) setReactInput(dateInput, targetDate);
        }
        scheduleRefresh(30);
        return;
      }
      if (element.matches?.("[data-attendance-date-input='true']")) scheduleRefresh(20);
    }

    const observer = new MutationObserver(() => scheduleRefresh(30));
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", onClick, true);
    document.addEventListener("change", onChange, true);
    void loadSchedule();
    ensureCalendar();
    scheduleRefresh(80);
    minuteTimer = window.setInterval(() => scheduleRefresh(), 60_000);

    return () => {
      stopped = true;
      window.clearTimeout(updateTimer);
      window.clearInterval(minuteTimer);
      observer.disconnect();
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("change", onChange, true);
    };
  }, [pathname]);

  return null;
}
