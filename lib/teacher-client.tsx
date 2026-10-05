"use client";

import React, { createContext, useContext } from "react";

export type TeacherClientAssignment = { id: string; subjectId: string; grade: string; section: string; label: string; };
export type TeacherClientSubject = { workspaceKey: string; subjectId: string; subjectName: string; grade?: number | null; grades?: string[]; gradeLabel?: string; };
export type TeacherClientSession = {
  authenticated?: boolean; teacherId?: string | null; teacherName?: string | null; subjectKey?: string | null; workspaceKey?: string | null;
  activeGrade?: number | null; activeGradeLabel?: string | null; subject?: string | null; subjects?: TeacherClientSubject[];
  assignments?: TeacherClientAssignment[]; selectedClassIds?: string[]; classScopeCustomized?: boolean;
  setSubject?: (workspaceKey: string) => Promise<void>; refresh?: () => Promise<void>;
};

export const TeacherClientContext = createContext<TeacherClientSession>({});
export function normalizeTeacherClassPart(value: unknown) { return String(value ?? "").trim().replace(/\s+/g, " "); }
export function teacherAssignmentKey(assignment: Pick<TeacherClientAssignment, "grade" | "section">) { return `${normalizeTeacherClassPart(assignment.grade)}::${normalizeTeacherClassPart(assignment.section)}`; }

export function selectedTeacherSections(session: Pick<TeacherClientSession, "selectedClassIds" | "activeGrade">) {
  const grade = Number(session.activeGrade || 0);
  return [...new Set((session.selectedClassIds || []).map(String).map(v => v.trim()).filter(v => /^\d+-\d+$/.test(v)).filter(v => !grade || Number(v.split("-")[0]) === grade).map(v => v.split("-")[1]))];
}

export function teacherCanAccessClass(session: Pick<TeacherClientSession, "selectedClassIds" | "activeGrade">, grade: unknown, section: unknown) {
  const g = Number(String(grade ?? "").replace(/\D/g, ""));
  const s = String(section ?? "").replace(/\D/g, "");
  if (!g || !s) return false;
  return (session.selectedClassIds || []).includes(`${g}-${s}`);
}

export function getTeacherScopedAssignments(session: Pick<TeacherClientSession, "assignments" | "subjectKey" | "selectedClassIds" | "activeGrade">) {
  const assignments = Array.isArray(session.assignments) ? session.assignments : [];
  const subjectKey = normalizeTeacherClassPart(session.subjectKey);
  const selected = new Set(selectedTeacherSections(session));
  const grade = Number(session.activeGrade || 0);
  const scoped = assignments.filter(item => !subjectKey || normalizeTeacherClassPart(item.subjectId) === subjectKey).filter(item => {
    if (!selected.size) return false;
    const itemGrade = Number(String(item.grade || "").replace(/\D/g, ""));
    const section = String(item.section || "").replace(/\D/g, "");
    return (!grade || !itemGrade || itemGrade === grade) && selected.has(section);
  });
  const seen = new Set<string>();
  return scoped.filter(item => { const key = teacherAssignmentKey(item); if (!key || key === "::" || seen.has(key)) return false; seen.add(key); return true; });
}

export function useTeacherClient() { return useContext(TeacherClientContext); }
export function useTeacherScopedAssignments() { const session = useTeacherClient(); return getTeacherScopedAssignments(session); }
export function useTeacherSelectedSections() { const session = useTeacherClient(); return selectedTeacherSections(session); }
