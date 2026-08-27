import type { ReactNode } from "react";
import CentralRosterSync from "../central-roster-sync";

export default function AttendanceLayout({ children }: { children: ReactNode }) {
  return <><CentralRosterSync />{children}</>;
}
