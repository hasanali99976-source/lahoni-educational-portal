"use client";

import { useEffect } from "react";

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase("ar");
}

function removeLegacyStudentAlerts() {
  document.querySelectorAll<HTMLElement>(".student-academy-v4 section,.student-academy-v4 article,.student-academy-v4 div").forEach(node => {
    if (node.closest(".sta600-alert-center,.sta800-alert-center")) return;
    const text = normalize(node.textContent || "");
    const isLegacyBanner = text.includes("يوجد تحديث مهم على تحصيلك")
      || (text.includes("تنبيه مهم يحتاج انتباه") && text.includes("فتح المادة"));
    if (!isLegacyBanner) return;

    const parent = node.parentElement;
    const parentText = normalize(parent?.textContent || "");
    if (parent && !parent.closest(".sta600-alert-center,.sta800-alert-center")
      && (parentText.includes("يوجد تحديث مهم على تحصيلك") || (parentText.includes("تنبيه مهم يحتاج انتباه") && parentText.includes("فتح المادة")))) {
      const grand = parent.parentElement;
      const grandText = normalize(grand?.textContent || "");
      if (grand && !grand.closest(".sta600-alert-center,.sta800-alert-center")
        && (grandText.includes("يوجد تحديث مهم على تحصيلك") || (grandText.includes("تنبيه مهم يحتاج انتباه") && grandText.includes("فتح المادة")))) {
        grand.remove();
      } else {
        parent.remove();
      }
    } else {
      node.remove();
    }
  });
}

export default function StudentUiCleanupRuntime() {
  useEffect(() => {
    let frame = 0;
    let timer = 0;

    const clean = () => {
      frame = 0;
      const portal = document.querySelector(".student-academy-v4");
      const chooser = document.querySelector(".student-subject-choice-v300");
      if (!portal && !chooser) return;

      removeLegacyStudentAlerts();

      document.querySelectorAll<HTMLButtonElement>(".student-change-subject-v300").forEach(button => {
        if (normalize(button.textContent || "") === "موادي") {
          button.textContent = "تغيير المادة";
          button.setAttribute("aria-label", "تغيير المادة بدون تسجيل الخروج");
        }
      });

      document.querySelectorAll<HTMLButtonElement>(".sta4-nav button").forEach(button => {
        const label = normalize(button.textContent || "");
        if (label) button.setAttribute("aria-label", label);
      });

      const seenNotes = new Set<string>();
      document.querySelectorAll<HTMLElement>(".sta4-note-list .sta4-note-item").forEach(note => {
        const key = normalize(note.textContent || "");
        if (!key) return;
        if (seenNotes.has(key)) {
          note.hidden = true;
          note.setAttribute("data-duplicate-note", "1");
        } else {
          seenNotes.add(key);
          note.hidden = false;
          note.removeAttribute("data-duplicate-note");
        }
      });
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(clean);
    };

    clean();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", schedule, true);
    window.addEventListener("pageshow", schedule);
    window.addEventListener("focus", schedule);
    timer = window.setTimeout(schedule, 700);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", schedule, true);
      window.removeEventListener("pageshow", schedule);
      window.removeEventListener("focus", schedule);
      if (frame) window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, []);

  return null;
}
