import "./student-v3.css";
import "./student-mobile-complete.css";
import "./student-lite-v61.css";
import StudentQrLock from "./student-qr-lock";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <><StudentQrLock />{children}</>;
}
