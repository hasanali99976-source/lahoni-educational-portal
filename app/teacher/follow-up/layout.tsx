import type { ReactNode } from "react";
import CentralRosterSync from "../central-roster-sync";
import MasteryDashboardV2 from "./mastery-dashboard-v2";
import "../teacher-batch-v22.css";

export default function FollowUpLayout({ children: _children }: { children: ReactNode }) {
  return <><CentralRosterSync /><MasteryDashboardV2 /></>;
}
