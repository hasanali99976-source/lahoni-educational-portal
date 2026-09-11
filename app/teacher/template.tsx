"use client";

import type { ReactNode } from "react";
import TeacherV24RuntimeFixes from "./v24-runtime-fixes";
import TeacherSubjectGate, { TeacherNavigationLoading } from "./teacher-subject-gate";
import "./teacher-v400.css";
import "./teacher-ux-v510.css";
import "./teacher-command-v21.css";

export default function TeacherTemplate({ children }: { children: ReactNode }) {
  return <><TeacherV24RuntimeFixes /><TeacherSubjectGate /><TeacherNavigationLoading />{children}</>;
}
