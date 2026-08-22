import "./student-v3.css";
import StudentSecurity from "./student-security";
import StudentClassGuard from "./student-class-guard";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <StudentSecurity><StudentClassGuard />{children}</StudentSecurity>;
}
