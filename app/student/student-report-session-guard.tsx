"use client";

import { useEffect } from "react";

const REPORT_RECOVERY_KEY = "lahooni-student-report-recovery";
const STUDENT_QR_LOCK_KEY = "lahooni-student-qr-lock";
const STUDENT_CODE_PATTERN = /^TH[123]\d{3}$/;

function normalizeCode(value: unknown) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

function readCurrentStudentCode() {
  const code = normalizeCode(document.querySelector<HTMLElement>(".sta4-id code")?.textContent);
  return STUDENT_CODE_PATTERN.test(code) ? code : "";
}

function readRecoveryCode() {
  try {
    const code = normalizeCode(window.sessionStorage.getItem(REPORT_RECOVERY_KEY));
    return STUDENT_CODE_PATTERN.test(code) ? code : "";
  } catch {
    return "";
  }
}

function clearRecovery() {
  try {
    window.sessionStorage.removeItem(REPORT_RECOVERY_KEY);
  } catch {}
}

export default function StudentReportSessionGuard() {
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.has("logout")) {
      clearRecovery();
      try {
        window.sessionStorage.removeItem(STUDENT_QR_LOCK_KEY);
      } catch {}
      return;
    }

    let cleanupTimer: ReturnType<typeof window.setTimeout> | null = null;
    let restoring = false;

    const markReportRecovery = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button") : null;
      if (!target) return;
      const label = String(target.textContent || "").replace(/\s+/g, " ").trim();
      if (!label.includes("بيان التقدم") && !label.includes("PDF")) return;
      const code = readCurrentStudentCode();
      if (!code) return;
      try {
        window.sessionStorage.setItem(REPORT_RECOVERY_KEY, code);
      } catch {}
      if (cleanupTimer) window.clearTimeout(cleanupTimer);
      cleanupTimer = window.setTimeout(clearRecovery, 20_000);
    };

    const recoverIfNeeded = () => {
      if (restoring || window.location.pathname !== "/student") return;
      if (document.querySelector(".student-academy-v4")) {
        if (readRecoveryCode()) {
          if (cleanupTimer) window.clearTimeout(cleanupTimer);
          cleanupTimer = window.setTimeout(clearRecovery, 2_500);
        }
        return;
      }
      const code = readRecoveryCode();
      if (!code) return;
      restoring = true;
      const target = new URL("/student", window.location.origin);
      target.searchParams.set("code", code);
      target.searchParams.set("entry", "report-recovery");
      window.location.replace(target.toString());
    };

    document.addEventListener("click", markReportRecovery, true);
    window.addEventListener("pageshow", recoverIfNeeded);
    window.addEventListener("focus", recoverIfNeeded);
    const observer = new MutationObserver(recoverIfNeeded);
    observer.observe(document.body, { childList: true, subtree: true });
    window.setTimeout(recoverIfNeeded, 50);
    window.setTimeout(recoverIfNeeded, 600);

    return () => {
      document.removeEventListener("click", markReportRecovery, true);
      window.removeEventListener("pageshow", recoverIfNeeded);
      window.removeEventListener("focus", recoverIfNeeded);
      observer.disconnect();
      if (cleanupTimer) window.clearTimeout(cleanupTimer);
    };
  }, []);

  return null;
}
