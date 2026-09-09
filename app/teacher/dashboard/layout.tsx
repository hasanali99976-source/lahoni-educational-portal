import type { ReactNode } from "react";
import DashboardClassLinks from "./dashboard-class-links";
import DashboardTimetableTasks from "./dashboard-timetable-tasks";
import TimetableAutoSync from "../timetable/timetable-auto-sync";
import TeacherSubjectGateway from "./teacher-subject-gateway";
import "./teacher-subject-gateway-v600.css";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <>
    <TimetableAutoSync />
    <TeacherSubjectGateway />
    <DashboardClassLinks />
    <DashboardTimetableTasks />
    {children}
  </>;
}
