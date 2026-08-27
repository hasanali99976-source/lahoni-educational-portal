import "./student-v3.css";
import "./student-code-only.css";
import StudentSecurity from "./student-security";
import StudentClassGuard from "./student-class-guard";
import StudentCodeOnlyUI from "./student-code-only-ui";
import IosCodeSubmitFix from "./ios-code-submit-fix";
import StudentExitButton from "./student-exit-button";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <StudentSecurity><StudentClassGuard /><StudentCodeOnlyUI /><IosCodeSubmitFix /><StudentExitButton />{children}</StudentSecurity>;
}
