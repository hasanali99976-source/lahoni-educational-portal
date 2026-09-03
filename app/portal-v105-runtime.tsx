"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const DAY_MS = 24 * 60 * 60 * 1000;

function setText(selector: string, from: string, to: string) {
  document.querySelectorAll<HTMLElement>(selector).forEach(element => {
    if (element.textContent?.trim() === from) element.textContent = to;
  });
}

function enhanceAttendance() {
  setText(".attendance-eyebrow", "بوابة تحضير الطلاب", "سجل المتابعة اليومي");
  document.querySelectorAll<HTMLElement>(".attendance-head-copy h1").forEach(element => {
    if (element.textContent?.startsWith("التحضير اليومي")) element.textContent = element.textContent.replace("التحضير اليومي", "سجل المتابعة اليومي");
  });
  document.querySelectorAll<HTMLElement>(".attendance-range-report summary strong").forEach(element => {
    if (element.textContent?.includes("تقرير أسبوعي أو فترة محددة")) element.textContent = "تقرير المتابعة — حتى شهر كامل";
  });
}

function validateAttendanceRange(event: Event) {
  const source = event.target instanceof Element ? event.target : null;
  const button = source?.closest(".attendance-range-controls button") as HTMLButtonElement | null;
  if (!button) return;
  const controls = button.closest(".attendance-range-controls");
  const inputs = controls?.querySelectorAll('input[type="date"]') as NodeListOf<HTMLInputElement> | undefined;
  if (!inputs || inputs.length < 2) return;
  const from = inputs[0]?.value || "";
  const to = inputs[1]?.value || "";
  if (!from || !to) return;
  const span = Math.floor((new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / DAY_MS) + 1;
  if (span <= 31) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  window.alert("الحد الأقصى لتقرير سجل المتابعة شهر واحد (31 يومًا). اختر فترة أقصر.");
}

function enhanceFollowUp() {
  document.querySelectorAll<HTMLElement>(".follow-head h1").forEach(element => { element.textContent = "الإتقان والمتابعة"; });
  document.querySelectorAll<HTMLButtonElement>(".note-btn").forEach(button => {
    button.textContent = "الملاحظات والتواصل";
    button.dataset.v105NotesRedirect = "1";
  });
}

function redirectFollowUpNotes(event: Event) {
  const source = event.target instanceof Element ? event.target : null;
  const button = source?.closest('[data-v105-notes-redirect="1"]') as HTMLButtonElement | null;
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  window.location.assign("/teacher/notes");
}

function enhanceGrades() {
  document.querySelectorAll<HTMLElement>(".dynamic-gradebook-head h1").forEach(element => {
    if (element.textContent?.startsWith("سجل رصد الدرجات")) element.textContent = element.textContent.replace("سجل رصد الدرجات", "الرصد العلمي");
  });
}

function enhanceDashboard() {
  document.querySelectorAll<HTMLElement>(".daily-kicker").forEach(element => { element.textContent = "قياس معلومات الطلاب"; });
  document.querySelectorAll<HTMLElement>(".daily-hero-copy p").forEach(element => {
    if (element.textContent?.includes("كل ما تحتاجه للحصة")) element.textContent = "ملخص شامل للتحصيل والحضور والرصد والمتابعة، مع الوصول السريع إلى معلومات أي طالب من نفس المساحة.";
  });
}

export default function PortalV105Runtime() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;

    // لا ننهي جلسة المعلم اعتمادًا على Navigation Timing؛ بعض انتقالات تسجيل الدخول
    // تُسجل كـ reload في المتصفح وتسبب حلقة "جارٍ تجهيز بوابة المعلم".
    // الخروج الآمن يبقى عبر مهلة الخمول وتسجيل الخروج الصريح.

    let gradeSaveTimer: number | null = null;
    const scheduleGradeSave = (event: Event) => {
      if (!pathname.startsWith("/teacher/grades")) return;
      const source = event.target instanceof Element ? event.target : null;
      if (!source?.closest(".grade-input")) return;
      if (gradeSaveTimer !== null) window.clearTimeout(gradeSaveTimer);
      gradeSaveTimer = window.setTimeout(() => {
        gradeSaveTimer = null;
        const saveButton = document.querySelector<HTMLButtonElement>(".save-button");
        if (saveButton && !saveButton.disabled) saveButton.click();
      }, 900);
    };

    const enhance = () => {
      if (pathname.startsWith("/teacher/attendance")) enhanceAttendance();
      if (pathname.startsWith("/teacher/follow-up")) enhanceFollowUp();
      if (pathname.startsWith("/teacher/grades")) enhanceGrades();
      if (pathname.startsWith("/teacher/dashboard")) enhanceDashboard();
    };

    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true });

    if (pathname.startsWith("/teacher/attendance")) document.addEventListener("click", validateAttendanceRange, true);
    if (pathname.startsWith("/teacher/follow-up")) document.addEventListener("click", redirectFollowUpNotes, true);
    if (pathname.startsWith("/teacher/grades")) document.addEventListener("input", scheduleGradeSave, true);

    return () => {
      observer.disconnect();
      if (gradeSaveTimer !== null) window.clearTimeout(gradeSaveTimer);
      document.removeEventListener("click", validateAttendanceRange, true);
      document.removeEventListener("click", redirectFollowUpNotes, true);
      document.removeEventListener("input", scheduleGradeSave, true);
    };
  }, [pathname]);

  return null;
}
