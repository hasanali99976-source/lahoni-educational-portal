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
  const target = event.target instanceof Element ? target.closest<HTMLButtonElement>(".attendance-range-controls button") : null;
  if (!target) return;
  const controls = target.closest(".attendance-range-controls");
  const inputs = controls?.querySelectorAll<HTMLInputElement>('input[type="date"]');
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
  const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-v105-notes-redirect="1"]') : null;
  if (!target) return;
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
  document.querySelectorAll<HTMLElement>("h1").forEach(element => {
    if (element.closest(".teacher-page-content") && ["يومي", "مركز العمل اليومي", "لوحة المعلم اليومية"].some(value => element.textContent?.includes(value))) {
      element.textContent = "قياس معلومات الطلاب";
    }
  });
}

export default function PortalV105Runtime() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;

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

    return () => {
      observer.disconnect();
      document.removeEventListener("click", validateAttendanceRange, true);
      document.removeEventListener("click", redirectFollowUpNotes, true);
    };
  }, [pathname]);

  return null;
}
