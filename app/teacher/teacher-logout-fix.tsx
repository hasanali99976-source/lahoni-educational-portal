"use client";

import { useEffect } from "react";

const ENTRY_KEY = "lahooni:teacher-entry-complete";
const SUBJECT_KEY = "lahooni:teacher-subject-picked";

export default function TeacherLogoutFix() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button,a") as HTMLElement | null;
      if (!button) return;
      const text = (button.textContent || "").replace(/\s+/g, " ").trim();
      if (!text.includes("تسجيل الخروج")) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      try {
        sessionStorage.removeItem(ENTRY_KEY);
        sessionStorage.removeItem(SUBJECT_KEY);
      } catch {}

      // End the server session, but never let a slow auth/network request trap the user.
      void fetch("/api/teacher-logout", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        keepalive: true,
      }).catch(() => undefined);

      // Full navigation clears the teacher React state and returns to the official portal home.
      window.location.replace("/");
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
