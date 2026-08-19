import Link from "next/link";
import type { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <section dir="rtl" style={{ marginBottom: 16, padding: "16px 18px", borderRadius: 18, background: "linear-gradient(135deg,#eaf9f5,#fff8df)", border: "1px solid #d4e8e2", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div>
          <strong style={{ display: "block", fontSize: 19, color: "#174641" }}>إدارة المواد الاختيارية</strong>
          <span style={{ color: "#647875" }}>أضف المواد التي تدرّسها وحدد الصفوف والشُعب، ثم فعّلها أو أخفها متى شئت.</span>
        </div>
        <Link href="/teacher/subjects" style={{ padding: "11px 17px", borderRadius: 12, background: "#0d756f", color: "#fff", fontWeight: 900, textDecoration: "none" }}>
          إدارة موادي
        </Link>
      </section>
      {children}
    </>
  );
}
