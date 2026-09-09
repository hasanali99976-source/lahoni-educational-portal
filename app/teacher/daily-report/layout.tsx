import type { ReactNode } from "react";
import TimetableAutoSync from "../timetable/timetable-auto-sync";
import DisciplineDownloadV3 from "./discipline-download-v3";
import "./discipline-pdf-v500.css";

export default function DailyReportLayout({ children }: { children: ReactNode }) {
  return <>
    <TimetableAutoSync />
    <DisciplineDownloadV3 />
    {children}
  </>;
}
