"use client";

import { useEffect, useRef } from "react";
import { useTeacherClient } from "../../../lib/teacher-client";

type Lesson = { subject: string; className: string; notes: string };
type PendingTimetable = { lessons: Record<string, Lesson>; classNames: string[]; updatedAt: string };

const RETRY_MS = 15000;

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
    };
  } catch {
    return null;
  }
}

export default function TimetableAutoSync() {
  const session = useTeacherClient();
  const syncing = useRef(false);
  const teacherId = session?.teacherId || "";
  const subjectKey = session?.subjectKey || "";
  const workspaceKey = session?.workspaceKey || subjectKey;
  const activeGrade = session?.activeGrade || "all";
  const storageKey = teacherId
    ? `ostadh-lahooni:timetable:${teacherId}:${workspaceKey}:${activeGrade}`
    : "";

  useEffect(() => {
    if (!storageKey || !subjectKey) return;
    let stopped = false;

    const syncPending = async () => {
      if (stopped || syncing.current || !navigator.onLine) return;
      const pending = readPending(storageKey);
      if (!pending) return;
      syncing.current = true;
      try {
        const response = await fetch("/api/teacher/timetable", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          credentials: "same-origin",
          body: JSON.stringify({
            subjectId: subjectKey,
            classNames: pending.classNames,
            lessons: pending.lessons,
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
        // Keep the local copy; another retry will run automatically.
      } finally {
        syncing.current = false;
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void syncPending();
    };
    const onUpdate = () => void syncPending();

    void syncPending();
    const timer = window.setInterval(() => void syncPending(), RETRY_MS);
    window.addEventListener("online", onUpdate);
    window.addEventListener("focus", onUpdate);
    window.addEventListener("lahooni:timetable-updated", onUpdate as EventListener);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener("online", onUpdate);
      window.removeEventListener("focus", onUpdate);
      window.removeEventListener("lahooni:timetable-updated", onUpdate as EventListener);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [storageKey, subjectKey]);

  return null;
}
