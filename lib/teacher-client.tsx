"use client";
import React, { createContext, useContext } from "react";

export type TeacherClientSession = {
  authenticated?: boolean;
  teacherId?: string | null;
  teacherName?: string | null;
  subjectKey?: string | null;
  subject?: string | null;
  subjects?: Array<{ subjectId: string; subjectName: string }>;
  setSubject?: (subjectId: string) => Promise<void>;
  refresh?: () => Promise<void>;
};

export const TeacherClientContext = createContext<TeacherClientSession>({});

export function useTeacherClient() {
  return useContext(TeacherClientContext);
}
