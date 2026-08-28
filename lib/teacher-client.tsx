"use client";

import React, { createContext, useContext, useEffect } from "react";
import { usePathname } from "next/navigation";
import { saveLocalRoster, type UnifiedStudent } from "./unified-roster";

export type TeacherClientAssignment = {
  id: string;
  subjectId: string;
  grade: string;
  section: string;
  label: string;
};

export type TeacherClientSubject = {
  workspaceKey: string;
  subjectId: string;
  subjectName: string;
  grade?: number | null;
  grades?: string[];
  gradeLabel?: string;
};

export type TeacherClientSession = {
  authenticated?: boolean;
  teacherId?: string | null;
  teacherName?: string | null;
  subjectKey?: string | null;
  workspaceKey?: string | null;
  activeGrade?: number | null;
  activeGradeLabel?: string | null;
  subject?: string | null;
  subjects?: TeacherClientSubject[];
  assignments?: TeacherClientAssignment[];
  setSubject?: (workspaceKey: string) => Promise<void>;
  refresh?: () => Promise<void>;
};

export const TeacherClientContext = createContext<TeacherClientSession>({});

const recentBootstraps = new Map<string, number>();
const DIRECT_ROSTER_PAGES = new Set(["/teacher/students", "/teacher/attendance", "/teacher/grades", "/teacher/timetable"]);

export function useTeacherClient() {
  const session = useContext(TeacherClientContext);
  const pathname = usePathname();
  const teacherId = session.teacherId || "";
  const subjectKey = session.subjectKey || "";
  const workspaceKey = session.workspaceKey || subjectKey;
  const activeGrade = session.activeGrade || null;

  useEffect(() => {
    if (DIRECT_ROSTER_PAGES.has(pathname)) return;
    if (!teacherId || !subjectKey) return;

    const key = `${teacherId}:${workspaceKey}`;
    const lastRun = recentBootstraps.get(key) || 0;
    if (Date.now() - lastRun < 60_000) return;
    recentBootstraps.set(key, Date.now());

    let active = true;
    const params = new URLSearchParams({ subjectId: subjectKey });
    if (activeGrade) params.set("grade", String(activeGrade));
    fetch(`/api/teacher/students?${params.toString()}`, { cache: "no-store" })
      .then(response => response.ok ? response.json() : Promise.reject(new Error("roster_load_failed")))
      .then(data => {
        if (!active || !Array.isArray(data.students)) return;
        const students = data.students.map((student: Record<string, unknown>) => {
          const code = String(student.code || student.accessCode || student.studentCode || student.id || "").trim().toUpperCase();
          const className = String(student.className || student.class || "").trim();
          return {
            ...student,
            id: code,
            code,
            accessCode: code,
            studentCode: code,
            class: className,
            className,
            active: true,
            rosterActive: true,
          } as UnifiedStudent;
        }).filter((student: UnifiedStudent) => !!student.id && !!student.name && !!student.class);
        saveLocalRoster(teacherId, students, workspaceKey);
      })
      .catch(() => {
        recentBootstraps.delete(key);
      });

    return () => { active = false; };
  }, [pathname, teacherId, subjectKey, workspaceKey, activeGrade]);

  return session;
}
