import type { ReactNode } from "react";
import TimetableAutoSync from "../timetable/timetable-auto-sync";
import "./discipline-pdf-v500.css";

export default function DailyReportLayout({ children }: { children: ReactNode }) {
  return <>
    <TimetableAutoSync />
    {children}
  </>;
}
