import type { ReactNode } from "react";
import DashboardClassLinks from "./dashboard-class-links";
import TodayLessonsCenter from "./today-lessons-center";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <>
    <DashboardClassLinks />
    <TodayLessonsCenter />
    {children}
  </>;
}
