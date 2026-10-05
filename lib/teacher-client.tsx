"use client";

import React, { createContext, useContext } from "react";

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

export function normalizeTeacherClassPart(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

export function teacherAssignmentKey(assignment: Pick<TeacherClientAssignment, "grade" | "section">) {
  return `${normalizeTeacherClassPart(assignment.grade)}::${normalizeTeacherClassPart(assignment.section)}`;
}

export function getTeacherScopedAssignments(session: Pick<TeacherClientSession, "assignments" | "subjectKey">) {
  const assignments = Array.isArray(session.assignments) ? session.assignments : [];
  const subjectKey = normalizeTeacherClassPart(session.subjectKey);
  const scoped = subjectKey ? assignments.filter((item) => normalizeTeacherClassPart(item.subjectId) === subjectKey) : assignments;
  const seen = new Set<string>();
  return scoped.filter((item) => {
    const key = teacherAssignmentKey(item);
    if (!key || key === "::" || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function teacherCanAccessClass(
  session: Pick<TeacherClientSession, "assignments" | "subjectKey">,
  grade: unknown,
  section: unknown,
) {
  const wanted = `${normalizeTeacherClassPart(grade)}::${normalizeTeacherClassPart(section)}`;
  return getTeacherScopedAssignments(session).some((item) => teacherAssignmentKey(item) === wanted);
}

export function useTeacherClient() {
  // Firestore drain guard: this shared hook must stay side-effect free.
  // The teacher's selected/assigned classes come from the already-loaded session only.
  // Pages must filter against session.assignments instead of querying a global class roster.
  return useContext(TeacherClientContext);
}

export function useTeacherScopedAssignments() {
  const session = useTeacherClient();
  return getTeacherScopedAssignments(session);
}
