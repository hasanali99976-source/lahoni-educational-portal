import type { ReactNode } from "react";
import AttendanceClassDeepLink from "./attendance-class-deep-link";
import AttendanceScheduleGuardV2 from "./attendance-schedule-guard-v2";
import AttendanceVisibleCounterSync from "./attendance-visible-counter-sync";
import "./attendance-compact-current.css";

export default function AttendanceLayout({ children }: { children: ReactNode }) {
  return <>
    <AttendanceClassDeepLink />
    <AttendanceScheduleGuardV2 />
    <AttendanceVisibleCounterSync />
    {children}
  </>;
}
