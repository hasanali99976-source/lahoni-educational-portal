"use client";

import { useEffect } from "react";

const STUDENT_SESSION_KEY = "lahooni-student-qr-lock";
const QR_ENTRIES = new Set(["qr", "iphone-qr", "qr-locked", "code-locked"]);
const STUDENT_CODE_PATTERN = /^TH[123]\d{3}$/;
const LOCK_STYLE_ID = "lahooni-student-code-lock-style";

function normalizeStudentCode(value: string) {
  return value
    .replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .trim()
    .toUpperCase();
}

function authenticatedStudentUiVisible() {
  return Boolean(document.querySelector(".student-clean, .student-subject-choices"));
}

export default function StudentQrLock() {
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const queryCode = normalizeStudentCode(query.get("code") || "");
    let locked = QR_ENTRIES.has(query.get("entry") || "") || STUDENT_CODE_PATTERN.test(queryCode);

    try {
      locked = locked || window.sessionStorage.getItem(STUDENT_SESSION_KEY) === "1";
    } catch {}

    const isBlockedPortalUrl = (href: string) => {
      try {
        const url = new URL(href, window.location.href);
        return url.origin === window.location.origin && !url.pathname.startsWith("/student");
      } catch {
        return false;
      }
    };

    const applyLockedUi = () => {
      if (!locked) return;
      document.querySelectorAll<HTMLAnchorElement>("a[href]").forEach(link => {
        const href = link.getAttribute("href") || "";
        if (isBlockedPortalUrl(href)) link.remove();
      });
      document.querySelectorAll<HTMLElement>(".portal-back").forEach(item => item.remove());
    };

    const activateLock = () => {
      locked = true;
      try {
        window.sessionStorage.setItem(STUDENT_SESSION_KEY, "1");
      } catch {}
      document.documentElement.classList.add("student-code-session");
      document.body.dataset.studentEntry = "code";

      if (!document.getElementById(LOCK_STYLE_ID)) {
        const style = document.createElement("style");
        style.id = LOCK_STYLE_ID;
        style.textContent = `
          html.student-code-session .portal-back,
          html.student-code-session a[href="/"],
          html.student-code-session a[href^="/?"],
          body[data-student-entry="code"] .portal-back {
            display: none !important;
            visibility: hidden !important;
            pointer-events: none !important;
          }
        `;
        document.head.appendChild(style);
      }
      applyLockedUi();
    };

    const detectAuthenticatedEntry = () => {
      if (authenticatedStudentUiVisible()) activateLock();
      else applyLockedUi();
    };

    const returnToStudent = () => {
      if (locked && !window.location.pathname.startsWith("/student")) {
        window.location.replace("/student?entry=code-locked");
      }
    };

    const blockPortalNavigation = (event: MouseEvent) => {
      if (!locked) return;
      const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!target || !isBlockedPortalUrl(target.href)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      window.location.replace("/student?entry=code-locked");
    };

    if (locked) activateLock();
    const observer = new MutationObserver(detectAuthenticatedEntry);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", blockPortalNavigation, true);
    window.addEventListener("popstate", returnToStudent);
    window.addEventListener("pageshow", returnToStudent);
    detectAuthenticatedEntry();
    window.setTimeout(detectAuthenticatedEntry, 50);
    window.setTimeout(detectAuthenticatedEntry, 500);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", blockPortalNavigation, true);
      window.removeEventListener("popstate", returnToStudent);
      window.removeEventListener("pageshow", returnToStudent);
      document.documentElement.classList.remove("student-code-session");
      delete document.body.dataset.studentEntry;
      document.getElementById(LOCK_STYLE_ID)?.remove();
    };
  }, []);

  return null;
}
