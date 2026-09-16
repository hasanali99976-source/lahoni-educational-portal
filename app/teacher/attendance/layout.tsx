import type { ReactNode } from "react";
import AttendanceClassDeepLink from "./attendance-class-deep-link";
import AttendanceScheduleGuard from "./attendance-schedule-guard";
import AttendanceVisibleCounterSync from "./attendance-visible-counter-sync";
import "./attendance-compact-current.css";

export default function AttendanceLayout({ children }: { children: ReactNode }) {
  return <>
    <AttendanceClassDeepLink />
    <AttendanceScheduleGuard />
    <AttendanceVisibleCounterSync />
    {children}
  </>;
}
