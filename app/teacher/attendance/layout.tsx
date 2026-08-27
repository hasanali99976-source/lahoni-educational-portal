import type { ReactNode } from "react";
import PendingAttendance from "./pending-attendance";

export default function AttendanceLayout({ children }: { children: ReactNode }) {
  return <><PendingAttendance />{children}</>;
}
