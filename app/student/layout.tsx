import "./student-v3.css";
import StudentQrLock from "./student-qr-lock";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <><StudentQrLock />{children}</>;
}
