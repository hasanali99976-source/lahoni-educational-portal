import type { ReactNode } from "react";
import DashboardClassLinks from "./dashboard-class-links";
import DashboardTimetableTasks from "./dashboard-timetable-tasks";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <>
    <DashboardClassLinks />
    <DashboardTimetableTasks />
    {children}
  </>;
}
