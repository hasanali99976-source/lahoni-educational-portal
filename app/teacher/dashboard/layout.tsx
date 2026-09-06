import type { ReactNode } from "react";
import DashboardClassLinks from "./dashboard-class-links";
import DashboardTimetableTasks from "./dashboard-timetable-tasks";
import TimetableAutoSync from "../timetable/timetable-auto-sync";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <>
    <TimetableAutoSync />
    <DashboardClassLinks />
    <DashboardTimetableTasks />
    {children}
  </>;
}
