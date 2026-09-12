"use client";

import type { ReactNode } from "react";
import TeacherV24RuntimeFixes from "./v24-runtime-fixes";
import "./print-theme.css";

export default function TeacherTemplate({ children }: { children: ReactNode }) {
  return <>
    <style>{`
      body:has(.teacher-studio), body:has(.teacher-login-unified),
      .teacher-studio, .teacher-studio *,
      .teacher-login-unified, .teacher-login-unified * {
        font-family: "Tajawal", "Segoe UI", Tahoma, Arial, sans-serif !important;
        letter-spacing: 0 !important;
      }
    `}</style>
    <TeacherV24RuntimeFixes />
    {children}
  </>;
}
