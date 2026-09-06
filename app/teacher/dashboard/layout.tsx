import type { ReactNode } from "react";
import DashboardClassLinks from "./dashboard-class-links";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <>
    <DashboardClassLinks />
    {children}
  </>;
}
