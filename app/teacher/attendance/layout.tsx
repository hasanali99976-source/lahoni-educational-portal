import type { ReactNode } from "react";
import AttendanceScheduleGuard from "./attendance-schedule-guard";
import AttendanceClassDeepLink from "./attendance-class-deep-link";
import "./attendance-compact-current.css";

export default function AttendanceLayout({ children }: { children: ReactNode }) {
  return <>
    <AttendanceScheduleGuard />
    <AttendanceClassDeepLink />
    {children}
  </>;
}