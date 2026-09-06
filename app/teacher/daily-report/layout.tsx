import type { ReactNode } from "react";
import TimetableAutoSync from "../timetable/timetable-auto-sync";

export default function DailyReportLayout({ children }: { children: ReactNode }) {
  return <>
    <TimetableAutoSync />
    {children}
  </>;
}
