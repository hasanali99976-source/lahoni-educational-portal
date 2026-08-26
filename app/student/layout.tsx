import "./student-v3.css";
import StudentSecurity from "./student-security";
import StudentClassGuard from "./student-class-guard";
import StudentCodeOnlyUI from "./student-code-only-ui";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <StudentSecurity><StudentClassGuard /><StudentCodeOnlyUI />{children}</StudentSecurity>;
}
