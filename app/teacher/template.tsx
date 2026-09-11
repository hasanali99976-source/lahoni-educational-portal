"use client";

import type { ReactNode } from "react";
import TeacherV24RuntimeFixes from "./v24-runtime-fixes";
import TeacherSubjectGate, { TeacherNavigationLoading } from "./teacher-subject-gate";
import "./print-theme.css";
import "./teacher-shell-v38.css";

// Preview deployment trigger for structural teacher shell V39.
export default function TeacherTemplate({ children }: { children: ReactNode }) {
  return <><TeacherV24RuntimeFixes /><TeacherSubjectGate /><TeacherNavigationLoading />{children}</>;
}
