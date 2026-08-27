"use client";
import React, { createContext, useContext } from "react";

export type TeacherClientAssignment = {
  id: string;
  subjectId: string;
  grade: string;
  section: string;
  label: string;
};

export type TeacherClientSession = {
  authenticated?: boolean;
  teacherId?: string | null;
  teacherName?: string | null;
  subjectKey?: string | null;
  subject?: string | null;
  subjects?: Array<{ subjectId: string; subjectName: string }>;
  assignments?: TeacherClientAssignment[];
  setSubject?: (subjectId: string) => Promise<void>;
  refresh?: () => Promise<void>;
};

export const TeacherClientContext = createContext<TeacherClientSession>({});

export function useTeacherClient() {
  return useContext(TeacherClientContext);
}
