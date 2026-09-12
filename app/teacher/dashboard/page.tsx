"use client";

import TeacherDashboardV31 from "./dashboard-v31";
import TeacherCompetitionProgress from "../competition-progress";
import "./dashboard-v31.css";

export default function TeacherDashboardPage(){
  return <>
    <TeacherDashboardV31/>
    <div className="teacher-dashboard-race"><TeacherCompetitionProgress/></div>
  </>;
}