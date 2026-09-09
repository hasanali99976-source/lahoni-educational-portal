import type { ReactNode } from "react";
import CentralRosterSync from "../central-roster-sync";
import ReferralManagerV510 from "./referral-manager-v510";
import FollowUpPrintTools from "./print-tools";
import "../teacher-batch-v22.css";

export default function FollowUpLayout({ children }: { children: ReactNode }) {
  return <><CentralRosterSync /><ReferralManagerV510 /><FollowUpPrintTools />{children}</>;
}
