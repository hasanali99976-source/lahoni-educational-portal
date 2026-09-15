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

export function useTeacherClient() {
  // Firestore drain guard: this shared hook must stay side-effect free.
  // Roster data is loaded only by pages that explicitly need it, never in the background
  // while navigating around the teacher portal. This preserves all stored student/teacher data.
  return useContext(TeacherClientContext);
}
