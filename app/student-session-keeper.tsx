"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const SESSION_KEY = "lahooni-student-device-session-v1";
const RESTORE_KEY = "lahooni-student-restore-attempt-v1";
const SESSION_MS = 8 * 60 * 60 * 1000;

type SavedStudentSession = { code: string; expiresAt: number };

function readSavedSession(): SavedStudentSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as SavedStudentSession;
    if (!/^TH[123]\d{3}$/.test(String(saved.code || "")) || Number(saved.expiresAt || 0) <= Date.now()) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return saved;
  } catch {
    return null;
  }
}

function clearSavedSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(RESTORE_KEY);
  } catch {
    // Storage may be unavailable in strict privacy mode.
  }
}

export default function StudentSessionKeeper() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/student") return;
    let timer = 0;

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("button");
      if (!button) return;
      const text = (button.textContent || "").replace(/\s+/g, " ").trim();
      if (text === "خروج" || text.includes("تسجيل الخروج")) clearSavedSession();
    };
    document.addEventListener("click", onClick, true);

    const sync = () => {
      const code = String(document.querySelector(".sta4-id code")?.textContent || "").trim().toUpperCase();
      if (/^TH[123]\d{3}$/.test(code)) {
        try {
          localStorage.setItem(SESSION_KEY, JSON.stringify({ code, expiresAt: Date.now() + SESSION_MS }));
          sessionStorage.removeItem(RESTORE_KEY);
        } catch {
          // Keep the portal working without storage.
        }
        return;
      }

      const gateway = document.querySelector(".student-gateway-v4");
      if (!gateway) return;
      const saved = readSavedSession();
      if (!saved) return;
      const previousAttempt = Number(sessionStorage.getItem(RESTORE_KEY) || 0);
      if (Date.now() - previousAttempt < 15_000) return;
      sessionStorage.setItem(RESTORE_KEY, String(Date.now()));
      window.location.replace(`/student?code=${encodeURIComponent(saved.code)}&entry=device-session`);
    };

    timer = window.setTimeout(sync, 900);
    const observer = new MutationObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(sync, 500);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.removeEventListener("click", onClick, true);
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [pathname]);

  return null;
}
