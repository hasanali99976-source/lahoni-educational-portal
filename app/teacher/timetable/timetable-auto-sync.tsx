"use client";

import { useEffect, useRef } from "react";
import { useTeacherClient } from "../../../lib/teacher-client";

type Lesson = { subject: string; className: string; notes: string };
type PendingTimetable = { lessons: Record<string, Lesson>; classNames: string[]; updatedAt: string; baseUpdatedAt?: string };

function readPending(key: string): PendingTimetable | null {
  if (!key) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingTimetable>;
    if (!parsed.lessons || !Array.isArray(parsed.classNames)) return null;
    return {
      lessons: parsed.lessons as Record<string, Lesson>,
      classNames: parsed.classNames.map(String).filter(Boolean),
      updatedAt: String(parsed.updatedAt || ""),
      baseUpdatedAt: parsed.baseUpdatedAt ? String(parsed.baseUpdatedAt) : undefined,
    };
  } catch {
    return null;
  }
}

export default function TimetableAutoSync() {
  const session = useTeacherClient();
  const syncing = useRef(false);
  const lastAttemptedVersion = useRef("");
  const teacherId = session?.teacherId || "";
  const subjectKey = session?.subjectKey || "";
  const workspaceKey = session?.workspaceKey || subjectKey;
  const activeGrade = session?.activeGrade || "all";
  const storageKey = teacherId
    ? `ostadh-lahooni:timetable:${teacherId}:${workspaceKey}:${activeGrade}`
    : "";

  useEffect(() => {
    if (!storageKey || !subjectKey || activeGrade === "all") return;
    let stopped = false;

    const syncPending = async () => {
      if (stopped || syncing.current || !navigator.onLine) return;
      const pending = readPending(storageKey);
      if (!pending) return;
      if (lastAttemptedVersion.current === pending.updatedAt) return;
      lastAttemptedVersion.current = pending.updatedAt;
      syncing.current = true;
      try {
        const response = await fetch("/api/teacher/timetable", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          credentials: "same-origin",
          body: JSON.stringify({
            subjectId: subjectKey,
            grade: activeGrade,
            classNames: pending.classNames,
            lessons: pending.lessons,
            expectedUpdatedAt: pending.baseUpdatedAt || "",
          }),
        });
        if (!response.ok) return;
        const latest = readPending(storageKey);
        if (latest && latest.updatedAt === pending.updatedAt) {
          window.localStorage.removeItem(storageKey);
          window.dispatchEvent(new CustomEvent("lahooni:timetable-synced", {
            detail: { storageKey, updatedAt: pending.updatedAt },
          }));
        }
      } catch {
        // Keep the local copy. A new explicit timetable update or a later page visit can retry.
      } finally {
        syncing.current = false;
      }
    };

    const onUpdate = () => { void syncPending(); };
    const onOnline = () => {
      lastAttemptedVersion.current = "";
      void syncPending();
    };

    void syncPending();
    window.addEventListener("online", onOnline);
    window.addEventListener("lahooni:timetable-updated", onUpdate as EventListener);

    return () => {
      stopped = true;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("lahooni:timetable-updated", onUpdate as EventListener);
    };
  }, [storageKey, subjectKey, activeGrade]);

  return null;
}
