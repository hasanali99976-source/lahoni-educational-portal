import type { ReactNode } from "react";
import AttendanceScheduleGuard from "./attendance-schedule-guard";

export default function AttendanceLayout({ children }: { children: ReactNode }) {
  return <>
    <AttendanceScheduleGuard />
    {children}
  </>;
}
