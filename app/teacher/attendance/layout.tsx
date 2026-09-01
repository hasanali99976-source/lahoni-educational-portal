import type { ReactNode } from "react";
import AttendanceScheduleGuard from "./attendance-schedule-guard";
import AttendancePrintEnhancer from "./attendance-print-enhancer";

export default function AttendanceLayout({ children }: { children: ReactNode }) {
  return <>
    <AttendancePrintEnhancer />
    <AttendanceScheduleGuard />
    {children}
  </>;
}
