"use client";

import type { ReactNode } from "react";
import TeacherV24RuntimeFixes from "./v24-runtime-fixes";
import TeacherSubjectGate, { TeacherNavigationLoading } from "./teacher-subject-gate";
import "./print-theme.css";
import "./teacher-platform-v28.css";
import "./teacher-platform-v29.css";
import "./teacher-platform-v30.css";
import "./teacher-platform-v31.css";

export default function TeacherTemplate({ children }: { children: ReactNode }) {
  return <><TeacherV24RuntimeFixes /><TeacherSubjectGate /><TeacherNavigationLoading />{children}</>;
}
