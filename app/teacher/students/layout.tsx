import type { ReactNode } from "react";
import StudentQrLinkUpgrader from "./student-qr-link-upgrader";
import "./students-readable-v10.css";
import "./students-table-v11.css";

export default function StudentsLayout({ children }: { children: ReactNode }) {
  return <><StudentQrLinkUpgrader />{children}</>;
}
