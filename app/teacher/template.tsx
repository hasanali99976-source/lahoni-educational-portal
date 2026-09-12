"use client";

import type { ReactNode } from "react";
import TeacherV24RuntimeFixes from "./v24-runtime-fixes";
import FollowUpEnhancerCurrent from "./follow-up/follow-up-enhancer-current";
import TeacherUiStability from "./teacher-ui-stability";
import "./teacher-typography-current.css";
import "./teacher-current-experience.css";
import "./teacher-avatar-current.css";
import "./teacher-shell-refinement-v41.css";
import "./teacher-clarity-v42.css";

export default function TeacherTemplate({ children }: { children: ReactNode }) {
  return <>
    <TeacherUiStability />
    <TeacherV24RuntimeFixes />
    <FollowUpEnhancerCurrent />
    {children}
  </>;
}
