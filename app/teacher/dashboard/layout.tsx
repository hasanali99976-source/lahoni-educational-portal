import type { ReactNode } from "react";
import DashboardClassLinks from "./dashboard-class-links";
import DashboardDailyTasks from "./dashboard-daily-tasks";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <>
    <DashboardClassLinks />
    <DashboardDailyTasks />
    {children}
  </>;
}
