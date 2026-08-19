import "./student-note.css";
import "./student-v2.css";
import StudentSecurity from "./student-security";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <StudentSecurity>{children}</StudentSecurity>;
}
