import "./student-v3.css";
import "./student-mobile-complete.css";
import "./student-knowledge-v63.css";
import "./student-refine-v64.css";
import "./student-premium-v66.css";
import "./student-wow-v67.css";
import "./student-dashboard-v68.css";
import StudentQrLock from "./student-qr-lock";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <><StudentQrLock />{children}</>;
}
