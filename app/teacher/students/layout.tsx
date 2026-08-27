import type { ReactNode } from "react";
import SharedRosterSync from "./shared-roster-sync";

export default function StudentsLayout({ children }: { children: ReactNode }) {
  return <><SharedRosterSync />{children}</>;
}
