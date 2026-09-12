"use client";

import type { ReactNode } from "react";
import TeacherV24RuntimeFixes from "./v24-runtime-fixes";
import SubjectFirstEntryGate from "./subject-first-entry-gate";
import FollowUpEnhancerCurrent from "./follow-up/follow-up-enhancer-current";
import "./teacher-typography-current.css";
import "./teacher-current-experience.css";
import "./teacher-avatar-current.css";

export default function TeacherTemplate({ children }: { children: ReactNode }) {
  return <>
    <TeacherV24RuntimeFixes />
    <SubjectFirstEntryGate />
    {children}
    <FollowUpEnhancerCurrent />
  </>;
}
