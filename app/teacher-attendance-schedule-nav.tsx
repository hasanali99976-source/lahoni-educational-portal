"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { normalizeClass } from "../lib/unified-roster";

const DAY_INDEX: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4 };
const MIN_DATE = "2026-08-23";
const SEARCH_LIMIT_DAYS = 140;

function dateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shortDate(value: string | null) {
  if (!value) return "—";
  const [, month, day] = value.split("-");
  return `${day}/${month}`;
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

    const today = () => {
      const current = new Date();
      current.setHours(12, 0, 0, 0);
      return current;
    };

    function scheduledDate(className: string, anchor: string, direction: -1 | 1, includeAnchor = false) {
      const days = schedule.get(classKey(className));
      if (!days?.size || !anchor) return null;
      const ceiling = today();
      const cursor = new Date(`${anchor}T12:00:00`);
      if (Number.isNaN(cursor.getTime())) return null;

      if (includeAnchor && cursor <= ceiling && dateValue(cursor) >= MIN_DATE && days.has(cursor.getDay())) return dateValue(cursor);

      for (let step = 0; step < SEARCH_LIMIT_DAYS; step += 1) {
        cursor.setDate(cursor.getDate() + direction);
        const value = dateValue(cursor);
        if (value < MIN_DATE) return null;
        if (cursor > ceiling) {
          if (direction > 0) return null;
          continue;
        }
        if (days.has(cursor.getDay())) return value;
      }
      return null;
    }

    function todayScheduled(className: string) {
      const current = dateValue(today());
      return scheduledDate(className, current, -1, true);
    }

    function controls() {
      const classSelect = document.querySelector<HTMLSelectElement>("[data-attendance-class-select='true']");
      const dateInput = document.querySelector<HTMLInputElement>("[data-attendance-date-input='true']");
      const buttons = [...document.querySelectorAll<HTMLButtonElement>(".attendance-day-nav button")];
      const previous = buttons.find(button => (button.getAttribute("aria-label") || button.textContent || "").includes("السابق"));
      const next = buttons.find(button => (button.getAttribute("aria-label") || button.textContent || "").includes("التالي"));
      const current = buttons.find(button => button.classList.contains("today") || (button.textContent || "").trim() === "اليوم");
      return { classSelect, dateInput, previous, current, next };
    }

    function refreshButtons() {
      const { classSelect, dateInput, previous, current, next } = controls();
      if (!classSelect || !dateInput || !previous || !current || !next) return;
      const className = classSelect.value;
      const date = dateInput.value;
      const hasSchedule = Boolean(className && schedule.get(classKey(className))?.size);

      if (!hasSchedule) {
        const label = className ? "لا توجد حصة" : "اختر الفصل";
        previous.dataset.dateLabel = label;
        next.dataset.dateLabel = label;
        current.dataset.dateLabel = className ? "لا توجد حصة" : "اختر الفصل";
        previous.title = className ? "لا توجد حصة سابقة لهذا الفصل في الجدول" : "اختر الفصل أولًا";
        next.title = className ? "لا توجد حصة لاحقة لهذا الفصل في الجدول" : "اختر الفصل أولًا";
        current.title = className ? "لا توجد حصة لهذا الفصل في الجدول" : "اختر الفصل أولًا";
        previous.disabled = true;
        next.disabled = true;
        current.disabled = true;
        return;
      }

      const previousDate = scheduledDate(className, date, -1);
      const nextDate = scheduledDate(className, date, 1);
      const nearestToday = todayScheduled(className);

      previous.dataset.dateLabel = previousDate ? shortDate(previousDate) : "لا يوجد";
      next.dataset.dateLabel = nextDate ? shortDate(nextDate) : "لا يوجد";
      current.dataset.dateLabel = nearestToday ? shortDate(nearestToday) : "لا توجد حصة";
      previous.title = previousDate ? `الحصة السابقة للفصل بتاريخ ${previousDate}` : "لا توجد حصة سابقة مسجلة في الجدول";
      next.title = nextDate ? `الحصة التالية للفصل بتاريخ ${nextDate}` : "لا توجد حصة لاحقة حتى تاريخ اليوم";
      current.title = nearestToday ? `أقرب حصة للفصل حتى اليوم: ${nearestToday}` : "لا توجد حصة للفصل في الجدول";
      previous.disabled = !previousDate;
      next.disabled = !nextDate;
      current.disabled = !nearestToday;
    }

    function scheduleRefresh(delay = 0) {
      window.clearTimeout(updateTimer);
      updateTimer = window.setTimeout(refreshButtons, delay);
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

    function onClick(event: MouseEvent) {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>(".attendance-day-nav button");
      if (!button) return;
      const { classSelect, dateInput, previous, current, next } = controls();
      if (!classSelect?.value || !dateInput?.value) return;
      const className = classSelect.value;
      if (!schedule.get(classKey(className))?.size) return;

      let target: string | null = null;
      if (button === previous) target = scheduledDate(className, dateInput.value, -1);
      else if (button === next) target = scheduledDate(className, dateInput.value, 1);
      else if (button === current) target = todayScheduled(className);
      if (!target) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      setReactInput(dateInput, target);
      scheduleRefresh(40);
    }

    function onChange(event: Event) {
      const element = event.target as HTMLElement;
      if (element.matches?.("[data-attendance-class-select='true'],[data-attendance-date-input='true']")) scheduleRefresh(20);
    }

    const observer = new MutationObserver(() => scheduleRefresh(20));
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", onClick, true);
    document.addEventListener("change", onChange, true);
    void loadSchedule();
    scheduleRefresh(80);

    return () => {
      stopped = true;
      window.clearTimeout(updateTimer);
      observer.disconnect();
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("change", onChange, true);
    };
  }, [pathname]);

  return null;
}
