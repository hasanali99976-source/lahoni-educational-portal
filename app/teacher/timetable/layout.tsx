import type { ReactNode } from "react";
import TimetableAutoSync from "./timetable-auto-sync";

export default function TimetableLayout({ children }: { children: ReactNode }) {
  return <>
    <TimetableAutoSync />
    {children}
  </>;
}
