import type { ReactNode } from "react";
import CentralRosterSync from "../central-roster-sync";
import ReferralManagerV510 from "./referral-manager-v510";

export default function FollowUpLayout({ children }: { children: ReactNode }) {
  return <><CentralRosterSync /><ReferralManagerV510 />{children}</>;
}
