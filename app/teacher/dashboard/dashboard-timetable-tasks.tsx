"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { tenantCollection } from "../../../lib/teacher-tenant";
import { useTeacherClient } from "../../../lib/teacher-client";
import "./dashboard-timetable-tasks.css";

type Lesson = { subject?: string; className?: string; notes?: string };
type PendingTimetable = { lessons?: Record<string, Lesson>; classNames?: string[]; updatedAt?: string };
type AttendanceRecord = { class?: string; date?: string };
type DailyLesson = { period: number; className: string; notes: string };

function riyadhDateKey() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function riyadhWeekdayKey() {
  return new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Riyadh", weekday: "long" }).format(new Date()).toLowerCase();
}

function readPendingTimetable(key: string): PendingTimetable | null {
  if (!key || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingTimetable;
    return parsed?.lessons && typeof parsed.lessons === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function mergePendingTimetable(serverLessons: Record<string, Lesson>, pending: PendingTimetable | null) {
  if (!pending?.lessons) return serverLessons;
  const ownedClasses = new Set((pending.classNames || []).map(value => String(value || "").trim()).filter(Boolean));
  const retained = Object.fromEntries(Object.entries(serverLessons).filter(([, lesson]) => !ownedClasses.has(String(lesson.className || "").trim())));
  return { ...retained, ...pending.lessons };
}

export default function DashboardTimetableTasks() {
  const session = useTeacherClient();
  const [target, setTarget] = useState<Element | null>(null);
  const [timetable, setTimetable] = useState<Record<string, Lesson>>({});
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);

  const subjectKey = String(session?.subjectKey || "");
  const workspaceKey = String(session?.workspaceKey || session?.subjectKey || "");
  const storageKey = session?.teacherId && workspaceKey
    ? `ostadh-lahooni:timetable:${session.teacherId}:${workspaceKey}:${session.activeGrade || "all"}`
    : "";
  const today = useMemo(riyadhDateKey, []);
  const weekday = useMemo(riyadhWeekdayKey, []);

  const loadTimetable = useCallback(async () => {
    if (!subjectKey) return;
    const pendingBefore = readPendingTimetable(storageKey);
    if (pendingBefore?.lessons) setTimetable(current => mergePendingTimetable(current, pendingBefore));
    try {
      const response = await fetch(`/api/teacher/timetable?subjectId=${encodeURIComponent(subjectKey)}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({})) as { lessons?: unknown };
      const serverLessons = response.ok && data.lessons && typeof data.lessons === "object"
        ? data.lessons as Record<string, Lesson>
        : {};
      setTimetable(mergePendingTimetable(serverLessons, readPendingTimetable(storageKey)));
    } catch {
      const pendingAfter = readPendingTimetable(storageKey);
      if (pendingAfter?.lessons) setTimetable(current => mergePendingTimetable(current, pendingAfter));
    }
  }, [subjectKey, storageKey]);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    let observer: MutationObserver | null = null;
    const attach = () => {
      if (cancelled) return;
      const node = document.querySelector(".td16-tasks-panel .td16-task-list");
      if (!node) {
        attempts += 1;
        if (attempts < 40) window.setTimeout(attach, 100);
        return;
      }
      const markOriginal = () => {
        Array.from(node.children).forEach(child => {
          if (child.classList.contains("tdsync-live") || child.classList.contains("tdsync-live-empty")) return;
          child.classList.add("tdsync-original");
        });
      };
      markOriginal();
      observer = new MutationObserver(markOriginal);
      observer.observe(node, { childList: true });
      setTarget(node);
    };
    attach();
    return () => {
      cancelled = true;
      observer?.disconnect();
      document.querySelectorAll(".td16-task-list .tdsync-original").forEach(node => node.classList.remove("tdsync-original"));
    };
  }, []);

  useEffect(() => { void loadTimetable(); }, [loadTimetable]);
  useEffect(() => {
    const refresh = () => void loadTimetable();
    const visible = () => { if (document.visibilityState === "visible") void loadTimetable(); };
    window.addEventListener("lahooni:timetable-updated", refresh as EventListener);
    window.addEventListener("lahooni:timetable-synced", refresh as EventListener);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("lahooni:timetable-updated", refresh as EventListener);
      window.removeEventListener("lahooni:timetable-synced", refresh as EventListener);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [loadTimetable]);

  useEffect(() => {
    if (!session?.teacherId || !subjectKey) return;
    return onSnapshot(
      collection(db, tenantCollection(session.teacherId, subjectKey as never, "attendance")),
      snapshot => setAttendance(snapshot.docs.map(item => item.data() as AttendanceRecord)),
      () => setAttendance([]),
    );
  }, [session?.teacherId, subjectKey]);

  const lessons = useMemo<DailyLesson[]>(() => Object.entries(timetable).flatMap(([cell, lesson]) => {
    const match = cell.match(/^(sunday|monday|tuesday|wednesday|thursday)-([1-7])$/);
    if (!match || match[1] !== weekday || !lesson.className) return [];
    return [{ period: Number(match[2]), className: String(lesson.className), notes: String(lesson.notes || "") }];
  }).sort((a, b) => a.period - b.period), [timetable, weekday]);

  const savedToday = useMemo(() => new Set(attendance.filter(item => item.date === today && item.class).map(item => String(item.class))), [attendance, today]);

  if (!target) return null;

  return createPortal(<>
    {lessons.length ? lessons.map((lesson, index) => {
      const done = savedToday.has(lesson.className);
      return <Link
        href={`/teacher/attendance?class=${encodeURIComponent(lesson.className)}`}
        key={`${lesson.period}-${lesson.className}`}
        className={`tdsync-live${done ? " done" : ""}`}
      >
        <span>{done ? "✓" : String(index + 1).padStart(2, "0")}</span>
        <div>
          <b>حصة {session?.subject || "المادة"} • {lesson.className}</b>
          <small>الحصة {lesson.period}{lesson.notes ? ` • ${lesson.notes}` : ""}</small>
        </div>
        <i>‹</i>
      </Link>;
    }) : <div className="td16-task-empty tdsync-live-empty"><b>لا توجد مهام مجدولة اليوم</b><span>أضف جدولك ليظهر يومك تلقائيًا.</span></div>}
  </>, target);
}
