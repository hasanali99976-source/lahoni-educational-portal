"use client";

import { useEffect } from "react";

const QR_SESSION_KEY = "lahooni-student-qr-lock";
const QR_ENTRIES = new Set(["qr", "iphone-qr", "qr-locked"]);
const STUDENT_CODE_PATTERN = /^TH[123]\d{3}$/;

function normalizeStudentCode(value: string) {
  return value
    .replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .trim()
    .toUpperCase();
}

export default function StudentQrLock() {
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const queryCode = normalizeStudentCode(query.get("code") || "");
    const enteredByQr = QR_ENTRIES.has(query.get("entry") || "") || STUDENT_CODE_PATTERN.test(queryCode);

    try {
      if (enteredByQr) window.sessionStorage.setItem(QR_SESSION_KEY, "1");
    } catch {}

    let locked = enteredByQr;
    try {
      locked = locked || window.sessionStorage.getItem(QR_SESSION_KEY) === "1";
    } catch {}
    if (!locked) return;

    document.documentElement.classList.add("student-qr-session");

    const isBlockedPortalUrl = (href: string) => {
      try {
        const url = new URL(href, window.location.href);
        return url.origin === window.location.origin && !url.pathname.startsWith("/student");
      } catch {
        return false;
      }
    };

    const returnToStudent = () => {
      if (!window.location.pathname.startsWith("/student")) {
        window.location.replace("/student?entry=qr-locked");
      }
    };

    const applyLockedUi = () => {
      document.querySelectorAll<HTMLAnchorElement>("a[href]").forEach(link => {
        const href = link.getAttribute("href") || "";
        if (!isBlockedPortalUrl(href)) return;
        link.hidden = true;
        link.style.setProperty("display", "none", "important");
        link.style.setProperty("visibility", "hidden", "important");
        link.style.setProperty("pointer-events", "none", "important");
        link.setAttribute("aria-hidden", "true");
        link.setAttribute("tabindex", "-1");
      });
      document.querySelectorAll<HTMLElement>(".portal-back").forEach(item => {
        item.hidden = true;
        item.style.setProperty("display", "none", "important");
      });
    };

    const blockPortalNavigation = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!target || !isBlockedPortalUrl(target.href)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      window.location.replace("/student?entry=qr-locked");
    };

    applyLockedUi();
    const observer = new MutationObserver(applyLockedUi);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", blockPortalNavigation, true);
    window.addEventListener("popstate", returnToStudent);
    window.addEventListener("pageshow", returnToStudent);
    window.setTimeout(applyLockedUi, 50);
    window.setTimeout(applyLockedUi, 500);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", blockPortalNavigation, true);
      window.removeEventListener("popstate", returnToStudent);
      window.removeEventListener("pageshow", returnToStudent);
      document.documentElement.classList.remove("student-qr-session");
    };
  }, []);

  return null;
}
