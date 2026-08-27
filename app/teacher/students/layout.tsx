import type { ReactNode } from "react";
import QuotaStudentFallback from "./quota-student-fallback";
import StudentQrLinkUpgrader from "./student-qr-link-upgrader";

export default function StudentsLayout({ children }: { children: ReactNode }) {
  return <><StudentQrLinkUpgrader /><QuotaStudentFallback />{children}</>;
}
