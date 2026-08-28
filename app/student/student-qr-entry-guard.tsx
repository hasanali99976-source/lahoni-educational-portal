"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

const QR_LOCK_KEY = "lahooni-student-qr-entry";
const QR_CODE_KEY = "lahooni-student-qr-code";
const CODE_PATTERN = /^TH[123]\d{3}$/;

function normalizeCode(value: string) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

function clearQrEntry() {
  try {
    sessionStorage.removeItem(QR_LOCK_KEY);
    sessionStorage.removeItem(QR_CODE_KEY);
  } catch {}
  document.documentElement.classList.remove("student-qr-entry-locked");
}

export default function StudentQrEntryGuard() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    if (!pathname.startsWith("/student")) return;

    const params = new URLSearchParams(window.location.search);
    const incomingCode = normalizeCode(params.get("code") || "");
    const directQrEntry = params.get("entry") === "iphone-qr" && CODE_PATTERN.test(incomingCode);

    try {
      if (directQrEntry) {
        sessionStorage.setItem(QR_LOCK_KEY, "1");
        sessionStorage.setItem(QR_CODE_KEY, incomingCode);
      }
    } catch {}

    let locked = false;
    let savedCode = "";
    try {
      locked = sessionStorage.getItem(QR_LOCK_KEY) === "1";
      savedCode = normalizeCode(sessionStorage.getItem(QR_CODE_KEY) || "");
    } catch {}

    if (params.has("logout")) {
      clearQrEntry();
      return;
    }

    if (locked && !CODE_PATTERN.test(incomingCode) && CODE_PATTERN.test(savedCode)) {
      const resume = new URL("/student", window.location.origin);
      resume.searchParams.set("code", savedCode);
      resume.searchParams.set("entry", "iphone-qr");
      resume.searchParams.set("resume", "1");
      resume.searchParams.set("v", "46");
      window.location.replace(resume.toString());
      return;
    }

    if (!locked) return;

    document.documentElement.classList.add("student-qr-entry-locked");

    const armHistory = () => {
      const current = `${window.location.pathname}${window.location.search}`;
      window.history.pushState({ lahooniStudentQr: true }, "", current);
    };
    const timer = window.setTimeout(armHistory, 80);

    const keepInsideStudentPortal = () => {
      let stillLocked = false;
      try { stillLocked = sessionStorage.getItem(QR_LOCK_KEY) === "1"; } catch {}
      if (!stillLocked) return;
      window.history.pushState({ lahooniStudentQr: true }, "", "/student");
    };

    const handleClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("a,button") : null;
      if (!target) return;

      const text = (target.textContent || "").replace(/\s+/g, " ").trim();
      const action = target.dataset.studentAction || target.dataset.portalCommand;
      if (action === "logout" || /تسجيل الخروج|تسجيل دخول آخر/.test(text)) {
        clearQrEntry();
        return;
      }

      if (target instanceof HTMLAnchorElement) {
        const destination = new URL(target.href, window.location.origin);
        if (destination.origin === window.location.origin && destination.pathname === "/") {
          event.preventDefault();
          event.stopPropagation();
          window.location.replace("/student");
        }
      }
    };

    window.addEventListener("popstate", keepInsideStudentPortal);
    document.addEventListener("click", handleClick, true);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("popstate", keepInsideStudentPortal);
      document.removeEventListener("click", handleClick, true);
    };
  }, [pathname]);

  return <style>{`
    .student-qr-entry-locked .student-login-form > a.portal-back[href="/"]{display:none!important}
    .student-qr-entry-locked .student-login-form::before{content:"دخول مباشر وآمن عبر باركود الطالب";display:block;margin-bottom:18px;padding:10px 12px;border-radius:12px;background:#e7f7f3;color:#08766c;font-weight:900;text-align:center}
  `}</style>;
}
