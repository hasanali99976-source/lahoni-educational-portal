import type { ReactNode } from "react";
import TimetableAutoSync from "../timetable/timetable-auto-sync";
import DisciplineDownloadV2 from "./discipline-download-v2";
import "./discipline-pdf-v500.css";

export default function DailyReportLayout({ children }: { children: ReactNode }) {
  return <>
    <TimetableAutoSync />
    <DisciplineDownloadV2 />
    {children}
  </>;
}
