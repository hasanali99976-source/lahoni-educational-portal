import StudentQrLock from "./student-qr-lock";
import StudentReportSessionGuard from "./student-report-session-guard";
import StudentWelcomeVoice from "./student-welcome-voice";
import StudentSmartAssistant from "./student-smart-assistant";
import "./student-shell-refinement.css";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <><StudentQrLock /><StudentReportSessionGuard /><StudentWelcomeVoice /><StudentSmartAssistant />{children}</>;
}
