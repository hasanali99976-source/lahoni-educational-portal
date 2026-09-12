import type { ReactNode } from "react";
import CentralRosterSync from "../central-roster-sync";
import FollowUpPrintTools from "./print-tools";
import "../teacher-batch-v22.css";

export default function FollowUpLayout({ children }: { children: ReactNode }) {
  return <><CentralRosterSync /><FollowUpPrintTools />{children}</>;
}
