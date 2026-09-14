import StudentNetworkGuard from "./student-network-guard";
import StudentQrLock from "./student-qr-lock";
import StudentReportSessionGuard from "./student-report-session-guard";
import StudentWelcomeVoice from "./student-welcome-voice";
import "./student-shell-refinement.css";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <><StudentNetworkGuard /><StudentQrLock /><StudentReportSessionGuard /><StudentWelcomeVoice />{children}</>;
}
