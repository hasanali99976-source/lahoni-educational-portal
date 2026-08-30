"use client";

import { useEffect } from "react";

const QR_SESSION_KEY = "lahooni-student-qr-lock";
const QR_ENTRIES = new Set(["qr", "iphone-qr", "qr-locked"]);

export default function StudentQrLock() {
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const enteredByQr = QR_ENTRIES.has(query.get("entry") || "");

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

    const applyLockedUi = () => {
      document.querySelectorAll<HTMLAnchorElement>("a[href]").forEach(link => {
        const href = link.getAttribute("href") || "";
        if (!isBlockedPortalUrl(href)) return;
        link.hidden = true;
        link.style.setProperty("display", "none", "important");
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

    const guardHistory = () => {
      if (!window.location.pathname.startsWith("/student")) {
        window.location.replace("/student?entry=qr-locked");
      }
    };

    applyLockedUi();
    const observer = new MutationObserver(applyLockedUi);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", blockPortalNavigation, true);
    window.addEventListener("popstate", guardHistory);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", blockPortalNavigation, true);
      window.removeEventListener("popstate", guardHistory);
      document.documentElement.classList.remove("student-qr-session");
    };
  }, []);

  return null;
}
