"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import "./teacher-notes-identity-runtime.css";

type SessionData = { authenticated?: boolean; teacherName?: string | null; subject?: string | null; activeGradeLabel?: string | null };

export default function TeacherNotesIdentityRuntime() {
  const pathname = usePathname();
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [session, setSession] = useState<SessionData>({});

  useEffect(() => {
    if (pathname !== "/teacher/notes") { setHost(null); return; }
    const locate = () => setHost(document.querySelector(".nv10-compose-head") as HTMLElement | null);
    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { childList: true, subtree: true });
    fetch("/api/teacher-session", { cache: "no-store" })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(data => setSession(data))
      .catch(() => {});
    return () => observer.disconnect();
  }, [pathname]);

  if (pathname !== "/teacher/notes" || !host || !session.authenticated) return null;
  return createPortal(
    <div className="nv10-identity-runtime" aria-label="هوية الملاحظة">
      <span><small>المادة</small><b>{session.subject || "المادة الحالية"}</b></span>
      <span><small>المعلم</small><b>{session.teacherName || "معلم المادة"}</b></span>
      {session.activeGradeLabel ? <span><small>الصف</small><b>{session.activeGradeLabel}</b></span> : null}
    </div>,
    host,
  );
}
