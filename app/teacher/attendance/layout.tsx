import type { ReactNode } from "react";
import LocalAttendanceFallback from "./local-attendance-fallback";
import PendingAttendance from "./pending-attendance";

export default function AttendanceLayout({ children }: { children: ReactNode }) {
  return <><LocalAttendanceFallback /><PendingAttendance />{children}</>;
}
