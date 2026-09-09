import StudentQrLock from "./student-qr-lock";
import StudentReportSessionGuard from "./student-report-session-guard";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <><StudentQrLock /><StudentReportSessionGuard />{children}</>;
}
