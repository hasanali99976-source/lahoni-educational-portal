import type { ReactNode } from "react";
import AttendanceVisibleCounterSync from "./attendance-visible-counter-sync";
import "./attendance-compact-current.css";

export default function AttendanceLayout({ children }: { children: ReactNode }) {
  return <>
    <AttendanceVisibleCounterSync />
    {children}
  </>;
}
