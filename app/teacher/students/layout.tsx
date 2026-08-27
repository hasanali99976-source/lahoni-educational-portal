import type { ReactNode } from "react";
import StudentQrLinkUpgrader from "./student-qr-link-upgrader";

export default function StudentsLayout({ children }: { children: ReactNode }) {
  return <><StudentQrLinkUpgrader />{children}</>;
}
