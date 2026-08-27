import type { ReactNode } from "react";
import SharedRosterSync from "./shared-roster-sync";
import StudentQrLinkUpgrader from "./student-qr-link-upgrader";

export default function StudentsLayout({ children }: { children: ReactNode }) {
  return <><SharedRosterSync /><StudentQrLinkUpgrader />{children}</>;
}
