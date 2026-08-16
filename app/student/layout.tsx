import "./student-note.css";
import StudentSecurity from "./student-security";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <StudentSecurity>{children}</StudentSecurity>;
}
