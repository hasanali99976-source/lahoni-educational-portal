import "./student-report-pdf-v2.css";
import "./student-v400.css";
import StudentQrLock from "./student-qr-lock";
import StudentReportSessionGuard from "./student-report-session-guard";
import StudentReportPdfV2Runtime from "./student-report-pdf-v2-runtime";
import StudentUiCleanupRuntime from "./student-ui-cleanup-runtime";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <><StudentQrLock /><StudentReportSessionGuard /><StudentReportPdfV2Runtime /><StudentUiCleanupRuntime />{children}</>;
}
