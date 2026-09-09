import type { ReactNode } from "react";
import DashboardClassLinks from "./dashboard-class-links";
import DashboardTimetableTasks from "./dashboard-timetable-tasks";
import TimetableAutoSync from "../timetable/timetable-auto-sync";
import TeacherSubjectGateway from "./teacher-subject-gateway";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <>
    <TimetableAutoSync />
    <TeacherSubjectGateway />
    <DashboardClassLinks />
    <DashboardTimetableTasks />
    {children}
  </>;
}
