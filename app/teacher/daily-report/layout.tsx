import type { ReactNode } from "react";
import TimetableAutoSync from "../timetable/timetable-auto-sync";
import DisciplineDownloadV4 from "./discipline-download-v4";
import "./discipline-pdf-v500.css";

export default function DailyReportLayout({ children }: { children: ReactNode }) {
  return <>
    <TimetableAutoSync />
    <DisciplineDownloadV4 />
    {children}
  </>;
}
