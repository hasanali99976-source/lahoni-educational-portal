import { redirect } from "next/navigation";
import { requireSession } from "../../../lib/server/portal-auth";
import "./admin-student-modal-fix.css";
import "./students-luxe-v12.css";

export default async function AdminStudentsLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession("admin");
  if (!session) redirect("/admin");
  return <><script src="/admin-roster-print-v2.js" defer />{children}</>;
}
