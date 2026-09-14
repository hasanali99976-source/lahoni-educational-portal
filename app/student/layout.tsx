import StudentQrLock from "./student-qr-lock";
import StudentReportSessionGuard from "./student-report-session-guard";
import StudentWelcomeVoice from "./student-welcome-voice";
import "./student-shell-refinement.css";
import "./student-v11-restore.css";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <><StudentQrLock /><StudentReportSessionGuard /><StudentWelcomeVoice />{children}</>;
}
