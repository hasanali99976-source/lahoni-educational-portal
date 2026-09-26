"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import TeacherV24RuntimeFixes from "./v24-runtime-fixes";
import TeacherUiStability from "./teacher-ui-stability";
import "./teacher-typography-current.css";
import "./teacher-current-experience.css";
import "./teacher-avatar-current.css";
import "./teacher-shell-refinement-v41.css";
import "./teacher-clarity-v42.css";

const ENTRY_KEY="lahooni:teacher-entry-complete";
const SUBJECT_KEY="lahooni:teacher-subject-picked";

export default function TeacherTemplate({ children }: { children: ReactNode }) {
  const pathname=usePathname();
  if(pathname==="/teacher"&&typeof window!=="undefined"){
    try{
      sessionStorage.removeItem(ENTRY_KEY);
      sessionStorage.removeItem(SUBJECT_KEY);
    }catch{}
  }
  return <>
    <TeacherUiStability />
    <TeacherV24RuntimeFixes />
    {children}
  </>;
}
