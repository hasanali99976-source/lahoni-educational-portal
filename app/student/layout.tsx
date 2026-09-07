import "./student-v3.css";
import "./student-mobile-complete.css";
import "./student-knowledge-v63.css";
import "./student-refine-v64.css";
import "./student-premium-v66.css";
import "./student-wow-v67.css";
import "./student-dashboard-v68.css";
import "./student-clarity-v69.css";
import StudentQrLock from "./student-qr-lock";
import StudentReportSessionGuard from "./student-report-session-guard";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <><StudentQrLock /><StudentReportSessionGuard />{children}</>;
}
