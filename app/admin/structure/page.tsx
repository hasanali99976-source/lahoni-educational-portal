import { redirect } from "next/navigation";

export default function AdminStructureRedirect() {
  redirect("/admin/students");
}
