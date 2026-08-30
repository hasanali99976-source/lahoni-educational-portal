import ClassControlPanel from "./class-control-panel";
import "./admin-student-modal-fix.css";

export default function AdminStudentsLayout({ children }: { children: React.ReactNode }) {
  return <>
    {children}
    <ClassControlPanel />
  </>;
}
