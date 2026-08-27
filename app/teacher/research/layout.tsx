import type { ReactNode } from "react";
import CentralRosterSync from "../central-roster-sync";

export default function ResearchLayout({ children }: { children: ReactNode }) {
  return <><CentralRosterSync />{children}</>;
}
