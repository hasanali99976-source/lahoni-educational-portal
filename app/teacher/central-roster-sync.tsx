"use client";

import { useEffect } from "react";
import { useTeacherClient } from "../../lib/teacher-client";

export default function CentralRosterSync() {
  const session = useTeacherClient();
  const teacherId = session?.teacherId || "";
  const subjectId = session?.subjectKey || "";

  useEffect(() => {
    if (!teacherId || !subjectId) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 7000);
    fetch(`/api/teacher/students?subjectId=${encodeURIComponent(subjectId)}`, { cache:"no-store", signal:controller.signal })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(() => window.dispatchEvent(new CustomEvent("lahooni-central-roster-synced", { detail:{ teacherId, subjectId } })))
      .catch(() => undefined)
      .finally(() => window.clearTimeout(timer));
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [teacherId,subjectId]);

  return null;
}
