import type { ReactNode } from "react";
import TimetableAutoSync from "../timetable/timetable-auto-sync";
import TeacherSubjectGateway from "./teacher-subject-gateway";
import TeacherWelcomeVoice from "./teacher-welcome-voice";
import "./teacher-subject-gateway-v600.css";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <>
    <TeacherWelcomeVoice />
    <TimetableAutoSync />
    <TeacherSubjectGateway />
    {children}
  </>;
}
