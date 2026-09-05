import { redirect } from "next/navigation";
import { requireSession } from "../../../lib/server/portal-auth";
import BulkRosterImport from "./bulk-roster-import";
import ClassControlPanel from "./class-control-panel";
import "./admin-student-modal-fix.css";

export default async function AdminStudentsLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession("admin");
  if (!session) redirect("/admin");
  return <>
    <BulkRosterImport />
    {children}
    <ClassControlPanel />
  </>;
}
