"use client";

import TeacherDashboardV31 from "./dashboard-v31";
import TeacherDashboardAnalyticsV40 from "./dashboard-analytics-v40";
import "./dashboard-v31.css";
import "./dashboard-analytics-v40.css";

export default function TeacherDashboardPage(){
  return <>
    <TeacherDashboardV31 />
    <TeacherDashboardAnalyticsV40 />
  </>;
}
