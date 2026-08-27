"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { TeacherClientContext, type TeacherClientSession } from "../lib/teacher-client";
import SharedRosterSync from "./teacher/students/shared-roster-sync";

export default function SharedRosterGlobalBootstrap() {
  const pathname = usePathname();
  const isTeacherArea = pathname.startsWith("/teacher/");
  const [session, setSession] = useState<TeacherClientSession | null>(null);

  useEffect(() => {
    if (!isTeacherArea) {
      setSession(null);
      return;
    }

    let active = true;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    const loadSession = async () => {
      try {
        const response = await fetch("/api/teacher-session", { cache: "no-store" });
        if (!response.ok) throw new Error("Teacher session unavailable");
        const nextSession = await response.json();
        if (active) setSession(nextSession);
      } catch {
        if (active) setSession(null);
      }
    };

    const refreshSoon = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => void loadSession(), 450);
    };

    void loadSession();
    window.addEventListener("focus", loadSession);
    document.addEventListener("change", refreshSoon, true);

    return () => {
      active = false;
      if (refreshTimer) clearTimeout(refreshTimer);
      window.removeEventListener("focus", loadSession);
      document.removeEventListener("change", refreshSoon, true);
    };
  }, [isTeacherArea, pathname]);

  if (!isTeacherArea || !session?.teacherId || !session.subjectKey) return null;

  return <TeacherClientContext.Provider value={session}>
    <SharedRosterSync />
  </TeacherClientContext.Provider>;
}
