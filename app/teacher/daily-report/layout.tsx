import type { ReactNode } from "react";
import TimetableAutoSync from "../timetable/timetable-auto-sync";
import DirectPdfDownloadFix from "./direct-pdf-download-fix";
import "./discipline-pdf-v500.css";

export default function DailyReportLayout({ children }: { children: ReactNode }) {
  return <>
    <TimetableAutoSync />
    <DirectPdfDownloadFix />
    {children}
  </>;
}
