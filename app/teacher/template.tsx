"use client";

import type { ReactNode } from "react";
import TeacherV24RuntimeFixes from "./v24-runtime-fixes";
import "./teacher-typography-current.css";

export default function TeacherTemplate({ children }: { children: ReactNode }) {
  return <>
    <TeacherV24RuntimeFixes />
    {children}
  </>;
}
