import type { ReactNode } from "react";
import CentralRosterSync from "../central-roster-sync";
import PrintPopupCompat from "./print-popup-compat";

export default function FollowUpLayout({ children }: { children: ReactNode }) {
  return <><CentralRosterSync /><PrintPopupCompat />{children}</>;
}
