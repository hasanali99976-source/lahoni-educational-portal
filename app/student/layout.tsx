import "./student-v3.css";
import StudentQrEntryGuard from "./student-qr-entry-guard";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <><StudentQrEntryGuard />{children}</>;
}
